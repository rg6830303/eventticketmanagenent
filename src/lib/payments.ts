import 'server-only';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { query, queryOne } from './db';
import { env } from './env';
import { markEmailSent } from './bookings';
import { sendTicketEmail } from './mailer';
import type { BookingDetail, BookingRow, PaymentRow } from './types';

/**
 * Payment settlement.
 *
 * One rule holds this together: **a booking is confirmed by a signature the
 * gateway produced and by nothing else.** Not by a redirect landing back on the
 * site, not by a request body, not by anything the browser says. Those are only
 * signals that it is worth checking; the HMAC is what authorises the state
 * change.
 *
 * Everything observed on the way is appended to the `payments` table, so a
 * disputed charge can be reconstructed from what the gateway actually said and
 * when, rather than from an inference about what the code must have done.
 */

export type SettleSource = 'order' | 'verify' | 'webhook' | 'poll';

function client(): Razorpay {
  const { keyId, keySecret } = env.razorpay;
  if (!keyId || !keySecret) throw new Error('Razorpay credentials are not configured');
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

/**
 * Append one observation. Never throws: the ledger is an audit aid, and losing
 * a row must not cost a customer their tickets.
 */
export async function recordPayment(row: {
  bookingId: string | null;
  orderId: string;
  paymentId?: string | null;
  status: string;
  amountPaise?: number;
  currency?: string;
  method?: string | null;
  bankReference?: string | null;
  message?: string | null;
  source: SettleSource;
  raw?: unknown;
  provider?: string;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO payments (
         booking_id, provider, order_id, payment_id, status, amount_paise,
         currency, method, bank_reference, message, source, raw
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        row.bookingId,
        row.provider ?? 'razorpay',
        row.orderId,
        row.paymentId ?? null,
        row.status,
        Math.max(0, Math.round(row.amountPaise ?? 0)),
        row.currency ?? 'INR',
        row.method?.slice(0, 40) ?? null,
        row.bankReference?.slice(0, 80) ?? null,
        row.message?.slice(0, 500) ?? null,
        row.source,
        JSON.stringify(row.raw ?? {}),
      ],
    );
  } catch (error) {
    console.error('[payments] ledger write failed:', error instanceof Error ? error.message : error);
  }
}

export async function listPaymentsForBooking(bookingId: string): Promise<PaymentRow[]> {
  return query<PaymentRow>('SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at ASC', [
    bookingId,
  ]);
}

/**
 * Resolve a gateway order id back to its booking.
 *
 * The ledger is consulted first because it holds every order ever created for a
 * booking, where `bookings.payment_order_id` only holds the most recent — a
 * customer who paid against an earlier attempt would otherwise be unfindable.
 */
export async function bookingForOrderId(orderId: string): Promise<BookingRow | null> {
  const viaLedger = await queryOne<BookingRow>(
    `SELECT b.* FROM bookings b
       JOIN payments p ON p.booking_id = b.id
      WHERE p.order_id = $1
      ORDER BY p.created_at ASC
      LIMIT 1`,
    [orderId],
  );
  if (viaLedger) return viaLedger;

  return queryOne<BookingRow>('SELECT * FROM bookings WHERE payment_order_id = $1', [orderId]);
}

// ---------------------------------------------------------------------------
// Starting a payment
// ---------------------------------------------------------------------------

export interface StartPaymentResult {
  orderId: string;
  amountPaise: number;
  currency: string;
  /** Publishable. Safe in the browser; it cannot move money on its own. */
  keyId: string;
}

/**
 * Create a Razorpay order for a pending booking.
 *
 * The booking reference is the receipt. Razorpay dedupes on it, so a customer
 * who abandons and comes back lands on the same order rather than leaving a
 * trail of live orders for one booking, any of which could be paid.
 *
 * The amount comes from the booking row and never from the request, so somebody
 * editing the call cannot choose their own price.
 */
