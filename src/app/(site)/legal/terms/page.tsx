import type { Metadata } from 'next';
import { BRAND, VENUE } from '@/content/site';
import { LegalLayout } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Terms of service',
  description: `Ticket terms, entry conditions and right of admission for ${BRAND.name} events in Hyderabad.`,
  alternates: { canonical: '/legal/terms' },
};

export default function TermsPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Terms of service"
      lede="These terms govern the purchase of tickets and entry to events produced by Houz of Vybe in Hyderabad, Telangana."
      lastUpdated="16 August 2026"
      sections={[
        {
          id: 'ticket-licence',
          title: '1. What a ticket is',
          body: (
            <>
              <p>
                A ticket is a revocable personal licence to attend a specific event on a specific
                date. It is not a transfer of property and confers no right beyond admission for
                one person, once, subject to these terms.
              </p>
              <p>
                Each ticket carries a unique QR code that is consumed on first scan. Reproducing,
                photographing or forwarding a QR does not create a second valid ticket — the second
                and any later presentation of the same code will be refused entry.
              </p>
            </>
          ),
        },
        {
          id: 'age-id',
          title: '2. Age and identification',
          body: (
            <>
              <p>
                Entry is restricted to persons aged 21 or over, in line with the legal drinking age
                in Telangana. A valid government-issued photo identification must be produced at the
                door — Aadhaar, passport, driving licence or voter ID. Documents held in DigiLocker
                are accepted.
              </p>
              <p>
                The name on the identification should match the name on the booking. Where it does
                not, admission is at the sole discretion of the door team. No ID means no entry, and
                no refund.
              </p>
            </>
          ),
        },
        {
          id: 'admission',
          title: '3. Right of admission',
          body: (
            <>
              <p>
                Management reserves the right of admission. Entry may be refused or an attendee
                removed, without refund, where a person is intoxicated to the point of risk to
                themselves or others, behaves aggressively, harasses staff or other guests, damages
                property, or refuses a reasonable instruction from staff or security.
              </p>
              <p>
                We operate a zero-tolerance policy on harassment of any kind. Report anything to a
                staff member or the welfare lead on shift; we will act on it.
              </p>
            </>
          ),
        },
        {
          id: 'entry-conditions',
          title: '4. Entry conditions',
          body: (
            <>
              <ul>
                <li>Entry closes 90 minutes before the advertised end of the event.</li>
                <li>There is no re-entry once you have left the venue.</li>
                <li>
                  Bag checks and a security search are a condition of entry. Prohibited items
                  include outside food and drink, illegal substances, weapons, laser pointers,
                  professional recording equipment and anything staff reasonably deem unsafe.
                </li>
                <li>
                  Dress code is smart casual and above. No shorts, flip-flops or sportswear.
                </li>
                <li>
                  Events are photographed and filmed. By entering, you consent to appearing in
                  footage used for the promotion of {BRAND.name}. Tell a staff member if you do not
                  wish to be filmed and we will do our best to accommodate you.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'changes',
          title: '5. Changes, postponement and cancellation',
          body: (
            <>
              <p>
                Line-ups are subject to change. The substitution or withdrawal of any individual
                artist does not entitle you to a refund, provided the event itself goes ahead.
              </p>
              <p>
                If we cancel an event outright, or reschedule it to a date you cannot attend, you
                are entitled to a full refund of the amount paid. See our{' '}
                <a href="/legal/refunds">refunds and cancellations policy</a> for how that is
                processed.
              </p>
              <p>
                We are not liable for a cancellation caused by circumstances beyond our reasonable
                control, including government or police order, extreme weather, power failure at the
                venue, public health restrictions or civil disruption. In those cases the refund
                position above still applies to the ticket price, but not to travel, accommodation
                or any other consequential cost.
              </p>
            </>
          ),
        },
        {
          id: 'transfers',
          title: '6. Transfers and resale',
          body: (
            <>
              <p>
                Tickets may be transferred to another person up to 24 hours before doors. Email us
                from the address used to book; we will reissue the pass in the new name and void the
                original QR at the same time.
              </p>
              <p>
                Commercial resale of tickets above face value is not permitted. We reserve the right
                to void any ticket found being resold in breach of this clause, without refund.
              </p>
            </>
          ),
        },
        {
          id: 'liability',
          title: '7. Liability',
          body: (
            <>
              <p>
                You attend at your own risk. Events involve loud amplified music, low lighting and
                crowds; we recommend hearing protection. Nothing in these terms excludes liability
                for death or personal injury caused by our negligence, or for fraud.
              </p>
              <p>
                Subject to that, our total liability arising out of or in connection with a ticket
                is limited to the amount you paid for that ticket. We are not liable for indirect or
                consequential loss, or for personal property brought to the venue.
              </p>
            </>
          ),
        },
        {
          id: 'governing-law',
          title: '8. Governing law',
          body: (
            <p>
              These terms are governed by the laws of India. The courts at Hyderabad, Telangana have
              exclusive jurisdiction over any dispute arising from them or from your attendance at
              an event.
            </p>
          ),
        },
        {
          id: 'contact',
          title: '9. Contact',
          body: (
            <p>
              Questions about these terms: <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>.
              Ticket and booking issues: <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.
              Venue: {VENUE.name}, {VENUE.addressLines.join(', ')}.
            </p>
          ),
        },
      ]}
    />
  );
}
