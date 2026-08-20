'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Globe } from '@/components/brand/Globe';
import { ExportButton } from '@/components/admin/ExportButton';
import { cn, formatInr, maskEmail, maskPhone, timeAgo } from '@/lib/utils';
import type { AdminBookingRow } from '@/app/api/admin/bookings/route';

const STATUSES = ['', 'confirmed', 'pending', 'cancelled', 'refunded', 'failed'] as const;
const PAGE_SIZE = 25;

const STATUS_TONE: Record<string, string> = {
  confirmed: 'border-vybe-500/40 bg-vybe-500/10 text-vybe-700',
  pending: 'border-amber-400/40 bg-amber-400/10 text-amber-700',
  cancelled: 'border-flare-500/40 bg-flare-500/10 text-flare-600',
  refunded: 'border-flare-500/40 bg-flare-500/10 text-flare-600',
  failed: 'border-flare-500/40 bg-flare-500/10 text-flare-600',
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
  const filtered = q !== '' || status !== '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-sm sm:flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
            placeholder="Search reference, name, email or phone"
            className="field pl-10"
            aria-label="Search bookings"
          />
        </div>
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
                  ? 'border-vybe-500 bg-vybe-500/15 text-ink'
                  : 'border-edge text-slate hover:border-vybe-600 hover:text-ink',
              )}
            >
              {value || 'all'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div aria-live="polite" className="flex items-center gap-2 text-[12px] text-muted">
          {loading && (
            <Globe
              spin
              strokeWidth={6}
              className="h-3.5 w-3.5 text-vybe-400 [animation-duration:1.4s]"
            />
          )}
          {loading ? 'Searching…' : `${total} booking${total === 1 ? '' : 's'}`}
        </div>
        <ExportButton />
      </div>

      {loading && rows.length === 0 ? (
        <SkeletonList />
      ) : rows.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center p-12 text-center">
          <Globe spin strokeWidth={1.8} className="h-14 w-14 text-vybe-500/20 [animation-duration:18s]" />
          <p className="mt-4 text-[14px] font-medium text-slate">
            {filtered ? 'No bookings match that search' : 'No bookings yet'}
          </p>
          <p className="mt-1 max-w-[40ch] text-[12px] leading-relaxed text-muted">
            {filtered
              ? 'Check the reference, or clear the status filter and try again.'
              : 'Confirmed and pending bookings appear here the moment they are made.'}
          </p>
        </div>
      ) : (
        <div className={cn('transition-opacity duration-200', loading && 'opacity-50')}>
          {/* Desktop table */}
          <div className="panel hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-[13px]">
              <caption className="sr-only">Bookings, newest first</caption>
              <thead className="border-b border-edge">
                <tr className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  <th scope="col" className="px-4 py-3 font-medium">Reference</th>
                  <th scope="col" className="px-4 py-3 font-medium">Guest</th>
                  <th scope="col" className="px-4 py-3 font-medium">Tier</th>
                  <th scope="col" className="px-4 py-3 font-medium">Qty</th>
                  <th scope="col" className="px-4 py-3 font-medium">In</th>
                  <th scope="col" className="px-4 py-3 font-medium">Amount</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-frost/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/bookings/${row.id}`}
                        className="font-mono text-[12px] text-vybe-600 transition-colors hover:text-vybe-700"
                      >
                        {row.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-ink">{row.customer_name}</p>
                      <p className="text-[11px] text-muted">
                        {maskEmail(row.customer_email)} · {maskPhone(row.customer_phone)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate">{row.tier_name ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-slate">{row.quantity}</td>
                    <td className="px-4 py-3 font-mono text-[12px] tabular-nums text-slate">
                      {row.tickets_used}/{row.tickets_total}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate">
                      {row.amount_paise === 0 ? 'Free' : formatInr(row.amount_paise)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase',
                          STATUS_TONE[row.status] ?? 'border-edge text-slate',
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted">{timeAgo(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards — the table is unreadable at phone width */}
          <ul className="space-y-2.5 lg:hidden">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/admin/bookings/${row.id}`}
                  className="panel block p-4 transition-colors hover:border-vybe-600/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[12px] text-vybe-600">{row.reference}</p>
                      <p className="mt-1 truncate text-[14px] font-medium text-ink">
                        {row.customer_name}
                      </p>
                      <p className="truncate text-[11px] text-muted">{maskEmail(row.customer_email)}</p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase',
                        STATUS_TONE[row.status] ?? 'border-edge text-slate',
                      )}
                    >
                      {row.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-[11px] text-slate">
                    <span className="tabular-nums">×{row.quantity}</span>
                    <span className="font-mono tabular-nums">
                      {row.tickets_used}/{row.tickets_total} in
                    </span>
                    <span className="tabular-nums">
                      {row.amount_paise === 0 ? 'Free' : formatInr(row.amount_paise)}
                    </span>
                    <span className="ml-auto text-muted">{timeAgo(row.created_at)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-outline btn-sm px-4 py-2 text-[12px]"
          >
            Previous
          </button>
          <span className="font-mono text-[11px] tabular-nums text-muted">
            {page} / {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="btn-outline btn-sm px-4 py-2 text-[12px]"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

/** Holds the list's height while a search is in flight, so the page never jumps. */
function SkeletonList() {
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="panel flex items-center gap-4 p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-2.5 w-24 animate-pulse rounded bg-frost" />
            <div className="h-3.5 w-40 animate-pulse rounded bg-frost/80" />
          </div>
          <div className="h-5 w-20 shrink-0 animate-pulse rounded-full bg-frost" />
        </div>
      ))}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.4 15.4 4.1 4.1" strokeLinecap="round" />
    </svg>
  );
}
