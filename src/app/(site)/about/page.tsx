import Link from 'next/link';
import type { Metadata } from 'next';
import { ABOUT_STORY, BRAND, PLATFORM_FACTS, PROMISES } from '@/content/site';
import { Globe } from '@/components/brand/Globe';
import { Magnetic } from '@/components/ui/Magnetic';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { TiltCard, TiltLayer } from '@/components/ui/TiltCard';

export const metadata: Metadata = {
  title: 'About',
  description: `${BRAND.name} produces capped-capacity club nights in Hyderabad — sound first, rooms that move, QR entry that actually works.`,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-14 pt-32 sm:pt-40">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 grid-overlay" />
          <div className="absolute right-[-10%] top-[-24%] h-[520px] w-[520px] rounded-full bg-vybe-600/18 blur-[150px]" />
          <Globe
            spin
            strokeWidth={0.8}
            className="absolute right-[-16%] top-[-22%] h-[420px] w-[420px] text-vybe-500/10 [animation-duration:90s] sm:h-[560px] sm:w-[560px]"
          />
        </div>

        <div className="container-hov">
          <Reveal>
            <p className="eyebrow mb-5">About us</p>
          </Reveal>
          <Reveal delay={0.06}>
            <h1 className="display-1 max-w-[15ch]">{ABOUT_STORY.heading}</h1>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-[0.24em] text-dim">
              <span className="text-vybe-300">{BRAND.city}</span>
              <span aria-hidden className="text-hairline">
                /
              </span>
              <span>{BRAND.tagline}</span>
              <span aria-hidden className="text-hairline">
                /
              </span>
              <span>Produced in-house</span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section container-hov border-t border-hairline">
        <div className="grid gap-14 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
          <div className="space-y-7">
            {ABOUT_STORY.paragraphs.map((paragraph, index) => (
              <Reveal key={paragraph} delay={0.05 * index}>
                <p className="text-[17px] leading-[1.75] text-haze sm:text-lg">
                  {index === 0 ? (
                    <span className="float-left mr-3 mt-1 font-display text-5xl font-extrabold leading-[0.8] text-gradient">
                      {paragraph.slice(0, 1)}
                    </span>
                  ) : null}
                  {index === 0 ? paragraph.slice(1) : paragraph}
                </p>
              </Reveal>
            ))}
          </div>

          {/* The one 3D moment on this page: the mark, taken apart into depth
              layers so tilting the card separates them. */}
          <Reveal delay={0.1} direction="left" className="lg:sticky lg:top-28">
            <TiltCard intensity={13} glare={false} className="aspect-square w-full preserve-3d">
              <div
                aria-hidden
                className="absolute inset-0 overflow-hidden rounded-3xl border border-hairline bg-gradient-to-br from-vybe-900/60 via-ink to-void"
              >
                <div className="absolute inset-0 grid-overlay opacity-70" />
                <div className="absolute left-1/2 top-1/2 h-3/4 w-3/4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-vybe-600/25 blur-[80px]" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-vybe-300/45 to-transparent" />
              </div>

              <TiltLayer z={0} className="absolute inset-0 flex items-center justify-center">
                <Globe
                  spin
                  strokeWidth={0.7}
                  className="h-[86%] w-[86%] text-vybe-400/14 [animation-direction:reverse] [animation-duration:120s]"
                />
              </TiltLayer>

              <TiltLayer z={42} className="absolute inset-0 flex items-center justify-center">
                <Globe
                  spin
                  strokeWidth={1.1}
                  className="h-[62%] w-[62%] text-pulse-400/25 [animation-duration:75s]"
                />
              </TiltLayer>

              <TiltLayer z={84} className="absolute inset-0 flex items-center justify-center">
                <Globe
                  spin
                  strokeWidth={2.4}
                  className="h-[42%] w-[42%] text-flare/85 [animation-duration:38s]"
                />
              </TiltLayer>

              <TiltLayer z={118} className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8">
                <span className="badge self-start">{BRAND.shortName}</span>
                <div>
                  <p className="font-display text-2xl font-extrabold leading-none text-chalk sm:text-3xl">
                    Sound first.
                  </p>
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.22em] text-dim">
                    {BRAND.city}
                  </p>
                </div>
              </TiltLayer>
            </TiltCard>
          </Reveal>
        </div>
      </section>

      <section className="section border-y border-hairline bg-ink/40">
        <div className="container-hov">
          <SectionHeading
            eyebrow="How we work"
            title="Three things we do not compromise on."
          />
          <Stagger className="mt-14 grid gap-5 lg:grid-cols-3">
            {ABOUT_STORY.values.map((value, index) => (
              <StaggerItem key={value.title}>
                <div className="card card-lit group h-full p-7 transition-colors duration-300 hover:border-vybe-700">
                  <div className="flex items-baseline justify-between">
                    <p className="font-mono text-[11px] tracking-[0.2em] text-vybe-300">
                      0{index + 1}
                    </p>
                    <span
                      aria-hidden
                      className="h-px w-10 bg-gradient-to-r from-vybe-500/60 to-transparent transition-all duration-500 group-hover:w-16"
                    />
                  </div>
                  <h3 className="mt-5 font-display text-xl font-semibold text-chalk">
                    {value.title}
                  </h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-haze">{value.copy}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="section container-hov">
        <SectionHeading
          eyebrow="By the system, not by the story"
          title="Four numbers you can check."
          lede="Each one describes behaviour the booking system enforces on the night — not a claim about a night that has already happened."
        />

        <Stagger className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORM_FACTS.map((fact) => (
            <StaggerItem key={fact.label}>
              <div className="card card-lit h-full p-6">
                <p className="font-display text-4xl font-extrabold leading-none text-gradient sm:text-5xl">
                  {fact.value}
                </p>
                <p className="mt-4 text-[13px] font-medium text-chalk">{fact.label}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-dim">{fact.detail}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="section border-t border-hairline bg-ink/40">
        <div className="container-hov">
          <SectionHeading
            eyebrow="Our word"
            title="We have no testimonials yet. Here are the promises instead."
            lede="Season One has not happened. Rather than borrow somebody else's praise, these are the commitments you can hold us to on the night."
          />

          <Stagger className="mt-14 grid gap-4 sm:grid-cols-2">
            {PROMISES.map((promise) => (
              <StaggerItem key={promise.title}>
                <div className="card card-lit flex h-full gap-4 p-6 sm:p-7">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-vybe-500/35 bg-vybe-500/10"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      className="h-4 w-4 text-vybe-300"
                    >
                      <path d="M4 12.5l5.5 5.5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-chalk">
                      {promise.title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-haze">{promise.copy}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="container-hov py-24">
        <Reveal>
          <div className="card card-lit relative overflow-hidden px-6 py-16 text-center sm:px-12">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 grid-overlay opacity-70" />
              <Globe
                spin
                strokeWidth={0.9}
                className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 text-flare/10 [animation-duration:100s] sm:h-[480px] sm:w-[480px]"
              />
            </div>
            <div className="relative">
              <h2 className="display-2">Come and hear it.</h2>
              <p className="lede mx-auto mt-5 max-w-xl">
                Three rooms, one arc, capped at the door. Booking takes under a minute.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Magnetic>
                  <Link href="/events/offcampus" className="btn-primary px-8 py-4">
                    See the next night
                  </Link>
                </Magnetic>
                <Link href="/contact" className="btn-ghost px-8 py-4">
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
