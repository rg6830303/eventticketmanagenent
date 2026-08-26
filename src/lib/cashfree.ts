import 'server-only';
import crypto from 'node:crypto';
import { env } from './env';

/**
 * Cashfree Payment Gateway client (API version 2023-08-01).
 *
 * Three rules this module exists to enforce:
 *
 *  1. **The browser is never believed.** Cashfree's return URL is a plain
 *     redirect an attacker can type by hand, so nothing here treats it as
 *     proof. `fetchOrder` re-reads the order from Cashfree's API server-side,
 *     and that response is the only thing allowed to confirm a booking.
 *  2. **The secret key never leaves the server.** Only `payment_session_id`
 *     goes to the browser, and it is single-order, short-lived and useless for
 *     anything but opening that one checkout.
 *  3. **Amounts round-trip through paise.** Cashfree speaks rupees as a decimal
 *     number; the database speaks integer paise. Converting in exactly one
 *     place stops a ₹1,111.00 order from ever becoming ₹1,111.0000001.
 */

const API_VERSION = '2023-08-01';
const TIMEOUT_MS = 20_000;

function baseUrl(): string {
  return env.cashfree.sandbox ? 'https://sandbox.cashfree.com/pg' : 'https://api.cashfree.com/pg';
}

export class CashfreeError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public raw: unknown = null,
  ) {
    super(message);
    this.name = 'CashfreeError';
  }

  /**
   * Whether trying again could plausibly work.
   *
   * This distinction is the difference between a customer waiting thirty
   * seconds and a customer tapping Pay five times against an account that
   * cannot take money at all. A timeout or a 5xx is worth another go; being
   * told the merchant account is switched off is not, and telling somebody to
   * "try again in a moment" in that case is simply false.
   */
  get retriable(): boolean {
    if (this.code === 'timeout' || this.code === 'network_error') return true;
    if (this.status === 429) return true;
    return this.status >= 500;
  }

  /**
   * True when Cashfree is refusing because of the merchant account itself —
   * disabled transactions, failed KYC, a breached limit — rather than anything
   * about this particular order. No code change fixes one of these; somebody
   * has to talk to Cashfree.
   */
  get accountLevel(): boolean {
    const text = `${this.message}`.toLowerCase();
    return (
      this.status === 401 ||
      this.status === 403 ||
      text.includes('not enabled') ||
      text.includes('not activated') ||
      text.includes('suspended') ||
      text.includes('blocked') ||
      text.includes('kyc') ||
      text.includes('limit exceeded')
    );
  }
}

/** paise -> the decimal rupee number Cashfree expects. */
export function paiseToRupees(paise: number): number {
  return Math.round(Math.max(0, paise)) / 100;
}

/** Cashfree's rupee amount -> integer paise, rounded to the nearest paisa. */
export function rupeesToPaise(rupees: number | string): number {
  return Math.round(Number(rupees) * 100);
}

