import type { NextRequest } from 'next/server';
import Razorpay from 'razorpay';
import { fail, handleError, ok, readJson } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { env } from '@/lib/env';
import type { BookingRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Creates the Razorpay order for a pending booking.
 *
 * Payments are currently switched off, so this returns 503 before touching the
 * SDK. The implementation below is complete: turning PAYMENTS_ENABLED on and
 * supplying the keys is the only change needed to go live.
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

    const client = new Razorpay({
      key_id: env.razorpay.keyId,
      key_secret: env.razorpay.keySecret,
    });

    const order = await client.orders.create({
      amount: booking.amount_paise,
      currency: booking.currency,
      // Razorpay caps receipt at 40 chars and dedupes on it, which conveniently
      // makes a retried checkout reuse the same order instead of creating one more.
      receipt: booking.reference,
      notes: { bookingId: booking.id, reference: booking.reference },
    });

    await query('UPDATE bookings SET payment_order_id = $2 WHERE id = $1', [booking.id, order.id]);

    return ok({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: env.razorpay.keyId,
      reference: booking.reference,
    });
  } catch (error) {
    return handleError(error, 'payments.order');
  }
}
