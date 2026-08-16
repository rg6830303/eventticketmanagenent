'use client';

import { useEffect, useState } from 'react';
import { countdownParts } from '@/lib/utils';
import { cn } from '@/lib/utils';

/**
 * Live countdown to doors.
 *
 * The first render deliberately shows nothing but the layout: computing the
 * remaining time on the server and again on the client would produce two
 * different values and a hydration mismatch, so the numbers only appear once
 * mounted.
 */
export function Countdown({ target, className }: { target: string; className?: string }) {
  const [parts, setParts] = useState<ReturnType<typeof countdownParts> | null>(null);

  useEffect(() => {
    setParts(countdownParts(target));
    const id = setInterval(() => setParts(countdownParts(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const units = [
    { label: 'Days', value: parts?.days },
    { label: 'Hours', value: parts?.hours },
    { label: 'Mins', value: parts?.minutes },
    { label: 'Secs', value: parts?.seconds },
  ];

  const isLive = parts !== null && parts.total === 0;

  return (
    <div className={cn('flex items-stretch gap-2 sm:gap-3', className)}>
      {isLive ? (
        <div className="card card-lit flex w-full items-center justify-center gap-3 px-6 py-5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pulse-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pulse-400" />
          </span>
          <span className="font-display text-lg font-bold uppercase tracking-wide text-chalk">
            Doors are open
          </span>
        </div>
      ) : (
        units.map((unit) => (
          <div
            key={unit.label}
            className="card card-lit flex min-w-[68px] flex-1 flex-col items-center px-2 py-3.5 sm:min-w-[84px] sm:py-4"
          >
            <span
              className="font-display text-2xl font-bold tabular-nums text-chalk sm:text-4xl"
              suppressHydrationWarning
            >
              {unit.value === undefined ? '––' : String(unit.value).padStart(2, '0')}
            </span>
            <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
              {unit.label}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
