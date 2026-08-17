import type { Metadata } from 'next';
import { GALLERY } from '@/content/site';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'Inside a Houz of Vybe night — rooms, rigs and the last hour before the lights.',
  alternates: { canonical: '/gallery' },
};

export default function GalleryPage() {
  return (
    <div className="container-hov pb-24 pt-32 sm:pt-40">
      <SectionHeading
        eyebrow="Gallery"
        title="What the room actually looks like."
        lede="Doors at nine, peak at one, rooftop until the sky changes colour."
      />

      <GalleryGrid items={GALLERY.map((item) => ({ ...item }))} />

      <p className="mt-10 text-center text-[11px] leading-relaxed text-dim">
        These tiles are generated placeholders sized and cropped for real photography — drop
        images in and the layout stays exactly as it is.
      </p>
    </div>
  );
}
