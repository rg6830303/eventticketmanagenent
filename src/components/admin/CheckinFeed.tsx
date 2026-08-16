'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn, formatDateTime, timeAgo } from '@/lib/utils';
import type { ScanLogRow } from '@/app/api/admin/checkins/route';

const POLL_MS = 5000;
const MAX_ROWS = 200;

const TONE: Record<string, string> = {
  admitted: 'border-l-vybe-500 text-vybe-300',
  duplicate: 'border-l-amber-400 text-amber-300',
  wrong_event: 'border-l-amber-400 text-amber-300',
  void: 'border-l-amber-400 text-amber-300',
  refunded: 'border-l-amber-400 text-amber-300',
  invalid_signature: 'border-l-red-500 text-red-300',
  not_found: 'border-l-red-500 text-red-300',
};

export function CheckinFeed({ initialRows }: { initialRows: ScanLogRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sinceRef = useRef<string>(initialRows[0]?.created_at ?? new Date(0).toISOString());

  const poll = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/checkins?since=${encodeURIComponent(sinceRef.current)}`);
      const body = (await response.json()) as { data?: { rows: ScanLogRow[] } };
      const fresh = body.data?.rows ?? [];
      if (fresh.length > 0) {
        sinceRef.current = fresh[0].created_at;
        // Cap the list — a busy door produces thousands of rows a night and an
        // unbounded array would eventually stall the tab.
        setRows((current) => [...fresh, ...current].slice(0, MAX_ROWS));
      }
      setError(null);
    } catch {
      setError('Connection lost — retrying');
    }
  }, []);

  useEffect(() => {
    if (paused) return;

    const id = window.setInterval(() => {
      // A phone in a pocket should not hammer the API all night.
      if (document.visibilityState === 'visible') void poll();
    }, POLL_MS);

    return () => window.clearInterval(id);
  }, [paused, poll]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {!paused && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pulse-400 opacity-75" />
            )}
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full',
                paused ? 'bg-dim' : 'bg-pulse-400',
              )}
            />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-haze">
            {paused ? 'Paused' : 'Live'}
          </span>
          {error && <span className="text-[11px] text-amber-300">{error}</span>}
        </div>

        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="btn-ghost px-4 py-2 text-[12px]"
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-[13px] text-haze">No scans recorded yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {rows.map((row) => (
              <motion.li
                key={row.id}
                initial={{ opacity: 0, y: -12, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'card border-l-4 p-3.5',
                  TONE[row.result] ?? 'border-l-hairline text-haze',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-chalk">
                      {row.holder_name ?? <span className="text-dim">Unrecognised pass</span>}
                    </p>
                    <p className="truncate font-mono text-[11px] text-dim">
                      {row.ticket_code ?? '—'}
                      {row.gate && ` · ${row.gate}`}
                      {row.operator_name && ` · ${row.operator_name}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-[11px] uppercase">{row.result.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] text-dim" title={formatDateTime(row.created_at)}>
                      {timeAgo(row.created_at)}
                    </p>
                  </div>
                </div>
                {row.message && <p className="mt-1.5 text-[11px] text-haze">{row.message}</p>}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
