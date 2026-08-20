'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { EVENT } from '@/content/site';
import { ACTIVITY_ICONS } from './ActivityIcons';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The activity list, set like a tracklist.
 *
 * Six ruled rows: index, title big, note, icon at the margin. On hover the
 * row floods vybe-500 and the type inverts — the fill wipes in from the left
 * so it reads as a highlighter pass, not a state change.
 *
 * This used to be a 3×2 grid of icon-in-rounded-square cards, which is the
 * single most template-coded arrangement on the modern web. A list can hold
 * a hierarchy a grid can't: the title carries the row, the icon is a margin
 * note, and the whole block reads top to bottom like a bill of fare.
 */
export function ActivityGrid() {
  const reduce = useReducedMotion();

  return (
    <ol className="border-t-2 border-ink">
      {EVENT.activities.map((activity, index) => {
        const Icon = ACTIVITY_ICONS[activity.icon] ?? ACTIVITY_ICONS.gift;
        return (
          <motion.li
            data-reveal=""
            key={activity.title}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: index * 0.05, ease: EASE }}
            className="group relative overflow-hidden border-b border-ink/20"
          >
            {/* The flood. Scaled, not translated: a transform on X leaves a
                subpixel seam at the trailing edge on some DPRs. */}
            <span
              aria-hidden
              className="absolute inset-0 origin-left scale-x-0 bg-vybe-500 transition-transform duration-300 ease-out group-hover:scale-x-100"
            />
            <div className="relative flex items-baseline gap-4 py-5 sm:gap-8 sm:py-6">
              <span className="w-8 shrink-0 font-mono text-[0.8125rem] text-vybe-600 transition-colors duration-200 group-hover:text-white/70 sm:w-12">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-8">
                <h3 className="font-display text-[1.35rem] font-semibold tracking-[-0.02em] text-ink transition-colors duration-200 group-hover:text-white sm:w-[38%] sm:shrink-0 sm:text-[1.6rem]">
                  {activity.title}
                </h3>
                <p className="mt-1 text-[0.9375rem] leading-relaxed text-slate transition-colors duration-200 group-hover:text-white/85 sm:mt-0">
                  {activity.note}
                </p>
              </div>
              <span className="hidden shrink-0 self-center text-vybe-600 transition-colors duration-200 group-hover:text-white sm:block">
                <Icon className="h-6 w-6" />
              </span>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
