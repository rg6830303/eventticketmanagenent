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
 * Three steps, ruled off from each other like columns in a programme.
 *
 * The numerals are set enormous and in outline, half-cropped by the top rule,
 * so the sequence is legible from across the room. Vertical rules do the
 * separating — no cards, no discs, no connector line trying to be clever.
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
      className="mt-12 grid border-t-2 border-ink sm:grid-cols-3"
      {...listMotion}
    >
      {HOW_IT_WORKS.map((step, index) => (
        <motion.li
          data-reveal=""
          key={step.step}
          className={cnStep(index)}
          {...itemMotion}
        >
          <span
            aria-hidden
            className="outline-type block font-display text-[4.5rem] font-bold leading-[0.85] tracking-[-0.04em] sm:text-[5.5rem]"
          >
            {step.step}
          </span>
          <h3 className="mt-4 font-display text-[1.3rem] font-semibold tracking-[-0.02em] text-ink">
            {step.title}
          </h3>
          <p className="mt-2 max-w-[36ch] text-[0.9375rem] leading-relaxed text-slate">
            {step.copy}
          </p>
        </motion.li>
      ))}
    </motion.ol>
  );
}

function cnStep(index: number): string {
  return [
    'relative px-0 pt-6 pb-8 sm:px-8 sm:pt-8',
    index > 0 ? 'border-t border-ink/20 sm:border-t-0 sm:border-l' : '',
    index === 0 ? 'sm:pl-0' : '',
  ]
    .filter(Boolean)
    .join(' ');
}
