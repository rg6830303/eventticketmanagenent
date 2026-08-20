import { ImageResponse } from 'next/og';
import { BRAND, EVENT } from '@/content/site';

export const runtime = 'nodejs';
export const alt = `${EVENT.name} ${EVENT.edition} — ${EVENT.dateLabel}, ${EVENT.venue.name}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Social share card, rendered at request time by Satori.
 *
 * Satori supports only a subset of CSS — no external stylesheets, no Tailwind
 * classes, and every flex container needs an explicit `display: flex`. The mark
 * is inlined as raw SVG because an <img> would need a network fetch the
 * renderer cannot make.
 *
 * What goes on the card is the same thing that sells the ticket: the name, the
 * date, the place and the time. A card that only says the brand name gives
 * someone scrolling past nothing to act on.
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
          padding: '68px',
          background: 'linear-gradient(140deg, #ffffff 0%, #eaf3ff 55%, #cfe3ff 100%)',
          color: '#0a2138',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <svg width="60" height="60" viewBox="-110 -110 220 220" fill="none">
              <g stroke="#e1303c" strokeWidth="7">
                <circle r="100" />
                <ellipse rx="31" ry="100" transform="rotate(-22)" />
                <ellipse rx="62" ry="100" transform="rotate(-22)" />
                <ellipse rx="100" ry="34" transform="rotate(-22)" />
                <ellipse rx="31" ry="100" transform="rotate(38)" />
                <ellipse rx="62" ry="100" transform="rotate(38)" />
                <ellipse rx="31" ry="100" transform="rotate(98)" />
              </g>
            </svg>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, letterSpacing: '-0.4px' }}>
              HOUZ&nbsp;<span style={{ color: '#e1303c' }}>OF</span>&nbsp;VYBE
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 20,
              letterSpacing: '3px',
              color: '#2586ef',
              textTransform: 'uppercase',
            }}
          >
            {EVENT.edition}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 106,
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: '-4px',
            }}
          >
            {EVENT.name.toUpperCase()}
          </div>
          <div style={{ display: 'flex', marginTop: 22, fontSize: 34, color: '#3c5c7d' }}>
            {EVENT.venue.name}, {EVENT.venue.area} · {BRAND.city}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '44px' }}>
            <Stat label="Date" value={EVENT.dateShort} />
            <Stat label="Time" value="12 — 5 PM" />
            <Stat label="Entry" value={EVENT.ageLabel} />
          </div>
          <div
            style={{
              display: 'flex',
              background: '#2586ef',
              color: '#ffffff',
              padding: '16px 30px',
              borderRadius: 14,
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            Tickets on sale
          </div>
        </div>
      </div>
    ),
    size,
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', fontSize: 17, letterSpacing: '2px', color: '#7891ad' }}>
        {label.toUpperCase()}
      </div>
      <div style={{ display: 'flex', marginTop: 6, fontSize: 30, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
