import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson } from '@/lib/api';
import { requireSession, verifyOrigin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { BookingError, markEmailSent } from '@/lib/bookings';
import { sendTicketEmail } from '@/lib/mailer';
import { approveUpiClaim, rejectUpiClaim } from '@/lib/upi-claims';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Release or refuse a UPI payment claim.
 *
 * This is where a UPI booking actually becomes paid, and it is gated on a
 * manager session on purpose: the customer's UTR is a claim, and an operator
 * looking at the receiving account is the only thing that turns it into a
 * fact. Approval runs the same confirm-and-mint transaction the gateway does,
 * so a pass issued here is identical to a Razorpay one.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const { id } = await params;
    const body = (await readJson(request)) as { action?: string; note?: string };

    if (body.action === 'reject') {
      const result = await rejectUpiClaim(id, session.sub, body.note?.slice(0, 500) ?? null);
      await recordAudit({
        actor: session,
        action: 'upi.claim.reject',
        entity: 'upi_claim',
        entityId: id,
        metadata: { reference: result.reference, note: body.note ?? null },
        ipAddress: clientIp(request.headers),
      });
      return ok({ status: 'rejected', reference: result.reference });
    }

    if (body.action !== 'approve') {
      return fail('Unknown action', 'bad_action', 400);
    }

    const detail = await approveUpiClaim(id, session.sub);

    // The booking and its passes are already committed. A mail failure must not
    // roll that back or read as a failed approval — the customer holds valid
    // tickets either way and can resend from their booking page.
    let emailSent = false;
    try {
      const sent = await sendTicketEmail(detail);
      emailSent = sent.ok;
      if (sent.ok) await markEmailSent(detail.booking.id);
    } catch (mailError) {
      console.error('[upi] ticket email threw after approval', {
        reference: detail.booking.reference,
        error: mailError instanceof Error ? mailError.message : mailError,
      });
    }

    await recordAudit({
      actor: session,
      action: 'upi.claim.approve',
      entity: 'upi_claim',
      entityId: id,
      metadata: {
        reference: detail.booking.reference,
        amountPaise: detail.booking.amount_paise,
        emailSent,
      },
      ipAddress: clientIp(request.headers),
    });

    return ok({
      status: 'approved',
      reference: detail.booking.reference,
      ticketsIssued: detail.tickets.length,
      emailSent,
    });
  } catch (error) {
    if (error instanceof BookingError) {
      return fail(error.message, error.code, error.status);
    }
    return handleError(error, 'admin.upi.review');
  }
}
