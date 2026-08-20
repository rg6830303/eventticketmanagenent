'use client';

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/utils';
import { EVENT } from '@/content/site';

const SPRING = { stiffness: 150, damping: 20, mass: 0.6 };
const MAX_TILT = 11;

/**
 * The event artwork, rebuilt as a live object.
 *
 * The card tilts toward the pointer and the layers inside it sit at different
 * depths, so the heart, the cherries and the type separate as it moves. The
 * separation is what sells it as an object rather than as a picture of one —
 * a single flat plane tilting reads as a gimmick.
 *
 * Everything is drawn: no bitmap, nothing to license, and it stays sharp on
 * any display. Under reduced motion it renders as a still card, which is
 * exactly as informative.
 */
export function PosterCard({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-MAX_TILT, MAX_TILT]), SPRING);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [MAX_TILT, -MAX_TILT]), SPRING);

  // Layer offsets. Each layer moves by a different fraction of the pointer
  // travel, which is cheaper and steadier than translateZ on six children.
  const heartX = useSpring(useTransform(px, [-0.5, 0.5], [-18, 18]), SPRING);
  const heartY = useSpring(useTransform(py, [-0.5, 0.5], [-12, 12]), SPRING);
  const cherryX = useSpring(useTransform(px, [-0.5, 0.5], [-30, 30]), SPRING);
  const cherryY = useSpring(useTransform(py, [-0.5, 0.5], [-20, 20]), SPRING);
  const typeX = useSpring(useTransform(px, [-0.5, 0.5], [-8, 8]), SPRING);

  function handleMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    px.set((event.clientX - rect.left) / rect.width - 0.5);
    py.set((event.clientY - rect.top) / rect.height - 0.5);
  }

  function reset() {
    px.set(0);
    py.set(0);
  }

  return (
    <div className={cn('perspective w-full max-w-[440px]', className)}>
      <motion.div
        ref={ref}
        onPointerMove={handleMove}
        onPointerLeave={reset}
        style={reduce ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative aspect-[4/5] w-full overflow-hidden rounded-[28px] border border-edge bg-gradient-to-br from-vybe-50 via-paper to-frost shadow-high"
      >
        {/* Halftone field, straight off the artwork. */}
        <span aria-hidden className="absolute inset-0 dotfield opacity-70" />

        {/* Heart. Two stacked strokes give it the chain-link weight without
            drawing forty individual links. */}
        <motion.svg
          aria-hidden
          viewBox="0 0 200 190"
          style={reduce ? undefined : { x: heartX, y: heartY }}
          className="absolute left-[15%] top-[9%] w-[70%]"
        >
          <defs>
            <linearGradient id="poster-heart" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8ac3ff" />
              <stop offset="100%" stopColor="#2586ef" />
            </linearGradient>
          </defs>
          <path
            d="M100 178C58 146 12 112 12 66 12 36 34 16 60 16c16 0 30 8 40 22 10-14 24-22 40-22 26 0 48 20 48 50 0 46-46 80-88 112z"
            fill="url(#poster-heart)"
            opacity="0.16"
          />
          <path
            d="M100 178C58 146 12 112 12 66 12 36 34 16 60 16c16 0 30 8 40 22 10-14 24-22 40-22 26 0 48 20 48 50 0 46-46 80-88 112z"
            fill="none"
            stroke="url(#poster-heart)"
            strokeWidth="9"
            strokeLinejoin="round"
          />
          <path
            d="M100 178C58 146 12 112 12 66 12 36 34 16 60 16c16 0 30 8 40 22 10-14 24-22 40-22 26 0 48 20 48 50 0 46-46 80-88 112z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeDasharray="9 11"
            strokeLinecap="round"
          />
        </motion.svg>

        {/* Wordmark, centred inside the heart. */}
        <motion.div
          style={reduce ? undefined : { x: typeX }}
          className="absolute inset-x-0 top-[28%] text-center"
        >
          <p className="font-display text-[clamp(1.25rem,4.5vw,1.75rem)] font-bold uppercase leading-none tracking-[0.06em] text-ink">
            OFF
          </p>
          <p className="accent mt-0.5 text-[clamp(2rem,7vw,2.75rem)] leading-[0.95] text-vybe-600">
            Campus
          </p>
        </motion.div>

        {/* Cherries — the one warm note in an otherwise blue frame. */}
        <motion.svg
          aria-hidden
          viewBox="0 0 120 110"
          style={reduce ? undefined : { x: cherryX, y: cherryY }}
          className="absolute bottom-[20%] right-[7%] w-[36%]"
        >
          <path
            d="M40 82C40 60 46 34 62 12M74 84C74 62 78 40 66 14"
            fill="none"
            stroke="#bd1b26"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="34" cy="88" r="18" fill="#e1303c" />
          <circle cx="28" cy="82" r="5" fill="#f88b93" opacity="0.8" />
          <circle cx="80" cy="92" r="15" fill="#bd1b26" />
          <circle cx="75" cy="87" r="4" fill="#f88b93" opacity="0.7" />
        </motion.svg>

        {/* Foot of the card: the details that actually sell the ticket. */}
        <div className="absolute inset-x-0 bottom-0 border-t border-edge bg-paper/85 px-6 py-5 backdrop-blur-sm">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-vybe-600">
            {EVENT.edition}
          </p>
          <p className="mt-1.5 font-display text-[1.0625rem] font-semibold leading-snug tracking-[-0.02em] text-ink">
            {EVENT.venue.name}, {EVENT.venue.area}
          </p>
          <p className="tnum mt-0.5 text-[0.875rem] text-slate">
            {EVENT.dateShort} · {EVENT.timeLabel}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
