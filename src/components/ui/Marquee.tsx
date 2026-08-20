'use client';

import { cn } from '@/lib/utils';

/**
 * Infinite horizontal ticker.
 *
 * The list is rendered twice and the track translates exactly -50%, so the
 * second copy is pixel-identical to the first at the loop point and the seam is
 * invisible. Duplicating in markup rather than animating each item keeps the
 * whole thing on one composited transform.
 */
export function Marquee({
  items,
  speedSeconds = 38,
  reverse = false,
  className,
  separator = '✳',
}: {
  items: readonly string[];
  speedSeconds?: number;
  reverse?: boolean;
  className?: string;
  separator?: string;
}) {
  const sequence = [...items, ...items];

  return (
    <div className={cn('mask-fade-x relative overflow-hidden py-3.5', className)} aria-hidden>
      <div
        className="flex w-max animate-marquee items-center gap-7 whitespace-nowrap will-change-transform"
        style={{
          animationDuration: `${speedSeconds}s`,
          animationDirection: reverse ? 'reverse' : 'normal',
        }}
      >
        {sequence.map((item, index) => (
          <span key={`${item}-${index}`} className="flex items-center gap-7">
            <span className="font-display text-[1.25rem] font-semibold uppercase tracking-[-0.02em] text-white sm:text-[1.5rem]">
              {item}
            </span>
            <span className="text-[0.9375rem] text-white/60">{separator}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
