import Link from 'next/link';
import type { Metadata } from 'next';
import { listStorefrontTiers } from '@/lib/storefront-tiers';
import { getFeaturedEvent, listUpcomingEvents } from '@/lib/events';
import { BRAND, REFERRAL, TICKETING_FACTS } from '@/content/site';
import { formatEventDate, formatEventTime, formatInr } from '@/lib/utils';
import { Reveal } from '@/components/ui/Reveal';
import { Marquee } from '@/components/ui/Marquee';
import { Magnetic } from '@/components/ui/Magnetic';
import { Countdown } from '@/components/ui/Countdown';
import { PosterCard } from '@/components/event/PosterCard';
import { ActivityGrid } from '@/components/event/ActivityGrid';
import { Runsheet } from '@/components/event/Runsheet';
import { TicketRail } from '@/components/event/TicketRail';
import { StickyBuyBar } from '@/components/event/StickyBuyBar';
import { PosterIntro } from '@/components/site/PosterIntro';
import { HowItWorks } from '@/components/home/HowItWorks';
import { Accordion } from '@/components/events/Accordion';
import { NoEventYet } from '@/components/home/NoEventYet';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const featured = await getFeaturedEvent().catch(() => null);
  if (!featured) {
    return { title: BRAND.name, description: BRAND.description, alternates: { canonical: '/' } };
  }
  const { row, dateLabel, edition } = featured;
  const title = edition ? `${row.name} ${edition}` : row.name;
  return {
    title: `${title} — ${dateLabel}, ${row.venue_name}`,
    description: row.description ?? BRAND.description,
    alternates: { canonical: '/' },
  };
}

