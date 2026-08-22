import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getBookingByReference } from '@/lib/bookings';
import { env } from '@/lib/env';
import { BRAND, EVENT } from '@/content/site';
import { formatEventDate, formatEventTime, formatInr } from '@/lib/utils';
import { RazorpayCheckout } from '@/components/payment/RazorpayCheckout';
import { UpiCheckout } from '@/components/payment/UpiCheckout';
import { Reveal } from '@/components/ui/Reveal';
import { buildUpiUri, formatUtr } from '@/lib/upi';
import { getClaimForBooking } from '@/lib/upi-claims';
import { qrDataUrl } from '@/lib/qr';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Complete payment for your OFF Campus pass.',
  robots: { index: false, follow: false },
};

/**
 * Checkout.
 *
 * A booking arrives here as `pending` with inventory already reserved, so the
 * page's only job is to collect money and get out of the way. Everything on it
 * is either the order being paid for or a reason to trust the payment step —
 * nothing else, because a checkout page with a marketing section on it is a
 * checkout page people abandon.
 */
export default async function PayPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const detail = await getBookingByReference(reference).catch(() => null);

  if (!detail) notFound();

  const { booking, event, tier } = detail;

  // Already paid — never show a pay button for money that has been taken.
  if (booking.status === 'confirmed') redirect(`/booking/${booking.reference}`);

  if (booking.status === 'cancelled' || booking.status === 'refunded') {
    return <DeadEnd title="This booking was cancelled" reference={booking.reference} />;
  }

  if (booking.amount_paise <= 0) redirect(`/booking/${booking.reference}`);

  /**
   * The UPI rail is assembled server-side: the deep link is built from
   * `booking.amount_paise` and rendered to a QR here, so the code the customer
   * scans always carries the amount the database says is owed. Generating it
   * in the browser would let a tampered client show a QR for any figure it
   * liked and then file a claim against the real order.
   */
  const upiEnabled = env.upi.enabled;
  const upiUri = upiEnabled
    ? buildUpiUri({
        payeeAddress: env.upi.vpa,
        payeeName: env.upi.payeeName,
        amountPaise: booking.amount_paise,
        reference: booking.reference,
        note: `${EVENT.name} ${booking.reference}`,
      })
    : null;
  const upiQr = upiUri ? await qrDataUrl(upiUri, 464).catch(() => null) : null;
  const existingClaim = upiEnabled ? await getClaimForBooking(booking.id).catch(() => null) : null;

  return (
    <div className="relative">

      <div className="shell relative max-w-[900px] pb-24 pt-32 sm:pt-36">
        <Reveal>
          <p className="kicker">Step 2 of 2</p>
          <h1 className="h-section mt-3">Pay and get your passes</h1>
          <p className="lede mt-3 max-w-xl">
            Your spot is held while you pay. The QR passes are emailed the moment the payment
            clears.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          {/* ---------------- Order ---------------- */}
          <Reveal delay={0.06}>
            <div className="panel-raised overflow-hidden">
              <div className="flex items-start justify-between gap-4 border-b-[1.5px] border-ink bg-vybe-100 px-6 py-5">
                <div>
                  <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-ink">
                    Your order
                  </p>
                  <p className="h-card mt-1.5 whitespace-nowrap">
                    {EVENT.name} <span className="accent text-vybe-600">{EVENT.edition}</span>
                  </p>
                </div>
                <span className="chip shrink-0">Held · {booking.reference}</span>
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 px-6 py-6 text-[0.875rem] sm:grid-cols-3">
                <Fact label="Date" value={formatEventDate(event.starts_at)} />
                <Fact label="Doors" value={formatEventTime(event.doors_at ?? event.starts_at)} />
                <Fact label="Venue" value={event.venue_name} />
                <Fact label="Ticket" value={tier?.name ?? 'General entry'} />
                <Fact label="Passes" value={`${booking.quantity} × QR`} />
                <Fact label="Name on booking" value={booking.customer_name} />
              </dl>

              <div className="space-y-3 border-t border-edge px-6 py-6 text-[0.9375rem]">
                <Line
                  label={`${tier?.name ?? 'Entry'} × ${booking.quantity}`}
                  value={formatInr(booking.subtotal_paise || booking.amount_paise)}
                />
                {booking.discount_paise > 0 && (
                  <Line
                    label={`Referral code ${booking.referral_code ?? ''}`}
                    value={`− ${formatInr(booking.discount_paise)}`}
                    tone="credit"
                  />
                )}
                <div className="rule-receipt my-4" />
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-ink">Total payable</span>
                  <span className="tnum font-display text-3xl font-bold text-ink">
                    {formatInr(booking.amount_paise)}
                  </span>
                </div>
                <p className="text-[0.75rem] text-muted">
                  All taxes and platform fees included. Charged once, in INR.
                </p>
                <div aria-hidden className="mt-4 flex items-center justify-between gap-4 border-t-[1.5px] border-ink pt-4">
                  <span className="barcode h-6 w-28 opacity-70" />
                  <span className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-muted">
                    {booking.reference}
                  </span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* ---------------- Payment ---------------- */}
          <Reveal delay={0.12}>
            <div className="sticky top-24 space-y-6">
              {env.paymentsEnabled && (
                <div className="card-print p-6">
                  <RazorpayCheckout
                    reference={booking.reference}
                    amountPaise={booking.amount_paise}
                    eventName={`${EVENT.name} ${EVENT.edition}`}
                    tierName={tier?.name ?? 'Entry'}
                    quantity={booking.quantity}
                    customer={{
                      name: booking.customer_name,
                      email: booking.customer_email,
                      phone: booking.customer_phone,
                    }}
                  />

                  <div className="mt-6 border-t-2 border-ink pt-5">
                    <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-vybe-700">
                      Pay with
                    </p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {['UPI', 'Cards', 'Net banking', 'Wallets'].map((method) => (
                        <li
                          key={method}
                          className="rounded-[8px] border border-ink/25 bg-frost px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-slate"
                        >
                          {method}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Both rails on at once needs a divider, or the page reads as two
                  competing checkouts rather than one with a fallback. */}
              {env.paymentsEnabled && upiEnabled && upiUri && upiQr && (
                <div className="flex items-center gap-4">
                  <span className="h-px flex-1 bg-ink/20" />
                  <span className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-muted">
                    or pay direct
                  </span>
                  <span className="h-px flex-1 bg-ink/20" />
                </div>
              )}

              {upiEnabled && upiUri && upiQr && (
                <UpiCheckout
                  reference={booking.reference}
                  amountPaise={booking.amount_paise}
                  payeeName={env.upi.payeeName}
                  vpa={env.upi.vpa}
                  upiUri={upiUri}
                  qrDataUrl={upiQr}
                  existingUtr={existingClaim ? formatUtr(existingClaim.utr) : null}
                />
              )}

              {!env.paymentsEnabled && !upiEnabled && (
                <div className="card-print border-flare-500 p-4 text-[0.8125rem] leading-relaxed text-flare-600">
                  <p className="font-semibold">Online payment is switched off</p>
                  <p className="mt-1.5">
                    This booking is held but cannot be paid for yet. Set PAYMENTS_ENABLED with the
                    Razorpay keys, or UPI_ENABLED with UPI_VPA, then reload this page.
                  </p>
                </div>
              )}

              <div className="card-print p-6">
              <ul className="space-y-3 text-[0.8125rem] text-slate">
                <Assurance>Your seats are reserved while this page is open.</Assurance>
                {/* "Within a minute" is true of the gateway, which confirms
                    itself. The UPI rail waits on a person, and promising a
                    minute there would be a promise we cannot keep. */}
                {env.paymentsEnabled ? (
                  <Assurance>QR passes emailed within a minute of card or UPI payment.</Assurance>
                ) : (
                  <Assurance>
                    QR passes emailed once we have matched your payment — always before doors.
                  </Assurance>
                )}
                <Assurance>Full refund if we cancel or move the date.</Assurance>
              </ul>

              <p className="mt-6 border-t-2 border-ink pt-5 text-[0.75rem] leading-relaxed text-muted">
                Stuck on this step? Email{' '}
                <a href={`mailto:${BRAND.supportEmail}`} className="link-swipe font-medium">
                  {BRAND.supportEmail}
                </a>{' '}
                and quote {booking.reference}.
              </p>
              </div>
            </div>
          </Reveal>
        </div>

        <p className="mt-8 text-center text-[0.8125rem] text-muted">
          Changed your mind?{' '}
          <Link href="/book" className="link-swipe font-medium text-slate">
            Start a different booking
          </Link>
          . This one expires on its own if it is not paid.
        </p>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}

function Line({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: string;
  tone?: 'normal' | 'credit';
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={tone === 'credit' ? 'font-medium text-leaf-600' : 'text-slate'}>{label}</span>
      <span
        className={
          tone === 'credit' ? 'tnum font-semibold text-leaf-600' : 'tnum font-medium text-ink'
        }
      >
        {value}
      </span>
    </div>
  );
}

function Assurance({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="mt-[3px] h-3.5 w-3.5 shrink-0 text-leaf-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.5 8.5 6 12l7.5-8" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

function DeadEnd({ title, reference }: { title: string; reference: string }) {
  return (
    <div className="shell max-w-lg py-32">
      <div className="panel-raised p-10 text-center">
        <h1 className="h-section">{title}</h1>
        <p className="lede mt-3">
          Nothing is owed on {reference}. If you think this is wrong, email{' '}
          {BRAND.supportEmail} with the reference.
        </p>
        <Link href="/book" className="btn-primary mt-8">
          Book again
        </Link>
      </div>
    </div>
  );
}
