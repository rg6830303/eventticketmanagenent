import 'server-only';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { queryOne } from './db';
import { signingKey } from './signing-key';

/**
 * Authentication for the door scanner.
 *
 * A separate credential from the admin console on purpose. The console shows
 * every buyer's email, phone and spend; the scanner shows one pass at a time
 * and can only mark it used. Those belong to different people — the console to
 * whoever runs the event, the scanner to whoever is standing at the door with a
 * borrowed phone — and a shared password would mean handing the second group
 * the first group's access.
 *
 * One password, no username, because a queue is not the place to type an email
 * address. It is stored in Supabase as a bcrypt hash and can be changed there
 * without a deploy; the token is signed with a key derived from the same
 * Supabase secret every other signature in this system uses.
 */

const DOOR_TOKEN_INFO = 'door-scanner-session';
const TOKEN_TTL_SECONDS = 24 * 60 * 60;

let cachedKey: Promise<Uint8Array> | null = null;
function doorKey(): Promise<Uint8Array> {
  cachedKey ??= signingKey('DOOR_TOKEN_SECRET', DOOR_TOKEN_INFO);
  return cachedKey;
}

/** Constant-time compare that tolerates unequal lengths. */
function sameSignature(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

async function sign(body: string): Promise<string> {
  const key = await doorKey();
  return crypto.createHmac('sha256', key).update(body).digest('base64url');
}

export async function verifyDoorPassword(password: string): Promise<boolean> {
  const row = await queryOne<{ password_hash: string }>(
    'SELECT password_hash FROM door_access WHERE id = 1',
  );
  if (!row) return false;
  return bcrypt.compare(password, row.password_hash);
}

/**
 * A bearer token the app keeps for a day.
 *
 * Twenty-four hours is chosen for the shape of the job: a door opens, a shift
 * runs, and nobody should be retyping a password into a phone at 2am with a
 * queue in front of them. It carries no identity — there is nothing to
 * impersonate — only an issue time, so an old token stops working on its own.
 */
export async function issueDoorToken(): Promise<{ token: string; expiresAt: string }> {
  const issued = Math.floor(Date.now() / 1000);
  const body = `door.${issued}`;
  const token = `${body}.${await sign(body)}`;
  return {
    token,
    expiresAt: new Date((issued + TOKEN_TTL_SECONDS) * 1000).toISOString(),
  };
}

export type DoorTokenCheck =
  | { valid: true; issuedAt: number }
  | { valid: false; reason: 'malformed' | 'signature' | 'expired' };

export async function verifyDoorToken(token: string | null | undefined): Promise<DoorTokenCheck> {
  if (!token) return { valid: false, reason: 'malformed' };
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'door') return { valid: false, reason: 'malformed' };

  const issued = Number(parts[1]);
  if (!Number.isFinite(issued)) return { valid: false, reason: 'malformed' };

  // Signature before expiry: a forged token should not be able to learn
  // anything from the difference between "expired" and "not yours".
  const expected = await sign(`door.${parts[1]}`);
  if (!sameSignature(parts[2], expected)) return { valid: false, reason: 'signature' };

  const age = Math.floor(Date.now() / 1000) - issued;
  if (age > TOKEN_TTL_SECONDS || age < -60) return { valid: false, reason: 'expired' };

  return { valid: true, issuedAt: issued };
}

/** Pulls the token out of an Authorization header. */
export function bearerFrom(headers: Headers): string | null {
  const raw = headers.get('authorization')?.trim() ?? '';
  return raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : null;
}