export default async function HomePage() {
  /*
   * Whatever event the site is currently about.
   *
   * This used to be `getEventBySlug(FEATURED_EVENT_SLUG)` against a constant,
   * which meant the home page went on selling a party after it had happened
   * until somebody shipped a release. The rule is now a query: the next
   * published date that has not finished, with a manual pin available. See
   * lib/events.ts.
   */
  const featured = await getFeaturedEvent().catch(() => null);

  // Nothing published at all — a fresh deployment, or every date archived.
  // Better an honest "nothing announced" than a page describing an event that
  // does not exist.
  if (!featured) return <NoEventYet />;

  const { row: event, content, dateLabel, dateShort, timeLabel, edition, isPast } = featured;
  const tiers = await listStorefrontTiers(event.id);

  const onSale = tiers.filter((tier) => tier.remaining > 0);
  // Math.min() with no arguments is Infinity, so an all-sold-out event has to
  // fall through to null rather than advertise an impossible price.
  const fromPaise = onSale.length ? Math.min(...onSale.map((tier) => tier.pricePaise)) : null;
  const remaining = tiers.reduce((sum, tier) => sum + tier.remaining, 0);
  /*
   * Sold out is either answer: nothing left, or sales deliberately closed.
   *
   * The status is what closes the shop on the night, and it does so without
   * zeroing any stock — the console still has to be able to issue a pass by
   * hand, and that path refuses when a tier has no remaining quantity.
   */
  const soldOut = event.status === 'sold_out' || (tiers.length > 0 && remaining === 0);

  /*
   * A finished event is shown, never sold.
   *
   * The featured event falls back to the most recent past date when nothing is
   * upcoming, so the site still has something to be about while the next one
   * is being put together. Every buy affordance below is gated on this.
   */
  const sellable = !isPast && event.status !== 'cancelled';

  const doorsLabel = formatEventTime(event.doors_at ?? event.starts_at);
  const weekday = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(event.starts_at));

  // The venue's address, from the editorial layer if it has one and from the
  // row's own single-line address if not, so a freshly created event still
  // prints somewhere to go.
  const addressLines =
    content.venue.addressLines.length > 0
      ? content.venue.addressLines
      : [event.venue_address, event.city].filter((line): line is string => Boolean(line));
  const bookHref = `/book?event=${event.slug}`;
  const eventHref = `/events/${event.slug}`;

  const ticker =
    content.ticker.length > 0
      ? content.ticker
      : [
          event.name,
          edition,
          dateShort,
          event.venue_name,
          timeLabel,
          event.city,
        ]
          .filter((line): line is string => Boolean(line && line.trim()))
          .map((line) => line.toUpperCase());

  return (
    <>
      {/* The artwork, staged as the way in. Landing page only — an intro in
          front of a checkout would be sabotage. */}
      <PosterIntro />

      {/* ================================================================== */}
      {/* Hero                                                               */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden pb-20 pt-32 sm:pt-36 lg:pb-28 lg:pt-40">
        {/* Halftone off the artwork, opposite the cluster so the hero has
            texture on the type side without anything sitting under the words. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 bottom-[-4%] -z-10 hidden h-[440px] w-[440px] halftone opacity-40 mask-fade-t lg:block"
        />

        <div className="shell relative">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            <div>
              <Reveal>
                <p className="kicker">{content.presentedBy}</p>
              </Reveal>

              <Reveal delay={0.06}>
                <h1 className="h-hero mt-5 font-semibold lg:w-[118%]">
                  <span className="lg:block">The first</span>{' '}
                  <span className="lg:block lg:whitespace-nowrap">party of your</span>{' '}
                  <span className="lg:block lg:whitespace-nowrap">
                    <span className="accent gradient-text">first year</span>.
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={0.12}>
                <p className="lede mt-6 max-w-lg">{content.subhead}</p>
              </Reveal>

              <Reveal delay={0.18}>
                <dl className="card mt-9 grid max-w-xl grid-cols-2 gap-px overflow-hidden bg-ink/[0.06] sm:grid-cols-4">
                  <HeroFact label="Date" value={dateShort} sub={weekday} />
                  <HeroFact label="Time" value="12—4" sub="PM, sharp" />
                  <HeroFact
                    label="Venue"
                    value={event.venue_name}
                    sub={content.venue.area || event.city}
                  />
                  <HeroFact label="Bar" value="Zero proof" sub="Non-alcoholic" />
                </dl>
              </Reveal>

              <Reveal delay={0.24}>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  {sellable ? (
                    <Magnetic>
                      <Link href={bookHref} className="btn-primary text-base">
                        {soldOut
                          ? 'Join the waitlist'
                          : fromPaise !== null
                            ? `Buy tickets — from ${formatInr(fromPaise)}`
                            : 'Buy tickets'}
                      </Link>
                    </Magnetic>
                  ) : (
                    <Magnetic>
                      <Link href="/events" className="btn-primary text-base">
                        See upcoming dates
                      </Link>
                    </Magnetic>
                  )}
                  <Link href="#lineup" className="btn-outline text-base">
                    See what&apos;s on
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={0.3}>
                <p className="mt-5 text-[0.8125rem] text-muted">
                  QR pass emailed the moment you pay · One scan per person ·{' '}
                  {remaining > 0 && remaining <= 80 ? (
                    <span className="font-semibold text-flare-600">{remaining} left</span>
                  ) : (
                    'Capacity capped'
                  )}
                </p>
              </Reveal>
            </div>

            <Reveal delay={0.16} direction="none">
              <div className="flex justify-center lg:justify-end">
                <PosterCard
                  title={event.name}
                  subtitle={event.tagline ?? edition ?? undefined}
                  edition={edition || undefined}
                  venue={
                    content.venue.area ? `${event.venue_name}, ${content.venue.area}` : event.venue_name
                  }
                  dateLine={`${dateShort} · ${timeLabel}`}
                />
              </div>
            </Reveal>
          </div>

          {event && (
            <Reveal delay={0.36}>
              <div className="card mt-16 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                <div>
                  <p className="kicker kicker-rule">Doors open in</p>
                  <p className="mt-1.5 text-[0.9375rem] text-slate">
                    {dateLabel} · {doorsLabel}
                  </p>
                </div>
                <Countdown target={event.doors_at ?? event.starts_at} className="sm:max-w-md" />
              </div>
            </Reveal>
          )}
        </div>
      </section>

      <div className="shell">
        <div className="overflow-hidden rounded-pill bg-aurora shadow-glow">
          <Marquee items={ticker} speedSeconds={44} />
        </div>
      </div>

      {/* ================================================================== */}
      {/* What it is                                                          */}
      {/* ================================================================== */}
      <section className="section shell" aria-labelledby="about-party">
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <Reveal>
              <div className="edit-head">
                <h2 id="about-party" className="h-section max-w-[16ch]">
                  Four hours, one rooftop, the whole batch.
                </h2>
                <span className="edit-index">01 — The party</span>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="lede mt-6">{content.standfirst}</p>
            </Reveal>
            <Reveal delay={0.14}>
              <div className="mt-6 space-y-4 text-[0.9375rem] leading-relaxed text-slate">
                {content.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 24)}>{paragraph}</p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={eventHref} className="btn-outline btn-sm">
                  Full event details
                </Link>
                <Link href="#tickets" className="btn-quiet">
                  Jump to prices →
                </Link>
              </div>
            </Reveal>
          </div>

          <div>
            <Reveal delay={0.1}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-display text-[1.15rem] font-semibold tracking-[-0.02em] text-ink">
                  How the day runs
                </p>
                <span className="chip chip-quiet">12 — 5 PM</span>
              </div>
            </Reveal>
            <div className="mt-8">
              <Runsheet slots={content.runsheet} />
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Activities                                                          */}
      {/* ================================================================== */}
      <section id="lineup" className="shell scroll-mt-28" aria-labelledby="activities">
        <div className="slab section px-5 sm:px-8 lg:px-12">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-24 top-0 h-full w-[42%] halftone opacity-50 mask-fade-x"
          />
          <div className="relative">
            <Reveal>
              <div className="edit-head">
                <h2 id="activities" className="h-section">
                  Everything running, all afternoon.
                </h2>
                <span className="edit-index">02 — What&apos;s on</span>
              </div>
              <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
                <p className="lede max-w-xl">
                  All of it is included with entry. Nothing here costs extra at the door.
                </p>
                {event.venue_name && <p className="chip chip-quiet">At {event.venue_name}</p>}
              </div>
            </Reveal>

            <div className="mt-10">
              <ActivityGrid activities={content.activities} />
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Tickets                                                             */}
      {/* ================================================================== */}
      {sellable && (
      <section id="tickets" className="section shell" aria-labelledby="tickets-heading">
        <Reveal>
          <div className="edit-head">
            <h2 id="tickets-heading" className="h-section">
              {soldOut ? 'Sold out.' : 'Pass pricing.'}
            </h2>
            <span className="edit-index">03 — Tickets</span>
          </div>
          <p className="lede mt-4 max-w-2xl">
            {soldOut
              ? 'Every tier has gone. Returns are posted on Instagram before anywhere else.'
              : `Choose the pass that fits your group. A referral code takes a flat ₹${REFERRAL.discountRupees} off your cart.`}
          </p>
        </Reveal>

        <div className="mt-12">
          <TicketRail tiers={tiers} eventSlug={event.slug} showReferralNote={false} />
        </div>

        {/* Referral programme */}
        <Reveal delay={0.1}>
          <div className="card mt-10 flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <h3 className="h-card">{REFERRAL.headline}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate">{REFERRAL.copy}</p>
            </div>
            {/* The code as a coupon: a dashed well, tinted, sized so it reads
                as something to copy rather than something to fill in. */}
            <div className="shrink-0">
              <p className="rounded-md border border-dashed border-vybe-300 bg-vybe-50 px-6 py-4 text-center font-mono text-[1.0625rem] font-semibold tracking-[0.18em] text-vybe-700">
                {REFERRAL.sampleCode}
              </p>
              <p className="mt-2 text-center font-mono text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-muted">
                ₹100 off · try it
              </p>
            </div>
          </div>
        </Reveal>
      </section>
      )}

      {/* ================================================================== */}
      {/* How booking works                                                   */}
      {/* ================================================================== */}
      <section className="shell" aria-labelledby="how">
        <div className="slab section px-5 sm:px-8 lg:px-12">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-24 bottom-0 h-[70%] w-[38%] halftone opacity-50 mask-fade-x"
          />
          <div className="relative">
            <Reveal>
              <div className="edit-head">
                <h2 id="how" className="h-section">
                  Three steps, about ninety seconds.
                </h2>
                <span className="edit-index">04 — Booking</span>
              </div>
            </Reveal>

            <HowItWorks />

            {/* The reassurance strip. Four facts, four plates, no rules — a
                bordered table here competed with the step cards above it. */}
            <Reveal delay={0.15}>
              <dl className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {TICKETING_FACTS.map((fact) => (
                  <div key={fact.label} className="rounded-lg bg-frost p-5 ring-hair">
                    <dt className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-vybe-700">
                      {fact.label}
                    </dt>
                    <dd className="mt-2.5 font-display text-[1.3rem] font-semibold tracking-[-0.02em] text-ink">
                      {fact.value}
                    </dd>
                    <p className="mt-2 text-[0.8125rem] leading-relaxed text-slate">{fact.detail}</p>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Venue                                                               */}
      {/* ================================================================== */}
      <section className="section shell" aria-labelledby="venue">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div>
              <div className="edit-head">
                <h2 id="venue" className="h-section">
                  {event.venue_name}
                  {content.venue.area ? `, ${content.venue.area}` : ''}.
                </h2>
                <span className="edit-index">05 — Getting there</span>
              </div>
              <address className="mt-5 not-italic text-[1.0625rem] leading-relaxed text-slate">
                {addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-slate">
                {content.venue.landmark ? `${content.venue.landmark}. ` : ''}Cabs drop right at
                the entrance. On-site parking is limited on the day, so a cab is usually the faster
                call.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={content.venue.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline btn-sm"
                >
                  Open in Maps
                </a>
                <Link href="/contact" className="btn-quiet">
                  Ask us something →
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 bg-aurora-soft px-6 py-4">
                <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-vybe-700">
                  At the door
                </p>
                <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-slate">
                  House rules
                </span>
              </div>
              <ol className="divide-y divide-ink/[0.07]">
                {content.entryRules.map((rule, index) => (
                  <li key={rule} className="flex gap-4 px-6 py-4 text-[0.9375rem] leading-relaxed text-slate">
                    <span className="tnum mt-px shrink-0 font-mono text-[0.75rem] font-semibold text-vybe-600">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {rule}
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================================================================== */}
      {/* FAQ                                                                 */}
      {/* ================================================================== */}
      <section className="shell" aria-labelledby="faq">
        <div className="slab section relative grid gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-12">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-20 bottom-0 h-[60%] w-[36%] halftone opacity-50 mask-fade-x"
          />
          <Reveal>
            <div className="relative lg:sticky lg:top-28 lg:self-start">
              <span className="edit-index">06 — Questions</span>
              <h2 id="faq" className="h-section mt-3">
                Everything people ask.
              </h2>
              <p className="lede mt-4">
                Still stuck? Email{' '}
                <a href={`mailto:${BRAND.supportEmail}`} className="link-swipe font-medium">
                  {BRAND.supportEmail}
                </a>{' '}
                and a person will reply.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.08} className="relative">
            <Accordion items={content.faqs.map((faq) => ({ question: faq.q, answer: faq.a }))} />
          </Reveal>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Closing CTA                                                         */}
      {/* ================================================================== */}
      <section className="shell pb-24 pt-20">
        <Reveal>
          {/* The closing move: one dark plate, floating high off the page, with
              the live counter doing the persuading instead of an exclamation
              mark. Everything else on the page is white and low — this is the
              only surface allowed to be loud, and it earns that by being last. */}
          <div className="slab-deep px-6 py-14 text-center sm:px-12 sm:py-16">
            <span aria-hidden className="pointer-events-none absolute inset-0 gridfield opacity-30" />
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-0 h-72 w-[38rem] max-w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-pill bg-vybe-500/30 blur-3xl"
            />

            <div className="relative mx-auto max-w-2xl">
              <p className="chip chip-invert mx-auto">
                {dateShort} · {event.venue_name} · {timeLabel}
              </p>
              <h2 className="mt-6 font-display text-[clamp(2.125rem,5.5vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.035em] text-white">
                {!sellable
                  ? 'That one is done.'
                  : soldOut
                    ? 'That was quick.'
                    : `The room holds ${event.capacity.toLocaleString('en-IN')} people.`}
              </h2>
              <p className="mx-auto mt-5 max-w-md text-[1.0625rem] leading-relaxed text-vybe-100/90">
                {!sellable
                  ? 'The next date goes on sale here first. Follow along and you will not miss it.'
                  : soldOut
                    ? 'Every ticket has gone. Returns get posted on Instagram first, so keep an eye there.'
                    : 'Sales close on their own when it is full. Grab yours while there is one left.'}
              </p>

              <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Magnetic>
                  <Link
                    href={!sellable ? BRAND.instagram : soldOut ? BRAND.instagram : bookHref}
                    className="btn btn-lg bg-white text-ink shadow-raise transition-transform hover:-translate-y-[2px] hover:shadow-float active:translate-y-0"
                  >
                    {sellable && !soldOut ? 'Buy your ticket' : 'Follow for the next one'}
                  </Link>
                </Magnetic>
                <Link
                  href="/faq"
                  className="btn btn-lg bg-white/[0.08] text-white transition-colors hover:bg-white/[0.16]"
                >
                  Read the FAQ
                </Link>
              </div>

              <p className="mt-8 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-white/45">
                Non-transferable · one scan per pass
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {sellable && (
        <StickyBuyBar
          fromPaise={fromPaise}
          soldOut={soldOut}
          title={`${event.name} · ${dateShort}`}
          href={`${bookHref}#tickets`}
        />
      )}
    </>
  );
}

/**
 * One fact in the hero plate. The cells are separated by the grid's own 1px
 * gap showing the plate's tint through, so there is not a border anywhere in
 * the component and the dividers can never mis-join at a wrap.
 */
function HeroFact({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-paper px-5 py-4">
      <dt className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-vybe-700">
        {label}
      </dt>
      <dd className="tnum mt-2 font-display text-[1.3rem] font-semibold leading-none tracking-[-0.03em] text-ink">
        {value}
      </dd>
      <p className="mt-1.5 text-[0.8125rem] text-slate">{sub}</p>
    </div>
  );
}

