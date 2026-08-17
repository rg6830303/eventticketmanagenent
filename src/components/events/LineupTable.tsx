'use client';

import { motion, useReducedMotion } from 'framer-motion';

export interface LineupAct {
  /** Null until the booking is signed. Never substitute a placeholder name. */
  name: string | null;
  slot: string;
  room: string;
  tag: string;
}

/**
 * The unannounced state is the common state on this page, so it is designed
 * rather than tolerated: a dashed plaque that reads as a reserved slot, not as
 * a row that failed to load.
 */
function ActName({ name, headline }: { name: string | null; headline: boolean }) {
  if (name) {
    return (
      <p
        className={
          headline
            ? 'font-display text-3xl font-extrabold leading-tight text-chalk sm:text-5xl'
            : 'font-display text-xl font-semibold leading-tight text-chalk sm:text-2xl'
        }
      >
        {name}
      </p>
    );
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-3 rounded-xl border border-dashed border-vybe-500/30',
        'bg-vybe-500/[0.04] px-4',
        headline ? 'py-3.5' : 'py-2.5',
      ].join(' ')}
    >
      <span
        className={
          headline
            ? 'font-display text-2xl font-extrabold tracking-tight text-haze sm:text-4xl'
            : 'font-display text-lg font-semibold tracking-tight text-haze sm:text-xl'
        }
      >
        To be announced
      </span>
      <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-pulse-500/30 bg-pulse-500/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-pulse-300 sm:inline-flex">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pulse-400 opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-pulse-400" />
        </span>
        Announcing soon
      </span>
    </span>
  );
}

function Row({ act }: { act: LineupAct }) {
  const headline = act.tag === 'Headline';

  return (
    <div
      className={[
        'relative grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-2 sm:grid-cols-[132px_1fr_auto]',
        headline ? 'py-8 sm:py-10' : 'py-6',
      ].join(' ')}
    >
      {headline && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-5 -right-5 rounded-2xl bg-gradient-to-r from-vybe-500/[0.09] via-vybe-500/[0.03] to-transparent"
        />
      )}

      <p className="relative font-mono text-[12px] tabular-nums text-dim">{act.slot}</p>

      <div className="relative min-w-0">
        <ActName name={act.name} headline={headline} />
        <p className="mt-2 text-[12px] text-haze">{act.room}</p>
      </div>

      <span
        className={[
          'badge relative col-start-2 justify-self-start sm:col-start-3 sm:justify-self-end',
          headline ? 'border-vybe-400/50 bg-vybe-500/15 text-vybe-100' : '',
        ].join(' ')}
      >
        {act.tag}
      </span>
    </div>
  );
}

export function LineupTable({ acts }: { acts: readonly LineupAct[] }) {
  const reduce = useReducedMotion();

  return (
    <ol className="mt-12 list-none divide-y divide-hairline border-y border-hairline">
      {acts.map((act, index) => (
        <li key={`${act.slot}-${act.room}`}>
          {reduce ? (
            <Row act={act} />
          ) : (
            <motion.div
              initial={{ opacity: 0, x: -18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.6, delay: index * 0.09, ease: [0.16, 1, 0.3, 1] }}
            >
              <Row act={act} />
            </motion.div>
          )}
        </li>
      ))}
    </ol>
  );
}
