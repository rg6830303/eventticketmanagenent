import 'server-only';
import { query, queryOne, transaction } from './db';
import { generateBookingReference, generateTicketCode } from './tickets';
import { env } from './env';
import type {
  BookingDetail,
  BookingRow,
  EventRow,
  TicketRow,
  TicketTierRow,
  ScanOutcome,
} from './types';

/** Domain error that is safe to show the customer verbatim. */
export class BookingError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'BookingError';
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  return queryOne<EventRow>('SELECT * FROM events WHERE slug = $1', [slug]);
}

export async function listPublishedEvents(): Promise<EventRow[]> {
  return query<EventRow>(
    `SELECT * FROM events
     WHERE status IN ('published', 'sold_out')
     ORDER BY starts_at ASC`,
  );
}

export async function listTiers(eventId: string): Promise<TicketTierRow[]> {
  return query<TicketTierRow>(
    `SELECT * FROM ticket_tiers
     WHERE event_id = $1 AND active = true
     ORDER BY sort_order ASC, price_paise ASC`,
    [eventId],
  );
}

export async function getBookingByReference(reference: string): Promise<BookingDetail | null> {
  const booking = await queryOne<BookingRow>('SELECT * FROM bookings WHERE reference = $1', [
    reference.toUpperCase(),
  ]);
  if (!booking) return null;

  const [event, tier, tickets] = await Promise.all([
    queryOne<EventRow>('SELECT * FROM events WHERE id = $1', [booking.event_id]),
    booking.tier_id
      ? queryOne<TicketTierRow>('SELECT * FROM ticket_tiers WHERE id = $1', [booking.tier_id])
      : Promise.resolve(null),
    query<TicketRow>('SELECT * FROM tickets WHERE booking_id = $1 ORDER BY created_at ASC', [
      booking.id,
    ]),
  ]);

  if (!event) return null;
  return { booking, event, tier, tickets };
}

