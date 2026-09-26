import 'server-only';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { env } from './env';
import { queryOne } from './db';
import { signingKey } from './signing-key';

/**
 * The one-code lock on /promoview, the view-only promoter dashboard.
 *
 * Separate from the admin login on purpose: it is meant to be handed to
 * people who should see how promoters are doing without being able to change
 * anything. The code lives only as a bcrypt hash in view_passcodes (bcrypt
 * needs no server secret, so a hash made anywhere verifies in production).
 * Replacing the row with a new hash and a higher `version` signs out every
 * browser holding the old code.
 */

const COOKIE = 'hov_promoview';
const AUDIENCE = 'hov-promoview';
const SESSION_DAYS = 7;
const NAME = 'promoview';

let cachedKey: Promise<Uint8Array> | null = null;
function key(): Promise<Uint8Array> {
  cachedKey ??= signingKey('PROMOVIEW_SECRET', 'promoview-session');
  return cachedKey;
}

function normalise(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/** Returns the current code version when the code is right, otherwise null. */
export async function checkViewCode(code: string): Promise<number | null> {
  if (!code.trim() || code.length > 64) return null;
  const row = await queryOne<{ code_hash: string; version: number }>(
    'SELECT code_hash, version FROM view_passcodes WHERE name = $1',
    [NAME],
  );
  if (!row) return null;
  return (await bcrypt.compare(normalise(code), row.code_hash)) ? row.version : null;
}

export async function startViewSession(version: number): Promise<void> {
  const token = await new SignJWT({ v: version })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(NAME)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(await key());
  const store = await cookies();
  store.set(COOKIE, token, { httpOnly: true, secure: env.isProduction, sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 86400 });
}

export async function endViewSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function hasViewSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, await key(), { audience: AUDIENCE });
    const row = await queryOne<{ version: number }>('SELECT version FROM view_passcodes WHERE name = $1', [NAME]);
    return !!row && row.version === payload.v;
  } catch {
    return false;
  }
}
