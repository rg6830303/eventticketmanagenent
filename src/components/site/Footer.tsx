import Link from 'next/link';
import { BRAND, EVENT, FOOTER_LINKS, PARTNER } from '@/content/site';
import { Logo } from '@/components/brand/Logo';

/**
 * Footer.
 *
 * Two parts with different jobs, and the redesign gives them different
 * materials so they stop competing. The last-chance CTA is a dark plate that
 * floats clear of the page — the only place outside the closing section where
 * the ink surface appears. The small print sits below it on the open ground,
 * unboxed, because navigation and legal links do not need a container.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto">
      {/* Last chance to sell the ticket, before the small print.

          Light, not dark. Several pages close on a dark plate of their own, and
          two of them stacked read as one long band with a seam through it. */}
      <div className="shell pb-16 pt-8">
        <div className="card-feature relative px-6 py-10 sm:px-10 sm:py-11">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 spotlight"
          />
          <div className="relative flex flex-col items-start gap-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Last call</p>
              <p className="mt-3 font-display text-[1.625rem] font-semibold tracking-[-0.03em] text-ink">
                {EVENT.name} <span className="accent gradient-text">{EVENT.edition}</span>
              </p>
              <p className="mt-2 text-[0.9375rem] text-slate">
                {EVENT.dateLabel} · {EVENT.timeLabel} · {EVENT.venue.name}, {EVENT.venue.area}
              </p>
            </div>
            <Link href="/book" className="btn-primary btn-lg shrink-0">
              Buy tickets
            </Link>
          </div>
        </div>
      </div>

      <div className="shell pb-14">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Logo variant="inline" className="text-ink" />
            <p className="mt-5 max-w-sm text-[0.9375rem] leading-relaxed text-slate">
              {BRAND.description}
            </p>
            <address className="mt-6 not-italic text-[0.875rem] leading-relaxed text-muted">
              <span className="block font-medium text-slate">{EVENT.venue.name}</span>
              {EVENT.venue.addressLines.join(', ')}
            </address>
            <p className="mt-4 text-[0.8125rem] text-muted">
              {PARTNER.role}: {PARTNER.name}
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {BRAND.socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 rounded-pill bg-paper px-4 py-2.5 text-[0.8125rem] font-semibold text-slate shadow-soft transition-[transform,color,box-shadow] duration-200 hover:-translate-y-[2px] hover:text-vybe-700 hover:shadow-raise"
                >
                  {social.label}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 12 12"
                    className="h-2.5 w-2.5 shrink-0 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 9 9 3" />
                    <path d="M4 3h5v5" />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {Object.entries(FOOTER_LINKS).map(([group, links]) => (
              <div key={group}>
                <p className="mb-4 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-vybe-700">
                  {group}
                </p>
                <ul className="space-y-3">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[0.875rem] text-slate transition-colors hover:text-vybe-700"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="rule my-10" />

        <div className="flex flex-col gap-4 text-[0.8125rem] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {BRAND.name}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a href={`mailto:${BRAND.email}`} className="transition-colors hover:text-ink">
              {BRAND.email}
            </a>
            {/* Credit line. Lives in the shared footer so it appears on every
                page of the site rather than being pasted per-page and drifting. */}
            <span>HIRE by Yella Narsimha Rajini</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
