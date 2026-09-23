import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { env } from './env';
import { CUSTOMER_SESSION_INFO, signingKey } from './signing-key';
import { query, queryOne } from './db';
import type { CustomerRow } from './types';

/**
 * Customer accounts.
 *
 * Deliberately a separate system from `lib/auth.ts`, sharing nothing but the
 * shape of the code. The two cookies authorise very different things — this
 * one shows a person their own passes, that one shows every buyer's email,
 * phone and lifetime spend — so they have separate cookie names, separate JWT
 * audiences and separate derived signing keys. A customer token is not merely
 * rejected by the admin side; it cannot be verified there at all.
 *
 * The account sits on the existing `customers` row rather than a table of its
 * own, because one already exists for everybody who has ever checked out as a
 * guest. Signing up is usually a *claim* of that row, which is the whole
 * point: the account shows the tickets they already bought.
 *
 * That claim is also the risk. The row is keyed on email alone, so until the
 * mailbox has proved it owns the address, an account is only an assertion.
 * `requireVerified` is what stands between that assertion and somebody else's
 * working QR passes.
 */

const COOKIE_NAME = 'hov_customer';
const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 10;
const LOCKOUT_MINUTES = 15;
const SESSION_DAYS = 30;

/** Long enough that a customer is not signed out between two events. */
const SESSION_SECONDS = SESSION_DAYS * 24 * 3600;

let cachedKey: Promise<Uint8Array> | null = null;

function secretKey(): Promise<Uint8Array> {
  cachedKey ??= signingKey('CUSTOMER_SESSION_SECRET', CUSTOMER_SESSION_INFO);
  return cachedKey;
}

export interface CustomerSession {
  /** customers.id */
  sub: string;
  email: string;
  name: string;
}

/** A customer row with the account columns. */
export interface CustomerAccountRow extends CustomerRow {
  password_hash: string | null;
  email_verified_at: string | null;
  failed_logins: number;
  locked_until: string | null;
  signed_up_at: string | null;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function createCustomerToken(session: CustomerSession): Promise<string> {
  return new SignJWT({ email: session.email, name: session.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.sub)
    .setIssuedAt()
    .setIssuer('houz-of-vybe')
    .setAudience('hov-customer')
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(await secretKey());
}

export async function readCustomerToken(token: string): Promise<CustomerSession | null> {
  try {
    const { payload } = await jwtVerify(token, await secretKey(), {
      issuer: 'houz-of-vybe',
      audience: 'hov-customer',
    });
    if (!payload.sub || typeof payload.email !== 'string') return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : payload.email,
    };
  } catch {
    return null;
  }
}

export async function setCustomerCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_SECONDS,
  });
}

export async function clearCustomerCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/**
 * The signed-in customer, or null.
 *
 * Safe to call from any server component: a missing or unreadable cookie is
 * "signed out", never an error, so a page that merely wants to greet somebody
 * by name cannot be taken down by a rotated key.
 */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return readCustomerToken(token);
}

