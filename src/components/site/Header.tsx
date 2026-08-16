'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { useEffect, useState } from 'react';
import { NAV_LINKS } from '@/content/site';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';

/**
 * Sticky header.
 *
 * It condenses after ~40px of scroll rather than at 0, so the hero keeps its
 * full-bleed look while the bar is still translucent, then firms up into a
 * readable surface once content is behind it.
 */
export function Header() {
  const pathname = usePathname();
  const [condensed, setCondensed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setCondensed(latest > 40);
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

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-300',
          condensed
            ? 'border-b border-hairline/80 bg-void/80 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <nav className="container-hov flex h-[68px] items-center justify-between gap-4" aria-label="Main">
          <Link href="/" className="shrink-0" aria-label="Houz of Vybe — home">
            <Logo />
          </Link>

          <ul className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => {
              const active =
                link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative rounded-full px-4 py-2 text-sm font-medium transition-colors',
                      active ? 'text-chalk' : 'text-haze hover:text-chalk',
                    )}
                  >
                    {/* Shared layoutId slides the pill between links instead of
                        cross-fading two separate backgrounds. */}
                    {active && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-full border border-vybe-500/30 bg-vybe-500/10"
                        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                      />
                    )}
                    <span className="relative">{link.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2">
            <Link href="/book" className="btn-primary hidden px-6 py-2.5 text-[13px] sm:inline-flex">
              Book tickets
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline text-chalk lg:hidden"
            >
              <span className="relative block h-3.5 w-5">
                <span
                  className={cn(
                    'absolute left-0 h-[1.5px] w-5 bg-current transition-all duration-300',
                    menuOpen ? 'top-1.5 rotate-45' : 'top-0',
                  )}
                />
                <span
                  className={cn(
                    'absolute left-0 top-1.5 h-[1.5px] w-5 bg-current transition-all duration-200',
                    menuOpen && 'opacity-0',
                  )}
                />
                <span
                  className={cn(
                    'absolute left-0 h-[1.5px] w-5 bg-current transition-all duration-300',
                    menuOpen ? 'top-1.5 -rotate-45' : 'top-3',
                  )}
                />
              </span>
            </button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-nav"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-void/95 backdrop-blur-2xl lg:hidden"
          >
            <div className="container-hov flex h-full flex-col pt-24">
              <ul className="flex flex-col gap-1">
                {NAV_LINKS.map((link, index) => (
                  <motion.li
                    key={link.href}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + index * 0.05, duration: 0.4 }}
                  >
                    <Link
                      href={link.href}
                      className="block border-b border-hairline/60 py-4 font-display text-2xl font-semibold text-chalk"
                    >
                      {link.label}
                    </Link>
                  </motion.li>
                ))}
              </ul>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-8"
              >
                <Link href="/book" className="btn-primary w-full">
                  Book tickets
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
