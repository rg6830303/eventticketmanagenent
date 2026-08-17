/**
 * Resolves the public origin of this deployment.
 *
 * Written defensively because the failure mode is a build crash rather than a
 * degraded page: `new URL('')` throws, and an env var that exists but is empty
 * slips straight past `??` — an empty string is not nullish. Vercel's dashboard
 * makes it easy to create exactly that: a defined, blank variable.
 *
 * Not marked `server-only`: Next reads this while generating metadata, the
 * sitemap and robots.txt, all of which run outside a request.
 */

function firstNonEmpty(...candidates: Array<string | undefined | null>): string | null {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }
  return null;
}

const LOCAL_FALLBACK = 'http://localhost:3000';

export function getSiteUrl(): string {
  // Referenced literally so Next can still inline NEXT_PUBLIC_* at build time.
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelHost = process.env.VERCEL_URL?.trim();

  const raw = firstNonEmpty(configured, vercelHost ? `https://${vercelHost}` : null);
  if (!raw) return LOCAL_FALLBACK;

  // VERCEL_URL and hand-typed domains both arrive without a scheme.
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    // A malformed value must not take the whole build down.
    console.warn(`[site-url] Ignoring unparseable NEXT_PUBLIC_SITE_URL: ${JSON.stringify(raw)}`);
    return LOCAL_FALLBACK;
  }
}

export function getSiteUrlObject(): URL {
  return new URL(getSiteUrl());
}
