import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { env } from '@/lib/env';
import { CashfreeError } from '@/lib/cashfree';
import { settleCashfreeOrder, startCashfreePayment } from '@/lib/payments';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/validation.server';
import type { BookingRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Open a Cashfree checkout session for a pending booking.
 *
 * The response carries only `paymentSessionId` — a single-order, short-lived
 * token. The secret key never leaves the server, and the amount is read from
 * the booking row rather than the request body, so a customer editing the
 * request cannot choose their own price.
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    if (!env.paymentsEnabled || env.paymentProvider !== 'cashfree') {
      return fail('Online payment is not switched on', 'payments_disabled', 503);
    }
    // Payments on but no keys is a deployment mistake, and the generic 500 it
    // otherwise produces sends the operator hunting through logs. Say it plainly.
    if (!env.cashfree.configured) {
      console.error('[payments] Cashfree selected but CASHFREE_APP_ID/SECRET_KEY are not set');
      return fail(
        'Payment is temporarily unavailable. Nothing has been charged — try again shortly.',
        'payments_misconfigured',
        503,
      );
    }

    const ip = clientIp(request.headers);
    const limit = await rateLimit(
      `cashfree-order:${ip ?? 'unknown'}`,
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

    if (booking.status === 'confirmed') {
      // Someone reopened a stale checkout tab. Send them to their tickets
      // rather than to a payment window for money already taken.
      return ok({ alreadyPaid: true, reference: booking.reference });
    }
    if (booking.status !== 'pending') {
      return fail('This booking is not awaiting payment', 'booking_not_pending', 409);
    }
    if (booking.amount_paise <= 0) {
      return fail('This booking has nothing to pay', 'zero_amount', 409);
    }

    // A previous attempt may have completed while the tab sat idle. Ask before
    // opening a second checkout for the same money.
    if (booking.payment_order_id) {
      const settled = await settleCashfreeOrder(booking.payment_order_id, 'poll').catch(() => null);
      if (settled?.outcome === 'paid') {
        return ok({ alreadyPaid: true, reference: settled.booking?.reference ?? booking.reference });
      }
    }

    const session = await startCashfreePayment(booking);

    return ok({
      alreadyPaid: false,
      reference: booking.reference,
      orderId: session.orderId,
      paymentSessionId: session.paymentSessionId,
      amountPaise: session.amountPaise,
      mode: session.mode,
    });
  } catch (error) {
    if (error instanceof CashfreeError) {
      console.error('[payments] Cashfree order failed', { code: error.code, message: error.message });
      return fail(
        'We could not start the payment. Nothing has been charged — try again in a moment.',
        'gateway_error',
        502,
      );
    }
    return handleError(error, 'payments.cashfree.order');
  }
}
