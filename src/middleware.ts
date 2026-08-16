import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Gate for the admin console.
 *
 * Middleware runs on the Edge runtime, so it cannot import @/lib/auth — that
 * module pulls in bcryptjs and pg, neither of which exist there. The JWT is
 * verified inline with jose, which is Edge-native. This is a cheap first gate
 * only: every admin page and API route re-checks the session server-side, so a
 * bypass here would not grant access to anything.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get('hov_admin')?.value;
  const loginUrl = new URL('/admin/login', request.url);
  loginUrl.searchParams.set('next', request.nextUrl.pathname);

  if (!token) {
    return NextResponse.redirect(loginUrl);
  }

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
    return NextResponse.next();
  } catch {
    // Expired or tampered — clear it so the browser stops re-sending a dead cookie.
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set('hov_admin', '', { path: '/', maxAge: 0 });
    return response;
  }
}

export const config = {
  // Everything under /admin except the login page itself, which would otherwise
  // redirect to itself forever.
  matcher: ['/admin', '/admin/((?!login).*)'],
};
