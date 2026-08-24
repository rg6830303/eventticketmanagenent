import 'server-only';
import { getSiteUrl } from './site-url';

/**
 * Central environment access.
 *
 * Every server module reads config from here rather than touching process.env
 * directly, so a missing variable fails loudly at the point of use instead of
 * surfacing as `undefined` three layers deeper. Nothing in this file is ever
 * bundled into the client — the `server-only` import enforces that at build
 * time.
 */

function req(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example for the full list.`,
    );
  }
  return value.trim();
}

function opt(name: string, fallback = ''): string {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function bool(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function int(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Secrets used for HMAC/JWT must be long enough to be worth anything. */
function secret(name: string): string {
  const value = req(name);
  if (value.length < 32) {
    throw new Error(
      `${name} is too short (${value.length} chars). Use at least 32 characters — ` +
        `generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }
  return value;
}

/**
 * Which required variables are absent, without throwing to find out.
 *
 * `env.databaseUrl` and friends throw on access, which is the right behaviour
 * at a call site that cannot continue without them — but it makes "is this
 * deployment configured?" a question you can only answer by breaking. Reading
 * process.env directly here keeps the check side-effect free.
 */
export function missingCoreConfig(): string[] {
  const required = ['DATABASE_URL', 'ADMIN_SESSION_SECRET', 'TICKET_SIGNING_SECRET'];
  return required.filter((name) => !process.env[name]?.trim());
}

export const env = {
  // Single source of truth — see site-url.ts for why this needs to be defensive.
  get siteUrl(): string {
    return getSiteUrl();
  },

  get appEnv(): string {
    return opt('APP_ENV', process.env.NODE_ENV ?? 'development');
  },

  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  },

  // --- Database ---
  get databaseUrl(): string {
    return req('DATABASE_URL');
  },
  get databaseSsl(): boolean {
    return bool('DATABASE_SSL', true);
  },

  // --- Ticketing ---
  get ticketSecret(): string {
    return secret('TICKET_SIGNING_SECRET');
  },
  get maxTicketsPerBooking(): number {
    return Math.min(Math.max(int('MAX_TICKETS_PER_BOOKING', 6), 1), 20);
  },
  get verifyEmailMx(): boolean {
    return bool('VERIFY_EMAIL_MX', true);
  },

  // --- Admin ---
  get adminSecret(): string {
    return secret('ADMIN_SESSION_SECRET');
  },
  get adminSessionHours(): number {
    return Math.min(Math.max(int('ADMIN_SESSION_HOURS', 12), 1), 168);
  },

  // --- SMTP ---
  // Reading this must never throw: it is touched on the booking path, and a
  // missing SMTP variable has to degrade to "ticket not emailed" rather than
  // failing a booking that is already committed. `smtpConfigured` is the guard.
  get smtp() {
    return {
      host: opt('SMTP_HOST', 'smtp.gmail.com'),
      port: int('SMTP_PORT', 465),
      secure: bool('SMTP_SECURE', true),
      user: opt('SMTP_USER'),
      password: opt('SMTP_PASSWORD'),
      fromName: opt('MAIL_FROM_NAME', 'Houz of Vybe'),
      fromAddress: opt('MAIL_FROM_ADDRESS', opt('SMTP_USER')),
      replyTo: opt('MAIL_REPLY_TO'),
      bcc: opt('MAIL_BCC'),
    };
  },

  /** True when SMTP is configured well enough to attempt a send. */
  get smtpConfigured(): boolean {
    return Boolean(opt('SMTP_USER') && opt('SMTP_PASSWORD'));
  },

  // --- Payments ---

  /**
   * Which gateway the checkout drives.
   *
   * Derived from the keys that are actually present rather than requiring a
   * separate switch to be flipped in step with them: a deployment that has
   * Cashfree credentials and a `PAYMENT_PROVIDER` still saying `razorpay` is a
   * broken checkout, and that mismatch is invisible until a customer hits it.
   * `PAYMENT_PROVIDER` is still honoured when set, for running two gateways
   * side by side during a migration.
   */
  get paymentProvider(): 'cashfree' | 'razorpay' | 'none' {
    const declared = opt('PAYMENT_PROVIDER').toLowerCase();
    if (declared === 'cashfree' || declared === 'razorpay' || declared === 'none') return declared;
    if (opt('CASHFREE_APP_ID') && opt('CASHFREE_SECRET_KEY')) return 'cashfree';
    if (opt('RAZORPAY_KEY_ID') && opt('RAZORPAY_KEY_SECRET')) return 'razorpay';
    return 'none';
  },

  /**
   * Master switch. Defaults to "on when a gateway is configured" so supplying
   * keys is enough to go live — an operator who has pasted a live secret into
   * Vercel has already decided to take money. Set PAYMENTS_ENABLED=false to
   * hold the checkout closed with the keys still in place.
   */
  get paymentsEnabled(): boolean {
    return bool('PAYMENTS_ENABLED', this.paymentProvider !== 'none');
  },

  /**
   * Cashfree Payment Gateway.
   *
   * `sandbox` is inferred from the key prefix when CASHFREE_ENV is unset:
   * `cfsk_ma_prod_…` is a live key and `cfsk_ma_test_…` is a sandbox one.
   * Pointing a live key at the sandbox host (or the reverse) fails every call
   * with an opaque auth error, and inferring it removes the chance to get that
   * pairing wrong.
   *
   * The secret key doubles as the webhook signing key — Cashfree does not issue
   * a separate one.
   */
  get cashfree() {
    const appId = opt('CASHFREE_APP_ID');
    const secretKey = opt('CASHFREE_SECRET_KEY');
    const declared = opt('CASHFREE_ENV').toLowerCase();
    const sandbox = declared
      ? declared === 'sandbox' || declared === 'test'
      : secretKey.includes('_test_');

    return { appId, secretKey, sandbox, configured: Boolean(appId && secretKey) };
  },

  /**
   * Direct UPI collection.
   *
   * This is a manual-reconciliation channel: the customer pays a VPA from
   * their own app and types the reference back in. Nothing about that can be
   * verified in software, so `upi.enabled` only controls whether the option is
   * *offered* — releasing the tickets is always an operator decision.
   */
  get upi() {
    const vpa = opt('UPI_VPA');
    return {
      vpa,
      payeeName: opt('UPI_PAYEE_NAME', 'Houz of Vybe'),
      enabled: bool('UPI_ENABLED', false) && vpa.includes('@'),
    };
  },
  get razorpay() {
    return {
      keyId: opt('RAZORPAY_KEY_ID'),
      keySecret: opt('RAZORPAY_KEY_SECRET'),
      webhookSecret: opt('RAZORPAY_WEBHOOK_SECRET'),
    };
  },
};

export type Env = typeof env;
