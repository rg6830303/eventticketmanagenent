'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Globe } from '@/components/brand/Globe';
import { TileArt } from './TileArt';

export interface GalleryItem {
  id: number;
  caption: string;
  event: string;
  hue: number;
  span: string;
}

const SPAN: Record<string, string> = {
  tall: 'row-span-2',
  wide: 'col-span-2',
  normal: '',
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [active, setActive] = useState<GalleryItem | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const reduce = useReducedMotion();

  const close = useCallback(() => {
    setActive(null);
    // Return focus to the tile that opened the dialog, or the keyboard user is
    // dumped back at the top of the document.
    openerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!active) return;

    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
      // Only two focusable elements in the dialog, so the trap is just a bounce
      // back to the close button.
      if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [active, close]);

  return (
    <>
      <ul className="perspective grid auto-rows-[150px] grid-cols-2 gap-3 sm:auto-rows-[230px] sm:grid-cols-3 lg:auto-rows-[280px]">
        {items.map((item, index) => (
          <li key={item.id} className={cn('preserve-3d', SPAN[item.span] ?? '')}>
            <motion.button
              type="button"
              initial={
                reduce ? undefined : { opacity: 0, y: 40, rotateX: -14, scale: 0.94 }
              }
              whileInView={reduce ? undefined : { opacity: 1, y: 0, rotateX: 0, scale: 1 }}
              whileHover={reduce ? undefined : { y: -8, scale: 1.015 }}
              viewport={{ once: true, margin: '-70px' }}
              transition={{
                duration: 0.75,
                delay: (index % 3) * 0.09 + Math.floor(index / 3) * 0.04,
                ease: EASE,
              }}
              onClick={(event) => {
                openerRef.current = event.currentTarget;
                setActive(item);
              }}
              className="group relative block h-full w-full origin-bottom overflow-hidden rounded-2xl border border-edge text-left transition-[border-color,box-shadow] duration-500 hover:border-vybe-600 hover:shadow-azure focus-visible:border-vybe-500"
              aria-label={`${item.caption} — ${item.event}. Open larger view.`}
            >
              <TileArt
                hue={item.hue}
                seed={item.id}
                className="h-full w-full transition-transform ease-out [transition-duration:900ms] group-hover:scale-[1.09]"
              />

              {/* Sheen sweeps once on hover — reads as light passing over glass. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-vybe-200/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
              />

              <span
                aria-hidden
                className="absolute left-3 top-3 font-mono text-[10px] tracking-[0.2em] text-ink/45 transition-colors duration-300 group-hover:text-vybe-700"
              >
                {String(index + 1).padStart(2, '0')}
              </span>

              <span className="absolute inset-x-0 bottom-0 translate-y-3 bg-gradient-to-t from-canvas via-canvas/75 to-transparent p-3 opacity-0 transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 sm:p-4">
                <span className="block text-[12px] font-medium text-ink sm:text-[13px]">
                  {item.caption}
                </span>
                <span className="block text-[10px] text-muted sm:text-[11px]">{item.event}</span>
              </span>
            </motion.button>
          </li>
        ))}
      </ul>

      <AnimatePresence>
        {active && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${active.caption}, ${active.event}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={close}
            className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-canvas/95 p-5 backdrop-blur-xl"
          >
            <Globe
              spin
              strokeWidth={0.7}
              className="pointer-events-none absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 text-vybe-500/10 [animation-duration:120s]"
            />

            <motion.figure
              initial={{ scale: 0.94, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.36, ease: EASE }}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-3xl"
            >
              <div className="overflow-hidden rounded-2xl border border-edge shadow-azure-lg">
                <TileArt
                  hue={active.hue}
                  seed={active.id}
                  variant="detail"
                  className="aspect-[16/10] w-full"
                />
              </div>
              <figcaption className="mt-4 flex items-center justify-between gap-4">
                <span>
                  <span className="block font-display text-lg font-semibold text-ink">
                    {active.caption}
                  </span>
                  <span className="block text-[12px] text-muted">{active.event}</span>
                </span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={close}
                  className="btn-outline btn-sm px-5 py-2.5 text-[12px]"
                >
                  Close
                </button>
              </figcaption>
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
