import { requireSession } from '@/lib/auth';
import { customerStats, listCustomers } from '@/lib/customers';
import { formatInr } from '@/lib/utils';
import { CustomersTable } from '@/components/admin/CustomersTable';
import { StatCard } from '@/components/admin/StatCard';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Customers', robots: { index: false, follow: false } };

/**
 * The customer catalogue.
 *
 * Manager-gated rather than open to every operator: this is the one screen that
 * shows every buyer's email and phone in full and exports them to a file. Gate
 * staff scan tickets from a phone that gets handed around, and this is the page
 * that would turn a mislaid phone into a data breach.
 */
export default async function CustomersPage() {
  await requireSession('manager');

  // First page is server-rendered so the list is useful before JS boots; the
  // table takes over for search, paging and export.
  const [{ customers, total }, stats] = await Promise.all([
    listCustomers({ limit: 50 }).catch(() => ({ customers: [], total: 0 })),
    customerStats().catch(() => ({
      total: 0,
      buyers: 0,
      repeatBuyers: 0,
      lifetimePaise: 0,
      optedIn: 0,
    })),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Customers</h1>
        <p className="mt-1 text-[13px] text-slate">
          Everyone who has started a checkout, deduplicated by email. Order and spend totals count
          confirmed bookings only.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="People" value={String(stats.total)} hint="Unique email addresses" />
        <StatCard label="Buyers" value={String(stats.buyers)} hint="With a confirmed booking" />
        <StatCard
          label="Repeat"
          value={String(stats.repeatBuyers)}
          hint="More than one confirmed order"
        />
        <StatCard
          label="Revenue"
          value={formatInr(stats.lifetimePaise)}
          hint={`${stats.optedIn} opted in to updates`}
        />
      </div>

      <CustomersTable initialRows={customers} initialTotal={total} />
    </div>
  );
}
