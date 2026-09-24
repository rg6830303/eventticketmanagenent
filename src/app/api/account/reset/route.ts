import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, handleError, ok, readJson, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { resetPassword, startCustomerSession } from '@/lib/customer-auth';
import { rateLimit } from '@/lib/rate-limit';
import { passwordSchema } from '@/lib/validation';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const ip = clientIp(request.headers);
    const limit = await rateLimit(`reset:${ip ?? 'unknown'}`, 20, 900);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) {
      return fail('Use at least 8 characters', 'validation_error', 422, {
        password: ['Use at least 8 characters'],
      });
    }

    const account = await resetPassword(parsed.data.token, parsed.data.password);
    if (!account) {
      return fail('This reset link has expired or was already used. Ask for a new one.', 'bad_token', 400);
    }

    await startCustomerSession(account);
    return ok({ name: account.name, email: account.email });
  } catch (error) {
    return handleError(error, 'account.reset');
  }
}
