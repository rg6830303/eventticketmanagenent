import Link from 'next/link';
import type { Metadata } from 'next';
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
  'BABYLON 2.0',
  '12.09.2026',
  'NON-STOP DJ',
  'NANAKRAMGUDA',
  '12PM — 5PM',
];

export default async function HomePage() {
  const event = await getEventBySlug(FEATURED_EVENT_SLUG).catch(() => null);
  const tierRows = event ? await listTiers(event.id).catch(() => []) : [];

  const tiers: RailTier[] = tierRows.map((tier) => ({
    code: tier.code,
    name: tier.name,
    description: tier.description,
    pricePaise: tier.price_paise,
    remaining: Math.max(0, tier.quantity - tier.sold),
    total: tier.quantity,
    perks: Array.isArray(tier.perks) ? tier.perks : [],
  }));

  const onSale = tiers.filter((tier) => tier.remaining > 0);
  // Math.min() with no arguments is Infinity, so an all-sold-out event has to
  // fall through to null rather than advertise an impossible price.
  const fromPaise = onSale.length ? Math.min(...onSale.map((tier) => tier.pricePaise)) : null;
  const remaining = tiers.reduce((sum, tier) => sum + tier.remaining, 0);
  const soldOut = tiers.length > 0 && remaining === 0;

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
                <h1 className="h-hero mt-5">
                  The first party of your{' '}
                  <span className="accent text-vybe-600">first year</span>.
                </h1>
              </Reveal>

              <Reveal delay={0.12}>
                <p className="lede mt-6 max-w-lg">{EVENT.subhead}</p>
              </Reveal>

              <Reveal delay={0.18}>
                <dl className="mt-9 grid max-w-xl grid-cols-2 border-y-2 border-ink sm:grid-cols-4">
                  <HeroFact label="Date" value={EVENT.dateShort} sub="Saturday" />
                  <HeroFact label="Time" value="12—5" sub="PM, sharp" />
                  <HeroFact label="Venue" value="Babylon" sub={EVENT.venue.area} />
                  <HeroFact label="Entry" value={EVENT.ageLabel} sub="Photo ID" />
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
              <div className="card-print mt-16 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
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

      <div className="border-y-2 border-ink bg-vybe-500">
        <Marquee items={TICKER} speedSeconds={44} />
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
                  Five hours, one rooftop, the whole batch.
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
              <div className="flex items-baseline justify-between border-b-2 border-ink pb-3">
                <p className="font-display text-[1.15rem] font-semibold tracking-[-0.02em] text-ink">
                  How the day runs
                </p>
                <span className="edit-index">12 — 5 PM</span>
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
      <section id="lineup" className="section slab overflow-hidden" aria-labelledby="activities">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-0 h-full w-[42%] halftone opacity-[0.35] mask-fade-x"
        />
        <div className="shell relative">
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
              <p className="font-mono text-[0.75rem] uppercase tracking-[0.12em] text-muted">
                With {PARTNER.name}
              </p>
            </div>
          </Reveal>

          <div className="mt-10">
            <ActivityGrid />
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
              One price for everyone. No guest list.
            </h2>
            <span className="edit-index">03 — Tickets</span>
          </div>
          <p className="lede mt-4 max-w-2xl">
            Stock below is live. When a tier runs out it stops selling on its own — we do not
            oversell the room and there is no list at the gate.
          </p>
        </Reveal>

        <div className="mt-12">
          <TicketRail tiers={tiers} showReferralNote={false} />
        </div>

        {/* Referral programme */}
        <Reveal delay={0.1}>
          <div className="card-print mt-10 flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <h3 className="h-card">{REFERRAL.headline}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate">{REFERRAL.copy}</p>
            </div>
            {/* The code as a coupon to tear off: dashed rule, rotated a hair. */}
            <div className="shrink-0 -rotate-1">
              <p className="rounded-[10px] border-[1.5px] border-dashed border-ink bg-vybe-100 px-5 py-3.5 font-mono text-[1rem] font-medium tracking-[0.16em] text-ink shadow-press-sm">
                {REFERRAL.sampleCode}
              </p>
              <p className="mt-1.5 text-center font-mono text-[0.625rem] uppercase tracking-[0.2em] text-muted">
                ₹100 off · try it
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ================================================================== */}
      {/* How booking works                                                   */}
      {/* ================================================================== */}
      <section className="section slab overflow-hidden" aria-labelledby="how">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 bottom-0 h-[70%] w-[38%] halftone opacity-[0.3] mask-fade-x"
        />
        <div className="shell relative">
          <Reveal>
            <div className="edit-head">
              <h2 id="how" className="h-section">
                Three steps, about ninety seconds.
              </h2>
              <span className="edit-index">04 — Booking</span>
            </div>
          </Reveal>

          <HowItWorks />

          <Reveal delay={0.15}>
            <dl className="mt-14 grid border-t-2 border-ink sm:grid-cols-2 lg:grid-cols-4">
              {TICKETING_FACTS.map((fact) => (
                <div
                  key={fact.label}
                  className="border-b border-ink/20 px-0 py-5 sm:px-6 lg:border-b-0 lg:py-6 lg:first:pl-0 lg:[&:not(:first-child)]:border-l lg:[&:not(:first-child)]:border-l-ink/20"
                >
                  <dt className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-vybe-700">
                    {fact.label}
                  </dt>
                  <dd className="mt-2 font-display text-[1.375rem] font-semibold tracking-[-0.02em] text-ink">
                    {fact.value}
                  </dd>
                  <p className="mt-2 text-[0.8125rem] leading-relaxed text-slate">{fact.detail}</p>
                </div>
              ))}
            </dl>
          </Reveal>
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
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(EVENT.venue.mapsQuery)}`}
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
            <div className="card-print overflow-hidden">
              <div className="flex items-center justify-between border-b-[1.5px] border-ink bg-vybe-100 px-6 py-3.5">
                <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-ink">
                  At the door
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
          </Reveal>
        </div>
      </section>

      {/* ================================================================== */}
      {/* FAQ                                                                 */}
      {/* ================================================================== */}
      <section className="section slab overflow-hidden" aria-labelledby="faq">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 bottom-0 h-[60%] w-[36%] halftone opacity-[0.35] mask-fade-x"
        />
        <div className="shell relative grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <Reveal>
            <div className="lg:sticky lg:top-28 lg:self-start">
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

          <Reveal delay={0.08}>
            <Accordion
              items={EVENT.faqs.map((faq) => ({ question: faq.q, answer: faq.a }))}
            />
          </Reveal>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Closing CTA                                                         */}
      {/* ================================================================== */}
      <section className="shell pb-24 pt-20">
        <Reveal>
          {/* The closing move is one oversized ticket, not a centred slogan
              band: stub column on the left with a real tear line, the pitch
              set left in the body, a barcode along the foot. */}
          <div className="relative overflow-hidden rounded-[18px] border-2 border-ink bg-ink text-white shadow-stamp-lg">
            <span aria-hidden className="absolute inset-0 gridfield opacity-[0.14]" />
            <div className="relative grid sm:grid-cols-[110px_1fr]">
              {/* Stub. Rotated caption, punched notches on the tear line. */}
              <div className="relative hidden items-center justify-center border-r-2 border-dashed border-white/35 sm:flex">
                <span
                  aria-hidden
                  className="absolute -top-[11px] right-[-11px] h-5 w-5 rounded-full border-b-2 border-ink bg-canvas"
                />
                <span
                  aria-hidden
                  className="absolute -bottom-[11px] right-[-11px] h-5 w-5 rounded-full border-t-2 border-ink bg-canvas"
                />
                <p className="-rotate-90 whitespace-nowrap font-mono text-[0.6875rem] uppercase tracking-[0.32em] text-white/60">
                  Admit one · {EVENT.dateShort}
                </p>
              </div>

              <div className="px-6 py-12 sm:px-12 sm:py-14">
                <p className="font-mono text-[0.6875rem] uppercase tracking-[0.24em] text-vybe-200">
                  {EVENT.dateShort} · {EVENT.venue.name} · {EVENT.timeLabel}
                </p>
                <h2 className="mt-5 max-w-[18ch] font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.02] tracking-[-0.035em] text-white">
                  {soldOut ? 'That was quick.' : 'The room holds 400 people.'}
                </h2>
                <p className="mt-4 max-w-md text-[1.0625rem] leading-relaxed text-vybe-100">
                  {soldOut
                    ? 'Every ticket has gone. Returns get posted on Instagram first, so keep an eye there.'
                    : 'Sales close on their own when it is full. Grab yours while there is one left.'}
                </p>
                <div className="mt-8">
                  <Magnetic>
                    <Link
                      href={soldOut ? BRAND.instagram : '/book'}
                      className="btn inline-flex border-white bg-white px-8 py-4 text-base text-ink shadow-[3px_3px_0_0_rgba(255,255,255,0.35)] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0_0_rgba(255,255,255,0.35)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                    >
                      {soldOut ? 'Follow for returns' : 'Buy your ticket'}
                    </Link>
                  </Magnetic>
                </div>
              </div>
            </div>
            <div className="relative flex items-center justify-between gap-4 border-t border-white/25 px-6 py-3 sm:px-12">
              <span aria-hidden className="barcode h-6 w-32 opacity-60 invert" />
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-white/50">
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

function HeroFact({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="border-l border-ink/25 px-4 py-4 first:border-l-0 first:pl-0 max-sm:[&:nth-child(3)]:border-l-0 max-sm:[&:nth-child(3)]:pl-0 max-sm:[&:nth-child(n+3)]:border-t max-sm:[&:nth-child(n+3)]:border-t-ink/25">
      <dt className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-vybe-700">
        {label}
      </dt>
      <dd className="tnum mt-2 font-display text-[1.375rem] font-semibold leading-none tracking-[-0.03em] text-ink">
        {value}
      </dd>
      <p className="mt-1 text-[0.8125rem] text-slate">{sub}</p>
    </div>
  );
}
