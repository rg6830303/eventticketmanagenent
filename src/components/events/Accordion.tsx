'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

export interface AccordionItem {
  question: string;
  answer: string;
}

/**
 * Single-open accordion. Uses a real <button> per row so keyboard and screen
 * reader behaviour comes for free — a div with a click handler would need
 * roving tabindex and key handling reimplemented by hand.
 */
export function Accordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-hairline border-y border-hairline">
      {items.map((item, index) => {
        const expanded = open === index;
        return (
          <div key={item.question}>
            <h3>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : index)}
                aria-expanded={expanded}
                aria-controls={`faq-panel-${index}`}
                id={`faq-trigger-${index}`}
                className="flex w-full items-start justify-between gap-6 py-5 text-left"
              >
                <span className="text-[15px] font-medium text-chalk sm:text-base">
                  {item.question}
                </span>
                <span
                  aria-hidden
                  className={`mt-1 shrink-0 text-vybe-400 transition-transform duration-300 ${
                    expanded ? 'rotate-45' : ''
                  }`}
                >
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
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
                  <p className="pb-6 pr-10 text-[14px] leading-relaxed text-haze">{item.answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
