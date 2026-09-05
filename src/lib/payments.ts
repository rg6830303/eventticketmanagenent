import 'server-only';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { query, queryOne } from './db';
import { env } from './env';
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

  /**
   * Claim the send before making it, in one statement.
   *
   * The guard above reads a snapshot taken before the confirm committed, so on
   * its own it is a check-then-act with the entire SMTP conversation sitting in
   * the gap — and that conversation is budgeted at up to thirty seconds. Two
   * paths arriving together both saw no timestamp, both sent, and the customer
   * got two identical ticket emails, which reads as a double charge to whoever
   * receives it.
   *
   * That used to be a rare collision between a webhook and a browser callback.
   * It is much likelier now: the pay page reconciles on load, the checkout
   * polls, and a sweep runs every couple of minutes, so several paths can
   * genuinely confirm the same booking at once. Postgres decides the winner —
   * exactly one caller gets a row back, and only that caller sends.
   */
  const claimed = await queryOne<{ id: string }>(
    `UPDATE bookings SET email_sent_at = now()
      WHERE id = $1 AND email_sent_at IS NULL
      RETURNING id`,
    [detail.booking.id],
  );
  // Somebody else is already sending this, or already has.
  if (!claimed) return true;

  try {
    const sent = await sendTicketEmail(detail);
    if (sent.ok) {
      return true;
    }
    // Hand the claim back so the retry paths can pick this up again — a
    // timestamp left behind after a failed send is a customer who silently
    // never gets their pass and no longer shows up as owed one.
    await releaseEmailClaim(detail.booking.id);
    console.error('[payments] ticket email failed', {
      reference: detail.booking.reference,
      error: sent.error,
    });
    return false;
  } catch (error) {
    await releaseEmailClaim(detail.booking.id);
    console.error('[payments] ticket email threw', {
      reference: detail.booking.reference,
      error: error instanceof Error ? error.message : error,
    });
    return false;
  }
}

