import 'server-only';
import { query, queryOne } from './db';
import { env } from './env';
import {
  buildOrderId,
  CashfreeError,
  createOrder,
  fetchOrder,
  fetchOrderPayments,
  paymentMethodLabel,
  referenceFromOrderId,
  rupeesToPaise,
  successfulPayment,
  type CashfreeOrder,
  type CashfreePayment,
} from './cashfree';
import { confirmPendingBooking, markEmailSent, releasePendingBooking } from './bookings';
import { sendTicketEmail } from './mailer';
import type { BookingDetail, BookingRow, PaymentRow } from './types';

/**
 * Payment settlement.
 *
 * The single rule this module exists to hold: **a booking is confirmed by
 * Cashfree's API and by nothing else.** Not by a redirect landing on the return
 * URL, not by a webhook body, not by anything the browser says. Both of those
 * are only signals that it is now worth *asking*, and `settleCashfreeOrder` is
 * the one function that asks.
 *
 * Everything observed on the way is appended to the `payments` table, so a
 * disputed charge can be reconstructed from what Cashfree actually said and
 * when, rather than from an inference about what the code must have done.
 */

export type SettleSource = 'order' | 'return' | 'webhook' | 'poll';

export interface SettleResult {
  /** 'paid' is the only outcome that mints tickets. */
  outcome: 'paid' | 'pending' | 'failed' | 'expired' | 'unknown_order' | 'not_configured';
  booking: BookingRow | null;
  detail: BookingDetail | null;
  orderStatus: string | null;
  emailSent: boolean;
  message: string;
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
        row.provider ?? 'cashfree',
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
  return query<PaymentRow>(
    'SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at ASC',
    [bookingId],
  );
}

/**
 * Resolve a gateway order id back to its booking.
 *
 * Three routes, cheapest first. The ledger is authoritative because it holds
 * every order ever created for a booking; `bookings.payment_order_id` only
 * holds the most recent one, so a customer who paid an earlier attempt would
 * otherwise be unfindable. The reference embedded in the order id is the last
 * resort for an order created before the ledger row committed.
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

  const viaBooking = await queryOne<BookingRow>(
    'SELECT * FROM bookings WHERE payment_order_id = $1',
    [orderId],
  );
  if (viaBooking) return viaBooking;

  const reference = referenceFromOrderId(orderId);
  if (!reference) return null;
  return queryOne<BookingRow>('SELECT * FROM bookings WHERE reference = $1', [reference]);
}

// ---------------------------------------------------------------------------
// Starting a payment
// ---------------------------------------------------------------------------

export interface StartPaymentResult {
  orderId: string;
  paymentSessionId: string;
  amountPaise: number;
  /** 'production' | 'sandbox' — the browser SDK needs to be told which. */
  mode: 'production' | 'sandbox';
  /** True when an existing, still-payable order was handed back. */
  reused: boolean;
}

/**
 * Get a payable Cashfree session for a pending booking.
 *
 * An existing ACTIVE order is reused rather than replaced. Creating a fresh
 * order on every click leaves a trail of live orders for the same booking, any
 * of which could be paid, and reconciling that is a manual job nobody wants at
 * 1am. A new order is only minted when the previous one is genuinely dead.
 */
