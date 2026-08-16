import { cn } from '@/lib/utils';

type TileArtProps = {
  hue: number;
  /** Stable per-tile seed — the item id. */
  seed: number;
  /** The detail view is rendered large, so it earns a few more layers. */
  variant?: 'tile' | 'detail';
  className?: string;
};

/**
 * Integer-only PRNG. `Math.random` would break hydration and `Math.sin` is not
 * bit-identical across engines, so the composition is derived from plain
 * modular arithmetic that the server and the browser agree on exactly.
 */
function noise(seed: number, salt: number) {
  return ((seed * 9301 + salt * 49297) % 233280) / 233280;
}

const round = (value: number) => Number(value.toFixed(2));

// The brand is blue-only; incoming hues are nudged, never allowed to drift into violet.
const clampBlue = (value: number) => Math.min(238, Math.max(190, value));

/**
 * A generated stand-in for one photograph: layered CSS gradients plus an
 * inline-SVG texture of beams, haze and a crowd silhouette. No binary asset,
 * no licensing question, and identical output on every render.
 */
export function TileArt({ hue, seed, variant = 'tile', className }: TileArtProps) {
  const uid = `art-${variant}-${seed}`;
  const base = clampBlue(hue);
  const warm = clampBlue(hue + 12);
  const cool = clampBlue(hue - 12);

  const originX = 18 + Math.round(noise(seed, 3) * 64);
  const beamCount = variant === 'detail' ? 5 : 3;

  const beams = Array.from({ length: beamCount }, (_, i) => {
    const foot = 6 + Math.round(noise(seed, i + 11) * 88);
    const spread = 9 + Math.round(noise(seed, i + 19) * 22);
    const opacity = round(0.1 + noise(seed, i + 29) * 0.16);
    return { key: i, foot, spread, opacity };
  });

  const crowd = Array.from({ length: 15 }, (_, i) => {
    const x = round(i * 7.1 - 3 + noise(seed, i + 41) * 5);
    const h = round(20 + noise(seed, i + 59) * 26);
    const w = round(4.4 + noise(seed, i + 71) * 2.2);
    return { key: i, x, h, w };
  });

  return (
    <div
      aria-hidden="true"
      className={cn('absolute inset-0 overflow-hidden', className)}
      style={{
        backgroundImage: [
          `radial-gradient(110% 70% at ${originX}% -12%, hsl(${base} 95% 64% / 0.42), transparent 62%)`,
          `radial-gradient(90% 65% at 88% 108%, hsl(${warm} 90% 56% / 0.24), transparent 68%)`,
          `linear-gradient(168deg, hsl(${cool} 58% 15%) 0%, hsl(${base} 72% 7%) 55%, hsl(${cool} 66% 4%) 100%)`,
        ].join(', '),
      }}
    >
      <svg
        viewBox="0 0 100 140"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        focusable="false"
      >
        <defs>
          <linearGradient id={`${uid}-beam`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dfeaff" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#a8caff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#a8caff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-floor`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#03060f" stopOpacity="0" />
            <stop offset="100%" stopColor="#03060f" stopOpacity="0.92" />
          </linearGradient>
          <pattern id={`${uid}-dots`} width="3.4" height="3.4" patternUnits="userSpaceOnUse">
            <circle cx="0.8" cy="0.8" r="0.38" fill="#a8caff" fillOpacity="0.2" />
          </pattern>
          <radialGradient id={`${uid}-lamp`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#eaf2ff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#7db2ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="100" height="140" fill={`url(#${uid}-dots)`} />

        {beams.map((beam) => (
          <polygon
            key={beam.key}
            points={`${originX},-4 ${beam.foot - beam.spread},128 ${beam.foot + beam.spread},128`}
            fill={`url(#${uid}-beam)`}
            opacity={beam.opacity}
          />
        ))}

        <circle cx={originX} cy="2" r="26" fill={`url(#${uid}-lamp)`} opacity="0.5" />

        <g fill="#02040c" fillOpacity="0.88">
          {crowd.map((person) => (
            <g key={person.key}>
              <rect
                x={person.x}
                y={round(140 - person.h)}
                width={person.w}
                height={person.h}
                rx={round(person.w / 2)}
              />
              <circle
                cx={round(person.x + person.w / 2)}
                cy={round(140 - person.h - person.w * 0.55)}
                r={round(person.w * 0.52)}
              />
            </g>
          ))}
        </g>

        <rect y="96" width="100" height="44" fill={`url(#${uid}-floor)`} />
      </svg>

      {/* Edge vignette keeps the tile from bleeding into its neighbour on a dark page. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_0%,transparent_35%,rgba(3,6,15,0.72)_100%)]" />
      <div className="absolute inset-0 rounded-[inherit] shadow-inset" />
    </div>
  );
}
