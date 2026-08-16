import 'server-only';
import QRCode from 'qrcode';

/**
 * QR rendering.
 *
 * Error-correction level "M" survives the amount of smudging a phone screen
 * picks up in a queue while staying dense enough to scan from ~30cm. The
 * modules are drawn dark-on-white regardless of the site theme: gate scanners
 * and printed passes both need maximum contrast, and inverted QRs fail on a
 * meaningful share of Android camera apps.
 */

const BASE_OPTIONS = {
  errorCorrectionLevel: 'M' as const,
  margin: 2,
  color: { dark: '#050b1c', light: '#ffffff' },
};

/** PNG buffer — used as an inline CID attachment in the ticket email. */
export async function qrPngBuffer(payload: string, size = 640): Promise<Buffer> {
  return QRCode.toBuffer(payload, { ...BASE_OPTIONS, type: 'png', width: size });
}

/** data: URL — used when rendering a QR straight into a page or email body. */
export async function qrDataUrl(payload: string, size = 512): Promise<string> {
  return QRCode.toDataURL(payload, { ...BASE_OPTIONS, width: size });
}

/** Inline SVG string — sharp at any print size, no raster upload needed. */
export async function qrSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, { ...BASE_OPTIONS, type: 'svg', width: 512 });
}
