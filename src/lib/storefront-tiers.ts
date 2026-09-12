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
  const [rows, closed] = await Promise.all([
    /*
     * null means the question could not be asked; [] means it was asked and the
     * answer is "none on sale". Collapsing those two into an empty array is what
     * made hiding every tier fall through to the hard-coded list and advertise
     * passes that are not for sale — the database was answering perfectly well.
     */
    eventId
      ? query<TicketTierRow & { price_unit: string }>(
          `SELECT * FROM ticket_tiers
            WHERE event_id = $1 AND active = true
            ORDER BY sort_order ASC, price_paise ASC`,
          [eventId],
        ).catch(() => null)
      : Promise.resolve(null),
    /*
     * Whether the shop is shut, decided once for every page that quotes a price.
     *
     * Doing it here rather than in each page means the home page, the event page
     * and the cart cannot disagree — a cart that still accepts passes while the
     * event page says sold out is how somebody fills a basket and is refused at
     * the last step, which is worse than being told plainly up front.
     *
     * It reports no stock rather than hiding the tiers, so the prices stay
     * readable and the page can say "sold out" about something specific.
     *
     * Deliberately NOT done by zeroing the tier's quantity in the database: the
     * console issues passes by hand and that path refuses when a tier has no
     * remaining stock. Closing sales must not disable the one way left to put
     * somebody through the door.
     */
    eventId
      ? query<{ status: string }>('SELECT status FROM events WHERE id = $1', [eventId])
          .then((r) => r[0]?.status === 'sold_out')
          .catch(() => false)
      : Promise.resolve(false),
  ]);

  // Asked, and nothing is on sale. That is an answer, not a failure.
  if (rows !== null && rows.length === 0) return [];

  if (rows !== null && rows.length > 0) {
    if (closed) {
      return rows.map((tier) => ({
        code: tier.code,
        name: tier.name,
        description: tier.description,
        pricePaise: tier.price_paise,
        redeemablePaise: tier.redeemable_paise ?? 0,
        pax: tier.admits ?? 1,
        priceUnit: tier.price_unit || '/ pass',
        perks: Array.isArray(tier.perks) ? tier.perks : [],
        remaining: 0,
        total: tier.quantity,
      }));
    }

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

  // Reached only when the query itself failed — the database is unreachable and
  // last-known prices beat an empty page. Never reached merely because an
  // operator has taken every tier off sale.
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
