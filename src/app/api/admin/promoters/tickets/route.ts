import { after } from 'next/server';
import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson } from '@/lib/api';
import { requireSession, verifyOrigin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { getBookingByReference } from '@/lib/bookings';
import { sendTicketEmail } from '@/lib/mailer';
import { setTicketsActive } from '@/lib/promoters';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Activate or deactivate promoter passes.
 *
 * { ticketIds: string[], active: boolean, notify?: boolean }
 *
 * Activation emails the customer that the QR they already hold now works —
 * sent after the response so activating two hundred passes does not wait on
 * two hundred SMTP round trips.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const body = (await readJson(request)) as { ticketIds?: unknown; active?: unknown; notify?: unknown };
    const ids = Array.isArray(body.ticketIds)
      ? body.ticketIds.filter((v): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v))
      : [];
    if (ids.length === 0) return fail('Select at least one pass', 'no_tickets', 422);
    if (ids.length > 2000) return fail('Change at most 2,000 passes at a time', 'too_many', 422);
    if (typeof body.active !== 'boolean') return fail('Say whether to activate or deactivate', 'invalid_action', 422);

    const result = await setTicketsActive(ids, body.active, session.email);

    await recordAudit({
      actor: session,
      action: body.active ? 'promoter.tickets_activate' : 'promoter.tickets_deactivate',
      entity: 'ticket',
      metadata: { requested: ids.length, changed: result.changed },
      ipAddress: clientIp(request.headers),
    });

    if (body.active && body.notify !== false && result.activatedReferences.length > 0) {
      const references = result.activatedReferences;
      after(async () => {
        for (const reference of references) {
          try {
            const detail = await getBookingByReference(reference);
            if (detail) await sendTicketEmail(detail, { activated: true });
          } catch (error) {
            console.error('[promoters] activation email failed', reference, error);
          }
        }
      });
    }

    return ok({ changed: result.changed, emailing: body.active ? result.activatedReferences.length : 0 });
  } catch (error) {
    return handleError(error, 'admin.promoters.tickets');
  }
}
