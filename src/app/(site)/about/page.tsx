import Link from 'next/link';
import type { Metadata } from 'next';
import { ABOUT_STORY, BRAND, EVENT, PARTNER, TICKETING_FACTS } from '@/content/site';
import { Magnetic } from '@/components/ui/Magnetic';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal';
import { PosterCard } from '@/components/event/PosterCard';

export const metadata: Metadata = {
  title: 'About',
  description: `${BRAND.name} throws day parties for college crowds in Hyderabad. We run our own door, our own sound and our own ticketing.`,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-14 pt-32 sm:pt-40">

        <div className="shell">
          <Reveal>
            <span className="edit-index">Houz of Vybe — About</span>
          </Reveal>
          <Reveal delay={0.06}>
            <h1 className="h-hero mt-4 max-w-[16ch]">{ABOUT_STORY.heading}</h1>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-muted">
              <span className="text-vybe-600">{BRAND.city}</span>
              <span aria-hidden className="text-edgeStrong">/</span>
              <span>{BRAND.tagline}</span>
              <span aria-hidden className="text-edgeStrong">/</span>
              <span>Independent</span>
            </p>
          </Reveal>
        </div>
      </section>

      <section className="section shell border-t border-edge">
        <div className="grid gap-14 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
          <div className="space-y-7">
            {ABOUT_STORY.paragraphs.map((paragraph, index) => (
              <Reveal key={paragraph.slice(0, 20)} delay={0.05 * index}>
                <p className="text-[1.0625rem] leading-[1.75] text-slate sm:text-lg">
                  {index === 0 ? (
                    <span className="float-left mr-3 mt-1.5 font-display text-[3.25rem] font-bold leading-[0.72] text-vybe-600">
                      {paragraph.slice(0, 1)}
                    </span>
                  ) : null}
                  {index === 0 ? paragraph.slice(1) : paragraph}
                </p>
              </Reveal>
            ))}

            <Reveal delay={0.2}>
              <p className="rounded-[16px] border border-edge bg-frost px-5 py-4 text-[0.9375rem] leading-relaxed text-slate">
                {EVENT.name} {EVENT.edition} is produced with {PARTNER.name} at {EVENT.venue.name},{' '}
                {EVENT.venue.area}.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1} direction="none" className="lg:sticky lg:top-28 lg:self-start">
            <div className="flex justify-center lg:justify-end">
              <PosterCard className="max-w-[380px]" />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section slab">
        <div className="shell">
          <Reveal>
            <div className="edit-head">
              <h2 className="h-section">Three things we do not bend on.</h2>
              <span className="edit-index">01 — How we work</span>
            </div>
          </Reveal>

          <Stagger className="mt-12 grid gap-5 lg:grid-cols-3">
            {ABOUT_STORY.values.map((value, index) => (
              <StaggerItem key={value.title}>
                <div className="group h-full rounded-[20px] border border-edge bg-canvas p-7 transition-colors duration-300 hover:border-vybe-300 hover:bg-vybe-50">
                  <div className="flex items-baseline justify-between">
                    <p className="font-mono text-[0.6875rem] tracking-[0.2em] text-vybe-600">
                      0{index + 1}
                    </p>
                    <span
                      aria-hidden
                      className="h-px w-10 bg-vybe-300 transition-all duration-500 group-hover:w-16"
                    />
                  </div>
                  <h3 className="mt-5 font-display text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
                    {value.title}
                  </h3>
                  <p className="mt-3 text-[0.9375rem] leading-relaxed text-slate">{value.copy}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="section shell">
        <Reveal>
          <div className="edit-head">
            <h2 className="h-section">Built here, not bought in.</h2>
            <span className="edit-index">02 — The ticketing</span>
          </div>
          <p className="lede mt-4 max-w-2xl">
            The booking system on this site is ours. Every line below describes something it
            enforces on the day, rather than a claim about a night that has not happened yet.
          </p>
        </Reveal>

        <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TICKETING_FACTS.map((fact) => (
            <StaggerItem key={fact.label}>
              <div className="panel h-full p-6">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted">
                  {fact.label}
                </p>
                <p className="mt-2 font-display text-[1.5rem] font-semibold leading-tight tracking-[-0.03em] text-ink">
                  {fact.value}
                </p>
                <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-slate">{fact.detail}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="shell pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] bg-ink px-6 py-16 text-center sm:px-12">
            <span aria-hidden className="absolute inset-0 gridfield opacity-[0.18]" />
            <span
              aria-hidden
              className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-vybe-500/40 blur-[90px]"
            />
            <div className="relative">
              <h2 className="font-display text-[clamp(1.75rem,4.5vw,3rem)] font-bold leading-[1.04] tracking-[-0.035em] text-white">
                Come to the first one.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[1.0625rem] leading-relaxed text-vybe-100">
                {EVENT.dateLabel}, {EVENT.timeLabel}, {EVENT.venue.name}. Booking takes about a
                minute.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Magnetic>
                  <Link
                    href="/book"
                    className="btn inline-flex bg-white px-8 py-4 text-base text-ink shadow-mid hover:-translate-y-[2px] hover:bg-vybe-50"
                  >
                    Buy tickets
                  </Link>
                </Magnetic>
                <Link
                  href="/contact"
                  className="btn inline-flex border border-white/25 px-8 py-4 text-base text-white hover:border-white/50"
                >
                  Work with us
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
