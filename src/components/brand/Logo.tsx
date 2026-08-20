import { cn } from '@/lib/utils';
import { Globe, GlobeRings } from './Globe';

/**
 * The Houz of Vybe identity, in three lockups.
 *
 * `full`    — arched wordmark around the globe. The primary mark.
 * `inline`  — globe + horizontal wordmark. For nav bars and tight headers.
 * `mark`    — globe alone. Favicons, avatars, loading states.
 *
 * Drawn in SVG rather than shipped as an image so it inherits colour, stays
 * sharp on any display, and needs no network request under the site's CSP.
 */

const RED = '#F5242B';

export function Logo({
  variant = 'inline',
  className,
  spin = false,
}: {
  variant?: 'full' | 'inline' | 'mark';
  className?: string;
  spin?: boolean;
}) {
  if (variant === 'mark') {
    return <Globe className={cn('text-flare', className)} spin={spin} />;
  }

  if (variant === 'full') {
    return (
      <svg
        viewBox="0 0 320 320"
        className={cn('h-auto w-full', className)}
        role="img"
        aria-label="Houz of Vybe"
      >
        <defs>
          {/* Arc opens at the bottom so the text reads left-to-right over the top. */}
          <path id="hov-arc" d="M 42 176 A 118 118 0 0 1 278 176" fill="none" />
        </defs>

        {/* Placement lives on the outer group as an SVG attribute; the spin is a
            CSS transform on the inner one. On the same element CSS would
            silently replace the attribute and the globe would fly off-canvas. */}
        <g transform="translate(160 178) scale(0.62)" className="text-flare">
          <g className={cn(spin && 'animate-spin-slow origin-center')}>
            <GlobeRings strokeWidth={3.4} />
          </g>
        </g>

        <text
          fill="currentColor"
          className="font-display"
          fontSize="42"
          fontWeight="800"
          letterSpacing="2"
        >
          <textPath href="#hov-arc" startOffset="50%" textAnchor="middle">
            HOUZ OF VYBE
          </textPath>
        </text>
      </svg>
    );
  }

  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <Globe className="h-8 w-8 shrink-0 text-flare" spin={spin} strokeWidth={3} />
      <span className="font-display text-[17px] font-extrabold leading-none tracking-tight text-ink">
        HOUZ <span className="text-flare">OF</span> VYBE
      </span>
    </span>
  );
}

/** Standalone SVG string, used by the favicon route. */
export const LOGO_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-110 -110 220 220"><rect x="-110" y="-110" width="220" height="220" rx="40" fill="#05070f"/><g fill="none" stroke="${RED}" stroke-width="6"><circle r="100"/><ellipse rx="31" ry="100" transform="rotate(-22)"/><ellipse rx="59" ry="100" transform="rotate(-22)"/><ellipse rx="100" ry="34" transform="rotate(-22)"/><ellipse rx="31" ry="100" transform="rotate(38)"/><ellipse rx="59" ry="100" transform="rotate(38)"/><ellipse rx="31" ry="100" transform="rotate(98)"/><ellipse rx="59" ry="100" transform="rotate(98)"/></g></svg>`;
