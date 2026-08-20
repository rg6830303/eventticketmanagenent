'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Globe } from '@/components/brand/Globe';
import { cn, formatDateTime, timeAgo } from '@/lib/utils';
import type { ScanLogRow } from '@/app/api/admin/checkins/route';

const POLL_MS = 5000;
const MAX_ROWS = 200;

const TONE: Record<string, string> = {
  admitted: 'border-l-vybe-500 text-vybe-600',
  duplicate: 'border-l-amber-400 text-amber-700',
  wrong_event: 'border-l-amber-400 text-amber-700',
  void: 'border-l-amber-400 text-amber-700',
  refunded: 'border-l-amber-400 text-amber-700',
  invalid_signature: 'border-l-flare-500 text-flare-600',
  not_found: 'border-l-flare-500 text-flare-600',
};

export function CheckinFeed({ initialRows }: { initialRows: ScanLogRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sinceRef = useRef<string>(initialRows[0]?.created_at ?? new Date(0).toISOString());
  const reduce = useReducedMotion();

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
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {!paused && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flare-500 opacity-75" />
            )}
            <span
              className={cn(
                'relative inline-flex h-2.5 w-2.5 rounded-full',
                paused ? 'bg-muted' : 'bg-flare-500',
              )}
            />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-slate">
            {paused ? 'Paused' : 'Live'}
          </span>
          {error && (
            <span className="truncate font-mono text-[11px] uppercase tracking-wider text-flare-600">
              {error}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="btn-outline btn-sm shrink-0 px-4 py-2 text-[12px]"
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* The count is the only thing worth announcing — the rows themselves are
          far too chatty for a screen reader at a working door. */}
      <p aria-live="polite" className="sr-only">
        {rows.length} scans in the log
      </p>

      {rows.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center p-12 text-center">
          <Globe spin strokeWidth={1.8} className="h-14 w-14 text-vybe-500/20 [animation-duration:18s]" />
          <p className="mt-4 text-[14px] font-medium text-slate">No scans recorded yet</p>
          <p className="mt-1 max-w-[40ch] text-[12px] leading-relaxed text-muted">
            {paused
              ? 'The feed is paused. Resume it to pick up new scans.'
              : 'The feed is live. Every scan appears here the moment it happens.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {rows.map((row) => (
              <motion.li
                key={row.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, height: 0 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, height: 'auto' }}
                transition={{ duration: reduce ? 0.15 : 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'panel border-l-4 p-3.5',
                  TONE[row.result] ?? 'border-l-edge text-slate',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {row.holder_name ?? <span className="text-muted">Unrecognised pass</span>}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted">
                      {row.ticket_code ?? '—'}
                      {row.gate && ` · ${row.gate}`}
                      {row.operator_name && ` · ${row.operator_name}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wide">
                      {row.result.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[10px] text-muted" title={formatDateTime(row.created_at)}>
                      {timeAgo(row.created_at)}
                    </p>
                  </div>
                </div>
                {row.message && <p className="mt-1.5 text-[11px] text-slate">{row.message}</p>}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
