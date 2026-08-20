import Link from 'next/link';
import type { Metadata } from 'next';
import { EVENT, GALLERY } from '@/content/site';
import { Reveal } from '@/components/ui/Reveal';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';

export const metadata: Metadata = {
  title: 'Gallery',
  description: `Inside ${EVENT.name} at ${EVENT.venue.name}, ${EVENT.venue.area}.`,
  alternates: { canonical: '/gallery' },
};

export default function GalleryPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-6 pt-32 sm:pt-40">

        <div className="shell">
          <Reveal>
            <p className="kicker">Gallery</p>
            <h1 className="h-section mt-4 max-w-[18ch]">Photos land the week after.</h1>
            <p className="lede mt-4 max-w-xl">
              {EVENT.name} {EVENT.edition} has not happened yet, so there is nothing real to show.
              Rather than fill this page with stock photos of somebody else&apos;s party, the tiles
              below are drawn from the floor plan.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="shell pb-8 pt-10">
        <GalleryGrid items={GALLERY.map((item) => ({ ...item }))} />
      </section>

      <section className="shell pb-24 pt-8">
        <Reveal>
          <div className="rule" />
          <div className="mt-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-[1.375rem] font-semibold tracking-[-0.02em] text-ink">
                The real thing is on {EVENT.dateShort}.
              </h2>
              <p className="mt-2 max-w-md text-[0.9375rem] leading-relaxed text-slate">
                {EVENT.venue.name}, {EVENT.venue.area}. {EVENT.timeLabel}. Tag us on the day and
                your photos end up here.
              </p>
            </div>
            <Link href="/events/offcampus" className="btn-primary shrink-0">
              See the event
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
