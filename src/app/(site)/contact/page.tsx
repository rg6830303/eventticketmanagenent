import type { Metadata } from 'next';
import { BRAND, VENUE } from '@/content/site';
import { Globe } from '@/components/brand/Globe';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ContactForm } from '@/components/contact/ContactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Get in touch with ${BRAND.name} — bookings, guest list, table reservations, press and partnerships in Hyderabad.`,
  alternates: { canonical: '/contact' },
};

const mapsUrl = VENUE.mapsUrl;

export default function ContactPage() {
  return (
    <div className="relative overflow-hidden pb-24 pt-32 sm:pt-40">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 gridfield fade-edges" />
        <div className="absolute left-[-8%] top-[-14%] h-[440px] w-[440px] rounded-full bg-vybe-600/15 blur-[140px]" />
        <Globe
          spin
          strokeWidth={0.8}
          className="absolute right-[-20%] top-[4%] h-[440px] w-[440px] text-vybe-500/[0.08] [animation-duration:115s] sm:h-[600px] sm:w-[600px]"
        />
      </div>

      <div className="shell">
        <SectionHeading
          kicker="Contact"
          title="Talk to a human."
          lede="Ticket problems, tables, press, or you want to play — this reaches the crew directly."
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-16">
          <Stagger className="space-y-4" amount={0.1}>
            <StaggerItem>
              <div className="card-print p-6">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.26em] text-vybe-600">
                  Reach us
                </h2>
                <dl className="mt-5 space-y-5 text-[14px]">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">
                      Ticket support
                    </dt>
                    <dd className="mt-1">
                      <a
                        href={`mailto:${BRAND.supportEmail}`}
                        className="break-all text-ink underline-offset-4 transition-colors hover:text-vybe-600 hover:underline"
                      >
                        {BRAND.supportEmail}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">
                      Everything else
                    </dt>
                    <dd className="mt-1">
                      <a
                        href={`mailto:${BRAND.email}`}
                        className="break-all text-ink underline-offset-4 transition-colors hover:text-vybe-600 hover:underline"
                      >
                        {BRAND.email}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">Phone</dt>
                    <dd className="mt-1">
                      <a
                        href={`tel:${BRAND.phone.replace(/\s/g, '')}`}
                        className="text-ink underline-offset-4 transition-colors hover:text-vybe-600 hover:underline"
                      >
                        {BRAND.phone}
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="card-print relative overflow-hidden p-6">
                <Globe
                  spin
                  strokeWidth={1.6}
                  className="pointer-events-none absolute -bottom-12 -right-10 h-40 w-40 text-vybe-500/10 [animation-duration:70s]"
                />
                <div className="relative">
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.26em] text-vybe-600">
                    Where we are
                  </h2>
                  <address className="mt-5 not-italic text-[14px] leading-relaxed text-slate">
                    <span className="block font-display text-base font-semibold text-ink">
                      {VENUE.name}
                    </span>
                    {VENUE.addressLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                    <span className="mt-1.5 block text-[12px] text-muted">{VENUE.landmark}</span>
                  </address>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline btn-sm mt-5 px-6 py-3 text-[12px]"
                  >
                    Get directions
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      className="h-3.5 w-3.5"
                      aria-hidden
                    >
                      <path d="M7 13L13 7M13 7H8M13 7v5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="card-print p-6">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.26em] text-vybe-600">
                  Follow
                </h2>
                <div className="mt-5 flex flex-wrap gap-2">
                  {BRAND.socials.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-edge px-4 py-2 text-[12px] text-slate transition-all duration-300 hover:-translate-y-0.5 hover:border-vybe-600 hover:text-ink"
                    >
                      {social.label}
                    </a>
                  ))}
                </div>
              </div>
            </StaggerItem>
          </Stagger>

          <Reveal delay={0.1} direction="left">
            <div className="card-print p-6 sm:p-8">
              <ContactForm />
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
