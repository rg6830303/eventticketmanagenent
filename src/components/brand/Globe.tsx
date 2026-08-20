import { cn } from '@/lib/utils';

/**
 * The wireframe globe from the Houz of Vybe mark.
 *
 * Built from great circles rather than a traced path so it stays crisp at any
 * size and can be recoloured, animated or spun without shipping a raster.
 *
 * Three families of ellipses at different tilts produce the tangled, orbiting
 * look of the original: one family reads as a flat globe, three read as a
 * sphere seen through itself.
 */

const R = 100;
const FAMILIES = [-22, 38, 98] as const;
const LINES_PER_FAMILY = 5;

/** Ellipse half-widths across a family — 0 would collapse to a bare line. */
const RINGS = Array.from({ length: LINES_PER_FAMILY }, (_, index) => {
  const t = (index + 1) / (LINES_PER_FAMILY + 1);
  return Math.max(6, Math.round(R * Math.sin(t * Math.PI) * 100) / 100);
});

/**
 * The geometry alone, centred on 0,0 in a 220-unit box. Kept separate from the
 * <svg> wrapper so the full lockup can drop it into its own canvas — a nested
 * <svg> would not honour the parent's transform.
 */
export function GlobeRings({ strokeWidth = 2.2 }: { strokeWidth?: number }) {
  return (
    <g stroke="currentColor" strokeWidth={strokeWidth} fill="none">
      <circle cx="0" cy="0" r={R} />
      {FAMILIES.map((tilt) =>
        // Keyed by index, not by rx: the widths are symmetric about the centre
        // ring, so two ellipses in every family share a value and an rx-based
        // key would collide.
        RINGS.map((rx, index) => (
          <ellipse
            key={`${tilt}-${index}`}
            cx="0"
            cy="0"
            rx={rx}
            ry={R}
            transform={`rotate(${tilt})`}
          />
        )),
      )}
      {/* Latitudes stop the mark reading as a spindle rather than a sphere. */}
      <ellipse cx="0" cy="0" rx={R} ry={R * 0.34} transform="rotate(-22)" />
      <ellipse cx="0" cy="0" rx={R} ry={R * 0.7} transform="rotate(-22)" />
    </g>
  );
}

export function Globe({
  className,
  spin = false,
  strokeWidth = 2.2,
}: {
  className?: string;
  /** Slow continuous rotation; globals.css disables it under reduced-motion. */
  spin?: boolean;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="-110 -110 220 220"
      fill="none"
      className={cn(spin && 'animate-spin-slow', className)}
      aria-hidden
    >
      <GlobeRings strokeWidth={strokeWidth} />
    </svg>
  );
}
