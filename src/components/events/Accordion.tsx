'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface AccordionItem {
  question: string;
  answer: string;
}

/**
 * Single-open accordion.
 *
 * Each row is its own plate rather than a line in a ruled list, and the open
 * one rises with a tinted edge — so on a long FAQ you can see where you are
 * from the shape of the page, not just from which answer is showing.
 *
 * Uses a real <button> per row so keyboard and screen reader behaviour comes
 * for free; a div with a click handler would need roving tabindex and key
 * handling reimplemented by hand.
 */
export function Accordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const expanded = open === index;
        return (
          <div
            key={item.question}
            className={cn(
              'overflow-hidden transition-shadow duration-300',
              expanded ? 'card-feature' : 'card-lift',
            )}
          >
            <h3>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : index)}
                aria-expanded={expanded}
                aria-controls={`faq-panel-${index}`}
                id={`faq-trigger-${index}`}
                className="group flex w-full items-start gap-4 px-5 py-5 text-left sm:gap-5 sm:px-7"
              >
                <span className="flex-1 font-display text-[1.0625rem] font-semibold leading-snug tracking-[-0.015em] text-ink transition-colors group-hover:text-vybe-700 sm:text-[1.125rem]">
                  {item.question}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'mt-px inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-pill transition-[transform,background-color,color] duration-300',
                    expanded
                      ? 'rotate-45 bg-vybe-500 text-white'
                      : 'bg-vybe-50 text-vybe-600 group-hover:bg-vybe-100',
                  )}
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
            </h3>

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  id={`faq-panel-${index}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${index}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-6 pr-10 text-[0.9375rem] leading-relaxed text-slate sm:px-7">
                    {item.answer}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
