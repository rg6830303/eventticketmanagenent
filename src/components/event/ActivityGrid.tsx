'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { EVENT } from '@/content/site';
import { ACTIVITY_ICONS } from './ActivityIcons';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The activity list, set like a tracklist.
 *
 * Six rows: index, title big, note, icon at the margin. A list can hold a
 * hierarchy a grid can't — the title carries the row, the icon is a margin
 * note, and the whole block reads top to bottom like a bill of fare.
 *
 * Hover raises the row onto its own plate and tints it, rather than flooding
 * it with saturated azure and inverting the type. The flood was louder than
 * the primary button sitting two sections below it, which is backwards: azure
 * at full strength belongs to the thing you press.
 */
export function ActivityGrid() {
  const reduce = useReducedMotion();

  return (
    <ol className="-mx-3 divide-y divide-ink/[0.07]">
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
            className="group relative"
          >
            {/* The plate the row rises onto. Scaled from nothing would clip the
                rounded corners mid-transition, so it fades and the row lifts. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-xl bg-paper opacity-0 shadow-raise transition-opacity duration-300 ease-out group-hover:opacity-100"
            />
            <div className="relative flex items-baseline gap-4 px-3 py-5 transition-transform duration-300 ease-out group-hover:-translate-y-[2px] sm:gap-8 sm:px-6 sm:py-6">
              <span className="w-8 shrink-0 font-mono text-[0.8125rem] font-semibold text-vybe-600 sm:w-12">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-8">
                <h3 className="font-display text-[1.3rem] font-semibold tracking-[-0.02em] text-ink transition-colors duration-200 group-hover:text-vybe-700 sm:w-[38%] sm:shrink-0 sm:text-[1.5rem]">
                  {activity.title}
                </h3>
                <p className="mt-1 text-[0.9375rem] leading-relaxed text-slate sm:mt-0">
                  {activity.note}
                </p>
              </div>
              <span className="hidden shrink-0 self-center rounded-pill bg-vybe-50 p-2.5 text-vybe-600 transition-colors duration-300 group-hover:bg-vybe-100 sm:block">
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
