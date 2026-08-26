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
 * Start a payment, whichever gateway is live.
 *
 * The cart used to call the Cashfree endpoint by name, which meant switching
 * gateway — or losing one — broke the main Pay button on the busiest page of
 * the site. This endpoint answers "how does this customer pay right now" and
 * the cart no longer needs to know.
 *
 * Only Cashfree can be opened straight from the cart, because its SDK takes a
 * session id and leaves. Razorpay needs its own component mounted, and the UPI
 * rail needs a QR on screen, so both are answered with a `payUrl` and the
 * checkout page renders the right thing. A customer is never shown a dead end
 * as long as any rail is configured.
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

    // Anything that is not Cashfree is rendered by the checkout page.
    if (env.paymentProvider !== 'cashfree' || !env.cashfree.configured) {
      const usable = env.paymentProvider !== 'none' || env.upi.enabled;
      return ok({
        provider: env.paymentProvider,
        payUrl,
        reference: booking.reference,
        // False only when nothing at all can take money, so the cart can say so
        // rather than sending somebody to a page with no buttons on it.
        payable: usable,
      });
    }

    // A previous attempt may have settled while the tab sat idle.
    if (booking.payment_order_id) {
      const settled = await settleCashfreeOrder(booking.payment_order_id, 'poll').catch(() => null);
      if (settled?.outcome === 'paid') {
        return ok({ alreadyPaid: true, reference: settled.booking?.reference ?? booking.reference });
      }
    }

    try {
      const session = await startCashfreePayment(booking);
      return ok({
        provider: 'cashfree',
        reference: booking.reference,
        orderId: session.orderId,
        paymentSessionId: session.paymentSessionId,
        amountPaise: session.amountPaise,
        mode: session.mode,
        payable: true,
        payUrl,
      });
    } catch (error) {
      if (error instanceof CashfreeError && error.accountLevel && env.upi.enabled) {
        // The card gateway is refusing at the account level and there is a
        // second rail configured. Send them to it rather than to an apology —
        // this is the whole reason a fallback exists.
        console.error('[payments] card gateway refused; falling back to UPI', {
          reference: booking.reference,
          message: error.message,
        });
        return ok({
          provider: 'upi',
          payUrl,
          reference: booking.reference,
          payable: true,
          fellBack: true,
        });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof CashfreeError) {
      console.error(
        error.accountLevel
          ? '[payments] GATEWAY REFUSED — Cashfree will not accept transactions on this account'
          : '[payments] Cashfree session failed',
        { code: error.code, status: error.status, message: error.message },
      );

      if (error.accountLevel) {
        return fail(
          'Card and UPI payment is temporarily unavailable — this is a problem at our end, ' +
            'not yours. Nothing has been charged and your passes are still held. ' +
            'Please message @houzofvybe on Instagram and we will get you your ticket.',
          'gateway_unavailable',
          503,
        );
      }

      return fail(
        error.retriable
          ? 'We could not start the payment. Nothing has been charged — try again in a moment.'
          : 'We could not start the payment. Nothing has been charged. Please message ' +
            '@houzofvybe on Instagram and we will sort it out.',
        'gateway_error',
        502,
      );
    }
    return handleError(error, 'payments.session');
  }
}
