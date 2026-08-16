import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { formatInr, maskEmail, timeAgo, formatEventDate } from '@/lib/utils';
import { StatCard } from '@/components/admin/StatCard';
import type { EventRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

interface Totals {
  bookings: string;
  tickets: string;
  used: string;
  revenue: string;
  attendees: string;
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  await requireSession();
  const { event: eventParam } = await searchParams;

  const events = await query<EventRow>(
    `SELECT * FROM events WHERE status IN ('published','sold_out') ORDER BY starts_at ASC`,
  ).catch(() => []);

  // Default to the next night that has not happened yet — that is what the team
  // is actually working on when they open this page.
  const active =
    events.find((e) => e.slug === eventParam) ??
    events.find((e) => new Date(e.starts_at).getTime() > Date.now()) ??
    events[0];

  if (!active) {
    return (
      <EmptyState
        title="No events yet"
        body="Seed an event to start taking bookings. Run npm run db:seed, or add a row to the events table."
      />
    );
  }

  const [totals, hourly, recentBookings, recentScans, lastHour] = await Promise.all([
    queryOne<Totals>(
      `SELECT
         (SELECT count(*) FROM bookings WHERE event_id = $1 AND status = 'confirmed')::text AS bookings,
         (SELECT count(*) FROM tickets  WHERE event_id = $1)::text                          AS tickets,
         (SELECT count(*) FROM tickets  WHERE event_id = $1 AND status = 'used')::text      AS used,
         (SELECT COALESCE(SUM(amount_paise),0) FROM bookings WHERE event_id = $1 AND status = 'confirmed')::text AS revenue,
         (SELECT COALESCE(SUM(quantity),0) FROM bookings WHERE event_id = $1 AND status IN ('pending','confirmed'))::text AS attendees`,
      [active.id],
    ),
    query<{ bucket: string; count: string }>(
      `SELECT to_char(date_trunc('hour', created_at), 'YYYY-MM-DD"T"HH24:MI:SS') AS bucket,
              count(*)::text AS count
       FROM bookings
       WHERE event_id = $1 AND created_at > now() - interval '24 hours'
       GROUP BY 1 ORDER BY 1`,
      [active.id],
    ),
    query<{
      id: string; reference: string; customer_name: string; customer_email: string;
      quantity: number; amount_paise: number; status: string; created_at: string;
    }>(
      `SELECT id, reference, customer_name, customer_email, quantity, amount_paise, status, created_at
       FROM bookings WHERE event_id = $1 ORDER BY created_at DESC LIMIT 8`,
      [active.id],
    ),
    query<{ id: string; result: string; holder_name: string | null; gate: string | null; created_at: string }>(
      `SELECT s.id::text, s.result, t.holder_name, s.gate, s.created_at
       FROM scan_log s LEFT JOIN tickets t ON t.id = s.ticket_id
       WHERE s.event_id = $1 ORDER BY s.created_at DESC LIMIT 8`,
      [active.id],
    ),
    query<{ result: string; count: string }>(
      `SELECT result, count(*)::text AS count FROM scan_log
       WHERE event_id = $1 AND created_at > now() - interval '1 hour'
       GROUP BY result`,
      [active.id],
    ),
  ]);

  const tickets = Number(totals?.tickets ?? 0);
  const used = Number(totals?.used ?? 0);
  const attendees = Number(totals?.attendees ?? 0);
  const checkInRate = tickets > 0 ? Math.round((used / tickets) * 100) : 0;
  const capacityUsed = active.capacity > 0 ? Math.round((attendees / active.capacity) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-chalk">{active.name}</h1>
          <p className="mt-1 text-[13px] text-haze">
            {formatEventDate(active.starts_at)} · {active.venue_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {events.length > 1 && (
            <form className="contents">
              <select
                name="event"
                defaultValue={active.slug}
                className="rounded-full border border-hairline bg-ink px-4 py-2 text-[12px] text-haze"
                aria-label="Event"
              >
                {events.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-ghost px-4 py-2 text-[12px]">
                Switch
              </button>
            </form>
          )}
          <Link href="/admin/scan" className="btn-primary px-5 py-2.5 text-[13px]">
            Open scanner
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bookings" value={totals?.bookings ?? '0'} hint="confirmed" />
        <StatCard label="Tickets issued" value={String(tickets)} hint={`${attendees} on the list`} />
        <StatCard label="Checked in" value={`${used}`} hint={`${checkInRate}% of issued`} accent />
        <StatCard
          label="Revenue"
          value={formatInr(Number(totals?.revenue ?? 0))}
          hint={Number(totals?.revenue ?? 0) === 0 ? 'free entry' : 'confirmed only'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-1 font-display text-base font-semibold text-chalk">Capacity</h2>
          <p className="text-[12px] text-dim">
            {attendees} of {active.capacity} places taken
          </p>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-gradient-to-r from-vybe-600 to-pulse-400"
              style={{ width: `${Math.min(100, capacityUsed)}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[11px] text-haze">{capacityUsed}% sold</p>

          <h3 className="mb-2 mt-6 text-[12px] font-semibold text-haze">Bookings, last 24h</h3>
          <Sparkline points={hourly.map((h) => Number(h.count))} />

          {lastHour.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {lastHour.map((row) => (
                <span key={row.result} className="badge">
                  {row.result.replace(/_/g, ' ')} · {row.count}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-chalk">Latest bookings</h2>
            <Link href="/admin/bookings" className="text-[12px] text-vybe-300 hover:text-vybe-200">
              View all →
            </Link>
          </div>
          {recentBookings.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-dim">No bookings yet.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {recentBookings.map((booking) => (
                <li key={booking.id}>
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-elevated/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-chalk">
                        {booking.customer_name}
                      </p>
                      <p className="truncate font-mono text-[11px] text-dim">
                        {booking.reference} · {maskEmail(booking.customer_email)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[12px] text-chalk">×{booking.quantity}</p>
                      <p className="text-[10px] text-dim">{timeAgo(booking.created_at)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-chalk">Recent scans</h2>
          <Link href="/admin/checkins" className="text-[12px] text-vybe-300 hover:text-vybe-200">
            Door log →
          </Link>
        </div>
        {recentScans.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-dim">Nothing scanned yet tonight.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {recentScans.map((scan) => (
              <li key={scan.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="truncate text-[13px] text-chalk">
                  {scan.holder_name ?? <span className="text-dim">unknown pass</span>}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span
                    className={
                      scan.result === 'admitted'
                        ? 'font-mono text-[11px] text-vybe-300'
                        : scan.result === 'duplicate'
                          ? 'font-mono text-[11px] text-amber-300'
                          : 'font-mono text-[11px] text-red-300'
                    }
                  >
                    {scan.result.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-dim">{timeAgo(scan.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Inline SVG sparkline — avoids pulling a charting library in for one graphic. */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <p className="py-4 text-[12px] text-dim">Not enough data yet.</p>;
  }
  const max = Math.max(...points, 1);
  const step = 100 / (points.length - 1);
  const path = points
    .map((value, index) => `${index === 0 ? 'M' : 'L'} ${index * step} ${30 - (value / max) * 28}`)
    .join(' ');

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-16 w-full" aria-hidden>
      <path d={`${path} L 100 30 L 0 30 Z`} fill="url(#spark)" opacity="0.35" />
      <path d={path} fill="none" stroke="#38dcf5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f6bff" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
      <h1 className="font-display text-xl font-bold text-chalk">{title}</h1>
      <p className="mt-2 max-w-[44ch] text-[13px] leading-relaxed text-haze">{body}</p>
    </div>
  );
}
