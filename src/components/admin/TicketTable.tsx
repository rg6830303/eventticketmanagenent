'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { cn, formatInr } from '@/lib/utils';
import { Note, call } from './promoters/ui';

export interface TicketLine {
  id: string;
  serial: number | null;
  code: string;
  holder_name: string;
  status: string;
  active: boolean;
  activated_at: string | null;
  checked_in_at: string | null;
  created_at: string;
  reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  email_sent_at: string | null;
  tier_name: string;
  price_paise: number;
  deal_price_paise: number | null;
  source: 'website' | 'admin' | 'promoter';
  promoter_name: string | null;
  booking_status: string;
}

type State = 'pending' | 'active' | 'deactivated' | 'admitted' | 'void';
type Filter = 'all' | State;
type SourceFilter = 'all' | TicketLine['source'];

function stateOf(t: TicketLine): State {
  if (t.status === 'void' || t.status === 'refunded' || t.booking_status === 'cancelled') return 'void';
  if (t.status === 'used') return 'admitted';
  if (t.active) return 'active';
  return t.activated_at ? 'deactivated' : 'pending';
}

const BADGE: Record<State, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  active: { label: 'Active', cls: 'bg-leaf-600/10 text-leaf-600 border-leaf-600/30' },
  deactivated: { label: 'Deactivated', cls: 'bg-flare-200/40 text-flare-600 border-flare-300' },
  admitted: { label: 'Admitted', cls: 'bg-vybe-100 text-vybe-700 border-vybe-300' },
  void: { label: 'Void', cls: 'bg-mist text-muted border-edge' },
};

const SOURCE_LABEL: Record<TicketLine['source'], string> = { website: 'Website', admin: 'Console', promoter: 'Promoter' };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function priceLabel(t: TicketLine): string {
  if (t.source === 'promoter') return t.deal_price_paise ? `${formatInr(t.deal_price_paise)} deal` : 'Promoter';
  if (t.price_paise === 0) return t.source === 'admin' ? 'Comp' : '₹0';
  return formatInr(t.price_paise);
}

/** Only console and promoter passes are switched from here; website passes are paid through the gateway. */
const switchable = (t: TicketLine) => t.source !== 'website' && t.status !== 'void' && t.status !== 'used' && t.booking_status !== 'cancelled';

function toCsv(rows: TicketLine[]): string {
  const head = ['Serial', 'Code', 'Type', 'Source', 'Promoter', 'Price', 'Status', 'Holder', 'Customer', 'Email', 'Phone', 'Booking', 'Issued', 'Admitted at'];
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((t) =>
    [
      t.serial ?? '',
      t.code,
      t.tier_name,
      SOURCE_LABEL[t.source],
      t.promoter_name ?? '',
      priceLabel(t),
      BADGE[stateOf(t)].label,
      t.holder_name,
      t.customer_name,
      t.customer_email,
      t.customer_phone ?? '',
      t.reference,
      fmt(t.created_at),
      t.checked_in_at ? fmt(t.checked_in_at) : '',
    ]
      .map(cell)
      .join(','),
  );
  return [head.map(cell).join(','), ...lines].join('\n');
}

/**
 * The pass table used by every console view of passes: the All tickets
 * ledger, a promoter's passes and console-issued passes.
 *
 * Filters by state and source, searches everything a person might read out
 * (serial, code, name, email, phone, booking), and activates or deactivates
 * console and promoter passes singly or in bulk — at the door immediately, and
 * without emailing anyone. Cards on phones, a full table on laptops.
 */
