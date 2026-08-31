import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getBookingByReference } from '@/lib/bookings';
import { reconcileBooking } from '@/lib/payments';
import { getSiteUrl } from '@/lib/site-url';
import { cn, formatEventDate, formatEventTime, formatInr, maskEmail, formatDateTime } from '@/lib/utils';
import { Reveal } from '@/components/ui/Reveal';
import { ShareCrew } from '@/components/game/ShareCrew';
import { TicketCard } from '@/components/booking/TicketCard';
import { BookingCelebration } from '@/components/booking/BookingCelebration';
import { ResendButton } from '@/components/booking/ResendButton';
import { PrintButton } from '@/components/booking/PrintButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your booking',
  robots: { index: false, follow: false },
};

export default async function BookingConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ paid?: string; mailed?: string; status?: string }>;
}) {
  const { reference } = await params;
  const { paid, mailed, status } = await searchParams;
  let detail = await getBookingByReference(reference);
  if (!detail) notFound();

  // Somebody who paid and closed the tab before the browser confirmed lands
  // here with a booking that still says pending. Ask the gateway whether the
  // money actually arrived — this is the webhook's job, done by asking rather
  // than waiting to be told, and it is the difference between a customer
  // waiting a moment and a customer never getting their ticket.
  if (detail.booking.status === 'pending' && detail.booking.payment_order_id) {
    const settled = await reconcileBooking(detail.booking).catch(() => null);
    if (settled?.outcome === 'paid') {
      detail = (await getBookingByReference(reference)) ?? detail;
    }
  }

  const { booking, event, tier, tickets, items } = detail;
  // Set once a payment has been verified server-side, so it is only ever true
  // immediately after a
  // real, server-verified payment.
  const justPaid = paid === '1';
  // The gateway took the money but has not settled the order yet — a UPI
  // collect request that is still with the customer's bank, typically.
  const processing = status === 'processing' && booking.status === 'pending';
  const cancelled = booking.status === 'cancelled' || booking.status === 'refunded';
  // A pending booking has reserved inventory but no money and no minted
  // tickets. Congratulating someone here — and then showing them no QR — is the
  // single worst thing this page can do, so it gets its own state.
  const unpaid = booking.status === 'pending' && booking.amount_paise > 0;
  const shareUrl = `${getSiteUrl()}/events/${event.slug}`;

  return (
    <div className="relative">
      {/* Only a live booking is worth celebrating. */}
      {!cancelled && !unpaid && <BookingCelebration reference={booking.reference} />}

      <div className="shell relative pb-24 pt-28 sm:pt-32">
        <Reveal>
          <div className="relative mx-auto max-w-2xl text-center">
            <div className="relative">
              {/* Straight after a payment the one question is "did it work and
                  where is my ticket". Answer both before anything else. */}
              {justPaid && !unpaid && (
                <div className="mb-7 rounded-2xl border-[1.5px] border-leaf-400 bg-leaf-100 px-5 py-4 text-left">
                  <p className="font-display text-[1.05rem] font-semibold text-ink">
                    Payment received — {formatInr(booking.amount_paise)} paid.
                  </p>
                  <p className="mt-1.5 text-[0.875rem] leading-relaxed text-slate">
                    {mailed === '0' ? (
                      <>
                        Your {tickets.length === 1 ? 'QR pass is' : `${tickets.length} QR passes are`}{' '}
                        below and confirmed. The email to{' '}
                        <span className="font-medium text-ink">{maskEmail(booking.customer_email)}</span>{' '}
                        is still going out — if it has not arrived in a few minutes, use Resend
                        below.
                      </>
                    ) : (
                      <>
                        Your{' '}
                        {tickets.length === 1 ? 'QR pass has' : `${tickets.length} QR passes have`}{' '}
                        been emailed to{' '}
                        <span className="font-medium text-ink">{maskEmail(booking.customer_email)}</span>
                        . They are shown below too — screenshot them now.
                      </>
                    )}
                  </p>
                </div>
              )}

              {processing && (
                <div className="mb-7 rounded-2xl border-[1.5px] border-vybe-400 bg-vybe-100 px-5 py-4 text-left">
                  <p className="font-display text-[1.05rem] font-semibold text-ink">
                    Your payment is still settling.
                  </p>
                  <p className="mt-1.5 text-[0.875rem] leading-relaxed text-slate">
                    Do not pay again. Some UPI payments confirm a minute or two after the app says
                    done. As soon as the bank confirms it, your QR passes are emailed to{' '}
                    <span className="font-medium text-ink">{maskEmail(booking.customer_email)}</span>{' '}
                    automatically. Refresh this page to check.
                  </p>
                </div>
              )}

              {unpaid ? (
                <>
                  <p className="kicker mb-3 text-flare-600">Payment outstanding</p>
                  <h1 className="h-section">Almost there</h1>
                  <p className="lede mt-4">
                    Your spot is held but nothing has been paid yet, so no passes have been issued.
                    Finish the payment and the QR codes are emailed within a minute.
                  </p>
                  <Link href={`/pay/${booking.reference}`} className="btn-primary mt-7">
                    Pay {formatInr(booking.amount_paise)} now
                  </Link>
                </>
              ) : cancelled ? (
                <>
                  <p className="kicker mb-3 text-flare-600">Booking {booking.status}</p>
                  <h1 className="h-section">This booking is no longer valid</h1>
                  <p className="lede mt-4">
                    The passes below have been voided. Contact us if you think this is a mistake.
                  </p>
                </>
              ) : (
                <>
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-leaf-400 bg-leaf-100">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      className="h-7 w-7 text-leaf-500"
                      aria-hidden
                    >
                      <path d="M4 12.5l5.5 5.5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="kicker mb-3">You&apos;re on the list</p>
                  <h1 className="h-section">
                    See you at <span className="text-vybe-600">{event.name}</span>
                  </h1>
                  <p className="lede mt-4">
                    {booking.quantity === 1 ? 'Your pass is' : `All ${booking.quantity} passes are`}{' '}
                    below. Screenshot the QR before you arrive — venue signal is unreliable.
                  </p>
                </>
              )}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.12} className="mx-auto mt-10 max-w-2xl">
          <div className="card-print p-6 sm:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted">
                  Booking reference
                </p>
                <p className="font-mono text-xl font-medium tracking-[0.08em] text-ink">
                  {booking.reference}
                </p>
              </div>
              <span className={cn('chip', unpaid && 'chip-hot')}>{booking.status}</span>
            </div>

            <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
              <Row label="Name" value={booking.customer_name} />
              <Row label="Email" value={maskEmail(booking.customer_email)} />
              <Row label="Date" value={formatEventDate(event.starts_at)} />
              <Row label="Doors" value={formatEventTime(event.doors_at ?? event.starts_at)} />
              <Row label="Venue" value={event.venue_name} />
              {/* A cart with more than one pass type has to itemise, or the
                  receipt claims they bought only the biggest line. */}
              {items.length > 1 ? (
                items.map((item) => (
                  <Row
                    key={item.id}
                    label={item.tier_name}
                    value={`× ${item.quantity} · ${formatInr(item.line_total_paise)}`}
                  />
                ))
              ) : (
                <Row
                  label="Ticket"
                  value={`${items[0]?.tier_name ?? tier?.name ?? 'General Entry'} × ${booking.quantity}`}
                />
              )}
              <Row
                label="Amount"
                value={
                  booking.amount_paise === 0 ? 'Complimentary entry' : formatInr(booking.amount_paise)
                }
              />
            </dl>

            <div className="rule-receipt my-6" />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[0.8125rem] leading-relaxed text-slate">
                {unpaid ? (
                  <>Passes are emailed to <span className="text-ink">{maskEmail(booking.customer_email)}</span> once the payment clears.</>
                ) : booking.email_sent_at ? (
                  <>
                    Ticket emailed to{' '}
                    <span className="text-ink">{maskEmail(booking.customer_email)}</span> at{' '}
                    {formatDateTime(booking.email_sent_at)}.
                  </>
                ) : (
                  <>
                    We haven&apos;t confirmed delivery to{' '}
                    <span className="text-ink">{maskEmail(booking.customer_email)}</span> yet. It
                    may still be on its way — check spam, or resend it.
                  </>
                )}
              </p>
              {!unpaid && (
                <div className="no-print flex shrink-0 gap-2">
                  <ResendButton reference={booking.reference} />
                  <PrintButton />
                </div>
              )}
            </div>
          </div>
        </Reveal>

        {!cancelled && !unpaid && (
          <Reveal delay={0.2} className="no-print mx-auto mt-6 max-w-2xl">
            <ShareCrew reference={booking.reference} url={shareUrl} />
          </Reveal>
        )}

        <div className="mx-auto mt-10 max-w-2xl space-y-5">
          {tickets.map((ticket, index) => (
            // Passes land one after another, so a four-ticket booking reads as a
            // stack being dealt rather than a wall appearing at once.
            <Reveal key={ticket.id} delay={0.28 + 0.09 * index}>
              <TicketCard
                ticket={ticket}
                event={event}
                tier={tier}
                index={index + 1}
                total={tickets.length}
              />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1} className="no-print mx-auto mt-10 max-w-2xl">
          <div className="card-print p-6">
            <h2 className="mb-3 font-display text-base font-semibold text-ink">Before you come</h2>
            <ul className="space-y-2 text-[13px] leading-relaxed text-slate">
              {tickets.some((ticket) => (ticket.admits ?? 1) > 1) ? (
                <li>
                  · Each QR works exactly once and admits the number of people printed on it.
                </li>
              ) : (
                <li>· Each QR admits one person and works exactly once.</li>
              )}
              <li>· Entry closes 90 minutes before the event ends.</li>
              <li>· Management reserves the right of admission.</li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/events/${event.slug}`} className="btn-outline px-6 py-3 text-[13px]">
                Event details
              </Link>
              <Link href="/contact" className="btn-outline btn-sm px-6 py-3 text-[13px]">
                Need help?
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-edge/60 pb-2">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}