export async function startCashfreePayment(booking: BookingRow): Promise<StartPaymentResult> {
  const mode: 'production' | 'sandbox' = env.cashfree.sandbox ? 'sandbox' : 'production';
  const returnUrl = `${env.siteUrl}/api/payments/cashfree/return?order_id={order_id}`;
  const notifyUrl = `${env.siteUrl}/api/payments/cashfree/webhook`;

  if (booking.payment_order_id) {
    const existing = await fetchOrder(booking.payment_order_id).catch(() => null);
    if (existing?.order_status === 'ACTIVE' && existing.payment_session_id) {
      // Only reuse when the price still matches. A cart edited between attempts
      // must not be paid at the old total.
      if (rupeesToPaise(existing.order_amount) === booking.amount_paise) {
        return {
          orderId: existing.order_id,
          paymentSessionId: existing.payment_session_id,
          amountPaise: booking.amount_paise,
          mode,
          reused: true,
        };
      }
    }
  }

  const orderId = buildOrderId(booking.reference);

  const order = await createOrder({
    orderId,
    amountPaise: booking.amount_paise,
    currency: booking.currency,
    customer: {
      id: booking.customer_id ?? booking.reference,
      name: booking.customer_name,
      email: booking.customer_email,
      phone: booking.customer_phone,
    },
    returnUrl,
    notifyUrl,
    note: `Passes for ${booking.reference}`,
    tags: { reference: booking.reference, bookingId: booking.id },
    expiryMinutes: 30,
  });

  if (!order.payment_session_id) {
    throw new Error('Cashfree created the order without a payment session');
  }

  await query(
    `UPDATE bookings SET payment_order_id = $2, payment_provider = 'cashfree' WHERE id = $1`,
    [booking.id, order.order_id],
  );

  await recordPayment({
    bookingId: booking.id,
    orderId: order.order_id,
    status: order.order_status ?? 'CREATED',
    amountPaise: booking.amount_paise,
    currency: booking.currency,
    source: 'order',
    message: 'Order created',
    raw: redactOrder(order),
  });

  return {
    orderId: order.order_id,
    paymentSessionId: order.payment_session_id,
    amountPaise: booking.amount_paise,
    mode,
    reused: false,
  };
}

// ---------------------------------------------------------------------------
// Settling a payment
// ---------------------------------------------------------------------------

/**
 * Ask Cashfree what actually happened to an order, and act on the answer.
 *
 * Safe to call repeatedly and from anywhere — the return URL, the webhook, an
 * operator clicking "re-check" — because every step is idempotent:
 * `confirmPendingBooking` only promotes a `pending` row, minting is skipped
 * when tickets already exist, and the email send is guarded on `email_sent_at`.
 *
 * The amount is re-checked against the booking. A short payment is left pending
 * and flagged rather than confirmed: handing over passes for less than the
 * price is the one mistake here that cannot be undone at the door.
 */
