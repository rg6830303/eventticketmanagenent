import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { listOrphanedPromoterTickets, listPromoterStats, listRecentActivity, listSerialRanges } from '@/lib/promoters';
import { cn, formatInr, serialRanges } from '@/lib/utils';
import { CreatePromoter } from '@/components/admin/promoters/CreatePromoter';
import { ActivityList } from '@/components/admin/promoters/ActivityList';
import { TicketTable } from '@/components/admin/TicketTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Promoters', robots: { index: false, follow: false } };

/**
 * Promoter distribution, at a glance.
 *
 * The totals answer "how exposed are we": passes out in the world, how many of
 * those are still unpaid-for (pending), and how much money is outstanding.
 * Each promoter's row is the same questions for one person.
 */
export default async function PromotersPage() {
  await requireSession('manager');
  const [promoters, activity, orphaned] = await Promise.all([
    listPromoterStats(),
    listRecentActivity(30),
    listOrphanedPromoterTickets(),
  ]);
  const ranges = await listSerialRanges();

  const sum = (key: 'allocated' | 'issued' | 'remaining' | 'pending' | 'activated' | 'admitted' | 'received_paise' | 'due_paise' | 'paid_tickets') =>
    promoters.reduce((acc, p) => acc + Number(p[key] ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-ink">Promoters</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-slate">
            Allocate passes, track what each promoter has issued, log what they have paid you, and activate their
            customers&apos; QR passes once settled. Promoter passes are refused at the door until activated. Promoters
            sign in at <span className="font-mono text-ink">houzofvybe.com/promoter</span>.
          </p>
        </div>
      </div>

      <CreatePromoter />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Promoters" value={String(promoters.filter((p) => p.active).length)} hint={`${promoters.length} total`} />
        <Stat label="Allocated" value={String(sum('allocated'))} />
        <Stat label="Issued" value={String(sum('issued'))} />
        <Stat label="Left to issue" value={String(sum('remaining'))} />
        <Stat label="Pending" value={String(sum('pending'))} tone={sum('pending') > 0 ? 'warn' : undefined} hint="issued, not active" />
        <Stat label="Active" value={String(sum('activated'))} tone="good" />
        <Stat label="Received" value={formatInr(sum('received_paise'))} hint={`${sum('paid_tickets')} passes paid`} />
        <Stat label="Due" value={formatInr(sum('due_paise'))} tone={sum('due_paise') > 0 ? 'warn' : undefined} hint="at deal price" />
      </div>

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">All promoters</h2>
        {promoters.length === 0 && (
          <p className="rounded-xl border border-dashed border-edge p-6 text-center text-[13px] text-muted">
            No promoters yet. Create one above.
          </p>
        )}

        {/* Phone: cards */}
        <ul className="space-y-2 lg:hidden">
          {promoters.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/promoters/${p.id}`} className="panel block p-4 transition-colors hover:border-vybe-400">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-display text-lg font-bold text-ink">{p.name}</p>
                  {!p.active && <span className="shrink-0 rounded-full bg-mist px-2 py-0.5 text-[10.5px] font-semibold text-muted">Suspended</span>}
                </div>
                <Bar issued={p.issued} allocated={p.allocated} />
                {ranges.get(p.id) && (
                  <p className="mt-1 break-words font-mono text-[11px] text-slate">#{serialRanges(ranges.get(p.id) ?? [])}</p>
                )}
                <div className="mt-2 grid grid-cols-4 gap-1 text-center">
                  <Mini label="Issued" value={p.issued} />
                  <Mini label="Left" value={p.remaining} />
                  <Mini label="Pending" value={p.pending} warn={p.pending > 0} />
                  <Mini label="Active" value={p.activated} />
                </div>
                <p className="mt-2 flex justify-between text-[12px] text-slate">
                  <span>Received {formatInr(p.received_paise)}</span>
                  <span className={cn(p.due_paise > 0 && 'font-semibold text-flare-600')}>Due {formatInr(p.due_paise)}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>

        {/* Laptop: table */}
        {promoters.length > 0 && (
          <div className="hidden overflow-x-auto rounded-xl border border-edge bg-paper lg:block">
            <table className="w-full text-[13px]">
              <thead className="bg-frost text-left text-[10.5px] uppercase tracking-[0.1em] text-muted">
                <tr>
                  <th className="px-3 py-2">Promoter</th>
                  <th className="px-2 py-2">Usage</th>
                  <th className="px-2 py-2">Serials</th>
                  <th className="px-2 py-2 text-right">Allocated</th>
                  <th className="px-2 py-2 text-right">Issued</th>
                  <th className="px-2 py-2 text-right">Left</th>
                  <th className="px-2 py-2 text-right">Pending</th>
                  <th className="px-2 py-2 text-right">Active</th>
                  <th className="px-2 py-2 text-right">Admitted</th>
                  <th className="px-2 py-2 text-right">Received</th>
                  <th className="px-3 py-2 text-right">Due</th>
                </tr>
              </thead>
              <tbody>
                {promoters.map((p) => (
                  <tr key={p.id} className="border-t border-edge/70 hover:bg-frost/60">
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/promoters/${p.id}`} className="font-semibold text-ink underline-offset-2 hover:underline">
                        {p.name}
                      </Link>
                      <p className="text-[11px] text-muted">
                        {p.active ? p.phone ?? p.email ?? '—' : 'Suspended'}
                        {p.last_issued_at ? ` · last issue ${new Date(p.last_issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                      </p>
                    </td>
                    <td className="w-40 px-2 py-2.5"><Bar issued={p.issued} allocated={p.allocated} /></td>
                    <td className="max-w-[180px] px-2 py-2.5 font-mono text-[11.5px] text-slate">{serialRanges(ranges.get(p.id) ?? []) || '—'}</td>
                    <td className="tnum px-2 py-2.5 text-right">{p.allocated}</td>
                    <td className="tnum px-2 py-2.5 text-right">{p.issued}</td>
                    <td className="tnum px-2 py-2.5 text-right">{p.remaining}</td>
                    <td className={cn('tnum px-2 py-2.5 text-right', p.pending > 0 && 'font-semibold text-amber-700')}>{p.pending}</td>
                    <td className="tnum px-2 py-2.5 text-right text-leaf-600">{p.activated}</td>
                    <td className="tnum px-2 py-2.5 text-right">{p.admitted}</td>
                    <td className="tnum px-2 py-2.5 text-right">{formatInr(p.received_paise)}</td>
                    <td className={cn('tnum px-3 py-2.5 text-right', p.due_paise > 0 && 'font-semibold text-flare-600')}>{formatInr(p.due_paise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {orphaned.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Passes from deleted promoters ({orphaned.length})
          </h2>
          <p className="text-[12px] text-slate">Their accounts are gone but the customers still hold these passes. Activate or deactivate them here.</p>
          <TicketTable tickets={orphaned} />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Recent activity</h2>
        <ActivityList rows={activity} showPromoter />
      </section>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'warn' | 'good' }) {
  return (
    <div className="panel min-w-0 p-3">
      <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className={cn('mt-0.5 truncate font-display text-xl font-bold tnum', tone === 'warn' ? 'text-amber-700' : tone === 'good' ? 'text-leaf-600' : 'text-ink')}>
        {value}
      </p>
      {hint && <p className="truncate text-[10.5px] text-slate">{hint}</p>}
    </div>
  );
}

function Mini({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-frost py-1.5">
      <p className={cn('tnum font-display text-base font-bold', warn ? 'text-amber-700' : 'text-ink')}>{value}</p>
      <p className="text-[10px] uppercase tracking-[0.08em] text-muted">{label}</p>
    </div>
  );
}

function Bar({ issued, allocated }: { issued: number; allocated: number }) {
  const pct = allocated > 0 ? Math.min(100, Math.round((issued / allocated) * 100)) : 0;
  return (
    <div className="mt-2 lg:mt-0">
      <div className="h-2 overflow-hidden rounded-full bg-mist">
        <div className="h-full rounded-full bg-vybe-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-0.5 text-[10.5px] text-muted">{issued}/{allocated} issued · {pct}%</p>
    </div>
  );
}
