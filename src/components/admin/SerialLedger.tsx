'use client';

import { useMemo, useState } from 'react';
import { cn, formatInr, serialRanges } from '@/lib/utils';

export interface SerialRow {
  serial: number;
  state: string;
  holder_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  reference: string | null;
  sold_at: string | null;
  paid_paise: number;
}

type Filter = 'all' | 'unsold' | 'sold' | 'paid' | 'unpaid';

const STATE: Record<string, { label: string; chip: string; badge: string }> = {
  unsold: { label: 'Unsold', chip: 'bg-paper text-muted border-edge', badge: 'bg-mist text-muted border-edge' },
  pending: { label: 'Sold · pending', chip: 'bg-amber-100 text-amber-900 border-amber-300', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  active: { label: 'Sold · active', chip: 'bg-leaf-600 text-white border-leaf-600', badge: 'bg-leaf-600/10 text-leaf-600 border-leaf-600/30' },
  deactivated: { label: 'Deactivated', chip: 'bg-flare-200/60 text-flare-600 border-flare-300', badge: 'bg-flare-200/40 text-flare-600 border-flare-300' },
  admitted: { label: 'Admitted', chip: 'bg-vybe-500 text-white border-vybe-500', badge: 'bg-vybe-100 text-vybe-700 border-vybe-300' },
  void: { label: 'Void', chip: 'bg-mist text-muted border-edge line-through', badge: 'bg-mist text-muted border-edge' },
};

const sold = (r: SerialRow) => r.state !== 'unsold';

/**
 * Every serial allocated to one promoter: a colour grid to see the whole
 * range at a glance, and a table of who each serial was sold to and what has
 * been paid against it. Shared by the console and the promoter's own
 * dashboard; it only displays.
 */
export function SerialLedger({ rows, dealPricePaise }: { rows: SerialRow[]; dealPricePaise: number }) {
  const [filter, setFilter] = useState<Filter>('sold');
  const [open, setOpen] = useState<number | null>(null);

  const counts = useMemo(
    () => ({
      all: rows.length,
      unsold: rows.filter((r) => !sold(r)).length,
      sold: rows.filter(sold).length,
      paid: rows.filter((r) => sold(r) && r.paid_paise > 0).length,
      unpaid: rows.filter((r) => sold(r) && r.paid_paise <= 0 && r.state !== 'void').length,
    }),
    [rows],
  );

  const shown = rows.filter((r) =>
    filter === 'all'
      ? true
      : filter === 'unsold'
        ? !sold(r)
        : filter === 'sold'
          ? sold(r)
          : filter === 'paid'
            ? sold(r) && r.paid_paise > 0
            : sold(r) && r.paid_paise <= 0 && r.state !== 'void',
  );

  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-edge p-5 text-center text-[13px] text-muted">No serials allocated yet.</p>;
  }

  const detail = open === null ? null : rows.find((r) => r.serial === open) ?? null;

  return (
    <div className="space-y-3">
      <p className="break-words font-mono text-[12.5px] text-slate">
        Allocated #{serialRanges(rows.map((r) => r.serial))}
        {counts.unsold > 0 && (
          <span className="text-muted"> · unsold #{serialRanges(rows.filter((r) => !sold(r)).map((r) => r.serial))}</span>
        )}
      </p>

      {/* The whole range at a glance. Tap a serial for its record. */}
      <div className="flex flex-wrap gap-1">
        {rows.map((r) => (
          <button
            key={r.serial}
            type="button"
            onClick={() => setOpen((o) => (o === r.serial ? null : r.serial))}
            title={`#${r.serial} · ${STATE[r.state]?.label ?? r.state}${r.paid_paise > 0 ? ' · paid' : ''}`}
            className={cn(
              'relative min-w-[3.1rem] rounded-md border px-1.5 py-1 font-mono text-[11px] font-semibold tnum',
              STATE[r.state]?.chip,
              open === r.serial && 'ring-2 ring-ink ring-offset-1',
            )}
          >
            {r.serial}
            {sold(r) && r.paid_paise > 0 && (
              <span aria-hidden className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-paper bg-leaf-600" />
            )}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {['unsold', 'pending', 'active', 'admitted', 'deactivated'].map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={cn('h-3 w-3 rounded border', STATE[k].chip)} />
            {STATE[k].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-leaf-600" /> money received
        </span>
      </div>

      {detail && (
        <div className="rounded-xl border border-ink bg-paper p-3 text-[13px]">
          <p className="font-mono font-bold text-ink">#{detail.serial}</p>
          {sold(detail) ? (
            <>
              <p className="font-semibold text-ink">{detail.holder_name}</p>
              <p className="break-all text-slate">{detail.customer_email}</p>
              <p className="text-slate">{detail.customer_phone}</p>
              <p className="mt-1 text-slate">
                {STATE[detail.state]?.label} · {detail.paid_paise > 0 ? `${formatInr(detail.paid_paise)} received` : 'no payment logged'}
                {detail.reference ? ` · ${detail.reference}` : ''}
              </p>
            </>
          ) : (
            <p className="text-muted">Not sold yet.</p>
          )}
        </div>
      )}

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {(['sold', 'paid', 'unpaid', 'unsold', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold capitalize',
              filter === f ? 'border-ink bg-ink text-white' : 'border-edge bg-paper text-slate',
            )}
          >
            {f === 'unpaid' ? 'Sold, unpaid' : f} <span className="tnum opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-edge p-4 text-center text-[13px] text-muted">None.</p>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {shown.map((r) => (
              <li key={r.serial} className="rounded-xl border border-edge bg-paper p-3 text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono font-bold text-ink">#{r.serial}</p>
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10.5px] font-semibold', STATE[r.state]?.badge)}>{STATE[r.state]?.label}</span>
                </div>
                {sold(r) && (
                  <>
                    <p className="mt-1 truncate font-semibold text-ink">{r.holder_name}</p>
                    <p className="truncate text-[12px] text-slate">{r.customer_email}</p>
                    <p className="text-[12px] text-slate">{r.customer_phone}</p>
                  </>
                )}
                <p className={cn('mt-1 text-[12px] font-semibold', r.paid_paise > 0 ? 'text-leaf-600' : 'text-muted')}>
                  {r.paid_paise > 0 ? `${formatInr(r.paid_paise)} received` : sold(r) ? `Unpaid${dealPricePaise ? ` · ${formatInr(dealPricePaise)} due` : ''}` : '—'}
                </p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-xl border border-edge bg-paper md:block">
            <table className="w-full text-[12.5px]">
              <thead className="bg-frost text-left text-[10.5px] uppercase tracking-[0.1em] text-muted">
                <tr>
                  <th className="px-3 py-2">Serial</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Sold to</th>
                  <th className="px-2 py-2">Booking</th>
                  <th className="px-2 py-2">Sold</th>
                  <th className="px-3 py-2 text-right">Money received</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.serial} className="border-t border-edge/70 align-top">
                    <td className="px-3 py-2 font-mono font-bold text-ink">#{r.serial}</td>
                    <td className="px-2 py-2">
                      <span className={cn('rounded-full border px-2 py-0.5 text-[10.5px] font-semibold', STATE[r.state]?.badge)}>{STATE[r.state]?.label}</span>
                    </td>
                    <td className="px-2 py-2">
                      {sold(r) ? (
                        <>
                          <p className="font-semibold text-ink">{r.holder_name}</p>
                          <p className="max-w-[240px] truncate text-slate">{r.customer_email}</p>
                          <p className="text-slate">{r.customer_phone}</p>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 font-mono text-[11px] text-muted">{r.reference ?? '—'}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-muted">
                      {r.sold_at
                        ? new Date(r.sold_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className={cn('px-3 py-2 text-right font-semibold tnum', r.paid_paise > 0 ? 'text-leaf-600' : 'text-muted')}>
                      {r.paid_paise > 0 ? formatInr(r.paid_paise) : sold(r) ? 'Unpaid' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
