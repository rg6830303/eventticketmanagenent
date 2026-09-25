import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { isPastEvent } from '@/lib/event-facts';
import { formatEventDate, formatEventTime, formatInr } from '@/lib/utils';
import type { EventRow } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Event record', robots: { index: false, follow: false } };

interface Totals {
  confirmed: number;
  pending: number;
  passes: number;
  admitted: number;
  gross_paise: number;
  fee_paise: number;
  discount_paise: number;
  emailed: number;
  nudged: number;
}

interface TierLine {
  tier_code: string;
  tier_name: string;
  passes: number;
  admitted: number;
  revenue_paise: number;
}

interface BookingLine {
  reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  quantity: number;
  amount_paise: number;
  status: string;
  source: string | null;
  referral_code: string | null;
  paid_at: string | null;
  created_at: string;
  admitted: number;
  email_sent_at: string | null;
}

/**
 * The record of one event.
 *
 * Everything that happened, frozen as it is in the database: what sold, how
 * many came through the door, what was collected and from whom. For a past
 * night this is the archive; for an upcoming one it is the live picture.
 */
export default async function EventRecordPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession('manager');
  const { id } = await params;
  const event = await queryOne<EventRow>('SELECT * FROM events WHERE id = $1', [id]).catch(() => null);
  if (!event) notFound();

  const [totals, tiers, bookings] = await Promise.all([
    queryOne<Totals>(
      `SELECT
         count(*) FILTER (WHERE b.status = 'confirmed')::int AS confirmed,
         count(*) FILTER (WHERE b.status = 'pending')::int AS pending,
         COALESCE(sum(b.quantity) FILTER (WHERE b.status = 'confirmed'), 0)::int AS passes,
         GREATEST(
           (SELECT count(*)::int FROM tickets t WHERE t.event_id = $1 AND t.checked_in_at IS NOT NULL),
           COALESCE(sum(b.admitted_count), 0)::int
         ) AS admitted,
         COALESCE(sum(b.amount_paise) FILTER (WHERE b.status = 'confirmed'), 0)::bigint AS gross_paise,
         COALESCE(sum(b.fee_paise) FILTER (WHERE b.status = 'confirmed'), 0)::bigint AS fee_paise,
         COALESCE(sum(b.discount_paise) FILTER (WHERE b.status = 'confirmed'), 0)::bigint AS discount_paise,
         count(*) FILTER (WHERE b.status = 'confirmed' AND b.email_sent_at IS NOT NULL)::int AS emailed,
         count(*) FILTER (WHERE b.nudge_sent_at IS NOT NULL)::int AS nudged
       FROM bookings b WHERE b.event_id = $1`,
      [id],
    ),
    query<TierLine>(
      `SELECT bi.tier_code, COALESCE(max(t.name), max(bi.tier_name)) AS tier_name,
              sum(bi.quantity)::int AS passes,
              (SELECT count(*)::int FROM tickets tk JOIN bookings bb ON bb.id = tk.booking_id
                 JOIN booking_items bb_i ON bb_i.id = tk.booking_item_id
                WHERE bb.event_id = $1 AND bb_i.tier_code = bi.tier_code AND tk.checked_in_at IS NOT NULL) AS admitted,
              sum(bi.line_total_paise)::bigint AS revenue_paise
         FROM booking_items bi
         JOIN bookings b ON b.id = bi.booking_id
         LEFT JOIN ticket_tiers t ON t.code = bi.tier_code AND t.event_id = b.event_id
        WHERE b.event_id = $1 AND b.status = 'confirmed'
        GROUP BY bi.tier_code
        ORDER BY passes DESC`,
      [id],
    ),
    query<BookingLine>(
      `SELECT b.reference, b.customer_name, b.customer_email, b.customer_phone, b.quantity,
              b.amount_paise, b.status, b.source, b.referral_code, b.paid_at, b.created_at, b.email_sent_at,
              COALESCE(b.admitted_count,
                (SELECT count(*)::int FROM tickets t WHERE t.booking_id = b.id AND t.checked_in_at IS NOT NULL)) AS admitted
         FROM bookings b
        WHERE b.event_id = $1 AND b.status = 'confirmed'
        ORDER BY b.paid_at DESC NULLS LAST
        LIMIT 1000`,
      [id],
    ),
  ]);

  const t = totals ?? ({} as Totals);
  const past = isPastEvent(event);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/events" className="text-[12px] text-vybe-700 underline">← Events</Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">
          {event.name} {event.tagline ?? ''}
        </h1>
        <p className="mt-1 text-[13px] text-slate">
          {formatEventDate(event.starts_at)} · doors {formatEventTime(event.doors_at ?? event.starts_at)} ·{' '}
          {event.venue_name} · <span className="font-mono">{event.status}</span>
          {past && <span className="ml-2 rounded bg-mist px-1.5 py-0.5 text-[11px] font-semibold">Past event · record</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Passes sold" value={String(t.passes ?? 0)} hint={`${t.confirmed ?? 0} paid bookings`} />
        <Stat label="Admitted" value={String(t.admitted ?? 0)} hint={t.passes ? `${Math.round(((t.admitted ?? 0) / t.passes) * 100)}% of passes` : undefined} />
        <Stat label="Collected" value={formatInr(Number(t.gross_paise ?? 0))} hint={`incl. ${formatInr(Number(t.fee_paise ?? 0))} platform fee`} />
        <Stat label="Tickets emailed" value={`${t.emailed ?? 0} / ${t.confirmed ?? 0}`} hint={`${t.pending ?? 0} unpaid · ${t.nudged ?? 0} nudged`} />
      </div>

      <section className="panel p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">By pass type</h2>
        <table className="mt-3 w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-muted">
              <th className="py-1.5">Pass</th><th className="py-1.5 text-right">Sold</th>
              <th className="py-1.5 text-right">Admitted</th><th className="py-1.5 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((row) => (
              <tr key={row.tier_code} className="border-t border-edge/60">
                <td className="py-2 text-ink">{row.tier_name}</td>
                <td className="py-2 text-right tnum">{row.passes}</td>
                <td className="py-2 text-right tnum">{row.admitted}</td>
                <td className="py-2 text-right tnum">{formatInr(Number(row.revenue_paise))}</td>
              </tr>
            ))}
            {tiers.length === 0 && (
              <tr><td colSpan={4} className="py-3 text-muted">No passes sold yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="panel p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Paid bookings ({bookings.length})
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-[12px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-muted">
                <th className="py-1.5">Ref</th><th>Name</th><th>Email</th><th>Phone</th>
                <th className="text-right">Passes</th><th className="text-right">Paid</th>
                <th>Code</th><th>Admitted</th><th>Paid at</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.reference} className="border-t border-edge/60">
                  <td className="py-1.5 font-mono">
                    <Link href={`/admin/bookings?q=${b.reference}`} className="text-vybe-700 underline">{b.reference}</Link>
                  </td>
                  <td className="text-ink">{b.customer_name}</td>
                  <td className="break-all text-slate">{b.customer_email}</td>
                  <td className="tnum text-slate">{b.customer_phone ?? '—'}</td>
                  <td className="tnum text-right">{b.quantity}</td>
                  <td className="tnum text-right">{formatInr(b.amount_paise)}</td>
                  <td className="font-mono text-slate">{b.referral_code ?? '—'}</td>
                  <td>
                    <span className={b.admitted >= b.quantity ? 'font-semibold text-leaf-600' : b.admitted > 0 ? 'font-semibold text-flare-600' : 'text-muted'}>
                      {b.admitted === 0 ? 'No' : b.admitted >= b.quantity ? 'Yes' : `${b.admitted}/${b.quantity}`}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-muted">
                    {b.paid_at ? new Date(b.paid_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink tnum">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate">{hint}</p>}
    </div>
  );
}
