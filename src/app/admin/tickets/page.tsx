import { requireSession } from '@/lib/auth';
import { getEventBySlug, listIssuedBookings, listTiers } from '@/lib/bookings';
import { FEATURED_EVENT_SLUG } from '@/content/site';
import { IssueTicket, type TierOption } from '@/components/admin/IssueTicket';

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

  const event = await getEventBySlug(FEATURED_EVENT_SLUG).catch(() => null);
  const tierRows = event ? await listTiers(event.id).catch(() => []) : [];

  const tiers: TierOption[] = tierRows.map((tier) => ({
    code: tier.code,
    name: tier.name,
    pricePaise: tier.price_paise,
    admits: tier.admits,
    remaining: Math.max(0, tier.quantity - tier.sold),
  }));

  const issued = await listIssuedBookings(30).catch(() => []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Tickets</h1>
        <p className="mt-1 text-[13px] text-slate">
          Issue passes without a payment — comps, guest list, cash at the door, or a replacement for
          a booking that went wrong. The QR codes are identical to bought ones and scan the same way.
        </p>
      </div>

      <IssueTicket tiers={tiers} initialIssued={issued} />
    </div>
  );
}
