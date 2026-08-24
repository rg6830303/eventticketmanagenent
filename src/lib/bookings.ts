import 'server-only';
import { query, queryOne, transaction } from './db';
import { generateBookingReference, generateTicketCode } from './tickets';
import { applyReferralInTransaction, releaseReferral, type ReferralCheck } from './referrals';
import { upsertCustomerInTransaction } from './customers';
import { env } from './env';
import type {
  BookingDetail,
  BookingItemRow,
  BookingRow,
  CartLineInput,
  CustomerRow,
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

  const [event, tier, tickets, items, customer] = await Promise.all([
    queryOne<EventRow>('SELECT * FROM events WHERE id = $1', [booking.event_id]),
    booking.tier_id
      ? queryOne<TicketTierRow>('SELECT * FROM ticket_tiers WHERE id = $1', [booking.tier_id])
      : Promise.resolve(null),
    query<TicketRow>('SELECT * FROM tickets WHERE booking_id = $1 ORDER BY created_at ASC', [
      booking.id,
    ]),
    query<BookingItemRow>(
      'SELECT * FROM booking_items WHERE booking_id = $1 ORDER BY line_total_paise DESC, tier_code ASC',
      [booking.id],
    ),
    booking.customer_id
      ? queryOne<CustomerRow>('SELECT * FROM customers WHERE id = $1', [booking.customer_id])
      : Promise.resolve(null),
  ]);

  if (!event) return null;
  return { booking, event, tier, tickets, items, customer };
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
  /**
   * The cart. One entry per pass type; a single-tier booking is just a cart of
   * length one, so there is only one code path to get wrong.
   */
  items: CartLineInput[];
  name: string;
  email: string;
  phone: string;
  /** Raw text from the referral field. Validated and priced under the tier lock. */
  referralCode?: string | null;
  idempotencyKey?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  source?: string;
  marketingOptIn?: boolean;
}

export interface CreateBookingResult {
  detail: BookingDetail;
  /**
   * What happened to the referral code, if one was supplied. A refused code
   * does not fail the booking, so the caller has to be told separately in order
   * to explain the price the customer ends up seeing.
   */
  referral: ReferralCheck | null;
}

/**
 * Create a booking and, when nothing is owed, mint its tickets.
 *
 * Everything happens in one transaction with a row lock on each tier, because
 * inventory is the one place where a race actually oversells the room: two
 * requests reading `sold` at the same time would both see capacity and both
 * commit. `SELECT … FOR UPDATE` serialises them.
 *
 * The tiers are locked in a fixed order (sorted by code). Two carts holding the
 * same two tiers in opposite orders would otherwise deadlock against each
 * other, and Postgres would resolve it by killing one of the bookings.
 *
 * With payments off — or on a zero-value order — the booking is confirmed and
 * ticketed on the spot. Otherwise it lands as `pending` and the gateway's
 * confirmation promotes it. The ticket-minting path is shared, so a Cashfree
 * ticket is byte-identical to a comped one.
 */
