import 'server-only';
import crypto from 'node:crypto';
import { env } from './env';
import { TICKET_SIGNING_INFO, signingKey } from './signing-key';

/**
 * Ticket code generation and QR payload signing.
 *
 * The QR does not carry any personal data — only an opaque code plus an HMAC
 * over that code. A forged QR fails signature verification before the database
 * is ever touched, which keeps a spray of fake scans from becoming a spray of
 * queries at the gate.
 *
 * Payload format:  <VER>.<CODE>.<SIG>
 *   VER  = HOV1 for a pass sold with a redeemable cover
 *          HOVZ for a pass sold with none
 *   CODE = HOV-<EVENT>-<10 chars of Crockford base32>
 *   SIG  = first 24 chars of base64url( HMAC-SHA256(secret, VER + "." + CODE) )
 *
 * The version doubles as the cover marker, so the door learns which kind of
 * pass it is holding from the QR itself rather than only from the lookup that
 * follows. Passes already in inboxes are all HOV1 and are signed exactly as
 * they were before — nothing reissued, nothing invalidated.
 *
 * The marker is a hint, not the authority. What a pass is worth at the bar is
 * read from the ticket row at scan time, because that is the number the pass
 * was actually sold at and it cannot be edited by whoever is holding the phone.
 * Both prefixes verify, so a payload built with the wrong one still scans and
 * still admits — the worst case is a hint that disagrees with the record, and
 * the record wins.
 *
 * Signing is async because the key may be derived through Web Crypto HKDF when
 * TICKET_SIGNING_SECRET is not set (see signing-key.ts). The key is resolved
 * once per process and cached — a door scanning a queue must not pay for a
 * derivation per pass.
 */

/** A pass carrying a redeemable cover. Every pass issued before Sept 2026. */
const VERSION_STANDARD = 'HOV1';
/** A pass with nothing redeemable at the bar. */
const VERSION_ZERO_COVER = 'HOVZ';
const ACCEPTED_VERSIONS = [VERSION_STANDARD, VERSION_ZERO_COVER] as const;

export type PayloadMarker = 'standard' | 'zero-cover';
const SIGNATURE_LENGTH = 24;

// Crockford base32: no I, L, O or U, so codes read aloud at a noisy door
// without being misheard.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Cryptographically random, uppercase, unambiguous. */
function randomCode(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** e.g. "HOV-OFFC-7QK2M9XA4T" */
export function generateTicketCode(eventSlug: string): string {
  const prefix = eventSlug.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'HOVX';
  return `HOV-${prefix}-${randomCode(10)}`;
}

/** e.g. "HOV-8F3K2Q" — short, human-quotable booking reference. */
export function generateBookingReference(): string {
  return `HOV-${randomCode(6)}`;
}

let cachedKey: Promise<Uint8Array> | null = null;

function ticketKey(): Promise<Uint8Array> {
  // Cached as the promise, not the result, so concurrent first calls share one
  // derivation instead of racing several.
  cachedKey ??= signingKey('TICKET_SIGNING_SECRET', TICKET_SIGNING_INFO);
  return cachedKey;
}

async function sign(code: string, version: string): Promise<string> {
  const key = await ticketKey();
  return crypto
    .createHmac('sha256', key)
    .update(`${version}.${code}`)
    .digest('base64url')
    .slice(0, SIGNATURE_LENGTH);
}

/**
 * The exact string encoded into the QR image.
 *
 * `zeroCover` must describe the pass consistently everywhere it is built — the
 * email and the hosted pass page have to agree, or a customer's screenshot and
 * their link would carry different signatures. It comes from the ticket row for
 * that reason: a stored fact rather than an argument each caller decides for
 * itself. Getting it wrong is survivable regardless, since both versions verify.
 */
export async function buildQrPayload(code: string, zeroCover = false): Promise<string> {
  const version = zeroCover ? VERSION_ZERO_COVER : VERSION_STANDARD;
  return `${version}.${code}.${await sign(code, version)}`;
}

export type ParsedPayload =
  | { valid: true; code: string; marker: PayloadMarker }
  | { valid: false; reason: 'malformed' | 'version' | 'signature'; code: string | null };

/**
 * Parse and verify a scanned string.
 *
 * Accepts a bare payload or a full ticket URL (some phone cameras hand the
 * scanner the whole https://…/t/<payload> link).
 */
export async function parseQrPayload(raw: string): Promise<ParsedPayload> {
  let input = raw.trim();
  if (!input) return { valid: false, reason: 'malformed', code: null };

  // Tolerate a URL wrapper: https://site/t/HOV1.CODE.SIG
  if (input.startsWith('http://') || input.startsWith('https://')) {
    try {
      const url = new URL(input);
      const last = url.pathname.split('/').filter(Boolean).pop();
      if (last) input = decodeURIComponent(last);
    } catch {
      return { valid: false, reason: 'malformed', code: null };
    }
  }

  const parts = input.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed', code: null };

  const [version, code, signature] = parts;
  if (!ACCEPTED_VERSIONS.includes(version as (typeof ACCEPTED_VERSIONS)[number])) {
    return { valid: false, reason: 'version', code };
  }
  if (!/^HOV-[0-9A-Z]{1,4}-[0-9A-Z]{10}$/.test(code)) {
    return { valid: false, reason: 'malformed', code: null };
  }

  // Signed against the version presented, so each prefix verifies only its own
  // signature. Swapping HOV1 for HOVZ on a real payload does not produce a
  // valid one — the marker cannot be edited into something it was not issued as.
  const expected = await sign(code, version);
  // Length-guard first: timingSafeEqual throws on unequal buffer lengths.
  if (signature.length !== expected.length) {
    return { valid: false, reason: 'signature', code };
  }
  const matches = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!matches) return { valid: false, reason: 'signature', code };

  return {
    valid: true,
    code,
    marker: version === VERSION_ZERO_COVER ? 'zero-cover' : 'standard',
  };
}

/** Public, unguessable ticket URL that renders the QR for the attendee. */
export async function ticketUrl(code: string, zeroCover = false): Promise<string> {
  return `${env.siteUrl}/t/${encodeURIComponent(await buildQrPayload(code, zeroCover))}`;
}
