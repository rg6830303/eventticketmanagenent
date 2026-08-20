import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND, EVENT, REFERRAL } from '@/content/site';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Reveal } from '@/components/ui/Reveal';
import { Accordion } from '@/components/events/Accordion';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'How booking works for OFF Campus: payment, QR delivery, entry, ID, referral codes, transfers and refunds.',
  alternates: { canonical: '/faq' },
};

/** Platform-level questions, kept separate from the per-event ones. */
const PLATFORM_FAQS = [
  {
    q: 'How do I pay?',
    a: 'Online, through Razorpay, at the last step. UPI, credit and debit cards, net banking and the usual wallets all work. Nothing card-related touches our servers — the payment window is Razorpay\u2019s, not ours.',
  },
  {
    q: 'When am I actually charged?',
    a: 'Once, when you confirm in the payment window. The amount shown on the checkout page is the final amount: taxes and platform fees are already in it, and a referral code is applied before you pay, not refunded afterwards.',
  },
  {
    q: 'How do referral codes work?',
    a: `Type the code into the referral box while booking. A valid code takes a flat \u20B9${REFERRAL.discountRupees} off the whole order, no matter how many tickets are in it, and the total updates before you go anywhere near the payment step. One code per booking, and it has to be entered at booking time \u2014 we cannot apply one to an order that is already paid.`,
  },
  {
    q: 'The money left my account but no email arrived. What now?',
    a: 'Do not pay again. Open your booking page (the /booking/HOV-XXXXXX link you were sent to after paying) and hit Resend. If the page still shows the booking as unpaid an hour later, email us the reference and the Razorpay payment id and we will sort it out the same day.',
  },
  {
    q: 'How does the QR pass actually work?',
    a: 'Every pass carries a unique code and a cryptographic signature. The scanner checks the signature before it even looks the pass up, so an edited or invented QR fails on the spot. A pass is marked used the instant it is scanned, which is why the same code cannot get a second person in, even at another door at the same moment.',
  },
  {
    q: 'Can I book for a group?',
    a: 'You can put up to six passes in one booking and you get six separate QR codes in the same email \u2014 forward one to each person. For anything larger, message us and we will set it up.',
  },
  {
    q: 'What happens to my details?',
    a: 'Name, email and phone are used to issue and deliver your passes and to reach you if the event changes. We do not sell data and there are no advertising trackers on this site. The full detail is in the privacy policy.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. No sign-up, no password, no app. Your booking reference and the QR in your inbox are the whole thing.',
  },
] as const;

export default function FaqPage() {
  const all = [
    ...PLATFORM_FAQS.map((f) => ({ question: f.q, answer: f.a })),
    ...EVENT.faqs.map((f) => ({ question: f.q, answer: f.a })),
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

      <div className="shell">
        <SectionHeading
          kicker="FAQ"
          title="Everything about tickets, entry and the door."
          lede={`${all.length} answers, written plainly. If yours is not here, ask — we reply within a working day.`}
        />

        <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">
          <div className="space-y-14">
            <section aria-labelledby="faq-platform">
              <div className="mb-6 flex items-center gap-4">
                <h2
                  id="faq-platform"
                  className="font-display text-[1.125rem] font-semibold tracking-[-0.02em] text-ink"
                >
                  Tickets &amp; booking
                </h2>
                <span aria-hidden className="h-[2px] flex-1 bg-ink/20" />
                <span className="font-mono text-[11px] text-muted">
                  {String(PLATFORM_FAQS.length).padStart(2, '0')}
                </span>
              </div>
              <Accordion items={PLATFORM_FAQS.map((f) => ({ question: f.q, answer: f.a }))} />
            </section>

            <section aria-labelledby="faq-night">
              <div className="mb-6 flex items-center gap-4">
                <h2 id="faq-night" className="font-display text-[1.125rem] font-semibold tracking-[-0.02em] text-ink">
                  At the party
                </h2>
                <span aria-hidden className="h-[2px] flex-1 bg-ink/20" />
                <span className="font-mono text-[11px] text-muted">
                  {String(EVENT.faqs.length).padStart(2, '0')}
                </span>
              </div>
              <Accordion items={EVENT.faqs.map((f) => ({ question: f.q, answer: f.a }))} />
            </section>
          </div>

          <Reveal delay={0.1} direction="left" className="lg:sticky lg:top-28 lg:h-fit">
            <aside className="card-print relative overflow-hidden p-6">
              <div className="relative">
                <h2 className="h-card">Still stuck?</h2>
                <p className="mt-2.5 text-[0.875rem] leading-relaxed text-slate">
                  Send your booking reference and what went wrong. A human reads every message and
                  replies within one working day.
                </p>
                <Link href="/contact" className="btn-primary mt-6 w-full py-3 text-[13px]">
                  Contact us
                </Link>
                <Link href="/book" className="btn-outline btn-sm mt-2.5 w-full py-3 text-[13px]">
                  Book tickets
                </Link>
                <div className="rule my-6" />
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
                  Ticket support
                </p>
                <a
                  href={`mailto:${BRAND.supportEmail}`}
                  className="mt-2 block break-all text-[0.875rem] font-medium text-ink transition-colors hover:text-vybe-600"
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