export async function getBookingById(id: string): Promise<BookingDetail | null> {
  const row = await queryOne<{ reference: string }>('SELECT reference FROM bookings WHERE id = $1', [
    id,
  ]);
  return row ? getBookingByReference(row.reference) : null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateBookingArgs {
  eventSlug: string;
  tierCode: string;
  name: string;
  email: string;
  phone: string;
  quantity: number;
  idempotencyKey?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  source?: string;
}

/**
 * Create a booking and mint its tickets.
 *
 * Everything happens in one transaction with a row lock on the tier, because
 * inventory is the one place where a race actually oversells the room: two
 * requests reading `sold` at the same time would both see capacity and both
 * commit. `SELECT … FOR UPDATE` serialises them.
 *
 * With PAYMENTS_ENABLED=false the booking is confirmed immediately and tickets
 * are issued on the spot. With payments on, it lands as `pending` and the
 * Razorpay verify route promotes it — the ticket-minting code path is shared,
 * so switching the flag does not change what a ticket looks like.
 */
export async function createBooking(args: CreateBookingArgs): Promise<BookingDetail> {
  const quantity = args.quantity;
  if (quantity > env.maxTicketsPerBooking) {
    throw new BookingError(
      `Maximum ${env.maxTicketsPerBooking} tickets per booking. Contact us for group bookings.`,
      'quantity_exceeded',
    );
  }

  // Replay of the same submit returns the original booking rather than a second one.
  if (args.idempotencyKey) {
    const existing = await queryOne<{ reference: string }>(
      'SELECT reference FROM bookings WHERE idempotency_key = $1',
      [args.idempotencyKey],
    );
    if (existing) {
      const detail = await getBookingByReference(existing.reference);
      if (detail) return detail;
    }
  }

  const reference = await transaction(async (client) => {
    const eventResult = await client.query<EventRow>(
      'SELECT * FROM events WHERE slug = $1 FOR UPDATE',
      [args.eventSlug],
    );
    const event = eventResult.rows[0];
    if (!event) throw new BookingError('That event does not exist', 'event_not_found', 404);
    if (event.status === 'cancelled') {
      throw new BookingError('This event has been cancelled', 'event_cancelled', 409);
    }
    if (event.status === 'draft' || event.status === 'archived') {
      throw new BookingError('Tickets are not on sale for this event', 'event_unavailable', 409);
    }
    if (new Date(event.starts_at).getTime() < Date.now()) {
      throw new BookingError('This event has already happened', 'event_past', 409);
    }

    const tierResult = await client.query<TicketTierRow>(
      'SELECT * FROM ticket_tiers WHERE event_id = $1 AND code = $2 AND active = true FOR UPDATE',
      [event.id, args.tierCode],
    );
    const tier = tierResult.rows[0];
    if (!tier) throw new BookingError('That ticket type is not available', 'tier_not_found', 404);

    const remaining = tier.quantity - tier.sold;
    if (remaining <= 0) {
      throw new BookingError(`${tier.name} is sold out`, 'tier_sold_out', 409);
    }
    if (remaining < quantity) {
      throw new BookingError(
        `Only ${remaining} ${tier.name} ticket${remaining === 1 ? '' : 's'} left`,
        'insufficient_inventory',
        409,
      );
    }

    // Room capacity is a second, independent ceiling above per-tier stock.
    const issued = await client.query<{ count: string }>(
      `SELECT COALESCE(SUM(quantity), 0)::text AS count FROM bookings
       WHERE event_id = $1 AND status IN ('pending', 'confirmed')`,
      [event.id],
    );
    if (Number(issued.rows[0]?.count ?? 0) + quantity > event.capacity) {
      throw new BookingError('This event is at capacity', 'event_at_capacity', 409);
    }

    const amountPaise = tier.price_paise * quantity;
    const paid = !env.paymentsEnabled || amountPaise === 0;
    const bookingReference = generateBookingReference();

    const bookingResult = await client.query<BookingRow>(
      `INSERT INTO bookings (
         reference, event_id, tier_id, customer_name, customer_email, customer_phone,
         quantity, amount_paise, status, payment_provider, idempotency_key,
         source, ip_address, user_agent, paid_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        bookingReference,
        event.id,
        tier.id,
        args.name,
        args.email.toLowerCase(),
        args.phone,
        quantity,
        amountPaise,
        paid ? 'confirmed' : 'pending',
        paid ? (amountPaise === 0 ? 'comp' : 'none') : 'razorpay',
        args.idempotencyKey ?? null,
        args.source ?? 'web',
        args.ipAddress ?? null,
        args.userAgent ?? null,
        paid ? new Date().toISOString() : null,
      ],
    );
    const booking = bookingResult.rows[0];

    // Reserve inventory for pending bookings too; the cleanup job releases
    // anything that never gets paid.
    await client.query('UPDATE ticket_tiers SET sold = sold + $2 WHERE id = $1', [
      tier.id,
      quantity,
    ]);

    if (paid) {
      await mintTickets(client, booking, event, tier);
    }

    return bookingReference;
  });

  const detail = await getBookingByReference(reference);
  if (!detail) throw new BookingError('Booking could not be read back', 'internal_error', 500);
  return detail;
}

/**
 * Insert `booking.quantity` ticket rows.
 *
 * Codes come from a CSPRNG so a collision is already astronomically unlikely,
 * but the UNIQUE constraint is the real guarantee: on a duplicate we retry
 * rather than hand two people the same pass.
 */
async function mintTickets(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: TicketRow[] }> },
  booking: BookingRow,
  event: EventRow,
  tier: TicketTierRow | null,
): Promise<void> {
  for (let i = 0; i < booking.quantity; i += 1) {
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
      try {
        await client.query(
          `INSERT INTO tickets (booking_id, event_id, tier_id, code, holder_name, seat_label)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            booking.id,
            event.id,
            tier?.id ?? null,
            generateTicketCode(event.slug),
            booking.quantity === 1 ? booking.customer_name : `${booking.customer_name} +${i}`,
            `${tier?.code ?? 'GA'}-${String(i + 1).padStart(2, '0')}`,
          ],
        );
        inserted = true;
      } catch (error) {
        const isDuplicate =
          typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
        if (!isDuplicate || attempt === 4) throw error;
      }
    }
  }
}

