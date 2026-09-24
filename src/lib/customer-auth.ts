import 'server-only';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { query, queryOne } from './db';
import { env } from './env';
import { signingKey } from './signing-key';

/**
 * Customer accounts.
 *
 * Stored on the existing `customers` row rather than a separate users table:
 * somebody who bought a pass last month and signs up today is the same person,
 * and their bookings, spend and referral history should come with them instead
 * of starting over under a second record keyed by the same email.
 *
 * Credentials live in Supabase Postgres as bcrypt hashes. The session is a JWT
 * in an httpOnly cookie, signed with a key derived from the Supabase secret —
 * a different derivation from the admin session, so a customer token can never
 * be replayed as a console login and the other way round.
 */

const COOKIE_NAME = 'hov_customer';
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 10;
const RESET_TTL_MINUTES = 60;

export interface CustomerSession {
  sub: string;
  email: string;
  name: string;
}

export interface CustomerAccount {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  registered_at: string | null;
}

let cachedKey: Promise<Uint8Array> | null = null;
function key(): Promise<Uint8Array> {
  cachedKey ??= signingKey('CUSTOMER_SESSION_SECRET', 'customer-session-jwt');
  return cachedKey;
}

export async function hashCustomerPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function createToken(session: CustomerSession): Promise<string> {
  return new SignJWT({ email: session.email, name: session.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.sub)
    .setIssuedAt()
    .setAudience('hov-customer')
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(await key());
}

export async function startCustomerSession(account: CustomerAccount): Promise<void> {
  const token = await createToken({ sub: account.id, email: account.email, name: account.name });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function endCustomerSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await key(), { audience: 'hov-customer' });
    if (!payload.sub || typeof payload.email !== 'string') return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : '',
    };
  } catch {
    return null;
  }
}

/**
 * The signed-in account, read fresh from the database.
 *
 * The cookie says who someone was when they signed in; the row says who they
 * are now. A password reset or a deleted account must take effect on the next
 * request, not whenever a thirty-day cookie happens to lapse.
 */
export async function getCustomerAccount(): Promise<CustomerAccount | null> {
  const session = await getCustomerSession();
  if (!session) return null;
  return queryOne<CustomerAccount>(
    `SELECT id, email, name, phone, registered_at FROM customers
      WHERE id = $1 AND password_hash IS NOT NULL`,
    [session.sub],
  ).catch(() => null);
}

export type SignupOutcome =
  | { ok: true; account: CustomerAccount }
  | { ok: false; reason: 'exists' };

/**
 * Create an account — or claim the customer record that already exists.
 *
 * Most people signing up have bought from us before, so a customers row with
 * their email is already there with no password on it. That row is theirs and
 * signing up attaches a password to it. Only a row that already HAS a password
 * is refused, because then somebody else already owns the account.
 */
export async function signUp(input: {
  email: string;
  name: string;
  phone: string;
  password: string;
}): Promise<SignupOutcome> {
  const hash = await hashCustomerPassword(input.password);
  const email = input.email.trim().toLowerCase();

  const existing = await queryOne<{ id: string; password_hash: string | null }>(
    'SELECT id, password_hash FROM customers WHERE email = $1',
    [email],
  );
  if (existing?.password_hash) return { ok: false, reason: 'exists' };

  const account = existing
    ? await queryOne<CustomerAccount>(
        `UPDATE customers
            SET password_hash = $2, name = $3, phone = $4,
                registered_at = now(), last_login_at = now(), updated_at = now()
          WHERE id = $1
          RETURNING id, email, name, phone, registered_at`,
        [existing.id, hash, input.name.trim(), input.phone],
      )
    : await queryOne<CustomerAccount>(
        `INSERT INTO customers (email, name, phone, password_hash, registered_at, last_login_at, first_source)
         VALUES ($1, $2, $3, $4, now(), now(), 'signup')
         RETURNING id, email, name, phone, registered_at`,
        [email, input.name.trim(), input.phone, hash],
      );

  if (!account) throw new Error('Account could not be created');
  return { ok: true, account };
}

// A fixed hash to compare against when the email does not exist, so a wrong
// address and a wrong password take the same time to reject.
const DUMMY_HASH = '$2a$10$9fGlaz5RufD0Z4jym/jHzOrylEOSNjJaLN7btONOjQoEnIsRTXjwG';

export async function signIn(email: string, password: string): Promise<CustomerAccount | null> {
  const row = await queryOne<CustomerAccount & { password_hash: string | null }>(
    `SELECT id, email, name, phone, registered_at, password_hash
       FROM customers WHERE email = $1`,
    [email.trim().toLowerCase()],
  );
  if (!row?.password_hash) {
    await bcrypt.compare(password, DUMMY_HASH);
    return null;
  }
  if (!(await bcrypt.compare(password, row.password_hash))) return null;

  await query('UPDATE customers SET last_login_at = now() WHERE id = $1', [row.id]);
  const { password_hash: _hidden, ...account } = row;
  return account;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * A single-use reset link, valid for an hour.
 *
 * Returns null for an email with no account, and the route answers identically
 * either way, so the form cannot be used to find out who has an account.
 */
export async function createPasswordReset(
  email: string,
): Promise<{ token: string; account: CustomerAccount } | null> {
  const account = await queryOne<CustomerAccount>(
    `SELECT id, email, name, phone, registered_at FROM customers
      WHERE email = $1 AND password_hash IS NOT NULL`,
    [email.trim().toLowerCase()],
  );
  if (!account) return null;

  // Any earlier unused link dies when a new one is issued — only the most
  // recent email in somebody's inbox should work.
  await query(
    'UPDATE password_resets SET used_at = now() WHERE customer_id = $1 AND used_at IS NULL',
    [account.id],
  );

  const token = crypto.randomBytes(32).toString('base64url');
  await query(
    `INSERT INTO password_resets (customer_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
    [account.id, hashToken(token), String(RESET_TTL_MINUTES)],
  );
  return { token, account };
}

export async function resetPassword(token: string, password: string): Promise<CustomerAccount | null> {
  const row = await queryOne<{ id: string; customer_id: string }>(
    `UPDATE password_resets SET used_at = now()
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
      RETURNING id, customer_id`,
    [hashToken(token)],
  );
  if (!row) return null;

  return queryOne<CustomerAccount>(
    `UPDATE customers SET password_hash = $2, last_login_at = now(), updated_at = now()
      WHERE id = $1
      RETURNING id, email, name, phone, registered_at`,
    [row.customer_id, await hashCustomerPassword(password)],
  );
}

export const RESET_LINK_MINUTES = RESET_TTL_MINUTES;
