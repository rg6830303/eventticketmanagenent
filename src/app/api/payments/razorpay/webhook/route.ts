import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { confirmPendingBooking } from '@/lib/bookings';
import {
  bookingForOrderId,
  deliverTickets,
  recordPayment,
  verifyWebhookSignature,
} from '@/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-to-server payment notification — the safety net for when the customer
 * closes the tab before the browser-side verify call fires.
 *
 * Two things are load-bearing here:
 *  1. The RAW body is hashed. Parsing to JSON and re-serialising would change
 *     the bytes and every signature would fail.
 *  2. A validly-signed webhook always gets a 200, even for an event we have
 *     already processed. Returning an error would make Razorpay retry a message
 *     that was handled correctly the first time.
 */
export async function POST(request: NextRequest) {
  if (!env.paymentsEnabled) {
    return NextResponse.json({ received: false, reason: 'payments_disabled' }, { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  if (!env.razorpay.webhookSecret) {
    // Not an error: this deployment deliberately runs without a webhook, and
    // reconciliation covers the same ground by polling. Refusing quietly beats
    // logging a failure on every unsolicited request that reaches the URL.
    return NextResponse.json({ received: false, reason: 'webhooks_not_configured' }, { status: 503 });
  }

  // The RAW body is hashed. Parsing to JSON and re-serialising reorders keys
  // and every signature fails.
  if (!verifyWebhookSignature(raw, signature)) {
    console.error('[webhook] signature mismatch');
    return NextResponse.json({ received: false }, { status: 400 });
  }

  try {
    const event = JSON.parse(raw) as {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
    };

    if (event.event !== 'payment.captured') {
      return NextResponse.json({ received: true, ignored: event.event });
    }

    const payment = event.payload?.payment?.entity;
    if (!payment?.order_id || !payment.id) {
      return NextResponse.json({ received: true, ignored: 'missing_ids' });
    }

    // Via the ledger, which holds every order ever created for a booking —
    // `payment_order_id` only holds the most recent, so a customer who paid an
    // earlier attempt would otherwise be unfindable.
    const booking = await bookingForOrderId(payment.order_id);
    if (!booking) return NextResponse.json({ received: true, ignored: 'unknown_order' });
    if (booking.status === 'confirmed') {
      return NextResponse.json({ received: true, ignored: 'already_confirmed' });
    }

    const detail = await confirmPendingBooking(booking.id, {
      paymentId: payment.id,
      orderId: payment.order_id,
      signature: signature ?? 'webhook',
      provider: 'razorpay',
    });

    await recordPayment({
      bookingId: detail.booking.id,
      orderId: payment.order_id,
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
