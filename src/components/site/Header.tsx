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
import { NAV_LINKS } from '@/content/site';
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
export interface HeaderProps {
  /** First name of the signed-in customer, or null. */
  customerName: string | null;
  /** Where "Buy tickets" goes: the featured event's ticket section. */
  buyHref: string;
  /** One-line summary of the featured event for the mobile menu. */
  featuredLine: string | null;
}

export function Header({ customerName, buyHref, featuredLine }: HeaderProps) {
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

  // Close the instant a link is tapped, not when the next page finishes
  // rendering — a slow server render otherwise leaves the drawer hanging.
  const close = () => setMenuOpen(false);

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
            ? 'border-b border-edge bg-canvas/85 backdrop-blur-md'
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
                      'relative rounded-lg px-3.5 py-2 text-[0.875rem] font-normal transition-colors',
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
              href={buyHref}
              className="btn-primary px-4 py-2.5 text-[0.8125rem] sm:px-6 sm:py-3 sm:text-[0.875rem]"
            >
              Buy tickets
            </Link>
            <Link
              href={customerName ? '/account' : '/login'}
              className="btn-outline hidden py-3 text-[0.875rem] sm:inline-flex"
            >
              {customerName ? `Hi, ${customerName}` : 'Sign in'}
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="flex h-11 w-11 items-center justify-center rounded-[10px] border-[1.5px] border-edgeStrong bg-paper text-ink shadow-press-sm transition-transform hover:-translate-y-[1px] lg:hidden"
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
          <>
            <motion.button
              key="scrim"
              type="button"
              aria-label="Close menu"
              onClick={close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-canvas-deep/70 backdrop-blur-sm lg:hidden"
            />
            <motion.nav
              key="drawer"
              id="mobile-nav"
              aria-label="Menu"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
              className="fixed inset-y-0 right-0 z-[61] flex w-[min(82vw,320px)] flex-col overflow-y-auto border-l border-edge bg-canvas/95 px-5 pb-6 pt-4 shadow-[-20px_0_60px_rgb(0_0_0/0.5)] backdrop-blur-xl lg:hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-[0.8125rem] font-semibold text-muted">Menu</span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close menu"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-edgeStrong text-ink transition-colors hover:bg-ink/10"
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M3 3l10 10M13 3L3 13" />
                  </svg>
                </button>
              </div>

              <ul className="mt-4 flex flex-col">
                {NAV_LINKS.map((link, index) => {
                  const active = isActive(link.href);
                  return (
                    <motion.li
                      key={link.href}
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.03 + index * 0.035, duration: 0.25 }}
                    >
                      <Link
                        href={link.href}
                        onClick={close}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center justify-between rounded-xl px-3 py-3 text-[1.0625rem] font-semibold transition-colors',
                          active ? 'bg-vybe-100 text-vybe-700' : 'text-ink hover:bg-ink/5',
                        )}
                      >
                        {link.label}
                        <span aria-hidden className={cn('text-sm', active ? 'text-vybe-600' : 'text-muted')}>›</span>
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>

              <div className="mt-auto space-y-2.5 pt-6">
                <Link href={buyHref} onClick={close} className="btn-primary w-full py-3.5">
                  Buy tickets
                </Link>
                <div className="grid grid-cols-2 gap-2.5">
                  <Link href={customerName ? '/account' : '/login'} onClick={close} className="btn-outline btn-sm w-full">
                    {customerName ? 'My tickets' : 'Sign in'}
                  </Link>
                  <Link href={customerName ? '/cart' : '/signup'} onClick={close} className="btn-outline btn-sm w-full">
                    {customerName ? 'Cart' : 'Sign up'}
                  </Link>
                </div>
                {featuredLine && <p className="pt-1 text-center text-[0.75rem] text-muted">{featuredLine}</p>}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

