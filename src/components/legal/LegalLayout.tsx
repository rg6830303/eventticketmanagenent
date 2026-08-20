'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Globe } from '@/components/brand/Globe';

export interface LegalSection {
  /** Anchor id — also the fragment other pages link to. */
  id: string;
  title: string;
  body: ReactNode;
}

interface LegalLayoutProps {
  kicker: string;
  title: string;
  lede: string;
  lastUpdated: string;
  sections: LegalSection[];
  /** Rendered under the last section — usually a contact or grievance block. */
  footnote?: ReactNode;
  /** Own href, so the cross-document links can mark this page as the current one. */
  current?: string;
}

const LEGAL_DOCS = [
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/refunds', label: 'Refunds' },
] as const;

/**
 * The project has no @tailwindcss/typography, so prose rules are declared once
 * here as child selectors. Pages then write plain semantic HTML and inherit the
 * rhythm instead of decorating every paragraph.
 */
const PROSE = cn(
  'text-[15px] leading-[1.8] text-slate',
  '[&_p]:mt-4 [&_p:first-child]:mt-0',
  '[&_strong]:font-semibold [&_strong]:text-ink',
  '[&_h3]:mt-9 [&_h3]:mb-3 [&_h3]:font-display [&_h3]:text-[17px] [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-ink',
  '[&_h4]:mt-6 [&_h4]:mb-2 [&_h4]:text-[15px] [&_h4]:font-semibold [&_h4]:text-ink',
  '[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2.5 [&_ul]:pl-5',
  '[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2.5 [&_ol]:pl-5',
  '[&_li]:pl-1.5 [&_li]:marker:text-vybe-500',
  '[&_li_ul]:mt-2.5 [&_li_ul]:space-y-1.5',
  '[&_a]:font-medium [&_a]:text-vybe-700 [&_a]:underline [&_a]:decoration-vybe-500/50 [&_a]:underline-offset-4',
  '[&_a:hover]:text-vybe-700 [&_a:hover]:decoration-vybe-400',
  '[&_dl]:mt-4 [&_dl]:space-y-3',
  '[&_dt]:font-semibold [&_dt]:text-ink',
  '[&_dd]:mt-1 [&_dd]:text-slate',
  '[&_code]:rounded [&_code]:bg-mist [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-pulse-600',
  '[&_address]:not-italic',
);

/** Boxed aside for grievance details, statutory notes and hard warnings. */
export function LegalCallout({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('panel shadow-mid mt-6 border-vybe-500/25 bg-vybe-950/40 p-5 sm:p-6', className)}>
      <p className="mb-3 font-display text-[15px] font-semibold text-vybe-700">{title}</p>
      <div className={cn(PROSE, 'text-[14px]')}>{children}</div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 shrink-0 text-vybe-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2.75 4.5 5.9v5.5c0 4.5 3.1 8.2 7.5 9.85 4.4-1.65 7.5-5.35 7.5-9.85V5.9Z" />
      <path d="M12 8.5v4.25" />
      <path d="M12 16.1h.01" />
    </svg>
  );
}

