import Link from 'next/link';
import type { Metadata } from 'next';
import { getEventBySlug, listTiers } from '@/lib/bookings';
import { BRAND, EVENT, PARTNER, REFERRAL } from '@/content/site';
import { formatEventDate, formatEventTime, formatInr } from '@/lib/utils';
import { Reveal } from '@/components/ui/Reveal';
import { Countdown } from '@/components/ui/Countdown';
import { Magnetic } from '@/components/ui/Magnetic';
import { PosterCard } from '@/components/event/PosterCard';
import { ActivityGrid } from '@/components/event/ActivityGrid';
import { Runsheet } from '@/components/event/Runsheet';
import { TicketRail, type RailTier } from '@/components/event/TicketRail';
import { StickyBuyBar } from '@/components/event/StickyBuyBar';
import { Accordion } from '@/components/events/Accordion';
import { getSiteUrl } from '@/lib/site-url';
import { FALLBACK_TICKET_TIERS, getTicketTierMeta } from '@/content/ticketing';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${EVENT.name} ${EVENT.edition}`,
  description: `${EVENT.name} ${EVENT.edition} at ${EVENT.venue.name}, ${EVENT.venue.area}. ${EVENT.dateLabel}, ${EVENT.timeLabel}. Non-stop DJ, photo booth, temporary tattoos and more.`,
  alternates: { canonical: '/events/offcampus' },
};

export default async function OffCampusPage() {
  const event = await getEventBySlug(EVENT.slug).catch(() => null);
  const tierRows = event ? await listTiers(event.id).catch(() => []) : [];
  const phaseOneRows = tierRows.filter((tier) => getTicketTierMeta(tier.code));

  const tiers: RailTier[] = phaseOneRows.length === FALLBACK_TICKET_TIERS.length
    ? phaseOneRows.map((tier) => {
        const meta = getTicketTierMeta(tier.code);
        return {
          code: tier.code,
          name: tier.name,
          description: tier.description,
          pricePaise: tier.price_paise,
          remaining: Math.max(0, tier.quantity - tier.sold),
          total: tier.quantity,
          perks: Array.isArray(tier.perks) ? tier.perks : [],
          redeemablePaise: meta?.redeemablePaise ?? 0,
          pax: meta?.pax ?? 1,
          priceUnit: meta?.priceUnit ?? '/ pass',
        };
      })
    : FALLBACK_TICKET_TIERS.map((tier) => ({ ...tier, perks: [...tier.perks] }));

  const onSale = tiers.filter((tier) => tier.remaining > 0);
  const fromPaise = onSale.length ? Math.min(...onSale.map((tier) => tier.pricePaise)) : null;
  const remaining = tiers.reduce((sum, tier) => sum + tier.remaining, 0);
  const soldOut = tiers.length > 0 && remaining === 0;

  /**
   * Structured data. Search results for a one-off event are the difference
   * between "some website" and a card with the date, venue and price on it, so
   * this is worth the bytes. Every value comes from the database row where one
   * exists, so the markup cannot drift from what the page says.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `${EVENT.name} — ${EVENT.edition}`,
    description: event?.description ?? EVENT.standfirst,
    startDate: event?.starts_at,
    endDate: event?.ends_at ?? undefined,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: EVENT.venue.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: EVENT.venue.addressLines[0],
        addressLocality: 'Hyderabad',
        addressRegion: 'Telangana',
        addressCountry: 'IN',
      },
    },
    organizer: { '@type': 'Organization', name: BRAND.name, url: getSiteUrl() },
    offers: onSale.map((tier) => ({
      '@type': 'Offer',
      name: tier.name,
      price: (tier.pricePaise / 100).toFixed(2),
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      url: `${getSiteUrl()}/book?tier=${tier.code}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- JSON-LD has no other insertion point.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden pb-14 pt-32 sm:pt-36">

        <div className="shell">
          <Reveal>
            <nav aria-label="Breadcrumb" className="mb-8 text-[0.8125rem] text-muted">
              <Link href="/" className="transition-colors hover:text-ink">
                Home
              </Link>
              <span className="mx-2">/</span>
              <Link href="/events" className="transition-colors hover:text-ink">
                Events
              </Link>
              <span className="mx-2">/</span>
              <span className="text-slate">{EVENT.name}</span>
            </nav>
          </Reveal>

          <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Reveal>
                <p className="kicker">{EVENT.presentedBy}</p>
                <h1 className="h-hero mt-5">
                  {EVENT.name}{' '}
                  <span className="accent block text-vybe-600 sm:inline">{EVENT.edition}</span>
                </h1>
              </Reveal>

              <Reveal delay={0.08}>
                <p className="lede mt-6 max-w-xl">{EVENT.standfirst}</p>
              </Reveal>

              <Reveal delay={0.14}>
                <dl className="mt-9 grid max-w-xl grid-cols-2 gap-x-6 gap-y-6 border-y-2 border-ink py-6 sm:grid-cols-4">
                  <Fact
                    label="Date"
                    value={event ? formatEventDate(event.starts_at) : EVENT.dateLabel}
                  />
                  <Fact
                    label="Doors"
                    value={event ? formatEventTime(event.doors_at ?? event.starts_at) : '12:00 PM'}
                  />
                  <Fact label="Until" value="4:00 PM" />
                  <Fact label="Age" value={`${event?.age_limit ?? 18}+`} />
                </dl>
              </Reveal>

              <Reveal delay={0.2}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Magnetic>
                    <Link href="/book" className="btn-primary text-base">
                      {soldOut
                        ? 'Join the waitlist'
                        : fromPaise !== null
                          ? `Buy tickets — from ${formatInr(fromPaise)}`
                          : 'Buy tickets'}
                    </Link>
                  </Magnetic>
                  <a
                    href={EVENT.venue.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline text-base"
                  >
                    Find the venue
                  </a>
                </div>
              </Reveal>

              {event && (
                <Reveal delay={0.26}>
                  <div className="mt-10">
                    <p className="kicker mb-3">Doors open in</p>
                    <Countdown target={event.doors_at ?? event.starts_at} className="max-w-md" />
                  </div>
                </Reveal>
              )}
            </div>

            <Reveal delay={0.12} direction="none">
              <div className="flex justify-center lg:justify-end">
                <PosterCard />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="section slab" aria-labelledby="detail">
        <div className="shell grid gap-14 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <div className="edit-head">
              <h2 id="detail" className="h-section">
                What actually happens.
              </h2>
              <span className="edit-index">01 — The long version</span>
            </div>
            <div className="mt-6 space-y-4 text-[1.0625rem] leading-[1.7] text-slate">
              {EVENT.body.map((paragraph) => (
                <p key={paragraph.slice(0, 24)}>{paragraph}</p>
              ))}
            </div>
            <p className="mt-8 rounded-[12px] border-[1.5px] border-ink/25 bg-frost px-5 py-4 text-[0.875rem] leading-relaxed text-slate">
              {EVENT.name} is produced by {BRAND.name} in partnership with {PARTNER.name}. It is an
              independent event, not affiliated with any college or university.
            </p>
          </div>

          <div>
            <div className="flex items-baseline justify-between border-b-2 border-ink pb-3">
              <p className="font-display text-[1.15rem] font-semibold tracking-[-0.02em] text-ink">
                Hour by hour
              </p>
              <span className="edit-index">12 — 5 PM</span>
            </div>
            <div className="mt-8">
              <Runsheet />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="section shell" aria-labelledby="whats-on">
        <div className="edit-head">
          <h2 id="whats-on" className="h-section">
            Six things running at once.
          </h2>
          <span className="edit-index">02 — What&apos;s on</span>
        </div>
        <p className="lede mt-4 max-w-2xl">All included with entry. Nothing costs extra inside.</p>
        <div className="mt-10">
          <ActivityGrid />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section
        id="tickets"
        className="section slab"
        aria-labelledby="event-tickets"
      >
        <div className="shell">
          <div className="edit-head">
            <h2 id="event-tickets" className="h-section">
              {soldOut ? 'Sold out.' : 'Phase 1 pass pricing.'}
            </h2>
            <span className="edit-index">03 — Tickets</span>
          </div>
          <p className="lede mt-4 max-w-2xl">
            {soldOut
              ? 'Every tier has gone. Returns are posted on Instagram before anywhere else.'
              : `Choose the pass that fits your group. Each includes venue redemption, and a referral code takes a flat ₹${REFERRAL.discountRupees} off your cart.`}
          </p>

          <div className="mt-12">
            <TicketRail tiers={tiers} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="section shell" aria-labelledby="event-venue">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="edit-head">
              <h2 id="event-venue" className="h-section">
                {EVENT.venue.name}
              </h2>
              <span className="edit-index">04 — Venue</span>
            </div>
            <address className="mt-6 not-italic text-[1.0625rem] leading-relaxed text-slate">
              {EVENT.venue.addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-slate">
              {EVENT.venue.landmark}. The bar and kitchen run their full menu through the party.
            </p>
            <a
              href={EVENT.venue.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline btn-sm mt-8"
            >
              Open in Maps
            </a>
          </div>

          <div className="card-print overflow-hidden">
            <div className="flex items-center justify-between border-b-[1.5px] border-ink bg-vybe-100 px-6 py-3.5">
              <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-ink">
                Door policy
              </p>
              <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink/60">
                House rules
              </span>
            </div>
            <ol className="divide-y divide-ink/15">
              {EVENT.entryRules.map((rule, index) => (
                <li key={rule} className="flex gap-4 px-6 py-4 text-[0.9375rem] text-slate">
                  <span className="shrink-0 font-mono text-[0.75rem] text-vybe-600">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {rule}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="section slab" aria-labelledby="event-faq">
        <div className="shell grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <span className="edit-index">05 — Questions</span>
            <h2 id="event-faq" className="h-section mt-3">
              Before you book.
            </h2>
          </div>
          <Accordion items={EVENT.faqs.map((faq) => ({ question: faq.q, answer: faq.a }))} />
        </div>
      </section>

      <StickyBuyBar fromPaise={fromPaise} soldOut={soldOut} />
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </dt>
      <dd className="mt-1.5 font-display text-[1.0625rem] font-semibold tracking-[-0.02em] text-ink">
        {value}
      </dd>
    </div>
  );
}
