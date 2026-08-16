import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { env } from '@/lib/env';
import { confirmPendingBooking, markEmailSent } from '@/lib/bookings';
import { sendTicketEmail } from '@/lib/mailer';
import type { BookingRow } from '@/lib/types';

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
  const signature = request.headers.get('x-razorpay-signature') ?? '';
  const secret = env.razorpay.webhookSecret;

  if (!secret) {
    console.error('[webhook] RAZORPAY_WEBHOOK_SECRET is not set');
    return NextResponse.json({ received: false }, { status: 500 });
  }

  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
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

    const booking = await queryOne<BookingRow>(
      'SELECT * FROM bookings WHERE payment_order_id = $1',
      [payment.order_id],
    );
    if (!booking) return NextResponse.json({ received: true, ignored: 'unknown_order' });
    if (booking.status === 'confirmed') {
      return NextResponse.json({ received: true, ignored: 'already_confirmed' });
    }

    const detail = await confirmPendingBooking(booking.id, {
      paymentId: payment.id,
      orderId: payment.order_id,
      signature,
    });

    const sent = await sendTicketEmail(detail);
    if (sent.ok) await markEmailSent(detail.booking.id);

    return NextResponse.json({ received: true, reference: detail.booking.reference });
  } catch (error) {
    // Signature was valid, so this is our bug, not a spoofed request. Log it and
    // still return 200 — a retry storm will not fix a code defect.
    console.error('[webhook] processing failed', error);
    return NextResponse.json({ received: true, processed: false });
  }
}
