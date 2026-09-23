import { revalidatePath } from 'next/cache';
import type { NextRequest } from 'next/server';
import { created, fail, handleError, readJson } from '@/lib/api';
import { requireSession, verifyOrigin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { queryOne } from '@/lib/db';
import { clientIp } from '@/lib/validation.server';
import type { EventRow, TicketTierRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Add a pass to an event.
 *
 * Only creation lives here. Editing an existing tier — price, cover, admits —
 * stays on /api/admin/prices, which already carries the repricing of unpaid
 * carts that a price change has to trigger. Splitting that logic across two
 * endpoints is how one of them ends up not doing it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const { id } = await params;
    const event = await queryOne<EventRow>('SELECT * FROM events WHERE id = $1', [id]);
    if (!event) return fail('That event no longer exists', 'not_found', 404);

    const body = (await readJson(request)) as {
      code?: string;
      name?: string;
      description?: string | null;
      priceRupees?: number;
      coverRupees?: number;
      quantity?: number;
      admits?: number;
      priceUnit?: string;
      perks?: string[];
    };

    const code = body.code?.trim().toUpperCase();
    if (!code || !/^[A-Z0-9_-]{2,20}$/.test(code)) {
      return fail('A pass code is 2–20 letters, digits, dashes or underscores', 'invalid_code', 422);
    }

    const name = body.name?.trim();
    if (!name) return fail('The pass needs a name', 'invalid_name', 422);

    const pricePaise = Math.round((body.priceRupees ?? 0) * 100);
    const coverPaise = Math.round((body.coverRupees ?? 0) * 100);
    const quantity = Math.round(body.quantity ?? 0);
    const admits = Math.round(body.admits ?? 1);

    if (!Number.isFinite(pricePaise) || pricePaise < 0) {
      return fail('The price must be zero or more', 'invalid_price', 422);
    }
    if (!Number.isFinite(coverPaise) || coverPaise < 0) {
      return fail('The cover must be zero or more', 'invalid_cover', 422);
    }
    // A cover worth more than the pass means the venue pays people to attend.
    if (pricePaise > 0 && coverPaise > pricePaise) {
      return fail('The cover cannot exceed the price', 'cover_exceeds_price', 422);
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      return fail('How many of this pass are for sale?', 'invalid_quantity', 422);
    }
    if (!Number.isFinite(admits) || admits < 1 || admits > 50) {
      return fail('A pass must admit between 1 and 50 people', 'invalid_admits', 422);
    }

    const clash = await queryOne<{ id: string }>(
      'SELECT id FROM ticket_tiers WHERE event_id = $1 AND code = $2',
      [id, code],
    );
    if (clash) return fail(`This event already has a ${code} pass`, 'code_taken', 409);

    const perks =
      body.perks && body.perks.length > 0
        ? body.perks
        : [
            `Admits ${admits} ${admits === 1 ? 'guest' : 'guests'}`,
            coverPaise > 0
              ? `₹${(coverPaise / 100).toLocaleString('en-IN')} cover redeemable`
              : 'Zero redeemable · entry only',
          ];

    const tier = await queryOne<TicketTierRow>(
      `INSERT INTO ticket_tiers (
         event_id, code, name, description, price_paise, redeemable_paise,
         quantity, admits, price_unit, perks, sort_order, active
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,
               COALESCE((SELECT max(sort_order) + 1 FROM ticket_tiers WHERE event_id = $1), 1),
               true)
       RETURNING *`,
      [
        id,
        code,
        name,
        body.description?.trim() || null,
        pricePaise,
        coverPaise,
        quantity,
        admits,
        body.priceUnit?.trim() || '/ pass',
        JSON.stringify(perks),
      ],
    );

    await recordAudit({
      actor: session,
      action: 'tier.create',
      entity: 'ticket_tier',
      entityId: tier!.id,
      metadata: { eventSlug: event.slug, code, pricePaise, quantity },
      ipAddress: clientIp(request.headers),
    });

    for (const path of ['/', '/events', '/cart', '/book']) revalidatePath(path);
    revalidatePath('/events/[slug]', 'page');

    return created({ tier });
  } catch (error) {
    return handleError(error, 'admin.events.tiers.create');
  }
}
