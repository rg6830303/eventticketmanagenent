import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { listStorefrontTiers } from '@/lib/storefront-tiers';
import { getPublicEvent, listUpcomingEvents, listPastEvents } from '@/lib/events';
import { BRAND, REFERRAL } from '@/content/site';
import { formatEventDate, formatEventTime, formatInr } from '@/lib/utils';
import { Reveal } from '@/components/ui/Reveal';
import { Countdown } from '@/components/ui/Countdown';
import { Magnetic } from '@/components/ui/Magnetic';
import { PosterCard } from '@/components/event/PosterCard';
import { ActivityGrid } from '@/components/event/ActivityGrid';
import { Runsheet } from '@/components/event/Runsheet';
import { TicketRail } from '@/components/event/TicketRail';
import { StickyBuyBar } from '@/components/event/StickyBuyBar';
import { Accordion } from '@/components/events/Accordion';
import { getSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

/**
 * One event, whichever event it is.
 *
 * This was `/events/offcampus/page.tsx` — a route whose filename named the
 * party it described, reading its copy from a constant compiled into the
 * bundle. Announcing a second date meant copying the file. Now the slug is a
 * parameter, the words come out of the row, and a past date renders the same
 * page with the selling taken out of it.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEvent(slug).catch(() => null);
  if (!event) return { title: 'Event not found' };

  const { row, content, dateLabel, timeLabel, edition } = event;
  const title = edition ? `${row.name} ${edition}` : row.name;

  return {
    title,
    description:
      row.description ??
      `${title} at ${row.venue_name}. ${dateLabel}, ${timeLabel}. ${content.subhead}`,
    alternates: { canonical: `/events/${row.slug}` },
  };
}

export default async function EventPage({ params }: PageProps) {
  const { slug } = await params;
  const event = await getPublicEvent(slug).catch(() => null);
  if (!event) notFound();

  const { row, content, dateLabel, timeLabel, dateShort, edition, isPast } = event;
  const tiers = await listStorefrontTiers(row.id);

  const onSale = tiers.filter((tier) => tier.remaining > 0);
  const fromPaise = onSale.length ? Math.min(...onSale.map((tier) => tier.pricePaise)) : null;
  const remaining = tiers.reduce((sum, tier) => sum + tier.remaining, 0);

  /*
   * Sold out is either answer: nothing left, or sales deliberately closed.
   *
   * The status is what closes the shop on the night, and it does so without
   * zeroing any stock — the console still has to be able to issue a pass by
   * hand, and that path refuses when a tier has no remaining quantity.
   */
  const soldOut = row.status === 'sold_out' || (tiers.length > 0 && remaining === 0);

  // A past event sells nothing. Every buy affordance on the page is behind
  // this, so an archived date cannot take a payment for a party that is over.
  const sellable = !isPast && row.status !== 'cancelled';

  const nextUp = isPast
    ? (await listUpcomingEvents().catch(() => []))[0] ?? null
    : null;

  /**
   * Structured data. Search results for a one-off event are the difference
   * between "some website" and a card with the date, venue and price on it, so
   * this is worth the bytes. Every value comes from the database row, so the
   * markup cannot drift from what the page says.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: edition ? `${row.name} — ${edition}` : row.name,
    description: row.description ?? content.standfirst,
    startDate: row.starts_at,
    endDate: row.ends_at ?? undefined,
    eventStatus:
      row.status === 'cancelled'
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: row.venue_name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: content.venue.addressLines[0] ?? row.venue_address ?? undefined,
        addressLocality: row.city,
        addressCountry: 'IN',
      },
    },
    organizer: { '@type': 'Organization', name: BRAND.name, url: getSiteUrl() },
    offers: sellable
      ? onSale.map((tier) => ({
          '@type': 'Offer',
          name: tier.name,
          price: (tier.pricePaise / 100).toFixed(2),
          priceCurrency: 'INR',
          availability: 'https://schema.org/InStock',
          url: `${getSiteUrl()}/book?event=${row.slug}&tier=${tier.code}`,
        }))
      : [],
  };

  const bookHref = `/book?event=${row.slug}`;

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
              <span className="text-slate">{row.name}</span>
            </nav>
          </Reveal>

          {/* A finished event says so before it says anything else, so nobody
              reads three paragraphs in the present tense and then looks for a
              buy button that is not there. */}
          {isPast && (
            <Reveal>
              <div className="card mb-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[0.9375rem] text-slate">
                  <span className="chip chip-quiet mr-3">Past event</span>
                  This one has happened. {dateLabel}.
                </p>
                {nextUp && (
                  <Link href={`/events/${nextUp.row.slug}`} className="btn-primary btn-sm shrink-0">
                    See the next date →
                  </Link>
                )}
              </div>
            </Reveal>
          )}

          <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Reveal>
                <p className="kicker">{content.presentedBy}</p>
                <h1 className="h-hero mt-5">
                  {row.name}{' '}
                  {edition && (
                    <span className="accent gradient-text block sm:inline">{edition}</span>
                  )}
                </h1>
              </Reveal>

              <Reveal delay={0.08}>
                <p className="lede mt-6 max-w-xl">{content.standfirst}</p>
              </Reveal>

              <Reveal delay={0.14}>
                <dl className="card mt-9 grid max-w-md grid-cols-2 gap-x-6 gap-y-6 p-6 sm:grid-cols-3">
                  <Fact label="Date" value={formatEventDate(row.starts_at)} />
                  <Fact label="Doors" value={formatEventTime(row.doors_at ?? row.starts_at)} />
                  {row.ends_at && <Fact label="Until" value={formatEventTime(row.ends_at)} />}
                </dl>
              </Reveal>

              <Reveal delay={0.2}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  {sellable && (
                    <Magnetic>
                      <Link href={bookHref} className="btn-primary text-base">
                        {soldOut
                          ? 'Join the waitlist'
                          : fromPaise !== null
                            ? `Buy tickets — from ${formatInr(fromPaise)}`
                            : 'Buy tickets'}
                      </Link>
                    </Magnetic>
                  )}
                  {content.venue.mapsUrl && (
                    <a
                      href={content.venue.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-outline text-base"
                    >
                      Find the venue
                    </a>
                  )}
                </div>
              </Reveal>

              {sellable && (
                <Reveal delay={0.26}>
                  <div className="mt-10">
                    <p className="kicker mb-3">Doors open in</p>
                    <Countdown target={row.doors_at ?? row.starts_at} className="max-w-md" />
                  </div>
                </Reveal>
              )}
            </div>

            <Reveal delay={0.12} direction="none">
              <div className="flex justify-center lg:justify-end">
                <PosterCard
                  title={row.name}
                  subtitle={row.tagline ?? edition ?? undefined}
                  edition={edition || undefined}
                  venue={
                    content.venue.area
                      ? `${row.venue_name}, ${content.venue.area}`
                      : row.venue_name
                  }
                  dateLine={`${dateShort} · ${timeLabel}`}
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {(content.body.length > 0 || content.runsheet.length > 0) && (
        <section className="shell" aria-labelledby="detail">
          <div className="slab section grid gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_1fr] lg:gap-20 lg:px-12">
            <div>
              <div className="edit-head">
                <h2 id="detail" className="h-section">
                  What actually happens.
                </h2>
                <span className="edit-index">01 — The long version</span>
              </div>
              <div className="mt-6 space-y-4 text-[1.0625rem] leading-[1.7] text-slate">
                {content.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 24)}>{paragraph}</p>
                ))}
              </div>
              <p className="mt-8 rounded-lg bg-frost px-5 py-4 text-[0.875rem] leading-relaxed text-slate ring-hair">
                {row.name} is produced by {BRAND.name}. It is an independent event, not affiliated
                with any college or university.
              </p>
            </div>

            {content.runsheet.length > 0 && (
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-display text-[1.15rem] font-semibold tracking-[-0.02em] text-ink">
                    Hour by hour
                  </p>
                  <span className="chip chip-quiet">{timeLabel}</span>
                </div>
                <div className="mt-8">
                  <Runsheet slots={content.runsheet} />
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {content.activities.length > 0 && (
        <section className="section shell" aria-labelledby="whats-on">
          <div className="edit-head">
            <h2 id="whats-on" className="h-section">
              Everything running at once.
            </h2>
            <span className="edit-index">02 — What&apos;s on</span>
          </div>
          <p className="lede mt-4 max-w-2xl">
            All included with entry. Nothing costs extra inside.
          </p>
          <div className="mt-10">
            <ActivityGrid activities={content.activities} />
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {sellable && (
        <section id="tickets" className="shell scroll-mt-28" aria-labelledby="event-tickets">
          <div className="slab section px-5 sm:px-8 lg:px-12">
            <div className="edit-head">
              <h2 id="event-tickets" className="h-section">
                {soldOut ? 'Sold out.' : 'Pass pricing.'}
              </h2>
              <span className="edit-index">03 — Tickets</span>
            </div>
            <p className="lede mt-4 max-w-2xl">
              {soldOut
                ? 'Every tier has gone. Returns are posted on Instagram before anywhere else.'
                : `Choose the pass that fits your group. A referral code takes a flat ₹${REFERRAL.discountRupees} off your cart.`}
            </p>

            <div className="mt-12">
              <TicketRail tiers={tiers} eventSlug={row.slug} />
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      <section className="section shell" aria-labelledby="event-venue">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="edit-head">
              <h2 id="event-venue" className="h-section">
                {row.venue_name}
              </h2>
              <span className="edit-index">04 — Venue</span>
            </div>
            <address className="mt-6 not-italic text-[1.0625rem] leading-relaxed text-slate">
              {(content.venue.addressLines.length > 0
                ? content.venue.addressLines
                : [row.venue_address ?? row.city]
              ).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
            {content.venue.landmark && (
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-slate">
                {content.venue.landmark}.
              </p>
            )}
            {content.venue.mapsUrl && (
              <a
                href={content.venue.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline btn-sm mt-8"
              >
                Open in Maps
              </a>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 bg-aurora-soft px-6 py-4">
              <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-vybe-700">
                Door policy
              </p>
              <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-slate">
                House rules
              </span>
            </div>
            <ol className="divide-y divide-ink/[0.07]">
              {content.entryRules.map((rule, index) => (
                <li
                  key={rule}
                  className="flex gap-4 px-6 py-4 text-[0.9375rem] leading-relaxed text-slate"
                >
                  <span className="tnum mt-px shrink-0 font-mono text-[0.75rem] font-semibold text-vybe-600">
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
      {content.faqs.length > 0 && (
        <section className="shell" aria-labelledby="event-faq">
          <div className="slab section grid gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-12">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <span className="edit-index">05 — Questions</span>
              <h2 id="event-faq" className="h-section mt-3">
                Before you book.
              </h2>
            </div>
            <Accordion items={content.faqs.map((faq) => ({ question: faq.q, answer: faq.a }))} />
          </div>
        </section>
      )}

      {sellable && (
        <StickyBuyBar
          fromPaise={fromPaise}
          soldOut={soldOut}
          title={`${row.name} · ${dateShort}`}
          href={`${bookHref}#tickets`}
        />
      )}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-vybe-700">
        {label}
      </dt>
      <dd className="mt-1.5 font-display text-[1.0625rem] font-semibold tracking-[-0.02em] text-ink">
        {value}
      </dd>
    </div>
  );
}
