import { revalidatePath } from 'next/cache';
import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson } from '@/lib/api';
import { requireSession, verifyOrigin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { query, queryOne } from '@/lib/db';
import { repricePendingBookings } from '@/lib/reprice';
import { clientIp } from '@/lib/validation.server';
import type { TicketTierRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TierWithUnit = TicketTierRow & { price_unit: string; sold: number };

/** ₹1,300 — matches how the storefront renders money. */
function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

/**
 * Ticket prices.
 *
 * Manager and above: this is the number customers are charged.
 *
 * Editing a tier changes what every future booking costs and never touches a
 * past one — `booking_items` snapshots the price and admit count at purchase,
 * so a receipt always says what was actually paid. That separation is the whole
 * reason repricing is safe to do mid-sale.
 */
export async function GET() {
  try {
    await requireSession('manager');

    const tiers = await query<
      TierWithUnit & { confirmed: number; pending: number; event_name: string; event_slug: string }
    >(
      `SELECT t.*,
              e.name AS event_name,
              e.slug AS event_slug,
              (SELECT COALESCE(SUM(bi.quantity), 0)::int FROM booking_items bi
                 JOIN bookings b ON b.id = bi.booking_id
                WHERE bi.tier_id = t.id AND b.status = 'confirmed') AS confirmed,
              (SELECT COALESCE(SUM(bi.quantity), 0)::int FROM booking_items bi
                 JOIN bookings b ON b.id = bi.booking_id
                WHERE bi.tier_id = t.id AND b.status = 'pending') AS pending
         FROM ticket_tiers t
         JOIN events e ON e.id = t.event_id
        ORDER BY e.starts_at DESC, t.active DESC, t.sort_order ASC, t.price_paise ASC`,
    );

    return ok({ tiers });
  } catch (error) {
    return handleError(error, 'admin.prices.list');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const body = (await readJson(request)) as {
      id?: string;
      code?: string;
      name?: string;
      description?: string | null;
      priceRupees?: number;
      coverRupees?: number;
      admits?: number;
      priceUnit?: string;
      active?: boolean;
      perks?: string[];
    };

    /*
     * Identified by id, not code.
     *
     * `code` is unique per event, not globally — two events both selling a
     * NORMAL pass is the ordinary case. Matching on code alone repriced an
     * arbitrary one of them, and `UPDATE ... WHERE code = $1` repriced *all* of
     * them.
     */
    if (!body.id) return fail('Which pass?', 'missing_id', 422);

    const existing = await queryOne<TierWithUnit>('SELECT * FROM ticket_tiers WHERE id = $1', [
      body.id,
    ]);
    if (!existing) return fail('That pass no longer exists', 'not_found', 404);
    const code = existing.code;

    // --- Validation ------------------------------------------------------
    const pricePaise =
      body.priceRupees === undefined ? existing.price_paise : Math.round(body.priceRupees * 100);
    const coverPaise =
      body.coverRupees === undefined ? existing.redeemable_paise : Math.round(body.coverRupees * 100);
    const admits = body.admits === undefined ? existing.admits : Math.round(body.admits);

    if (!Number.isFinite(pricePaise) || pricePaise < 0) {
      return fail('The price must be zero or more', 'invalid_price', 422);
    }
    if (!Number.isFinite(coverPaise) || coverPaise < 0) {
      return fail('The cover must be zero or more', 'invalid_cover', 422);
    }
    // A cover worth more than the pass means the venue pays people to attend.
    if (pricePaise > 0 && coverPaise > pricePaise) {
      return fail(
        `The cover (₹${coverPaise / 100}) cannot exceed the price (₹${pricePaise / 100}).`,
        'cover_exceeds_price',
        422,
      );
    }
    if (!Number.isFinite(admits) || admits < 1 || admits > 50) {
      return fail('A pass must admit between 1 and 50 people', 'invalid_admits', 422);
    }
    if (body.name !== undefined && !body.name.trim()) {
      return fail('The pass needs a name', 'invalid_name', 422);
    }

    // The perk bullets repeat the cover and the admit count as prose — "₹500
    // cover redeemable", "Admits 2 guests". Stored text does not follow a number
    // it merely describes, so editing the cover used to leave the old figure
    // sitting in the bullet list on every page: exactly the stale value this
    // screen exists to prevent. Rewrite those two lines to match.
    const currentPerks = Array.isArray(existing.perks) ? existing.perks : [];
    const perks =
      body.perks ??
      currentPerks.map((perk) => {
        if (/cover|redeemable/i.test(perk)) {
          return `${formatRupees(coverPaise)} cover redeemable`;
        }
        if (/^admits\s+\d+/i.test(perk)) {
          return `Admits ${admits} ${admits === 1 ? 'guest' : 'guests'}`;
        }
        return perk;
      });

    const rows = await query<TierWithUnit>(
      `UPDATE ticket_tiers SET
         name             = COALESCE($2, name),
         description      = COALESCE($3, description),
         price_paise      = $4,
         redeemable_paise = $5,
         admits           = $6,
         price_unit       = COALESCE($7, price_unit),
         active           = COALESCE($8, active),
         perks            = COALESCE($9::jsonb, perks)
       WHERE id = $1
       RETURNING *`,
      [
        existing.id,
        body.name?.trim() ?? null,
        body.description?.trim() ?? null,
        pricePaise,
        coverPaise,
        admits,
        body.priceUnit?.trim() || null,
        body.active ?? null,
        JSON.stringify(perks),
      ],
    );

    const tier = rows[0];

    /**
     * Carry the new price into every unpaid booking.
     *
     * A booking snapshots its price, which is right once it has been paid and
     * wrong while it has not: somebody who filled a cart last week would come
     * back and still be charged last week's figure. Repricing here means the
     * number on the storefront is the number every customer pays, whichever
     * page they started from and however long ago.
     *
     * Confirmed bookings are untouched — their receipts keep what was actually
     * charged — and any payment order already raised is still honoured at the
     * amount it was raised for, so nobody mid-payment is left short.
     */
    const repriced = await repricePendingBookings(existing.id).catch((error) => {
      // The price change itself has committed and is the important half. Log
      // loudly and carry on rather than failing the request after the fact.
      console.error('[prices] could not reprice pending bookings', {
        code,
        error: error instanceof Error ? error.message : error,
      });
      return { bookings: 0, items: 0 };
    });

    await recordAudit({
      actor: session,
      action: 'price.update',
      entity: 'ticket_tier',
      entityId: existing.id,
      metadata: {
        from: {
          name: existing.name,
          pricePaise: existing.price_paise,
          coverPaise: existing.redeemable_paise,
          admits: existing.admits,
          active: existing.active,
        },
        to: {
          name: tier.name,
          pricePaise: tier.price_paise,
          coverPaise: tier.redeemable_paise,
          admits: tier.admits,
          active: tier.active,
        },
        repricedPendingBookings: repriced.bookings,
      },
      ipAddress: clientIp(request.headers),
    });

    // Every page that quotes a price. They are all force-dynamic, so this is
    // belt and braces against a CDN holding a rendered copy — the requirement
    // is that no old figure survives anywhere, and a stale price on one page is
    // the kind of thing a customer finds before anybody else does.
    for (const path of ['/', '/events', '/cart', '/book']) {
      revalidatePath(path);
    }
    // Every event page at once — the slug is not known here, and naming one
    // was how a retired slug ended up being the only page ever refreshed.
    revalidatePath('/events/[slug]', 'page');

    return ok({ tier, repriced });
  } catch (error) {
    return handleError(error, 'admin.prices.update');
  }
}