export function TicketTable({
  tickets,
  showSource = false,
  defaultFilter = 'all',
  exportName,
}: {
  tickets: TicketLine[];
  showSource?: boolean;
  defaultFilter?: Filter;
  exportName?: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(defaultFilter);
  const [source, setSource] = useState<SourceFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [limit, setLimit] = useState(100);

  const bySource = useMemo(() => (source === 'all' ? tickets : tickets.filter((t) => t.source === source)), [tickets, source]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: bySource.length, pending: 0, active: 0, deactivated: 0, admitted: 0, void: 0 };
    for (const t of bySource) c[stateOf(t)] += 1;
    return c;
  }, [bySource]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, '');
    return bySource.filter((t) => {
      if (filter !== 'all' && stateOf(t) !== filter) return false;
      if (!q) return true;
      if (/^\d+$/.test(q) && t.serial !== null) return String(t.serial).startsWith(q);
      return [t.code, t.customer_name, t.holder_name, t.customer_email, t.customer_phone ?? '', t.reference, t.promoter_name ?? '', t.tier_name]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [bySource, filter, search]);

  const visible = shown.slice(0, limit);
  const selectedLines = tickets.filter((t) => selected.has(t.id));
  const canActivate = selectedLines.filter((t) => switchable(t) && !t.active).length;
  const canDeactivate = selectedLines.filter((t) => switchable(t) && t.active).length;
  const shownSwitchable = shown.filter(switchable);
  const allShownSelected = shownSwitchable.length > 0 && shownSwitchable.every((t) => selected.has(t.id));
  const anySwitchable = tickets.some((t) => t.source !== 'website');

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllShown() {
    setSelected((s) => {
      const next = new Set(s);
      if (allShownSelected) shownSwitchable.forEach((t) => next.delete(t.id));
      else shownSwitchable.forEach((t) => next.add(t.id));
      return next;
    });
  }

  async function apply(ids: string[], active: boolean) {
    if (ids.length === 0) return;
    if (!active && !window.confirm(`Deactivate ${ids.length} pass${ids.length === 1 ? '' : 'es'}? The door will refuse them until reactivated.`)) return;
    setBusy(true);
    setNote(null);
    const result = await call<{ changed: number }>('/api/admin/promoters/tickets', 'POST', { ticketIds: ids, active });
    setBusy(false);
    if (!result.ok || !result.data) {
      setNote({ tone: 'bad', text: result.error ?? 'Failed' });
      return;
    }
    setNote({ tone: 'ok', text: `${active ? 'Activated' : 'Deactivated'} ${result.data.changed}. Live at the door now — no email sent.` });
    setSelected(new Set());
    router.refresh();
  }

  function download() {
    const blob = new Blob([toCsv(shown)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportName ?? 'tickets'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const ActionButton = ({ t, compact }: { t: TicketLine; compact?: boolean }) =>
    switchable(t) ? (
      <button
        type="button"
        disabled={busy}
        onClick={() => void apply([t.id], !t.active)}
        className={cn(
          'rounded-lg font-semibold disabled:opacity-40',
          compact ? 'px-3 py-1.5 text-[12px]' : 'mt-2 w-full py-2 text-[12.5px]',
          t.active ? 'border border-flare-300 text-flare-600' : 'bg-leaf-600 text-white',
        )}
      >
        {t.active ? 'Deactivate' : stateOf(t) === 'deactivated' ? 'Reactivate' : 'Activate'}
      </button>
    ) : null;

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {(['all', 'active', 'pending', 'deactivated', 'admitted', 'void'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFilter(f);
              setLimit(100);
            }}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold',
              filter === f ? 'border-ink bg-ink text-white' : 'border-edge bg-paper text-slate',
            )}
          >
            {f === 'all' ? 'All' : BADGE[f].label} <span className="tnum opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="field min-w-0 flex-1 py-2 text-[14px]"
          placeholder="Search serial, code, name, email, phone or booking"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setLimit(100);
          }}
        />
        {showSource && (
          <select className="field py-2 text-[14px] sm:w-44" value={source} onChange={(e) => setSource(e.target.value as SourceFilter)}>
            <option value="all">All sources</option>
            <option value="website">Website</option>
            <option value="admin">Console</option>
            <option value="promoter">Promoter</option>
          </select>
        )}
        {exportName && (
          <button type="button" onClick={download} className="btn-outline shrink-0 px-4 py-2 text-[13px]">
            Download CSV ({shown.length})
          </button>
        )}
      </div>

      {anySwitchable && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-edge bg-paper/95 p-2 backdrop-blur">
          <label className="flex items-center gap-2 px-1 text-[12.5px] font-medium text-ink">
            <input type="checkbox" checked={allShownSelected} onChange={toggleAllShown} className="h-4 w-4 accent-vybe-600" />
            Select all shown
          </label>
          <span className="text-[12px] text-muted">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              disabled={busy || canActivate === 0}
              onClick={() => void apply(selectedLines.filter((t) => switchable(t) && !t.active).map((t) => t.id), true)}
              className="rounded-lg bg-leaf-600 px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
            >
              Activate {canActivate || ''}
            </button>
            <button
              type="button"
              disabled={busy || canDeactivate === 0}
              onClick={() => void apply(selectedLines.filter((t) => switchable(t) && t.active).map((t) => t.id), false)}
              className="rounded-lg border border-flare-300 px-3 py-2 text-[12.5px] font-semibold text-flare-600 disabled:opacity-40"
            >
              Deactivate {canDeactivate || ''}
            </button>
          </div>
        </div>
      )}

      {note && <Note tone={note.tone}>{note.text}</Note>}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-edge p-6 text-center text-[13px] text-muted">No passes here.</p>
      ) : (
        <>
          {/* Phone: cards */}
          <ul className="space-y-2 md:hidden">
            {visible.map((t) => {
              const s = stateOf(t);
              return (
                <li key={t.id} className={cn('rounded-xl border bg-paper p-3', selected.has(t.id) ? 'border-vybe-500' : 'border-edge')}>
                  <div className="flex items-start gap-3">
                    {anySwitchable && (
                      <input
                        type="checkbox"
                        disabled={!switchable(t)}
                        checked={selected.has(t.id)}
                        onChange={() => toggle(t.id)}
                        className="mt-1 h-5 w-5 shrink-0 accent-vybe-600"
                        aria-label={`Select ${t.code}`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-ink">
                          {t.serial !== null && <span className="mr-1.5 font-mono text-vybe-700">#{t.serial}</span>}
                          {t.holder_name}
                        </p>
                        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold', BADGE[s].cls)}>{BADGE[s].label}</span>
                      </div>
                      <p className="truncate text-[12px] text-slate">{t.customer_email}</p>
                      <p className="text-[12px] text-slate">{t.customer_phone ?? '—'}</p>
                      <p className="mt-1 text-[12px] text-ink">
                        {t.tier_name} · {priceLabel(t)}
                        {showSource && <span className="text-muted"> · {t.source === 'promoter' ? t.promoter_name ?? 'Promoter' : SOURCE_LABEL[t.source]}</span>}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[11px] text-muted">
                        <span>{t.code}</span>
                        <span>{t.reference}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        Issued {fmt(t.created_at)}
                        {t.email_sent_at ? ' · emailed' : ' · email pending'}
                      </p>
                    </div>
                  </div>
                  <ActionButton t={t} />
                </li>
              );
            })}
          </ul>

          {/* Laptop: table */}
          <div className="hidden overflow-x-auto rounded-xl border border-edge bg-paper md:block">
            <table className="w-full min-w-[960px] text-[12.5px]">
              <thead className="bg-frost text-left text-[10.5px] uppercase tracking-[0.1em] text-muted">
                <tr>
                  {anySwitchable && <th className="w-8 px-3 py-2" />}
                  <th className="px-2 py-2">Serial</th>
                  <th className="px-2 py-2">Code</th>
                  <th className="px-2 py-2">Type · price</th>
                  {showSource && <th className="px-2 py-2">Source</th>}
                  <th className="px-2 py-2">Sent to</th>
                  <th className="px-2 py-2">Issued</th>
                  <th className="px-2 py-2">Status</th>
                  {anySwitchable && <th className="px-3 py-2 text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => {
                  const s = stateOf(t);
                  return (
                    <tr key={t.id} className={cn('border-t border-edge/70 align-top', selected.has(t.id) && 'bg-vybe-100/50')}>
                      {anySwitchable && (
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            disabled={!switchable(t)}
                            checked={selected.has(t.id)}
                            onChange={() => toggle(t.id)}
                            className="h-4 w-4 accent-vybe-600"
                            aria-label={`Select ${t.code}`}
                          />
                        </td>
                      )}
                      <td className="px-2 py-2 font-mono font-bold text-ink">{t.serial ?? '—'}</td>
                      <td className="px-2 py-2">
                        <p className="font-mono text-[11.5px] text-ink">{t.code}</p>
                        <p className="font-mono text-[10.5px] text-muted">{t.reference}</p>
                      </td>
                      <td className="px-2 py-2">
                        <p className="text-ink">{t.tier_name}</p>
                        <p className="text-muted">{priceLabel(t)}</p>
                      </td>
                      {showSource && (
                        <td className="px-2 py-2 text-slate">
                          {SOURCE_LABEL[t.source]}
                          {t.promoter_name && <p className="text-[11px] text-muted">{t.promoter_name}</p>}
                        </td>
                      )}
                      <td className="px-2 py-2">
                        <p className="font-semibold text-ink">{t.holder_name}</p>
                        <p className="max-w-[240px] truncate text-slate">{t.customer_email}</p>
                        <p className="tnum text-slate">{t.customer_phone ?? '—'}</p>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-muted">
                        {fmt(t.created_at)}
                        {!t.email_sent_at && <span className="block text-flare-600">email pending</span>}
                      </td>
                      <td className="px-2 py-2">
                        <span className={cn('rounded-full border px-2 py-0.5 text-[10.5px] font-semibold', BADGE[s].cls)}>{BADGE[s].label}</span>
                        {s === 'admitted' && t.checked_in_at && <span className="mt-0.5 block text-[10.5px] text-muted">{fmt(t.checked_in_at)}</span>}
                      </td>
                      {anySwitchable && (
                        <td className="px-3 py-2 text-right">
                          <ActionButton t={t} compact />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {shown.length > visible.length && (
            <button type="button" className="btn-outline w-full py-2 text-[13px]" onClick={() => setLimit((l) => l + 300)}>
              Show more ({shown.length - visible.length} more)
            </button>
          )}
        </>
      )}
    </div>
  );
}
