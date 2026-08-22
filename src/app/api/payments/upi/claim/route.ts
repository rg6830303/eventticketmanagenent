import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { created, fail, handleError, readJson } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { BookingError } from '@/lib/bookings';
import { env } from '@/lib/env';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { submitUpiClaim } from '@/lib/upi-claims';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const claimSchema = z.object({
  reference: z.string().trim().min(4).max(32),
  // Kept loose here on purpose — the server normalises to digits and enforces
  // the real rule, so a pasted "UTR: 1234 5678 9012" is accepted rather than
  // bounced on formatting the customer did not choose.
  utr: z.string().trim().min(1).max(40),
});

/**
 * Record a customer's declaration that they paid by UPI.
 *
 * This endpoint deliberately cannot confirm a booking. It writes down a UTR,
 * an amount and a timestamp, and puts the order in front of a human. Anyone
 * can type twelve digits; only the operator can see the money.
 *
 * Rate limited per IP because the one control that does exist — a UTR may back
 * only one live booking — is otherwise enumerable by a script.
 */
export async function POST(request: NextRequest) {
  try {
    if (!env.upi.enabled) {
      return fail('UPI payment is not available right now', 'upi_disabled', 503);
    }
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const ip = clientIp(request.headers);
    const limited = await rateLimit(
      `upi-claim:${ip ?? 'unknown'}`,
      LIMITS.upiClaim.limit,
      LIMITS.upiClaim.window,
    );
    if (!limited.allowed) {
      return fail('Too many attempts. Wait a minute and try again.', 'rate_limited', 429);
    }

    const parsed = claimSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return fail('Enter your booking reference and the 12-digit UTR', 'validation_error', 422);
    }

    const result = await submitUpiClaim({
      reference: parsed.data.reference,
      utr: parsed.data.utr,
      vpa: env.upi.vpa,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return created(result);
  } catch (error) {
    if (error instanceof BookingError) {
      return fail(error.message, error.code, error.status);
    }
    return handleError(error, 'payments.upi.claim');
  }
}
