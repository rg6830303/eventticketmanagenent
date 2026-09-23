import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { listAccountBookings } from '@/lib/customer-account';
import { formatDateTime, formatEventDate, formatInr } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { SignOutButton } from '@/components/account/SignOutButton';
import { ResendVerification } from '@/components/account/ResendVerification';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My tickets',
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, { label: string; chip: string }> = {
  confirmed: { label: 'Confirmed', chip: 'chip-ok' },
  pending: { label: 'Awaiting payment', chip: 'chip-hot' },
  failed: { label: 'Payment failed', chip: 'chip-hot' },
  cancelled: { label: 'Cancelled', chip: 'chip-quiet' },
  refunded: { label: 'Refunded', chip: 'chip-quiet' },
};

export default async function AccountPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/login?next=/account');

  const verified = Boolean(customer.email_verified_at);

  /*
   * The ticket list is gated on a verified address, and this is the single
   * most important line on the page.
   *
   * Signing up claims the `customers` row that owns an email, and that row
   * carries every booking ever made with it. Until the mailbox has proved it
   * belongs to the person holding the account, the claim is only an assertion —
   * and honouring it would hand whoever typed the address a stranger's booking
   * history and their working QR passes.
   */
  const bookings = verified ? await listAccountBookings(customer.id).catch(() => []) : [];

  const upcoming = bookings.filter(
    (booking) => new Date(booking.event.ends_at ?? booking.event.starts_at) >= new Date(),
  );
  const past = bookings.filter(
    (booking) => new Date(booking.event.ends_at ?? booking.event.starts_at) < new Date(),
  );

  return (
    <div className="shell pb-24 pt-32 sm:pt-36">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className="h-section mt-3">Hey {customer.name.split(' ')[0]}.</h1>
          <p className="mt-3 text-[0.9375rem] text-slate">{customer.email}</p>
        </div>
        <SignOutButton />
      </div>

      {!verified && (
        <div className="card-feature mt-10 p-6 sm:p-7">
          <h2 className="h-card">Confirm your email to see your tickets.</h2>
          <p className="mt-2 max-w-xl text-[0.9375rem] leading-relaxed text-slate">
            We sent a link to <strong className="text-ink">{customer.email}</strong>. It proves the
            inbox is yours, which is what lets us show you the passes bought with this address —
            including any you bought before creating an account.
          </p>
          <div className="mt-5">
            <ResendVerification />
          </div>
        </div>
      )}

      {verified && bookings.length === 0 && (
        <div className="card mt-10 p-8 text-center sm:p-10">
          <h2 className="h-card">No bookings on this account yet.</h2>
          <p className="mx-auto mt-2 max-w-md text-[0.9375rem] leading-relaxed text-slate">
            Anything you buy with {customer.email} lands here automatically, with its QR passes.
          </p>
          <Link href="/book" className="btn-primary mt-7">
            See what&apos;s on sale
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mt-12" aria-labelledby="upcoming">
          <h2 id="upcoming" className="font-display text-[1.25rem] font-semibold text-ink">
            Coming up
          </h2>
          <div className="mt-5 space-y-4">
            {upcoming.map((booking) => (
              <BookingCard key={booking.reference} booking={booking} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-12" aria-labelledby="past">
          <h2 id="past" className="font-display text-[1.25rem] font-semibold text-ink">
            Past
          </h2>
          <div className="mt-5 space-y-4">
            {past.map((booking) => (
              <BookingCard key={booking.reference} booking={booking} past />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BookingCard({
  booking,
  past = false,
}: {
  booking: Awaited<ReturnType<typeof listAccountBookings>>[number];
  past?: boolean;
}) {
  const status = STATUS_LABEL[booking.status] ?? { label: booking.status, chip: 'chip-quiet' };

  return (
    <article className={cn('card p-5 sm:p-6', past && 'opacity-80')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="font-display text-[1.125rem] font-semibold text-ink">
              {booking.event.name}
              {booking.event.edition ? ` ${booking.event.edition}` : ''}
            </h3>
            <span className={cn('chip', status.chip)}>{status.label}</span>
          </div>
          <p className="mt-1.5 text-[0.875rem] text-slate">
            {formatEventDate(booking.event.starts_at)} · {booking.event.venue_name}
          </p>
          <p className="tnum mt-1 font-mono text-[0.75rem] uppercase tracking-[0.12em] text-muted">
            {booking.reference} · {booking.quantity}{' '}
            {booking.quantity === 1 ? 'pass' : 'passes'} · {formatInr(booking.amount_paise)}
          </p>
        </div>

        <div className="shrink-0">
          {/* Only a confirmed booking has passes to show. A pending one links to
              the same page, where the pay button lives. */}
          <Link
            href={`/booking/${booking.reference}`}
            className={booking.status === 'confirmed' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
          >
            {booking.status === 'confirmed'
              ? past
                ? 'View booking'
                : 'Show my passes'
              : 'Finish payment'}
          </Link>
        </div>
      </div>

      {booking.status === 'confirmed' && booking.used_tickets > 0 && (
        <p className="mt-4 border-t border-ink/[0.07] pt-3 text-[0.8125rem] text-muted">
          {booking.used_tickets} of {booking.used_tickets + booking.valid_tickets} scanned in
          {booking.paid_at ? ` · paid ${formatDateTime(booking.paid_at)}` : ''}
        </p>
      )}
    </article>
  );
}
