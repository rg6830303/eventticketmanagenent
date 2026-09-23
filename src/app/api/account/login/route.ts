import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { createCustomerToken, logIn, setCustomerCookie } from '@/lib/customer-auth';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { fieldErrors, logInSchema } from '@/lib/validation';
import { clientIp } from '@/lib/validation.server';
import { missingCoreConfig } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    // Same reasoning as the admin login: an unconfigured deployment otherwise
    // fails on the first query and surfaces as a generic 500.
    const missing = missingCoreConfig();
    if (missing.length > 0) {
      console.error('[account.login] deployment is not configured', { missing });
      return fail(
        'Accounts are not available on this deployment yet. Your tickets still work — the link in your confirmation email is unaffected.',
        'not_configured',
        503,
      );
    }

    const parsed = logInSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return fail('Enter your email and password', 'validation_error', 422, fieldErrors(parsed.error));
    }

    const ip = clientIp(request.headers);

    /*
     * Limited per address as well as per IP.
     *
     * The IP bucket alone is the wrong guard for this audience: a hostel or a
     * campus wifi puts hundreds of people behind one address, and a handful of
     * fumbled logins would lock out everyone else on the same network. The
     * email bucket is the one that identifies a person; the IP bucket is set
     * high and only exists to blunt a script spraying many addresses.
     */
    const [byEmail, byIp] = await Promise.all([
      rateLimit(
        `account-login:${parsed.data.email}`,
        LIMITS.accountLogin.limit,
        LIMITS.accountLogin.window,
      ),
      rateLimit(
        `account-login-ip:${ip ?? 'unknown'}`,
        LIMITS.accountLoginIp.limit,
        LIMITS.accountLoginIp.window,
      ),
    ]);
    if (!byEmail.allowed) return tooManyRequests(byEmail.retryAfterSeconds);
    if (!byIp.allowed) return tooManyRequests(byIp.retryAfterSeconds);

    const result = await logIn(parsed.data.email, parsed.data.password);
    if (!result.ok || !result.session) {
      return fail(result.error ?? 'Incorrect email or password', result.code ?? 'invalid_credentials', 401);
    }

    await setCustomerCookie(await createCustomerToken(result.session));

    return ok({
      name: result.session.name,
      email: result.session.email,
      needsVerification: Boolean(result.needsVerification),
    });
  } catch (error) {
    return handleError(error, 'account.login');
  }
}
