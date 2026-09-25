import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { findPromoterByCode, logActivity, startPromoterSession } from '@/lib/promoters';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** One-code sign-in for promoters. Throttled hard: a code is the whole credential. */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);
    const ip = clientIp(request.headers) ?? 'unknown';
    const limit = await rateLimit(`promoter-login:${ip}`, 10, 900);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const body = (await readJson(request)) as { code?: string };
    const code = typeof body.code === 'string' ? body.code : '';
    if (!code.trim()) return fail('Enter your promoter code', 'missing_code', 422);

    const promoter = await findPromoterByCode(code);
    if (!promoter) return fail('That code is not recognised', 'bad_code', 401);
    if (!promoter.active) return fail('This promoter account is suspended. Contact the organiser.', 'suspended', 403);

    await startPromoterSession(promoter);
    await logActivity(promoter.id, 'login').catch(() => {});
    return ok({ name: promoter.name });
  } catch (error) {
    return handleError(error, 'promoter.login');
  }
}
