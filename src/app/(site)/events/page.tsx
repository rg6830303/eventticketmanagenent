import Link from 'next/link';
import type { Metadata } from 'next';
import { listPublishedEvents } from '@/lib/bookings';
import { formatEventDate, formatEventTime } from '@/lib/utils';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
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
          <div className="card card-lit relative overflow-hidden p-12 text-center">
            <div aria-hidden className="absolute inset-0 grid-overlay opacity-70" />
            <div className="relative">
              <p className="font-display text-2xl font-bold text-chalk">Nothing announced yet</p>
              <p className="lede mx-auto mt-3 max-w-md">
                The next edition is in production. Follow along and you&apos;ll hear first.
              </p>
              <Link href="/contact" className="btn-secondary mt-8 px-7 py-3.5">
                Get on the list
              </Link>
            </div>
          </div>
        </Reveal>
      ) : (
        <Stagger className="mt-14 space-y-5">
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
                <div className="card flex flex-wrap items-center justify-between gap-4 p-5 opacity-60">
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
    <article className="card card-lit group relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 grid-overlay opacity-50" />
      <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
        {/* Date block reads as a tear-off calendar leaf. */}
        <div className="flex w-full shrink-0 items-center gap-4 border-b border-hairline pb-5 sm:w-auto sm:flex-col sm:items-center sm:gap-0 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-8">
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
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-2xl font-bold text-chalk sm:text-3xl">{event.name}</h3>
            {soldOut && <span className="badge border-red-500/30 bg-red-500/10 text-red-200">Sold out</span>}
          </div>
          {event.tagline && <p className="mt-1.5 text-[14px] text-vybe-300">{event.tagline}</p>}
          <p className="mt-3 text-[13px] text-haze">
            {event.venue_name}, {event.city} · doors{' '}
            {formatEventTime(event.doors_at ?? event.starts_at)} · {event.age_limit}+
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href={`/events/${event.slug}`} className="btn-ghost px-6 py-3 text-[13px]">
            Details
          </Link>
          {soldOut ? (
            <span className="btn-primary pointer-events-none px-6 py-3 text-[13px] opacity-45">
              Sold out
            </span>
          ) : (
            <Link href={`/book?event=${event.slug}`} className="btn-primary px-6 py-3 text-[13px]">
              Book
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
