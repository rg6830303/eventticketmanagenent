import { requireSession } from '@/lib/auth';
import { listPublishedEvents } from '@/lib/bookings';
import { QrScanner } from '@/components/admin/QrScanner';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Scan tickets',
  robots: { index: false, follow: false },
};

export default async function ScanPage() {
  await requireSession('gate');

  const events = await listPublishedEvents().catch(() => []);
  const options = events.map((event) => ({ slug: event.slug, name: event.name }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-chalk">Scan tickets</h1>
        <p className="mt-1 text-[13px] text-haze">
          Each pass admits one person and works exactly once.
        </p>
      </div>

      <QrScanner events={options} />
    </div>
  );
}
