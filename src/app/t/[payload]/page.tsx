import Link from 'next/link';
import type { Metadata } from 'next';
import { queryOne } from '@/lib/db';
import { qrDataUrl } from '@/lib/qr';
import { buildQrPayload, parseQrPayload } from '@/lib/tickets';
import { formatEventDate, formatEventTime, formatDateTime } from '@/lib/utils';
import { Logo } from '@/components/site/Logo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Entry pass',
  robots: { index: false, follow: false },
};

interface PassRow {
  code: string;
  holder_name: string;
  seat_label: string | null;
  status: string;
  checked_in_at: string | null;
  booking_reference: string;
  booking_status: string;
  event_name: string;
  event_slug: string;
  venue_name: string;
  venue_address: string | null;
  starts_at: string;
  doors_at: string | null;
  age_limit: number;
  tier_name: string | null;
}

/**
 * The single pass a guest opens from their email and holds up at the door.
 *
 * Deliberately outside the (site) route group: no marketing nav, nothing above
 * the QR that would push it below the fold on a phone.
 */
export default async function TicketPage({ params }: { params: Promise<{ payload: string }> }) {
  const { payload } = await params;
  const decoded = decodeURIComponent(payload);
  const parsed = parseQrPayload(decoded);

  if (!parsed.valid) {
    const reason =
      parsed.reason === 'signature'
        ? 'This pass failed its security check. It may have been edited or copied incorrectly.'
        : parsed.reason === 'version'
          ? 'This pass was issued by an older system and can no longer be read.'
          : 'This link is not a valid Houz of Vybe pass.';
    return <PassError reason={reason} />;
  }

  const pass = await queryOne<PassRow>(
    `SELECT t.code, t.holder_name, t.seat_label, t.status, t.checked_in_at,
            b.reference AS booking_reference, b.status AS booking_status,
            e.name AS event_name, e.slug AS event_slug, e.venue_name, e.venue_address,
            e.starts_at, e.doors_at, e.age_limit,
            tt.name AS tier_name
     FROM tickets t
     JOIN bookings b ON b.id = t.booking_id
     JOIN events e   ON e.id = t.event_id
     LEFT JOIN ticket_tiers tt ON tt.id = t.tier_id
     WHERE t.code = $1`,
    [parsed.code],
  ).catch(() => null);

  if (!pass) {
    return <PassError reason="We could not find a ticket with this code." />;
  }

  const qr = await qrDataUrl(buildQrPayload(pass.code), 620);

  const dead =
    pass.status === 'void' ||
    pass.status === 'refunded' ||
    pass.booking_status === 'cancelled' ||
    pass.booking_status === 'refunded';
  const used = pass.status === 'used';

  return (
    <div className="min-h-dvh bg-void">
      <header className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
        <Link href="/" aria-label="Houz of Vybe — home">
          <Logo compact />
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-dim">Entry pass</span>
      </header>

      <main className="mx-auto w-full max-w-md px-5 py-6">
        <div className="card card-lit overflow-hidden">
          <div className="border-b border-hairline bg-gradient-to-br from-vybe-900/60 to-surface px-5 py-4 text-center">
            <p className="font-display text-lg font-bold leading-tight text-chalk">
              {pass.event_name}
            </p>
            <p className="mt-0.5 text-[12px] text-haze">
              {formatEventDate(pass.starts_at)} · doors{' '}
              {formatEventTime(pass.doors_at ?? pass.starts_at)}
            </p>
          </div>

          {/* White plate: QR contrast is not negotiable, whatever the site theme. */}
          <div className="bg-white p-5">
            <div className="relative mx-auto w-full max-w-[320px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt={`QR entry pass ${pass.code}`}
                width={620}
                height={620}
                className={dead || used ? 'w-full opacity-25' : 'w-full'}
              />
              {(dead || used) && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="-rotate-12 rounded-lg border-4 border-red-600 px-4 py-2 font-display text-2xl font-extrabold uppercase tracking-wider text-red-600">
                    {dead ? 'Cancelled' : 'Checked in'}
                  </span>
                </span>
              )}
            </div>
            <p className="mt-3 text-center font-mono text-[13px] font-bold tracking-[0.12em] text-[#050b1c]">
              {pass.code}
            </p>
          </div>

          <div className="space-y-3 p-5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-dim">Admit</p>
              <p className="font-display text-xl font-bold leading-tight text-chalk">
                {pass.holder_name}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12px]">
              <Item label="Ticket type" value={pass.tier_name ?? 'General Entry'} />
              <Item label="Booking" value={pass.booking_reference} mono />
              {pass.seat_label && <Item label="Pass" value={pass.seat_label} mono />}
              <Item label="Entry" value={`${pass.age_limit}+ · photo ID`} />
            </dl>

            <div className="border-t border-hairline pt-3">
              <p className="text-[10px] uppercase tracking-wider text-dim">Venue</p>
              <p className="mt-0.5 text-[13px] text-chalk">{pass.venue_name}</p>
              {pass.venue_address && (
                <p className="text-[12px] leading-relaxed text-haze">{pass.venue_address}</p>
              )}
            </div>

            <div
              className={
                dead
                  ? 'rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5'
                  : used
                    ? 'rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2.5'
                    : 'rounded-lg border border-vybe-500/40 bg-vybe-500/10 px-3 py-2.5'
              }
            >
              <p
                className={
                  dead
                    ? 'text-[12px] font-medium text-red-200'
                    : used
                      ? 'text-[12px] font-medium text-amber-200'
                      : 'text-[12px] font-medium text-vybe-200'
                }
              >
                {dead
                  ? 'This pass has been cancelled and will not admit entry.'
                  : used
                    ? `Already checked in${pass.checked_in_at ? ` at ${formatDateTime(pass.checked_in_at)}` : ''}.`
                    : 'Valid — show this screen at the door.'}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-dim">
          Screenshot this page. The QR works offline and the venue has patchy signal.
        </p>

        <p className="mt-4 text-center">
          <Link href="/contact" className="text-[12px] text-vybe-300 hover:text-vybe-200">
            Something wrong? Contact us
          </Link>
        </p>
      </main>
    </div>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-dim">{label}</dt>
      <dd className={mono ? 'mt-0.5 font-mono text-[12px] text-chalk' : 'mt-0.5 text-chalk'}>
        {value}
      </dd>
    </div>
  );
}

function PassError({ reason }: { reason: string }) {
  return (
    <div className="flex min-h-dvh flex-col bg-void">
      <header className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
        <Link href="/" aria-label="Houz of Vybe — home">
          <Logo compact />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="card w-full max-w-sm p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10">
            <span aria-hidden className="text-2xl text-red-300">
              !
            </span>
          </div>
          <h1 className="font-display text-xl font-bold text-chalk">
            This pass could not be verified
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-haze">{reason}</p>
          <div className="mt-7 flex flex-col gap-2">
            <Link href="/contact" className="btn-primary">
              Contact support
            </Link>
            <Link href="/" className="btn-ghost">
              Back to the site
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
