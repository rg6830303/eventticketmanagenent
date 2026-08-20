import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasRole, requireSession } from '@/lib/auth';
import { getBookingById } from '@/lib/bookings';
import { query } from '@/lib/db';
import { cn, formatDateTime, formatEventDate, formatInr } from '@/lib/utils';
import { BookingActions } from '@/components/admin/BookingActions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Booking', robots: { index: false, follow: false } };

interface EmailLogRow {
  id: string;
  recipient: string;
  subject: string;
  template: string;
  status: string;
  error: string | null;
  created_at: string;
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const detail = await getBookingById(id);
  if (!detail) notFound();

  const { booking, event, tier, tickets } = detail;

  const emails = await query<EmailLogRow>(
    `SELECT id::text, recipient, subject, template, status, error, created_at
     FROM email_log WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [booking.id],
  ).catch(() => []);

  const usedCount = tickets.filter((t) => t.status === 'used').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/bookings" className="text-[12px] text-vybe-600 hover:text-vybe-700">
            ← All bookings
          </Link>
          <h1 className="mt-2 font-mono text-2xl font-bold text-ink">{booking.reference}</h1>
          <p className="mt-1 text-[13px] text-slate">
            {event.name} · {formatEventDate(event.starts_at)}
          </p>
        </div>
        <BookingActions
          bookingId={booking.id}
          reference={booking.reference}
          status={booking.status}
          canVoid={hasRole(session.role, 'manager')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="mb-4 font-display text-base font-semibold text-ink">Guest</h2>
          <dl className="space-y-3 text-[13px]">
            <Field label="Name" value={booking.customer_name} />
            {/* Full contact details are shown here and nowhere else in the console. */}
            <Field label="Email" value={booking.customer_email} mono link={`mailto:${booking.customer_email}`} />
            <Field label="Phone" value={`+91 ${booking.customer_phone}`} mono link={`tel:+91${booking.customer_phone}`} />
            <Field label="Booked" value={formatDateTime(booking.created_at)} />
            <Field label="Source" value={booking.source ?? 'web'} />
            <Field
              label="Ticket email"
              value={booking.email_sent_at ? `Sent ${formatDateTime(booking.email_sent_at)}` : 'Not sent yet'}
            />
          </dl>
        </section>

        <section className="panel p-5">
          <h2 className="mb-4 font-display text-base font-semibold text-ink">Order</h2>
          <dl className="space-y-3 text-[13px]">
            <Field label="Status" value={booking.status} />
            <Field label="Tier" value={tier?.name ?? 'General Entry'} />
            <Field label="Quantity" value={String(booking.quantity)} />
            <Field
              label="Amount"
              value={booking.amount_paise === 0 ? 'Complimentary entry' : formatInr(booking.amount_paise)}
            />
            <Field label="Payment" value={booking.payment_provider} />
            {booking.payment_id && <Field label="Payment id" value={booking.payment_id} mono />}
            <Field label="Checked in" value={`${usedCount} of ${tickets.length}`} />
          </dl>
        </section>
      </div>

      <section className="panel p-5">
        <h2 className="mb-4 font-display text-base font-semibold text-ink">
          Passes ({tickets.length})
        </h2>
        <ul className="divide-y divide-edge">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-mono text-[12px] text-ink">{ticket.code}</p>
                <p className="text-[12px] text-slate">
                  {ticket.holder_name}
                  {ticket.seat_label && <span className="text-muted"> · {ticket.seat_label}</span>}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase',
                    ticket.status === 'valid'
                      ? 'border-vybe-500/40 bg-vybe-500/10 text-vybe-700'
                      : ticket.status === 'used'
                        ? 'border-edge bg-frost text-slate'
                        : 'border-red-500/40 bg-red-500/10 text-red-200',
                  )}
                >
                  {ticket.status}
                </span>
                {ticket.checked_in_at && (
                  <p className="mt-1 text-[10px] text-muted">
                    {formatDateTime(ticket.checked_in_at)}
                    {ticket.checked_in_gate && ` · ${ticket.checked_in_gate}`}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel p-5">
        <h2 className="mb-1 font-display text-base font-semibold text-ink">Email delivery</h2>
        <p className="mb-4 text-[12px] text-muted">
          Every attempt is recorded, so &quot;the ticket never arrived&quot; is answerable.
        </p>
        {emails.length === 0 ? (
          <p className="py-4 text-[13px] text-muted">No emails logged for this booking.</p>
        ) : (
          <ul className="divide-y divide-edge">
            {emails.map((email) => (
              <li key={email.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[12px] text-ink">{email.subject}</p>
                  <span
                    className={cn(
                      'shrink-0 font-mono text-[10px] uppercase',
                      email.status === 'sent' ? 'text-vybe-600' : 'text-red-300',
                    )}
                  >
                    {email.status}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted">
                  {email.recipient} · {formatDateTime(email.created_at)}
                </p>
                {email.error && <p className="mt-1 text-[11px] text-red-300">{email.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  link,
}: {
  label: string;
  value: string;
  mono?: boolean;
  link?: string;
}) {
  const content = <span className={cn('text-ink', mono && 'font-mono text-[12px]')}>{value}</span>;
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right capitalize">
        {link ? (
          <a href={link} className="text-vybe-600 hover:text-vybe-700">
            {content}
          </a>
        ) : (
          content
        )}
      </dd>
    </div>
  );
}
