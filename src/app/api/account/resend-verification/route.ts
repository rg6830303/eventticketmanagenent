import type { NextRequest } from 'next/server';
import { fail, handleError, ok, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { getCurrentCustomer, issueToken } from '@/lib/customer-auth';
import { sendAccountEmail } from '@/lib/mailer';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/validation.server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Send another verification link to the signed-in customer's own address. */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const customer = await getCurrentCustomer();
    if (!customer) return fail('Sign in first', 'unauthorized', 401);
    if (customer.email_verified_at) return ok({ sent: false, alreadyVerified: true });

    const limit = await rateLimit(
      `account-verify-resend:${customer.id}`,
      LIMITS.accountReset.limit,
      LIMITS.accountReset.window,
    );
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const token = await issueToken(customer.id, 'verify_email', clientIp(request.headers));
    const result = await sendAccountEmail({
      to: customer.email,
      name: customer.name,
      purpose: 'verify_email',
      url: `${env.siteUrl}/account/verify?token=${encodeURIComponent(token)}`,
    });

    if (!result.ok) {
      return fail(
        'We could not send that email just now. Try again in a minute.',
        'mail_failed',
        502,
      );
    }

    return ok({ sent: true });
  } catch (error) {
    return handleError(error, 'account.resend');
  }
}
