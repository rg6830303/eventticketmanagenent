import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { env } from '@/lib/env';
import { startPayment } from '@/lib/payments';
import type { BookingRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Creates the Razorpay order for a pending booking.
 *
 * Only the publishable key id reaches the browser; the secret never leaves the
 * server, and the amount is read from the booking row rather than the request,
 * so a customer editing the call cannot choose their own price.
 */
export async function POST(request: NextRequest) {
  try {
    if (!env.paymentsEnabled) {
      return fail(
        'Online payment is not enabled yet — booking is currently free',
        'payments_disabled',
        503,
      );
    }
    // Payments on but no keys is a deployment mistake, and the generic 500 it
    // otherwise produces sends the operator hunting through logs. Say it plainly.
    if (!env.razorpay.keyId || !env.razorpay.keySecret) {
      console.error('[payments] PAYMENTS_ENABLED is on but RAZORPAY_KEY_ID/SECRET are not set');
      return fail(
        'Payment is temporarily unavailable. Nothing has been charged — try again shortly.',
        'payments_misconfigured',
        503,
      );
    }
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const body = (await readJson(request)) as { reference?: string };
    if (!body.reference) return fail('Booking reference is required', 'missing_reference', 400);

    const booking = await queryOne<BookingRow>('SELECT * FROM bookings WHERE reference = $1', [
      body.reference.toUpperCase(),
    ]);
    if (!booking) return fail('We could not find that booking', 'booking_not_found', 404);
    if (booking.status !== 'pending') {
      return fail('This booking is not awaiting payment', 'booking_not_pending', 409);
    }
    if (booking.amount_paise <= 0) {
      return fail('This booking has nothing to pay', 'zero_amount', 409);
    }


    // startPayment owns order creation so the ledger records every attempt,
    // successful or not — a failed one used to leave no trace whatsoever.
    const session = await startPayment(booking);

    return ok({
      orderId: session.orderId,
      amount: session.amountPaise,
      currency: session.currency,
      keyId: session.keyId,
      reference: booking.reference,
    });
  } catch (error) {
    return handleError(error, 'payments.order');
  }
}
