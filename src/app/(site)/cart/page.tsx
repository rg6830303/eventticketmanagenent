import type { Metadata } from 'next';
import { getEventBySlug, listTiers } from '@/lib/bookings';
import { env } from '@/lib/env';
import { listStorefrontTiers } from '@/lib/storefront-tiers';
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
  const tierRows = event ? await listTiers(event.id).catch(() => []) : [];
  // `admits` and `redeemable_paise` now live on the tier row, so the database is
  // the single source of truth for what a pass is worth and how many people it
  // lets in. The content constants are only a fallback for a deployment whose
  // database is unreachable — a cart that renders nothing is worse than one
  // that renders last-known prices and fails at checkout with a real message.
  const tiers = await listStorefrontTiers(event?.id ?? null);

  return (
    <div className="relative">
      <div className="shell relative pb-24 pt-32 sm:pt-36">
        <CartClient
          eventName={event ? `${event.name} ${event.tagline ?? ''}`.trim() : `${EVENT.name} ${EVENT.edition}`}
          eventSlug={event?.slug ?? EVENT.slug}
          tiers={tiers}
          eventDate={event ? formatEventDate(event.starts_at) : EVENT.dateLabel}
          doorsAt={event ? formatEventTime(event.doors_at ?? event.starts_at) : '12:00 PM'}
          maxPasses={env.maxTicketsPerBooking}
          checkoutEnabled={env.paymentsEnabled && env.paymentProvider !== 'none'}
        />
      </div>
    </div>
  );
}
