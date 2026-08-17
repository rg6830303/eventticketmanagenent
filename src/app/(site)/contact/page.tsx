import type { Metadata } from 'next';
import { BRAND, VENUE } from '@/content/site';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ContactForm } from '@/components/contact/ContactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Get in touch with ${BRAND.name} — bookings, guest list, table reservations, press and partnerships in Hyderabad.`,
  alternates: { canonical: '/contact' },
};

const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(VENUE.mapsQuery)}`;

export default function ContactPage() {
  return (
    <div className="container-hov pb-24 pt-32 sm:pt-40">
      <SectionHeading
        eyebrow="Contact"
        title="Talk to a human."
        lede="Ticket problems, table bookings, press, or you want to play — this reaches the crew directly."
      />

      <div className="mt-14 grid gap-10 lg:grid-cols-[380px_1fr] lg:gap-16">
        <Reveal>
          <div className="space-y-8">
            <div>
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-vybe-300">
                Reach us
              </h2>
              <dl className="space-y-4 text-[14px]">
                <div>
                  <dt className="text-[12px] text-dim">Ticket support</dt>
                  <dd>
                    <a
                      href={`mailto:${BRAND.supportEmail}`}
                      className="text-chalk transition-colors hover:text-vybe-300"
                    >
                      {BRAND.supportEmail}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-dim">Everything else</dt>
                  <dd>
                    <a
                      href={`mailto:${BRAND.email}`}
                      className="text-chalk transition-colors hover:text-vybe-300"
                    >
                      {BRAND.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-dim">Phone</dt>
                  <dd>
                    <a
                      href={`tel:${BRAND.phone.replace(/\s/g, '')}`}
                      className="text-chalk transition-colors hover:text-vybe-300"
                    >
                      {BRAND.phone}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-vybe-300">
                Where we are
              </h2>
              <address className="not-italic text-[14px] leading-relaxed text-haze">
                <span className="block font-medium text-chalk">{VENUE.name}</span>
                {VENUE.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
                <span className="mt-1 block text-[12px] text-dim">{VENUE.landmark}</span>
              </address>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost mt-5 px-6 py-3 text-[12px]"
              >
                Get directions
              </a>
            </div>

            <div>
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-vybe-300">
                Follow
              </h2>
              <div className="flex flex-wrap gap-2">
                {BRAND.socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-hairline px-4 py-2 text-[12px] text-haze transition-colors hover:border-vybe-600 hover:text-chalk"
                  >
                    {social.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1} direction="left">
          <div className="card card-lit p-6 sm:p-8">
            <ContactForm />
          </div>
        </Reveal>
      </div>
    </div>
  );
}
