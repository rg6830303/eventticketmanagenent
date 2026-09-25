import { requireSession } from '@/lib/auth';
import { getEventBySlug, listIssuedBookings, listTiers } from '@/lib/bookings';
import { getFeaturedEvent } from '@/lib/event-facts';
import { listLedger } from '@/lib/ticket-ledger';
import { IssueTicket, type TierOption } from '@/components/admin/IssueTicket';
import { TicketTable } from '@/components/admin/TicketTable';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Tickets', robots: { index: false, follow: false } };

/**
 * Issue passes by hand.
 *
 * Manager-gated: this mints valid entry passes without a payment, which is a
 * commercial decision rather than a door one. Every issue is written to the
 * audit log with the operator's identity.
 */
export default async function TicketsPage() {
  await requireSession('manager');

  const event = await getFeaturedEvent();
  const tierRows = event ? await listTiers(event.id).catch(() => []) : [];

  const tiers: TierOption[] = tierRows.map((tier) => ({
    code: tier.code,
    name: tier.name,
    pricePaise: tier.price_paise,
    admits: tier.admits,
    remaining: Math.max(0, tier.quantity - tier.sold),
  }));

  const [issued, consolePasses] = await Promise.all([
    listIssuedBookings(30).catch(() => []),
    event ? listLedger({ eventId: event.id, source: 'admin' }).catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Tickets</h1>
        <p className="mt-1 text-[13px] text-slate">
          Issue passes without a payment — comps, guest list, cash at the door, or a replacement for
          a booking that went wrong. Customers get a link to their live pass page (no QR image in the email), and each
          pass gets a serial from 5001 up.
        </p>
      </div>

      <IssueTicket tiers={tiers} initialIssued={issued} />

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Console-issued passes ({consolePasses.length})
        </h2>
        <p className="text-[12px] text-slate">
          Switch any of these on or off at the door. The customer&apos;s pass link shows the live state; nothing is emailed.
        </p>
        <TicketTable tickets={consolePasses} exportName="console-passes" />
      </section>
    </div>
  );
}
