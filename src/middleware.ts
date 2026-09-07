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

/* ===========================================================================
   Maintenance pause
   ---------------------------------------------------------------------------
   A switch for closing the public site to new business without touching the
   console. The console is a different hostname and is left entirely alone, so
   the door scanner, the bookings list and the payment sweep keep working while
   the shop is shut.

   This lives here rather than in Vercel because Vercel pauses a *project*.
   Both hostnames are one project, so pausing there would take the console down
   with the site.

   DEFAULT IS OPEN. The pause was landed as a default while the checkout was
   broken, which was right at the time and is a hazard to leave in place: a
   deployment that closes the shop unless told otherwise will close it again
   the next time somebody forgets. The reason for the pause — checkout going to
   about:blank in an in-app browser — is fixed, so the default goes back to
   serving customers and the pause becomes something you ask for.

   To close the site: set SITE_PAUSED=true in the deployment. Everything
   serving a customer who has already paid stays open either way.
   =========================================================================== */
const SITE_PAUSED = (process.env.SITE_PAUSED ?? 'false').trim().toLowerCase() === 'true';

/**
 * Paths that stay open while the site is paused.
 *
 * Pausing must not strand anybody who has already paid. A closed shop still
 * honours the tickets it sold, so everything that serves an existing booking
 * keeps working: the QR a customer shows at the door, the page they got it
 * from, and the whole set of endpoints that finish a payment already in
 * flight — the webhook Razorpay calls, the browser callback, the poll the pay
 * page runs, and the sweep that rescues the ones nobody reported.
 *
 * What is closed is the front of the shop: browsing, the cart, the checkout,
 * and every endpoint that could start a new payment.
 */
const OPEN_WHILE_PAUSED = [
  // Somebody who already holds a pass.
  '/t/', // the QR ticket view — this is what gets scanned at the door
  '/booking/', // their confirmation page and passes
  '/api/bookings/', // resend + claim, both scoped to one existing reference
  // Money already in motion. Blocking any of these takes a payment and never
  // issues the ticket it paid for.
  '/api/payments/razorpay/webhook',
  '/api/payments/razorpay/verify',
  '/api/cron/',
  // Ours to look at, and a way for a stranded customer to reach a human.
  '/api/health',
  '/contact',
  '/api/contact',
  '/legal/',
];

function isOpenWhilePaused(pathname: string): boolean {
  return OPEN_WHILE_PAUSED.some((prefix) =>
    prefix.endsWith('/') ? pathname.startsWith(prefix) : pathname === prefix,
  );
}

/**
 * Served from the Edge as one self-contained document.
 *
 * Deliberately not a page in the app: the reason the site is paused is that
 * pages were rendering blank, so a maintenance notice that depends on the same
 * rendering, the same stylesheet and the same hydration is the one page that
 * must not. No JavaScript, no external CSS, nothing to fail.
 */
function maintenanceHtml(): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Back shortly — Houz of Vybe</title>
<style>
  :root{color-scheme:light}
  body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;
       background:#e8f0fb;color:#0a2138;
       font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  .card{max-width:33rem;background:#fff;border:1.5px solid #0a2138;border-radius:18px;
        box-shadow:6px 6px 0 0 #0a2138;padding:34px 30px}
  h1{margin:0 0 12px;font-size:1.6rem;line-height:1.25;letter-spacing:-.02em}
  p{margin:0 0 12px;color:#3d5773}
  .tag{display:inline-block;margin-bottom:18px;padding:5px 11px;border:1px solid #0a2138;
       border-radius:999px;font-size:.7rem;letter-spacing:.16em;text-transform:uppercase}
  a{color:#1f6fd0;font-weight:600}
  .foot{margin:22px 0 0;padding-top:16px;border-top:1.5px solid #0a2138;font-size:.82rem;color:#5a7391}
</style></head>
<body><main class="card">
  <span class="tag">Back shortly</span>
  <h1>Ticket sales are paused for maintenance.</h1>
  <p>We are fixing a problem with the checkout. Nothing has been charged, and no
     new bookings are being taken until it is sorted.</p>
  <p><strong>If you have already booked, your passes are safe.</strong> Your QR
     still works and will scan at the door — the link in your confirmation email
     is unaffected.</p>
  <p class="foot">Paid but never received your passes? Email
     <a href="mailto:hello@houzofvybe.com">hello@houzofvybe.com</a> with your booking
     reference and we will sort it out.</p>
</main></body></html>`;
}

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

  /*
   * The pause, applied to the public site only.
   *
   * Placed after the console check above so it can never touch the admin host:
   * an operator still needs the door scanner, the bookings list and the
   * payment sweep while the shop out front is shut.
   *
   * 503 with Retry-After rather than a redirect or a 200. It is the honest
   * status for a deliberate outage, and it is what stops Google treating a
   * temporary maintenance page as the site's new permanent content.
   */
  if (SITE_PAUSED && !isAdminHost && !wantsConsole && !isOpenWhilePaused(pathname)) {
    const headers = { 'Cache-Control': 'no-store', 'Retry-After': '3600' };
    if (isApi) {
      return NextResponse.json(
        {
          error:
            'Ticket sales are paused for maintenance. Nothing has been charged. ' +
            'If you have already booked, your passes are unaffected.',
          code: 'site_paused',
        },
        { status: 503, headers },
      );
    }
    return new NextResponse(maintenanceHtml(), {
      status: 503,
      headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Marketing shorthand, scoped to the marketing host. On the console host
  // /tickets is the issue-a-pass page, and a redirect defined in next.config
  // would have taken precedence over both.
  if (!isAdminHost && pathname === '/tickets') {
    return NextResponse.redirect(new URL('/book', request.url), { status: 307 });
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
