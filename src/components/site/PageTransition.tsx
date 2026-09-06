'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

/**
 * Route entrance.
 *
 * Deliberately enter-only. The App Router unmounts the old tree before the new
 * one commits, so a real cross-fade would need the outgoing page kept alive in
 * a portal — the usual result of that is a flash of two stacked headers. A
 * short, keyed lift on arrival gives the navigation a sense of direction
 * without any of that.
 *
 * The key is the pathname, not the full URL: re-running the animation when only
 * a query string changes (a referral code landing on /book, say) would look
 * like the page had reloaded.
 *
 * The animation is CSS, not JavaScript, and that is the important part. This
 * div wraps every public page, so when it was a `motion.div` its server-
 * rendered `opacity: 0` was the whole site's visibility — and the only thing
 * that ever turned it back on was framer-motion hydrating. Any hydration
 * failure (a chunk 404 after a redeploy, an in-app webview, a dropped
 * connection) left a complete, correct, entirely invisible page. A CSS
 * animation runs without JavaScript, so the content cannot get stuck hidden.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  /*
   * Tell the stylesheet that JavaScript is alive.
   *
   * `Reveal` still needs JS — it fires on scroll position, which CSS cannot
   * ask about — so it keeps its hidden initial state. The failsafe in
   * globals.css reveals those elements if this flag never appears, which is
   * precisely the case where nobody is coming to animate them.
   */
  useEffect(() => {
    document.documentElement.dataset.hydrated = '1';
  }, []);

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
