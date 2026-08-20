import 'server-only';
import { query } from './db';

/**
 * Fixed-window rate limiting backed by Postgres.
 *
 * In-memory counters are useless on Vercel: each lambda instance gets its own
 * heap, so an attacker just spreads requests across cold starts. The counter
 * lives in a table so every instance sees the same window.
 *
 * The upsert is a single statement, so two concurrent requests cannot both read
 * a stale count — the second one blocks on the row lock and sees the increment.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSeconds: number;
}

export async function rateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const rows = await query<{ hits: number; window_start: Date }>(
      `INSERT INTO rate_limits (bucket, hits, window_start)
       VALUES ($1, 1, now())
       ON CONFLICT (bucket) DO UPDATE SET
         hits = CASE
                  WHEN rate_limits.window_start < now() - ($2 || ' seconds')::interval THEN 1
                  ELSE rate_limits.hits + 1
                END,
         window_start = CASE
                  WHEN rate_limits.window_start < now() - ($2 || ' seconds')::interval THEN now()
                  ELSE rate_limits.window_start
                END
       RETURNING hits, window_start`,
      [bucket, String(windowSeconds)],
    );

    const hits = rows[0]?.hits ?? 1;
    const windowStart = rows[0]?.window_start ?? new Date();
    const elapsed = (Date.now() - new Date(windowStart).getTime()) / 1000;
    const retryAfter = Math.max(1, Math.ceil(windowSeconds - elapsed));

    return {
      allowed: hits <= limit,
      remaining: Math.max(0, limit - hits),
      limit,
      retryAfterSeconds: retryAfter,
    };
  } catch (error) {
    // A limiter that fails closed would take the whole site down with the
    // database. Log loudly and let the request through.
    console.error('[rate-limit] failed open:', error instanceof Error ? error.message : error);
    return { allowed: true, remaining: limit, limit, retryAfterSeconds: 0 };
  }
}

/** Housekeeping — call occasionally, e.g. from a cron route. */
export async function pruneRateLimits(): Promise<number> {
  const rows = await query<{ count: string }>(
    `WITH deleted AS (
       DELETE FROM rate_limits WHERE window_start < now() - interval '1 day' RETURNING 1
     ) SELECT count(*)::text AS count FROM deleted`,
  );
  return Number(rows[0]?.count ?? 0);
}

/** Preset windows used across the API. */
export const LIMITS = {
  booking: { limit: 5, window: 600 },       // 5 bookings / 10 min per IP
  bookingEmail: { limit: 4, window: 3600 }, // 4 bookings / hour per email
  contact: { limit: 3, window: 900 },
  adminLogin: { limit: 8, window: 900 },
  scan: { limit: 600, window: 60 },         // a busy gate is fast; humans aren't 10/s
  resend: { limit: 5, window: 3600 },
  // Referral checks are cheap but guessable — this stops a script from
  // enumerating live codes from one address.
  referral: { limit: 25, window: 300 },
  payment: { limit: 20, window: 600 },
} as const;
