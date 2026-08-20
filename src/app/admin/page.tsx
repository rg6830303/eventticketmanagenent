import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { formatInr, maskEmail, timeAgo, formatEventDate } from '@/lib/utils';
import { StatCard, CapacityBar } from '@/components/admin/StatCard';
import { LiveStats } from '@/components/admin/LiveStats';
import type { AdminStats } from '@/app/api/admin/stats/route';
import { Globe } from '@/components/brand/Globe';
import type { EventRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

interface Totals {
  customers: string;
  duplicates: string;
  last_scan: string | null;
  bookings: string;
  tickets: string;
  used: string;
  revenue: string;
  attendees: string;
}

const SCAN_TONE: Record<string, string> = {
  admitted: 'text-vybe-600',
  duplicate: 'text-amber-700',
  wrong_event: 'text-amber-700',
  void: 'text-amber-700',
  refunded: 'text-amber-700',
  invalid_signature: 'text-flare-600',
  not_found: 'text-flare-600',
};

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
         (SELECT count(DISTINCT lower(customer_email)) FROM bookings
            WHERE event_id = $1 AND status = 'confirmed')::text AS customers,
         (SELECT count(*) FROM scan_log WHERE event_id = $1 AND result = 'duplicate')::text AS duplicates,
         (SELECT max(created_at) FROM scan_log WHERE event_id = $1) AS last_scan,
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

  const initialStats: AdminStats = {
    event: {
      slug: active.slug,
      name: active.name,
      startsAt: active.starts_at,
      capacity: active.capacity,
    },
    customers: Number(totals?.customers ?? 0),
    bookings: Number(totals?.bookings ?? 0),
    ticketsIssued: tickets,
    checkedIn: used,
    yetToArrive: Math.max(0, tickets - used),
    capacityUsed: active.capacity > 0 ? Math.round((attendees / active.capacity) * 100) : 0,
    revenuePaise: Number(totals?.revenue ?? 0),
    scansLastHour: lastHour.reduce((sum, row) => sum + Number(row.count), 0),
    duplicatesBlocked: Number(totals?.duplicates ?? 0),
    lastScanAt: totals?.last_scan ? new Date(totals.last_scan).toISOString() : null,
    updatedAt: new Date().toISOString(),
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{active.name}</h1>
          <p className="mt-1 text-[13px] text-slate">
            {formatEventDate(active.starts_at)} · {active.venue_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {events.length > 1 && (
            <form className="contents">
              <select
                name="event"
                defaultValue={active.slug}
                className="rounded-full border border-edge bg-mist px-4 py-2 text-[12px] text-slate transition-colors focus:border-vybe-500"
                aria-label="Event"
              >
                {events.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-outline btn-sm px-4 py-2 text-[12px]">
                Switch
              </button>
            </form>
          )}
          <Link href="/admin/scan" className="btn-primary px-5 py-2.5 text-[13px]">
            Open scanner
          </Link>
        </div>
      </header>

      {/* Server-rendered once so the page is useful immediately, then kept
          current by polling — a scan at the door lands here within ~5s. */}
      <LiveStats initial={initialStats} eventSlug={active.slug} />

      <div className="grid animate-in fade-in gap-4 [animation-delay:80ms] lg:grid-cols-2">
        <section className="panel shadow-mid p-5">
          <h2 className="mb-1 font-display text-base font-semibold text-ink">Capacity</h2>
          <p className="text-[12px] text-muted">
            {attendees} of {active.capacity} places taken
          </p>

          <CapacityBar used={attendees} total={active.capacity} className="mt-4" />

          <h3 className="mb-2 mt-6 text-[12px] font-semibold text-slate">Bookings, last 24h</h3>
          <Sparkline points={hourly.map((h) => Number(h.count))} />

          {lastHour.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {lastHour.map((row) => (
                <span key={row.result} className="chip">
                  {row.result.replace(/_/g, ' ')} · {row.count}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="panel shadow-mid p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">Latest bookings</h2>
            <Link
              href="/admin/bookings"
              className="text-[12px] text-vybe-600 transition-colors hover:text-vybe-700"
            >
              View all →
            </Link>
          </div>
          {recentBookings.length === 0 ? (
            <PanelEmpty
              headline="No bookings yet"
              body="The first confirmed booking for this night lands here."
            />
          ) : (
            <ul className="divide-y divide-edge">
              {recentBookings.map((booking) => (
                <li key={booking.id}>
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-frost/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {booking.customer_name}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted">
                        {booking.reference} · {maskEmail(booking.customer_email)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[12px] tabular-nums text-ink">×{booking.quantity}</p>
                      <p className="text-[10px] text-muted">{timeAgo(booking.created_at)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel shadow-mid animate-in fade-in p-5 [animation-delay:160ms]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink">Recent scans</h2>
          <Link
            href="/admin/checkins"
            className="text-[12px] text-vybe-600 transition-colors hover:text-vybe-700"
          >
            Door log →
          </Link>
        </div>
        {recentScans.length === 0 ? (
          <PanelEmpty
            headline="Nothing scanned yet"
            body="Every scan tonight — admitted or refused — shows up here as it happens."
          />
        ) : (
          <ul className="divide-y divide-edge">
            {recentScans.map((scan) => (
              <li key={scan.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="truncate text-[13px] text-ink">
                  {scan.holder_name ?? <span className="text-muted">unknown pass</span>}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span
                    className={`font-mono text-[11px] ${SCAN_TONE[scan.result] ?? 'text-slate'}`}
                  >
                    {scan.result.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-muted">{timeAgo(scan.created_at)}</span>
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
    return (
      <div className="flex h-16 items-center gap-2 rounded-xl border border-dashed border-edge px-3">
        <Globe className="h-4 w-4 shrink-0 text-vybe-500/25" strokeWidth={5} />
        <p className="text-[12px] text-muted">Not enough bookings yet to draw a curve.</p>
      </div>
    );
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

/** Empty state inside a panel that already has its own heading. */
function PanelEmpty({ headline, body }: { headline: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <Globe spin strokeWidth={2} className="h-12 w-12 text-vybe-500/20 [animation-duration:18s]" />
      <p className="mt-3 text-[13px] font-medium text-slate">{headline}</p>
      <p className="mt-1 max-w-[38ch] text-[12px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel shadow-mid relative flex min-h-[320px] flex-col items-center justify-center overflow-hidden p-8 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0 gridfield fade-edges" />
      <Globe spin strokeWidth={1.4} className="relative h-24 w-24 text-vybe-500/25" />
      <h1 className="relative mt-5 font-display text-xl font-bold text-ink">{title}</h1>
      <p className="relative mt-2 max-w-[44ch] text-[13px] leading-relaxed text-slate">{body}</p>
    </div>
  );
}
