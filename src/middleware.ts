import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Host routing + the gate for the admin console.
 *
 * One deployment serves two domains. On the marketing host the console lives
 * under /admin as usual; on an admin host the console IS the site, so every
 * path is rewritten into /admin and the marketing pages become unreachable
 * there. That keeps door staff on a URL that only ever shows the console, and
 * keeps a stray link to the public site off the phone they are scanning with.
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

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAdminHost = ADMIN_HOSTNAMES.includes(hostOf(request));

  // API routes are never rewritten: the console's own fetches target absolute
  // /api/... paths and must resolve identically on both hosts.
  const isApi = pathname.startsWith('/api');

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

    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret) {
      console.error('[middleware] ADMIN_SESSION_SECRET is not set');
      return NextResponse.redirect(loginUrl);
    }

    try {
      await jwtVerify(token, new TextEncoder().encode(secret), {
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
