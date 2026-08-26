import type { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { requireSession, verifyOrigin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { clientIp } from '@/lib/validation.server';
import { sendUndeliveredTickets, undeliveredTickets } from '@/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Paid customers still waiting for their pass. Should always be empty. */
export async function GET() {
  try {
    await requireSession('manager');
    const rows = await undeliveredTickets();
    return ok({ count: rows.length, bookings: rows });
  } catch (error) {
    return handleError(error, 'admin.tickets.undelivered');
  }
}

/** Send every outstanding one. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const result = await sendUndeliveredTickets();

    if (result.sent > 0) {
      await recordAudit({
        actor: session,
        action: 'tickets.resend_undelivered',
        entity: 'booking',
        entityId: String(result.sent),
        metadata: { attempted: result.attempted, sent: result.sent },
        ipAddress: clientIp(request.headers),
      });
    }

    return ok(result);
  } catch (error) {
    return handleError(error, 'admin.tickets.resend_undelivered');
  }
}
