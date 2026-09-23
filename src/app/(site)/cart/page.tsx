import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { listStorefrontTiers } from '@/lib/storefront-tiers';
import { getFeaturedEvent, getPublicEvent } from '@/lib/events';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { formatEventDate, formatEventTime } from '@/lib/utils';
import { CartClient } from '@/components/cart/CartClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cart',
  description: 'Your selected tickets, bill amount and referral discount.',
  alternates: { canonical: '/cart' },
};

/**
 * The cart, for one event at a time.
 *
 * Which event is the same question the home page asks, with `?event=<slug>`
 * honoured so a customer who followed a link from a specific date lands on
 * that date's cart rather than whichever one happens to be featured. The cart
 * in localStorage records the slug it was filled for and reads as empty for
 * any other, so the two can never disagree about what is being bought.
 */
export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event: slug } = await searchParams;

  const target = slug
    ? await getPublicEvent(slug).catch(() => null)
    : await getFeaturedEvent().catch(() => null);

  if (!target) redirect('/events');

  const { row: event, edition, isPast } = target;

  // A finished event cannot be checked out. Sending them to the page rather
  // than showing an uncheckoutable cart keeps the dead end in one place.
  if (isPast) redirect(`/events/${event.slug}`);

  const [tiers, customer] = await Promise.all([
    listStorefrontTiers(event.id),
    // Signed out, or unreadable: a guest checkout, which is the path that must
    // never break. Never an error.
    getCurrentCustomer().catch(() => null),
  ]);

  return (
    <div className="relative">
      <div className="shell relative pb-24 pt-32 sm:pt-36">
        <CartClient
          eventName={edition ? `${event.name} ${edition}` : event.name}
          eventSlug={event.slug}
          account={
            customer
              ? { name: customer.name, email: customer.email, phone: customer.phone }
              : null
          }
          tiers={tiers}
          eventDate={formatEventDate(event.starts_at)}
          doorsAt={formatEventTime(event.doors_at ?? event.starts_at)}
          maxPasses={env.maxTicketsPerBooking}
          checkoutEnabled={env.paymentsEnabled && env.paymentProvider !== 'none'}
        />
      </div>
    </div>
  );
}
