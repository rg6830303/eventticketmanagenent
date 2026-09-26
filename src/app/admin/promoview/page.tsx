import { query } from '@/lib/db';
import { getFeaturedEvent } from '@/lib/event-facts';
import { listPromoterStats, listSerialRanges } from '@/lib/promoters';
import { hasViewSession } from '@/lib/promoview';
import { cn, formatInr, serialRanges } from '@/lib/utils';
import { PromoViewLock, PromoViewSignOut } from '@/components/admin/PromoViewLock';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Promoter overview', robots: { index: false, follow: false, nocache: true } };

interface FeedRow {
  id: string;
  kind: string;
  quantity: number;
  amount_paise: number;
  note: string | null;
  created_at: string;
  promoter_name: string;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * View-only promoter overview at hovadmin.vercel.app/promoview.
 *
 * Behind its own one-code lock, not the admin login, and with no controls of
 * any kind: every figure here is read straight from the same tables the
 * console writes. Nothing links into the console.
 */
export default async function PromoViewPage() {
  if (!(await hasViewSession())) {
    return (
      <div className="min-h-dvh bg-canvas px-4">
        <PromoViewLock />
      </div>
    );
  }

  const [promoters, ranges, event, payments, feed] = await Promise.all([
    listPromoterStats(),
    listSerialRanges(),
    getFeaturedEvent(),
    query<FeedRow>(
      `SELECT a.id, a.kind, a.quantity, a.amount_paise, a.note, a.created_at, p.name AS promoter_name
         FROM promoter_activity a JOIN promoters p ON p.id = a.promoter_id
        WHERE a.kind IN ('payment', 'payment_removed')
        ORDER BY a.created_at DESC LIMIT 200`,
    ),
    query<FeedRow>(
      `SELECT a.id, a.kind, a.quantity, a.amount_paise, a.note, a.created_at, p.name AS promoter_name
         FROM promoter_activity a JOIN promoters p ON p.id = a.promoter_id
        WHERE a.kind IN ('issued', 'allocated', 'revoked', 'activated', 'deactivated')
        ORDER BY a.created_at DESC LIMIT 60`,
    ),
  ]);

  const sum = (k: 'allocated' | 'issued' | 'remaining' | 'pending' | 'activated' | 'admitted' | 'paid_tickets' | 'received_paise' | 'due_paise') =>
    promoters.reduce((acc, p) => acc + Number(p[k] ?? 0), 0);
  const expected = promoters.reduce((acc, p) => acc + p.issued * p.deal_price_paise, 0);
  const ranked = [...promoters].sort((a, b) => b.issued - a.issued);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 border-b border-edge bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted">Promoter overview · view only</p>
            <p className="truncate font-display text-lg font-bold text-ink">
              {event ? `${event.name} ${event.tagline ?? ''}` : 'Houz of Vybe'}
            </p>
          </div>
          <PromoViewSignOut />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-5">
        {/* Totals */}
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Promoters" value={String(promoters.filter((p) => p.active).length)} hint={`${promoters.length} total`} />
          <Stat label="Passes allocated" value={String(sum('allocated'))} />
          <Stat label="Passes issued" value={String(sum('issued'))} hint={`${sum('remaining')} left to issue`} />
          <Stat label="Admitted" value={String(sum('admitted'))} />
          <Stat label="Active" value={String(sum('activated'))} tone="good" hint="valid at the door" />
          <Stat label="Pending activation" value={String(sum('pending'))} tone={sum('pending') > 0 ? 'warn' : undefined} />
          <Stat label="Money received" value={formatInr(sum('received_paise'))} tone="good" hint={`${sum('paid_tickets')} passes paid`} />
          <Stat
            label="Money due"
            value={formatInr(sum('due_paise'))}
            tone={sum('due_paise') > 0 ? 'bad' : undefined}
            hint={expected ? `of ${formatInr(expected)} expected` : undefined}
          />
        </section>

        {/* Collection progress */}
        {expected > 0 && (
          <section className="rounded-2xl border border-edge bg-paper p-4">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-semibold text-ink">Collected</span>
              <span className="tnum text-slate">
                {formatInr(sum('received_paise'))} / {formatInr(expected)}
              </span>
            </div>
            <Bar value={sum('received_paise')} total={expected} tone="bg-leaf-600" />
          </section>
        )}

        {/* Per promoter */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Promoters by passes issued</h2>
          {ranked.length === 0 && (
            <p className="rounded-xl border border-dashed border-edge p-6 text-center text-[13px] text-muted">No promoters yet.</p>
          )}

          {/* Phone + tablet: cards */}
          <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {ranked.map((p, i) => (
              <li key={p.id} className="rounded-2xl border border-edge bg-paper p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-display text-lg font-bold text-ink">
                    <span className="mr-1.5 text-muted">{i + 1}.</span>
                    {p.name}
                  </p>
                  {!p.active && <span className="shrink-0 rounded-full bg-mist px-2 py-0.5 text-[10.5px] font-semibold text-muted">Suspended</span>}
                </div>
                <Bar value={p.issued} total={p.allocated} tone="bg-vybe-500" />
                <p className="mt-0.5 text-[11px] text-muted">
                  {p.issued}/{p.allocated} issued
                  {ranges.get(p.id) ? ` · #${serialRanges(ranges.get(p.id) ?? [])}` : ''}
                </p>
                <div className="mt-3 grid grid-cols-4 gap-1 text-center">
                  <Mini label="Left" value={p.remaining} />
                  <Mini label="Pending" value={p.pending} warn={p.pending > 0} />
                  <Mini label="Active" value={p.activated} />
                  <Mini label="In" value={p.admitted} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
                  <div className="rounded-lg bg-leaf-600/5 px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-muted">Received</p>
                    <p className="font-display text-[15px] font-bold tnum text-leaf-600">{formatInr(p.received_paise)}</p>
                    <p className="text-[10.5px] text-slate">{p.paid_tickets} passes</p>
                  </div>
                  <div className={cn('rounded-lg px-2.5 py-2', p.due_paise > 0 ? 'bg-flare-200/30' : 'bg-frost')}>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-muted">Due</p>
                    <p className={cn('font-display text-[15px] font-bold tnum', p.due_paise > 0 ? 'text-flare-600' : 'text-ink')}>
                      {p.deal_price_paise ? formatInr(p.due_paise) : '—'}
                    </p>
                    <p className="text-[10.5px] text-slate">{p.deal_price_paise ? `${formatInr(p.deal_price_paise)}/pass` : 'no deal price'}</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  {p.last_issued_at ? `Last issued ${when(p.last_issued_at)}` : 'Nothing issued yet'}
                </p>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          {ranked.length > 0 && (
            <div className="hidden overflow-x-auto rounded-xl border border-edge bg-paper lg:block">
              <table className="w-full text-[13px]">
                <thead className="bg-frost text-left text-[10.5px] uppercase tracking-[0.1em] text-muted">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-2 py-2">Promoter</th>
                    <th className="px-2 py-2">Usage</th>
                    <th className="px-2 py-2">Serials</th>
                    <th className="px-2 py-2 text-right">Issued</th>
                    <th className="px-2 py-2 text-right">Left</th>
                    <th className="px-2 py-2 text-right">Pending</th>
                    <th className="px-2 py-2 text-right">Active</th>
                    <th className="px-2 py-2 text-right">Admitted</th>
                    <th className="px-2 py-2 text-right">Deal</th>
                    <th className="px-2 py-2 text-right">Received</th>
                    <th className="px-3 py-2 text-right">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((p, i) => (
                    <tr key={p.id} className="border-t border-edge/70">
                      <td className="px-3 py-2.5 text-muted">{i + 1}</td>
                      <td className="px-2 py-2.5">
                        <p className="font-semibold text-ink">{p.name}</p>
                        <p className="text-[11px] text-muted">
                          {p.active ? (p.last_issued_at ? `last issued ${when(p.last_issued_at)}` : 'nothing issued yet') : 'Suspended'}
                        </p>
                      </td>
                      <td className="w-36 px-2 py-2.5">
                        <Bar value={p.issued} total={p.allocated} tone="bg-vybe-500" />
                        <p className="mt-0.5 text-[10.5px] text-muted">{p.issued}/{p.allocated}</p>
                      </td>
                      <td className="max-w-[160px] px-2 py-2.5 font-mono text-[11.5px] text-slate">{serialRanges(ranges.get(p.id) ?? []) || '—'}</td>
                      <td className="tnum px-2 py-2.5 text-right">{p.issued}</td>
                      <td className="tnum px-2 py-2.5 text-right">{p.remaining}</td>
                      <td className={cn('tnum px-2 py-2.5 text-right', p.pending > 0 && 'font-semibold text-amber-700')}>{p.pending}</td>
                      <td className="tnum px-2 py-2.5 text-right text-leaf-600">{p.activated}</td>
                      <td className="tnum px-2 py-2.5 text-right">{p.admitted}</td>
                      <td className="tnum px-2 py-2.5 text-right text-slate">{p.deal_price_paise ? formatInr(p.deal_price_paise) : '—'}</td>
                      <td className="tnum px-2 py-2.5 text-right text-leaf-600">
                        {formatInr(p.received_paise)}
                        <span className="block text-[10.5px] text-muted">{p.paid_tickets} passes</span>
                      </td>
                      <td className={cn('tnum px-3 py-2.5 text-right', p.due_paise > 0 ? 'font-semibold text-flare-600' : 'text-ink')}>
                        {p.deal_price_paise ? formatInr(p.due_paise) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Feed
            title="Payments received"
            empty="No payments logged yet."
            rows={payments}
            render={(r) => (
              <>
                <span className="font-semibold text-ink">{r.promoter_name}</span>{' '}
                <span className={r.kind === 'payment' ? 'text-leaf-600' : 'text-flare-600'}>
                  {r.kind === 'payment' ? '+' : '−'}
                  {formatInr(r.amount_paise)}
                </span>
                {r.quantity ? <span className="text-slate"> · {r.quantity} passes</span> : null}
                {r.kind === 'payment_removed' && <span className="text-slate"> (correction)</span>}
              </>
            )}
          />
          <Feed
            title="Recent activity"
            empty="Nothing yet."
            rows={feed}
            render={(r) => (
              <>
                <span className="font-semibold text-ink">{r.promoter_name}</span>{' '}
                <span className="text-slate">
                  {r.kind === 'issued'
                    ? `issued ${r.quantity} pass${r.quantity === 1 ? '' : 'es'}`
                    : r.kind === 'allocated'
                      ? `was allocated ${r.quantity}`
                      : r.kind === 'revoked'
                        ? `had ${r.quantity} taken back`
                        : r.kind === 'activated'
                          ? `${r.quantity} pass${r.quantity === 1 ? '' : 'es'} activated`
                          : `${r.quantity} pass${r.quantity === 1 ? '' : 'es'} deactivated`}
                </span>
              </>
            )}
            hideNotesFor={['issued']}
          />
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="min-w-0 rounded-2xl border border-edge bg-paper p-3 sm:p-4">
      <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p
        className={cn(
          'mt-0.5 truncate font-display text-xl font-bold tnum sm:text-2xl',
          tone === 'good' ? 'text-leaf-600' : tone === 'warn' ? 'text-amber-700' : tone === 'bad' ? 'text-flare-600' : 'text-ink',
        )}
      >
        {value}
      </p>
      {hint && <p className="truncate text-[10.5px] text-slate">{hint}</p>}
    </div>
  );
}

function Mini({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-frost py-1.5">
      <p className={cn('font-display text-base font-bold tnum', warn ? 'text-amber-700' : 'text-ink')}>{value}</p>
      <p className="text-[10px] uppercase tracking-[0.08em] text-muted">{label}</p>
    </div>
  );
}

function Bar({ value, total, tone }: { value: number; total: number; tone: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-mist">
      <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Feed({
  title,
  empty,
  rows,
  render,
  hideNotesFor = [],
}: {
  title: string;
  empty: string;
  rows: FeedRow[];
  render: (row: FeedRow) => React.ReactNode;
  hideNotesFor?: string[];
}) {
  return (
    <section className="min-w-0 space-y-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-edge p-5 text-center text-[13px] text-muted">{empty}</p>
      ) : (
        <ol className="max-h-[520px] divide-y divide-edge/70 overflow-y-auto rounded-xl border border-edge bg-paper">
          {rows.map((r) => (
            <li key={r.id} className="px-3 py-2.5 text-[13px]">
              <p className="min-w-0 break-words">{render(r)}</p>
              {/* Issue notes carry customer contact details; those stay in the console. */}
              {r.note && !hideNotesFor.includes(r.kind) && <p className="break-words text-[12px] text-slate">{r.note}</p>}
              <p className="text-[11px] tnum text-muted">{when(r.created_at)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
