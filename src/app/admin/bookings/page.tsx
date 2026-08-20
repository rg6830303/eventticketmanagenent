import { requireSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { BookingsTable } from '@/components/admin/BookingsTable';
import type { AdminBookingRow } from '@/app/api/admin/bookings/route';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Bookings', robots: { index: false, follow: false } };

export default async function BookingsPage() {
  await requireSession();

  // First page is server-rendered so the list is useful before JS boots; the
  // table takes over for search and pagination.
  const rows = await query<AdminBookingRow>(
    `SELECT b.id, b.reference, b.customer_name, b.customer_email, b.customer_phone,
            b.quantity, b.amount_paise, b.status, b.created_at,
            e.name AS event_name, e.slug AS event_slug, tt.name AS tier_name,
            (SELECT count(*) FROM tickets t WHERE t.booking_id = b.id)::int AS tickets_total,
            (SELECT count(*) FROM tickets t WHERE t.booking_id = b.id AND t.status = 'used')::int AS tickets_used
     FROM bookings b
     JOIN events e ON e.id = b.event_id
     LEFT JOIN ticket_tiers tt ON tt.id = b.tier_id
     ORDER BY b.created_at DESC
     LIMIT 25`,
  ).catch(() => []);

  const totalRows = await query<{ total: string }>('SELECT count(*)::text AS total FROM bookings').catch(
    () => [{ total: '0' }],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Bookings</h1>
        <p className="mt-1 text-[13px] text-slate">
          Contact details are masked here. Open a booking to see them in full.
        </p>
      </div>

      <BookingsTable initialRows={rows} initialTotal={Number(totalRows[0]?.total ?? 0)} />
    </div>
  );
}
