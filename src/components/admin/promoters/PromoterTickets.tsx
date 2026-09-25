'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Note, call } from './ui';

export interface TicketLine {
  id: string;
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
  promoter_name?: string | null;
}

type Filter = 'all' | 'pending' | 'active' | 'admitted' | 'void';

function stateOf(t: TicketLine): Exclude<Filter, 'all'> {
  if (t.status === 'void') return 'void';
  if (t.status === 'used') return 'admitted';
  return t.active ? 'active' : 'pending';
}

const BADGE: Record<Exclude<Filter, 'all'>, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  active: { label: 'Active', cls: 'bg-leaf-600/10 text-leaf-600 border-leaf-600/30' },
  admitted: { label: 'Admitted', cls: 'bg-vybe-100 text-vybe-700 border-vybe-300' },
  void: { label: 'Void', cls: 'bg-mist text-muted border-edge' },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Every pass a promoter has issued, with bulk activation.
 *
 * Built for hundreds of rows on a phone: filter by state, search by customer
 * or code, tick the ones you have been paid for (or "select all shown"), and
 * activate in one tap. Activating emails each customer that their QR now works.
 */
export function PromoterTickets({ tickets, showPromoter = false }: { tickets: TicketLine[]; showPromoter?: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('pending');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [limit, setLimit] = useState(100);

  const counts = useMemo(() => {
    const c = { all: tickets.length, pending: 0, active: 0, admitted: 0, void: 0 };
    for (const t of tickets) c[stateOf(t)] += 1;
    return c;
  }, [tickets]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filter !== 'all' && stateOf(t) !== filter) return false;
      if (!q) return true;
      return [t.code, t.customer_name, t.customer_email, t.customer_phone ?? '', t.reference, t.promoter_name ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [tickets, filter, search]);

  const visible = shown.slice(0, limit);
  const actionable = (t: TicketLine) => t.status !== 'void' && t.status !== 'used';
  const selectedLines = tickets.filter((t) => selected.has(t.id));
  const canActivate = selectedLines.filter((t) => actionable(t) && !t.active).length;
  const canDeactivate = selectedLines.filter((t) => actionable(t) && t.active).length;
  const allShownSelected = shown.filter(actionable).length > 0 && shown.filter(actionable).every((t) => selected.has(t.id));

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
      const ids = shown.filter(actionable).map((t) => t.id);
      if (allShownSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function apply(ids: string[], active: boolean) {
    if (ids.length === 0) return;
    if (!active && !window.confirm(`Deactivate ${ids.length} pass${ids.length === 1 ? '' : 'es'}? They will be refused at the door until reactivated.`)) return;
    setBusy(true);
    setNote(null);
    const result = await call<{ changed: number; emailing: number }>('/api/admin/promoters/tickets', 'POST', { ticketIds: ids, active });
    setBusy(false);
    if (!result.ok || !result.data) {
      setNote({ tone: 'bad', text: result.error ?? 'Failed' });
      return;
    }
    setNote({
      tone: 'ok',
      text: active
        ? `Activated ${result.data.changed}. Emailing ${result.data.emailing} customer${result.data.emailing === 1 ? '' : 's'} that their pass is live.`
        : `Deactivated ${result.data.changed}.`,
    });
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {(['pending', 'active', 'admitted', 'void', 'all'] as Filter[]).map((f) => (
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

      <input
        className="field py-2 text-[14px]"
        placeholder="Search name, email, phone, code or reference"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Bulk bar — sticky so it stays reachable while scrolling a long list on a phone. */}
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
            onClick={() => void apply(selectedLines.filter((t) => actionable(t) && !t.active).map((t) => t.id), true)}
            className="rounded-lg bg-leaf-600 px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
          >
            Activate {canActivate || ''}
          </button>
          <button
            type="button"
            disabled={busy || canDeactivate === 0}
            onClick={() => void apply(selectedLines.filter((t) => actionable(t) && t.active).map((t) => t.id), false)}
            className="rounded-lg border border-flare-300 px-3 py-2 text-[12.5px] font-semibold text-flare-600 disabled:opacity-40"
          >
            Deactivate {canDeactivate || ''}
          </button>
        </div>
      </div>

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
                    <input
                      type="checkbox"
                      disabled={!actionable(t)}
                      checked={selected.has(t.id)}
                      onChange={() => toggle(t.id)}
                      className="mt-1 h-5 w-5 shrink-0 accent-vybe-600"
                      aria-label={`Select ${t.code}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-ink">{t.holder_name}</p>
                        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold', BADGE[s].cls)}>{BADGE[s].label}</span>
                      </div>
                      <p className="truncate text-[12px] text-slate">{t.customer_email}</p>
                      <p className="text-[12px] text-slate">{t.customer_phone ?? '—'}</p>
                      <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] text-muted">
                        <span>{t.code}</span>
                        <span>{t.reference}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {showPromoter && t.promoter_name ? `${t.promoter_name} · ` : ''}Issued {fmt(t.created_at)}
                        {t.email_sent_at ? ' · emailed' : ' · email not sent'}
                      </p>
                    </div>
                  </div>
                  {actionable(t) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void apply([t.id], !t.active)}
                      className={cn(
                        'mt-2 w-full rounded-lg py-2 text-[12.5px] font-semibold disabled:opacity-40',
                        t.active ? 'border border-flare-300 text-flare-600' : 'bg-leaf-600 text-white',
                      )}
                    >
                      {t.active ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Laptop: table */}
          <div className="hidden overflow-x-auto rounded-xl border border-edge bg-paper md:block">
            <table className="w-full text-[12.5px]">
              <thead className="bg-frost text-left text-[10.5px] uppercase tracking-[0.1em] text-muted">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="px-2 py-2">Customer</th>
                  <th className="px-2 py-2">Contact</th>
                  <th className="px-2 py-2">Pass code</th>
                  {showPromoter && <th className="px-2 py-2">Promoter</th>}
                  <th className="px-2 py-2">Issued</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => {
                  const s = stateOf(t);
                  return (
                    <tr key={t.id} className={cn('border-t border-edge/70', selected.has(t.id) && 'bg-vybe-100/50')}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          disabled={!actionable(t)}
                          checked={selected.has(t.id)}
                          onChange={() => toggle(t.id)}
                          className="h-4 w-4 accent-vybe-600"
                          aria-label={`Select ${t.code}`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <p className="font-semibold text-ink">{t.holder_name}</p>
                        <p className="font-mono text-[10.5px] text-muted">{t.reference}</p>
                      </td>
                      <td className="px-2 py-2">
                        <p className="max-w-[220px] truncate text-slate">{t.customer_email}</p>
                        <p className="tnum text-slate">{t.customer_phone ?? '—'}</p>
                      </td>
                      <td className="px-2 py-2 font-mono text-[11.5px] text-ink">{t.code}</td>
                      {showPromoter && <td className="px-2 py-2 text-slate">{t.promoter_name ?? '—'}</td>}
                      <td className="whitespace-nowrap px-2 py-2 text-muted">
                        {fmt(t.created_at)}
                        {!t.email_sent_at && <span className="block text-flare-600">email not sent</span>}
                      </td>
                      <td className="px-2 py-2">
                        <span className={cn('rounded-full border px-2 py-0.5 text-[10.5px] font-semibold', BADGE[s].cls)}>{BADGE[s].label}</span>
                        {t.activated_at && s === 'active' && <span className="mt-0.5 block text-[10.5px] text-muted">{fmt(t.activated_at)}</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {actionable(t) && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void apply([t.id], !t.active)}
                            className={cn(
                              'rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40',
                              t.active ? 'border border-flare-300 text-flare-600' : 'bg-leaf-600 text-white',
                            )}
                          >
                            {t.active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {shown.length > visible.length && (
            <button type="button" className="btn-outline w-full py-2 text-[13px]" onClick={() => setLimit((l) => l + 200)}>
              Show more ({shown.length - visible.length} hidden)
            </button>
          )}
        </>
      )}
    </div>
  );
}