async function request<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
): Promise<T> {
  const { appId, secretKey } = env.cashfree;
  if (!appId || !secretKey) {
    throw new CashfreeError('Cashfree credentials are not configured', 503, 'not_configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method: init.method,
      headers: {
        'x-api-version': API_VERSION,
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw new CashfreeError(
      aborted ? 'Cashfree did not respond in time' : 'Could not reach Cashfree',
      504,
      aborted ? 'timeout' : 'network_error',
      error instanceof Error ? error.message : error,
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Cashfree returns an HTML error page for a few infrastructure failures.
    throw new CashfreeError('Cashfree returned an unreadable response', 502, 'bad_response', text.slice(0, 500));
  }

  if (!response.ok) {
    const body = parsed as { message?: string; code?: string; type?: string } | null;
    throw new CashfreeError(
      body?.message ?? `Cashfree request failed (${response.status})`,
      response.status,
      body?.code ?? body?.type ?? 'request_failed',
      parsed,
    );
  }

  return parsed as T;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface CashfreeOrder {
  cf_order_id?: string | number;
  order_id: string;
  /** ACTIVE while payable, PAID once collected, EXPIRED/TERMINATED once dead. */
  order_status: 'ACTIVE' | 'PAID' | 'EXPIRED' | 'TERMINATED' | 'TERMINATION_REQUESTED' | string;
  order_amount: number;
  order_currency: string;
  /** Handed to the browser SDK to open checkout. Useless without it. */
  payment_session_id?: string;
  order_expiry_time?: string;
  customer_details?: Record<string, unknown>;
  order_meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CreateOrderArgs {
  orderId: string;
  amountPaise: number;
  currency?: string;
  customer: { id: string; name: string; email: string; phone: string };
  returnUrl: string;
  notifyUrl?: string;
  note?: string;
  /** Echoed back on the order and in every webhook — useful for reconciliation. */
  tags?: Record<string, string>;
  /** Minutes until the order stops being payable. */
  expiryMinutes?: number;
}

export async function createOrder(args: CreateOrderArgs): Promise<CashfreeOrder> {
  // Cashfree rejects a customer_id containing anything but alphanumerics,
  // underscore and hyphen, and silently truncates over 50 characters.
  const customerId = args.customer.id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50) || 'guest';

  const expiry = new Date(Date.now() + (args.expiryMinutes ?? 30) * 60_000);

  return request<CashfreeOrder>('/orders', {
    method: 'POST',
    body: {
      order_id: args.orderId,
      order_amount: paiseToRupees(args.amountPaise),
      order_currency: args.currency ?? 'INR',
      order_expiry_time: expiry.toISOString(),
      customer_details: {
        customer_id: customerId,
        customer_name: args.customer.name.slice(0, 100),
        customer_email: args.customer.email,
        // Cashfree wants a bare 10-digit Indian number; the +91 form is
        // rejected as an invalid phone on production.
        customer_phone: args.customer.phone.replace(/\D/g, '').slice(-10),
      },
      order_meta: {
        return_url: args.returnUrl,
        notify_url: args.notifyUrl,
      },
      order_note: args.note?.slice(0, 200),
      order_tags: args.tags,
    },
  });
}

export async function fetchOrder(orderId: string): Promise<CashfreeOrder> {
  return request<CashfreeOrder>(`/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
}

export interface CashfreePayment {
  cf_payment_id?: string | number;
  order_id?: string;
  payment_status?: 'SUCCESS' | 'FAILED' | 'PENDING' | 'USER_DROPPED' | 'CANCELLED' | 'VOID' | string;
  payment_amount?: number;
  payment_currency?: string;
  payment_message?: string;
  payment_time?: string;
  bank_reference?: string;
  payment_group?: string;
  payment_method?: unknown;
  [key: string]: unknown;
}

/** Every payment attempt against an order, newest last. */
export async function fetchOrderPayments(orderId: string): Promise<CashfreePayment[]> {
  const result = await request<CashfreePayment[] | null>(
    `/orders/${encodeURIComponent(orderId)}/payments`,
    { method: 'GET' },
  );
  return Array.isArray(result) ? result : [];
}

/** The successful attempt on an order, or null when none succeeded. */
export function successfulPayment(payments: CashfreePayment[]): CashfreePayment | null {
  return payments.find((payment) => payment.payment_status === 'SUCCESS') ?? null;
}

/**
 * `payment_method` arrives as an object keyed by instrument type
 * (`{ upi: {...} }`, `{ card: {...} }`). The key is the only part worth
 * storing — the rest is instrument detail we deliberately do not keep.
 */
export function paymentMethodLabel(payment: CashfreePayment | null): string | null {
  if (!payment) return null;
  const method = payment.payment_method;
  if (typeof method === 'string') return method.slice(0, 40);
  if (method && typeof method === 'object') {
    const key = Object.keys(method)[0];
    if (key) return key.slice(0, 40);
  }
  return typeof payment.payment_group === 'string' ? payment.payment_group.slice(0, 40) : null;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

/**
 * Verify a Cashfree webhook.
 *
 * The signature is base64(HMAC-SHA256(secretKey, timestamp + rawBody)). The RAW
 * body is what is hashed — parsing to JSON and re-serialising reorders keys and
 * every signature fails.
 *
 * A replay window is enforced on the timestamp because a valid signature stays
 * valid forever otherwise: a captured webhook could be replayed months later to
 * re-confirm a refunded booking.
 */
export function verifyWebhookSignature(args: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  toleranceSeconds?: number;
}): { ok: boolean; reason?: string } {
  const { secretKey } = env.cashfree;
  if (!secretKey) return { ok: false, reason: 'not_configured' };
  if (!args.signature || !args.timestamp) return { ok: false, reason: 'missing_headers' };

  const sentAt = Number(args.timestamp) * 1000;
  if (!Number.isFinite(sentAt)) return { ok: false, reason: 'bad_timestamp' };

  const tolerance = (args.toleranceSeconds ?? 300) * 1000;
  if (Math.abs(Date.now() - sentAt) > tolerance) return { ok: false, reason: 'stale_timestamp' };

  const expected = crypto
    .createHmac('sha256', secretKey)
    .update(`${args.timestamp}${args.rawBody}`)
    .digest('base64');

  const a = Buffer.from(args.signature);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, so guard before comparing.
  if (a.length !== b.length) return { ok: false, reason: 'signature_mismatch' };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'signature_mismatch' };

  return { ok: true };
}

/**
 * A Cashfree gateway order id derived from the booking reference.
 *
 * The reference is kept as a readable prefix so a payment can be traced to a
 * booking from the Cashfree dashboard alone. The random suffix exists because
 * Cashfree rejects a duplicate order_id outright, and a customer whose first
 * order expired must still be able to pay.
 */
export function buildOrderId(reference: string): string {
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${reference}-${suffix}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50);
}

/** Recover the booking reference from an order id built by `buildOrderId`. */
export function referenceFromOrderId(orderId: string): string | null {
  const match = /^([A-Z0-9]+-[A-Z0-9]+)-[A-F0-9]{8}$/i.exec(orderId);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Ask Cashfree whether it will actually take a transaction right now.
 *
 * Credentials authenticating is not the same as the account being able to
 * trade: a disabled merchant account answers reads with 200 and refuses order
 * creation with 400. The only honest probe is to try creating one, so this
 * creates a ₹1 order against a throwaway id and reads the answer.
 *
 * The order is never paid and expires as soon as Cashfree allows, which is
 * strictly more than fifteen minutes — pass exactly 15 and it rejects the
 * expiry before it ever gets to the question you asked, which makes the probe
 * cheerfully report the wrong fault. That is a real order in the dashboard, so
 * this is deliberately off the hot path: it runs only when /api/health is
 * asked for `?probe=gateway`.
 */
export async function probeGateway(): Promise<{
  ok: boolean;
  reason?: string;
  accountLevel?: boolean;
}> {
  if (!env.cashfree.configured) return { ok: false, reason: 'not_configured' };

  const id = `HOVPROBE-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

  try {
    await createOrder({
      orderId: id,
      amountPaise: 100,
      customer: {
        id: 'healthprobe',
        name: 'Health Probe',
        email: 'probe@houzofvybe.com',
        phone: '9999999999',
      },
      returnUrl: `${env.siteUrl}/api/payments/cashfree/return?order_id={order_id}`,
      note: 'Automated gateway health probe — never paid',
      expiryMinutes: 20,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof CashfreeError) {
      return { ok: false, reason: error.message, accountLevel: error.accountLevel };
    }
    return { ok: false, reason: error instanceof Error ? error.message : 'probe failed' };
  }
}
