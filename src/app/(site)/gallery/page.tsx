import Link from 'next/link';
import type { Metadata } from 'next';
import { GALLERY, OFFCAMPUS } from '@/content/site';
import { Globe } from '@/components/brand/Globe';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'Inside a Houz of Vybe night — rooms, rigs and the last hour before the lights.',
  alternates: { canonical: '/gallery' },
};

export default function GalleryPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-4 pt-32 sm:pt-40">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 grid-overlay" />
          <Globe
            spin
            strokeWidth={0.8}
            className="absolute left-[-18%] top-[-18%] h-[400px] w-[400px] text-vybe-500/10 [animation-duration:110s] sm:h-[520px] sm:w-[520px]"
          />
        </div>

        <div className="container-hov">
          <SectionHeading
            eyebrow="Gallery"
            title="Drawn from the room plan."
            lede="Doors at nine, peak at one, rooftop until the sky changes colour."
          />

          <Reveal delay={0.2}>
            <div className="card card-lit mt-10 max-w-2xl p-5 sm:p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-vybe-300">
                Drawn, not shot
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-haze">
                Every tile below is vector art, generated from the lighting plan and the room
                dimensions — the beams sit where the rig sits, the floor holds the crowd it is
                rated for. Photography from the first edition goes up the week after the night.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="container-hov pb-8 pt-12">
        <GalleryGrid items={GALLERY.map((item) => ({ ...item }))} />
      </section>

      <section className="container-hov pb-24 pt-8">
        <Reveal>
          <div className="divider" />
          <div className="mt-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-xl font-semibold text-chalk">
                The real thing runs {OFFCAMPUS.rooms.length} rooms.
              </h2>
              <p className="mt-2 max-w-md text-[14px] leading-relaxed text-haze">
                {OFFCAMPUS.rooms.map((room) => room.name).join(' · ')} — back to back until 4am.
              </p>
            </div>
            <Link href="/events/offcampus" className="btn-primary shrink-0 px-7 py-3.5">
              See the night
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
