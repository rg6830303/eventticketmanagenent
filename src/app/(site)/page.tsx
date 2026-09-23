import Link from 'next/link';
import type { Metadata } from 'next';
import { listStorefrontTiers } from '@/lib/storefront-tiers';
import { getEventBySlug, listTiers } from '@/lib/bookings';
import { BRAND, EVENT, FEATURED_EVENT_SLUG, PARTNER, REFERRAL, TICKETING_FACTS } from '@/content/site';
import { formatEventDate, formatEventTime, formatInr } from '@/lib/utils';
import { Reveal } from '@/components/ui/Reveal';
import { Marquee } from '@/components/ui/Marquee';
import { Magnetic } from '@/components/ui/Magnetic';
import { Countdown } from '@/components/ui/Countdown';
import { PosterCard } from '@/components/event/PosterCard';
import { ActivityGrid } from '@/components/event/ActivityGrid';
import { Runsheet } from '@/components/event/Runsheet';
import { TicketRail, type RailTier } from '@/components/event/TicketRail';
import { StickyBuyBar } from '@/components/event/StickyBuyBar';
import { PosterIntro } from '@/components/site/PosterIntro';
import { HowItWorks } from '@/components/home/HowItWorks';
import { Accordion } from '@/components/events/Accordion';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${EVENT.name} ${EVENT.edition} — ${EVENT.dateLabel}, ${EVENT.venue.name}`,
  description: BRAND.description,
  alternates: { canonical: '/' },
};

const TICKER = [
  'OFF CAMPUS',
  "FRESHERS '26",
  'KINGDOME KLUB',
  '12.09.2026',
  'NON-STOP DJ',
  'FINANCIAL DISTRICT',
  '12PM — 4PM',
];

export default async function HomePage() {
  const event = await getEventBySlug(FEATURED_EVENT_SLUG).catch(() => null);
  const tierRows = event ? await listTiers(event.id).catch(() => []) : [];
  const tiers = await listStorefrontTiers(event?.id ?? null);

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
  const soldOut = event?.status === 'sold_out' || (tiers.length > 0 && remaining === 0);

  const dateLabel = event ? formatEventDate(event.starts_at) : EVENT.dateLabel;
  const doorsLabel = event ? formatEventTime(event.doors_at ?? event.starts_at) : '12:00 PM';

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
                <p className="kicker">{EVENT.presentedBy}</p>
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
                <p className="lede mt-6 max-w-lg">{EVENT.subhead}</p>
              </Reveal>

              <Reveal delay={0.18}>
                <dl className="card mt-9 grid max-w-xl grid-cols-2 gap-px overflow-hidden bg-ink/[0.06] sm:grid-cols-4">
                  <HeroFact label="Date" value={EVENT.dateShort} sub="Saturday" />
                  <HeroFact label="Time" value="12—4" sub="PM, sharp" />
                  <HeroFact label="Venue" value="Kingdome" sub={EVENT.venue.area} />
                  <HeroFact label="Bar" value="Zero proof" sub="Non-alcoholic" />
                </dl>
              </Reveal>

              <Reveal delay={0.24}>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Magnetic>
                    <Link href="/book" className="btn-primary text-base">
                      {soldOut
                        ? 'Join the waitlist'
                        : fromPaise !== null
                          ? `Buy tickets — from ${formatInr(fromPaise)}`
                          : 'Buy tickets'}
                    </Link>
                  </Magnetic>
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
                <PosterCard />
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
          <Marquee items={TICKER} speedSeconds={44} />
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
              <p className="lede mt-6">{EVENT.standfirst}</p>
            </Reveal>
            <Reveal delay={0.14}>
              <div className="mt-6 space-y-4 text-[0.9375rem] leading-relaxed text-slate">
                {EVENT.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 24)}>{paragraph}</p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/events/offcampus" className="btn-outline btn-sm">
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
              <Runsheet />
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
                <p className="chip chip-quiet">With {PARTNER.name}</p>
              </div>
            </Reveal>

            <div className="mt-10">
              <ActivityGrid />
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Tickets                                                             */}
      {/* ================================================================== */}
      <section id="tickets" className="section shell" aria-labelledby="tickets-heading">
        <Reveal>
          <div className="edit-head">
            <h2 id="tickets-heading" className="h-section">
              Final Phase pass pricing.
            </h2>
            <span className="edit-index">03 — Tickets</span>
          </div>
          <p className="lede mt-4 max-w-2xl">
            Choose a solo pass, come as a group of five, or bring ten. Every Final Phase pass is
            <strong className="text-ink"> zero redeemable</strong> — the price buys entry, and
            nothing is credited at the bar.
          </p>
        </Reveal>

        <div className="mt-12">
          <TicketRail tiers={tiers} showReferralNote={false} />
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
                  {EVENT.venue.name}, {EVENT.venue.area}.
                </h2>
                <span className="edit-index">05 — Getting there</span>
              </div>
              <address className="mt-5 not-italic text-[1.0625rem] leading-relaxed text-slate">
                {EVENT.venue.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-slate">
                {EVENT.venue.landmark}. Cabs drop right at the entrance. On-site parking is limited
                on the day, so a cab is usually the faster call.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={EVENT.venue.mapsUrl}
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
                {EVENT.entryRules.map((rule, index) => (
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
            <Accordion items={EVENT.faqs.map((faq) => ({ question: faq.q, answer: faq.a }))} />
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
                {EVENT.dateShort} · {EVENT.venue.name} · {EVENT.timeLabel}
              </p>
              <h2 className="mt-6 font-display text-[clamp(2.125rem,5.5vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.035em] text-white">
                {soldOut ? 'That was quick.' : 'The room holds 400 people.'}
              </h2>
              <p className="mx-auto mt-5 max-w-md text-[1.0625rem] leading-relaxed text-vybe-100/90">
                {soldOut
                  ? 'Every ticket has gone. Returns get posted on Instagram first, so keep an eye there.'
                  : 'Sales close on their own when it is full. Grab yours while there is one left.'}
              </p>

              <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Magnetic>
                  <Link
                    href={soldOut ? BRAND.instagram : '/book'}
                    className="btn btn-lg bg-white text-ink shadow-raise transition-transform hover:-translate-y-[2px] hover:shadow-float active:translate-y-0"
                  >
                    {soldOut ? 'Follow for returns' : 'Buy your ticket'}
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

      <StickyBuyBar fromPaise={fromPaise} soldOut={soldOut} />
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

