import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { env } from '@/lib/env';
import { startPayment } from '@/lib/payments';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/validation.server';
import type { BookingRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Start a payment.
 *
 * The cart used to call a gateway endpoint by name, which meant switching
 * provider — or losing one — broke the main Pay button on the busiest page of
 * the site. This endpoint answers "how does this customer pay right now" and
 * the cart no longer needs to know.
 *
 * Razorpay's checkout needs its own component mounted with the order id, so the
 * answer is always a `payUrl` and the checkout page renders it. Creating the
 * order here rather than there means a gateway that cannot take money is
 * discovered before the customer is sent anywhere.
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const ip = clientIp(request.headers);
    const limit = await rateLimit(
      `payment-session:${ip ?? 'unknown'}`,
      LIMITS.payment.limit,
      LIMITS.payment.window,
    );
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const body = (await readJson(request)) as { reference?: string };
    if (!body.reference) return fail('Booking reference is required', 'missing_reference', 400);

    const booking = await queryOne<BookingRow>('SELECT * FROM bookings WHERE reference = $1', [
      String(body.reference).toUpperCase(),
    ]);
    if (!booking) return fail('We could not find that booking', 'booking_not_found', 404);

    const payUrl = `/pay/${booking.reference}`;

    if (booking.status === 'confirmed') {
      return ok({ alreadyPaid: true, reference: booking.reference });
    }
    if (booking.status !== 'pending') {
      return fail('This booking is not awaiting payment', 'booking_not_pending', 409);
    }
    if (booking.amount_paise <= 0) {
      return fail('This booking has nothing to pay', 'zero_amount', 409);
    }

    // Payments off, or no gateway keys, but a UPI rail configured: that rail is
    // rendered by the checkout page and is a genuine way to pay.
    if (!env.paymentsEnabled || env.paymentProvider === 'none') {
      if (env.upi.enabled) {
        return ok({ provider: 'upi', payUrl, reference: booking.reference, payable: true });
      }
      return fail(
        'Online payment is not available right now. Nothing has been charged and your passes ' +
          'are still held — please message @houzofvybe on Instagram and we will sort it out.',
        'payments_unavailable',
        503,
      );
    }

    try {
      const session = await startPayment(booking);
      return ok({
        provider: 'razorpay',
        reference: booking.reference,
        orderId: session.orderId,
        amountPaise: session.amountPaise,
        payable: true,
        payUrl,
      });
    } catch (error) {
      console.error('[payments] could not create an order', {
        reference: booking.reference,
        error: error instanceof Error ? error.message : error,
      });

      // The gateway is configured but refusing. If a UPI rail exists, send them
      // to it rather than to an apology — that is the entire reason a fallback
      // is worth having, and an outage lasting days should not cost every sale
      // in them.
      if (env.upi.enabled) {
        return ok({
          provider: 'upi',
          payUrl: `${payUrl}?via=upi`,
          reference: booking.reference,
          payable: true,
          fellBack: true,
        });
      }

      return fail(
        'Card payment is temporarily unavailable — this is a problem at our end, not yours. ' +
          'Nothing has been charged and your passes are still held. Please message ' +
          '@houzofvybe on Instagram and we will get you your ticket.',
        'gateway_unavailable',
        503,
      );
    }
  } catch (error) {
    return handleError(error, 'payments.session');
  }
}
