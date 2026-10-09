'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

/**
 * Opening film: a diya lights, Maa Durga's trishul and lotus rise behind it,
 * Krishna's flute and peacock feather cross over, and a ring of garba dancers
 * turns around the flame in 3D before the sticks strike and the site opens.
 *
 * Lives in the (site) layout, which stays mounted across client navigation,
 * so it plays on a fresh load or refresh and never between pages.
 *
 * The whole timeline is CSS. It starts painting from the server HTML before
 * any JavaScript arrives, and the overlay fades itself out at the end even if
 * hydration never happens (in-app browsers). JS only adds skip-on-tap and
 * removes the node afterwards.
 */

const DURATION = 4600;

function Dancer({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 60 120" className="h-full w-full" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      {/* sticks */}
      <path d="M18 34 L4 6 M42 34 L56 8" stroke="#f7c948" strokeWidth="3" strokeLinecap="round" />
      {/* arms */}
      <path d="M30 40 L18 34 M30 40 L42 34" stroke="#ffd9a8" strokeWidth="3.4" strokeLinecap="round" />
      {/* head + bun */}
      <circle cx="30" cy="26" r="7" fill="#ffd9a8" />
      <circle cx="34" cy="20" r="4" fill="#2a0a14" />
      {/* dupatta */}
      <path d="M24 36 Q14 52 20 66" stroke="#f570b0" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* choli */}
      <path d="M24 36 h12 l2 14 h-16z" fill="#de2878" />
      {/* lehenga, flared, with mirror hem */}
      <path d="M22 50 h16 l18 50 Q30 108 4 100z" fill="url(#lehenga)" />
      <path d="M4 100 Q30 108 56 100" stroke="#f7c948" strokeWidth="2.4" fill="none" />
      {[10, 18, 26, 34, 42, 50].map((x) => (
        <circle key={x} cx={x} cy={101 + (x === 26 || x === 34 ? 2.5 : 1)} r="1.6" fill="#e6f5ff" />
      ))}
      {/* feet */}
      <path d="M24 104 l-2 10 M36 104 l2 10" stroke="#ffd9a8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function IntroFilm() {
  const [gone, setGone] = useState(false);
  const [skipping, setSkipping] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setGone(true);
      return;
    }
    const t = window.setTimeout(() => setGone(true), DURATION + 200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!skipping) return;
    const t = window.setTimeout(() => setGone(true), 450);
    return () => window.clearTimeout(t);
  }, [skipping]);

  if (gone) return null;

  const dancers = 8;

  return (
    <div
      id="intro-film"
      className={`intro${skipping ? ' intro--skip' : ''}`}
      aria-hidden
      onPointerDown={() => setSkipping(true)}
    >
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="lehenga" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#f7a826" />
            <stop offset="0.55" stopColor="#de2878" />
            <stop offset="1" stopColor="#7a1240" />
          </linearGradient>
          <radialGradient id="flame" cx="0.5" cy="0.7" r="0.6">
            <stop offset="0" stopColor="#fffbe6" />
            <stop offset="0.4" stopColor="#ffd27a" />
            <stop offset="1" stopColor="#f26b1d" />
          </radialGradient>
        </defs>
      </svg>

      <span className="intro__burst" />

      <div className="intro__stage">
        {/* Maa Durga: trishul rising from a lotus */}
        <svg viewBox="0 0 100 200" className="intro__trishul">
          <g fill="none" stroke="#f7c948" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M50 190 V40" />
            <path d="M50 10 L44 34 L50 40 L56 34 Z" fill="#f7c948" />
            <path d="M20 22 Q18 62 50 66 Q82 62 80 22" />
            <path d="M20 22 l-6 10 M80 22 l6 10" />
            <circle cx="50" cy="80" r="7" />
          </g>
          <path d="M50 74 c-3 3 -3 9 0 12 c3 -3 3 -9 0 -12z" fill="#de2878" />
        </svg>

        {/* Krishna: flute and peacock feather, crossing */}
        <svg viewBox="0 0 200 40" className="intro__flute">
          <rect x="4" y="15" width="192" height="10" rx="5" fill="#b8742a" />
          <rect x="4" y="15" width="192" height="4" rx="2" fill="#e0a456" />
          {[40, 62, 84, 106, 128, 150].map((x) => (
            <circle key={x} cx={x} cy="20" r="2.4" fill="#4a2208" />
          ))}
          <path d="M22 15 v10 M178 15 v10" stroke="#f7c948" strokeWidth="3" />
        </svg>
        <svg viewBox="0 0 60 200" className="intro__feather">
          <path d="M30 196 Q28 120 30 40" stroke="#c9b26a" strokeWidth="2" fill="none" />
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} d={`M30 ${60 + i * 9} q${i % 2 ? 22 : -22} -8 ${i % 2 ? 26 : -26} -26`} stroke="#2ec8be" strokeWidth="1.2" fill="none" opacity="0.8" />
          ))}
          <ellipse cx="30" cy="42" rx="20" ry="30" fill="#0d6b68" />
          <ellipse cx="30" cy="46" rx="13" ry="20" fill="#2ec8be" />
          <ellipse cx="30" cy="50" rx="8" ry="12" fill="#f7c948" />
          <ellipse cx="30" cy="52" rx="5" ry="7" fill="#1b2a8a" />
        </svg>

        {/* Ring of dancers turning around the flame */}
        <div className="intro__ring">
          {Array.from({ length: dancers }, (_, i) => (
            <div
              key={i}
              className="intro__dancer"
              style={
                {
                  '--a': `${(360 / dancers) * i}deg`,
                  '--d': `${0.75 + i * 0.07}s`,
                  '--bob': `${(i % 4) * -0.18}s`,
                } as CSSProperties
              }
            >
              <Dancer flip={i % 2 === 1} />
            </div>
          ))}
        </div>

        {/* Diya */}
        <svg viewBox="0 0 100 80" className="intro__diya">
          <path className="intro__flame" d="M50 6 C60 22 62 32 50 42 C38 32 40 22 50 6Z" fill="url(#flame)" />
          <path d="M10 46 Q50 86 90 46 Q50 56 10 46Z" fill="#c4541b" />
          <path d="M10 46 Q50 56 90 46" stroke="#f7c948" strokeWidth="2.5" fill="none" />
          {[24, 38, 50, 62, 76].map((x) => (
            <circle key={x} cx={x} cy={58 + (x === 50 ? 6 : x === 38 || x === 62 ? 4 : 0)} r="2" fill="#f7c948" />
          ))}
        </svg>
      </div>

      <div className="intro__title">
        <p className="intro__kicker">Navratri · Raas · Garba</p>
        <p className="intro__name">The Dandiya Project</p>
        <p className="intro__year">2026</p>
      </div>

      <span className="intro__skip">Tap to skip</span>
    </div>
  );
}
