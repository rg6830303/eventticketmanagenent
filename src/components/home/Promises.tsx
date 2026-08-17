import type { ReactNode } from 'react';
import { PROMISES } from '@/content/site';
import { Stagger, StaggerItem } from '@/components/ui/Reveal';

/**
 * One drawn glyph per promise, in content order. Kept as raw paths rather than
 * an icon package: the site's CSP blocks external hosts, and four shapes are
 * not worth a dependency.
 */
const GLYPHS: ReactNode[] = [
  // Delivery — envelope with a clock on the corner.
  <>
    <path d="M3 7.6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4.1" />
    <path d="M3 8l7.1 4.6a2 2 0 0 0 2.2 0L19 8" />
    <path d="M3 11.6v4.8a2 2 0 0 0 2 2h6.2" />
    <circle cx="17.5" cy="17.5" r="3.9" />
    <path d="M17.5 15.7v1.9l1.4.9" />
  </>,
  // Capacity — a fill that stops dead at a hard cap.
  <>
    <rect x="2.6" y="8.8" width="18.8" height="6.4" rx="3.2" />
    <path d="M6 12h7.4" strokeWidth="3" opacity="0.5" />
    <path d="M16.6 5.6v12.8" />
  </>,
  // Signed pass — shield around a lock.
  <>
    <path d="M12 2.8 19.2 5.4v5.3c0 4.3-2.9 7.6-7.2 9.5-4.3-1.9-7.2-5.2-7.2-9.5V5.4z" />
    <rect x="9.5" y="11.6" width="5" height="4.2" rx="1" />
    <path d="M10.6 11.6v-1.3a1.4 1.4 0 0 1 2.8 0v1.3" />
  </>,
  // Refund — money returning along a loop.
  <>
    <path d="M20.4 12a8.4 8.4 0 1 1-2.6-6.1" />
    <path d="M17.4 2.1l.7 3.9-3.9.8" />
    <path d="M9.6 9h4.8" />
    <path d="M9.6 11.2h4.8" />
    <path d="M9.6 9c2.7 0 3.5 1 3.5 2.2s-.9 2.2-3.5 2.2l3.9 3.6" />
  </>,
];

function Glyph({ index }: { index: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.35}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      {GLYPHS[index % GLYPHS.length]}
    </svg>
  );
}

export function Promises() {
  return (
    <Stagger className="mt-12 grid gap-5 md:grid-cols-2">
      {PROMISES.map((promise, index) => (
        <StaggerItem key={promise.title} className="h-full">
          <article className="card card-lit group h-full p-7 transition-transform duration-300 hover:-translate-y-1 sm:p-8">
            <div className="flex items-start gap-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-vybe-500/30 bg-vybe-500/10 text-vybe-200 transition-colors duration-300 group-hover:border-vybe-400/70 group-hover:text-pulse-300">
                <Glyph index={index} />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold leading-snug text-chalk">
                  {promise.title}
                </h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-haze">{promise.copy}</p>
              </div>
            </div>
          </article>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
