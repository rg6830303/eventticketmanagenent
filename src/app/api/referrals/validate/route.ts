import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/validation.server';
import { previewReferral, normaliseReferralCode } from '@/lib/referrals';
import { REFERRAL_CODES, REFERRAL_DISCOUNT_PAISE } from '@/content/ticketing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Previews what a referral code is worth on an order, so the form can show the
 * new total before the customer commits.
 *
 * This is a preview and nothing more. The discount that is actually applied is
 * recomputed under a row lock when the booking is written, so a code that runs
 * out between this call and the submit cannot be spent twice.
 *
 * Rate limited per IP because the endpoint answers "does this code exist?",
 * which is exactly the question a code-guessing script asks.
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const ip = clientIp(request.headers);
    const body = (await readJson(request)) as { code?: string; amountPaise?: number };
    const code = normaliseReferralCode(String(body.code ?? ''));
    if (!code) return fail('Enter a code first', 'missing_code', 400);

    // These campaign codes ship with the site, so localhost remains useful even
    // before Postgres is configured. Database-managed codes still use the
    // rate-limited lookup below.
    const builtInCode = REFERRAL_CODES.find((entry) => entry.code === code);
    const amountPaise = Math.max(0, Math.min(Number(body.amountPaise) || 0, 100_000_00));
    if (builtInCode) {
      return ok({
        valid: true,
        code: builtInCode.code,
        discountPaise: Math.min(REFERRAL_DISCOUNT_PAISE, amountPaise),
        label: builtInCode.label,
      });
    }

    const limited = await rateLimit(
      `referral:${ip ?? 'unknown'}`,
      LIMITS.referral.limit,
      LIMITS.referral.window,
    );
    if (!limited.allowed) {
      return fail('Too many code checks. Wait a minute and try again.', 'rate_limited', 429);
    }

    // Clamp: the amount comes from the browser and is only used to cap the
    // discount for display. A hostile value can make the preview wrong, never
    // the price.
    const result = await previewReferral(code, amountPaise).catch(() => {
      return {
        valid: false,
        code,
        discountPaise: 0,
        label: null,
        reason: 'That code does not exist. Check the spelling and try again.',
      };
    });
    return ok(result);
  } catch (error) {
    return handleError(error, 'referrals.validate');
  }
}
