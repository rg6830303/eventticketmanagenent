import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { verifyWebhookSignature } from '@/lib/cashfree';
import { settleCashfreeOrder } from '@/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-to-server payment notification — the safety net for the customer who
 * pays and then closes the tab before the return URL fires.
 *
 * Three things are load-bearing here:
 *
 *  1. **The RAW body is hashed.** Parsing to JSON and re-serialising reorders
 *     keys and changes the bytes, and every signature would fail.
 *  2. **The body is never trusted for the outcome.** A valid signature proves
 *     Cashfree sent the message; it does not make the message the source of
 *     truth. The order id is extracted and the status is re-read from the API.
 *  3. **A validly-signed webhook always gets a 200**, including for an event
 *     already processed. Any other status makes Cashfree retry a message that
 *     was handled correctly the first time.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();

  const verified = verifyWebhookSignature({
    rawBody: raw,
    signature: request.headers.get('x-webhook-signature'),
    timestamp: request.headers.get('x-webhook-timestamp'),
  });

  if (!verified.ok) {
    // 401 rather than 200: an unverified sender is not Cashfree, and this is
    // the one case where a retry is the right thing for it to do.
    console.error('[cashfree-webhook] rejected', { reason: verified.reason });
    return NextResponse.json({ received: false, reason: verified.reason }, { status: 401 });
  }

  if (!env.cashfree.configured) {
    return NextResponse.json({ received: false, reason: 'not_configured' }, { status: 503 });
  }

  let orderId: string | null = null;
  let type = 'unknown';

  try {
    const event = JSON.parse(raw) as {
      type?: string;
      data?: { order?: { order_id?: string } };
    };
    type = event.type ?? 'unknown';
    orderId = event.data?.order?.order_id ?? null;
  } catch {
    return NextResponse.json({ received: true, ignored: 'unparseable_body' });
  }

  if (!orderId) {
    return NextResponse.json({ received: true, ignored: 'no_order_id', type });
  }

  try {
    const result = await settleCashfreeOrder(orderId, 'webhook');
    return NextResponse.json({
      received: true,
      type,
      outcome: result.outcome,
      reference: result.booking?.reference ?? null,
    });
  } catch (error) {
    // The signature was valid, so this is our failure, not a spoofed request.
    // A 500 asks Cashfree to retry, which is exactly right when the cause was a
    // transient database or gateway timeout.
    console.error('[cashfree-webhook] settlement failed', {
      orderId,
      type,
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json({ received: true, processed: false }, { status: 500 });
  }
}
