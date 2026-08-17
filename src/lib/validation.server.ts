import 'server-only';
import { promises as dns } from 'node:dns';
import { env } from './env';

/**
 * Deliverability check that needs Node APIs, kept out of validation.ts so the
 * shared schemas remain importable from client components.
 *
 * A domain with no MX (and no A/AAAA fallback) cannot accept mail at all, so
 * the ticket would bounce. This catches the realistic failure — a typo'd or
 * dead domain — without pretending to verify that the mailbox itself exists,
 * which SMTP probing does unreliably and rudely.
 */

const mxCache = new Map<string, { ok: boolean; expires: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const LOOKUP_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('dns timeout')), ms)),
  ]);
}

export interface MxCheckResult {
  deliverable: boolean;
  reason?: string;
}

export async function checkEmailDeliverable(email: string): Promise<MxCheckResult> {
  if (!env.verifyEmailMx) return { deliverable: true };

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return { deliverable: false, reason: 'Email address is malformed' };

  const cached = mxCache.get(domain);
  if (cached && cached.expires > Date.now()) {
    return cached.ok
      ? { deliverable: true }
      : { deliverable: false, reason: `"${domain}" cannot receive email — check the spelling` };
  }

  let ok = false;
  try {
    const records = await withTimeout(dns.resolveMx(domain), LOOKUP_TIMEOUT_MS);
    ok = records.length > 0;
  } catch {
    // No MX record. RFC 5321 §5.1 allows falling back to the A/AAAA record.
    try {
      const addresses = await withTimeout(dns.resolve4(domain), LOOKUP_TIMEOUT_MS);
      ok = addresses.length > 0;
    } catch {
      ok = false;
    }
  }

  mxCache.set(domain, { ok, expires: Date.now() + CACHE_TTL_MS });
  return ok
    ? { deliverable: true }
    : { deliverable: false, reason: `"${domain}" cannot receive email — check the spelling` };
}

/** Best-effort client IP behind Vercel's proxy chain. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? null;
}
