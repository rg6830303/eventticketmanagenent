'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Globe } from '@/components/brand/Globe';
import { cn, formatInr, timeAgo } from '@/lib/utils';
import type { AdminStats } from '@/app/api/admin/stats/route';

const POLL_MS = 5000;

/**
 * Live door counters.
 *
 * Polls rather than holds a socket: a serverless deployment has nowhere to keep
 * a persistent connection, and at a five-second cadence the numbers are current
 * enough for a door team while costing one cheap aggregate query per tick.
 *
 * Polling stops while the tab is hidden — a phone in a pocket should not hammer
 * the API for the whole night — and resumes immediately on focus so the first
 * thing an operator sees is fresh.
 */
export function LiveStats({
  initial,
  eventSlug,
}: {
  initial: AdminStats;
  eventSlug?: string;
}) {
  const [stats, setStats] = useState(initial);
  const [stale, setStale] = useState(false);
  const previous = useRef(initial);

  const poll = useCallback(async () => {
    try {
      const url = eventSlug
        ? `/api/admin/stats?event=${encodeURIComponent(eventSlug)}`
        : '/api/admin/stats';
      const response = await fetch(url, { cache: 'no-store' });
      const body = (await response.json()) as { data?: AdminStats };
      if (body.data) {
        setStats((current) => {
          previous.current = current;
          return body.data as AdminStats;
        });
        setStale(false);
      }
    } catch {
      setStale(true);
    }
  }, [eventSlug]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void poll();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);

  const justAdmitted = stats.checkedIn > previous.current.checkedIn;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate">
          <span className="relative flex h-2 w-2">
            {!stale && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flare-500 opacity-70" />
            )}
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full',
                stale ? 'bg-muted' : 'bg-flare-500',
              )}
            />
          </span>
          {stale ? 'Reconnecting' : 'Live'}
        </p>
        <p className="font-mono text-[10px] text-muted">
          {stats.lastScanAt ? `last scan ${timeAgo(stats.lastScanAt)}` : 'no scans yet'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Customers"
          value={stats.customers}
          hint={`${stats.bookings} booking${stats.bookings === 1 ? '' : 's'}`}
        />
        <Tile label="Tickets issued" value={stats.ticketsIssued} hint={`${stats.capacityUsed}% of capacity`} />
        <Tile
          label="Checked in"
          value={stats.checkedIn}
          hint={
            stats.ticketsIssued > 0
              ? `${Math.round((stats.checkedIn / stats.ticketsIssued) * 100)}% through the door`
              : 'nobody yet'
          }
          accent
          pulse={justAdmitted}
        />
        <Tile label="Yet to arrive" value={stats.yetToArrive} hint="issued, not scanned" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="panel px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Revenue</p>
          {/* Zero collected is not the same as free entry — it is usually a
              night that has not sold yet, and labelling it "Free entry" has
              sent more than one operator looking for a pricing bug. */}
          <p className="mt-1 font-display text-lg font-bold tabular-nums text-ink">
            {formatInr(stats.revenuePaise)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">confirmed bookings only</p>
        </div>
        {/* Surfacing this makes single-use enforcement visible rather than
            something the team has to take on trust. */}
        <div
          className={cn(
            'panel px-4 py-3',
            stats.duplicatesBlocked > 0 && 'border-amber-400/40 bg-amber-400/[0.06]',
          )}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Re-use blocked
          </p>
          <p
            className={cn(
              'mt-1 font-display text-lg font-bold tabular-nums',
              stats.duplicatesBlocked > 0 ? 'text-amber-700' : 'text-ink',
            )}
          >
            {stats.duplicatesBlocked}
          </p>
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  accent,
  pulse,
}: {
  label: string;
  value: number;
  hint?: string;
  accent?: boolean;
  pulse?: boolean;
}) {
  const reduce = useReducedMotion();

  return (
    <div
      className={cn(
        'panel shadow-mid relative overflow-hidden p-4 transition-colors duration-500',
        accent && 'border-vybe-600/50 bg-vybe-500/[0.07]',
        pulse && 'border-vybe-400',
      )}
    >
      {pulse && !reduce && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-vybe-400"
          initial={{ opacity: 0.28 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      )}

      <p className="relative font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{label}</p>

      {/* Keyed on the value so each change swaps rather than mutates in place —
          a number that visibly ticks over is how the room notices a scan. */}
      <div className="relative mt-2 h-[34px] overflow-hidden sm:h-[40px]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={value}
            initial={reduce ? { opacity: 0 } : { y: 22, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: -22, opacity: 0 }}
            transition={{ duration: reduce ? 0.15 : 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-2xl font-bold tabular-nums leading-none text-ink sm:text-3xl"
          >
            {value}
          </motion.p>
        </AnimatePresence>
      </div>

      {hint && <p className="relative mt-1.5 text-[11px] text-slate">{hint}</p>}
    </div>
  );
}

/** Shown while the dashboard has no event to report on. */
export function LiveStatsEmpty() {
  return (
    <div className="panel flex flex-col items-center justify-center p-10 text-center">
      <Globe spin strokeWidth={1.8} className="h-12 w-12 text-vybe-500/20 [animation-duration:18s]" />
      <p className="mt-4 text-[14px] font-medium text-slate">No event to report on</p>
    </div>
  );
}
