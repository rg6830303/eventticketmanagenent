import Link from 'next/link';
import type { Metadata } from 'next';
import { getEventBySlug, listTiers } from '@/lib/bookings';
import { BRAND, FEATURED_EVENT_SLUG, OFFCAMPUS, VENUE } from '@/content/site';
import { formatEventDate, formatEventTime, formatInr } from '@/lib/utils';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Marquee } from '@/components/ui/Marquee';
import { Magnetic } from '@/components/ui/Magnetic';
import { Countdown } from '@/components/ui/Countdown';
// Client component that renders null until it has mounted and confirmed WebGL,
// so it contributes nothing to SSR and never blocks the hero's first paint.
import { HeroScene } from '@/components/three/HeroScene';
import { SafeDecoration } from '@/components/ui/SafeDecoration';
import { Globe } from '@/components/brand/Globe';
import { Ticket3D } from '@/components/game/Ticket3D';
import { ScarcityMeter } from '@/components/game/ScarcityMeter';
import { VibeQuiz } from '@/components/game/VibeQuiz';
import { HeroParallax } from '@/components/home/HeroParallax';
import { HowItWorks } from '@/components/home/HowItWorks';
import { PlatformFacts } from '@/components/home/PlatformFacts';
import { Promises } from '@/components/home/Promises';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
  alternates: { canonical: '/' },
};

const MARQUEE = [
  'HYDERABAD',
  'AFTER DARK',
  'THREE ROOMS',
  'OFFCAMPUS',
  'QR AT THE DOOR',
  'CAPPED CAPACITY',
];

