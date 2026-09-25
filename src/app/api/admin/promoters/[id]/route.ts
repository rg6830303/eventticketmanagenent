import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson } from '@/lib/api';
import { requireSession, verifyOrigin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import {
  PromoterError,
  adjustAllocation,
  deletePromoter,
  getPromoterStats,
  recordPayment,
  updatePromoter,
} from '@/lib/promoters';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

function promoterFail(error: unknown) {
  if (error instanceof PromoterError) return fail(error.message, 'promoter_error', error.status);
  return null;
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    await requireSession('manager');
    const { id } = await params;
    const promoter = await getPromoterStats(id);
    if (!promoter) return fail('That promoter does not exist', 'not_found', 404);
    return ok({ promoter });
  } catch (error) {
    return handleError(error, 'admin.promoters.get');
  }
}

/** Edit details, suspend or re-enable, or change the login code. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);
    const { id } = await params;
    const body = (await readJson(request)) as {
      name?: string;
      phone?: string | null;
      email?: string | null;
      dealPriceRupees?: number;
      notes?: string | null;
      active?: boolean;
      code?: string;
    };

    const { code } = await updatePromoter(
      id,
      {
        name: body.name,
        phone: body.phone,
        email: body.email,
        dealPricePaise: body.dealPriceRupees === undefined ? undefined : Math.round(Number(body.dealPriceRupees) * 100),
        notes: body.notes,
        active: body.active,
        code: body.code,
      },
      session.email,
    );

    await recordAudit({
      actor: session,
      action: code ? 'promoter.code_change' : 'promoter.update',
      entity: 'promoter',
      entityId: id,
      metadata: { changed: Object.keys(body).filter((k) => k !== 'code') },
      ipAddress: clientIp(request.headers),
    });
    return ok({ code });
  } catch (error) {
    return promoterFail(error) ?? handleError(error, 'admin.promoters.update');
  }
}

/**
 * Ledger actions:
 *   { action: 'allocate', delta, note }                       give (+) or take back (−) passes
 *   { action: 'payment', amountRupees, tickets, note }        log money received from the promoter
 *   { action: 'payment_correction', amountRupees, tickets, note }  reverse a mistaken entry
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);
    const { id } = await params;
    const body = (await readJson(request)) as {
      action?: string;
      delta?: number;
      amountRupees?: number;
      tickets?: number;
      note?: string;
    };

    if (body.action === 'allocate') {
      const allocated = await adjustAllocation(id, Number(body.delta), body.note ?? null, session.email);
      await recordAudit({
        actor: session,
        action: 'promoter.allocate',
        entity: 'promoter',
        entityId: id,
        metadata: { delta: body.delta, allocated },
        ipAddress: clientIp(request.headers),
      });
      return ok({ allocated });
    }

    if (body.action === 'payment' || body.action === 'payment_correction') {
      const amountPaise = Math.round((Number(body.amountRupees) || 0) * 100);
      const tickets = Math.round(Number(body.tickets) || 0);
      await recordPayment(
        id,
        { amountPaise, tickets, note: body.note ?? null, removal: body.action === 'payment_correction' },
        session.email,
      );
      await recordAudit({
        actor: session,
        action: body.action === 'payment' ? 'promoter.payment' : 'promoter.payment_correction',
        entity: 'promoter',
        entityId: id,
        metadata: { amountPaise, tickets },
        ipAddress: clientIp(request.headers),
      });
      return ok({ recorded: true });
    }

    return fail('Unknown action', 'invalid_action', 400);
  } catch (error) {
    return promoterFail(error) ?? handleError(error, 'admin.promoters.action');
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);
    const { id } = await params;
    const deleted = await deletePromoter(id);
    if (!deleted) return fail('That promoter does not exist', 'not_found', 404);
    await recordAudit({
      actor: session,
      action: 'promoter.delete',
      entity: 'promoter',
      entityId: id,
      metadata: { name: deleted.name },
      ipAddress: clientIp(request.headers),
    });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error, 'admin.promoters.delete');
  }
}
