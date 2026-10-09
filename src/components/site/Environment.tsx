import type { CSSProperties } from 'react';

/**
 * The page ground: a festival night.
 *
 * Deep maroon, a slow mirror-work mandala, marigold toran along the top, and
 * dandiya sticks drifting through the dark — some alone, some in pairs that
 * swing in and strike. Server component, SVG + CSS only: no canvas, no
 * hydration, nothing to fail inside an in-app browser. Every animation is a
 * transform, so it stays on the compositor even on a budget phone.
 */

type Stick = {
  x: string;
  y: string;
  r: number;
  s: number;
  d: number;
  delay: number;
  tone: Tone;
  desk?: boolean;
};

// Positions are viewport percentages; `desk` sticks only appear on wider screens.
const STICKS: Stick[] = [
  { x: '6%', y: '14%', r: -28, s: 1, d: 19, delay: 0, tone: 'a' },
  { x: '78%', y: '8%', r: 34, s: 0.85, d: 23, delay: -6, tone: 'b' },
  { x: '62%', y: '46%', r: -52, s: 0.7, d: 21, delay: -11, tone: 'c' },
  { x: '12%', y: '64%', r: 18, s: 0.9, d: 25, delay: -3, tone: 'b' },
  { x: '84%', y: '74%', r: -14, s: 1.05, d: 18, delay: -9, tone: 'a' },
  { x: '38%', y: '86%', r: 62, s: 0.75, d: 22, delay: -14, tone: 'c' },
  { x: '30%', y: '24%', r: 74, s: 0.6, d: 27, delay: -4, tone: 'a', desk: true },
  { x: '92%', y: '38%', r: -70, s: 0.65, d: 24, delay: -17, tone: 'c', desk: true },
  { x: '50%', y: '4%', r: 12, s: 0.55, d: 26, delay: -8, tone: 'b', desk: true },
];

// Pairs that swing together and strike.
const PAIRS = [
  { x: '70%', y: '22%', s: 1, delay: 0 },
  { x: '14%', y: '40%', s: 0.8, delay: -1.6 },
  { x: '46%', y: '66%', s: 0.9, delay: -0.8, desk: true },
];

type Tone = 'a' | 'b' | 'c';

// Lacquered wood, and the colour of the thread wrapped round it.
const TONES: Record<Tone, { dark: string; light: string; band: string }> = {
  a: { dark: '#9a1b3c', light: '#e8456b', band: '#f7a826' },
  b: { dark: '#a35a07', light: '#f7b733', band: '#d81b72' },
  c: { dark: '#0d6b68', light: '#2ec8be', band: '#f7a826' },
};

function StickDefs({ tone }: { tone: Tone }) {
  const c = TONES[tone];
  return (
    <>
      <linearGradient id={`dw-${tone}`} x1="0" x2="1">
        <stop offset="0" stopColor={c.dark} />
        <stop offset="0.45" stopColor={c.light} />
        <stop offset="1" stopColor={c.dark} />
      </linearGradient>
      <pattern id={`dp-${tone}`} width="24" height="22" patternUnits="userSpaceOnUse" patternTransform="skewY(-24)">
        <rect width="24" height="22" fill={`url(#dw-${tone})`} />
        <rect width="24" height="6" fill={c.band} />
        <rect y="6" width="24" height="2" fill="#ffe7b0" opacity="0.9" />
      </pattern>
      <symbol id={`ds-${tone}`} viewBox="0 0 24 240">
        <path
          d="M12 14 L5 0 M12 14 L9 0 M12 14 L15 0 M12 14 L19 0"
          stroke={c.band}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="6" y="14" width="12" height="212" rx="6" fill={`url(#dp-${tone})`} />
        <rect x="8" y="16" width="2.5" height="208" rx="1.2" fill="#fff" opacity="0.25" />
        <circle cx="12" cy="20" r="5.5" fill="#f7c948" stroke="#a8670c" strokeWidth="1.2" />
        <circle cx="12" cy="220" r="5.5" fill="#f7c948" stroke="#a8670c" strokeWidth="1.2" />
        <circle cx="10.4" cy="18.4" r="1.6" fill="#fff6d6" />
        <circle cx="10.4" cy="218.4" r="1.6" fill="#fff6d6" />
        <circle cx="12" cy="90" r="3" fill="#e6f5ff" stroke="#f7c948" strokeWidth="1" />
        <circle cx="12" cy="150" r="3" fill="#e6f5ff" stroke="#f7c948" strokeWidth="1" />
      </symbol>
    </>
  );
}

/** One stick. Needs <Environment /> on the page for its symbol defs. */
export function DandiyaStick({ tone = 'a', className }: { tone?: Tone; className?: string }) {
  return (
    <svg viewBox="0 0 24 240" className={className ?? 'dstick'} aria-hidden>
      <use href={`#ds-${tone}`} />
    </svg>
  );
}

export function Environment() {
  return (
    <div className="env" aria-hidden>
      <svg width="0" height="0" className="absolute">
        <defs>
          {(Object.keys(TONES) as Tone[]).map((t) => (
            <StickDefs key={t} tone={t} />
          ))}
        </defs>
      </svg>

      <span className="env__glow" />
      <span className="env__glow env__glow--b" />

      <svg viewBox="-100 -100 200 200" className="env__mandala">
        <g fill="none" stroke="currentColor">
          <circle r="96" strokeWidth="0.6" strokeDasharray="1 4" />
          <circle r="82" strokeWidth="0.5" />
          <circle r="60" strokeWidth="0.6" strokeDasharray="6 3" />
          <circle r="34" strokeWidth="0.5" />
          {Array.from({ length: 24 }, (_, i) => (
            <path
              key={i}
              d="M0 -60 Q8 -72 0 -82 Q-8 -72 0 -60"
              strokeWidth="0.7"
              transform={`rotate(${i * 15})`}
            />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <circle key={`m${i}`} cx="0" cy="-47" r="4" strokeWidth="0.7" transform={`rotate(${i * 30})`} />
          ))}
        </g>
      </svg>

      {STICKS.map((st, i) => (
        <span
          key={i}
          className={`env__stick${st.desk ? ' env__desk' : ''}`}
          style={
            {
              left: st.x,
              top: st.y,
              '--r': `${st.r}deg`,
              '--s': st.s,
              animationDuration: `${st.d}s`,
              animationDelay: `${st.delay}s`,
            } as CSSProperties
          }
        >
          <DandiyaStick tone={st.tone} />
        </span>
      ))}

      {PAIRS.map((p, i) => (
        <span
          key={`p${i}`}
          className={`env__pair${p.desk ? ' env__desk' : ''}`}
          style={{ left: p.x, top: p.y, '--s': p.s, '--pd': `${p.delay}s` } as CSSProperties}
        >
          <span className="env__pair-l">
            <DandiyaStick tone="a" />
          </span>
          <span className="env__pair-r">
            <DandiyaStick tone="b" />
          </span>
          <span className="env__spark" />
        </span>
      ))}

      <span className="env__toran" />
      <span className="env__grain" />
    </div>
  );
}
