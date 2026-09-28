import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson } from '@/lib/api';
import { requireSession, verifyOrigin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { PromoterError, reversePromoterSales, setTicketsActive } from '@/lib/promoters';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Activate or deactivate promoter passes.
 *
 * { ticketIds: string[], active: boolean }      switch passes on or off
 * { ticketIds: string[], action: 'reverse' }     undo promoter sales entirely
 *
 * Silent on purpose: switching a pass on and off must not spam the customer.
 * The QR they already hold is checked live at the door, and the pass link in
 * their email shows its current state (pending, active, deactivated, admitted).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const body = (await readJson(request)) as { ticketIds?: unknown; active?: unknown; action?: unknown };
    const ids = Array.isArray(body.ticketIds)
      ? body.ticketIds.filter((v): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v))
      : [];
    if (ids.length === 0) return fail('Select at least one pass', 'no_tickets', 422);
    if (ids.length > 2000) return fail('Change at most 2,000 passes at a time', 'too_many', 422);

    if (body.action === 'reverse') {
      try {
        const result = await reversePromoterSales(ids, session.email);
        await recordAudit({
          actor: session,
          action: 'promoter.sale_reverse',
          entity: 'ticket',
          metadata: { reversed: result.reversed },
          ipAddress: clientIp(request.headers),
        });
        return ok({ reversed: result.reversed.length, serials: result.reversed.map((r) => r.serial) });
      } catch (error) {
        if (error instanceof PromoterError) return fail(error.message, 'reverse_refused', error.status);
        throw error;
      }
    }

    if (typeof body.active !== 'boolean') return fail('Say whether to activate or deactivate', 'invalid_action', 422);

    const result = await setTicketsActive(ids, body.active, session.email);

    await recordAudit({
      actor: session,
      action: body.active ? 'promoter.tickets_activate' : 'promoter.tickets_deactivate',
      entity: 'ticket',
      metadata: { requested: ids.length, changed: result.changed },
      ipAddress: clientIp(request.headers),
    });

    return ok({ changed: result.changed });
  } catch (error) {
    return handleError(error, 'admin.promoters.tickets');
  }
}
