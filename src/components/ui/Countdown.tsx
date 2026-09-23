'use client';

import { useEffect, useState } from 'react';
import { countdownParts, cn } from '@/lib/utils';

/**
 * Live countdown to doors.
 *
 * The first render deliberately shows placeholders: computing the remaining
 * time on the server and again on the client produces two different values and
 * a hydration mismatch, so the numbers only appear once mounted.
 */
export function Countdown({
  target,
  className,
  compact = false,
}: {
  target: string;
  className?: string;
  compact?: boolean;
}) {
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

  if (isLive) {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-3 rounded-pill bg-leaf-100 px-6 py-4 ring-1 ring-inset ring-leaf-400/40',
          className,
        )}
      >
        <span aria-hidden className="pip" />
        <span className="font-display text-[1.0625rem] font-semibold text-leaf-600">
          Doors are open
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-stretch gap-2 sm:gap-2.5', className)}>
      {units.map((unit) => (
        <div
          key={unit.label}
          className={cn(
            'flex flex-1 flex-col items-center rounded-lg bg-paper shadow-soft ring-1 ring-inset ring-vybe-100',
            compact ? 'px-2 py-2.5' : 'min-w-[68px] px-2 py-3.5 sm:min-w-[82px]',
          )}
        >
          <span
            className={cn(
              'tnum font-display font-bold leading-none text-ink',
              compact ? 'text-lg' : 'text-2xl sm:text-[2rem]',
            )}
            suppressHydrationWarning
          >
            {unit.value === undefined ? '––' : String(unit.value).padStart(2, '0')}
          </span>
          <span
            className={cn(
              'mt-2 font-mono font-semibold uppercase tracking-[0.16em] text-muted',
              compact ? 'text-[0.5625rem]' : 'text-[0.625rem]',
            )}
          >
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}
