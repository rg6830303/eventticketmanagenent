'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn, formatInr } from '@/lib/utils';
import { Globe } from '@/components/brand/Globe';
import type { CustomerWithBookings } from '@/lib/types';

const PAGE_SIZE = 50;
const EXPORT_LIMIT = 500;

interface Props {
  initialRows: CustomerWithBookings[];
  initialTotal: number;
}

/**
 * The customer catalogue.
 *
 * One search box across name, email and phone, because an operator on the phone
 * to somebody has exactly one piece of information and does not know which
 * column it lives in.
 *
 * Contact details are shown in full here, unlike the bookings list. This page is
 * manager-gated and its entire purpose is reaching people; masking the address
 * and then offering a CSV of the same addresses would be theatre.
 */
export function CustomersTable({ initialRows, initialTotal }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [buyersOnly, setBuyersOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a slow first request landing after a faster second one and
  // repainting the table with stale results.
  const requestSeq = useRef(0);

  const load = useCallback(async (nextPage: number, q: string, buyers: boolean) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(PAGE_SIZE),
      });
      if (q) params.set('q', q);
      if (buyers) params.set('buyers', '1');

      const response = await fetch(`/api/admin/customers?${params.toString()}`);
      const body = (await response.json()) as {
        data?: { rows: CustomerWithBookings[]; total: number };
        error?: string;
      };
      if (seq !== requestSeq.current) return;

      if (!response.ok || !body.data) {
        setError(body.error ?? 'Could not load customers.');
        return;
      }

      setRows(body.data.rows);
      setTotal(body.data.total);
      setPage(nextPage);
    } catch {
      if (seq !== requestSeq.current) return;
      setError('Could not reach the server.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  // Debounced so typing a ten-character email is one query, not ten.
  useEffect(() => {
    const id = window.setTimeout(() => void load(1, search, buyersOnly), 300);
    return () => window.clearTimeout(id);
  }, [search, buyersOnly, load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="customer-search" className="sr-only">
            Search customers
          </label>
          <input
            id="customer-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email or phone"
            className="field"
            autoComplete="off"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-[13px] text-slate">
          <input
            type="checkbox"
            checked={buyersOnly}
            onChange={(event) => setBuyersOnly(event.target.checked)}
            className="h-4 w-4 accent-vybe-600"
          />
          Buyers only
        </label>

        <ExportCustomersButton search={search} buyersOnly={buyersOnly} />
      </div>

      {error && (
        <p role="alert" className="text-[13px] font-medium text-flare-600">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-edge">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-edge bg-frost text-left">
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th className="text-right">Orders</Th>
              <Th className="text-right">Passes</Th>
              <Th className="text-right">Spend</Th>
              <Th>Last seen</Th>
              <Th>Updates</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted">
                  {loading ? 'Loading…' : 'No customers match that search.'}
                </td>
              </tr>
            ) : (
              rows.map((customer) => (
                <tr key={customer.id} className="border-b border-edge/60 last:border-0">
                  <Td>
                    <span className="font-medium text-ink">{customer.name}</span>
                    {customer.pending_count > 0 && (
                      <span className="ml-2 rounded-md bg-flare-200/40 px-1.5 py-0.5 text-[11px] font-medium text-flare-600">
                        {customer.pending_count} unpaid
                      </span>
                    )}
                  </Td>
                  <Td>
                    <a href={`mailto:${customer.email}`} className="link-swipe break-all">
                      {customer.email}
                    </a>
                  </Td>
                  <Td>
                    {customer.phone ? (
                      <a href={`tel:+91${customer.phone}`} className="link-swipe tnum">
                        {customer.phone}
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                  <Td className="tnum text-right">{customer.bookings_count}</Td>
                  <Td className="tnum text-right">
                    {customer.tickets_count}
                    {customer.checked_in_count > 0 && (
                      <span className="ml-1 text-[11px] text-leaf-600">
                        ({customer.checked_in_count} in)
                      </span>
                    )}
                  </Td>
                  <Td className="tnum text-right">{formatInr(customer.lifetime_paise)}</Td>
                  <Td className="whitespace-nowrap text-muted">
                    {new Date(customer.last_seen_at).toLocaleDateString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Td>
                  <Td>
                    {customer.marketing_opt_in ? (
                      <span className="text-leaf-600">Opted in</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-[12px] text-muted">
        <span>
          {total} customer{total === 1 ? '' : 's'}
          {loading && ' · loading…'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => void load(page - 1, search, buyersOnly)}
            className="btn-outline btn-sm px-3 py-1.5 text-[12px] disabled:opacity-40"
          >
            Previous
          </button>
          <span className="tnum">
            {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages || loading}
            onClick={() => void load(page + 1, search, buyersOnly)}
            className="btn-outline btn-sm px-3 py-1.5 text-[12px] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted',
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-3 py-2.5 align-top text-slate', className)}>{children}</td>;
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

const NUMERIC = /^-?\d+(\.\d+)?$/;

function csvCell(input: string | number | boolean | null): string {
  const raw = String(input ?? '');
  // A customer can call themselves "=cmd|…" — quoting alone would still hand a
  // spreadsheet a live formula, so anything non-numeric gets a leading quote.
  const safe = !NUMERIC.test(raw) && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /["\n\r,]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const COLUMNS: Array<{ header: string; cell: (row: CustomerWithBookings) => string | number | boolean }> = [
  { header: 'Name', cell: (r) => r.name },
  { header: 'Email', cell: (r) => r.email },
  { header: 'Phone', cell: (r) => r.phone ?? '' },
  { header: 'Confirmed orders', cell: (r) => r.bookings_count },
  { header: 'Passes bought', cell: (r) => r.tickets_count },
  { header: 'Checked in', cell: (r) => r.checked_in_count },
  { header: 'Lifetime spend (INR)', cell: (r) => (r.lifetime_paise / 100).toFixed(2) },
  { header: 'Marketing opt-in', cell: (r) => (r.marketing_opt_in ? 'yes' : 'no') },
  { header: 'First seen', cell: (r) => r.first_seen_at },
  { header: 'Last seen', cell: (r) => r.last_seen_at },
  { header: 'Latest reference', cell: (r) => r.last_reference ?? '' },
  { header: 'Source', cell: (r) => r.first_source ?? '' },
];

function ExportCustomersButton({ search, buyersOnly }: { search: string; buyersOnly: boolean }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  function reset() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 4000);
  }

  async function handleExport() {
    if (state === 'working') return;
    setState('working');
    setMessage('');

    let url: string | null = null;
    try {
      const params = new URLSearchParams({ limit: String(EXPORT_LIMIT), page: '1' });
      if (search) params.set('q', search);
      if (buyersOnly) params.set('buyers', '1');

      const response = await fetch(`/api/admin/customers?${params.toString()}`);
      const body = (await response.json()) as { data?: { rows: CustomerWithBookings[] } };
      const exportRows = body.data?.rows ?? [];

      if (!response.ok || exportRows.length === 0) {
        setMessage(response.ok ? 'Nothing to export yet.' : 'Export failed. Try again.');
        setState('error');
        reset();
        return;
      }

      const lines = [COLUMNS.map((column) => csvCell(column.header)).join(',')];
      for (const row of exportRows) {
        lines.push(COLUMNS.map((column) => csvCell(column.cell(row))).join(','));
      }

      // BOM first, or Excel opens the file as Latin-1 and mangles names.
      const blob = new Blob(['﻿', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `houz-of-vybe-customers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      setMessage(`${exportRows.length} exported.`);
      setState('done');
      reset();
    } catch {
      setMessage('Could not reach the server.');
      setState('error');
      reset();
    } finally {
      // Freed on the next tick: revoking synchronously can cancel the download
      // in Safari before it has read the blob.
      if (url) {
        const stale = url;
        window.setTimeout(() => URL.revokeObjectURL(stale), 1000);
      }
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={state === 'working'}
        className={cn(
          'btn-outline btn-sm gap-2 whitespace-nowrap px-4 py-2 text-[12px]',
          state === 'done' && 'border-vybe-600 text-vybe-700',
          state === 'error' && 'border-flare-500/60 text-flare-600',
        )}
      >
        {state === 'working' && (
          <Globe
            strokeWidth={6}
            className="h-3.5 w-3.5 animate-spin-slow text-vybe-600 [animation-duration:1.4s]"
          />
        )}
        {state === 'working' ? 'Preparing…' : state === 'done' ? 'Downloaded' : 'Export CSV'}
      </button>
      <p aria-live="polite" className="text-[11px] text-muted">
        {message}
      </p>
    </div>
  );
}
