import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { ADMIN_SESSION_INFO, signingKey } from '@/lib/signing-key';

/**
 * Host routing + the gate for the admin console.
 *
 * One deployment serves two hostnames and they are strictly separate:
 *
 *   hovadmin.vercel.app   the console IS the site. Every path is rewritten into
 *                         /admin, so the URL bar reads /login and /scan rather
 *                         than /admin/login, and the marketing pages are
 *                         unreachable. Door staff stay on a URL that can only
 *                         ever show the console.
 *
 *   houzofvybe.com        the console does not exist. /admin and /api/admin are
 *                         404, not redirected and not login-walled.
 *
 * The 404 is the point. A login page on the public domain is a permanent,
 * crawlable invitation to guess at credentials, and a redirect would answer
 * "yes, there is a console, and here is where it lives" to anyone who typed
 * /admin. Returning nothing gives an attacker no signal that the marketing
 * domain and the console share a deployment at all.
 *
 * Middleware runs on the Edge runtime, so it cannot import @/lib/auth — that
 * pulls in bcryptjs and pg. The JWT is verified inline with jose, which is
 * Edge-native. This is a cheap first gate only: every admin page and API route
 * re-checks the session server-side, so a bypass here grants nothing.
 */

/** Comma-separated. Override with ADMIN_HOSTNAMES to add a custom domain. */
const ADMIN_HOSTNAMES = (process.env.ADMIN_HOSTNAMES ?? 'hovadmin.vercel.app')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

function hostOf(request: NextRequest): string {
  // x-forwarded-host is what Vercel sets when a request arrives via an alias.
  const raw = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  return raw.toLowerCase().split(':')[0];
}

/**
 * `npm run dev` serves both faces of the app from one hostname, so the split
 * above cannot apply there — enforcing it would make /admin unreachable
 * locally and leave the console only testable by spoofing a Host header.
 */
function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '';
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = hostOf(request);
  const local = isLocalHost(host);
  const isAdminHost = ADMIN_HOSTNAMES.includes(host);

  // API routes are never rewritten: the console's own fetches target absolute
  // /api/... paths and must resolve identically on both hosts.
  const isApi = pathname.startsWith('/api');

  // The console and its API exist only on the admin host. `/adminfoo` is a
  // normal marketing path and must not be caught, hence the exact-or-slash test.
  const wantsConsole =
    pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin');

  if (wantsConsole && !isAdminHost && !local) {
    // A bare 404 for the API — a JSON client has no use for an HTML page — and
    // the site's own not-found page for a browser, so somebody who mistyped
    // gets the real 404 rather than a blank screen.
    if (isApi) return new NextResponse(null, { status: 404 });
    return NextResponse.rewrite(new URL('/_not-found', request.url), { status: 404 });
  }

  const shouldRewrite = isAdminHost && !isApi && !pathname.startsWith('/admin');
  const targetPath = shouldRewrite
    ? pathname === '/'
      ? '/admin'
      : `/admin${pathname}`
    : pathname;

  const needsAuth =
    !isApi && targetPath.startsWith('/admin') && !targetPath.startsWith('/admin/login');

  if (needsAuth) {
    // On the admin host the login page is reachable at /login, which the rewrite
    // above maps to /admin/login — so the visible URL stays clean.
    const loginUrl = new URL(isAdminHost ? '/login' : '/admin/login', request.url);
    loginUrl.searchParams.set('next', pathname);

    const token = request.cookies.get('hov_admin')?.value;
    if (!token) return NextResponse.redirect(loginUrl);

    try {
      // signing-key.ts is deliberately free of node: imports so it resolves on
      // the Edge runtime, and derives byte-identically to the API route that
      // issued this cookie.
      await jwtVerify(token, await signingKey('ADMIN_SESSION_SECRET', ADMIN_SESSION_INFO), {
        issuer: 'houz-of-vybe',
        audience: 'hov-admin',
      });
    } catch {
      // Expired or tampered — clear it so the browser stops re-sending a dead cookie.
      const response = NextResponse.redirect(loginUrl);
      response.cookies.set('hov_admin', '', { path: '/', maxAge: 0 });
      return response;
    }
  }

  if (shouldRewrite) {
    return NextResponse.rewrite(new URL(`${targetPath}${search}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Runs on everything except build assets and files served from /public, so the
  // admin host can rewrite arbitrary paths. Static assets must pass through
  // untouched or the console would load without CSS.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)'],
};
