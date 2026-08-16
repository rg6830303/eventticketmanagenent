import Link from 'next/link';
import { BRAND, FOOTER_LINKS, VENUE } from '@/content/site';
import { Logo } from './Logo';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-24 border-t border-hairline bg-ink/60">
      {/* Oversized wordmark bleeding off the bottom edge — the site's sign-off. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 select-none overflow-hidden opacity-[0.045]"
      >
        <p className="translate-y-[22%] whitespace-nowrap text-center font-display text-[18vw] font-extrabold leading-none tracking-tighter text-vybe-300">
          HOUZ OF VYBE
        </p>
      </div>

      <div className="container-hov relative py-16">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_2fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-haze">{BRAND.description}</p>
            <address className="mt-6 not-italic text-sm leading-relaxed text-dim">
              {VENUE.name}
              <br />
              {VENUE.addressLines.join(', ')}
            </address>
            <div className="mt-5 flex flex-wrap gap-3">
              {BRAND.socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-hairline px-4 py-2 text-xs font-medium text-haze transition-colors hover:border-vybe-600 hover:text-chalk"
                >
                  {social.label}
                </a>
              ))}
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {Object.entries(FOOTER_LINKS).map(([group, links]) => (
              <div key={group}>
                <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-vybe-300">
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
