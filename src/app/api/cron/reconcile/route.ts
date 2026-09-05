import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { reconcilePending } from '@/lib/payments';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Scheduled recovery of payments that were taken but never confirmed.
 *
 * The browser-side callback is the normal confirmation path and it is not
 * reliable on its own — a closed tab, a dropped connection or a backgrounded
 * mobile browser all leave a customer charged with no ticket. Four of them sat
 * that way for a day because the only recovery was a button somebody had to
 * remember to press.
 *
 * Vercel's own cron can only run this daily — the Hobby plan rejects anything
 * finer at deploy time — and a day is far too long to leave somebody holding a
 * receipt and no ticket. So this endpoint is built to be driven from OUTSIDE
 * Vercel as well, by any scheduler that can make an HTTPS request every few
 * minutes. It is a plain GET with a bearer token precisely so that anything can
 * call it.
 *
 * `?hours=` sets how far back to look, and it is what makes a frequent sweep
 * affordable. Every booking in the window costs one live Razorpay lookup, run
 * sequentially. Over 30 days that is ~100 calls a pass, which is fine once a
 * day and absurd every five minutes — and pointless, because a booking
 * abandoned three weeks ago is never going to turn into a payment. A short
 * window is a handful of calls and covers everyone who could plausibly still be
 * mid-payment.
 *
 * So: a frequent external sweep runs narrow, the daily Vercel cron runs wide
 * and catches anything the narrow one aged out of.
 *
 * CRON_SECRET, when set, is required as `Authorization: Bearer <secret>`.
 * Without it the route stays reachable — a sweep can only ever confirm bookings
 * the gateway already reports as paid, so it cannot invent a payment — but an
 * open endpoint that makes up to 200 sequential Razorpay calls per request is a
 * free way for a stranger to get us rate-limited by our own payment provider at
 * the worst possible moment. So the unauthenticated path is metered hard, and
 * setting the secret is strongly preferred.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();

  if (secret) {
    // Trimmed on both sides. Schedulers have a habit of storing a secret with a
    // trailing newline, and a 401 caused by invisible whitespace is a horrible
    // thing to debug at the point where tickets have quietly stopped arriving.
    const auth = request.headers.get('authorization')?.trim() ?? '';
    // Some schedulers cannot set headers at all, so a token in the query string
    // is accepted too. Prefer the header: a URL is far likelier to end up in a
    // log somewhere.
    const token = request.nextUrl.searchParams.get('token')?.trim() ?? '';

    const presented = auth.startsWith('Bearer ') ? auth.slice(7).trim() : token;
    if (!matches(presented, secret)) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  } else {
    // No secret configured, so anyone can reach this. Each call can fan out to
    // hundreds of live Razorpay lookups, which makes an open endpoint a way to
    // burn our own API quota. A real scheduler runs every couple of minutes and
    // sails under this; a script hammering it does not.
    const ip = clientIp(request.headers);
    const limited = await rateLimit(`cron-open:${ip ?? 'unknown'}`, 12, 600);
    if (!limited.allowed) {
      return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });
    }
  }

  // Default is deliberately narrow: this endpoint is expected to be called
  // often, and the wide pass is the once-a-day one that asks for it explicitly.
  const requested = Number(request.nextUrl.searchParams.get('hours'));
  const hours = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 720) : 24;

  try {
    const results = await reconcilePending(hours);
    const paid = results.filter((r) => r.outcome === 'paid');

    if (paid.length > 0) {
      console.error(
        `[cron] recovered ${paid.length} paid booking(s): ${paid.map((r) => r.reference).join(', ')}`,
      );
    }

    return NextResponse.json({
      ok: true,
      hours,
      checked: results.length,
      recovered: paid.length,
      references: paid.map((r) => r.reference),
    });
  } catch (error) {
    console.error('[cron] sweep failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * Constant-time secret comparison.
 *
 * `!==` on a token leaks its length and, in principle, its contents through
 * timing. The risk over HTTPS is small; the cost of not having it is smaller.
 */
function matches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
