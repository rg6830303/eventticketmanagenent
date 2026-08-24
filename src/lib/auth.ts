import 'server-only';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { env } from './env';
import { ADMIN_SESSION_INFO, signingKey } from './signing-key';
import { query, queryOne } from './db';
import type { AdminRole, AdminSession, AdminUserRow } from './types';

/**
 * Admin authentication.
 *
 * Sessions are stateless JWTs in an httpOnly, SameSite=Lax cookie. Lax rather
 * than Strict so the operator following a link into /admin from their own
 * notes still arrives logged in; every mutating route is POST-only with an
 * origin check, so CSRF is covered without Strict's usability cost.
 */

const COOKIE_NAME = 'hov_admin';
const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 8;
const LOCKOUT_MINUTES = 15;

let cachedKey: Promise<Uint8Array> | null = null;

/**
 * The key that signs the session cookie.
 *
 * Falls back to a key derived from the Supabase integration's own secret when
 * ADMIN_SESSION_SECRET is not set — see signing-key.ts. The middleware derives
 * the identical key from the same material, so the two agree without sharing
 * anything but the environment.
 *
 * Cached as the promise so concurrent sign-ins share one derivation.
 */
function secretKey(): Promise<Uint8Array> {
  cachedKey ??= signingKey('ADMIN_SESSION_SECRET', ADMIN_SESSION_INFO);
  return cachedKey;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSessionToken(session: AdminSession): Promise<string> {
  return new SignJWT({ email: session.email, name: session.name, role: session.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.sub)
    .setIssuedAt()
    .setIssuer('houz-of-vybe')
    .setAudience('hov-admin')
    .setExpirationTime(`${env.adminSessionHours}h`)
    .sign(await secretKey());
}

export async function readSessionToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, await secretKey(), {
      issuer: 'houz-of-vybe',
      audience: 'hov-admin',
    });
    if (!payload.sub || typeof payload.email !== 'string') return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : payload.email,
      role: (payload.role as AdminRole) ?? 'gate',
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: env.adminSessionHours * 3600,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/** Current admin, or null. Safe to call from server components. */
export async function getSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

/** Throws when unauthenticated — use in API routes. */
export async function requireSession(minRole: AdminRole = 'gate'): Promise<AdminSession> {
  const session = await getSession();
  if (!session) throw new AuthError('Not signed in', 401);
  if (!hasRole(session.role, minRole)) throw new AuthError('Insufficient permissions', 403);
  return session;
}

const ROLE_RANK: Record<AdminRole, number> = { gate: 1, manager: 2, owner: 3 };

export function hasRole(actual: AdminRole, required: AdminRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface LoginOutcome {
  ok: boolean;
  session?: AdminSession;
  error?: string;
}

/**
 * Password login with per-account lockout.
 *
 * The "no such user" and "wrong password" paths return an identical message and
 * both run a bcrypt comparison, so response timing does not reveal which
 * addresses are registered.
 */
export async function login(email: string, password: string): Promise<LoginOutcome> {
  const GENERIC = 'Incorrect email or password';
  const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO1Q1J3vJ4dYYQ8VNVwYNfM8L5w1qYb5C';

  const user = await queryOne<AdminUserRow & { password_hash: string; locked_until: string | null; failed_logins: number }>(
    `SELECT id, email, name, role, active, password_hash, locked_until, failed_logins, last_login_at
     FROM admin_users WHERE email = $1`,
    [email.toLowerCase()],
  );

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    return { ok: false, error: GENERIC };
  }

  if (!user.active) {
    await bcrypt.compare(password, DUMMY_HASH);
    return { ok: false, error: 'This account has been disabled' };
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return {
      ok: false,
      error: `Too many failed attempts. Try again after ${new Date(user.locked_until).toLocaleTimeString('en-IN')}`,
    };
  }

  const valid = await verifyPassword(password, user.password_hash);

  if (!valid) {
    const failed = user.failed_logins + 1;
    if (failed >= MAX_FAILED_LOGINS) {
      await query(
        `UPDATE admin_users SET failed_logins = $2,
           locked_until = now() + ($3 || ' minutes')::interval WHERE id = $1`,
        [user.id, failed, String(LOCKOUT_MINUTES)],
      );
    } else {
      await query('UPDATE admin_users SET failed_logins = $2 WHERE id = $1', [user.id, failed]);
    }
    return { ok: false, error: GENERIC };
  }

  await query(
    'UPDATE admin_users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1',
    [user.id],
  );

  return {
    ok: true,
    session: { sub: user.id, email: user.email, name: user.name, role: user.role },
  };
}

/**
 * Reject cross-origin state changes. Vercel always sets `host`; browsers always
 * set `origin` on a cross-origin POST, so a mismatch is the signal we want.
 */
export function verifyOrigin(headers: Headers): boolean {
  const origin = headers.get('origin');
  if (!origin) return true; // same-origin form posts and server-to-server calls
  try {
    const host = headers.get('host');
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
