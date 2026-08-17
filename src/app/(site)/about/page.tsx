import Link from 'next/link';
import type { Metadata } from 'next';
import { ABOUT_STORY, BRAND, STATS, VENUE } from '@/content/site';
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
      <section className="relative overflow-hidden pb-16 pt-32 sm:pt-40">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 grid-overlay" />
          <div className="absolute right-1/4 top-0 h-[460px] w-[460px] -translate-y-1/3 rounded-full bg-vybe-600/20 blur-[130px]" />
        </div>

        <div className="container-hov">
          <Reveal>
            <p className="eyebrow mb-5">About us</p>
          </Reveal>
          <Reveal delay={0.06}>
            <h1 className="display-1 max-w-[16ch]">{ABOUT_STORY.heading}</h1>
          </Reveal>
        </div>
      </section>

      <section className="section container-hov border-t border-hairline">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div className="space-y-6">
            {ABOUT_STORY.paragraphs.map((paragraph, index) => (
              <Reveal key={paragraph} delay={0.05 * index}>
                <p className="text-[17px] leading-relaxed text-haze">{paragraph}</p>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1} direction="left">
            <TiltCard intensity={9} className="group lg:sticky lg:top-28">
              <div className="card card-lit relative aspect-square overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-vybe-800 via-vybe-950 to-void" />
                <div aria-hidden className="absolute inset-0 grid-overlay opacity-80" />
                {/* Waveform bars — the brand's "sound first" claim, drawn. */}
                <div aria-hidden className="absolute inset-0 flex items-end justify-center gap-1.5 p-12">
                  {Array.from({ length: 22 }).map((_, index) => (
                    <span
                      key={index}
                      className="w-full rounded-t bg-gradient-to-t from-vybe-500/70 to-pulse-400/50"
                      style={{
                        height: `${18 + Math.abs(Math.sin(index * 1.7)) * 72}%`,
                        animation: `float ${3 + (index % 5) * 0.6}s ease-in-out infinite`,
                        animationDelay: `${index * 0.08}s`,
                      }}
                    />
                  ))}
                </div>
                <TiltLayer z={45} className="absolute inset-0 flex flex-col justify-between p-7">
                  <span className="badge self-start">Since 2022</span>
                  <div>
                    <p className="font-display text-3xl font-extrabold leading-none text-white">
                      Sound first.
                    </p>
                    <p className="mt-2 text-[13px] text-white/60">{VENUE.name}</p>
                  </div>
                </TiltLayer>
              </div>
            </TiltCard>
          </Reveal>
        </div>
      </section>

      <section className="section border-y border-hairline bg-ink/40">
        <div className="container-hov">
          <SectionHeading eyebrow="How we work" title="Three things we don't compromise on." />
          <Stagger className="mt-14 grid gap-5 lg:grid-cols-3">
            {ABOUT_STORY.values.map((value, index) => (
              <StaggerItem key={value.title}>
                <div className="card card-lit h-full p-7">
                  <p className="font-mono text-[11px] text-vybe-300">0{index + 1}</p>
                  <h3 className="mt-4 font-display text-xl font-semibold text-chalk">
                    {value.title}
                  </h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-haze">{value.copy}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="container-hov py-20">
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

      <section className="container-hov pb-24">
        <Reveal>
          <div className="card card-lit relative overflow-hidden px-6 py-14 text-center sm:px-12">
            <div aria-hidden className="absolute inset-0 grid-overlay opacity-70" />
            <div className="relative">
              <h2 className="display-2">Come see what we mean.</h2>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/events/offcampus" className="btn-primary px-8 py-4">
                  Next night
                </Link>
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
