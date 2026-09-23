import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import {
  consumeToken,
  createCustomerToken,
  markEmailVerified,
  setCustomerCookie,
  setPassword,
} from '@/lib/customer-auth';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { fieldErrors, resetPasswordSchema } from '@/lib/validation';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Finish a password reset.
 *
 * Completing one also verifies the address, and that is not a shortcut: the
 * token was only ever readable from that mailbox, which is the exact proof
 * verification asks for. Making somebody who has just proved control of an
 * inbox then click a second link from the same inbox is ceremony.
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const parsed = resetPasswordSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return fail('Choose a longer password', 'validation_error', 422, fieldErrors(parsed.error));
    }

    const ip = clientIp(request.headers);
    const limit = await rateLimit(
      `account-reset:${ip ?? 'unknown'}`,
      LIMITS.accountReset.limit,
      LIMITS.accountReset.window,
    );
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const customer = await consumeToken(parsed.data.token, 'reset_password');
    if (!customer) {
      return fail(
        'That link has expired or has already been used. Ask for a new one.',
        'invalid_token',
        400,
      );
    }

    await setPassword(customer.id, parsed.data.password);
    await markEmailVerified(customer.id);

    // Signed in on the spot: they have just proved mailbox control and chosen
    // a password, so a login form here is a step that asks them to type what
    // they typed ten seconds ago.
    await setCustomerCookie(
      await createCustomerToken({ sub: customer.id, email: customer.email, name: customer.name }),
    );

    return ok({ reset: true, name: customer.name });
  } catch (error) {
    return handleError(error, 'account.reset');
  }
}
