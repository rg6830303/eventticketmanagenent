import type { NextRequest } from 'next/server';
import { corsPreflight, withCors } from '@/lib/cors';
import { fail, handleError, ok, readJson, tooManyRequests } from '@/lib/api';
import { issueDoorToken, verifyDoorPassword } from '@/lib/door-auth';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The app's page is bundled into the APK and served from the WebView's own
 * origin, so this call is cross-origin and the browser asks permission before
 * making it. Without an answer here the real request is never sent.
 */
export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}

/**
 * Door scanner sign-in. One password, no username.
 *
 * No origin check, because the callers are an Android app and a browser and
 * neither sends an Origin this server could usefully pin. The password is the
 * whole of the authorisation, so it is rate limited hard: a single shared
 * secret typed into a phone is exactly the thing worth guessing at, and the
 * limit is what turns "guess it" into "give up".
 */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request.headers);
    const limit = await rateLimit(
      `door-login:${ip ?? 'unknown'}`,
      LIMITS.adminLogin.limit,
      LIMITS.adminLogin.window,
    );
    if (!limit.allowed) return withCors(tooManyRequests(limit.retryAfterSeconds), request);

    const body = (await readJson(request)) as { password?: string };
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password) return withCors(fail('Enter the access code', 'missing_password', 422), request);

    if (!(await verifyDoorPassword(password))) {
      return withCors(fail('That access code is not right', 'bad_password', 401), request);
    }

    const { token, expiresAt } = await issueDoorToken();
    return withCors(ok({ token, expiresAt }), request);
  } catch (error) {
    return withCors(handleError(error, 'door.login'), request);
  }
}
