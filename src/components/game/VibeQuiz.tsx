'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Globe } from '@/components/brand/Globe';
import { cn } from '@/lib/utils';

export type QuizTierCode = 'EARLY' | 'GA' | 'VIP' | 'TABLE';

export interface QuizRoom {
  name: string;
  sound: string;
  copy: string;
  hue: number;
}

interface VibeQuizProps {
  rooms: ReadonlyArray<QuizRoom>;
  onResult?: (tierCode: string) => void;
  /** Event the result links to. Kept a prop so the quiz is reusable per event. */
  eventSlug?: string;
  className?: string;
}

interface Option {
  id: string;
  label: string;
  /** Clause used verbatim to build the one-sentence explanation. */
  clause: string;
  /** Points added to each room slot, in the order rooms are supplied. */
  rooms: readonly [number, number, number];
  tiers: Partial<Record<QuizTierCode, number>>;
}

interface Question {
  id: string;
  prompt: string;
  help: string;
  options: readonly Option[];
}

const TIER_ORDER: readonly QuizTierCode[] = ['EARLY', 'GA', 'VIP', 'TABLE'];

const TIER_NAME: Record<QuizTierCode, string> = {
  EARLY: 'Early bird',
  GA: 'General admission',
  VIP: 'VIP',
  TABLE: 'Table',
};

/**
 * The scoring table, written out rather than computed, so the recommendation is
 * inspectable and the same answers always land on the same room and tier.
 * Room points are positional: slot 0 is the first room supplied, slot 2 the last.
 */
const QUESTIONS: readonly Question[] = [
  {
    id: 'arrival',
    prompt: 'When do you actually arrive?',
    help: 'Not when you plan to. When you turn up.',
    options: [
      {
        id: 'doors',
        label: 'At doors. I like watching a room fill.',
        clause: 'you walk in at doors',
        rooms: [3, 0, 0],
        tiers: { EARLY: 3, GA: 1 },
      },
      {
        id: 'eleven',
        label: 'Around eleven, once it is warm.',
        clause: 'you arrive once the room is warm',
        rooms: [1, 3, 0],
        tiers: { GA: 3, EARLY: 1 },
      },
      {
        id: 'midnight',
        label: 'After midnight. Peak or nothing.',
        clause: 'you turn up for peak hour',
        rooms: [0, 3, 1],
        tiers: { GA: 2, VIP: 2 },
      },
      {
        id: 'late',
        label: 'Late enough to watch the sky change.',
        clause: 'you stay until the sky changes',
        rooms: [0, 0, 3],
        tiers: { VIP: 2, TABLE: 1 },
      },
    ],
  },
  {
    id: 'purpose',
    prompt: 'What are you here for?',
    help: 'One answer. Be honest with yourself.',
    options: [
      {
        id: 'sound',
        label: 'The sound. I will be stood at the booth.',
        clause: 'you came for the rig',
        rooms: [1, 3, 0],
        tiers: { GA: 3 },
      },
      {
        id: 'dance',
        label: 'Dancing until the lights come up.',
        clause: 'you came to dance the whole thing out',
        rooms: [0, 3, 1],
        tiers: { GA: 2, EARLY: 2 },
      },
      {
        id: 'base',
        label: 'A base to come back to between sets.',
        clause: 'you want somewhere to come back to',
        rooms: [1, 0, 1],
        tiers: { TABLE: 3, VIP: 2 },
      },
      {
        id: 'air',
        label: 'Open air and a conversation worth having.',
        clause: 'you came for air and a conversation',
        rooms: [1, 0, 3],
        tiers: { VIP: 3, TABLE: 1 },
      },
    ],
  },
  {
    id: 'crew',
    prompt: 'Who are you coming with?',
    help: 'Group size changes which pass makes sense.',
    options: [
      {
        id: 'solo',
        label: 'On my own. I will find people.',
        clause: 'you are coming alone',
        rooms: [1, 1, 1],
        tiers: { EARLY: 3, GA: 2 },
      },
      {
        id: 'pair',
        label: 'One other person.',
        clause: 'there are two of you',
        rooms: [1, 1, 1],
        tiers: { GA: 3, EARLY: 1 },
      },
      {
        id: 'small',
        label: 'Four or five of us.',
        clause: 'there are a few of you',
        rooms: [0, 2, 1],
        tiers: { VIP: 3, GA: 1 },
      },
      {
        id: 'crew',
        label: 'Eight-plus. It is a whole thing.',
        clause: 'you are bringing the whole crew',
        rooms: [0, 1, 2],
        tiers: { TABLE: 4, VIP: 1 },
      },
    ],
  },
];

/** First index and first tier code win ties, so the outcome never depends on
 *  object key order or on how the browser sorted anything. */
function scoreAnswers(picks: readonly Option[]): { roomIndex: number; tier: QuizTierCode } {
  const roomScores = [0, 0, 0];
  const tierScores: Record<QuizTierCode, number> = { EARLY: 0, GA: 0, VIP: 0, TABLE: 0 };

  for (const pick of picks) {
    pick.rooms.forEach((points, index) => {
      roomScores[index] += points;
    });
    for (const code of TIER_ORDER) tierScores[code] += pick.tiers[code] ?? 0;
  }

  let roomIndex = 0;
  for (let index = 1; index < roomScores.length; index += 1) {
    if (roomScores[index] > roomScores[roomIndex]) roomIndex = index;
  }

  let tier: QuizTierCode = TIER_ORDER[0];
  for (const code of TIER_ORDER) {
    if (tierScores[code] > tierScores[tier]) tier = code;
  }

  return { roomIndex, tier };
}

