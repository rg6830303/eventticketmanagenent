import Link from 'next/link';
import type { Metadata } from 'next';
import { listPublishedEvents } from '@/lib/bookings';
import { formatEventDate, formatEventTime } from '@/lib/utils';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { TiltCard, TiltLayer } from '@/components/ui/TiltCard';
import { Globe } from '@/components/brand/Globe';
import type { EventRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Every Houz of Vybe night in Hyderabad — upcoming shows and past editions.',
  alternates: { canonical: '/events' },
};

export default async function EventsPage() {
  const events = await listPublishedEvents().catch(() => []);
  const now = Date.now();
  const upcoming = events.filter((event) => new Date(event.starts_at).getTime() >= now);
  const past = events
    .filter((event) => new Date(event.starts_at).getTime() < now)
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  return (
    <div className="container-hov pb-24 pt-32 sm:pt-40">
      <SectionHeading
        eyebrow="What's on"
        title="Every night we're putting on."
        lede="Capped rooms, serious rigs, and a door that moves. Book early — we stop selling when the room is full."
      />

      {upcoming.length === 0 ? (
        <Reveal className="mt-14">
          <div className="card card-lit relative overflow-hidden px-6 py-16 text-center sm:px-12">
            <div aria-hidden className="absolute inset-0 grid-overlay opacity-70" />
            {/* The mark stands in for the listing that isn't there yet — an empty
                state that still looks like the brand, not like a failure. */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 text-vybe-500/[0.08]"
            >
              <Globe className="h-full w-full" strokeWidth={1.2} spin />
            </div>

            <div className="relative">
              <div className="mx-auto mb-7 h-16 w-16 text-flare/70">
                <Globe className="h-full w-full animate-float" strokeWidth={3} />
              </div>
              <p className="font-display text-2xl font-bold text-chalk">Nothing announced yet</p>
              <p className="lede mx-auto mt-3 max-w-md">
                The next edition is in production. Get on the list and you&apos;ll hear before it
                goes public.
              </p>
              <Link href="/contact" className="btn-secondary mt-8 px-7 py-3.5">
                Get on the list
              </Link>
            </div>
          </div>
        </Reveal>
      ) : (
        <Stagger className="perspective-1000 mt-14 space-y-5">
          {upcoming.map((event) => (
            <StaggerItem key={event.id}>
              <EventCard event={event} />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {past.length > 0 && (
        <section className="mt-24">
          <h2 className="mb-8 font-display text-xl font-semibold text-haze">Past nights</h2>
          <Stagger className="space-y-3">
            {past.map((event) => (
              <StaggerItem key={event.id}>
                <div className="card flex flex-wrap items-center justify-between gap-4 p-5 opacity-60 transition-opacity duration-300 hover:opacity-90">
                  <div>
                    <p className="font-display text-lg font-semibold text-chalk">{event.name}</p>
                    <p className="text-[12px] text-dim">
                      {formatEventDate(event.starts_at)} · {event.venue_name}
                    </p>
                  </div>
                  <span className="badge">Finished</span>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}
    </div>
  );
}

function EventCard({ event }: { event: EventRow }) {
  const soldOut = event.status === 'sold_out';
  const date = new Date(event.starts_at);

  return (
    <TiltCard intensity={5} className="group">
      {/* No overflow-hidden here: clipping flattens the 3D context and the
          TiltLayers would collapse onto the card face. */}
      <article className="preserve-3d relative rounded-2xl border border-hairline bg-surface/70 backdrop-blur-md">
        <div aria-hidden className="absolute inset-0 overflow-hidden rounded-[inherit]">
          <div className="absolute inset-0 grid-overlay opacity-50" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-vybe-300/55 to-transparent" />
          {/* Light sweeps across on hover — a single pass, not a loop. */}
          <div className="absolute -inset-x-1/2 inset-y-0 -translate-x-full bg-sheen opacity-0 transition-all duration-700 group-hover:translate-x-full group-hover:opacity-100" />
        </div>

        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          {/* Date block reads as a tear-off calendar leaf. */}
          <TiltLayer
            z={44}
            className="flex w-full shrink-0 items-center gap-4 border-b border-hairline pb-5 sm:w-auto sm:flex-col sm:items-center sm:gap-0 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-8"
          >
            <p className="font-display text-4xl font-extrabold leading-none text-gradient sm:text-5xl">
              {date.toLocaleDateString('en-IN', { day: '2-digit', timeZone: 'Asia/Kolkata' })}
            </p>
            <div className="sm:mt-1 sm:text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-vybe-300">
                {date.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })}
              </p>
              <p className="font-mono text-[10px] text-dim">
                {date.toLocaleDateString('en-IN', { year: 'numeric', timeZone: 'Asia/Kolkata' })}
              </p>
            </div>
          </TiltLayer>

          <TiltLayer z={22} className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-display text-2xl font-bold text-chalk sm:text-3xl">
                {event.name}
              </h3>
              {soldOut && (
                <span className="badge border-flare-500/35 bg-flare-500/10 text-flare-300">
                  Sold out
                </span>
              )}
            </div>
            {event.tagline && <p className="mt-1.5 text-[14px] text-vybe-300">{event.tagline}</p>}
            <p className="mt-3 text-[13px] text-haze">
              {event.venue_name}, {event.city} · doors{' '}
              {formatEventTime(event.doors_at ?? event.starts_at)} · {event.age_limit}+
            </p>
          </TiltLayer>

          <TiltLayer z={34} className="flex shrink-0 flex-wrap gap-2">
            <Link href={`/events/${event.slug}`} className="btn-ghost px-6 py-3 text-[13px]">
              Details
            </Link>
            {soldOut ? (
              <span
                aria-disabled="true"
                className="btn-primary pointer-events-none cursor-not-allowed px-6 py-3 text-[13px] opacity-45"
              >
                Sold out
              </span>
            ) : (
              <Link
                href={`/book?event=${event.slug}`}
                className="btn-primary px-6 py-3 text-[13px]"
              >
                Book
              </Link>
            )}
          </TiltLayer>
        </div>
      </article>
    </TiltCard>
  );
}
