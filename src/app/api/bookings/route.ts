import type { NextRequest } from 'next/server';
import { created, fail, handleError, readJson, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { BookingError, createBooking, markEmailSent } from '@/lib/bookings';
import { sendTicketEmail } from '@/lib/mailer';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { createBookingSchema, fieldErrors } from '@/lib/validation';
import { checkEmailDeliverable, clientIp } from '@/lib/validation.server';
import { generateBookingReference } from '@/lib/tickets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The one endpoint that turns a stranger into an attendee.
 *
 * Ordering matters here: cheap rejections (origin, schema, honeypot) run before
 * anything that costs a database round-trip, and the DNS deliverability check
 * runs before the booking is written — an address that cannot receive mail must
 * fail loudly at booking time, not silently three seconds later when the ticket
 * bounces.
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) {
      return fail('Request blocked', 'bad_origin', 403);
    }

    const parsed = createBookingSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return fail('Please check the highlighted fields', 'validation_error', 422, fieldErrors(parsed.error));
    }
    const input = parsed.data;

    // Honeypot. Return a plausible success so scrapers get no signal about
    // which of their submissions were discarded.
    if (input.company) {
      console.warn('[bookings] honeypot triggered', { ip: clientIp(request.headers) });
      return created({
        reference: generateBookingReference(),
        status: 'confirmed',
        quantity: input.quantity,
        amountPaise: 0,
        emailSent: true,
        eventSlug: input.eventSlug,
      });
    }

    const ip = clientIp(request.headers);
    const [byIp, byEmail] = await Promise.all([
      rateLimit(`booking:ip:${ip ?? 'unknown'}`, LIMITS.booking.limit, LIMITS.booking.window),
      rateLimit(`booking:email:${input.email}`, LIMITS.bookingEmail.limit, LIMITS.bookingEmail.window),
    ]);
    if (!byIp.allowed) return tooManyRequests(byIp.retryAfterSeconds);
    if (!byEmail.allowed) {
      return fail(
        'This email already has several recent bookings. Contact us if you need more tickets.',
        'rate_limited',
        429,
      );
    }

    const deliverable = await checkEmailDeliverable(input.email);
    if (!deliverable.deliverable) {
      return fail('We could not verify that email address', 'undeliverable_email', 422, {
        email: [deliverable.reason ?? 'This address cannot receive email'],
      });
    }

    const detail = await createBooking({
      eventSlug: input.eventSlug,
      tierCode: input.tierCode,
      name: input.name,
      email: input.email,
      phone: input.phone,
      quantity: input.quantity,
      idempotencyKey: request.headers.get('Idempotency-Key'),
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
      source: 'web',
    });

    // The booking is already committed. A send failure must not roll it back or
    // surface as an error — the customer has a valid ticket either way and can
    // resend from the confirmation page.
    let emailSent = false;
    if (detail.booking.status === 'confirmed') {
      // Isolated on purpose. Past this point the booking is committed and the
      // tickets exist, so nothing the mailer does — including an unexpected
      // throw — is allowed to turn a successful booking into a 500. The
      // customer keeps their tickets and can resend from the confirmation page.
      try {
        const sent = await sendTicketEmail(detail);
        emailSent = sent.ok;
        if (sent.ok) {
          await markEmailSent(detail.booking.id);
        } else {
          console.error('[bookings] ticket email failed', {
            reference: detail.booking.reference,
            error: sent.error,
          });
        }
      } catch (mailError) {
        console.error('[bookings] ticket email threw', {
          reference: detail.booking.reference,
          error: mailError instanceof Error ? mailError.message : mailError,
        });
      }
    }

    return created({
      reference: detail.booking.reference,
      status: detail.booking.status,
      quantity: detail.booking.quantity,
      amountPaise: detail.booking.amount_paise,
      eventSlug: detail.event.slug,
      emailSent,
    });
  } catch (error) {
    if (error instanceof BookingError) {
      return fail(error.message, error.code, error.status);
    }
    return handleError(error, 'bookings.create');
  }
}
