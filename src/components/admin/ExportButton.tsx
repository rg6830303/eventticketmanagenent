'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe } from '@/components/brand/Globe';
import { cn } from '@/lib/utils';
import type { AdminBookingRow } from '@/app/api/admin/bookings/route';

const LIMIT = 100;

const COLUMNS: Array<{ header: string; cell: (row: AdminBookingRow) => string | number }> = [
  { header: 'Reference', cell: (r) => r.reference },
  { header: 'Guest', cell: (r) => r.customer_name },
  { header: 'Email', cell: (r) => r.customer_email },
  { header: 'Phone', cell: (r) => r.customer_phone },
  { header: 'Event', cell: (r) => r.event_name },
  { header: 'Tier', cell: (r) => r.tier_name ?? '' },
  { header: 'Quantity', cell: (r) => r.quantity },
  { header: 'Amount (INR)', cell: (r) => (r.amount_paise / 100).toFixed(2) },
  { header: 'Tickets issued', cell: (r) => r.tickets_total },
  { header: 'Checked in', cell: (r) => r.tickets_used },
  { header: 'Status', cell: (r) => r.status },
  { header: 'Created', cell: (r) => r.created_at },
];

const NUMERIC = /^-?\d+(\.\d+)?$/;

function csvCell(input: string | number): string {
  const raw = String(input ?? '');
  // A guest can call themselves "=cmd|…" — quoting alone would still hand a
  // spreadsheet a live formula, so anything non-numeric gets a leading quote.
  const safe = !NUMERIC.test(raw) && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /["\n\r,]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(rows: AdminBookingRow[]): string {
  const lines = [COLUMNS.map((column) => csvCell(column.header)).join(',')];
  for (const row of rows) {
    lines.push(COLUMNS.map((column) => csvCell(column.cell(row))).join(','));
  }
  return lines.join('\r\n');
}

type State = 'idle' | 'working' | 'done' | 'error';

export function ExportButton({ className }: { className?: string }) {
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');
  const resetTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  function scheduleReset() {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setState('idle'), 4000);
  }

  async function handleExport() {
    if (state === 'working') return;
    setState('working');
    setMessage('');

    let url: string | null = null;
    try {
      const response = await fetch(`/api/admin/bookings?limit=${LIMIT}`);
      const body = (await response.json()) as { data?: { rows: AdminBookingRow[] } };
      const rows = body.data?.rows ?? [];

      if (!response.ok || rows.length === 0) {
        setMessage(response.ok ? 'Nothing to export yet.' : 'Export failed. Try again.');
        setState('error');
        scheduleReset();
        return;
      }

      // BOM first, or Excel opens the file as Latin-1 and mangles guest names.
      const blob = new Blob(['\uFEFF', toCsv(rows)], { type: 'text/csv;charset=utf-8' });
      url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `houz-of-vybe-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      setMessage(`${rows.length} booking${rows.length === 1 ? '' : 's'} exported.`);
      setState('done');
      scheduleReset();
    } catch {
      setMessage('Could not reach the server.');
      setState('error');
      scheduleReset();
    } finally {
      // Freed on the next tick: revoking synchronously can cancel the download
      // in Safari before it has read the blob.
      if (url) {
        const stale = url;
        window.setTimeout(() => URL.revokeObjectURL(stale), 1000);
      }
    }
  }

  const label =
    state === 'working' ? 'Preparing…' : state === 'done' ? 'Downloaded' : 'Export CSV';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        type="button"
        onClick={handleExport}
        disabled={state === 'working'}
        className={cn(
          'btn-ghost gap-2 px-4 py-2 text-[12px]',
          state === 'done' && 'border-vybe-600 text-vybe-200',
          state === 'error' && 'border-flare-500/60 text-flare-300',
        )}
      >
        {state === 'working' ? (
          <Globe strokeWidth={6} className="h-3.5 w-3.5 animate-orbit text-vybe-300 [animation-duration:1.4s]" />
        ) : (
          <DownloadIcon className="h-3.5 w-3.5" />
        )}
        {label}
      </button>

      <p
        aria-live="polite"
        className={cn('text-[11px]', state === 'error' ? 'text-flare-300' : 'text-dim')}
      >
        {message}
      </p>
    </div>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M12 3v12" strokeLinecap="round" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" strokeLinecap="round" />
    </svg>
  );
}
