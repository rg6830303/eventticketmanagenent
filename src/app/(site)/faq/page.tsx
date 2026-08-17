import Link from 'next/link';
import type { Metadata } from 'next';
import { OFFCAMPUS } from '@/content/site';
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
    <div className="container-hov pb-24 pt-32 sm:pt-40">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <SectionHeading
        eyebrow="FAQ"
        title="Everything about tickets, entry and the door."
        lede="If it isn't here, ask us — we answer within a working day."
      />

      <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_300px] lg:gap-16">
        <div className="space-y-14">
          <section>
            <h2 className="mb-6 font-display text-lg font-semibold text-vybe-300">
              Tickets &amp; booking
            </h2>
            <Accordion items={PLATFORM_FAQS.map((f) => ({ question: f.q, answer: f.a }))} />
          </section>

          <section>
            <h2 className="mb-6 font-display text-lg font-semibold text-vybe-300">
              On the night
            </h2>
            <Accordion items={OFFCAMPUS.faqs.map((f) => ({ question: f.q, answer: f.a }))} />
          </section>
        </div>

        <Reveal delay={0.1} direction="left">
          <aside className="card card-lit p-6 lg:sticky lg:top-28">
            <h2 className="font-display text-lg font-semibold text-chalk">Still stuck?</h2>
            <p className="mt-2.5 text-[13px] leading-relaxed text-haze">
              Send us your booking reference and what went wrong. A human reads every message.
            </p>
            <Link href="/contact" className="btn-primary mt-6 w-full py-3 text-[13px]">
              Contact us
            </Link>
            <Link href="/book" className="btn-ghost mt-2.5 w-full py-3 text-[13px]">
              Book tickets
            </Link>
          </aside>
        </Reveal>
      </div>
    </div>
  );
}
