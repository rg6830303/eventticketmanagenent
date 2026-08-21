import 'server-only';
import { query, queryOne, transaction } from './db';
import { BookingError, getBookingByReference } from './bookings';
import { normaliseUtr } from './upi';
import type { BookingDetail, BookingRow } from './types';

/**
 * UPI payment claims.
 *
 * The whole module exists because of one fact: a UTR is a number the customer
 * types. There is no signature to check and no callback to trust, so a claim
 * is treated as *evidence*, never as payment. It parks the booking until an
 * operator confirms the money arrived.
 *
 * Anything that mints a ticket lives behind `approveUpiClaim`, which is only
 * reachable from an authenticated admin route.
 */

export type UpiClaimStatus = 'submitted' | 'approved' | 'rejected';

export interface UpiClaimRow {
  id: string;
  booking_id: string;
  utr: string;
  amount_paise: number;
  vpa: string;
  status: UpiClaimStatus;
  note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

/** Claim joined to the booking it pays for — what the admin queue renders. */
export interface UpiClaimWithBooking extends UpiClaimRow {
  reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  booking_status: string;
  booking_amount_paise: number;
  quantity: number;
  event_name: string;
}

/** The live claim for a booking, if the customer has already declared one. */
export async function getClaimForBooking(bookingId: string): Promise<UpiClaimRow | null> {
  return queryOne<UpiClaimRow>(
    `SELECT * FROM upi_payment_claims
     WHERE booking_id = $1 AND status <> 'rejected'
     ORDER BY created_at DESC
     LIMIT 1`,
    [bookingId],
  );
}

export async function listUpiClaims(status: UpiClaimStatus = 'submitted'): Promise<UpiClaimWithBooking[]> {
  return query<UpiClaimWithBooking>(
    `SELECT c.*,
            b.reference, b.customer_name, b.customer_email, b.customer_phone,
            b.status AS booking_status, b.amount_paise AS booking_amount_paise, b.quantity,
            e.name AS event_name
     FROM upi_payment_claims c
     JOIN bookings b ON b.id = c.booking_id
     JOIN events e   ON e.id = b.event_id
     WHERE c.status = $1
     ORDER BY c.created_at ASC`,
    [status],
  );
}

export interface SubmitClaimArgs {
  reference: string;
  utr: string;
  vpa: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface SubmitClaimResult {
  reference: string;
  utr: string;
  status: UpiClaimStatus;
  /** True when this exact claim already existed — a double-submit, not a fault. */
  duplicate: boolean;
}

/**
 * Record a customer's declaration that they have paid.
 *
 * Locks the booking row so two tabs cannot file two claims, and leans on the
 * partial unique index to reject a UTR already spent on another booking. That
 * index is the only fraud control that exists here, so a violation is surfaced
 * as a clear refusal rather than swallowed.
 */
export async function submitUpiClaim(args: SubmitClaimArgs): Promise<SubmitClaimResult> {
  const utr = normaliseUtr(args.utr);
  if (!/^\d{12}$/.test(utr)) {
    throw new BookingError('Enter the 12-digit UPI reference number', 'invalid_utr', 422);
  }

  return transaction(async (client) => {
    const bookingResult = await client.query<BookingRow>(
      'SELECT * FROM bookings WHERE reference = $1 FOR UPDATE',
      [args.reference.toUpperCase()],
    );
    const booking = bookingResult.rows[0];
    if (!booking) throw new BookingError('We could not find that booking', 'booking_not_found', 404);

    if (booking.status === 'confirmed') {
      throw new BookingError('This booking is already paid', 'already_confirmed', 409);
    }
    if (booking.status !== 'pending') {
      throw new BookingError('This booking is not awaiting payment', 'booking_not_pending', 409);
    }

    // Re-submitting the identical reference is a nervous customer, not an error.
    const existing = await client.query<UpiClaimRow>(
      `SELECT * FROM upi_payment_claims
       WHERE booking_id = $1 AND utr = $2 AND status <> 'rejected'`,
      [booking.id, utr],
    );
    if (existing.rows[0]) {
      return {
        reference: booking.reference,
        utr,
        status: existing.rows[0].status,
        duplicate: true,
      };
    }

    try {
      await client.query(
        `INSERT INTO upi_payment_claims
           (booking_id, utr, amount_paise, vpa, ip_address, user_agent)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          booking.id,
          utr,
          booking.amount_paise,
          args.vpa,
          args.ipAddress ?? null,
          args.userAgent ?? null,
        ],
      );
    } catch (error) {
      const isUnique =
        typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
      if (isUnique) {
        throw new BookingError(
          'That reference number is already recorded against another booking. Check the number, or contact us if you think this is wrong.',
          'utr_already_used',
          409,
        );
      }
      throw error;
    }

    // The booking stays `pending` — inventory held, no tickets, no money
    // recognised. Only the provider changes, so the admin queue and the
    // customer's page both know which rail this order is on.
    await client.query(
      `UPDATE bookings SET payment_provider = 'upi', payment_id = $2 WHERE id = $1`,
      [booking.id, `upi:${utr}`],
    );

    return { reference: booking.reference, utr, status: 'submitted' as const, duplicate: false };
  });
}

/**
 * Operator confirms the money landed. This is the only path that issues passes
 * on the UPI rail, and it reuses the same booking-confirmation transaction the
 * gateway uses, so a UPI ticket is byte-identical to a Razorpay one.
 */
export async function approveUpiClaim(
  claimId: string,
  reviewerId: string,
): Promise<BookingDetail> {
  const { confirmPendingBooking } = await import('./bookings');

  const claim = await queryOne<UpiClaimRow>('SELECT * FROM upi_payment_claims WHERE id = $1', [
    claimId,
  ]);
  if (!claim) throw new BookingError('Claim not found', 'claim_not_found', 404);
  if (claim.status === 'approved') {
    const detail = await getBookingDetailForClaim(claim.booking_id);
    if (detail) return detail;
  }
  if (claim.status === 'rejected') {
    throw new BookingError('This claim was already rejected', 'claim_rejected', 409);
  }

  const detail = await confirmPendingBooking(claim.booking_id, {
    paymentId: `upi:${claim.utr}`,
    orderId: claim.utr,
    // No gateway signature exists on this rail. Recording who released it is
    // the audit trail that replaces one.
    signature: `manual:${reviewerId}`,
  });

  await query(
    `UPDATE upi_payment_claims
       SET status = 'approved', reviewed_by = $2, reviewed_at = now()
     WHERE id = $1`,
    [claimId, reviewerId],
  );

  return detail;
}

export async function rejectUpiClaim(
  claimId: string,
  reviewerId: string,
  note: string | null,
): Promise<{ reference: string }> {
  const claim = await queryOne<UpiClaimRow>('SELECT * FROM upi_payment_claims WHERE id = $1', [
    claimId,
  ]);
  if (!claim) throw new BookingError('Claim not found', 'claim_not_found', 404);
  if (claim.status === 'approved') {
    throw new BookingError('This claim was already approved', 'claim_approved', 409);
  }

  await query(
    `UPDATE upi_payment_claims
       SET status = 'rejected', reviewed_by = $2, reviewed_at = now(), note = $3
     WHERE id = $1`,
    [claimId, reviewerId, note],
  );

  // Hand the booking back to a payable state so the customer can try again.
  const booking = await queryOne<BookingRow>(
    `UPDATE bookings SET payment_provider = 'none', payment_id = NULL
     WHERE id = $1 AND status = 'pending'
     RETURNING reference`,
    [claim.booking_id],
  );

  return { reference: booking?.reference ?? '' };
}

async function getBookingDetailForClaim(bookingId: string): Promise<BookingDetail | null> {
  const row = await queryOne<{ reference: string }>(
    'SELECT reference FROM bookings WHERE id = $1',
    [bookingId],
  );
  return row ? getBookingByReference(row.reference) : null;
}
