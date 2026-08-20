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
          'flex items-center justify-center gap-3 rounded-[16px] border border-leaf-400 bg-leaf-100 px-6 py-4',
          className,
        )}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping2 rounded-full bg-leaf-400" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-leaf-500" />
        </span>
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
            'flex flex-1 flex-col items-center rounded-[14px] border border-edge bg-paper shadow-low',
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
              'mt-1.5 font-mono uppercase tracking-[0.16em] text-muted',
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
