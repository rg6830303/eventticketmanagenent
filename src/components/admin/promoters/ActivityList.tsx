import Link from 'next/link';
import { cn, formatInr } from '@/lib/utils';

interface Row {
  id: string;
  kind: string;
  quantity: number;
  amount_paise: number;
  reference: string | null;
  note: string | null;
  actor: string | null;
  created_at: string;
  promoter_id?: string;
  promoter_name?: string;
}

const LABEL: Record<string, { text: (r: Row) => string; tone: string }> = {
  created: { text: () => 'Account created', tone: 'text-slate' },
  updated: { text: () => 'Details updated', tone: 'text-slate' },
  code_changed: { text: () => 'Login code changed', tone: 'text-slate' },
  allocated: { text: (r) => `+${r.quantity} passes allocated`, tone: 'text-vybe-700' },
  revoked: { text: (r) => `−${r.quantity} passes taken back`, tone: 'text-flare-600' },
  issued: { text: (r) => `Issued ${r.quantity} pass${r.quantity === 1 ? '' : 'es'}`, tone: 'text-ink' },
  payment: { text: (r) => `Payment ${formatInr(r.amount_paise)}${r.quantity ? ` · ${r.quantity} passes` : ''}`, tone: 'text-leaf-600' },
  payment_removed: { text: (r) => `Payment correction −${formatInr(r.amount_paise)}${r.quantity ? ` · −${r.quantity} passes` : ''}`, tone: 'text-flare-600' },
  activated: { text: (r) => `Activated ${r.quantity} pass${r.quantity === 1 ? '' : 'es'}`, tone: 'text-leaf-600' },
  deactivated: { text: (r) => `Deactivated ${r.quantity} pass${r.quantity === 1 ? '' : 'es'}`, tone: 'text-flare-600' },
};

export function ActivityList({ rows, showPromoter = false }: { rows: Row[]; showPromoter?: boolean }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-edge p-5 text-center text-[13px] text-muted">Nothing yet.</p>;
  }
  return (
    <ol className="divide-y divide-edge/70 overflow-hidden rounded-xl border border-edge bg-paper">
      {rows.map((r) => {
        const label = LABEL[r.kind] ?? { text: () => r.kind, tone: 'text-slate' };
        return (
          <li key={r.id} className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:items-baseline sm:gap-3">
            <span className="shrink-0 text-[11px] tnum text-muted sm:w-28">
              {new Date(r.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </span>
            <div className="min-w-0 flex-1 text-[13px]">
              {showPromoter && r.promoter_id && (
                <Link href={`/admin/promoters/${r.promoter_id}`} className="mr-1.5 font-semibold text-ink underline-offset-2 hover:underline">
                  {r.promoter_name}
                </Link>
              )}
              <span className={cn('font-medium', label.tone)}>{label.text(r)}</span>
              {r.reference && <span className="ml-1.5 font-mono text-[11px] text-muted">{r.reference}</span>}
              {r.note && <p className="break-words text-[12px] text-slate">{r.note}</p>}
            </div>
            {r.actor && <span className="shrink-0 truncate text-[11px] text-muted sm:max-w-[180px]">{r.actor}</span>}
          </li>
        );
      })}
    </ol>
  );
}
