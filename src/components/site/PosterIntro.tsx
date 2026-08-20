'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { EVENT } from '@/content/site';

/**
 * The poster, staged as the way into the site.
 *
 * It draws the chain heart, sets the wordmark, drops the cherries and then
 * lifts off the page. The whole thing is 2.4 seconds and it earns that time by
 * being the event's actual artwork rather than a spinner — but an intro that
 * cannot be escaped is a tax on every visit, so:
 *
 *   · it plays once per browser session, not once per page view
 *   · any click, tap or key press skips straight to the exit
 *   · `prefers-reduced-motion` removes it entirely
 *   · scroll is locked only while it is on screen
 *
 * The no-flash trick is in the inline script in `layout.tsx`: it sets a flag on
 * <html> synchronously, before first paint, so a returning visitor never sees a
 * frame of the overlay. This component reads the same flag on mount.
 */

export const INTRO_SESSION_KEY = 'hov:intro-seen';

const HEART_PATH =
  'M100 178C58 146 12 112 12 66 12 36 34 16 60 16c16 0 30 8 40 22 10-14 24-22 40-22 26 0 48 20 48 50 0 46-46 80-88 112z';

const EASE = [0.16, 1, 0.3, 1] as const;

export function PosterIntro() {
  const reduce = useReducedMotion();
  // Starts true so the server-rendered overlay is opaque; the flag check on
  // mount is what dismisses it for a returning visitor.
  const [playing, setPlaying] = useState(true);
  const [exiting, setExiting] = useState(false);

  const finish = useCallback(() => {
    setExiting(true);
    try {
      sessionStorage.setItem(INTRO_SESSION_KEY, '1');
    } catch {
      /* Private mode denies storage. The intro simply plays again — harmless. */
    }
    // Matches the exit transition below; unmounting earlier would cut it off.
    window.setTimeout(() => setPlaying(false), 720);
  }, []);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(INTRO_SESSION_KEY) === '1';
    } catch {
      seen = false;
    }

    if (seen || reduce) {
      setPlaying(false);
      document.documentElement.removeAttribute('data-intro');
      return;
    }

    document.documentElement.setAttribute('data-intro', 'playing');
    document.body.classList.add('scroll-locked');

    const timer = window.setTimeout(finish, 2400);
    const skip = () => finish();

    window.addEventListener('pointerdown', skip, { once: true });
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('wheel', skip, { once: true, passive: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('wheel', skip);
    };
  }, [finish, reduce]);

  // Whatever ends the intro — the timer, a skip, or an unmount mid-flight —
  // the page has to be scrollable again afterwards.
  useEffect(() => {
    if (playing) return;
    document.body.classList.remove('scroll-locked');
    document.documentElement.removeAttribute('data-intro');
  }, [playing]);

  useEffect(
    () => () => {
      document.body.classList.remove('scroll-locked');
      document.documentElement.removeAttribute('data-intro');
    },
    [],
  );

  return (
    <AnimatePresence>
      {playing && (
        <motion.div
          id="poster-intro"
          key="intro"
          className="fixed inset-0 z-[999] flex items-center justify-center overflow-hidden bg-[#0a1730]"
          initial={{ opacity: 1 }}
          animate={exiting ? { opacity: 0 } : { opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
          aria-hidden
        >
          {/* Poster ground: grid, halftone wash and a violet bloom, matching the
              printed artwork rather than the site it is about to reveal. */}
          <span
            className="absolute inset-0 opacity-[0.28]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(160,190,255,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(160,190,255,0.35) 1px, transparent 1px)',
              backgroundSize: '46px 46px',
            }}
          />
          <div className="absolute inset-0 grid place-items-center">
            <motion.span
              className="h-[85vmin] w-[85vmin] rounded-full"
              style={{
                background:
                  'radial-gradient(circle, rgba(139,92,240,0.55), rgba(139,92,240,0) 62%)',
                filter: 'blur(60px)',
              }}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.6, ease: EASE }}
            />
          </div>

          {/* The poster itself, scaled to the shorter viewport axis so it is
              composed identically on a phone and on a desktop. */}
          <motion.div
            className="relative h-[68vmin] w-[68vmin] -translate-y-[3vh]"
            initial={{ scale: 0.94 }}
            animate={exiting ? { scale: 1.14, y: '-6%' } : { scale: 1 }}
            transition={{ duration: exiting ? 0.7 : 1.9, ease: EASE }}
          >
            <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
              <defs>
                <linearGradient id="intro-heart" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#c9b0ff" />
                  <stop offset="100%" stopColor="#7fb4ff" />
                </linearGradient>
                <radialGradient id="intro-fill" cx="50%" cy="45%">
                  <stop offset="0%" stopColor="#8b5cf0" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#4a2a9e" stopOpacity="0.35" />
                </radialGradient>
              </defs>

              {/* Fill arrives behind the stroke, so the outline always reads as
                  drawn onto something rather than appearing with it. */}
              <motion.path
                d={HEART_PATH}
                fill="url(#intro-fill)"
                transform="translate(0 6)"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ transformOrigin: '100px 100px' }}
                transition={{ duration: 0.9, delay: 0.55, ease: EASE }}
              />
              <motion.path
                d={HEART_PATH}
                fill="none"
                stroke="url(#intro-heart)"
                strokeWidth={9}
                strokeLinejoin="round"
                strokeLinecap="round"
                transform="translate(0 6)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.15, delay: 0.15, ease: [0.4, 0, 0.2, 1] }}
              />
              {/* The chain, as a dashed overlay on the same path. Drawing forty
                  individual links would cost far more than it reads as. */}
              <motion.path
                d={HEART_PATH}
                fill="none"
                stroke="#ffffff"
                strokeWidth={3.2}
                strokeDasharray="7 13"
                strokeLinecap="round"
                transform="translate(0 6)"
                initial={{ strokeDashoffset: 360, opacity: 0 }}
                animate={{ strokeDashoffset: 0, opacity: 0.9 }}
                transition={{ duration: 1.5, delay: 0.45, ease: [0.4, 0, 0.2, 1] }}
              />
            </svg>

            {/* Wordmark, centred in the heart. */}
            <div className="absolute inset-x-0 top-[36%] text-center">
              <div className="overflow-hidden">
                <motion.p
                  className="font-display text-[7.5vmin] font-bold uppercase leading-none tracking-[0.1em] text-white"
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.7, delay: 0.85, ease: EASE }}
                >
                  OFF
                </motion.p>
              </div>
              <motion.p
                className="accent mt-1 text-[13vmin] leading-[0.9] text-white"
                initial={{ clipPath: 'inset(0 100% 0 0)' }}
                animate={{ clipPath: 'inset(0 0% 0 0)' }}
                transition={{ duration: 0.85, delay: 1.05, ease: EASE }}
              >
                Campus
              </motion.p>
            </div>

            {/* Cherries, dropped in on a spring. */}
            <motion.svg
              viewBox="0 0 120 110"
              className="absolute -bottom-[4%] right-[2%] w-[40%]"
              initial={{ y: '-40%', opacity: 0, rotate: -14 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 160, damping: 12, delay: 1.35 }}
            >
              <path
                d="M40 82C40 60 46 34 62 12M74 84C74 62 78 40 66 14"
                fill="none"
                stroke="#f0eadb"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <circle cx="34" cy="88" r="18" fill="#e1303c" />
              <circle cx="28" cy="82" r="5" fill="#f88b93" opacity="0.85" />
              <circle cx="80" cy="92" r="15" fill="#bd1b26" />
              <circle cx="75" cy="87" r="4" fill="#f88b93" opacity="0.75" />
            </motion.svg>
          </motion.div>

          {/* The detail line. Last in, because it is the part somebody would
              actually screenshot. */}
          <motion.div
            className="absolute inset-x-0 bottom-[11vh] px-6 text-center"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.6, ease: EASE }}
          >
            <p className="font-mono text-[clamp(0.625rem,1.6vw,0.8125rem)] uppercase tracking-[0.32em] text-[#bcdcff]">
              {EVENT.edition} · {EVENT.venue.name} · {EVENT.dateShort}
            </p>
          </motion.div>

          {/* Runs for the exact life of the intro, so the wait reads as a
              sequence with an end rather than as a stall. */}
          <motion.span
            className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-gradient-to-r from-orchid-400 via-vybe-300 to-pulse-300"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 2.4, ease: 'linear' }}
          />

          <p className="absolute bottom-[3.5vh] inset-x-0 text-center font-mono text-[0.625rem] uppercase tracking-[0.28em] text-white/35">
            Tap to skip
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
