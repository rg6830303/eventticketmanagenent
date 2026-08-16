import 'server-only';
import crypto from 'node:crypto';
import { env } from './env';

/**
 * Ticket code generation and QR payload signing.
 *
 * The QR does not carry any personal data — only an opaque code plus an HMAC
 * over that code. A forged QR fails signature verification before the database
 * is ever touched, which keeps a spray of fake scans from becoming a spray of
 * queries at the gate.
 *
 * Payload format:  HOV1.<CODE>.<SIG>
 *   CODE = HOV-<EVENT>-<10 chars of Crockford base32>
 *   SIG  = first 24 chars of base64url( HMAC-SHA256(secret, "HOV1." + CODE) )
 */

const PAYLOAD_VERSION = 'HOV1';
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

function sign(code: string): string {
  return crypto
    .createHmac('sha256', env.ticketSecret)
    .update(`${PAYLOAD_VERSION}.${code}`)
    .digest('base64url')
    .slice(0, SIGNATURE_LENGTH);
}

/** The exact string encoded into the QR image. */
export function buildQrPayload(code: string): string {
  return `${PAYLOAD_VERSION}.${code}.${sign(code)}`;
}

export type ParsedPayload =
  | { valid: true; code: string }
  | { valid: false; reason: 'malformed' | 'version' | 'signature'; code: string | null };

/**
 * Parse and verify a scanned string.
 *
 * Accepts a bare payload or a full ticket URL (some phone cameras hand the
 * scanner the whole https://…/t/<payload> link).
 */
export function parseQrPayload(raw: string): ParsedPayload {
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
  if (version !== PAYLOAD_VERSION) return { valid: false, reason: 'version', code };
  if (!/^HOV-[0-9A-Z]{1,4}-[0-9A-Z]{10}$/.test(code)) {
    return { valid: false, reason: 'malformed', code: null };
  }

  const expected = sign(code);
  // Length-guard first: timingSafeEqual throws on unequal buffer lengths.
  if (signature.length !== expected.length) {
    return { valid: false, reason: 'signature', code };
  }
  const matches = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!matches) return { valid: false, reason: 'signature', code };

  return { valid: true, code };
}

/** Public, unguessable ticket URL that renders the QR for the attendee. */
export function ticketUrl(code: string): string {
  return `${env.siteUrl}/t/${encodeURIComponent(buildQrPayload(code))}`;
}
