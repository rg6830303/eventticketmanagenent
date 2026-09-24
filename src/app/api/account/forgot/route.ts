import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, handleError, ok, readJson, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { RESET_LINK_MINUTES, createPasswordReset } from '@/lib/customer-auth';
import { env } from '@/lib/env';
import { sendPasswordResetEmail } from '@/lib/mailer';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email') });

/**
 * Forgot password.
 *
 * Answers the same way whether or not the address has an account, so this form
 * cannot be used to find out who is registered. The link goes out through the
 * same Gmail SMTP as the tickets and is recorded in email_log.
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) return fail('Enter a valid email', 'validation_error', 422);

    const ip = clientIp(request.headers);
    const [byIp, byEmail] = await Promise.all([
      rateLimit(`forgot:ip:${ip ?? 'unknown'}`, 20, 3600),
      rateLimit(`forgot:email:${parsed.data.email}`, 4, 3600),
    ]);
    if (!byIp.allowed) return tooManyRequests(byIp.retryAfterSeconds);

    if (byEmail.allowed) {
      const reset = await createPasswordReset(parsed.data.email);
      if (reset) {
        const resetUrl = `${env.siteUrl}/reset-password?token=${encodeURIComponent(reset.token)}`;
        const sent = await sendPasswordResetEmail({
          to: reset.account.email,
          name: reset.account.name,
          resetUrl,
          minutes: RESET_LINK_MINUTES,
        });
        if (!sent.ok) {
          console.error('[account] reset email failed', { error: sent.error });
          return fail('We could not send the email right now. Try again in a minute.', 'send_failed', 502);
        }
      }
    }

    return ok({ sent: true });
  } catch (error) {
    return handleError(error, 'account.forgot');
  }
}
