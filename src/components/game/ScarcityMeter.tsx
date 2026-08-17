'use client';

import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Globe } from '@/components/brand/Globe';
import { cn } from '@/lib/utils';

export interface ScarcityTier {
  code: string;
  name: string;
  remaining: number;
  total: number;
}

interface ScarcityMeterProps {
  tiers: ReadonlyArray<ScarcityTier>;
  className?: string;
}

type Band = 'plenty' | 'moving' | 'low' | 'gone';

/**
 * Every label here is a statement about the numbers that were passed in — no
 * copy in this file can appear unless the underlying stock actually justifies
 * it. "Nearly gone" means fewer than a fifth of that tier is left, nothing else.
 */
const BAND: Record<Band, { bar: string; label: string; chip: string; note: string; pulse: boolean }> =
  {
    plenty: {
      bar: 'from-vybe-600 via-vybe-500 to-vybe-300',
      label: 'text-vybe-200',
      chip: 'border-vybe-500/35 bg-vybe-500/10 text-vybe-200',
      note: 'Open',
      pulse: false,
    },
    moving: {
      bar: 'from-amber-600 via-amber-500 to-amber-300',
      label: 'text-amber-200',
      chip: 'border-amber-500/35 bg-amber-500/10 text-amber-200',
      note: 'Going',
      pulse: false,
    },
    low: {
      bar: 'from-flare-600 via-flare-500 to-flare-300',
      label: 'text-flare-300',
      chip: 'border-flare-500/40 bg-flare-500/10 text-flare-300',
      note: 'Nearly gone',
      pulse: true,
    },
    gone: {
      bar: 'from-hairline to-hairline',
      label: 'text-dim',
      chip: 'border-hairline bg-white/[0.03] text-dim',
      note: 'Sold out',
      pulse: false,
    },
  };

function bandFor(remaining: number, total: number): Band {
  if (total <= 0 || remaining <= 0) return 'gone';
  const ratio = remaining / total;
  if (ratio > 0.5) return 'plenty';
  if (ratio >= 0.2) return 'moving';
  return 'low';
}

/** Counts to `target` once the panel is on screen. Starts at the true value so
 *  a viewer without JS, or one who scrolls past fast, never sees a wrong number. */
function useCountUp(target: number, active: boolean, reduce: boolean): number {
  const [value, setValue] = useState(target);
  const played = useRef(false);

  useEffect(() => {
    if (reduce || !active || played.current) {
      if (reduce) setValue(target);
      return;
    }
    played.current = true;

    let frame = 0;
    const started = performance.now();
    const duration = 1100;

    const step = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active, reduce, target]);

  return value;
}

export function ScarcityMeter({ tiers, className }: ScarcityMeterProps) {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px 0px -60px 0px' });

  const rows = tiers.map((tier) => {
    const total = Math.max(0, Math.round(tier.total));
    const remaining = Math.min(total, Math.max(0, Math.round(tier.remaining)));
    return { ...tier, total, remaining, percent: total > 0 ? (remaining / total) * 100 : 0 };
  });

  const totalRemaining = rows.reduce((sum, row) => sum + row.remaining, 0);
  const totalStock = rows.reduce((sum, row) => sum + row.total, 0);
  const counted = useCountUp(totalRemaining, inView, reduce);
  const allGone = totalStock > 0 && totalRemaining === 0;

  return (
    <div
      ref={ref}
      className={cn('card card-lit relative isolate p-6 sm:p-8', className)}
      role="group"
      aria-label="Live ticket stock"
    >
      <Globe
        className="pointer-events-none absolute -right-10 -top-10 -z-10 h-48 w-48 text-vybe-500/[0.07]"
        strokeWidth={1.6}
      />

      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="eyebrow">Live stock</p>
          <p className="mt-2 font-display text-3xl font-extrabold leading-none tracking-tight text-chalk sm:text-4xl">
            <span className="tabular-nums text-gradient">{counted}</span>
            <span className="ml-2 text-lg font-semibold text-haze sm:text-xl">
              of {totalStock} tickets remaining
            </span>
          </p>
        </div>
        <p className="text-[12px] leading-relaxed text-dim">
          Read from the booking system, not a banner.
        </p>
      </header>

      <ul className="mt-7 space-y-5">
        {rows.map((row, index) => {
          const band = bandFor(row.remaining, row.total);
          const style = BAND[band];
          const sold = band === 'gone';

          return (
            <li key={row.code} className={cn(sold && 'opacity-55')}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="flex items-center gap-2.5 text-[15px] font-semibold text-chalk">
                  {row.name}
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]',
                      style.chip,
                    )}
                  >
                    {style.note}
                  </span>
                </p>
                <p className={cn('font-mono text-[12px] tracking-wide', style.label)}>
                  {sold ? 'Sold out' : `${row.remaining} of ${row.total} left`}
                </p>
              </div>

              <div
                aria-hidden
                className="relative mt-2.5 h-2 w-full overflow-hidden rounded-full bg-ink ring-1 ring-inset ring-hairline"
              >
                {reduce ? (
                  <span
                    className={cn('block h-full rounded-full bg-gradient-to-r', style.bar)}
                    style={{ width: `${row.percent}%` }}
                  />
                ) : (
                  <motion.span
                    className={cn('block h-full rounded-full bg-gradient-to-r', style.bar)}
                    initial={{ width: 0 }}
                    animate={inView ? { width: `${row.percent}%` } : { width: 0 }}
                    transition={{ duration: 1.05, delay: 0.06 * index, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
                {style.pulse && (
                  <span
                    className="pointer-events-none absolute inset-0 animate-pulse rounded-full bg-flare-500/25"
                    style={{ width: `${row.percent}%` }}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {allGone && (
        <p className="mt-6 border-t border-hairline pt-5 text-[13px] leading-relaxed text-haze">
          Every tier is sold out. Booking is closed for this night — the room is capped and we do
          not oversell it.
        </p>
      )}
    </div>
  );
}

export default ScarcityMeter;
