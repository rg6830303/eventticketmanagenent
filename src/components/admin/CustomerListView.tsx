'use client';

import { useMemo, useState } from 'react';
import { cn, formatInr } from '@/lib/utils';

export interface CustomerRow {
  email: string;
  name: string;
  phone: string | null;
  bookings: number;
  passes: number;
  paid_paise: number;
  sources: string[];
  promoters: string[];
  registered: boolean;
  first_at: string;
}

const LABEL: Record<string, string> = { website: 'Website', admin: 'Console', promoter: 'Promoter' };

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Read-only list of pass holders for one event, with search, a source filter and CSV. */
export function CustomerListView({ customers, exportName }: { customers: CustomerRow[]; exportName: string }) {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [limit, setLimit] = useState(100);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(
      (c) =>
        (source === 'all' || c.sources.includes(source)) &&
        (!q || [c.name, c.email, c.phone ?? '', ...c.promoters].join(' ').toLowerCase().includes(q)),
    );
  }, [customers, search, source]);

  function download() {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Name', 'Email', 'Phone', 'Passes', 'Bookings', 'Paid online', 'Source', 'Promoter', 'Account', 'First booking'];
    const lines = shown.map((c) =>
      [c.name, c.email, c.phone, c.passes, c.bookings, c.paid_paise / 100, c.sources.map((s) => LABEL[s] ?? s).join(' + '), c.promoters.join(', '), c.registered ? 'Yes' : 'No', when(c.first_at)]
        .map(cell)
        .join(','),
    );
    const url = URL.createObjectURL(new Blob([[head.map(cell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="field min-w-0 flex-1 py-2 text-[14px]"
          placeholder="Search name, email, phone or promoter"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setLimit(100);
          }}
        />
        <select className="field py-2 text-[14px] sm:w-44" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="all">All sources</option>
          <option value="website">Website</option>
          <option value="promoter">Promoter</option>
          <option value="admin">Console</option>
        </select>
        <button type="button" onClick={download} className="btn-outline shrink-0 px-4 py-2 text-[13px]">
          Download CSV ({shown.length})
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-edge p-6 text-center text-[13px] text-muted">No customers here.</p>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {shown.slice(0, limit).map((c) => (
              <li key={c.email} className="rounded-xl border border-edge bg-paper p-3 text-[13px]">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-semibold text-ink">{c.name}</p>
                  <p className="shrink-0 font-display font-bold tnum text-ink">
                    {c.passes} pass{c.passes === 1 ? '' : 'es'}
                  </p>
                </div>
                <p className="truncate text-slate">{c.email}</p>
                <p className="text-slate">{c.phone ?? '—'}</p>
                <p className="mt-1 text-[12px] text-muted">
                  {c.sources.map((s) => LABEL[s] ?? s).join(' + ')}
                  {c.promoters.length ? ` · ${c.promoters.join(', ')}` : ''}
                  {c.paid_paise ? ` · ${formatInr(c.paid_paise)} paid` : ''}
                  {c.registered ? ' · account' : ''}
                </p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-xl border border-edge bg-paper md:block">
            <table className="w-full text-[12.5px]">
              <thead className="bg-frost text-left text-[10.5px] uppercase tracking-[0.1em] text-muted">
                <tr>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-2 py-2">Contact</th>
                  <th className="px-2 py-2 text-right">Passes</th>
                  <th className="px-2 py-2">Source</th>
                  <th className="px-2 py-2 text-right">Paid online</th>
                  <th className="px-3 py-2">First booking</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, limit).map((c) => (
                  <tr key={c.email} className="border-t border-edge/70 align-top">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-ink">{c.name}</p>
                      {c.registered && <span className="text-[10.5px] font-semibold text-vybe-700">Account</span>}
                    </td>
                    <td className="px-2 py-2">
                      <p className="max-w-[260px] truncate text-slate">{c.email}</p>
                      <p className="tnum text-slate">{c.phone ?? '—'}</p>
                    </td>
                    <td className="tnum px-2 py-2 text-right font-semibold text-ink">{c.passes}</td>
                    <td className="px-2 py-2 text-slate">
                      {c.sources.map((s) => LABEL[s] ?? s).join(' + ')}
                      {c.promoters.length > 0 && <p className="text-[11px] text-muted">{c.promoters.join(', ')}</p>}
                    </td>
                    <td className={cn('tnum px-2 py-2 text-right', c.paid_paise ? 'text-ink' : 'text-muted')}>
                      {c.paid_paise ? formatInr(c.paid_paise) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted">{when(c.first_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length > limit && (
            <button type="button" className="btn-outline w-full py-2 text-[13px]" onClick={() => setLimit((l) => l + 300)}>
              Show more ({shown.length - limit} more)
            </button>
          )}
        </>
      )}
    </div>
  );
}
