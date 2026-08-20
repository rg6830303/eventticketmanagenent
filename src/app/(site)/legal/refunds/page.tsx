import type { Metadata } from 'next';
import { BRAND } from '@/content/site';
import { LegalLayout } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Refunds & cancellations',
  description: `Refund, transfer and cancellation policy for ${BRAND.name} tickets.`,
  alternates: { canonical: '/legal/refunds' },
};

export default function RefundsPage() {
  return (
    <LegalLayout
      current="/legal/refunds"
      kicker="Legal"
      title="Refunds & cancellations"
      lede="When you get your money back, when you don't, and how transfers work."
      lastUpdated="16 August 2026"
      sections={[
        {
          id: 'how-you-pay',
          title: '1. How payment is taken',
          body: (
            <>
              <p>
                Tickets are paid for online through <strong>Razorpay</strong> at the time of
                booking. The amount shown on the checkout page is the final amount: taxes and
                platform fees are included in it, and any referral discount is applied before you
                pay rather than refunded afterwards.
              </p>
              <p>
                We do not see, handle or store your card or UPI credentials. Those are entered on
                Razorpay&apos;s payment window and processed by them. We keep only the payment
                reference Razorpay returns, so that we can match a payment to a booking.
              </p>
              <p>
                If money leaves your account and no pass arrives within an hour, do not pay again.
                Contact us with your booking reference and we will either issue the pass or refund
                the payment in full.
              </p>
            </>
          ),
        },
        {
          id: 'no-refunds',
          title: '2. Tickets are non-refundable',
          body: (
            <>
              <p>
                Once a ticket has been issued it is non-refundable and non-exchangeable. This
                includes changes of plan, illness, travel disruption, being refused entry for
                failing to produce valid photo identification, and being refused or removed under
                the right of admission set out in our <a href="/legal/terms">terms of service</a>.
              </p>
              <p>
                Capacity is capped and sold against a fixed room size, which is why we cannot
                release a place back once it has been taken.
              </p>
            </>
          ),
        },
        {
          id: 'we-cancel',
          title: '3. If we cancel or reschedule',
          body: (
            <>
              <p>
                If we cancel an event, you receive a <strong>full automatic refund</strong> of the
                amount paid. You do not need to request it. Refunds are issued to the original
                payment method within 7 working days of the cancellation announcement; your bank may
                take a further 3–5 days to show it.
              </p>
              <p>
                If we reschedule, your ticket automatically transfers to the new date. If that date
                does not work for you, tell us within 7 days of the announcement and we will refund
                you in full on the same terms.
              </p>
              <p>
                Refunds cover the ticket price only. We cannot reimburse travel, accommodation or
                any other cost incurred in connection with attending.
              </p>
            </>
          ),
        },
        {
          id: 'transfers',
          title: '4. Transferring your ticket',
          body: (
            <>
              <p>
                You can transfer a ticket to someone else up to <strong>24 hours before doors</strong>.
                Email us from the address you booked with, giving your booking reference and the new
                attendee&apos;s full name and email address.
              </p>
              <p>
                We reissue the pass in their name and void the original QR at the same moment, so
                the old code will no longer scan. There is no fee for a transfer.
              </p>
            </>
          ),
        },
        {
          id: 'no-show',
          title: '5. No-shows',
          body: (
            <p>
              An unused ticket has no value after the event has taken place. Not attending does not
              entitle you to a refund or a credit against a future event.
            </p>
          ),
        },
        {
          id: 'duplicates',
          title: '6. Accidental duplicate bookings',
          body: (
            <p>
              Our booking system deduplicates repeated submissions of the same form, so a
              double-click will not create two bookings. If a genuine duplicate does occur — two
              separate bookings for the same person and event — contact us within 48 hours with both
              references and we will cancel one and refund it in full.
            </p>
          ),
        },
        {
          id: 'disputes',
          title: '7. Raising a dispute',
          body: (
            <>
              <p>
                Email <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> with your
                booking reference and a description of the issue. We acknowledge within 48 hours and
                aim to resolve within 15 working days.
              </p>
              <p>
                Please come to us before raising a chargeback with your bank. A chargeback on a
                validly issued ticket may result in that ticket being voided.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
