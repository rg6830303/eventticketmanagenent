import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import {
  consumeToken,
  createCustomerToken,
  markEmailVerified,
  setCustomerCookie,
} from '@/lib/customer-auth';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Confirm an email address.
 *
 * POST rather than GET, because mail scanners and link-preview bots follow
 * every GET in a message. A verification that happens when Outlook's safe-links
 * crawler touches the URL is not a verification, and it would spend the token
 * before the customer ever clicked. The page at /account/verify posts this on
 * the customer's behalf.
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const body = (await readJson(request)) as { token?: unknown };
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token) return fail('This link is not valid', 'invalid_token', 400);

    const ip = clientIp(request.headers);
    const limit = await rateLimit(
      `account-verify:${ip ?? 'unknown'}`,
      LIMITS.accountReset.limit,
      LIMITS.accountReset.window,
    );
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const customer = await consumeToken(token, 'verify_email');
    if (!customer) {
      return fail(
        'That link has expired or has already been used. Sign in and ask for a new one.',
        'invalid_token',
        400,
      );
    }

    await markEmailVerified(customer.id);

    // Clicking the link in a different browser than the one that signed up is
    // the normal case — phone mail app, desktop signup. Issuing a session here
    // means verification lands them signed in wherever they opened it.
    await setCustomerCookie(
      await createCustomerToken({ sub: customer.id, email: customer.email, name: customer.name }),
    );

    return ok({ verified: true, name: customer.name });
  } catch (error) {
    return handleError(error, 'account.verify');
  }
}
