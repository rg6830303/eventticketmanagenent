import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { getPromoterStats, listActivity, listPromoterTickets } from '@/lib/promoters';
import { cn, formatInr } from '@/lib/utils';
import { ActivityList } from '@/components/admin/promoters/ActivityList';
import { PromoterControls } from '@/components/admin/promoters/PromoterControls';
import { PromoterTickets } from '@/components/admin/promoters/PromoterTickets';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Promoter', robots: { index: false, follow: false } };

export default async function PromoterPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession('manager');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const promoter = await getPromoterStats(id);
  if (!promoter) notFound();
  const [tickets, activity] = await Promise.all([listPromoterTickets(id), listActivity(id)]);

  // Passes paid for but not yet switched on, or switched on but not paid for —
  // the two mismatches an admin needs pointed out rather than worked out.
  const unpaidActive = promoter.activated - promoter.paid_tickets;
  const paidInactive = Math.min(promoter.pending, promoter.paid_tickets - promoter.activated);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/promoters" className="text-[12px] text-vybe-700 underline">← Promoters</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 break-words font-display text-2xl font-bold text-ink">{promoter.name}</h1>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold',
              promoter.active ? 'bg-leaf-600/10 text-leaf-600' : 'bg-mist text-muted',
            )}
          >
            {promoter.active ? 'Active' : 'Suspended'}
          </span>
        </div>
        <p className="mt-1 break-words text-[13px] text-slate">
          {[promoter.phone, promoter.email].filter(Boolean).join(' · ') || 'No contact details'} · code{' '}
          <span className="font-mono">{promoter.code_hint}</span> ·{' '}
          {promoter.last_login_at
            ? `last signed in ${new Date(promoter.last_login_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
            : 'never signed in'}
        </p>
        {promoter.notes && <p className="mt-1 text-[12.5px] text-muted">{promoter.notes}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Allocated" value={promoter.allocated} />
        <Stat label="Issued" value={promoter.issued} hint={promoter.voided ? `${promoter.voided} void` : undefined} />
        <Stat label="Left to issue" value={promoter.remaining} />
        <Stat label="Admitted" value={promoter.admitted} />
        <Stat label="Pending activation" value={promoter.pending} tone={promoter.pending > 0 ? 'warn' : undefined} />
        <Stat label="Active" value={promoter.activated} tone="good" />
        <Stat label="Paid for (logged)" value={promoter.paid_tickets} hint={formatInr(promoter.received_paise)} />
        <Stat
          label="Amount due"
          value={formatInr(promoter.due_paise)}
          tone={promoter.due_paise > 0 ? 'bad' : undefined}
          hint={promoter.deal_price_paise ? `${promoter.issued} × ${formatInr(promoter.deal_price_paise)}` : 'set a deal price'}
        />
      </div>

      {(unpaidActive > 0 || paidInactive > 0) && (
        <div className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12.5px] text-amber-900">
          {unpaidActive > 0 && (
            <p>
              <strong>{unpaidActive}</strong> active pass{unpaidActive === 1 ? ' is' : 'es are'} more than the payments logged
              cover.
            </p>
          )}
          {paidInactive > 0 && (
            <p>
              <strong>{paidInactive}</strong> pass{paidInactive === 1 ? ' has' : 'es have'} been paid for but not activated yet.
            </p>
          )}
        </div>
      )}

      <PromoterControls promoter={promoter} />

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Issued passes ({tickets.length})</h2>
        <PromoterTickets tickets={tickets} />
      </section>

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Activity</h2>
        <ActivityList rows={activity} />
      </section>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: number | string; hint?: string; tone?: 'warn' | 'good' | 'bad' }) {
  return (
    <div className="panel min-w-0 p-3">
      <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p
        className={cn(
          'mt-0.5 truncate font-display text-xl font-bold tnum',
          tone === 'warn' ? 'text-amber-700' : tone === 'good' ? 'text-leaf-600' : tone === 'bad' ? 'text-flare-600' : 'text-ink',
        )}
      >
        {value}
      </p>
      {hint && <p className="truncate text-[10.5px] text-slate">{hint}</p>}
    </div>
  );
}
