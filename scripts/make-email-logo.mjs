import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

/**
 * The brand mark, rasterised for email.
 *
 * Email clients do not render SVG, so the mark ships as a PNG. Drawn at 3x the
 * display size (168px shown at 56px) so it stays sharp on a phone, on a white
 * background rather than transparent — a transparent PNG turns into a dark
 * smear when Gmail applies its dark-mode transform.
 */
const SIZE = 168;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-104 -104 208 208" width="${SIZE}" height="${SIZE}">
  <rect x="-104" y="-104" width="208" height="208" rx="0" fill="#ffffff"/>
  <g fill="none" stroke="#F5242B" stroke-width="7">
    <circle r="92"/>
    <ellipse rx="28" ry="92" transform="rotate(-22)"/>
    <ellipse rx="55" ry="92" transform="rotate(-22)"/>
    <ellipse rx="92" ry="31" transform="rotate(-22)"/>
    <ellipse rx="92" ry="64" transform="rotate(-22)"/>
    <ellipse rx="28" ry="92" transform="rotate(38)"/>
    <ellipse rx="55" ry="92" transform="rotate(38)"/>
    <ellipse rx="28" ry="92" transform="rotate(98)"/>
    <ellipse rx="55" ry="92" transform="rotate(98)"/>
  </g>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
console.log(`mark: ${png.length} bytes, ${SIZE}x${SIZE}`);

const meta = await sharp(png).metadata();
console.log(`verified: ${meta.format} ${meta.width}x${meta.height}`);

writeFileSync(
  'src/lib/email-assets.ts',
  `/**
 * Binary assets embedded in outbound email.
 *
 * Base64 in a module rather than a file on disk: Vercel's file tracing does not
 * reliably include assets that are only read at runtime, and an email that
 * silently loses its logo in production is the kind of failure nobody notices
 * until a customer mentions it.
 *
 * The mark is a PNG because no mail client renders SVG, on a white background
 * because a transparent one becomes a dark smear under Gmail's dark-mode
 * transform. Regenerate with scripts/make-email-logo.mjs.
 */

/** Houz of Vybe mark, ${SIZE}x${SIZE} PNG, displayed at 56px. */
export const BRAND_MARK_PNG_BASE64 =
  '${png.toString('base64')}';

export function brandMarkPng(): Buffer {
  return Buffer.from(BRAND_MARK_PNG_BASE64, 'base64');
}
`,
  'utf8',
);
console.log('wrote src/lib/email-assets.ts');
