import type { NextRequest } from 'next/server';
import { fail, handleError, ok, tooManyRequests } from '@/lib/api';
import { getBookingByReference, markEmailSent } from '@/lib/bookings';
import { sendTicketEmail } from '@/lib/mailer';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { maskEmail } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Re-deliver the ticket email.
 *
 * Knowing a booking reference is the only authorisation, which is acceptable
 * precisely because the mail can only ever go back to the address already on
 * the booking — there is no parameter an attacker could use to redirect it.
 * The response masks that address so the endpoint cannot be used to harvest it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await params;

    const limit = await rateLimit(
      `resend:${reference.toUpperCase()}`,
      LIMITS.resend.limit,
      LIMITS.resend.window,
    );
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const detail = await getBookingByReference(reference);
    if (!detail) return fail('We could not find that booking', 'booking_not_found', 404);

    if (detail.booking.status !== 'confirmed') {
      return fail(
        'This booking is not confirmed, so there is no ticket to send yet.',
        'booking_not_confirmed',
        409,
      );
    }

    const sent = await sendTicketEmail(detail);
    if (!sent.ok) {
      return fail(
        'We could not send the email just now. Try again in a minute or contact support.',
        'email_send_failed',
        502,
      );
    }

    await markEmailSent(detail.booking.id);
    return ok({ emailSent: true, sentTo: maskEmail(detail.booking.customer_email) });
  } catch (error) {
    return handleError(error, 'bookings.resend');
  }
}
