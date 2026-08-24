import Link from 'next/link';
import { BRAND, EVENT, FOOTER_LINKS, PARTNER } from '@/content/site';
import { Logo } from '@/components/brand/Logo';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto border-t-2 border-ink bg-frost">
      {/* Last chance to sell the ticket, before the small print. */}
      <div className="relative overflow-hidden border-b-2 border-ink bg-vybe-100">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 halftone opacity-50"
        />
        <div className="shell relative flex flex-col items-start gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-[1.5rem] font-semibold tracking-[-0.03em] text-ink">
              {EVENT.name} <span className="accent text-vybe-600">{EVENT.edition}</span>
            </p>
            <p className="mt-1 text-[0.9375rem] text-slate">
              {EVENT.dateLabel} · {EVENT.timeLabel} · {EVENT.venue.name}, {EVENT.venue.area}
            </p>
          </div>
          <Link href="/book" className="btn-primary shrink-0">
            Buy tickets
          </Link>
        </div>
      </div>

      <div className="shell py-14 lg:py-16">
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
                  className="group inline-flex items-center gap-2 rounded-xl border border-edge px-4 py-2.5 text-[0.8125rem] font-medium text-slate transition-colors hover:border-vybe-400 hover:bg-vybe-50 hover:text-vybe-700"
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
                <p className="mb-4 text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink">
                  {group}
                </p>
                <ul className="space-y-3">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[0.875rem] text-slate transition-colors hover:text-vybe-600"
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
          </div>
        </div>
      </div>
    </footer>
  );
}
