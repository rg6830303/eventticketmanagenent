import Link from 'next/link';
import type { Metadata } from 'next';
import { getEventBySlug, listTiers } from '@/lib/bookings';
import { env } from '@/lib/env';
import { FEATURED_EVENT_SLUG } from '@/content/site';
import { BookingExperience } from '@/components/booking/BookingExperience';
import type { TierOption } from '@/components/booking/BookingForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Book tickets',
  description:
    'Book your pass for Houz of Vybe in Hyderabad. Name, email and phone — your QR ticket arrives instantly.',
  alternates: { canonical: '/book' },
};

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; tier?: string }>;
}) {
  const { event: eventParam, tier: tierParam } = await searchParams;
  const slug = eventParam ?? FEATURED_EVENT_SLUG;

  const event = await getEventBySlug(slug).catch(() => null);

  if (!event || event.status === 'draft' || event.status === 'archived') {
    return (
      <div className="section container-hov">
        <div className="card mx-auto max-w-lg p-10 text-center">
          <h1 className="display-2 mb-3">Nothing on sale</h1>
          <p className="lede mb-8">
            There are no tickets available right now. Check the events page for what&apos;s coming
            up next.
          </p>
          <Link href="/events" className="btn-primary">
            See all events
          </Link>
        </div>
      </div>
    );
  }

  const tierRows = await listTiers(event.id).catch(() => []);
  const tiers: TierOption[] = tierRows.map((tier) => ({
    code: tier.code,
    name: tier.name,
    description: tier.description,
    pricePaise: tier.price_paise,
    remaining: Math.max(0, tier.quantity - tier.sold),
    // `perks` is jsonb; guard against a row that was seeded with something else.
    perks: Array.isArray(tier.perks) ? tier.perks : [],
  }));

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-radial-vybe" />

      <div className="container-hov relative pb-24 pt-28 sm:pt-32">
        <header className="mb-10 max-w-2xl">
          <p className="eyebrow mb-3">Booking</p>
          <h1 className="display-2">
            Get on the list for <span className="text-gradient">{event.name}</span>
          </h1>
          <p className="lede mt-4">
            Three details, no account, no payment. Your QR pass lands in your inbox in under a
            minute.
          </p>
        </header>

        {tiers.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="font-display text-xl font-bold text-chalk">Tickets not released yet</p>
            <p className="mt-2 text-sm text-haze">
              Ticket tiers for this event haven&apos;t been published. Check back shortly.
            </p>
          </div>
        ) : (
          <BookingExperience
            eventSlug={event.slug}
            eventName={event.name}
            eventTagline={event.tagline}
            startsAt={event.starts_at}
            doorsAt={event.doors_at}
            venueName={event.venue_name}
            tiers={tiers}
            initialTier={tierParam}
            maxQuantity={env.maxTicketsPerBooking}
          />
        )}
      </div>
    </div>
  );
}