export async function settleCashfreeOrder(
  orderId: string,
  source: SettleSource,
): Promise<SettleResult> {
  if (!env.cashfree.configured) {
    return {
      outcome: 'not_configured',
      booking: null,
      detail: null,
      orderStatus: null,
      emailSent: false,
      message: 'Cashfree is not configured on this deployment',
    };
  }

  const booking = await bookingForOrderId(orderId);

  let order: CashfreeOrder;
  try {
    order = await fetchOrder(orderId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cashfree lookup failed';
    await recordPayment({
      bookingId: booking?.id ?? null,
      orderId,
      status: 'LOOKUP_FAILED',
      source,
      message,
    });

    // A 404 is Cashfree saying the order does not exist, which is an answer
    // rather than an outage. Reporting it as "still processing" would leave
    // somebody who mistyped a URL waiting for a payment that was never made.
    if (error instanceof CashfreeError && error.status === 404) {
      return {
        outcome: 'unknown_order',
        booking,
        detail: null,
        orderStatus: null,
        emailSent: false,
        message: 'We could not match that payment to a booking',
      };
    }

    // Anything else is a transport or gateway failure. Throwing lets the caller
    // fall back to "still settling" and lets the webhook retry.
    throw error;
  }

  if (!booking) {
    await recordPayment({
      bookingId: null,
      orderId,
      status: order.order_status ?? 'UNKNOWN',
      source,
      message: 'No booking matches this order id',
      raw: redactOrder(order),
    });
    return {
      outcome: 'unknown_order',
      booking: null,
      detail: null,
      orderStatus: order.order_status ?? null,
      emailSent: false,
      message: 'We could not match that payment to a booking',
    };
  }

  const payments = await fetchOrderPayments(orderId).catch(() => [] as CashfreePayment[]);
  const success = successfulPayment(payments);
  const paidPaise = success ? rupeesToPaise(success.payment_amount ?? order.order_amount) : 0;

  await recordPayment({
    bookingId: booking.id,
    orderId,
    paymentId: success?.cf_payment_id != null ? String(success.cf_payment_id) : null,
    status: order.order_status ?? 'UNKNOWN',
    amountPaise: paidPaise || booking.amount_paise,
    currency: order.order_currency ?? booking.currency,
    method: paymentMethodLabel(success),
    bankReference: typeof success?.bank_reference === 'string' ? success.bank_reference : null,
    message: typeof success?.payment_message === 'string' ? success.payment_message : null,
    source,
    raw: { order: redactOrder(order), payment: success ? redactPayment(success) : null },
  });

  // --- Paid ------------------------------------------------------------
  if (order.order_status === 'PAID' && success) {
    if (paidPaise + 100 < booking.amount_paise) {
      // Tolerance of ₹1 absorbs a gateway rounding difference; anything larger
      // is a real shortfall and needs a human, not a ticket.
      console.error('[payments] short payment', {
        orderId,
        expected: booking.amount_paise,
        received: paidPaise,
      });
      return {
        outcome: 'pending',
        booking,
        detail: null,
        orderStatus: order.order_status,
        emailSent: false,
        message: 'The amount received does not match the order. Our team is checking it.',
      };
    }

    const detail = await confirmPendingBooking(booking.id, {
      paymentId: String(success.cf_payment_id ?? orderId),
      orderId,
      signature: typeof success.bank_reference === 'string' ? success.bank_reference : source,
      provider: 'cashfree',
    });

    const emailSent = await deliverTickets(detail);

    return {
      outcome: 'paid',
      booking: detail.booking,
      detail,
      orderStatus: order.order_status,
      emailSent,
      message: 'Payment confirmed',
    };
  }

  // --- Dead ------------------------------------------------------------
  if (order.order_status === 'EXPIRED' || order.order_status === 'TERMINATED') {
    await releasePendingBooking(booking.id, `Cashfree order ${order.order_status} (${orderId})`);
    return {
      outcome: 'expired',
      booking,
      detail: null,
      orderStatus: order.order_status,
      emailSent: false,
      message: 'This payment window has closed. Start a new booking.',
    };
  }

  // --- Still open ------------------------------------------------------
  const dropped = payments.some((payment) =>
    ['FAILED', 'USER_DROPPED', 'CANCELLED'].includes(String(payment.payment_status)),
  );

  return {
    outcome: dropped ? 'failed' : 'pending',
    booking,
    detail: null,
    orderStatus: order.order_status ?? null,
    emailSent: false,
    message: dropped
      ? 'That payment did not go through. Nothing was charged — try again.'
      : 'Payment has not completed yet.',
  };
}

/**
 * Send the ticket email once per booking.
 *
 * Guarded on `email_sent_at` because the return URL and the webhook both reach
 * here for the same payment, and two identical ticket emails read as a double
 * charge to the person receiving them.
 *
 * A send failure is never allowed to propagate: the money is taken and the
 * passes exist, so the correct outcome is a confirmed booking the customer can
 * resend from, not a 500 that makes them think they lost their tickets.
 */
async function deliverTickets(detail: BookingDetail): Promise<boolean> {
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
// Redaction
// ---------------------------------------------------------------------------

/**
 * Keep the fields that answer reconciliation questions, drop the rest.
 *
 * The raw payloads carry the customer's phone and email alongside instrument
 * detail, and a JSONB column is the wrong place for a second copy of either —
 * it outlives the booking, is not covered by the deletion path, and buys
 * nothing a join cannot.
 */
function redactOrder(order: CashfreeOrder): Record<string, unknown> {
  return {
    cf_order_id: order.cf_order_id,
    order_id: order.order_id,
    order_status: order.order_status,
    order_amount: order.order_amount,
    order_currency: order.order_currency,
    order_expiry_time: order.order_expiry_time,
  };
}

function redactPayment(payment: CashfreePayment): Record<string, unknown> {
  return {
    cf_payment_id: payment.cf_payment_id,
    payment_status: payment.payment_status,
    payment_amount: payment.payment_amount,
    payment_currency: payment.payment_currency,
    payment_time: payment.payment_time,
    payment_group: payment.payment_group,
    payment_message: payment.payment_message,
    bank_reference: payment.bank_reference,
    method: paymentMethodLabel(payment),
  };
}
