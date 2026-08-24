import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson, tooManyRequests } from '@/lib/api';
import { createSessionToken, login, setSessionCookie, verifyOrigin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { adminLoginSchema, fieldErrors } from '@/lib/validation';
import { missingCoreConfig } from '@/lib/env';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    // An unconfigured deployment fails on the first database call and surfaces
    // as the generic "something went wrong" 500, which sends an operator
    // hunting through logs for a missing environment variable. Name it instead.
    //
    // This is not a leak worth worrying about: /api/health already reports the
    // same fact publicly, and a deployment with no database has no secrets in
    // it to protect yet.
    const missing = missingCoreConfig();
    if (missing.length > 0) {
      console.error('[admin.login] deployment is not configured', { missing });
      return fail(
        `This deployment is not configured yet — ${missing.join(', ')} ${
          missing.length === 1 ? 'is' : 'are'
        } not set in the hosting environment. Sign-in cannot work until that is fixed.`,
        'not_configured',
        503,
      );
    }

    const parsed = adminLoginSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return fail('Enter your email and password', 'validation_error', 422, fieldErrors(parsed.error));
    }

    const ip = clientIp(request.headers);
    const limit = await rateLimit(
      `admin-login:${ip ?? 'unknown'}`,
      LIMITS.adminLogin.limit,
      LIMITS.adminLogin.window,
    );
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const result = await login(parsed.data.email, parsed.data.password);
    if (!result.ok || !result.session) {
      // `login` already returns a message that reveals nothing about whether
      // the account exists.
      return fail(result.error ?? 'Incorrect email or password', 'invalid_credentials', 401);
    }

    await setSessionCookie(await createSessionToken(result.session));
    await recordAudit({ actor: result.session, action: 'admin.login', ipAddress: ip });

    return ok({ name: result.session.name, role: result.session.role });
  } catch (error) {
    return handleError(error, 'admin.login');
  }
}
