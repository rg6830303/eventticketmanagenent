import Link from 'next/link';
import { BRAND, FOOTER_LINKS, VENUE } from '@/content/site';
import { Logo } from '@/components/brand/Logo';
import { Globe } from '@/components/brand/Globe';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-24 overflow-hidden border-t border-hairline bg-ink/60">
      {/* The mark itself as the sign-off, turning slowly under the content.
          Absolutely positioned inside a clipped box so it can never add height
          or push the grid around at any width. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 select-none overflow-hidden">
        <div className="absolute left-1/2 top-1/2 aspect-square w-[min(140vw,900px)] -translate-x-1/2 -translate-y-[42%]">
          <Globe spin strokeWidth={1.6} className="h-full w-full text-flare/[0.055]" />
        </div>
      </div>

      <div className="container-hov relative py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_2fr]">
          <div>
            <Logo variant="inline" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-haze">{BRAND.description}</p>
            <address className="mt-6 not-italic text-sm leading-relaxed text-dim">
              <span className="block font-medium text-haze">{VENUE.name}</span>
              {VENUE.addressLines.join(', ')}
            </address>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {BRAND.socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-xs font-medium text-haze transition-colors hover:border-vybe-600 hover:bg-vybe-500/10 hover:text-chalk"
                >
                  {social.label}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 12 12"
                    className="h-2.5 w-2.5 shrink-0 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
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
                <p className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-vybe-300">
                  <span aria-hidden="true" className="h-px w-4 bg-vybe-500/50" />
                  {group}
                </p>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-haze transition-colors hover:text-chalk"
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

        <div className="divider my-10" />

        <div className="flex flex-col gap-4 text-xs text-dim sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {BRAND.name}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href={`mailto:${BRAND.email}`} className="transition-colors hover:text-chalk">
              {BRAND.email}
            </a>
            <Link href="/admin" className="transition-colors hover:text-chalk">
              Staff login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