/** Promote a pending (Razorpay) booking to confirmed and mint its tickets. */
export async function confirmPendingBooking(
  bookingId: string,
  payment: { paymentId: string; orderId: string; signature: string },
): Promise<BookingDetail> {
  const reference = await transaction(async (client) => {
    const result = await client.query<BookingRow>(
      `UPDATE bookings
         SET status = 'confirmed', payment_id = $2, payment_order_id = $3,
             payment_signature = $4, paid_at = now()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [bookingId, payment.paymentId, payment.orderId, payment.signature],
    );
    const booking = result.rows[0];
    if (!booking) {
      // Either already confirmed (webhook raced the browser) or non-existent.
      const existing = await client.query<BookingRow>('SELECT * FROM bookings WHERE id = $1', [
        bookingId,
      ]);
      if (existing.rows[0]?.status === 'confirmed') return existing.rows[0].reference;
      throw new BookingError('Booking not found or not payable', 'booking_not_pending', 409);
    }

    const eventResult = await client.query<EventRow>('SELECT * FROM events WHERE id = $1', [
      booking.event_id,
    ]);
    const tierResult = booking.tier_id
      ? await client.query<TicketTierRow>('SELECT * FROM ticket_tiers WHERE id = $1', [
          booking.tier_id,
        ])
      : { rows: [] as TicketTierRow[] };

    await mintTickets(client, booking, eventResult.rows[0], tierResult.rows[0] ?? null);
    return booking.reference;
  });

  const detail = await getBookingByReference(reference);
  if (!detail) throw new BookingError('Booking could not be read back', 'internal_error', 500);
  return detail;
}

export async function markEmailSent(bookingId: string): Promise<void> {
  await query('UPDATE bookings SET email_sent_at = now() WHERE id = $1', [bookingId]);
}

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

export interface CheckInArgs {
  code: string;
  mode: 'check' | 'admit';
  operatorId?: string | null;
  eventSlug?: string | null;
  gate?: string | null;
  ipAddress?: string | null;
}

/**
 * Redeem a ticket.
 *
 * The state change is a single conditional UPDATE (`… WHERE status = 'valid'`),
 * so two scanners hitting the same QR at two doors cannot both get `admitted`:
 * exactly one UPDATE matches a row, the other returns zero rows and is reported
 * as a duplicate. That is the property that matters at a real door.
 */
export async function checkInTicket(args: CheckInArgs): Promise<ScanOutcome> {
  const ticket = await queryOne<
    TicketRow & {
      event_name: string;
      event_slug: string;
      tier_name: string | null;
      booking_reference: string;
      booking_status: string;
      booking_quantity: number;
    }
  >(
    `SELECT t.*, e.name AS event_name, e.slug AS event_slug,
            tt.name AS tier_name,
            b.reference AS booking_reference, b.status AS booking_status,
            b.quantity AS booking_quantity
     FROM tickets t
     JOIN events e   ON e.id = t.event_id
     JOIN bookings b ON b.id = t.booking_id
     LEFT JOIN ticket_tiers tt ON tt.id = t.tier_id
     WHERE t.code = $1`,
    [args.code],
  );

  if (!ticket) {
    await logScan(null, null, args, 'not_found', 'No ticket matches this code');
    return {
      result: 'not_found',
      ok: false,
      title: 'Not found',
      message: 'This code is not in the system. Ask for the booking reference.',
    };
  }

  const base = {
    ticket: {
      code: ticket.code,
      holderName: ticket.holder_name,
      tierName: ticket.tier_name,
      seatLabel: ticket.seat_label,
      bookingReference: ticket.booking_reference,
      quantity: ticket.booking_quantity,
      checkedInAt: ticket.checked_in_at,
    },
    event: { name: ticket.event_name, slug: ticket.event_slug },
  };

  if (args.eventSlug && ticket.event_slug !== args.eventSlug) {
    await logScan(ticket.id, ticket.event_id, args, 'wrong_event', `Ticket is for ${ticket.event_name}`);
    return {
      ...base,
      result: 'wrong_event',
      ok: false,
      title: 'Wrong event',
      message: `This pass is for ${ticket.event_name}, not tonight's event.`,
    };
  }

  if (ticket.status === 'void' || ticket.booking_status === 'cancelled') {
    await logScan(ticket.id, ticket.event_id, args, 'void', 'Ticket voided or booking cancelled');
    return {
      ...base,
      result: 'void',
      ok: false,
      title: 'Cancelled',
      message: 'This booking was cancelled. Entry refused.',
    };
  }

  if (ticket.status === 'refunded' || ticket.booking_status === 'refunded') {
    await logScan(ticket.id, ticket.event_id, args, 'refunded', 'Ticket refunded');
    return {
      ...base,
      result: 'refunded',
      ok: false,
      title: 'Refunded',
      message: 'This ticket was refunded and is no longer valid.',
    };
  }

  if (ticket.status === 'used') {
    await logScan(ticket.id, ticket.event_id, args, 'duplicate', 'Already checked in');
    return {
      ...base,
      result: 'duplicate',
      ok: false,
      title: 'Already used',
      message: ticket.checked_in_at
        ? `Scanned at ${new Date(ticket.checked_in_at).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: 'numeric',
            minute: '2-digit',
          })}${ticket.checked_in_gate ? ` · ${ticket.checked_in_gate}` : ''}.`
        : 'This pass has already been redeemed.',
    };
  }

  // Preview mode — look the ticket up without consuming it.
  if (args.mode === 'check') {
    return {
      ...base,
      result: 'admitted',
      ok: true,
      title: 'Valid',
      message: 'Ticket is valid and not yet used. Switch to Admit to check in.',
    };
  }

  const updated = await queryOne<TicketRow>(
    `UPDATE tickets
       SET status = 'used', checked_in_at = now(), checked_in_by = $2, checked_in_gate = $3
     WHERE id = $1 AND status = 'valid'
     RETURNING *`,
    [ticket.id, args.operatorId ?? null, args.gate ?? null],
  );

  if (!updated) {
    // Lost the race against another scanner between the read and the update.
    await logScan(ticket.id, ticket.event_id, args, 'duplicate', 'Concurrent scan');
    return {
      ...base,
      result: 'duplicate',
      ok: false,
      title: 'Already used',
      message: 'Another scanner admitted this pass a moment ago.',
    };
  }

  await logScan(ticket.id, ticket.event_id, args, 'admitted', 'Checked in');
  return {
    ...base,
    ticket: { ...base.ticket, checkedInAt: updated.checked_in_at },
    result: 'admitted',
    ok: true,
    title: 'Admitted',
    message: `${ticket.holder_name} is in. Enjoy the night.`,
  };
}

async function logScan(
  ticketId: string | null,
  eventId: string | null,
  args: CheckInArgs,
  result: ScanOutcome['result'],
  message: string,
): Promise<void> {
  try {
    await query(
      `INSERT INTO scan_log (ticket_id, event_id, scanned_code, result, message, operator_id, gate, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        ticketId,
        eventId,
        args.code,
        result,
        message,
        args.operatorId ?? null,
        args.gate ?? null,
        args.ipAddress ?? null,
      ],
    );
  } catch (error) {
    console.error('[scan-log] write failed:', error);
  }
}

/** Record a scan that never resolved to a ticket (bad signature, junk QR). */
export async function logRejectedScan(
  rawCode: string | null,
  result: ScanOutcome['result'],
  message: string,
  operatorId?: string | null,
  gate?: string | null,
  ipAddress?: string | null,
): Promise<void> {
  await logScan(
    null,
    null,
    { code: rawCode ?? '', mode: 'admit', operatorId, gate, ipAddress },
    result,
    message,
  );
}
