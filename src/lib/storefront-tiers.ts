import 'server-only';
import { query } from './db';
import { FALLBACK_TICKET_TIERS } from '@/content/ticketing';
import type { TicketTierRow } from './types';

/**
 * The passes as the storefront should show them.
 *
 * One reader for the home page, the event page and the cart, because they were
 * three copies of the same logic and had already drifted: the home page took
 * the cover value and guest count from a hard-coded list while the cart took
 * them from the database, so editing either one moved the price on some pages
 * and not others.
 *
 * The database is the source of truth. The constants in content/ticketing.ts
 * are a last resort for a deployment whose database is unreachable — a page
 * rendering last-known prices beats a page rendering nothing — and nothing
 * else.
 *
 * They are emphatically NOT a schema. The previous version only trusted the
 * database when the number of live tiers exactly equalled the number of
 * hard-coded ones, which meant adding or retiring a single tier silently
 * dropped the entire site onto stale prices. Anything an operator can change
 * from the console must not be able to do that.
 */

export interface StorefrontTier {
  code: string;
  name: string;
  description: string | null;
  pricePaise: number;
  redeemablePaise: number;
  /** Heads one pass admits: 1 solo, 2 couple, 5 for a table. */
  pax: number;
  /** The suffix beside the price — "/ pass", "/ couple", "/ table". */
  priceUnit: string;
  perks: string[];
  remaining: number;
  total: number;
}

export async function listStorefrontTiers(eventId: string | null): Promise<StorefrontTier[]> {
  const rows = eventId
    ? await query<TicketTierRow & { price_unit: string }>(
        `SELECT * FROM ticket_tiers
          WHERE event_id = $1 AND active = true
          ORDER BY sort_order ASC, price_paise ASC`,
        [eventId],
      ).catch(() => [])
    : [];

  if (rows.length > 0) {
    return rows.map((tier) => ({
      code: tier.code,
      name: tier.name,
      description: tier.description,
      pricePaise: tier.price_paise,
      redeemablePaise: tier.redeemable_paise ?? 0,
      pax: tier.admits ?? 1,
      priceUnit: tier.price_unit || '/ pass',
      perks: Array.isArray(tier.perks) ? tier.perks : [],
      remaining: Math.max(0, tier.quantity - tier.sold),
      total: tier.quantity,
    }));
  }

  // Reached only when the database gave us nothing at all.
  return FALLBACK_TICKET_TIERS.map((tier) => ({
    code: tier.code,
    name: tier.name,
    description: tier.description,
    pricePaise: tier.pricePaise,
    redeemablePaise: tier.redeemablePaise,
    pax: tier.pax,
    priceUnit: tier.priceUnit,
    perks: [...tier.perks],
    remaining: tier.remaining,
    total: tier.total,
  }));
}
