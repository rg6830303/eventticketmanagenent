'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cn, formatInr, maskEmail, maskPhone, timeAgo } from '@/lib/utils';
import type { AdminBookingRow } from '@/app/api/admin/bookings/route';

const STATUSES = ['', 'confirmed', 'pending', 'cancelled', 'refunded', 'failed'] as const;
const PAGE_SIZE = 25;

const STATUS_TONE: Record<string, string> = {
  confirmed: 'border-vybe-500/40 bg-vybe-500/10 text-vybe-200',
  pending: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  cancelled: 'border-red-500/40 bg-red-500/10 text-red-200',
  refunded: 'border-red-500/40 bg-red-500/10 text-red-200',
  failed: 'border-red-500/40 bg-red-500/10 text-red-200',
};

export function BookingsTable({
  initialRows,
  initialTotal,
}: {
  initialRows: AdminBookingRow[];
  initialTotal: number;
}) {
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    // Skip the fetch on mount — the server already rendered exactly this page.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const controller = new AbortController();
    // Debounced so typing a reference does not fire a query per keystroke.
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (q) params.set('q', q);
        if (status) params.set('status', status);

        const response = await fetch(`/api/admin/bookings?${params}`, { signal: controller.signal });
        const body = (await response.json()) as { data?: { rows: AdminBookingRow[]; total: number } };
        if (body.data) {
          setRows(body.data.rows);
          setTotal(body.data.total);
        }
      } catch {
        // Aborted or offline — keep whatever is on screen.
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [q, status, page]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
          placeholder="Search reference, name, email or phone"
          className="field sm:max-w-sm"
          aria-label="Search bookings"
        />
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((value) => (
            <button
              key={value || 'all'}
              type="button"
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
              aria-pressed={status === value}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[11px] font-medium capitalize transition-colors',
                status === value
                  ? 'border-vybe-500 bg-vybe-500/15 text-chalk'
                  : 'border-hairline text-haze hover:text-chalk',
              )}
            >
              {value || 'all'}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite" className="text-[12px] text-dim">
        {loading ? 'Searching…' : `${total} booking${total === 1 ? '' : 's'}`}
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-[13px] text-haze">No bookings match that search.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-hairline">
                <tr className="font-mono text-[10px] uppercase tracking-wider text-dim">
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Guest</th>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">In</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-elevated/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/bookings/${row.id}`} className="font-mono text-[12px] text-vybe-300">
                        {row.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-chalk">{row.customer_name}</p>
                      <p className="text-[11px] text-dim">
                        {maskEmail(row.customer_email)} · {maskPhone(row.customer_phone)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-haze">{row.tier_name ?? '—'}</td>
                    <td className="px-4 py-3 text-haze">{row.quantity}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-haze">
                      {row.tickets_used}/{row.tickets_total}
                    </td>
                    <td className="px-4 py-3 text-haze">
                      {row.amount_paise === 0 ? 'Free' : formatInr(row.amount_paise)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase',
                          STATUS_TONE[row.status] ?? 'border-hairline text-haze',
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-dim">{timeAgo(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards — the table is unreadable at phone width */}
          <ul className="space-y-2.5 lg:hidden">
            {rows.map((row) => (
              <li key={row.id}>
                <Link href={`/admin/bookings/${row.id}`} className="card block p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[12px] text-vybe-300">{row.reference}</p>
                      <p className="mt-1 truncate text-[14px] font-medium text-chalk">
                        {row.customer_name}
                      </p>
                      <p className="truncate text-[11px] text-dim">{maskEmail(row.customer_email)}</p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase',
                        STATUS_TONE[row.status] ?? 'border-hairline text-haze',
                      )}
                    >
                      {row.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-[11px] text-haze">
                    <span>×{row.quantity}</span>
                    <span className="font-mono">
                      {row.tickets_used}/{row.tickets_total} in
                    </span>
                    <span>{row.amount_paise === 0 ? 'Free' : formatInr(row.amount_paise)}</span>
                    <span className="ml-auto text-dim">{timeAgo(row.created_at)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost px-4 py-2 text-[12px]"
          >
            Previous
          </button>
          <span className="font-mono text-[11px] text-dim">
            {page} / {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="btn-ghost px-4 py-2 text-[12px]"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
