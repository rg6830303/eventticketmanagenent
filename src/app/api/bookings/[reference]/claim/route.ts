import type { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { queryOne } from '@/lib/db';
import { env } from '@/lib/env';
import { reconcileBooking } from '@/lib/payments';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import type { BookingRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Has this booking been paid yet?" — asked by the customer's own browser.
 *
 * Delivery used to hang entirely on Razorpay's `handler` callback firing in the
 * page that opened the modal. On a phone that callback is genuinely unreliable:
 * paying by UPI backgrounds the browser to open GPay or PhonePe, and an in-app
 * webview — Instagram's especially, which is where most of this traffic comes
 * from — is often evicted while it sits there. The customer pays, comes back to
 * a reloaded page, and nothing ever tells the server the money arrived.
 *
 * So the browser is no longer the only witness. This endpoint asks Razorpay's
 * API directly about that one order and, if there is a captured payment,
 * confirms the booking and sends the passes. It is what the pay page calls
 * while it waits and the moment it regains focus.
 *
 * Nothing here trusts the caller. The reference names a booking; whether money
 * exists is decided by an authenticated call to Razorpay and nothing else, so
 * the worst a stranger with a valid reference can do is make us ask a question
 * we already answer on a timer.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  try {
    const { reference } = await context.params;

    // Metered per booking rather than per IP, and that distinction matters
    // here: this crowd books from college wifi, so a whole hall shares one
    // address and an IP-keyed limit would throttle everyone the moment two
    // people paid at once. A reference polls only for itself.
    const key = String(reference).toUpperCase();
    const limited = await rateLimit(`claim:${key}`, LIMITS.claim.limit, LIMITS.claim.window);
    if (!limited.allowed) {
      return ok({ status: 'unknown', throttled: true });
    }

    const booking = await queryOne<BookingRow>('SELECT * FROM bookings WHERE reference = $1', [
      key,
    ]);
    if (!booking) return fail('We could not find that booking', 'booking_not_found', 404);

    if (booking.status === 'confirmed') {
      return ok({
        status: 'confirmed',
        reference: booking.reference,
        emailSent: booking.email_sent_at !== null,
      });
    }
    if (booking.status !== 'pending') {
      return ok({ status: booking.status, reference: booking.reference });
    }
    if (env.paymentProvider !== 'razorpay') {
      return ok({ status: 'pending', reference: booking.reference });
    }

    const result = await reconcileBooking(booking);

    return ok({
      status: result.outcome === 'paid' ? 'confirmed' : 'pending',
      reference: booking.reference,
      emailSent: result.emailSent ?? false,
      outcome: result.outcome,
    });
  } catch (error) {
    return handleError(error, 'bookings.claim');
  }
}
