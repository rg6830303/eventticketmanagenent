import type { Metadata } from 'next';
import { getEventBySlug, listTiers } from '@/lib/bookings';
import { EVENT, FEATURED_EVENT_SLUG } from '@/content/site';
import { formatEventDate, formatEventTime } from '@/lib/utils';
import { CartClient } from '@/components/cart/CartClient';
import { FALLBACK_TICKET_TIERS, getTicketTierMeta } from '@/content/ticketing';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cart',
  description: `Your selected ${EVENT.name} tickets, bill amount and referral discount.`,
  alternates: { canonical: '/cart' },
};

export default async function CartPage() {
  const event = await getEventBySlug(FEATURED_EVENT_SLUG).catch(() => null);
  const tierRows = event ? await listTiers(event.id).catch(() => []) : [];
  const phaseOneRows = tierRows.filter((tier) => getTicketTierMeta(tier.code));
  const tiers = phaseOneRows.length === FALLBACK_TICKET_TIERS.length
    ? phaseOneRows.map((tier) => {
        const meta = getTicketTierMeta(tier.code);
        return {
          code: tier.code,
          name: tier.name,
          description: tier.description,
          pricePaise: tier.price_paise,
          remaining: Math.max(0, tier.quantity - tier.sold),
          perks: Array.isArray(tier.perks) ? tier.perks : [],
          redeemablePaise: meta?.redeemablePaise ?? 0,
          pax: meta?.pax ?? 1,
          priceUnit: meta?.priceUnit ?? '/ pass',
        };
      })
    : FALLBACK_TICKET_TIERS.map(({ total: _total, ...tier }) => ({
        ...tier,
        perks: [...tier.perks],
      }));

  return (
    <div className="relative">
      <div className="shell relative pb-24 pt-32 sm:pt-36">
        <CartClient
          eventName={event ? `${event.name} ${event.tagline ?? ''}`.trim() : `${EVENT.name} ${EVENT.edition}`}
          eventSlug={event?.slug ?? EVENT.slug}
          tiers={tiers}
          eventDate={event ? formatEventDate(event.starts_at) : EVENT.dateLabel}
          doorsAt={event ? formatEventTime(event.doors_at ?? event.starts_at) : '12:00 PM'}
        />
      </div>
    </div>
  );
}