export function LegalLayout({
  kicker,
  title,
  lede,
  lastUpdated,
  sections,
  footnote,
  current,
}: LegalLayoutProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '');
  const [progress, setProgress] = useState(0);
  const articleRef = useRef<HTMLDivElement>(null);

  // Joined ids give the effect a stable primitive dependency; the `sections`
  // array itself is a fresh object on every render.
  const idKey = sections.map((s) => s.id).join('|');

  useEffect(() => {
    const ids = idKey.split('|').filter(Boolean);
    if (ids.length === 0) return;

    let frame = 0;

    const measure = () => {
      frame = 0;

      // The line sits below the sticky header, so the highlighted entry is the
      // heading the reader actually has in front of them, not the one above it.
      let current = ids[0] as string;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 168) current = id;
      }
      // The final section's heading may never cross the line on a short page.
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 12) {
        current = ids[ids.length - 1] as string;
      }
      setActiveId((prev) => (prev === current ? prev : current));

      const article = articleRef.current;
      if (article) {
        const rect = article.getBoundingClientRect();
        const start = rect.top + window.scrollY;
        const end = start + rect.height - window.innerHeight;
        const ratio = end > start ? (window.scrollY - start) / (end - start) : 1;
        const clamped = Math.min(1, Math.max(0, ratio));
        setProgress((prev) => (Math.abs(prev - clamped) < 0.004 ? prev : clamped));
      }
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [idKey]);

  return (
    <div className="relative overflow-hidden">
      {/* Receding grid plane — the depth cue that keeps a wall of text from
          reading as a bare document. */}
      <div
        aria-hidden="true"
        className="perspective pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden"
      >
        <div
          className="gridfield fade-edges absolute -inset-x-[60%] top-[42%] h-[560px] opacity-70"
          style={{ transform: 'rotateX(74deg)' }}
        />
        <div className="absolute inset-0 dotfield opacity-70" />
        {/* The mark, sized to the header block and turning behind it. */}
        <div className="absolute -right-32 -top-40 aspect-square w-[min(90vw,620px)] sm:-right-24">
          <Globe spin strokeWidth={1.5} className="h-full w-full text-vybe-500/[0.08]" />
        </div>
      </div>

      <div className="shell relative pb-24 pt-16 sm:pt-24 lg:pb-32">
        <header className="max-w-3xl">
          <p className="kicker mb-4 flex items-center gap-2.5">
            <span aria-hidden="true" className="h-px w-6 bg-vybe-500/60" />
            {kicker}
          </p>
          <h1 className="h-section">{title}</h1>
          <p className="lede mt-5 max-w-2xl">{lede}</p>
          <p className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] uppercase tracking-[0.18em] text-muted">
            <span>Last updated</span>
            <span aria-hidden="true" className="h-3 w-px bg-edge" />
            <span className="text-slate">{lastUpdated}</span>
            <span aria-hidden="true" className="h-3 w-px bg-edge" />
            <span>
              {sections.length} section{sections.length === 1 ? '' : 's'}
            </span>
          </p>
        </header>

        <div
          role="note"
          className="panel shadow-mid mt-10 flex items-start gap-4 border-vybe-500/30 bg-vybe-950/50 p-5 sm:p-6"
        >
          <ShieldIcon />
          <div>
            <p className="font-display text-[15px] font-semibold text-ink">
              This document is a template, not legal advice.
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-slate">
              It was drafted as a starting point for an events business operating in Hyderabad,
              Telangana, and has <strong className="font-semibold text-ink">not</strong> been
              reviewed by a qualified advocate. Have a lawyer check and adapt it — including the
              company details, statutory references and dispute clauses — before this site takes a
              single live booking.
            </p>
          </div>
        </div>

        <div className="mt-14 grid gap-12 lg:mt-16 lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-16">
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-28 max-h-[calc(100dvh-9rem)] overflow-y-auto pr-1">
              <p className="kicker mb-5">On this page</p>
              <div className="relative pl-5">
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1 h-[calc(100%-0.5rem)] w-px bg-edge"
                />
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1 w-px bg-gradient-to-b from-vybe-400 to-pulse-400"
                  style={{ height: `calc(${(progress * 100).toFixed(2)}% - 0.5rem * ${progress})` }}
                />
                <ol className="space-y-0.5">
                  {sections.map((section, index) => {
                    const active = section.id === activeId;
                    return (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          aria-current={active ? 'location' : undefined}
                          className={cn(
                            'flex gap-2.5 rounded-lg px-2.5 py-2 text-[13px] leading-snug transition-colors',
                            active
                              ? 'bg-vybe-500/10 text-ink'
                              : 'text-muted hover:bg-white/[0.03] hover:text-slate',
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              'font-mono text-[11px] tabular-nums',
                              active ? 'text-vybe-600' : 'text-muted/70',
                            )}
                          >
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span>{section.title}</span>
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </nav>

          <div>
            <details className="panel mb-10 rounded-2xl px-5 py-4 lg:hidden">
              <summary className="cursor-pointer list-none font-display text-sm font-semibold text-ink marker:hidden">
                <span className="flex items-center justify-between gap-3">
                  On this page
                  <span className="font-mono text-[11px] font-normal text-muted">
                    {sections.length} sections
                  </span>
                </span>
              </summary>
              <ol className="mt-4 space-y-2 border-t border-edge pt-4">
                {sections.map((section, index) => (
                  <li key={section.id} className="flex gap-2.5 text-[14px]">
                    <span aria-hidden="true" className="font-mono text-[11px] text-vybe-400">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <a href={`#${section.id}`} className="text-slate hover:text-ink">
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </details>

            <div ref={articleRef} className="max-w-[68ch]">
              {sections.map((section, index) => (
                <section
                  key={section.id}
                  className="scroll-mt-32 border-t border-edge py-10 first:border-t-0 first:pt-0 sm:py-12"
                >
                  <h2
                    id={section.id}
                    className="mb-6 flex scroll-mt-32 items-start gap-3.5 font-display text-xl font-semibold tracking-tight text-ink sm:text-[26px]"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-vybe-500/25 bg-vybe-500/10 font-mono text-[11px] font-medium tabular-nums text-vybe-600"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0">{section.title}</span>
                  </h2>
                  <div className={PROSE}>{section.body}</div>
                </section>
              ))}

              {footnote && <div className="mt-4 border-t border-edge pt-10">{footnote}</div>}

              <div className="rule mt-14" />
              <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
                The rest of the paperwork
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {LEGAL_DOCS.map((doc) => {
                  const active = doc.href === current;
                  return (
                    <Link
                      key={doc.href}
                      href={doc.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'btn-outline btn-sm',
                        active && 'border-vybe-500/45 bg-vybe-500/10 text-ink',
                      )}
                    >
                      {doc.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LegalLayout;