/** Undo a claim whose send did not happen, so recovery can try again. */
async function releaseEmailClaim(bookingId: string): Promise<void> {
  await query('UPDATE bookings SET email_sent_at = NULL WHERE id = $1', [bookingId]).catch(
    (error) => {
      // Worth shouting about: the booking now looks delivered and is not.
      console.error('[payments] could not release the email claim', { bookingId, error });
    },
  );
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
  /**
   * Ask about every order this booking has ever had, not just the latest.
   *
   * `bookings.payment_order_id` holds only the most recent order, and
   * `startPayment` overwrites it on every press of Pay. This audience presses
   * Pay more than once as a matter of course: the webview is evicted during the
   * trip to their UPI app, they come back to a reloaded page, and they press it
   * again. There are bookings here carrying six separate orders.
   *
   * If the money landed on an earlier attempt, that order id is no longer in
   * the column and asking only about the column returns "unpaid" forever. Every
   * other gap in this system delays a ticket; this one loses the payment
   * outright, because nothing else ever looks there again.
   *
   * The ledger has kept every order id all along — one row per creation — so
   * the fix is to read them back rather than to store anything new.
   */
  const ledger = await query<{ order_id: string }>(
    `SELECT DISTINCT order_id FROM payments
      WHERE booking_id = $1 AND order_id LIKE 'order\_%'`,
    [booking.id],
  ).catch(() => [] as Array<{ order_id: string }>);

  // Newest first: the most recent attempt is much the likeliest to be the paid
  // one, so the common case still costs a single call.
  const orderIds = [
    ...new Set([booking.payment_order_id, ...ledger.map((row) => row.order_id)]),
  ].filter((id) => id.startsWith('order_'));

  // An id from a previous gateway cannot be looked up here, and trying turns
  // every page view of an old abandoned booking into a failed API call.
  if (orderIds.length === 0) {
    return {
      reference: booking.reference,
      outcome: 'no_order',
      message: 'Order belongs to a previous payment provider',
    };
  }

  let captured: { id: string; amount: number; method?: string } | null = null;
  let capturedOrderId = booking.payment_order_id;
  let lastError: string | null = null;
  // "We asked and were told no" and "we could not ask" are different answers,
  // and only the first one means the customer has not paid.
  let answered = 0;

  for (const orderId of orderIds) {
    try {
      const result = (await client().orders.fetchPayments(orderId)) as {
        items?: Array<{ id: string; status: string; amount: number; method?: string }>;
      };
      answered += 1;
      const hit = result.items?.find((p) => p.status === 'captured') ?? null;
      if (hit) {
        captured = hit;
        capturedOrderId = orderId;
        break;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'lookup failed';
      await recordPayment({
        bookingId: booking.id,
        orderId,
        status: 'LOOKUP_FAILED',
        source: 'poll',
        message: lastError,
      });
    }
  }

  if (!captured) {
    // Nothing was successfully looked up, so we do not actually know. Reporting
    // that as 'unpaid' would let a Razorpay outage read as a hundred customers
    // who never paid, which is the wrong thing to believe and the wrong thing
    // to show an operator.
    if (answered === 0) {
      return {
        reference: booking.reference,
        outcome: 'error',
        message: lastError ?? 'Could not reach the gateway',
      };
    }
    return { reference: booking.reference, outcome: 'unpaid', message: 'No captured payment' };
  }

  /**
   * Judge the payment against what this customer was actually asked for.
   *
   * The order carries its own amount, recorded when it was created, and that
   * is the figure the customer saw and agreed to. `booking.amount_paise` is the
   * price *now*, which is not the same thing once prices can move underneath a
   * pending booking: raise a tier while somebody is in their UPI app and their
   * correct, full payment would come back as short, and they would be left
   * having paid with no ticket and no explanation.
   *
   * Nobody is short-changed by this. A payment is only honoured against the
   * quote it was raised for, and a repriced booking that has not been paid yet
   * simply gets a new order at the new price the next time Pay is pressed.
   * Asking someone for more after they have already paid what you asked is not
   * a thing this should ever do.
   */
  const quoted = await queryOne<{ amount_paise: number }>(
    `SELECT amount_paise FROM payments
      WHERE order_id = $1 AND status = 'CREATED' AND amount_paise > 0
      ORDER BY created_at DESC LIMIT 1`,
    [capturedOrderId],
  ).catch(() => null);
  const expectedPaise = quoted?.amount_paise ?? booking.amount_paise;

  // Short payment is left alone for a human. Handing over passes for less than
  // the price is the one mistake here that cannot be undone at the door.
  if (captured.amount + 100 < expectedPaise) {
    await recordPayment({
      bookingId: booking.id,
      orderId: capturedOrderId,
      paymentId: captured.id,
      status: 'SHORT_PAYMENT',
      amountPaise: captured.amount,
      source: 'poll',
      message: `Captured ${captured.amount} against a quote of ${expectedPaise}`,
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
    orderId: capturedOrderId,
    // No signature exists on this path; the authority is Razorpay's own API
    // saying the payment is captured, which is at least as strong.
    signature: 'reconciled-via-api',
    provider: 'razorpay',
  });

  await recordPayment({
    bookingId: detail.booking.id,
    orderId: capturedOrderId,
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
 * Scoped to the last thirty days by default. The window used to be three, which
 * is fine for catching a payment that has just happened and useless for finding
 * one that slipped through a week ago — and a customer who paid and never got
 * their ticket does not stop being owed it after 72 hours.
 */
export async function reconcilePending(
  withinHours = 720,
  budgetMs = Number.POSITIVE_INFINITY,
): Promise<ReconcileResult[]> {
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
  const deadline = Date.now() + budgetMs;

  for (const booking of pending) {
    // Stop cleanly rather than be killed partway. When this runs as background
    // work behind a page render it lives inside that function's time budget,
    // and a sweep that is cut off mid-flight loses whatever it had not written
    // yet. Bookings it does not reach are still pending, so the next sweep —
    // ninety seconds later — picks them up exactly where this one stopped.
    if (Date.now() > deadline) {
      console.error(
        `[payments] sweep stopped on budget after ${results.length}/${pending.length} bookings`,
      );
      break;
    }
    // Sequential on purpose: this runs against a live payment API and a burst of
    // parallel lookups is how a rate limit turns a reconciliation into an outage.
    results.push(await reconcileBooking(booking));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Undelivered tickets
// ---------------------------------------------------------------------------

export interface UndeliveredBooking {
  id: string;
  reference: string;
  customer_name: string;
  customer_email: string;
  amount_paise: number;
  paid_at: string;
  last_error: string | null;
}

/**
 * Paid customers who have not been emailed their pass.
 *
 * This should always be empty. When it is not, somebody has money taken and no
 * ticket — which on 24 August went unnoticed for hours because the only way to
 * find out was a customer getting in touch. Confirmed bookings with no
 * `email_sent_at` is the exact question, and it is cheap to ask.
 */
export async function undeliveredTickets(): Promise<UndeliveredBooking[]> {
  return query<UndeliveredBooking>(
    `SELECT b.id, b.reference, b.customer_name, b.customer_email, b.amount_paise, b.paid_at,
            (SELECT l.error FROM email_log l
              WHERE l.booking_id = b.id AND l.status = 'failed'
              ORDER BY l.created_at DESC LIMIT 1) AS last_error
       FROM bookings b
      WHERE b.status = 'confirmed'
        AND b.email_sent_at IS NULL
      ORDER BY b.paid_at ASC
      LIMIT 200`,
  );
}

/**
 * Send every outstanding ticket email.
 *
 * Goes through the same guarded delivery path a payment does, so a booking that
 * quietly succeeded between the listing and the send is not emailed twice.
 */
export async function sendUndeliveredTickets(): Promise<{
  attempted: number;
  sent: number;
  failed: Array<{ reference: string; error: string }>;
}> {
  const { getBookingByReference, ensureTicketsMinted } = await import('./bookings');
  const outstanding = await undeliveredTickets();

  let sent = 0;
  const failed: Array<{ reference: string; error: string }> = [];

  for (const row of outstanding) {
    // Repair before retrying. A confirmed booking with no passes cannot be
    // emailed — the mailer refuses, rightly — so without this it would fail on
    // every sweep forever while the customer, who has paid, holds nothing.
    // Minting is idempotent, so in the normal case this is one count query.
    await ensureTicketsMinted(row.id).catch((error) => {
      console.error('[payments] could not mint passes for a confirmed booking', {
        reference: row.reference,
        error: error instanceof Error ? error.message : error,
      });
    });

    const detail = await getBookingByReference(row.reference);
    if (!detail) {
      failed.push({ reference: row.reference, error: 'Booking could not be read back' });
      continue;
    }
    // Sequential: Gmail throttles a burst from one account, and a rejected
    // connection mid-sweep would look like a delivery failure rather than a
    // rate limit.
    const ok = await deliverTickets(detail);
    if (ok) sent += 1;
    else failed.push({ reference: row.reference, error: 'Send failed — see email_log' });
  }

  return { attempted: outstanding.length, sent, failed };
}

/**
 * Run a reconciliation sweep, but at most once every few minutes.
 *
 * The manual sweep only helps when somebody remembers to press it, and four
 * paying customers sat ticketless for a day because nobody did. This is the
 * automatic version: cheap to call, safe to call from anywhere, and it
 * piggybacks on traffic the site already gets.
 *
 * The throttle lives in the `rate_limits` table rather than in memory, because
 * every serverless invocation has its own heap — an in-process flag would let
 * a dozen concurrent instances each start their own sweep. The row is claimed
 * with a conditional UPDATE, so exactly one caller wins and the rest return
 * immediately.
 */
export async function maybeReconcile(everySeconds = 90): Promise<boolean> {
  if (env.paymentProvider !== 'razorpay') return false;

  try {
    const rows = await query<{ claimed: boolean }>(
      `INSERT INTO rate_limits (bucket, hits, window_start)
       VALUES ('reconcile-sweep', 1, now())
       ON CONFLICT (bucket) DO UPDATE
         SET window_start = now(), hits = rate_limits.hits + 1
         WHERE rate_limits.window_start < now() - ($1 || ' seconds')::interval
       RETURNING true AS claimed`,
      [String(everySeconds)],
    );

    // No row returned means another invocation swept recently. Nothing to do.
    if (!rows[0]?.claimed) return false;
  } catch {
    // The throttle is an optimisation, not a correctness guarantee. If it
    // cannot be read, skip rather than risk a stampede.
    return false;
  }

  /**
   * Confirming a payment is only half of delivering a ticket.
   *
   * A booking can be confirmed and still have no pass in the customer's inbox:
   * the send is attempted inline, and a refused SMTP connection or a timeout
   * leaves it confirmed with no timestamp. That customer has paid, has a valid
   * ticket at the door, and has no way to know it.
   *
   * This used to be retried only by the twice-daily cron and by a button in the
   * admin console that somebody had to remember to press — so a failed send at
   * four in the afternoon sat there until three in the morning. Running it on
   * the same ninety-second heartbeat as the confirmations means both halves of
   * delivery recover at the same speed, which is the only version of this that
   * is actually true to "the ticket goes out when the payment lands".
   *
   * Separate try/catch on purpose: a failing mail server must not stop the next
   * sweep from confirming payments, and a failing gateway must not stop the
   * mail from going out.
   */
  try {
    const mail = await sendUndeliveredTickets();
    if (mail.sent > 0) {
      console.error(`[payments] automatic sweep sent ${mail.sent} outstanding ticket email(s)`);
    }
    if (mail.failed.length > 0) {
      console.error(
        `[payments] ${mail.failed.length} ticket email(s) still failing: ` +
          mail.failed.map((f) => f.reference).join(', '),
      );
    }
  } catch (error) {
    console.error('[payments] email retry failed:', error instanceof Error ? error.message : error);
  }

  // Confirmations second, on a budget. Somebody already confirmed and waiting
  // on an email has paid and is owed a ticket right now; finding a new payment
  // can wait the ninety seconds until the next sweep. Doing it the other way
  // round meant the mail retry sat behind a full gateway pass — measured at
  // twenty-seven seconds — and would be the half that got cut off first.
  try {
    const results = await reconcilePending(720, 20_000);
    const paid = results.filter((r) => r.outcome === 'paid');
    if (paid.length > 0) {
      console.error(
        `[payments] automatic sweep recovered ${paid.length} paid booking(s): ` +
          paid.map((r) => r.reference).join(', '),
      );
    }
  } catch (error) {
    console.error('[payments] automatic sweep failed:', error instanceof Error ? error.message : error);
  }

  return true;
}
