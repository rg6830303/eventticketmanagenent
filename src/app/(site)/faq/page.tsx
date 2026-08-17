import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND, OFFCAMPUS } from '@/content/site';
import { Globe } from '@/components/brand/Globe';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Reveal } from '@/components/ui/Reveal';
import { Accordion } from '@/components/events/Accordion';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'How QR ticketing works at Houz of Vybe — delivery, entry, ID, transfers, refunds and group bookings.',
  alternates: { canonical: '/faq' },
};

/** Platform-level questions, kept separate from the per-event ones. */
const PLATFORM_FAQS = [
  {
    q: 'Do I have to pay anything right now?',
    a: 'No. Card payments are not switched on yet, so booking is free of charge. You give us a name, a working email and a mobile number, and your tickets are issued immediately at no cost. When online payment goes live, this page will say so and the amount will be shown before you confirm.',
  },
  {
    q: 'How does the QR ticket actually work?',
    a: 'Every ticket carries a unique code plus a cryptographic signature. Our scanner checks that signature before it even looks the ticket up, so a screenshotted, edited or invented QR fails immediately. Once a pass is scanned it is marked used in the same instant, which is why the same QR cannot get a second person in — even at a different door, at the same moment.',
  },
  {
    q: 'The email never arrived. What do I do?',
    a: 'First check spam and your Promotions tab. If it is genuinely not there, open your booking confirmation page — the link is the one you landed on right after booking, and it looks like /booking/HOV-XXXXXX — and hit "Resend email". If it still does not arrive, the address may have a typo; contact us with your booking reference and we will reissue it to a corrected address.',
  },
  {
    q: 'Can I book for a group?',
    a: 'You can book up to six tickets in one go, and you will get six separate QR passes in the same email — hand one to each person. For anything larger, or for a table, contact us directly and we will set it up.',
  },
  {
    q: 'What happens to my personal details?',
    a: 'We collect your name, email and phone number for one purpose: issuing and delivering your ticket, and reaching you if the event changes. We do not sell data and we do not run advertising trackers on this site. The full detail is in our privacy policy.',
  },
  {
    q: 'Do I need to create an account?',
    a: 'No. There is no sign-up, no password and no app. Your booking reference and the QR in your inbox are all you need.',
  },
] as const;

export default function FaqPage() {
  const all = [
    ...PLATFORM_FAQS.map((f) => ({ question: f.q, answer: f.a })),
    ...OFFCAMPUS.faqs.map((f) => ({ question: f.q, answer: f.a })),
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: all.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <div className="relative overflow-hidden pb-24 pt-32 sm:pt-40">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* The mark, used as the page's ground texture. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 grid-overlay" />
        <Globe
          spin
          strokeWidth={0.7}
          className="absolute left-1/2 top-[8%] h-[560px] w-[560px] -translate-x-1/2 text-vybe-500/[0.07] [animation-duration:130s] sm:h-[760px] sm:w-[760px]"
        />
        <Globe
          spin
          strokeWidth={0.9}
          className="absolute right-[-22%] bottom-[6%] hidden h-[420px] w-[420px] text-pulse-400/[0.05] [animation-direction:reverse] [animation-duration:95s] lg:block"
        />
      </div>

      <div className="container-hov">
        <SectionHeading
          eyebrow="FAQ"
          title="Everything about tickets, entry and the door."
          lede={`${all.length} answers, written plainly. If yours is not here, ask — we reply within a working day.`}
        />

        <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">
          <div className="space-y-14">
            <section aria-labelledby="faq-platform">
              <div className="mb-6 flex items-center gap-4">
                <h2
                  id="faq-platform"
                  className="font-display text-lg font-semibold text-chalk"
                >
                  Tickets &amp; booking
                </h2>
                <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-vybe-600/50 to-transparent" />
                <span className="font-mono text-[11px] text-dim">
                  {String(PLATFORM_FAQS.length).padStart(2, '0')}
                </span>
              </div>
              <Accordion items={PLATFORM_FAQS.map((f) => ({ question: f.q, answer: f.a }))} />
            </section>

            <section aria-labelledby="faq-night">
              <div className="mb-6 flex items-center gap-4">
                <h2 id="faq-night" className="font-display text-lg font-semibold text-chalk">
                  On the night
                </h2>
                <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-vybe-600/50 to-transparent" />
                <span className="font-mono text-[11px] text-dim">
                  {String(OFFCAMPUS.faqs.length).padStart(2, '0')}
                </span>
              </div>
              <Accordion items={OFFCAMPUS.faqs.map((f) => ({ question: f.q, answer: f.a }))} />
            </section>
          </div>

          <Reveal delay={0.1} direction="left" className="lg:sticky lg:top-28 lg:h-fit">
            <aside className="card card-lit relative overflow-hidden p-6">
              <Globe
                spin
                strokeWidth={1.4}
                className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 text-flare/12 [animation-duration:60s]"
              />
              <div className="relative">
                <h2 className="font-display text-lg font-semibold text-chalk">Still stuck?</h2>
                <p className="mt-2.5 text-[13px] leading-relaxed text-haze">
                  Send your booking reference and what went wrong. A human reads every message and
                  replies within one working day.
                </p>
                <Link href="/contact" className="btn-primary mt-6 w-full py-3 text-[13px]">
                  Contact us
                </Link>
                <Link href="/book" className="btn-ghost mt-2.5 w-full py-3 text-[13px]">
                  Book tickets
                </Link>
                <div className="divider my-6" />
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-dim">
                  Ticket support
                </p>
                <a
                  href={`mailto:${BRAND.supportEmail}`}
                  className="mt-2 block break-all text-[13px] text-chalk transition-colors hover:text-vybe-300"
                >
                  {BRAND.supportEmail}
                </a>
              </div>
            </aside>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