export async function createBooking(args: CreateBookingArgs): Promise<CreateBookingResult> {
  const lines = normaliseLines(args.items);
  if (lines.length === 0) {
    throw new BookingError('Your cart is empty', 'empty_cart');
  }

  const totalPasses = lines.reduce((sum, line) => sum + line.quantity, 0);
  if (totalPasses > env.maxTicketsPerBooking) {
    throw new BookingError(
      `Maximum ${env.maxTicketsPerBooking} passes per booking. Contact us for group bookings.`,
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
      if (detail) {
        return {
          detail,
          referral: detail.booking.referral_code
            ? {
                valid: true,
                code: detail.booking.referral_code,
                discountPaise: detail.booking.discount_paise,
                label: null,
              }
            : null,
        };
      }
    }
  }

  let referral: ReferralCheck | null = null;

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

    // --- Price and reserve every line ------------------------------------
    const priced: Array<{ tier: TicketTierRow; quantity: number; lineTotal: number }> = [];

    for (const line of lines) {
      const tierResult = await client.query<TicketTierRow>(
        'SELECT * FROM ticket_tiers WHERE event_id = $1 AND code = $2 AND active = true FOR UPDATE',
        [event.id, line.tierCode],
      );
      const tier = tierResult.rows[0];
      if (!tier) {
        throw new BookingError(
          `"${line.tierCode}" is not a ticket type for this event`,
          'tier_not_found',
          404,
        );
      }

      const remaining = tier.quantity - tier.sold;
      if (remaining <= 0) {
        throw new BookingError(`${tier.name} is sold out`, 'tier_sold_out', 409);
      }
      if (remaining < line.quantity) {
        throw new BookingError(
          `Only ${remaining} ${tier.name} ${remaining === 1 ? 'pass' : 'passes'} left`,
          'insufficient_inventory',
          409,
        );
      }

      priced.push({ tier, quantity: line.quantity, lineTotal: tier.price_paise * line.quantity });
    }

    // Room capacity is a second, independent ceiling above per-tier stock, and
    // it counts heads rather than passes: one VIP table pass is five people
    // through the door. Bookings written before booking_items existed fall back
    // to their pass count, which is what they meant at the time.
    const heads = priced.reduce((sum, row) => sum + row.quantity * row.tier.admits, 0);
    const issued = await client.query<{ heads: string }>(
      `SELECT COALESCE(SUM(
                COALESCE(
                  (SELECT SUM(bi.quantity * bi.admits_each)
                     FROM booking_items bi WHERE bi.booking_id = b.id),
                  b.quantity
                )
              ), 0)::text AS heads
         FROM bookings b
        WHERE b.event_id = $1 AND b.status IN ('pending', 'confirmed')`,
      [event.id],
    );
    if (Number(issued.rows[0]?.heads ?? 0) + heads > event.capacity) {
      throw new BookingError('This event is at capacity', 'event_at_capacity', 409);
    }

    const subtotalPaise = priced.reduce((sum, row) => sum + row.lineTotal, 0);

    // Claimed under the same transaction as the inventory, so a limited code
    // and the last ticket cannot both be handed to two people at once.
    referral = await applyReferralInTransaction(client, args.referralCode, subtotalPaise);
    const discountPaise = referral.valid ? referral.discountPaise : 0;
    const amountPaise = Math.max(0, subtotalPaise - discountPaise);

    // Whether this booking may be confirmed without a payment.
    //
    // Only two things earn that: an order that costs nothing, or an explicit
    // ALLOW_FREE_BOOKINGS opt-in for local development. This used to read
    // `!env.paymentsEnabled || amountPaise === 0`, which meant a live site that
    // lost its gateway credentials — deleted, renamed, expired — would silently
    // start confirming every booking for free and emailing real tickets. A
    // misconfigured gateway must stop sales, never give the inventory away.
    const chargeable = amountPaise > 0;

    if (chargeable && !env.paymentsEnabled) {
      if (!env.allowFreeBookings) {
        console.error('[bookings] refused a priced booking: no payment gateway is configured');
        throw new BookingError(
          'Ticket sales are paused for a moment while we sort out our payment provider. ' +
            'Nothing has been charged — please try again shortly.',
          'payments_unavailable',
          503,
        );
      }
      console.warn('[bookings] ALLOW_FREE_BOOKINGS is on — confirming a priced booking unpaid');
    }

    const paid = !chargeable || env.allowFreeBookings;
    const bookingReference = generateBookingReference();

    // The catalogue entry is written before the booking so the foreign key is
    // available, and inside the same transaction so a failed booking never
    // leaves a customer row behind claiming a purchase that did not happen.
    const customer = await upsertCustomerInTransaction(client, {
      email: args.email,
      name: args.name,
      phone: args.phone,
      source: args.source ?? 'web',
      ipAddress: args.ipAddress ?? null,
      userAgent: args.userAgent ?? null,
      marketingOptIn: args.marketingOptIn ?? false,
    });

    // `tier_id` on the booking points at the biggest line. It predates carts
    // and is what the admin list, the ticket email and the confirmation page
    // still read for a headline "what did they buy".
    const headline = [...priced].sort((a, b) => b.lineTotal - a.lineTotal)[0];

    const bookingResult = await client.query<BookingRow>(
      `INSERT INTO bookings (
         reference, event_id, tier_id, customer_id,
         customer_name, customer_email, customer_phone,
         quantity, subtotal_paise, discount_paise, referral_code, amount_paise,
         status, payment_provider, idempotency_key,
         source, ip_address, user_agent, paid_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [
        bookingReference,
        event.id,
        headline.tier.id,
        customer.id,
        args.name,
        args.email.toLowerCase(),
        args.phone,
        totalPasses,
        subtotalPaise,
        discountPaise,
        referral.valid ? referral.code : null,
        amountPaise,
        paid ? 'confirmed' : 'pending',
        paid ? (amountPaise === 0 ? 'comp' : 'none') : env.paymentProvider,
        args.idempotencyKey ?? null,
        args.source ?? 'web',
        args.ipAddress ?? null,
        args.userAgent ?? null,
        paid ? new Date().toISOString() : null,
      ],
    );
    const booking = bookingResult.rows[0];

    for (const row of priced) {
      await client.query(
        `INSERT INTO booking_items (
           booking_id, tier_id, tier_code, tier_name, unit_price_paise,
           quantity, admits_each, redeemable_paise, line_total_paise
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          booking.id,
          row.tier.id,
          row.tier.code,
          row.tier.name,
          row.tier.price_paise,
          row.quantity,
          row.tier.admits,
          row.tier.redeemable_paise,
          row.lineTotal,
        ],
      );

      // Reserve inventory for pending bookings too; an unpaid order holds its
      // stock until it is cancelled, which is what "your spot is held while you
      // pay" on the checkout page promises.
      await client.query('UPDATE ticket_tiers SET sold = sold + $2 WHERE id = $1', [
        row.tier.id,
        row.quantity,
      ]);
    }

    if (paid) {
      await mintTickets(client, booking.id);
    }

    return bookingReference;
  });

  const detail = await getBookingByReference(reference);
  if (!detail) throw new BookingError('Booking could not be read back', 'internal_error', 500);
  return { detail, referral };
}

