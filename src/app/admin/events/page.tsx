import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { formatEventDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { NewEventForm } from '@/components/admin/NewEventForm';
import type { EventRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Events', robots: { index: false, follow: false } };

type Row = EventRow & { tier_count: number; sold: number; bookings: number };

const STATUS_STYLE: Record<string, string> = {
  published: 'chip-ok',
  draft: 'chip-quiet',
  sold_out: 'chip-hot',
  cancelled: 'chip-hot',
  archived: 'chip-quiet',
};

/**
 * Every date, past and future.
 *
 * This screen is the reason a new event no longer needs a deploy. Creating,
 * pricing and publishing all happen here; the site resolves which event it is
 * about by querying, so publishing one and archiving another is the entire
 * launch.
 */
export default async function EventsAdminPage() {
  await requireSession('manager');

  const events = await query<Row>(
    `SELECT e.*,
            (SELECT count(*)::int FROM ticket_tiers t WHERE t.event_id = e.id AND t.active) AS tier_count,
            (SELECT COALESCE(sum(t.sold), 0)::int FROM ticket_tiers t WHERE t.event_id = e.id) AS sold,
            (SELECT count(*)::int FROM bookings b WHERE b.event_id = e.id AND b.status = 'confirmed') AS bookings
       FROM events e
      ORDER BY e.starts_at DESC`,
  ).catch(() => []);

  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() >= now);
  const past = events.filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() < now);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Events</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-slate">
          The site sells whichever published event is next. Publish a new one and the home page
          follows it; archive the old one and it moves to past dates. Neither needs a deploy.
        </p>
      </div>

      <NewEventForm />

      <Section title="Upcoming" events={upcoming} empty="Nothing upcoming. Create one above." />
      <Section title="Past" events={past} empty="No past events yet." />
    </div>
  );
}

function Section({ title, events, empty }: { title: string; events: Row[]; empty: string }) {
  return (
    <section>
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        {title}
      </h2>

      {events.length === 0 ? (
        <p className="mt-3 rounded-lg bg-frost p-4 text-[13px] text-slate ring-hair">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/admin/events/${event.id}`}
                className="card-lift block p-4 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-[1.05rem] font-semibold text-ink">
                        {event.name}
                      </span>
                      {event.edition && (
                        <span className="text-[13px] text-slate">{event.edition}</span>
                      )}
                      <span className={cn('chip', STATUS_STYLE[event.status] ?? 'chip-quiet')}>
                        {event.status.replace('_', ' ')}
                      </span>
                      {event.featured && <span className="chip">Featured</span>}
                    </div>
                    <p className="mt-1 text-[13px] text-slate">
                      {formatEventDate(event.starts_at)} · {event.venue_name}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">
                      /events/{event.slug} · {event.tier_count}{' '}
                      {event.tier_count === 1 ? 'pass' : 'passes'} on sale · {event.sold} sold ·{' '}
                      {event.bookings} bookings
                    </p>
                  </div>
                  <span aria-hidden className="mt-1 shrink-0 text-muted">
                    →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
