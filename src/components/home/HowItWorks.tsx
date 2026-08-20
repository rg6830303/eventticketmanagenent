'use client';

import { motion, useReducedMotion, type MotionProps, type Variants } from 'framer-motion';
import { HOW_IT_WORKS } from '@/content/site';
import { CountUp } from './CountUp';

const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } },
};

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
  const lineMotion: MotionProps = reduce
    ? {}
    : {
        initial: { pathLength: 0 },
        whileInView: { pathLength: 1 },
        viewport: { once: true, amount: 0.4 },
        transition: { duration: 1.7, ease: [0.16, 1, 0.3, 1] },
      };

  return (
    <div className="relative mt-14">
      {/* Draws itself left-to-right as the row arrives. Sits at the vertical
          centre of the numbered discs, which are opaque and mask it. */}
      <svg
        aria-hidden
        viewBox="0 0 100 1"
        preserveAspectRatio="none"
        className="pointer-events-none absolute left-0 top-6 hidden h-px w-full lg:block"
      >
        <defs>
          <linearGradient id="hov-step-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2586ef" stopOpacity="0" />
            <stop offset="18%" stopColor="#2586ef" stopOpacity="0.9" />
            <stop offset="82%" stopColor="#3fcbe0" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#3fcbe0" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d="M0 0.5H100"
          fill="none"
          stroke="url(#hov-step-line)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          {...lineMotion}
        />
      </svg>

      <motion.ol
        data-reveal=""
        className="grid gap-10 sm:grid-cols-3 lg:gap-10"
        {...listMotion}
      >
        {HOW_IT_WORKS.map((step) => (
          <motion.li data-reveal="" key={step.step} className="relative" {...itemMotion}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-vybe-200 bg-paper font-mono text-[0.8125rem] font-medium text-vybe-600 shadow-low">
              <CountUp value={step.step} pad={2} duration={1} />
            </span>
            <h3 className="mt-5 font-display text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">{step.title}</h3>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate">{step.copy}</p>
          </motion.li>
        ))}
      </motion.ol>
    </div>
  );
}
