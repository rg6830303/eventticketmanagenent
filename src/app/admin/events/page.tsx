import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { isPastEvent, listAllEventsWithStats } from '@/lib/event-facts';
import { formatEventDate, formatInr } from '@/lib/utils';
import { EventEditor } from '@/components/admin/EventEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Events', robots: { index: false, follow: false } };

/**
 * Every event the platform has run or is about to.
 *
 * Upcoming events are edited here — name, date, venue, poster, status — and
 * past events stay as a record with their numbers and a full view of who came.
 * Prices live in the Prices tab, which now groups passes by event.
 */
export default async function EventsPage() {
  await requireSession('manager');
  const events = await listAllEventsWithStats();
  const upcoming = events.filter((e) => !isPastEvent(e));
  const past = events.filter((e) => isPastEvent(e));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Events</h1>
        <p className="mt-1 text-[13px] text-slate">
          The soonest upcoming published event is featured on the home page automatically. Set its
          prices and put passes on sale from the Prices tab.
        </p>
      </div>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Upcoming</h2>
        <div className="mt-3 space-y-3">
          {upcoming.length === 0 && <p className="text-[13px] text-muted">No upcoming events.</p>}
          {upcoming.map((e) => (
            <div key={e.id} className="panel p-4">
              <div className="flex flex-wrap items-start gap-4">
                {e.hero_image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.hero_image} alt="" className="h-20 w-20 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold text-ink">{e.name} {e.tagline ?? ''}</p>
                  <p className="text-[12px] text-slate">
                    {formatEventDate(e.starts_at)} · {e.venue_name} · <span className="font-mono">{e.status}</span>
                  </p>
                  <Stats e={e} />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Link href={`/admin/events/${e.id}`} className="btn-outline px-3 py-1.5 text-[12px]">Record</Link>
                  <a href={`https://www.houzofvybe.com/events/${e.slug}`} target="_blank" rel="noreferrer" className="text-[12px] text-vybe-700 underline">
                    View on site
                  </a>
                </div>
              </div>
              <div className="mt-3">
                <EventEditor event={e} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Past events · record</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {past.map((e) => (
            <Link key={e.id} href={`/admin/events/${e.id}`} className="panel block p-4 transition-colors hover:border-vybe-400">
              <p className="font-display text-lg font-bold text-ink">{e.name} {e.tagline ?? ''}</p>
              <p className="text-[12px] text-slate">{formatEventDate(e.starts_at)} · {e.venue_name}</p>
              <Stats e={e} />
              <p className="mt-2 text-[12px] font-semibold text-vybe-700">Open record →</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stats({ e }: { e: { tickets_sold: number; bookings: number; checked_in: number; revenue_paise: number } }) {
  return (
    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate">
      <span><strong className="text-ink">{e.tickets_sold}</strong> passes</span>
      <span><strong className="text-ink">{e.bookings}</strong> bookings</span>
      <span><strong className="text-ink">{e.checked_in}</strong> admitted</span>
      <span><strong className="text-ink">{formatInr(e.revenue_paise)}</strong> collected</span>
    </p>
  );
}
