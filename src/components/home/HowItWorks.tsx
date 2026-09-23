'use client';

import { motion, useReducedMotion, type MotionProps, type Variants } from 'framer-motion';
import { HOW_IT_WORKS } from '@/content/site';

const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

/**
 * Three steps, on three plates, joined by a line that runs behind them.
 *
 * The line is the point: it says these are one sequence rather than three
 * unrelated features, which a row of equal cards never manages on its own. The
 * numeral sits on the line in a filled azure disc, so the reading order is
 * unambiguous even when the cards wrap to one column on a phone — where the
 * line turns vertical and keeps doing the same job.
 */
export function HowItWorks() {
  const reduce = useReducedMotion();

  const listMotion: MotionProps = reduce
    ? {}
    : {
        variants: list,
        initial: 'hidden',
        whileInView: 'show',
        viewport: { once: true, amount: 0.25 },
      };
  const itemMotion: MotionProps = reduce ? {} : { variants: item };

  return (
    <motion.ol
      data-reveal=""
      className="relative mt-12 grid gap-6 sm:grid-cols-3 sm:gap-5"
      {...listMotion}
    >
      {/* The thread. Horizontal across the row of discs on desktop, vertical
          down their left edge once the cards stack. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-[27px] top-12 bottom-12 w-[2px] rounded-pill bg-gradient-to-b from-vybe-200 via-vybe-300 to-orchid-200 sm:inset-x-[16%] sm:bottom-auto sm:left-auto sm:top-[46px] sm:h-[2px] sm:w-auto sm:bg-gradient-to-r"
      />

      {HOW_IT_WORKS.map((step, index) => (
        <motion.li data-reveal="" key={step.step} className="relative" {...itemMotion}>
          <div className="card-lift h-full p-6 pt-5 sm:p-7 sm:pt-6">
            <span
              aria-hidden
              className="tnum inline-flex h-11 w-11 items-center justify-center rounded-pill bg-aurora font-display text-[1.0625rem] font-bold text-white shadow-glow"
            >
              {index + 1}
            </span>
            <h3 className="mt-5 font-display text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
              {step.title}
            </h3>
            <p className="mt-2 max-w-[36ch] text-[0.9375rem] leading-relaxed text-slate">
              {step.copy}
            </p>
          </div>
        </motion.li>
      ))}
    </motion.ol>
  );
}
