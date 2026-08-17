'use client';

import { animate, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Splits "<60s" into prefix "<", number 60 and suffix "s". */
const SHAPE = /^(\D*)(\d+)(.*)$/;

/**
 * Counts a value in the first time it scrolls into view.
 *
 * The finished value is what renders on the server, so the number is already
 * correct before hydration and for anyone with motion switched off — the
 * animation only ever replaces a figure that was on screen anyway.
 */
export function CountUp({
  value,
  pad = 0,
  duration = 1.4,
  className,
}: {
  value: string;
  /** Zero-pad the counted figure to this width, so "1" arrives as "01". */
  pad?: number;
  duration?: number;
  className?: string;
}) {
  const match = SHAPE.exec(value);
  const prefix = match?.[1] ?? '';
  const target = match ? Number(match[2]) : 0;
  const suffix = match?.[3] ?? '';
  const countable = match !== null;

  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!countable || !inView || reduce) return;
    const controls = animate(0, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (current) =>
        setDisplay(`${prefix}${String(Math.round(current)).padStart(pad, '0')}${suffix}`),
    });
    return () => controls.stop();
  }, [countable, inView, reduce, target, duration, prefix, suffix, pad]);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {display}
    </span>
  );
}
