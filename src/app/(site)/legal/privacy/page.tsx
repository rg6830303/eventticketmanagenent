import type { Metadata } from 'next';
import { BRAND } from '@/content/site';
import { LegalLayout } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: `How ${BRAND.name} collects, uses and protects your personal data.`,
  alternates: { canonical: '/legal/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      current="/legal/privacy"
      kicker="Legal"
      title="Privacy policy"
      lede="What we collect, why we collect it, and what we will never do with it."
      lastUpdated="16 August 2026"
      sections={[
        {
          id: 'what-we-collect',
          title: '1. What we collect',
          body: (
            <>
              <p>When you book a ticket we collect only what is needed to issue and deliver it:</p>
              <ul>
                <li>
                  <strong>Your name</strong> — printed on the pass and checked against your photo ID
                  at the door.
                </li>
                <li>
                  <strong>Your email address</strong> — the delivery channel for your QR ticket.
                  Without it there is no way to give you a ticket.
                </li>
                <li>
                  <strong>Your mobile number</strong> — used only if we need to reach you urgently
                  about the event you booked.
                </li>
                <li>
                  <strong>Technical data</strong> — your IP address and browser user-agent, recorded
                  with the booking. This exists to detect abuse and fraudulent bulk booking, not to
                  profile you.
                </li>
              </ul>
              <p>
                We do not collect payment card details. Online payment is not currently enabled;
                when it is, card data will be handled entirely by the payment processor and will
                never reach our servers.
              </p>
            </>
          ),
        },
        {
          id: 'why',
          title: '2. Why we use it, and on what basis',
          body: (
            <>
              <p>
                We process your data to perform the contract you entered into when booking — issuing
                your ticket, delivering it, admitting you at the door, and contacting you about that
                specific event.
              </p>
              <p>
                We also process a limited amount of data on the basis of our legitimate interest in
                running a safe event: the door scan log, which records every ticket scan including
                rejected ones, exists so that entry disputes can be resolved factually.
              </p>
              <p>
                We do not send marketing email unless you separately ask us to. Booking a ticket
                does not subscribe you to anything.
              </p>
            </>
          ),
        },
        {
          id: 'sharing',
          title: '3. Who we share it with',
          body: (
            <>
              <p>We do not sell personal data. It is shared only with:</p>
              <ul>
                <li>
                  <strong>Our email provider</strong> — your address is transmitted via SMTP in
                  order to deliver your ticket.
                </li>
                <li>
                  <strong>Our hosting and database providers</strong> — who store the data on our
                  behalf under contract.
                </li>
                <li>
                  <strong>A payment processor</strong> — only once online payment is enabled, and
                  only the data needed to take the payment.
                </li>
                <li>
                  <strong>Law enforcement</strong> — where we are legally required to disclose.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'retention',
          title: '4. How long we keep it',
          body: (
            <>
              <p>
                Booking and ticket records are retained for 24 months after the event, which covers
                the period in which a dispute, chargeback or statutory claim could realistically
                arise. Door scan logs are retained for the same period.
              </p>
              <p>
                Contact-form messages are kept for 12 months. Aggregate, non-identifying counts
                (how many people attended, how many scans occurred) may be kept indefinitely.
              </p>
            </>
          ),
        },
        {
          id: 'cookies',
          title: '5. Cookies',
          body: (
            <>
              <p>
                This site sets exactly one cookie, and only for staff: an httpOnly session cookie
                used to keep an operator signed in to the admin console. It is not set for members
                of the public.
              </p>
              <p>
                There are no advertising cookies, no analytics cookies and no third-party trackers
                on this site. That is why you are not being shown a consent banner — there is
                nothing to consent to.
              </p>
            </>
          ),
        },
        {
          id: 'security',
          title: '6. Security',
          body: (
            <>
              <p>
                Data is transmitted over TLS and stored in an access-controlled database. Ticket QR
                codes contain no personal data whatsoever — only an opaque code and a cryptographic
                signature — so a photographed or intercepted ticket reveals nothing about its
                holder. Staff passwords are stored as bcrypt hashes, never in plain text.
              </p>
            </>
          ),
        },
        {
          id: 'your-rights',
          title: '7. Your rights',
          body: (
            <>
              <p>
                Under India&apos;s Digital Personal Data Protection Act, 2023, you have the right to
                access the personal data we hold about you, to have inaccurate data corrected, to
                have your data erased where we no longer need it, to nominate another person to
                exercise these rights on your behalf, and to complain to the Data Protection Board
                of India.
              </p>
              <p>
                To exercise any of these, email us with your booking reference. We respond within 30
                days. Note that we cannot erase records we are required to retain for an ongoing
                dispute until it is resolved.
              </p>
            </>
          ),
        },
        {
          id: 'grievance',
          title: '8. Grievance officer',
          body: (
            <>
              <p>
                In line with Indian data protection requirements, complaints about how your data is
                handled can be addressed to our grievance officer:
              </p>
              <p>
                <strong>Grievance Officer, {BRAND.name}</strong>
                <br />
                Email: <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
                <br />
                Hyderabad, Telangana, India
              </p>
              <p>
                We acknowledge every grievance within 48 hours and aim to resolve it within 30 days.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
