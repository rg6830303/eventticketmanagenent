'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { useState } from 'react';
import { formatInr } from '@/lib/utils';

/**
 * Mobile conversion bar.
 *
 * Hidden until the hero CTA has scrolled off, so the two never compete, and
 * hidden again at the foot of the page where the footer already carries a
 * button. Desktop keeps the CTA in the header instead — a fixed bar over a
 * wide layout eats content for no benefit.
 */
export function StickyBuyBar({
  fromPaise,
  soldOut,
}: {
  fromPaise: number | null;
  soldOut: boolean;
}) {
  const { scrollY, scrollYProgress } = useScroll();
  const [visible, setVisible] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setVisible(latest > 620 && scrollYProgress.get() < 0.9);
  });

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 90 }}
          animate={{ y: 0 }}
          exit={{ y: 90 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-paper px-4 py-3 lg:hidden"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate font-display text-[0.9375rem] font-semibold text-ink">
                OFF Campus · 12 Sep
              </p>
              <p className="tnum text-[0.75rem] text-slate">
                {soldOut
                  ? 'Sold out'
                  : fromPaise !== null
                    ? `From ${formatInr(fromPaise)}`
                    : 'Tickets on sale'}
              </p>
            </div>
            <Link href="/events/offcampus#tickets" className="btn-primary btn-sm shrink-0 py-3">
              {soldOut ? 'Join waitlist' : 'Buy tickets'}
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