/**
 * Collapse a raw cart into priced-able lines.
 *
 * Duplicated codes are summed rather than rejected — a cart that somehow holds
 * two NORMAL entries means three passes, not an error — and the result is
 * sorted so the tier locks in `createBooking` are always taken in the same
 * order.
 */
function normaliseLines(items: readonly CartLineInput[]): CartLineInput[] {
  const merged = new Map<string, number>();

  for (const item of items ?? []) {
    const code = String(item?.tierCode ?? '').trim().toUpperCase();
    const quantity = Math.floor(Number(item?.quantity));
    if (!code || !Number.isFinite(quantity) || quantity <= 0) continue;
    merged.set(code, (merged.get(code) ?? 0) + quantity);
  }

  return [...merged.entries()]
    .map(([tierCode, quantity]) => ({ tierCode, quantity }))
    .sort((a, b) => a.tierCode.localeCompare(b.tierCode));
}

interface MintClient {
  query: <T = unknown>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>;
}

/**
 * Insert one ticket row per pass, reading the lines straight back out of the
 * database rather than taking them as an argument.
 *
 * That indirection is deliberate: minting happens from four call sites (the
 * free path, the Cashfree return, the Cashfree webhook and a UPI release) and
 * three of them only have a booking id. Sourcing the lines from
 * `booking_items` means none of them can mint a ticket that disagrees with what
 * was actually bought.
 *
 * Codes come from a CSPRNG so a collision is already astronomically unlikely,
 * but the UNIQUE constraint is the real guarantee: on a duplicate we retry
 * rather than hand two people the same pass.
 */