export async function startPayment(booking: BookingRow): Promise<StartPaymentResult> {
  const { keyId } = env.razorpay;

  let order: { id: string; amount: number | string; currency: string };
  try {
    order = (await client().orders.create({
      amount: booking.amount_paise,
      currency: booking.currency,
      receipt: booking.reference,
      notes: { bookingId: booking.id, reference: booking.reference },
    })) as typeof order;
  } catch (error) {
    // A failed order creation used to leave no trace at all: no order id, no
    // ledger row, nothing to look at afterwards. That is how a gateway outage
    // ran for twelve hours looking exactly like customers changing their minds.
    await recordPayment({
      bookingId: booking.id,
      orderId: `FAILED-${booking.reference}`,
      status: 'CREATE_FAILED',
      amountPaise: booking.amount_paise,
      currency: booking.currency,
      source: 'order',
      message: error instanceof Error ? error.message : 'Order creation failed',
    });
    throw error;
  }

  await query('UPDATE bookings SET payment_order_id = $2, payment_provider = $3 WHERE id = $1', [
    booking.id,
    order.id,
    'razorpay',
  ]);

  await recordPayment({
    bookingId: booking.id,
    orderId: order.id,
    status: 'CREATED',
    amountPaise: booking.amount_paise,
    currency: booking.currency,
    source: 'order',
    message: 'Order created',
    raw: { id: order.id, amount: order.amount, currency: order.currency },
  });

  return { orderId: order.id, amountPaise: booking.amount_paise, currency: booking.currency, keyId };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/** Constant-time compare that tolerates unequal lengths without throwing. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * The signature Razorpay puts on a completed checkout: HMAC-SHA256 of
 * `order_id|payment_id` under the key secret. This is the only thing that
 * authorises confirming a booking from the browser — every id in the callback
 * is attacker-controlled until it checks out.
 */
export function verifyCheckoutSignature(args: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const { keySecret } = env.razorpay;
  if (!keySecret) return false;

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${args.orderId}|${args.paymentId}`)
    .digest('hex');

  return safeEqual(args.signature, expected);
}

/**
 * Verify a Razorpay webhook.
 *
 * The RAW body is hashed — parsing to JSON and re-serialising reorders keys and
 * every signature fails.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = env.razorpay.webhookSecret;
  if (!secret || !signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(signature, expected);
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

/**
 * Send the ticket email once per booking.
 *
 * Guarded on `email_sent_at` because the browser callback and the webhook both
 * reach here for the same payment, and two identical ticket emails read as a
 * double charge to the person receiving them.
 *
 * A send failure never propagates: the money is taken and the passes exist, so
 * the right outcome is a confirmed booking the customer can resend from, not a
 * 500 that makes them think they lost their tickets.
 */
export async function deliverTickets(detail: BookingDetail): Promise<boolean> {
  if (detail.booking.email_sent_at) return true;

  try {
    const sent = await sendTicketEmail(detail);
    if (sent.ok) {
      await markEmailSent(detail.booking.id);
      return true;
    }
    console.error('[payments] ticket email failed', {
      reference: detail.booking.reference,
      error: sent.error,
    });
    return false;
  } catch (error) {
    console.error('[payments] ticket email threw', {
      reference: detail.booking.reference,
      error: error instanceof Error ? error.message : error,
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

/**
 * Can we actually take money right now?
 *
 * Credentials authenticating is not the same as an account being able to trade:
 * a merchant account that has been switched off answers reads with 200 and
 * refuses order creation. The only honest probe is to try creating one, so this
 * creates a ₹1 order that nobody pays.
 *
 * That leaves a real order in the dashboard, which is why it is off the hot
 * path and runs only when /api/health is asked for `?probe=gateway`.
 */
export async function probeGateway(): Promise<{
  ok: boolean;
  reason?: string;
  accountLevel?: boolean;
}> {
  const { keyId, keySecret } = env.razorpay;
  if (!keyId || !keySecret) return { ok: false, reason: 'not_configured' };

  try {
    await client().orders.create({
      amount: 100,
      currency: 'INR',
      receipt: `PROBE-${crypto.randomBytes(6).toString('hex')}`,
      notes: { purpose: 'automated gateway health probe, never paid' },
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Razorpay's SDK hangs the API error object off `error.error`.
    const detail =
      typeof error === 'object' && error !== null && 'error' in error
        ? ((error as { error?: { description?: string; code?: string } }).error ?? null)
        : null;

    const text = detail?.description ?? message;
    const lower = text.toLowerCase();

    return {
      ok: false,
      reason: text,
      // Wording that means "this account cannot trade" rather than "this request
      // was malformed" — the two need completely different people to fix them.
      accountLevel:
        lower.includes('not activated') ||
        lower.includes('not enabled') ||
        lower.includes('authentication') ||
        lower.includes('suspended') ||
        lower.includes('unauthorized'),
    };
  }
}

// ---------------------------------------------------------------------------
// Reconciliation — the webhook's job, done with only the API keys
// ---------------------------------------------------------------------------

export interface ReconcileResult {
  reference: string;
  outcome: 'paid' | 'unpaid' | 'no_order' | 'error';
  paymentId?: string | null;
  emailSent?: boolean;
  message?: string;
}

/**
 * Ask Razorpay whether a pending booking was actually paid, and finish it if so.
 *
 * A webhook is the usual way to catch someone who pays and closes the tab
 * before the browser-side verify call fires. Without a webhook secret there is
 * no webhook — but the same question can be asked directly, because the API
 * keys can read the payments against an order. Polling is less immediate than a
 * push, and it is the difference between a customer waiting minutes and a
 * customer never getting their ticket at all.
 *
 * Authorised-but-not-captured is deliberately treated as unpaid: the money has
 * been held, not taken, and issuing a pass against it would hand over entry for
 * a payment that can still fall through.
 */
export async function reconcileBooking(booking: BookingRow): Promise<ReconcileResult> {
  if (booking.status === 'confirmed') {
    return { reference: booking.reference, outcome: 'paid', message: 'Already confirmed' };
  }
  if (!booking.payment_order_id) {
    return { reference: booking.reference, outcome: 'no_order', message: 'No order was created' };
  }
  // An id from a previous gateway cannot be looked up here, and trying turns
  // every page view of an old abandoned booking into a failed API call.
  if (!booking.payment_order_id.startsWith('order_')) {
    return {
      reference: booking.reference,
      outcome: 'no_order',
      message: 'Order belongs to a previous payment provider',
    };
  }

  let captured: { id: string; amount: number; method?: string } | null = null;

  try {
    const result = (await client().orders.fetchPayments(booking.payment_order_id)) as {
      items?: Array<{ id: string; status: string; amount: number; method?: string }>;
    };
    captured = result.items?.find((p) => p.status === 'captured') ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'lookup failed';
    await recordPayment({
      bookingId: booking.id,
      orderId: booking.payment_order_id,
      status: 'LOOKUP_FAILED',
      source: 'poll',
      message,
    });
    return { reference: booking.reference, outcome: 'error', message };
  }

  if (!captured) {
    return { reference: booking.reference, outcome: 'unpaid', message: 'No captured payment' };
  }

  // Short payment is left alone for a human. Handing over passes for less than
  // the price is the one mistake here that cannot be undone at the door.
  if (captured.amount + 100 < booking.amount_paise) {
    await recordPayment({
      bookingId: booking.id,
      orderId: booking.payment_order_id,
      paymentId: captured.id,
      status: 'SHORT_PAYMENT',
      amountPaise: captured.amount,
      source: 'poll',
      message: `Captured ${captured.amount} against ${booking.amount_paise}`,
    });
    return {
      reference: booking.reference,
      outcome: 'error',
      message: 'Captured amount is short of the order total',
    };
  }

  const { confirmPendingBooking } = await import('./bookings');
  const detail = await confirmPendingBooking(booking.id, {
    paymentId: captured.id,
    orderId: booking.payment_order_id,
    // No signature exists on this path; the authority is Razorpay's own API
    // saying the payment is captured, which is at least as strong.
    signature: 'reconciled-via-api',
    provider: 'razorpay',
  });

  await recordPayment({
    bookingId: detail.booking.id,
    orderId: booking.payment_order_id,
    paymentId: captured.id,
    status: 'PAID',
    amountPaise: captured.amount,
    currency: detail.booking.currency,
    method: captured.method ?? null,
    source: 'poll',
    message: 'Confirmed by reconciliation',
  });

  const emailSent = await deliverTickets(detail);
  return { reference: detail.booking.reference, outcome: 'paid', paymentId: captured.id, emailSent };
}

/**
 * Sweep every pending booking that has an order against it.
 *
 * Scoped to the last few days by default: an order older than that has expired
 * at Razorpay and re-asking about it is a wasted call on every sweep forever.
 */
export async function reconcilePending(withinHours = 72): Promise<ReconcileResult[]> {
  const pending = await query<BookingRow>(
    `SELECT * FROM bookings
      WHERE status = 'pending'
        AND payment_order_id IS NOT NULL
        -- Razorpay order ids only. Bookings left over from a previous gateway
        -- carry ids this account has never heard of, and asking about them
        -- burns a failed API call each and fills the ledger with noise on
        -- every sweep, forever.
        AND payment_order_id LIKE 'order\_%'
        AND created_at > now() - ($1 || ' hours')::interval
      ORDER BY created_at DESC
      LIMIT 200`,
    [String(withinHours)],
  );

  const results: ReconcileResult[] = [];
  for (const booking of pending) {
    // Sequential on purpose: this runs against a live payment API and a burst of
    // parallel lookups is how a rate limit turns a reconciliation into an outage.
    results.push(await reconcileBooking(booking));
  }
  return results;
}
