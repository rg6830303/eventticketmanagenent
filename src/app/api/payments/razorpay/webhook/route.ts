import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { confirmPendingBooking } from '@/lib/bookings';
import {
  bookingForOrderId,
  deliverTickets,
  recordPayment,
  reconcileBooking,
  verifyWebhookSignature,
} from '@/lib/payments';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-to-server payment notification — the safety net for when the customer
 * closes the tab, or their browser is evicted while they are away in a UPI app,
 * before the browser-side verify call fires.
 *
 * Two things are load-bearing on the signed path:
 *  1. The RAW body is hashed. Parsing to JSON and re-serialising would change
 *     the bytes and every signature would fail.
 *  2. A validly-signed webhook always gets a 200, even for an event we have
 *     already processed. Returning an error would make Razorpay retry a message
 *     that was handled correctly the first time.
 *
 * WITHOUT a webhook secret it still works, and that matters more than it looks:
 * this deployment has no secret, so the endpoint used to answer 503 and every
 * payment fell back to polling — which ran on a daily cron and whenever some
 * *other* customer opened the cart. People waited hours for a pass they had
 * paid for.
 *
 * The unsigned path takes the request as an untrusted hint and nothing more.
 * It reads an order id, checks that we issued it, and then asks Razorpay's API
 * whether that order actually has a captured payment. The answer comes from an
 * authenticated call, never from the request body, so a forged webhook cannot
 * confirm anything that was not genuinely paid — at worst it makes us ask a
 * question we already ask on a timer. That is why this is safe to leave open,
 * and why it is worth having: it turns "within a day" into "within seconds".
 *
 * Adding RAZORPAY_WEBHOOK_SECRET later costs nothing and switches this back to
 * the signed path automatically.
 */
export async function POST(request: NextRequest) {
  if (!env.paymentsEnabled) {
    return NextResponse.json({ received: false, reason: 'payments_disabled' }, { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  let event: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ received: false, reason: 'unparseable' }, { status: 400 });
  }

  const payment = event.payload?.payment?.entity;
  const orderId = payment?.order_id;

  // --- Unsigned path: trust nothing, verify everything against the API -----
  if (!env.razorpay.webhookSecret) {
    // Anyone can reach this URL, so it is metered. A real Razorpay event is
    // rare enough to sail under this; a script trying to use it as a probe is
    // not, and gets a 200 saying nothing either way.
    const ip = clientIp(request.headers);
    const limited = await rateLimit(
      `webhook-unsigned:${ip ?? 'unknown'}`,
      LIMITS.webhookUnsigned.limit,
      LIMITS.webhookUnsigned.window,
    );
    if (!limited.allowed) return NextResponse.json({ received: true });

    if (event.event !== 'payment.captured' || !orderId) {
      return NextResponse.json({ received: true, ignored: event.event ?? 'no_order' });
    }

    const booking = await bookingForOrderId(orderId);
    if (!booking) return NextResponse.json({ received: true, ignored: 'unknown_order' });
    if (booking.status === 'confirmed') {
      return NextResponse.json({ received: true, ignored: 'already_confirmed' });
    }

    // Razorpay's own API decides whether money exists. This confirms, records
    // the payment and emails the passes, or does nothing at all.
    const result = await reconcileBooking(booking);
    return NextResponse.json({
      received: true,
      verified: 'via_api',
      reference: booking.reference,
      outcome: result.outcome,
      emailSent: result.emailSent ?? false,
    });
  }

  // --- Signed path ---------------------------------------------------------
  // The RAW body is hashed. Parsing to JSON and re-serialising reorders keys
  // and every signature fails.
  if (!verifyWebhookSignature(raw, signature)) {
    console.error('[webhook] signature mismatch');
    return NextResponse.json({ received: false }, { status: 400 });
  }

  try {
    if (event.event !== 'payment.captured') {
      return NextResponse.json({ received: true, ignored: event.event });
    }
    if (!orderId || !payment?.id) {
      return NextResponse.json({ received: true, ignored: 'missing_ids' });
    }

    // Via the ledger, which holds every order ever created for a booking —
    // `payment_order_id` only holds the most recent, so a customer who paid an
    // earlier attempt would otherwise be unfindable.
    const booking = await bookingForOrderId(orderId);
    if (!booking) return NextResponse.json({ received: true, ignored: 'unknown_order' });
    if (booking.status === 'confirmed') {
      return NextResponse.json({ received: true, ignored: 'already_confirmed' });
    }

    const detail = await confirmPendingBooking(booking.id, {
      paymentId: payment.id,
      orderId,
      signature: signature ?? 'webhook',
      provider: 'razorpay',
    });

    await recordPayment({
      bookingId: detail.booking.id,
      orderId,
      paymentId: payment.id,
      status: 'PAID',
      amountPaise: detail.booking.amount_paise,
      currency: detail.booking.currency,
      source: 'webhook',
      message: 'Confirmed by payment.captured',
    });

    // Guarded on email_sent_at, so a webhook arriving just after the browser
    // callback cannot send the same customer a second identical ticket email —
    // which reads as a double charge to whoever receives it.
    const emailSent = await deliverTickets(detail);

    return NextResponse.json({ received: true, reference: detail.booking.reference, emailSent });
  } catch (error) {
    // Signature was valid, so this is our bug, not a spoofed request. Log it and
    // still return 200 — a retry storm will not fix a code defect.
    console.error('[webhook] processing failed', error);
    return NextResponse.json({ received: true, processed: false });
  }
}