async function mintTickets(client: MintClient, bookingId: string): Promise<void> {
  const { rows: bookings } = await client.query<BookingRow & { event_slug: string }>(
    `SELECT b.*, e.slug AS event_slug
       FROM bookings b JOIN events e ON e.id = b.event_id
      WHERE b.id = $1`,
    [bookingId],
  );
  const booking = bookings[0];
  if (!booking) throw new BookingError('Booking vanished mid-mint', 'internal_error', 500);

  // Already ticketed — a webhook racing the browser must not double-issue.
  const { rows: existing } = await client.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM tickets WHERE booking_id = $1',
    [bookingId],
  );
  if (Number(existing[0]?.count ?? 0) > 0) return;

  const { rows: items } = await client.query<BookingItemRow>(
    'SELECT * FROM booking_items WHERE booking_id = $1 ORDER BY tier_code ASC',
    [bookingId],
  );

  // Bookings written before booking_items existed still have to be mintable.
  const lines: Array<Pick<BookingItemRow, 'id' | 'tier_id' | 'tier_code' | 'quantity' | 'admits_each'>> =
    items.length > 0
      ? items
      : [
          {
            id: null as unknown as string,
            tier_id: booking.tier_id,
            tier_code: 'GA',
            quantity: booking.quantity,
            admits_each: 1,
          },
        ];

  let seat = 0;

  for (const line of lines) {
    for (let i = 0; i < line.quantity; i += 1) {
      seat += 1;

      // The holder name is the buyer for the first pass and a numbered variant
      // after that. Nobody collects per-guest names at this scale, and a door
      // that reads "Rahul Ghosh +2" is more useful than three identical rows.
      // The first pass is never suffixed: "+0" is not a person.
      const holder = seat === 1 ? booking.customer_name : `${booking.customer_name} +${seat - 1}`;
      const seatLabel = `${line.tier_code}-${String(i + 1).padStart(2, '0')}`;

      let inserted = false;
      for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
        try {
          await client.query(
            `INSERT INTO tickets (
               booking_id, event_id, tier_id, booking_item_id, code,
               holder_name, seat_label, admits
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              booking.id,
              booking.event_id,
              line.tier_id,
              line.id ?? null,
              generateTicketCode(booking.event_slug),
              holder,
              seatLabel,
              line.admits_each,
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
}

export interface ConfirmPaymentArgs {
  paymentId: string;
  orderId: string;
  signature: string;
  /** Defaults to whatever the booking was created against. */
  provider?: 'razorpay' | 'cashfree' | 'upi' | 'cash' | 'comp';
}

/**
 * Promote a pending booking to confirmed and mint its passes.
 *
 * The UPDATE is guarded on `status = 'pending'`, so a webhook and a browser
 * redirect arriving at the same instant cannot both confirm: exactly one
 * matches a row. The loser reads the booking back and returns it unchanged,
 * which is why both callers can treat a duplicate as success.
 */
export async function confirmPendingBooking(
  bookingId: string,
  payment: ConfirmPaymentArgs,
): Promise<BookingDetail> {
  const reference = await transaction(async (client) => {
    const result = await client.query<BookingRow>(
      `UPDATE bookings
         SET status = 'confirmed', payment_id = $2, payment_order_id = $3,
             payment_signature = $4, paid_at = now(),
             payment_provider = COALESCE($5, payment_provider)
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [bookingId, payment.paymentId, payment.orderId, payment.signature, payment.provider ?? null],
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

    await mintTickets(client, booking.id);
    return booking.reference;
  });

  const detail = await getBookingByReference(reference);
  if (!detail) throw new BookingError('Booking could not be read back', 'internal_error', 500);
  return detail;
}

export async function markEmailSent(bookingId: string): Promise<void> {
  await query('UPDATE bookings SET email_sent_at = now() WHERE id = $1', [bookingId]);
}

/**
 * Mark a pending booking as failed and hand its inventory back.
 *
 * Called when the gateway reports the order dead rather than merely unpaid.
 * Releasing the stock matters more than the status does: a sold-out tier held
 * by abandoned checkouts is lost revenue that looks like demand.
 */
export async function releasePendingBooking(bookingId: string, reason: string): Promise<void> {
  await transaction(async (client) => {
    const { rows } = await client.query<BookingRow>(
      `UPDATE bookings SET status = 'failed', notes = COALESCE(notes || E'\\n', '') || $2
        WHERE id = $1 AND status = 'pending'
        RETURNING *`,
      [bookingId, reason.slice(0, 200)],
    );
    const booking = rows[0];
    if (!booking) return;

    // Hand the referral use back. `uses` is incremented when a code is claimed
    // at checkout so that max_uses actually caps concurrent claims — which
    // means an abandoned checkout would otherwise consume one of a limited
    // code's slots permanently, and a promoter's 50-use code quietly becomes a
    // 30-use one.
    await releaseReferral(client, booking.referral_code);

    const { rows: items } = await client.query<BookingItemRow>(
      'SELECT * FROM booking_items WHERE booking_id = $1',
      [bookingId],
    );

    for (const item of items) {
      if (!item.tier_id) continue;
      await client.query(
        'UPDATE ticket_tiers SET sold = GREATEST(sold - $2, 0) WHERE id = $1',
        [item.tier_id, item.quantity],
      );
    }

    if (items.length === 0 && booking.tier_id) {
      await client.query('UPDATE ticket_tiers SET sold = GREATEST(sold - $2, 0) WHERE id = $1', [
        booking.tier_id,
        booking.quantity,
      ]);
    }
  });
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
            COALESCE(bi.tier_name, tt.name) AS tier_name,
            b.reference AS booking_reference, b.status AS booking_status,
            b.quantity AS booking_quantity
     FROM tickets t
     JOIN events e   ON e.id = t.event_id
     JOIN bookings b ON b.id = t.booking_id
     LEFT JOIN ticket_tiers tt  ON tt.id = t.tier_id
     LEFT JOIN booking_items bi ON bi.id = t.booking_item_id
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
      admits: ticket.admits ?? 1,
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

  const admits = ticket.admits ?? 1;
  return {
    ...base,
    ticket: { ...base.ticket, checkedInAt: updated.checked_in_at },
    result: 'admitted',
    ok: true,
    title: admits > 1 ? `Admit ${admits}` : 'Admitted',
    message:
      admits > 1
        ? `${ticket.holder_name} — this pass admits ${admits} people. Let them all through.`
        : `${ticket.holder_name} is in. Enjoy the night.`,
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

// ---------------------------------------------------------------------------
// Manual entry at the door
// ---------------------------------------------------------------------------

export interface ResolvedScanInput {
  /** The ticket code to check in. */
  code: string;
  /** How the input was understood, for the operator-facing message. */
  via: 'ticket_code' | 'booking_reference';
  /** Set when a reference resolved to one of several passes. */
  position?: { index: number; total: number };
}

/**
 * Turn something an operator typed into a ticket code.
 *
 * The HMAC on a QR exists to reject a forged pass before the database is
 * touched — it stops a stranger spraying fake codes at the gate from turning
 * into a spray of queries. That threat does not apply to a signed-in operator
 * typing into the console, and refusing them is how a customer with a dead
 * phone gets turned away from an event they paid for.
 *
 * So this path is deliberately allowed, and deliberately separate: it requires
 * an authenticated session, it is recorded in scan_log like any other scan, and
 * it never accepts a *signature* — only an identifier that must exist in the
 * database to mean anything.
 *
 * Accepts a bare ticket code, or a booking reference. A reference resolves to
 * that booking's next unredeemed pass, which is what "my phone died, my
 * reference is HOV-8F3K2Q" should do at a door with a queue behind it.
 */
export async function resolveScanInput(raw: string): Promise<ResolvedScanInput | null> {
  const input = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!input) return null;

  // A full ticket code: HOV-<EVENT>-<10>.
  if (/^HOV-[0-9A-Z]{1,4}-[0-9A-Z]{10}$/.test(input)) {
    const row = await queryOne<{ code: string }>('SELECT code FROM tickets WHERE code = $1', [input]);
    return row ? { code: row.code, via: 'ticket_code' } : null;
  }

  // A booking reference: HOV-<6>.
  if (/^HOV-[0-9A-Z]{6}$/.test(input)) {
    const tickets = await query<{ code: string; status: string }>(
      `SELECT t.code, t.status
         FROM tickets t JOIN bookings b ON b.id = t.booking_id
        WHERE b.reference = $1
        ORDER BY t.seat_label ASC, t.created_at ASC`,
      [input],
    );
    if (tickets.length === 0) return null;

    // The next unredeemed pass, so scanning a family's reference repeatedly
    // admits them one at a time rather than reporting a duplicate forever.
    const nextIndex = tickets.findIndex((ticket) => ticket.status === 'valid');
    const index = nextIndex === -1 ? tickets.length - 1 : nextIndex;

    return {
      code: tickets[index].code,
      via: 'booking_reference',
      position: { index: index + 1, total: tickets.length },
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Operator-issued passes
// ---------------------------------------------------------------------------

export interface IssueBookingArgs {
  eventSlug: string;
  name: string;
  email: string;
  phone: string;
  /** An existing tier code, or null for a one-off pass defined inline. */
  tierCode?: string | null;
  /** Used when tierCode is null: what this pass is called on the ticket. */
  customLabel?: string | null;
  quantity: number;
  /** Heads one pass admits. Ignored when an existing tier is chosen. */
  admits?: number;
  /**
   * What was actually collected, in paise. Zero is a comp. A non-zero figure
   * records cash or a bank transfer taken outside the gateway — it does not
   * charge anyone.
   */
  amountPaise?: number;
  note?: string | null;
  /** The admin doing this. Recorded on the booking and in the audit log. */
  issuedBy: string;
  issuedByEmail: string;
}

/**
 * Issue passes by hand, already confirmed.
 *
 * This is the guest-list and box-office path: a comp for a promoter, a pass for
 * someone who paid in cash, a replacement for a booking that went wrong. It
 * deliberately does not go through `createBooking`, because that function's job
 * is to refuse to confirm anything that has not been paid for — a guarantee
 * worth keeping absolute rather than punching a flag through.
 *
 * What it does share is `mintTickets`, so an operator-issued pass is
 * byte-identical to one bought online: same code format, same signature, same
 * behaviour at the door.
 *
 * Inventory is still consumed when a real tier is chosen. A comp occupies a
 * place in the room exactly as a sale does, and a guest list that does not
 * count against capacity is how a venue ends up over its licence.
 */
export async function issueBookingManually(args: IssueBookingArgs): Promise<BookingDetail> {
  const quantity = Math.max(1, Math.min(Math.round(args.quantity), 50));
  const amountPaise = Math.max(0, Math.round(args.amountPaise ?? 0));

  const reference = await transaction(async (client) => {
    const eventResult = await client.query<EventRow>(
      'SELECT * FROM events WHERE slug = $1 FOR UPDATE',
      [args.eventSlug],
    );
    const event = eventResult.rows[0];
    if (!event) throw new BookingError('That event does not exist', 'event_not_found', 404);

    let tier: TicketTierRow | null = null;
    if (args.tierCode) {
      const tierResult = await client.query<TicketTierRow>(
        'SELECT * FROM ticket_tiers WHERE event_id = $1 AND code = $2 FOR UPDATE',
        [event.id, args.tierCode.toUpperCase()],
      );
      tier = tierResult.rows[0] ?? null;
      if (!tier) {
        throw new BookingError(
          `"${args.tierCode}" is not a ticket type for this event`,
          'tier_not_found',
          404,
        );
      }

      const remaining = tier.quantity - tier.sold;
      if (remaining < quantity) {
        throw new BookingError(
          `Only ${remaining} ${tier.name} left. Raise the tier's stock first, or issue a custom pass.`,
          'insufficient_inventory',
          409,
        );
      }
    }

    const admits = tier ? tier.admits : Math.max(1, Math.round(args.admits ?? 1));
    const tierCode = tier?.code ?? 'CUSTOM';
    const tierName = tier?.name ?? (args.customLabel?.trim() || 'Guest pass');
    const bookingReference = generateBookingReference();

    const customer = await upsertCustomerInTransaction(client, {
      email: args.email,
      name: args.name,
      phone: args.phone,
      source: 'admin',
    });

    const bookingResult = await client.query<BookingRow>(
      `INSERT INTO bookings (
         reference, event_id, tier_id, customer_id,
         customer_name, customer_email, customer_phone,
         quantity, subtotal_paise, discount_paise, amount_paise,
         status, payment_provider, source, notes, paid_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,'confirmed',$11,'admin',$12,now())
       RETURNING *`,
      [
        bookingReference,
        event.id,
        tier?.id ?? null,
        customer.id,
        args.name,
        args.email.toLowerCase(),
        args.phone,
        quantity,
        amountPaise,
        amountPaise,
        // 'comp' when nothing was collected, 'cash' when money changed hands
        // off-gateway. Both are honest; neither claims a gateway payment.
        amountPaise === 0 ? 'comp' : 'cash',
        [`Issued by ${args.issuedByEmail}`, args.note?.trim()].filter(Boolean).join(' · ').slice(0, 500),
      ],
    );
    const booking = bookingResult.rows[0];

    await client.query(
      `INSERT INTO booking_items (
         booking_id, tier_id, tier_code, tier_name, unit_price_paise,
         quantity, admits_each, redeemable_paise, line_total_paise
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        booking.id,
        tier?.id ?? null,
        tierCode,
        tierName,
        quantity > 0 ? Math.round(amountPaise / quantity) : 0,
        quantity,
        admits,
        tier?.redeemable_paise ?? 0,
        amountPaise,
      ],
    );

    if (tier) {
      await client.query('UPDATE ticket_tiers SET sold = sold + $2 WHERE id = $1', [
        tier.id,
        quantity,
      ]);
    }

    await mintTickets(client, booking.id);
    return bookingReference;
  });

  const detail = await getBookingByReference(reference);
  if (!detail) throw new BookingError('Booking could not be read back', 'internal_error', 500);
  return detail;
}

/** Recently issued-by-hand bookings, for the console's Tickets tab. */
export async function listIssuedBookings(limit = 25): Promise<
  Array<{
    reference: string;
    customer_name: string;
    customer_email: string;
    quantity: number;
    amount_paise: number;
    status: string;
    notes: string | null;
    email_sent_at: string | null;
    created_at: string;
    tier_name: string | null;
    checked_in: number;
  }>
> {
  return query(
    `SELECT b.reference, b.customer_name, b.customer_email, b.quantity, b.amount_paise,
            b.status, b.notes, b.email_sent_at, b.created_at,
            (SELECT bi.tier_name FROM booking_items bi WHERE bi.booking_id = b.id LIMIT 1) AS tier_name,
            (SELECT count(*)::int FROM tickets t WHERE t.booking_id = b.id AND t.status = 'used') AS checked_in
       FROM bookings b
      WHERE b.source = 'admin'
      ORDER BY b.created_at DESC
      LIMIT $1`,
    [Math.min(Math.max(limit, 1), 200)],
  );
}
