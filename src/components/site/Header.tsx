'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AnimatePresence,
  motion,
  useScroll,
  useSpring,
  useMotionValueEvent,
} from 'framer-motion';
import { useEffect, useState } from 'react';
import { NAV_LINKS, EVENT } from '@/content/site';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/Logo';

/**
 * Sticky header.
 *
 * It starts as a full-width transparent bar over the hero and, once anything
 * scrolls underneath, contracts into a glass capsule floating clear of the top
 * edge. That is the redesign's thesis in one component: chrome that recedes
 * when it is not needed and gains elevation when it is, instead of a bar that
 * is either invisible or an opaque stripe.
 *
 * The CTA never leaves. On a single-event site every screen is a chance to
 * sell the one ticket.
 */
export function Header() {
  const pathname = usePathname();
  const [landed, setLanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollY, scrollYProgress } = useScroll();

  // Spring the raw ratio so the reading line eases instead of tracking every
  // wheel tick — bare scrollYProgress reads as jitter on trackpads.
  const progress = useSpring(scrollYProgress, { stiffness: 180, damping: 34, mass: 0.35 });

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setLanded(latest > 24);
  });

  // Route change closes the drawer; without this a back-navigation leaves it open.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock the page behind an open drawer so the body does not scroll under it.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  // Escape closes the sheet. A full-screen overlay that only a tap can dismiss
  // is a trap for anyone on a keyboard.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const isActive = (href: string) => {
    if (href.startsWith('/#')) return false;
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  };

  return (
    <>
      <motion.header
        initial={{ y: -72, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-[padding] duration-500',
          landed ? 'pt-3' : 'pt-0',
        )}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className={cn('transition-[padding] duration-500', landed ? 'px-3 sm:px-5' : 'px-0')}>
          <nav
            aria-label="Main"
            className={cn(
              'relative mx-auto flex items-center justify-between gap-3 transition-all duration-500',
              landed
                ? 'surface-glass h-[62px] max-w-[1120px] rounded-pill pl-5 pr-3'
                : 'h-[var(--header-h)] max-w-[1180px] bg-transparent px-[var(--rail)] shadow-none',
            )}
            style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <Link
              href="/"
              className="shrink-0 rounded-pill text-ink transition-opacity hover:opacity-70"
              aria-label="Houz of Vybe — home"
            >
              <Logo variant="inline" />
            </Link>

            {/* The nav itself is a track; the active item is a filled pill that
                slides between positions rather than a line that redraws. */}
            <ul className="hidden items-center gap-1 lg:flex">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative inline-flex rounded-pill px-4 py-2 text-[0.875rem] font-medium transition-colors duration-200',
                        active ? 'text-vybe-700' : 'text-slate hover:text-ink',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-pill"
                          className="absolute inset-0 rounded-pill bg-vybe-100"
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        />
                      )}
                      <span className="relative">{link.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center gap-2">
              <Link
                href="/events/offcampus#tickets"
                className="btn-primary hidden px-6 py-3 text-[0.875rem] sm:inline-flex"
              >
                Buy tickets
              </Link>

              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="mobile-nav"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                className="btn-icon lg:hidden"
              >
                <span className="relative block h-3 w-[18px]">
                  <span
                    className={cn(
                      'absolute left-0 h-[1.75px] w-[18px] rounded-pill bg-current transition-all duration-300',
                      menuOpen ? 'top-[5px] rotate-45' : 'top-0',
                    )}
                  />
                  <span
                    className={cn(
                      'absolute left-0 top-[5px] h-[1.75px] w-[18px] rounded-pill bg-current transition-all duration-200',
                      menuOpen && 'opacity-0',
                    )}
                  />
                  <span
                    className={cn(
                      'absolute left-0 h-[1.75px] w-[18px] rounded-pill bg-current transition-all duration-300',
                      menuOpen ? 'top-[5px] -rotate-45' : 'top-[10px]',
                    )}
                  />
                </span>
              </button>
            </div>

            {/* Reading position, drawn inside the capsule along its lower edge
                so it belongs to the chrome instead of floating under it. */}
            <motion.div
              aria-hidden
              style={{ scaleX: progress }}
              className={cn(
                'pointer-events-none absolute inset-x-6 bottom-[6px] h-[2px] origin-left rounded-pill bg-aurora-line transition-opacity duration-300',
                landed ? 'opacity-70' : 'opacity-0',
              )}
            />
          </nav>
        </div>
      </motion.header>

      {/* Mobile navigation, as a sheet that rises from the bottom — the half of
          the screen a thumb can actually reach. */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-ink/35 backdrop-blur-sm lg:hidden"
            />

            <motion.div
              id="mobile-nav"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-x-0 bottom-0 z-40 max-h-[86dvh] overflow-y-auto rounded-t-3xl bg-paper pb-8 shadow-loft lg:hidden"
            >
              <div className="sticky top-0 z-10 flex justify-center bg-paper pb-2 pt-3">
                <span aria-hidden className="h-1.5 w-11 rounded-pill bg-canvasDeep" />
              </div>

              <div className="px-[var(--rail)]">
                <ul className="flex flex-col">
                  {NAV_LINKS.map((link, index) => {
                    const active = isActive(link.href);
                    return (
                      <motion.li
                        key={link.href}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.06 + index * 0.035, duration: 0.3 }}
                      >
                        <Link
                          href={link.href}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex items-center justify-between rounded-lg px-4 py-3.5 font-display text-[1.375rem] font-medium tracking-[-0.025em] transition-colors',
                            active ? 'bg-vybe-50 text-vybe-700' : 'text-ink active:bg-frost',
                          )}
                        >
                          {link.label}
                          <svg
                            aria-hidden
                            viewBox="0 0 16 16"
                            className="h-4 w-4 text-muted"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m6 3 5 5-5 5" />
                          </svg>
                        </Link>
                      </motion.li>
                    );
                  })}
                </ul>

                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6"
                >
                  <Link href="/events/offcampus#tickets" className="btn-primary btn-lg w-full">
                    Buy tickets
                  </Link>
                  <p className="mt-4 text-center text-[0.8125rem] leading-relaxed text-muted">
                    {EVENT.dateLabel} · {EVENT.timeLabel}
                    <br />
                    {EVENT.venue.name}, {EVENT.venue.area}
                  </p>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
