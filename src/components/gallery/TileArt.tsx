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
 * bit-identical across engines, so the composition is derived from integer
 * mixing that the server and the browser agree on exactly.
 *
 * It has to actually mix. The previous version was `(seed * a + salt * b) % m`,
 * which is linear in `salt` — so walking `salt` up by one per item walked the
 * output up by a fixed step, and a scatter whose x and y both came from
 * consecutive salts landed every point on a straight diagonal. `Math.imul` is
 * specified to wrap at 32 bits on every engine, which keeps this exact while
 * destroying that correlation.
 */
function noise(seed: number, salt: number) {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 0x165667b1, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const round = (value: number) => Number(value.toFixed(2));

// The brand is blue-only; incoming hues are nudged, never allowed to drift into violet.
const clampBlue = (value: number) => Math.min(238, Math.max(190, value));

/**
 * A generated stand-in for one photograph: layered CSS gradients plus an
 * inline-SVG texture of light, haze and a crowd silhouette. No binary asset,
 * no licensing question, and identical output on every render.
 *
 * Drawn in daylight. These used to be near-black nightclub scenes, which was
 * wrong twice over: they fought a page built entirely out of pale blue, and
 * they showed a room at midnight for an event that finishes at four in the
 * afternoon. Now the light falls from above like sun through a roof and the
 * tile belongs to the same afternoon as everything around it.
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
    const opacity = round(0.18 + noise(seed, i + 29) * 0.22);
    return { key: i, foot, spread, opacity };
  });

  /*
   * Bokeh, not bodies.
   *
   * This used to draw a crowd — a rounded bar per person with a circle for a
   * head. The tile is stretched to whatever shape the grid gives it, and under
   * that stretch every head flattened into an ellipse sitting on a bar, so a
   * row of them read as a bar chart. Cropping instead of stretching only made
   * them enormous.
   *
   * Out-of-focus light has no proportions to get wrong. It distorts into
   * slightly oval highlights, which is exactly what a real lens does, and it
   * says "a room with something going on in it" without claiming to be a
   * photograph of one.
   */
  const bokeh = Array.from({ length: 26 }, (_, i) => {
    const x = round(4 + noise(seed, i + 41) * 92);
    const y = round(24 + noise(seed, i + 59) * 104);
    const r = round(1.1 + noise(seed, i + 71) * 4.6);
    const opacity = round(0.16 + noise(seed, i + 83) * 0.4);
    return { key: i, x, y, r, opacity };
  });

  return (
    <div
      aria-hidden="true"
      className={cn('absolute inset-0 overflow-hidden', className)}
      style={{
        backgroundImage: [
          `radial-gradient(110% 72% at ${originX}% -10%, hsl(${base} 100% 97% / 0.95), transparent 64%)`,
          `radial-gradient(85% 60% at 88% 106%, hsl(${warm} 82% 78% / 0.55), transparent 70%)`,
          `linear-gradient(168deg, hsl(${cool} 90% 92%) 0%, hsl(${base} 82% 80%) 52%, hsl(${cool} 64% 66%) 100%)`,
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
          {/* Sunlight: white at the source, falling away to nothing. */}
          <linearGradient id={`${uid}-beam`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
            <stop offset="48%" stopColor="#ffffff" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          {/* The floor, rather than the black fade-out this used to end on. */}
          <linearGradient id={`${uid}-floor`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#123f78" stopOpacity="0" />
            <stop offset="100%" stopColor="#123f78" stopOpacity="0.4" />
          </linearGradient>
          <pattern id={`${uid}-dots`} width="3.4" height="3.4" patternUnits="userSpaceOnUse">
            <circle cx="0.8" cy="0.8" r="0.38" fill="#ffffff" fillOpacity="0.4" />
          </pattern>
          <radialGradient id={`${uid}-lamp`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
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

        <circle cx={originX} cy="2" r="26" fill={`url(#${uid}-lamp)`} opacity="0.75" />

        <rect y="96" width="100" height="44" fill={`url(#${uid}-floor)`} />

        <g fill="#ffffff">
          {bokeh.map((dot) => (
            <circle key={dot.key} cx={dot.x} cy={dot.y} r={dot.r} fillOpacity={dot.opacity} />
          ))}
        </g>
      </svg>

      {/* Edge shading, so a tile still separates from the one beside it without
          being sunk in a black vignette. */}
      <div className="absolute inset-0 bg-[radial-gradient(125%_100%_at_50%_0%,transparent_45%,rgba(18,63,120,0.3)_100%)]" />
      <div className="absolute inset-0 rounded-[inherit] shadow-ring" />
    </div>
  );
}
