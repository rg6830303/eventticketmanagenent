import type { NextRequest } from 'next/server';
import { created, fail, handleError, ok, readJson } from '@/lib/api';
import { requireSession, verifyOrigin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { getFeaturedEvent } from '@/lib/event-facts';
import { PromoterError, createPromoter, listPromoterStats } from '@/lib/promoters';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireSession('manager');
    return ok({ promoters: await listPromoterStats() });
  } catch (error) {
    return handleError(error, 'admin.promoters.list');
  }
}

/** Create a promoter. The login code is returned once, here, and never again. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const body = (await readJson(request)) as {
      name?: string;
      phone?: string;
      email?: string;
      code?: string;
      allocated?: number;
      dealPriceRupees?: number;
      notes?: string;
    };
    if (!body.name?.trim()) return fail('The promoter needs a name', 'invalid_name', 422);
    const allocated = Math.round(Number(body.allocated) || 0);
    if (allocated < 0 || allocated > 100000) return fail('Allocation must be between 0 and 100,000', 'invalid_allocation', 422);

    const event = await getFeaturedEvent();
    const { promoter, code } = await createPromoter({
      name: body.name,
      phone: body.phone ?? null,
      email: body.email ?? null,
      code: body.code ?? null,
      allocated,
      dealPricePaise: Math.round((Number(body.dealPriceRupees) || 0) * 100),
      notes: body.notes ?? null,
      eventId: event?.id ?? null,
      actor: session.email,
    });

    await recordAudit({
      actor: session,
      action: 'promoter.create',
      entity: 'promoter',
      entityId: promoter.id,
      metadata: { name: promoter.name, allocated },
      ipAddress: clientIp(request.headers),
    });
    return created({ promoter, code });
  } catch (error) {
    if (error instanceof PromoterError) return fail(error.message, 'promoter_error', error.status);
    return handleError(error, 'admin.promoters.create');
  }
}
