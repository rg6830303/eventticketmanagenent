import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { EventEditor } from '@/components/admin/EventEditor';
import type { EventRow, TicketTierRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit event', robots: { index: false, follow: false } };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession('manager');
  const { id } = await params;

  const event = await queryOne<EventRow>('SELECT * FROM events WHERE id = $1', [id]).catch(
    () => null,
  );
  if (!event) notFound();

  const tiers = await query<TicketTierRow & { price_unit: string }>(
    `SELECT * FROM ticket_tiers WHERE event_id = $1 ORDER BY sort_order ASC, price_paise ASC`,
    [id],
  ).catch(() => []);

  return (
    <div className="space-y-5">
      <Link href="/admin/events" className="text-[13px] font-medium text-slate hover:text-ink">
        ← All events
      </Link>

      <EventEditor event={event} tiers={tiers} />
    </div>
  );
}
