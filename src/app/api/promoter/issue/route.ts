import type { NextRequest } from 'next/server';
import { created, fail, handleError, readJson, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { BookingError, issueBookingManually, markEmailSent } from '@/lib/bookings';
import { getFeaturedEvent } from '@/lib/event-facts';
import { sendTicketEmail } from '@/lib/mailer';
import { getSignedInPromoter, logActivity } from '@/lib/promoters';
import { rateLimit } from '@/lib/rate-limit';
import { emailSchema, nameSchema, phoneSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Most passes one customer can be issued in one go. */
const MAX_PER_ISSUE = 10;

/**
 * A promoter issues passes to a customer.
 *
 * The allocation check and the mint happen in one transaction under a lock on
 * the promoter row (see issueBookingManually), so the promoter can never issue
 * more than they were given, even from two phones at once. The passes are
 * minted inactive and emailed straight away with a "pending activation" notice.
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);
    const promoter = await getSignedInPromoter();
    if (!promoter) return fail('Your session has ended. Sign in again with your code.', 'unauthenticated', 401);

    const limit = await rateLimit(`promoter-issue:${promoter.id}`, 120, 600);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const body = (await readJson(request)) as { name?: string; email?: string; phone?: string; quantity?: number };
    const name = nameSchema.safeParse(body.name);
    if (!name.success) return fail(name.error.issues[0].message, 'invalid_name', 422, { name: [name.error.issues[0].message] });
    const email = emailSchema.safeParse(body.email);
    if (!email.success) return fail(email.error.issues[0].message, 'invalid_email', 422, { email: [email.error.issues[0].message] });
    const phone = phoneSchema.safeParse(body.phone);
    if (!phone.success) return fail(phone.error.issues[0].message, 'invalid_phone', 422, { phone: [phone.error.issues[0].message] });

    const quantity = Math.round(Number(body.quantity) || 1);
    if (quantity < 1 || quantity > MAX_PER_ISSUE) {
      return fail(`Issue between 1 and ${MAX_PER_ISSUE} passes per customer`, 'invalid_quantity', 422);
    }

    const event = await getFeaturedEvent();
    if (!event) return fail('There is no event to issue passes for right now', 'no_event', 409);

    const detail = await issueBookingManually({
      eventSlug: event.slug,
      name: name.data,
      email: email.data,
      phone: phone.data,
      tierCode: null,
      customLabel: 'Entry pass',
      quantity,
      admits: 1,
      amountPaise: 0,
      note: null,
      issuedBy: promoter.id,
      issuedByEmail: promoter.name,
      promoterId: promoter.id,
    });

    await logActivity(promoter.id, 'issued', {
      quantity,
      reference: detail.booking.reference,
      note: `${name.data} · ${email.data} · ${phone.data}`,
      actor: `promoter:${promoter.name}`,
    });

    // Sent now, while the promoter waits: they are usually standing next to
    // the customer, and "it's in your inbox" is the whole sale.
    let emailSent = false;
    const sent = await sendTicketEmail(detail);
    if (sent.ok) {
      await markEmailSent(detail.booking.id);
      emailSent = true;
    }

    return created({
      reference: detail.booking.reference,
      codes: detail.tickets.map((t) => t.code),
      sentTo: detail.booking.customer_email,
      emailSent,
    });
  } catch (error) {
    if (error instanceof BookingError) return fail(error.message, error.code, error.status);
    return handleError(error, 'promoter.issue');
  }
}
