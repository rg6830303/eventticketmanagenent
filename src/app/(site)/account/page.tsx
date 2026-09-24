import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getBookingByReference } from '@/lib/bookings';
import { getCustomerAccount } from '@/lib/customer-auth';
import { query } from '@/lib/db';
import { formatEventDate, formatInr } from '@/lib/utils';
import { SignOutButton } from '@/components/account/SignOutButton';
import { TicketCard } from '@/components/booking/TicketCard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My account', robots: { index: false, follow: false } };

interface AccountBooking {
  reference: string;
  status: string;
  quantity: number;
  amount_paise: number;
  created_at: string;
  event_name: string;
  event_tagline: string | null;
  starts_at: string;
  ends_at: string | null;
  hero_image: string | null;
  admitted: number;
}

/**
 * The customer's own record: who they are and every pass they hold.
 *
 * Matched on email as well as the account id, so passes bought before the
 * account existed — from the last event, as a guest — show up here the moment
 * they sign up with the same address.
 */
export default async function AccountPage() {
  const account = await getCustomerAccount();
  if (!account) redirect('/login?next=/account');

  const bookings = await query<AccountBooking>(
    `SELECT b.reference, b.status, b.quantity, b.amount_paise, b.created_at,
            e.name AS event_name, e.tagline AS event_tagline, e.starts_at, e.ends_at, e.hero_image,
            (SELECT count(*)::int FROM tickets t WHERE t.booking_id = b.id AND t.checked_in_at IS NOT NULL) AS admitted
       FROM bookings b
       JOIN events e ON e.id = b.event_id
      WHERE (b.customer_id = $1 OR lower(b.customer_email) = lower($2))
        AND b.status IN ('confirmed', 'pending')
      ORDER BY e.starts_at DESC, b.created_at DESC`,
    [account.id, account.email],
  ).catch(() => []);

  const now = Date.now();
  const isPast = (b: AccountBooking) => new Date(b.ends_at ?? b.starts_at).getTime() < now;
  const upcoming = bookings.filter((b) => !isPast(b));
  const past = bookings.filter(isPast);

  // The passes themselves, QR and all, for every paid booking still ahead —
  // this page is where people will open their ticket at the door.
  const details = await Promise.all(
    upcoming
      .filter((b) => b.status === 'confirmed')
      .map((b) => getBookingByReference(b.reference).catch(() => null)),
  );
  const passes = details.filter((d): d is NonNullable<typeof d> => Boolean(d && d.tickets.length));

  return (
    <div className="shell pb-24 pt-32 sm:pt-36">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-muted">My account</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Hey {account.name.split(' ')[0]}</h1>
          <p className="mt-1 text-[0.9375rem] text-slate">{account.email}</p>
        </div>
        <SignOutButton />
      </div>

      <Section title="Upcoming" empty="No passes for an upcoming night yet.">
        {upcoming.map((b) => <BookingCard key={b.reference} booking={b} />)}
      </Section>

      <Section title="Past events" empty="Nothing here yet.">
        {past.map((b) => <BookingCard key={b.reference} booking={b} past />)}
      </Section>

      {passes.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl font-bold text-ink">My tickets</h2>
          <p className="mt-1 text-[0.875rem] text-slate">Show this QR at the door. Each pass scans once — screenshot it in case signal is patchy.</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {passes.flatMap((d) =>
              d.tickets.map((ticket, index) => (
                <TicketCard key={ticket.id} ticket={ticket} event={d.event} tier={d.tier} index={index + 1} total={d.tickets.length} />
              )),
            )}
          </div>
        </section>
      )}

      {upcoming.length === 0 && (
        <Link href="/" className="btn-primary mt-8 inline-flex">See what is on</Link>
      )}
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      {children.length === 0 ? (
        <p className="mt-3 text-[0.9375rem] text-muted">{empty}</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">{children}</ul>
      )}
    </section>
  );
}

function BookingCard({ booking, past }: { booking: AccountBooking; past?: boolean }) {
  const pending = booking.status === 'pending';
  return (
    <li className="card-print overflow-hidden">
      <div className="flex gap-4 p-4">
        {booking.hero_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={booking.hero_image} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-tight text-ink">
            {booking.event_name} {booking.event_tagline ?? ''}
          </p>
          <p className="mt-0.5 text-[0.8125rem] text-slate">{formatEventDate(booking.starts_at)}</p>
          <p className="mt-1 text-[0.8125rem] text-muted">
            {booking.quantity} {booking.quantity === 1 ? 'pass' : 'passes'} · {formatInr(booking.amount_paise)} · {booking.reference}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-edge px-4 py-3">
        <span
          className={
            pending
              ? 'text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-flare-600'
              : past
                ? 'text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-muted'
                : 'text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-leaf-600'
          }
        >
          {pending
            ? 'Payment not completed'
            : past
              ? booking.admitted > 0 ? 'Attended' : 'Past event'
              : 'Confirmed'}
        </span>
        <Link
          href={pending ? `/pay/${booking.reference}` : `/booking/${booking.reference}`}
          className={pending ? 'btn-primary py-2 text-[0.8125rem]' : 'btn-outline py-2 text-[0.8125rem]'}
        >
          {pending ? 'Complete payment' : past ? 'View' : 'View passes'}
        </Link>
      </div>
    </li>
  );
}
