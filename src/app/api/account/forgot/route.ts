import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { findAccountByEmail, issueToken } from '@/lib/customer-auth';
import { sendAccountEmail } from '@/lib/mailer';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { fieldErrors, forgotPasswordSchema } from '@/lib/validation';
import { clientIp } from '@/lib/validation.server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Start a password reset.
 *
 * Always answers "if that address has an account, a link is on its way",
 * whether or not it does. Anything else turns this endpoint into a way to test
 * whether a given person has bought a ticket from us.
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const parsed = forgotPasswordSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return fail('Enter your email address', 'validation_error', 422, fieldErrors(parsed.error));
    }

    const ip = clientIp(request.headers);
    const limit = await rateLimit(
      `account-forgot:${parsed.data.email}`,
      LIMITS.accountReset.limit,
      LIMITS.accountReset.window,
    );
    // Even the rate-limit response has to be uniform, or the 429 itself says
    // "this address exists and somebody is hammering it". It is keyed on the
    // address either way, so a miss costs an attacker the same as a hit.
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const account = await findAccountByEmail(parsed.data.email);

    if (account) {
      const token = await issueToken(account.id, 'reset_password', ip);
      const url = `${env.siteUrl}/account/reset?token=${encodeURIComponent(token)}`;

      // Logged, not surfaced: telling the browser the send failed would
      // confirm the address exists.
      await sendAccountEmail({
        to: account.email,
        name: account.name,
        purpose: 'reset_password',
        url,
      }).catch((error) => {
        console.error('[account.forgot] reset email failed', error);
      });
    }

    return ok({ sent: true });
  } catch (error) {
    return handleError(error, 'account.forgot');
  }
}