export default async function HomePage() {
  const event = await getEventBySlug(FEATURED_EVENT_SLUG).catch(() => null);
  const tiers = event ? await listTiers(event.id).catch(() => []) : [];

  const available = tiers.filter((tier) => tier.quantity > tier.sold);
  // Math.min() with no arguments is Infinity, so an all-sold-out event has to
  // fall through to null rather than quietly advertising an impossible price.
  const lowestPrice = available.length
    ? Math.min(...available.map((tier) => tier.price_paise))
    : null;
  const remaining = tiers.reduce((sum, tier) => sum + Math.max(0, tier.quantity - tier.sold), 0);
  const stock = tiers.map((tier) => ({
    code: tier.code,
    name: tier.name,
    remaining: Math.max(0, tier.quantity - tier.sold),
    total: tier.quantity,
  }));

  const priceLine =
    lowestPrice === null ? '' : lowestPrice > 0 ? `From ${formatInr(lowestPrice)} · ` : 'Free entry · ';

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative flex min-h-[100dvh] items-center overflow-hidden">
        {/* The mark itself, blown up and turning behind the headline. Red at
            8% is a watermark; any louder and it competes with the blue. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
        >
          <Globe
            spin
            strokeWidth={0.7}
            className="h-[120vmin] w-[120vmin] max-w-none text-flare/[0.08]"
          />
        </div>

        {/* Ornamental only — if WebGL fails on the visitor's machine the hero
            must still render, so it can never reach the root boundary. */}
        <SafeDecoration label="hero-webgl">
          <HeroScene className="pointer-events-none absolute inset-0 -z-10 opacity-60" />
        </SafeDecoration>
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 grid-overlay" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-void to-transparent"
        />

        <HeroParallax className="container-hov relative w-full pt-28">
          <Reveal>
            <p className="eyebrow mb-5">
              {BRAND.city} · Season One · 21+
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="display-1 max-w-[14ch]">
              Nights that <span className="text-gradient">actually move.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="lede mt-7 max-w-xl">{BRAND.description}</p>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Magnetic>
                <Link href="/book" className="btn-primary px-8 py-4 text-[15px]">
                  Book tickets
                </Link>
              </Magnetic>
              <Link href="/events/offcampus" className="btn-secondary px-8 py-4 text-[15px]">
                See the night
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.32}>
            <p className="mt-6 text-[12px] text-dim">
              {priceLine}QR ticket emailed instantly · One scan per pass
            </p>
          </Reveal>
        </HeroParallax>

        <div
          aria-hidden
          className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 sm:flex"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">Scroll</span>
          <span className="h-10 w-px animate-float bg-gradient-to-b from-vybe-400 to-transparent" />
        </div>
      </section>

      <div className="border-y border-hairline bg-ink/50">
        <Marquee items={MARQUEE} speedSeconds={42} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Featured event                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="section container-hov" aria-label="Next event">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
          <div>
            <Reveal>
              <p className="eyebrow mb-4">{OFFCAMPUS.eyebrow}</p>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 className="display-2">{OFFCAMPUS.title}</h2>
              <p className="mt-2 font-display text-xl text-vybe-300">{OFFCAMPUS.subtitle}</p>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="lede mt-6">{OFFCAMPUS.blurb}</p>
            </Reveal>

            {event ? (
              <>
                <Reveal delay={0.18}>
                  <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <Detail label="Date" value={formatEventDate(event.starts_at)} />
                    <Detail label="Doors" value={formatEventTime(event.doors_at ?? event.starts_at)} />
                    <Detail label="Venue" value={event.venue_name} />
                    <Detail
                      label="Tickets left"
                      value={remaining > 0 ? String(remaining) : 'Sold out'}
                    />
                  </dl>
                </Reveal>
                <Reveal delay={0.24}>
                  <div className="mt-8">
                    <Countdown target={event.starts_at} />
                  </div>
                </Reveal>
                {stock.length > 0 && (
                  <Reveal delay={0.3}>
                    <div className="mt-8">
                      <ScarcityMeter tiers={stock} />
                    </div>
                  </Reveal>
                )}
              </>
            ) : (
              <Reveal delay={0.18}>
                <p className="mt-8 rounded-xl border border-hairline bg-surface/60 px-4 py-3 text-[13px] text-haze">
                  Dates for the next edition are being confirmed. Check back shortly.
                </p>
              </Reveal>
            )}

            <Reveal delay={0.36}>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/events/offcampus" className="btn-primary">
                  Full line-up
                </Link>
                {event && remaining > 0 && (
                  <Link href="/book?event=offcampus" className="btn-ghost">
                    Book now
                  </Link>
                )}
              </div>
            </Reveal>
          </div>

          {/* Entrance travels on Y, not X: a horizontal offset on a full-bleed
              column pushes past the container edge and scrolls the page. */}
          <Reveal delay={0.14}>
            <Ticket3D
              eventName={OFFCAMPUS.title}
              date={event ? formatEventDate(event.starts_at) : 'Date being confirmed'}
              venue={event?.venue_name ?? VENUE.name}
              tierName={tiers[0]?.name ?? 'General entry'}
            />
            <p className="mt-4 text-center text-[12px] text-dim">
              A preview of the pass. The real one carries your name and a scannable code.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Vibe quiz — the lead magnet                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="section border-y border-hairline bg-ink/40" aria-label="Room finder">
        <div className="container-hov">
          <SectionHeading
            eyebrow="Room finder"
            title="Not sure which ticket?"
            lede="Three rooms, three tempos, one night. Answer a few questions and we will tell you where you are going to spend most of it — then book the pass that gets you in."
            align="center"
          />
          <div className="mt-12">
            <VibeQuiz rooms={OFFCAMPUS.rooms} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How it works                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="section container-hov" aria-label="How booking works">
        <SectionHeading
          eyebrow="How it works"
          title="Four steps from browsing to inside."
          lede="No account, no app, no queue at a will-call desk. Book, get your QR, walk in."
        />
        <HowItWorks />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Platform facts                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="border-y border-hairline bg-ink/40 py-16 sm:py-20"
        aria-label="How the platform works"
      >
        <div className="container-hov">
          <PlatformFacts />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Promises                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="section container-hov" aria-label="Our commitments">
        <SectionHeading
          eyebrow="Commitments"
          title="Four promises we can be held to."
          lede="Not reviews, not ratings — the things the booking system does on every single order."
        />
        <Promises />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Closing CTA                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="container-hov pb-24">
        <Reveal>
          <div className="card card-lit relative overflow-hidden px-6 py-16 text-center sm:px-12 sm:py-20">
            <div aria-hidden className="absolute inset-0 grid-overlay opacity-70" />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <Globe
                spin
                strokeWidth={0.8}
                className="h-[520px] w-[520px] max-w-none text-vybe-300/[0.07]"
              />
            </div>
            <div
              aria-hidden
              className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-vybe-500/25 blur-[100px]"
            />
            <div className="relative">
              <h2 className="display-2 mx-auto max-w-[18ch]">
                The room fills up <span className="text-gradient">faster than you think.</span>
              </h2>
              <p className="lede mx-auto mt-5 max-w-lg">
                We cap capacity and stop selling when it&apos;s reached. Get your pass while there
                is one.
              </p>
              <div className="mt-9">
                <Magnetic>
                  <Link href="/book" className="btn-primary px-10 py-4 text-[15px]">
                    Book your ticket
                  </Link>
                </Magnetic>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-dim">{label}</dt>
      <dd className="mt-1 font-medium text-chalk">{value}</dd>
    </div>
  );
}
