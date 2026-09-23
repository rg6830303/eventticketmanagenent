import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import {
  createCustomerToken,
  issueToken,
  setCustomerCookie,
  signUp,
} from '@/lib/customer-auth';
import { sendAccountEmail } from '@/lib/mailer';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { fieldErrors, signUpSchema, normaliseIndianMobile } from '@/lib/validation';
import { clientIp } from '@/lib/validation.server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Create an account, or claim the guest row that already owns this address.
 *
 * The response is identical either way and never reveals whether the address
 * was already registered. "An account already exists for this email" is a
 * membership oracle, and the membership in question is a list of people who go
 * to parties in one city.
 *
 * Signing in immediately is deliberate. The account is usable straight away —
 * change a password, see the site as yourself — while the *ticket list* stays
 * behind email verification, because that is the part where getting the owner
 * wrong hands a stranger working QR passes. See /account.
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const parsed = signUpSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return fail('Please check the highlighted fields', 'validation_error', 422, fieldErrors(parsed.error));
    }

    // Honeypot: a bot fills every field it can see.
    if (parsed.data.company) return ok({ created: true });

    const ip = clientIp(request.headers);
    const limit = await rateLimit(
      `account-signup:${ip ?? 'unknown'}`,
      LIMITS.accountSignup.limit,
      LIMITS.accountSignup.window,
    );
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const phone = parsed.data.phone ? normaliseIndianMobile(parsed.data.phone) : null;

    const { customer, created } = await signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name,
      phone,
      marketingOptIn: parsed.data.marketingOptIn,
    });

    if (!customer) return fail('Could not create that account', 'signup_failed', 500);

    /*
     * An address that already had an account gets an email about it and no
     * session. Signing them in would mean a stranger who typed a known address
     * into the signup form is now logged in as its owner — which is precisely
     * the attack the identical response is meant to be hiding, handed over for
     * free.
     */
    if (!created) {
      await sendPasswordHint(customer.id, customer.email, customer.name, ip);
      return ok({ created: true, verificationSent: env.smtpConfigured });
    }

    const token = await issueToken(customer.id, 'verify_email', ip);
    const url = `${env.siteUrl}/account/verify?token=${encodeURIComponent(token)}`;

    // A failed verification email is survivable — the account exists and the
    // customer can ask for another — so it must not fail the signup.
    const mail = await sendAccountEmail({
      to: customer.email,
      name: customer.name,
      purpose: 'verify_email',
      url,
    }).catch((error) => {
      console.error('[account.signup] verification email failed', error);
      return { ok: false } as const;
    });

    await setCustomerCookie(
      await createCustomerToken({ sub: customer.id, email: customer.email, name: customer.name }),
    );

    return ok({ created: true, verificationSent: mail.ok });
  } catch (error) {
    return handleError(error, 'account.signup');
  }
}

/**
 * Tell an existing account that somebody tried to sign up as them.
 *
 * A reset link rather than a bare notice: if it was the owner, having
 * forgotten they had an account, this is exactly what they needed next.
 */
async function sendPasswordHint(
  customerId: string,
  email: string,
  name: string,
  ip: string | null,
): Promise<void> {
  try {
    const token = await issueToken(customerId, 'reset_password', ip);
    await sendAccountEmail({
      to: email,
      name,
      purpose: 'reset_password',
      url: `${env.siteUrl}/account/reset?token=${encodeURIComponent(token)}`,
    });
  } catch (error) {
    console.error('[account.signup] existing-account notice failed', error);
  }
}
