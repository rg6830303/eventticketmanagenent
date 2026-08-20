'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { EVENT } from '@/content/site';

/**
 * The five hours, in order.
 *
 * The rail down the left fills as the section scrolls, so the reader's position
 * in the page and their position in the afternoon are the same thing. The fill
 * is scroll-linked rather than a looping animation: it means something.
 */
export function Runsheet() {
  const ref = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 75%', 'end 55%'],
  });
  const fill = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <ol ref={ref} className="relative ml-1 space-y-8 border-l border-edge pl-8 sm:pl-10">
      {!reduce && (
        <motion.span
          aria-hidden
          style={{ height: fill }}
          className="absolute -left-px top-0 w-[2px] rounded-full bg-vybe-500"
        />
      )}

      {EVENT.runsheet.map((slot, index) => (
        <motion.li
          data-reveal=""
          key={slot.time}
          initial={reduce ? false : { opacity: 0, x: -14 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-70px' }}
          transition={{ duration: 0.5, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <span
            aria-hidden
            className="absolute -left-[38px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-vybe-500 bg-canvas sm:-left-[46px]"
          />
          <p className="tnum font-mono text-[0.8125rem] font-medium text-vybe-600">{slot.time}</p>
          <h3 className="mt-1 font-display text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
            {slot.title}
          </h3>
          <p className="mt-1 text-[0.9375rem] leading-relaxed text-slate">{slot.copy}</p>
        </motion.li>
      ))}
    </ol>
  );
}
