'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { TileArt } from './TileArt';

export interface GalleryItem {
  id: number;
  caption: string;
  event: string;
  hue: number;
  span: string;
}

const SPAN: Record<string, string> = {
  tall: 'sm:row-span-2',
  wide: 'sm:col-span-2',
  normal: '',
};

export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [active, setActive] = useState<GalleryItem | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

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
      <div className="mt-14 grid auto-rows-[220px] grid-cols-1 gap-3 sm:grid-cols-3 lg:auto-rows-[260px]">
        {items.map((item, index) => (
          <motion.button
            key={item.id}
            type="button"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: (index % 6) * 0.06, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => {
              openerRef.current = event.currentTarget;
              setActive(item);
            }}
            className={cn(
              'group relative overflow-hidden rounded-2xl border border-hairline text-left',
              SPAN[item.span] ?? '',
            )}
            aria-label={`${item.caption} — ${item.event}. Open larger view.`}
          >
            <TileArt
              hue={item.hue}
              seed={item.id}
              className="h-full w-full transition-transform duration-700 group-hover:scale-[1.06]"
            />
            <span className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-void via-void/70 to-transparent p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
              <span className="block text-[13px] font-medium text-chalk">{item.caption}</span>
              <span className="block text-[11px] text-dim">{item.event}</span>
            </span>
          </motion.button>
        ))}
      </div>

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
            className="fixed inset-0 z-[60] flex items-center justify-center bg-void/92 p-5 backdrop-blur-xl"
          >
            <motion.figure
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-3xl"
            >
              <div className="overflow-hidden rounded-2xl border border-hairline">
                <TileArt hue={active.hue} seed={active.id} variant="detail" className="aspect-[16/10] w-full" />
              </div>
              <figcaption className="mt-4 flex items-center justify-between gap-4">
                <span>
                  <span className="block font-display text-lg font-semibold text-chalk">
                    {active.caption}
                  </span>
                  <span className="block text-[12px] text-dim">{active.event}</span>
                </span>
                <button ref={closeRef} type="button" onClick={close} className="btn-ghost px-5 py-2.5 text-[12px]">
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