export function VibeQuiz({ rooms, onResult, eventSlug = 'offcampus', className }: VibeQuizProps) {
  const reduce = useReducedMotion() ?? false;
  const [picks, setPicks] = useState<Option[]>([]);
  const [direction, setDirection] = useState(1);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  const step = picks.length;
  const finished = step === QUESTIONS.length;
  const outcome = finished ? scoreAnswers(picks) : null;
  const room = outcome ? rooms[Math.min(outcome.roomIndex, rooms.length - 1)] : undefined;

  // The parent may pass an inline arrow, so hold the callback in a ref and key
  // the effect on the result alone — otherwise every render would re-fire it.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const resultTier = outcome?.tier ?? null;

  useEffect(() => {
    if (resultTier) onResultRef.current?.(resultTier);
  }, [resultTier]);

  // Move focus to whatever just replaced the card, but never on first paint —
  // stealing focus on page load would yank the viewer down the page.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  function choose(option: Option) {
    setDirection(1);
    setPicks((current) => [...current, option]);
  }

  function back() {
    setDirection(-1);
    setPicks((current) => current.slice(0, -1));
  }

  function restart() {
    setDirection(-1);
    setPicks([]);
  }

  const variants: Variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 44 : -44 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -44 : 44 }),
  };

  const question = finished ? null : QUESTIONS[step];
  const accent = room ? `hsl(${room.hue} 92% 62%)` : 'hsl(214 92% 62%)';

  const body = finished ? (
    <div key="result" className="p-6 sm:p-9">
      <p className="eyebrow" style={{ color: accent }}>
        Your room
      </p>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="mt-3 font-display text-3xl font-extrabold leading-[1.05] tracking-tight text-chalk outline-none sm:text-4xl"
      >
        {room ? room.name : TIER_NAME[outcome!.tier]}
      </h3>

      <p className="lede mt-4">
        {picks[0].clause.charAt(0).toUpperCase() + picks[0].clause.slice(1)}, {picks[1].clause} and{' '}
        {picks[2].clause}
        {room ? ` — so ${room.name}, ${room.sound.toLowerCase()}, is where your night sits.` : '.'}
      </p>

      {room && <p className="mt-3 text-[14px] leading-relaxed text-haze">{room.copy}</p>}

      <div className="mt-7 rounded-xl border border-hairline bg-ink/60 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dim">
          Pass we would pick for you
        </p>
        <p className="mt-1.5 font-display text-xl font-bold text-chalk">
          {TIER_NAME[outcome!.tier]}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dim">
          Prices and exactly what each pass includes are on the booking page. Nothing is reserved
          until you book.
        </p>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link
          href={`/book?event=${eventSlug}&tier=${outcome!.tier}`}
          className="btn-primary"
          prefetch={false}
        >
          Book {TIER_NAME[outcome!.tier].toLowerCase()}
        </Link>
        <button type="button" onClick={restart} className="btn-ghost">
          Start again
        </button>
      </div>
    </div>
  ) : (
    <div key={question!.id} className="p-6 sm:p-9">
      <p className="eyebrow">
        Question {step + 1} of {QUESTIONS.length}
      </p>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="mt-3 font-display text-2xl font-bold leading-[1.15] tracking-tight text-chalk outline-none sm:text-3xl"
      >
        {question!.prompt}
      </h3>
      <p className="mt-2 text-[13px] text-dim">{question!.help}</p>

      <ul className="mt-6 space-y-2.5">
        {question!.options.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              onClick={() => choose(option)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-xl border border-hairline bg-ink/60 px-4 py-3.5 text-left',
                'text-[15px] text-haze transition-all duration-200',
                'hover:-translate-y-0.5 hover:border-vybe-500/60 hover:bg-vybe-500/10 hover:text-chalk',
              )}
            >
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full bg-hairline transition-colors duration-200 group-hover:bg-vybe-400"
              />
              {option.label}
            </button>
          </li>
        ))}
      </ul>

      {step > 0 && (
        <button
          type="button"
          onClick={back}
          className="mt-6 text-[13px] font-medium text-dim underline-offset-4 transition-colors hover:text-chalk hover:underline"
        >
          Back a question
        </button>
      )}
    </div>
  );

  return (
    <section
      className={cn('card card-lit relative isolate overflow-hidden', className)}
      aria-label="Find your night"
    >
      <Globe
        className="pointer-events-none absolute -bottom-24 -left-20 -z-10 h-64 w-64 text-vybe-500/[0.06]"
        strokeWidth={1.6}
      />

      <div className="border-b border-hairline px-6 pb-4 pt-5 sm:px-9">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dim">
            Find your night
          </p>
          <p className="font-mono text-[11px] tracking-wider text-dim">
            {Math.min(step + (finished ? 0 : 1), QUESTIONS.length)}/{QUESTIONS.length}
          </p>
        </div>
        <div
          aria-hidden
          className="mt-3 h-1 w-full overflow-hidden rounded-full bg-ink ring-1 ring-inset ring-hairline"
        >
          <motion.span
            className="block h-full rounded-full bg-gradient-to-r from-vybe-500 to-pulse-400"
            initial={false}
            animate={{ width: `${(step / QUESTIONS.length) * 100}%` }}
            transition={reduce ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {finished
          ? `Result ready. Recommended pass: ${TIER_NAME[outcome!.tier]}.`
          : `Question ${step + 1} of ${QUESTIONS.length}.`}
      </p>

      <div className="min-h-[430px] sm:min-h-[400px]">
        {reduce ? (
          body
        ) : (
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={finished ? 'result' : question!.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              {body}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}

export default VibeQuiz;
