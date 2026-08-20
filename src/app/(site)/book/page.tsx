import Link from 'next/link';
import type { Metadata } from 'next';
import { getEventBySlug, listTiers } from '@/lib/bookings';
import { env } from '@/lib/env';
import { EVENT, FEATURED_EVENT_SLUG } from '@/content/site';
import { BookingExperience } from '@/components/booking/BookingExperience';
import type { TierOption } from '@/components/booking/BookingForm';
import { Reveal } from '@/components/ui/Reveal';
import { formatEventDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Buy tickets',
  description: `Book your pass for ${EVENT.name} ${EVENT.edition} at ${EVENT.venue.name}, ${EVENT.venue.area}. QR passes by email, referral codes accepted.`,
  alternates: { canonical: '/book' },
};

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; tier?: string; ref?: string; code?: string }>;
}) {
  const {
    event: eventParam,
    tier: tierParam,
    ref: refParam,
    code: codeParam,
  } = await searchParams;
  const slug = eventParam ?? FEATURED_EVENT_SLUG;

  const event = await getEventBySlug(slug).catch(() => null);

  if (!event || event.status === 'draft' || event.status === 'archived') {
    return (
      <div className="shell max-w-lg py-32">
        <div className="panel-raised p-10 text-center">
          <h1 className="h-section">Nothing on sale</h1>
          <p className="lede mt-3">
            There are no tickets available right now. The next date goes up here first.
          </p>
          <Link href="/" className="btn-primary mt-8">
            Back to the party page
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

  const left = tiers.reduce((sum, tier) => sum + tier.remaining, 0);

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] dotfield fade-edges opacity-70"
      />

      <div className="shell relative pb-24 pt-32 sm:pt-36">
        <Reveal>
          <header className="max-w-2xl">
            <p className="kicker">Step 1 of 2</p>
            <h1 className="h-section mt-3">
              Your pass for <span className="text-vybe-600">{event.name}</span>
            </h1>
            <p className="lede mt-4">
              {formatEventDate(event.starts_at)} at {event.venue_name}, {EVENT.venue.area}. Four
              details and a QR is on its way.
            </p>
            {left > 0 && left <= 60 && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-flare-300 bg-flare-200/30 px-3.5 py-1.5 text-[0.8125rem] font-semibold text-flare-600">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping2 rounded-full bg-flare-400" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-flare" />
                </span>
                {left} tickets left in total
              </p>
            )}
          </header>
        </Reveal>

        <div className="mt-12">
          {tiers.length === 0 ? (
            <div className="panel p-10 text-center">
              <p className="h-card">Tickets are not released yet</p>
              <p className="mt-2 text-[0.9375rem] text-slate">
                Nothing has been put on sale for this date. Check back shortly.
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
              // ?ref= and ?code= both work, because promoters will share whichever
              // one they happen to type.
              initialReferral={refParam ?? codeParam}
              maxQuantity={env.maxTicketsPerBooking}
              paymentsEnabled={env.paymentsEnabled}
            />
          )}
        </div>
      </div>
    </div>
  );
}
