'use client';

import { cn } from '@/lib/utils';

/**
 * Infinite horizontal ticker.
 *
 * The item list is rendered twice and the track translates exactly -50%, so the
 * second copy is pixel-identical to the first at the loop point and the seam is
 * invisible. Duplicating in markup (rather than animating each item) keeps the
 * whole thing on one composited transform.
 */
export function Marquee({
  items,
  speedSeconds = 32,
  reverse = false,
  className,
  separator = '✦',
}: {
  items: readonly string[];
  speedSeconds?: number;
  reverse?: boolean;
  className?: string;
  separator?: string;
}) {
  const sequence = [...items, ...items];

  return (
    <div className={cn('mask-fade-x relative overflow-hidden py-4', className)} aria-hidden>
      <div
        className="flex w-max animate-marquee items-center gap-8 whitespace-nowrap will-change-transform"
        style={{
          animationDuration: `${speedSeconds}s`,
          animationDirection: reverse ? 'reverse' : 'normal',
        }}
      >
        {sequence.map((item, index) => (
          <span key={`${item}-${index}`} className="flex items-center gap-8">
            <span className="font-display text-2xl font-bold uppercase tracking-tight text-chalk/70 sm:text-3xl">
              {item}
            </span>
            <span className="text-lg text-vybe-500">{separator}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
