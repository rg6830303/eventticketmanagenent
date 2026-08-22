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
 * Transparent over the hero, then it lands on a solid surface once anything is
 * scrolling underneath it — a permanently frosted bar over a white page is just
 * a grey stripe. The CTA is always visible: on a single-event site, every
 * screen is a chance to sell the one ticket.
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
          'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow] duration-300',
          landed
            ? 'border-b-2 border-ink bg-paper/95 backdrop-blur-md'
            : 'border-b-2 border-transparent bg-transparent',
        )}
      >
        <nav
          className={cn(
            'shell flex items-center justify-between gap-4 transition-[height] duration-300',
            landed ? 'h-[62px]' : 'h-[78px]',
          )}
          aria-label="Main"
        >
          <Link
            href="/"
            className="shrink-0 rounded-xl text-ink transition-opacity hover:opacity-80"
            aria-label="Houz of Vybe — home"
          >
            <Logo variant="inline" />
          </Link>

          <ul className="hidden items-center gap-0.5 lg:flex">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative rounded-lg px-3.5 py-2 text-[0.875rem] font-medium transition-colors',
                      active ? 'text-ink' : 'text-slate hover:text-ink',
                    )}
                  >
                    {/* Shared layoutId slides the underline between links rather
                        than cross-fading two separate ones. */}
                    {active && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-vybe-500"
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
              className="btn-primary hidden py-3 text-[0.875rem] sm:inline-flex"
            >
              Buy tickets
            </Link>
            <Link href="/cart" className="btn-outline hidden py-3 text-[0.875rem] sm:inline-flex">
              Cart
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="flex h-11 w-11 items-center justify-center rounded-[10px] border-[1.5px] border-ink bg-paper text-ink shadow-press-sm transition-transform hover:-translate-y-[1px] lg:hidden"
            >
              <span className="relative block h-3 w-[18px]">
                <span
                  className={cn(
                    'absolute left-0 h-[1.75px] w-[18px] rounded-full bg-current transition-all duration-300',
                    menuOpen ? 'top-[5px] rotate-45' : 'top-0',
                  )}
                />
                <span
                  className={cn(
                    'absolute left-0 top-[5px] h-[1.75px] w-[18px] rounded-full bg-current transition-all duration-200',
                    menuOpen && 'opacity-0',
                  )}
                />
                <span
                  className={cn(
                    'absolute left-0 h-[1.75px] w-[18px] rounded-full bg-current transition-all duration-300',
                    menuOpen ? 'top-[5px] -rotate-45' : 'top-[10px]',
                  )}
                />
              </span>
            </button>
          </div>
        </nav>

        {/* Reading position along the bottom edge. Driven by scroll, so it holds
            still for anyone who has asked for reduced motion. */}
        <motion.div
          aria-hidden
          style={{ scaleX: progress }}
          className={cn(
            'absolute inset-x-0 -bottom-[2px] h-[2px] origin-left bg-vybe-500 transition-opacity duration-300',
            landed ? 'opacity-100' : 'opacity-0',
          )}
        />
      </motion.header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-nav"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40 overflow-y-auto bg-canvas/95 backdrop-blur-2xl lg:hidden"
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 halftone opacity-30" />

            <div className="shell relative flex min-h-full flex-col pb-10 pt-24">
              <ul className="flex flex-col">
                {NAV_LINKS.map((link, index) => {
                  const active = isActive(link.href);
                  return (
                    <motion.li
                      key={link.href}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 + index * 0.045, duration: 0.35 }}
                    >
                      <Link
                        href={link.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-baseline justify-between border-b border-edge py-4 font-display text-[1.75rem] font-semibold tracking-[-0.03em] transition-colors',
                          active ? 'text-vybe-600' : 'text-ink',
                        )}
                      >
                        {link.label}
                        <span className="font-mono text-[0.6875rem] text-muted">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 }}
                className="mt-8"
              >
                <Link href="/events/offcampus#tickets" className="btn-primary w-full">
                  Buy tickets
                </Link>
                <p className="mt-4 text-center text-[0.8125rem] text-slate">
                  {EVENT.dateLabel} · {EVENT.timeLabel}
                  <br />
                  {EVENT.venue.name}, {EVENT.venue.area}
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

