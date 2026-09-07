import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * CORS for the door scanner endpoints.
 *
 * The Android app is a Capacitor build: its HTML and JS are bundled into the
 * APK and served by the WebView from its own origin, so every call to this API
 * is cross-origin. A WebView is a browser and enforces CORS exactly like one.
 *
 * Without these headers the browser never delivers the response — and because
 * the request carries `Content-Type: application/json`, it is not a simple
 * request, so the WebView sends a preflight OPTIONS first and refuses to send
 * the real one when that comes back unlabelled. The app sees a rejected fetch,
 * indistinguishable from being offline, which is why a phone on good wifi
 * reported "No connection. Check the network." while the server was answering
 * 200 to the identical request from curl.
 *
 * Only the door routes get this. Nothing else in the API is called from another
 * origin, and opening them up would be a change to the site's security posture
 * made for no reason.
 */

/**
 * Where a Capacitor WebView says it is.
 *
 * Android with `androidScheme: "https"` reports `https://localhost`; the older
 * default and iOS report the capacitor:// forms. All are listed so a rebuild
 * that changes the scheme does not silently break the door on event night.
 */
const ALLOWED_ORIGINS = new Set([
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'ionic://localhost',
]);

/** Localhost on any port, for `npm run dev` and for testing the app's page. */
function isLocalDevOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function allow(origin: string | null): string | null {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.has(origin) || isLocalDevOrigin(origin)) return origin;
  return null;
}

/**
 * Headers to attach to a door response.
 *
 * Echoes the caller's origin rather than answering `*`, and `Vary: Origin` so a
 * CDN cannot serve one origin's allowance to another. There are no cookies on
 * these routes — the session is a bearer token the app holds — so no
 * credentials flag is needed, and not sending one keeps the browser from ever
 * attaching ambient authority to a cross-origin call.
 */
export function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = allow(request.headers.get('origin'));
  // A native client with no Origin needs nothing; a disallowed one gets
  // nothing, and the browser blocks it on the caller's side.
  if (!origin) return { Vary: 'Origin' };

  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // `authorization` for the scan token, `content-type` for the JSON body.
    // Both are non-simple headers, and either one alone forces the preflight.
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/** The preflight answer. Every door route exports this as its OPTIONS handler. */
export function corsPreflight(request: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

/** Copy the CORS headers onto a response the route has already built. */
export function withCors(response: NextResponse, request: NextRequest): NextResponse {
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    response.headers.set(key, value);
  }
  return response;
}
