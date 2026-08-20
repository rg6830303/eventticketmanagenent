'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
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
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  if (reduce) return <>{children}</>;

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
