import Link from 'next/link';
import type { Metadata } from 'next';
import { getEventBySlug, listTiers } from '@/lib/bookings';
import { BRAND, FEATURED_EVENT_SLUG, HOW_IT_WORKS, OFFCAMPUS, STATS, TESTIMONIALS, VENUE } from '@/content/site';
import { formatEventDate, formatEventTime, formatInr } from '@/lib/utils';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Marquee } from '@/components/ui/Marquee';
import { Magnetic } from '@/components/ui/Magnetic';
import { Countdown } from '@/components/ui/Countdown';
import { TiltCard, TiltLayer } from '@/components/ui/TiltCard';
// Client component that renders null until it has mounted and confirmed WebGL,
// so it contributes nothing to SSR and never blocks the hero's first paint.
import { HeroScene } from '@/components/three/HeroScene';
import { SafeDecoration } from '@/components/ui/SafeDecoration';

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
  'LIVE SOUND',
  'OFFCAMPUS',
  'NO OVERSELLING',
];

export default async function HomePage() {
  const event = await getEventBySlug(FEATURED_EVENT_SLUG).catch(() => null);
  const tiers = event ? await listTiers(event.id).catch(() => []) : [];
  const lowestPrice = tiers.length
    ? Math.min(...tiers.filter((t) => t.quantity > t.sold).map((t) => t.price_paise))
    : null;
  const remaining = tiers.reduce((sum, tier) => sum + Math.max(0, tier.quantity - tier.sold), 0);

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative flex min-h-[92dvh] items-center overflow-hidden">
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

        <div className="container-hov relative pt-28">
          <Reveal>
            <p className="eyebrow mb-5">
              {BRAND.city} · Est. 2022 · {STATS[0].value} nights
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
              {lowestPrice !== null && lowestPrice > 0
                ? `From ${formatInr(lowestPrice)} · `
                : 'Free entry right now · '}
              QR ticket emailed instantly · 21+
            </p>
          </Reveal>
        </div>

        <div
          aria-hidden
          className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 sm:flex"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">Scroll</span>
          <span className="h-10 w-px animate-float bg-gradient-to-b from-vybe-400 to-transparent" />
        </div>
      </section>

      <div className="border-y border-hairline bg-ink/40">
        <Marquee items={MARQUEE} speedSeconds={38} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Featured event                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="section container-hov">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
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
              </>
            ) : (
              <Reveal delay={0.18}>
                <p className="mt-8 rounded-xl border border-hairline bg-surface/60 px-4 py-3 text-[13px] text-haze">
                  Dates for the next edition are being confirmed. Check back shortly.
                </p>
              </Reveal>
            )}

            <Reveal delay={0.3}>
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

          <Reveal delay={0.14} direction="left">
            <TiltCard intensity={11} className="group">
              <Poster
                title={OFFCAMPUS.title}
                subtitle={OFFCAMPUS.subtitle}
                date={event ? formatEventDate(event.starts_at) : 'Dates soon'}
                venue={VENUE.name}
              />
            </TiltCard>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How it works                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="section border-y border-hairline bg-ink/40">
        <div className="container-hov">
          <SectionHeading
            eyebrow="How it works"
            title="Four steps from browsing to inside."
            lede="No account, no app, no queue at a will-call desk. Book, get your QR, walk in."
          />

          <Stagger className="relative mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Connector runs behind the cards on wide screens only. */}
            <div
              aria-hidden
              className="absolute left-0 top-6 hidden h-px w-full bg-gradient-to-r from-transparent via-hairline to-transparent lg:block"
            />
            {HOW_IT_WORKS.map((step) => (
              <StaggerItem key={step.step} className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-vybe-500/40 bg-void font-mono text-[13px] font-bold text-vybe-300">
                  {step.step}
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-chalk">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-haze">{step.copy}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Stats                                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="container-hov py-16 sm:py-20">
        <Stagger className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {STATS.map((stat) => (
            <StaggerItem key={stat.label} className="text-center">
              <p className="font-display text-4xl font-extrabold text-gradient sm:text-5xl">
                {stat.value}
              </p>
              <p className="mt-2 text-[12px] uppercase tracking-wider text-dim">{stat.label}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Testimonials                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="section container-hov">
        <SectionHeading eyebrow="From the floor" title="What people say the morning after." />

        <Stagger className="mt-12 grid gap-5 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <StaggerItem key={testimonial.name}>
              <figure className="card card-lit h-full p-6 transition-transform duration-300 hover:-translate-y-1.5">
                <blockquote className="text-[15px] leading-relaxed text-chalk">
                  “{testimonial.quote}”
                </blockquote>
                <figcaption className="mt-5 border-t border-hairline pt-4">
                  <p className="text-[13px] font-medium text-chalk">{testimonial.name}</p>
                  <p className="text-[11px] text-dim">{testimonial.context}</p>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </Stagger>
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

/** Event poster drawn entirely in CSS — no image assets, no licensing questions. */
function Poster({
  title,
  subtitle,
  date,
  venue,
}: {
  title: string;
  subtitle: string;
  date: string;
  venue: string;
}) {
  return (
    <div className="card card-lit relative aspect-[3/4] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-vybe-800 via-vybe-950 to-void" />
      <div aria-hidden className="absolute inset-0 grid-overlay opacity-80" />
      <div
        aria-hidden
        className="absolute -right-16 top-8 h-56 w-56 rounded-full bg-pulse-500/25 blur-[70px]"
      />
      <div
        aria-hidden
        className="absolute -bottom-12 -left-10 h-52 w-52 rounded-full bg-vybe-400/25 blur-[70px]"
      />

      {/* Concentric rings — reads as a speaker cone under the type. */}
      <div aria-hidden className="absolute inset-0 flex items-center justify-center">
        {[0, 1, 2].map((ring) => (
          <span
            key={ring}
            className="absolute rounded-full border border-pulse-400/20"
            style={{
              width: `${45 + ring * 22}%`,
              aspectRatio: '1',
              animation: `float ${7 + ring * 1.5}s ease-in-out infinite`,
              animationDelay: `${ring * 0.4}s`,
            }}
          />
        ))}
      </div>

      <TiltLayer z={55} className="absolute inset-0 flex flex-col justify-between p-7">
        <div className="flex items-start justify-between">
          <span className="badge">Season One</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-chalk/60">
            HOV·001
          </span>
        </div>

        <div>
          <p className="font-display text-5xl font-extrabold leading-none tracking-tight text-white sm:text-6xl">
            {title}
          </p>
          <p className="mt-2 font-display text-lg text-pulse-300">{subtitle}</p>
          <div className="mt-6 h-px w-full bg-gradient-to-r from-white/40 to-transparent" />
          <p className="mt-4 text-[13px] font-medium text-white/85">{date}</p>
          <p className="text-[12px] text-white/55">{venue}</p>
        </div>
      </TiltLayer>
    </div>
  );
}
