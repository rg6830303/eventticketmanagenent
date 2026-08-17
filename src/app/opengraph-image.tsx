import { ImageResponse } from 'next/og';
import { BRAND } from '@/content/site';

export const runtime = 'nodejs';
export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Social share card, rendered at request time by Satori.
 *
 * Satori supports only a subset of CSS — no external stylesheets, no Tailwind
 * classes, and every flex container needs an explicit `display: flex`. The
 * globe is inlined as raw SVG because an <img> would need a network fetch the
 * renderer cannot make.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: 'linear-gradient(115deg, #04060e 0%, #0a1226 45%, #2317E0 100%)',
          color: '#e9eefc',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <svg width="72" height="72" viewBox="-110 -110 220 220" fill="none">
            <g stroke="#F5242B" strokeWidth="7">
              <circle r="100" />
              <ellipse rx="31" ry="100" transform="rotate(-22)" />
              <ellipse rx="62" ry="100" transform="rotate(-22)" />
              <ellipse rx="100" ry="34" transform="rotate(-22)" />
              <ellipse rx="31" ry="100" transform="rotate(38)" />
              <ellipse rx="62" ry="100" transform="rotate(38)" />
              <ellipse rx="31" ry="100" transform="rotate(98)" />
            </g>
          </svg>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, letterSpacing: '-0.5px' }}>
            HOUZ&nbsp;<span style={{ color: '#F5242B' }}>OF</span>&nbsp;VYBE
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 88, fontWeight: 800, lineHeight: 1.02, letterSpacing: '-2px' }}>
            Nights that actually move.
          </div>
          <div style={{ display: 'flex', marginTop: 24, fontSize: 30, color: '#9aa8cc' }}>
            Hyderabad after dark · QR entry · capped rooms
          </div>
        </div>
      </div>
    ),
    size,
  );
}
