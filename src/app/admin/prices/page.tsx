import { requireSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { PriceEditor, type PriceTier } from '@/components/admin/PriceEditor';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Prices', robots: { index: false, follow: false } };

/**
 * Ticket prices.
 *
 * Manager-gated: this is the figure customers are charged, which is a
 * commercial decision rather than a door one.
 */
export default async function PricesPage() {
  await requireSession('manager');

  const tiers = await query<PriceTier>(
    `SELECT t.*,
            (SELECT COALESCE(SUM(bi.quantity), 0)::int FROM booking_items bi
               JOIN bookings b ON b.id = bi.booking_id
              WHERE bi.tier_id = t.id AND b.status = 'confirmed') AS confirmed,
            (SELECT COALESCE(SUM(bi.quantity), 0)::int FROM booking_items bi
               JOIN bookings b ON b.id = bi.booking_id
              WHERE bi.tier_id = t.id AND b.status = 'pending') AS pending
       FROM ticket_tiers t
      ORDER BY t.active DESC, t.sort_order ASC, t.price_paise ASC`,
  ).catch(() => []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Prices</h1>
        <p className="mt-1 text-[13px] text-slate">
          What each pass costs and how many people it admits. Saving publishes straight to the site
          and the cart — customers who have already bought keep the price they paid.
        </p>
      </div>

      <PriceEditor initialTiers={tiers} />
    </div>
  );
}
