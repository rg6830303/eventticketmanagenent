import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, handleError, ok, readJson, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { signIn, startCustomerSession } from '@/lib/customer-auth';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password').max(128),
});

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) return fail('Enter your email and password', 'validation_error', 422);

    // Keyed on the address as well as the IP: a campus wifi full of people
    // signing in must not lock itself out, and one account must not be
    // guessable from many addresses.
    const ip = clientIp(request.headers);
    const [byIp, byEmail] = await Promise.all([
      rateLimit(`customer-login:ip:${ip ?? 'unknown'}`, 60, 900),
      rateLimit(`customer-login:email:${parsed.data.email}`, 10, 900),
    ]);
    if (!byIp.allowed) return tooManyRequests(byIp.retryAfterSeconds);
    if (!byEmail.allowed) return tooManyRequests(byEmail.retryAfterSeconds);

    const account = await signIn(parsed.data.email, parsed.data.password);
    if (!account) return fail('That email and password do not match', 'bad_credentials', 401);

    await startCustomerSession(account);
    return ok({ name: account.name, email: account.email });
  } catch (error) {
    return handleError(error, 'account.login');
  }
}
