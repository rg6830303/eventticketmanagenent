import type { Metadata } from 'next';
import { getCustomerAccount } from '@/lib/customer-auth';
import { env } from '@/lib/env';
import { getFeaturedEvent } from '@/lib/event-facts';
import { listStorefrontTiers } from '@/lib/storefront-tiers';
import { formatEventDate, formatEventTime } from '@/lib/utils';
import { CartClient } from '@/components/cart/CartClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cart',
  description: 'Your selected Houz of Vybe passes, bill amount and referral discount.',
  alternates: { canonical: '/cart' },
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  // The cart is for whichever event the platform is currently selling, read
  // from the database rather than pinned to one slug in the code.
  const [event, account] = await Promise.all([getFeaturedEvent(), getCustomerAccount()]);
  const tiers = await listStorefrontTiers(event?.id ?? null);

  return (
    <div className="relative">
      <div className="shell relative pb-24 pt-32 sm:pt-36">
        <CartClient
          eventName={event ? `${event.name} ${event.tagline ?? ''}`.trim() : 'Houz of Vybe'}
          eventSlug={event?.slug ?? ''}
          tiers={tiers}
          eventDate={event ? formatEventDate(event.starts_at) : ''}
          doorsAt={event ? formatEventTime(event.doors_at ?? event.starts_at) : ''}
          maxPasses={env.maxTicketsPerBooking}
          checkoutEnabled={env.paymentsEnabled && env.paymentProvider !== 'none'}
          account={account ? { name: account.name, email: account.email, phone: account.phone ?? '' } : null}
        />
      </div>
    </div>
  );
}
