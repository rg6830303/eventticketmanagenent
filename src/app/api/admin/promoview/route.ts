import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { checkViewCode, endViewSession, startViewSession } from '@/lib/promoview';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Unlock the view-only promoter dashboard with its code. Throttled: the code is the whole credential. */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);
    const limit = await rateLimit(`promoview:${clientIp(request.headers) ?? 'unknown'}`, 10, 900);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const body = (await readJson(request)) as { code?: unknown };
    const version = await checkViewCode(typeof body.code === 'string' ? body.code : '');
    if (version === null) return fail('That code is not right', 'bad_code', 401);

    await startViewSession(version);
    return ok({ unlocked: true });
  } catch (error) {
    return handleError(error, 'promoview.unlock');
  }
}

export async function DELETE() {
  try {
    await endViewSession();
    return ok({ locked: true });
  } catch (error) {
    return handleError(error, 'promoview.lock');
  }
}
