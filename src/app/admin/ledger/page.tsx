import { requireSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { getFeaturedEvent } from '@/lib/event-facts';
import { listLedger } from '@/lib/ticket-ledger';
import { cn, formatInr, serialRanges } from '@/lib/utils';
import { TicketTable } from '@/components/admin/TicketTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'All tickets', robots: { index: false, follow: false } };

/**
 * The ledger: every pass issued for an event, one row each — serial, code,
 * type, price, where it came from and who it was sent to — with activation
 * for console and promoter passes and a CSV download of whatever is filtered.
 */
export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  await requireSession('manager');
  const { event: eventParam } = await searchParams;

  const events = await query<{ id: string; name: string; tagline: string | null; slug: string }>(
    `SELECT id, name, tagline, slug FROM events WHERE status <> 'draft' ORDER BY starts_at DESC`,
  );
  const featured = await getFeaturedEvent();
  const event = events.find((e) => e.slug === eventParam) ?? events.find((e) => e.id === featured?.id) ?? events[0];
  const tickets = event ? await listLedger({ eventId: event.id }) : [];

  const live = tickets.filter((t) => t.status !== 'void' && t.booking_status !== 'cancelled');
  const by = (source: string) => live.filter((t) => t.source === source);
  const website = by('website');
  const admin = by('admin');
  const promoter = by('promoter');
  const admitted = live.filter((t) => t.status === 'used').length;
  const websiteRevenue = website.reduce((sum, t) => sum + t.price_paise, 0);
  const serials = live.map((t) => t.serial).filter((s): s is number => s !== null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-ink">All tickets</h1>
          <p className="mt-1 text-[13px] text-slate">
            Every pass issued for {event ? `${event.name} ${event.tagline ?? ''}` : 'this event'}, by serial. Serials
            1000–5000 are promoter passes; 5001 onwards are website and console passes.
          </p>
        </div>
        {events.length > 1 && (
          <form className="flex gap-2">
            <select name="event" defaultValue={event?.slug} className="field py-2 text-[13px]">
              {events.map((e) => (
                <option key={e.id} value={e.slug}>
                  {e.name} {e.tagline ?? ''}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-outline px-3 py-2 text-[12px]">Show</button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Passes issued" value={String(live.length)} hint={serials.length ? `serials ${Math.min(...serials)}–${Math.max(...serials)}` : undefined} />
        <Stat label="Website" value={String(website.length)} hint={formatInr(websiteRevenue)} />
        <Stat label="Console" value={String(admin.length)} />
        <Stat label="Promoter" value={String(promoter.length)} hint={`${promoter.filter((t) => t.active).length} active`} />
        <Stat
          label="Not active"
          value={String(live.filter((t) => !t.active && t.status === 'valid').length)}
          tone={live.some((t) => !t.active && t.status === 'valid') ? 'warn' : undefined}
          hint="refused at the door"
        />
        <Stat label="Admitted" value={String(admitted)} hint={live.length ? `${Math.round((admitted / live.length) * 100)}%` : undefined} />
      </div>

      {promoter.length > 0 && (
        <p className="break-words rounded-xl border border-edge bg-paper px-3 py-2 text-[12px] text-slate">
          <span className="font-semibold text-ink">Promoter serials issued:</span>{' '}
          <span className="font-mono">{serialRanges(promoter.map((t) => t.serial ?? 0).filter(Boolean))}</span>
        </p>
      )}

      <TicketTable tickets={tickets} showSource exportName={`tickets-${event?.slug ?? 'event'}`} />
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'warn' }) {
  return (
    <div className="panel min-w-0 p-3">
      <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className={cn('mt-0.5 truncate font-display text-xl font-bold tnum', tone === 'warn' ? 'text-amber-700' : 'text-ink')}>{value}</p>
      {hint && <p className="truncate text-[10.5px] text-slate">{hint}</p>}
    </div>
  );
}
