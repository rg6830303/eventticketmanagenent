'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Counting must start before the first paint, otherwise the final figure flashes
// for a frame and the animation reads as a glitch rather than a count.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const NUMBER_RE = /\d[\d,]*(\.\d+)?/;

/**
 * Counts the numeric part of an already-formatted string up from zero and then
 * snaps back to the server's exact string, so currency symbols, separators and
 * rounding are never re-derived on the client.
 */
function useCountUp(value: string, duration = 850): string {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const frame = useRef<number | null>(null);

  useIsoLayoutEffect(() => {
    const match = value.match(NUMBER_RE);
    const raw = match?.[0];

    if (reduce || !raw) {
      setDisplay(value);
      return;
    }

    const target = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(target) || target === 0) {
      setDisplay(value);
      return;
    }

    const decimals = raw.includes('.') ? (raw.split('.')[1]?.length ?? 0) : 0;
    const formatter = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: raw.includes(','),
    });

    const started = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      if (t < 1) {
        // Cubic ease-out: quick off the mark, long settle. The number lands.
        const eased = 1 - (1 - t) ** 3;
        setDisplay(value.replace(raw, formatter.format(target * eased)));
        frame.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    };

    setDisplay(value.replace(raw, formatter.format(0)));
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value, reduce, duration]);

  return display;
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  const display = useCountUp(value);

  return (
    <div
      className={cn(
        'card card-lit p-4 transition-colors',
        accent && 'border-vybe-600/50 bg-vybe-500/[0.07]',
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">{label}</p>
      <p
        className={cn(
          'mt-2 font-display text-2xl font-bold tabular-nums leading-none sm:text-3xl',
          accent ? 'text-vybe-100' : 'text-chalk',
        )}
      >
        {display}
      </p>
      {hint && <p className="mt-1.5 text-[11px] text-haze">{hint}</p>}
    </div>
  );
}

/**
 * Capacity meter. Fills from zero to the real figure on mount so the bar itself
 * communicates how far along the night is, not just where the edge sits.
 * Red appears only past 90% — that is a genuine scarcity signal, not decoration.
 */
export function CapacityBar({
  used,
  total,
  className,
}: {
  used: number;
  total: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const width = `${Math.min(100, pct)}%`;
  const tight = pct >= 90;

  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-valuenow={Math.min(100, pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Capacity taken"
        className="relative h-3 w-full overflow-hidden rounded-full bg-elevated shadow-inset"
      >
        <motion.div
          className={cn(
            'h-full rounded-full',
            tight
              ? 'bg-gradient-to-r from-vybe-600 via-vybe-400 to-flare-500'
              : 'bg-gradient-to-r from-vybe-700 via-vybe-500 to-pulse-400',
          )}
          initial={reduce ? false : { width: 0 }}
          animate={{ width }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="font-mono text-[11px] tabular-nums text-haze">{pct}% taken</p>
        {tight && (
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-flare-300">
            Near capacity
          </p>
        )}
      </div>
    </div>
  );
}
