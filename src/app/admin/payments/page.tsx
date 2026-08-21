import { requireSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { listUpiClaims } from '@/lib/upi-claims';
import { UpiClaimQueue, type UpiClaimItem } from '@/components/admin/UpiClaimQueue';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'UPI payments', robots: { index: false, follow: false } };

/**
 * The manual half of the UPI rail.
 *
 * Everything a customer has declared but nobody has confirmed lives here.
 * Until someone works this queue, those bookings hold inventory and have no
 * passes — which is why the empty state matters as much as the full one.
 */
export default async function AdminPaymentsPage() {
  await requireSession('manager');

  const rows = await listUpiClaims('submitted').catch(() => []);

  const claims: UpiClaimItem[] = rows.map((row) => ({
    id: row.id,
    utr: row.utr,
    amountPaise: row.amount_paise,
    createdAt: row.created_at,
    reference: row.reference,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    quantity: row.quantity,
    eventName: row.event_name,
    bookingAmountPaise: row.booking_amount_paise,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[1.75rem] font-semibold tracking-[-0.03em] text-ink">
            UPI payments
          </h1>
          <p className="mt-1 text-[0.875rem] text-slate">
            {claims.length === 0
              ? 'No claims waiting.'
              : `${claims.length} waiting. Match each UTR in your banking app before releasing passes.`}
          </p>
        </div>
        <span
          className={
            env.upi.enabled
              ? 'chip'
              : 'chip chip-hot'
          }
        >
          {env.upi.enabled ? `Collecting to ${env.upi.vpa}` : 'UPI collection is off'}
        </span>
      </header>

      {!env.upi.enabled && (
        <div className="card-print border-flare-500 p-4 text-[0.8125rem] leading-relaxed text-flare-600">
          <p className="font-semibold">UPI_ENABLED is not set</p>
          <p className="mt-1.5">
            Customers cannot reach the UPI option, but anything claimed before it was switched off
            still needs settling below.
          </p>
        </div>
      )}

      <UpiClaimQueue claims={claims} />
    </div>
  );
}
