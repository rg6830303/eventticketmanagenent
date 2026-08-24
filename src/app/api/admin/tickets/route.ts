import type { NextRequest } from 'next/server';
import { created, fail, handleError, ok, readJson } from '@/lib/api';
import { requireSession, verifyOrigin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { clientIp } from '@/lib/validation.server';
import { BookingError, issueBookingManually, listIssuedBookings, markEmailSent } from '@/lib/bookings';
import { sendTicketEmail } from '@/lib/mailer';
import { emailSchema, nameSchema, phoneSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Recently issued-by-hand passes. */
export async function GET() {
  try {
    await requireSession('manager');
    return ok({ issued: await listIssuedBookings(30) });
  } catch (error) {
    return handleError(error, 'admin.tickets.list');
  }
}

/**
 * Issue passes by hand and email them.
 *
 * Manager and above: this mints valid entry passes without anybody paying, which
 * is a commercial decision rather than a door one. Every issue is written to the
 * audit log with the operator's identity, and the booking's notes carry it too —
 * a comp with no name attached is indistinguishable from a mistake.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const body = (await readJson(request)) as {
      eventSlug?: string;
      name?: string;
      email?: string;
      phone?: string;
      tierCode?: string | null;
      customLabel?: string | null;
      quantity?: number;
      admits?: number;
      amountRupees?: number;
      note?: string | null;
      sendEmail?: boolean;
    };

    // The same validators the public checkout uses, so a pass issued by hand
    // cannot carry an address the ticket email will never reach.
    const name = nameSchema.safeParse(body.name);
    if (!name.success) return fail(name.error.issues[0].message, 'invalid_name', 422);

    const email = emailSchema.safeParse(body.email);
    if (!email.success) return fail(email.error.issues[0].message, 'invalid_email', 422);

    const phone = phoneSchema.safeParse(body.phone);
    if (!phone.success) return fail(phone.error.issues[0].message, 'invalid_phone', 422);

    const quantity = Math.round(Number(body.quantity) || 1);
    if (quantity < 1 || quantity > 50) {
      return fail('Issue between 1 and 50 passes at a time', 'invalid_quantity', 422);
    }

    const detail = await issueBookingManually({
      eventSlug: body.eventSlug || 'offcampus',
      name: name.data,
      email: email.data,
      phone: phone.data,
      tierCode: body.tierCode || null,
      customLabel: body.customLabel ?? null,
      quantity,
      admits: Math.max(1, Math.round(Number(body.admits) || 1)),
      amountPaise: Math.max(0, Math.round(Number(body.amountRupees ?? 0) * 100)),
      note: body.note ?? null,
      issuedBy: session.sub,
      issuedByEmail: session.email,
    });

    await recordAudit({
      actor: session,
      action: 'ticket.issue',
      entity: 'booking',
      entityId: detail.booking.reference,
      metadata: {
        quantity,
        amountPaise: detail.booking.amount_paise,
        recipient: detail.booking.customer_email,
        tier: detail.items[0]?.tier_name ?? null,
      },
      ipAddress: clientIp(request.headers),
    });

    // Delivery is reported separately from issuance. The passes exist and are
    // valid at the door whether or not the email lands, and conflating the two
    // would make a bounced address look like a failed issue.
    let emailSent = false;
    let emailError: string | null = null;

    if (body.sendEmail !== false) {
      const sent = await sendTicketEmail(detail);
      if (sent.ok) {
        await markEmailSent(detail.booking.id);
        emailSent = true;
      } else {
        emailError = sent.error ?? 'The email could not be sent';
      }
    }

    return created({
      reference: detail.booking.reference,
      quantity: detail.booking.quantity,
      amountPaise: detail.booking.amount_paise,
      tierName: detail.items[0]?.tier_name ?? null,
      tickets: detail.tickets.map((ticket) => ({
        code: ticket.code,
        admits: ticket.admits,
        holderName: ticket.holder_name,
      })),
      emailSent,
      emailError,
      sentTo: detail.booking.customer_email,
    });
  } catch (error) {
    if (error instanceof BookingError) return fail(error.message, error.code, error.status);
    return handleError(error, 'admin.tickets.issue');
  }
}
