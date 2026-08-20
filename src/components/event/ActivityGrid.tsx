'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { EVENT } from '@/content/site';
import { ACTIVITY_ICONS } from './ActivityIcons';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The activity list off the poster.
 *
 * Six cards on a 3-up grid with a staggered entrance. The hover state lifts the
 * card and swings the icon a few degrees — small enough that a mouse crossing
 * the grid does not set off a wave of animation, which is what kills this
 * pattern when the movement is any larger.
 */
export function ActivityGrid() {
  const reduce = useReducedMotion();

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {EVENT.activities.map((activity, index) => {
        const Icon = ACTIVITY_ICONS[activity.icon] ?? ACTIVITY_ICONS.gift;
        return (
          <motion.li
            data-reveal=""
            key={activity.title}
            initial={reduce ? false : { opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, delay: index * 0.06, ease: EASE }}
          >
            <motion.div
              whileHover={reduce ? undefined : { y: -5 }}
              transition={{ type: 'spring', stiffness: 360, damping: 26 }}
              className="group h-full rounded-[18px] border border-edge bg-frost p-6 transition-[background-color,border-color,box-shadow] duration-300 hover:border-vybe-300 hover:bg-white hover:shadow-mid"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-vybe-200 bg-white text-vybe-600 shadow-low transition-colors duration-300 group-hover:border-vybe-500 group-hover:bg-vybe-500 group-hover:text-white">
                <Icon className="h-6 w-6 transition-transform duration-300 group-hover:-rotate-6" />
              </span>
              <h3 className="mt-5 font-display text-[1.125rem] font-semibold tracking-[-0.02em] text-ink">
                {activity.title}
              </h3>
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-slate">{activity.note}</p>
            </motion.div>
          </motion.li>
        );
      })}
    </ul>
  );
}
