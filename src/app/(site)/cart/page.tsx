import type { Metadata } from 'next';
import Link from 'next/link';
import { getEventBySlug, listTiers } from '@/lib/bookings';
import { EVENT, FEATURED_EVENT_SLUG } from '@/content/site';
import { formatEventDate, formatEventTime } from '@/lib/utils';
import { CartClient } from '@/components/cart/CartClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cart',
  description: `Your selected ${EVENT.name} tickets, bill amount and referral discount.`,
  alternates: { canonical: '/cart' },
};

export default async function CartPage() {
  const event = await getEventBySlug(FEATURED_EVENT_SLUG).catch(() => null);

  if (!event) {
    return (
      <div className="shell max-w-lg py-32">
        <div className="panel-raised p-10 text-center">
          <h1 className="h-section">Cart unavailable</h1>
          <p className="lede mt-3">The live event data could not be loaded right now.</p>
          <Link href="/events/offcampus" className="btn-primary mt-8">
            Back to tickets
          </Link>
        </div>
      </div>
    );
  }

  const tierRows = await listTiers(event.id).catch(() => []);
  const tiers = tierRows.map((tier) => ({
    code: tier.code,
    name: tier.name,
    description: tier.description,
    pricePaise: tier.price_paise,
    remaining: Math.max(0, tier.quantity - tier.sold),
    perks: Array.isArray(tier.perks) ? tier.perks : [],
  }));

  return (
    <div className="relative">
      <div className="shell relative pb-24 pt-32 sm:pt-36">
        <CartClient
          eventName={`${event.name} ${event.tagline ?? ''}`.trim()}
          eventSlug={event.slug}
          tiers={tiers}
          eventDate={formatEventDate(event.starts_at)}
          doorsAt={formatEventTime(event.doors_at ?? event.starts_at)}
        />
      </div>
    </div>
  );
}