/** The full row behind the session, re-read so a disabled account cannot linger. */
export async function getCurrentCustomer(): Promise<CustomerAccountRow | null> {
  const session = await getCustomerSession();
  if (!session) return null;

  const row = await queryOne<CustomerAccountRow>(
    'SELECT * FROM customers WHERE id = $1 AND password_hash IS NOT NULL',
    [session.sub],
  );
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export interface AccountOutcome {
  ok: boolean;
  session?: CustomerSession;
  /** Present on success when the mailbox has not been confirmed yet. */
  needsVerification?: boolean;
  error?: string;
  code?: string;
}

const GENERIC_LOGIN_ERROR = 'Incorrect email or password';
/** A real bcrypt hash of a value nobody knows, so the miss path costs the same. */
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO1Q1J3vJ4dYYQ8VNVwYNfM8L5w1qYb5C';

/**
 * Create an account, or claim the guest row that already owns this address.
 *
 * Returns the same shape either way and never says which happened — "an
 * account already exists for this email" is a membership oracle, and this is a
 * list of people who go to parties. The address gets an email telling it what
 * occurred; the browser gets told only that something was sent.
 */
export async function signUp(input: {
  email: string;
  password: string;
  name: string;
  phone?: string | null;
  marketingOptIn?: boolean;
}): Promise<{ customer: CustomerAccountRow | null; created: boolean }> {
  const email = input.email.toLowerCase().trim();
  const hash = await hashPassword(input.password);

  const existing = await queryOne<CustomerAccountRow>(
    'SELECT * FROM customers WHERE email = $1',
    [email],
  );

  // Already a real account. Do not touch the password — that would be a
  // password reset performed by whoever typed the address into a signup form.
  if (existing?.password_hash) {
    return { customer: existing, created: false };
  }

  const row = await queryOne<CustomerAccountRow>(
    `INSERT INTO customers (email, name, phone, password_hash, signed_up_at, marketing_opt_in)
     VALUES ($1, $2, $3, $4, now(), $5)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       signed_up_at  = now(),
       -- Keep the name and phone already on file when the new form left them
       -- blank; a guest row usually knows more than a signup form does.
       name  = COALESCE(NULLIF(EXCLUDED.name, ''), customers.name),
       phone = COALESCE(NULLIF(EXCLUDED.phone, ''), customers.phone),
       marketing_opt_in = EXCLUDED.marketing_opt_in OR customers.marketing_opt_in
     RETURNING *`,
    [email, input.name.trim(), input.phone?.trim() || null, hash, Boolean(input.marketingOptIn)],
  );

  return { customer: row, created: true };
}

/**
 * Password login, with per-account lockout.
 *
 * The "no such account" and "wrong password" paths return an identical message
 * and both run a bcrypt comparison, so response timing does not reveal which
 * addresses are registered.
 */
export async function logIn(email: string, password: string): Promise<AccountOutcome> {
  const row = await queryOne<CustomerAccountRow>('SELECT * FROM customers WHERE email = $1', [
    email.toLowerCase().trim(),
  ]);

  // No row, or a guest row with no account on it. Both are "wrong credentials"
  // as far as the browser is told.
  if (!row?.password_hash) {
    await bcrypt.compare(password, DUMMY_HASH);
    return { ok: false, error: GENERIC_LOGIN_ERROR, code: 'invalid_credentials' };
  }

  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    return {
      ok: false,
      error: 'Too many failed attempts. Try again in a few minutes, or reset your password.',
      code: 'locked',
    };
  }

  const valid = await bcrypt.compare(password, row.password_hash);

  if (!valid) {
    const failed = row.failed_logins + 1;
    if (failed >= MAX_FAILED_LOGINS) {
      await query(
        `UPDATE customers SET failed_logins = $2,
           locked_until = now() + ($3 || ' minutes')::interval WHERE id = $1`,
        [row.id, failed, String(LOCKOUT_MINUTES)],
      );
    } else {
      await query('UPDATE customers SET failed_logins = $2 WHERE id = $1', [row.id, failed]);
    }
    return { ok: false, error: GENERIC_LOGIN_ERROR, code: 'invalid_credentials' };
  }

  await query(
    'UPDATE customers SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1',
    [row.id],
  );

  return {
    ok: true,
    session: { sub: row.id, email: row.email, name: row.name },
    needsVerification: !row.email_verified_at,
  };
}

export async function setPassword(customerId: string, plain: string): Promise<void> {
  await query(
    `UPDATE customers
        SET password_hash = $2, failed_logins = 0, locked_until = NULL,
            signed_up_at = COALESCE(signed_up_at, now())
      WHERE id = $1`,
    [customerId, await hashPassword(plain)],
  );
}

// ---------------------------------------------------------------------------
// Email tokens
// ---------------------------------------------------------------------------

export type TokenPurpose = 'verify_email' | 'reset_password';

/** Hours a token stays usable. Short for resets, longer for a first verify. */
const TOKEN_HOURS: Record<TokenPurpose, number> = {
  verify_email: 72,
  reset_password: 2,
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Mint a single-use token and return the plaintext, which exists only in the
 * return value and the email built from it. Only its SHA-256 is stored, so a
 * leaked database backup cannot be replayed into account takeovers.
 */
export async function issueToken(
  customerId: string,
  purpose: TokenPurpose,
  ip?: string | null,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');

  // Any outstanding token for the same purpose is spent. Requesting a second
  // reset must invalidate the first, or a link mailed to an address the
  // customer has lost control of stays live.
  await query(
    `UPDATE customer_tokens SET used_at = now()
      WHERE customer_id = $1 AND purpose = $2 AND used_at IS NULL`,
    [customerId, purpose],
  );

  await query(
    `INSERT INTO customer_tokens (token_hash, customer_id, purpose, expires_at, ip_address)
     VALUES ($1, $2, $3, now() + ($4 || ' hours')::interval, $5)`,
    [hashToken(token), customerId, purpose, String(TOKEN_HOURS[purpose]), ip ?? null],
  );

  return token;
}

/**
 * Spend a token. Returns the customer it belonged to, or null.
 *
 * The UPDATE ... WHERE used_at IS NULL is the single-use guarantee: two
 * simultaneous uses of one link race on the row and exactly one updates it.
 * Checking then updating would let both through.
 */
export async function consumeToken(
  token: string,
  purpose: TokenPurpose,
): Promise<CustomerAccountRow | null> {
  const row = await queryOne<{ customer_id: string }>(
    `UPDATE customer_tokens
        SET used_at = now()
      WHERE token_hash = $1
        AND purpose = $2
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING customer_id`,
    [hashToken(token), purpose],
  );
  if (!row) return null;

  return queryOne<CustomerAccountRow>('SELECT * FROM customers WHERE id = $1', [row.customer_id]);
}

export async function markEmailVerified(customerId: string): Promise<void> {
  await query(
    'UPDATE customers SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1',
    [customerId],
  );
}

export async function findAccountByEmail(email: string): Promise<CustomerAccountRow | null> {
  return queryOne<CustomerAccountRow>(
    'SELECT * FROM customers WHERE email = $1 AND password_hash IS NOT NULL',
    [email.toLowerCase().trim()],
  );
}
