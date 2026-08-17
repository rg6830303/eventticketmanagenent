'use client';

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import type { ReactNode } from 'react';
import { Globe } from '@/components/brand/Globe';
import { cn } from '@/lib/utils';

/**
 * Hero backdrop: the brand globe used as an orbiting watermark, drifting against
 * the page scroll.
 *
 * Scroll is read from the window rather than a ref because this only ever sits
 * at the top of a document — a ref-based measurement would cost a layout read
 * for the same numbers.
 */
export function HeroOrbit({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();

  // Spring the raw scroll value so the layers settle a beat behind the page.
  // That lag is the whole effect; a direct binding just looks like slow scroll.
  const smooth = useSpring(scrollY, { stiffness: 80, damping: 26, mass: 0.5 });
  const yFar = useTransform(smooth, [0, 900], [0, -140]);
  const yNear = useTransform(smooth, [0, 900], [0, 110]);
  const scaleFar = useTransform(smooth, [0, 900], [1, 1.16]);
  const fade = useTransform(smooth, [0, 700], [1, 0.3]);

  const shell = cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className);

  const pools = (
    <>
      <div className="absolute left-1/4 top-0 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-vybe-600/25 blur-[130px]" />
      <div className="absolute right-0 top-40 h-[380px] w-[380px] rounded-full bg-pulse-500/15 blur-[120px]" />
      <div className="absolute inset-0 grid-overlay" />
    </>
  );

  if (reduce) {
    return (
      <div aria-hidden className={shell}>
        {pools}
        <div className="absolute -right-28 top-10 h-[440px] w-[440px] sm:h-[620px] sm:w-[620px]">
          <Globe className="h-full w-full text-vybe-500/[0.08]" strokeWidth={1} />
        </div>
      </div>
    );
  }

  return (
    <div aria-hidden className={shell}>
      {pools}

      <motion.div
        style={{ y: yFar, scale: scaleFar, opacity: fade }}
        className="absolute -right-28 top-10 h-[440px] w-[440px] will-change-transform sm:h-[620px] sm:w-[620px]"
      >
        <Globe className="h-full w-full text-vybe-500/[0.09]" strokeWidth={1} spin />

        {/* A second mark revolving around the first — the logo, orbiting itself. */}
        <div className="absolute inset-0 animate-orbit">
          <div className="absolute left-1/2 top-0 -translate-x-1/2">
            <Globe className="h-10 w-10 text-flare/40 sm:h-14 sm:w-14" strokeWidth={4} />
          </div>
        </div>
      </motion.div>

      <motion.div
        style={{ y: yNear, opacity: fade }}
        className="absolute -left-20 bottom-[-90px] h-[260px] w-[260px] will-change-transform sm:h-[340px] sm:w-[340px]"
      >
        <Globe className="h-full w-full text-pulse-400/[0.07]" strokeWidth={1.4} />
      </motion.div>
    </div>
  );
}

/**
 * Lifts a block of hero copy on a slower track than the page.
 *
 * Deliberately translate-only: fading text that is still on screen would hide
 * content behind an ornament.
 */
export function HeroParallax({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 700], [0, 56]);

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div style={{ y }} className={cn('will-change-transform', className)}>
      {children}
    </motion.div>
  );
}
