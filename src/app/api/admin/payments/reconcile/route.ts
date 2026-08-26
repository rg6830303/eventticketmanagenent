import type { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api';
import { requireSession, verifyOrigin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { clientIp } from '@/lib/validation.server';
import { reconcilePending } from '@/lib/payments';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sweep pending bookings for payments that were actually made.
 *
 * This is the webhook's job done by asking rather than being told. Without a
 * webhook secret there is no push notification, so a customer who pays and
 * closes the tab before the browser confirms would otherwise sit `pending`
 * forever with their money taken.
 *
 * Manager and above: it confirms bookings and sends tickets.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const results = await reconcilePending(72);
    const paid = results.filter((r) => r.outcome === 'paid');

    if (paid.length > 0) {
      await recordAudit({
        actor: session,
        action: 'payments.reconcile',
        entity: 'booking',
        entityId: paid.map((r) => r.reference).join(','),
        metadata: { recovered: paid.length },
        ipAddress: clientIp(request.headers),
      });
    }

    return ok({
      checked: results.length,
      recovered: paid.length,
      references: paid.map((r) => r.reference),
      errors: results.filter((r) => r.outcome === 'error').map((r) => `${r.reference}: ${r.message}`),
    });
  } catch (error) {
    return handleError(error, 'admin.payments.reconcile');
  }
}
