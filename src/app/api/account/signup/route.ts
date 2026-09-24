import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { created, fail, handleError, readJson, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { signUp, startCustomerSession } from '@/lib/customer-auth';
import { sendWelcomeEmail } from '@/lib/mailer';
import { rateLimit } from '@/lib/rate-limit';
import { emailSchema, fieldErrors, nameSchema, passwordSchema, phoneSchema } from '@/lib/validation';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const ip = clientIp(request.headers);
    const limit = await rateLimit(`signup:${ip ?? 'unknown'}`, 30, 3600);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) {
      return fail('Please check the highlighted fields', 'validation_error', 422, fieldErrors(parsed.error));
    }

    const outcome = await signUp(parsed.data);
    if (!outcome.ok) {
      return fail('An account with this email already exists. Sign in instead.', 'account_exists', 409, {
        email: ['An account with this email already exists'],
      });
    }

    await startCustomerSession(outcome.account);

    // A welcome that fails to send must not fail the signup: the account exists
    // and the customer is signed in either way.
    try {
      await sendWelcomeEmail({ to: outcome.account.email, name: outcome.account.name });
    } catch (mailError) {
      console.error('[account] welcome email threw', mailError);
    }

    return created({ name: outcome.account.name, email: outcome.account.email });
  } catch (error) {
    return handleError(error, 'account.signup');
  }
}
