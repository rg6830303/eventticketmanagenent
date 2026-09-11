import { requireSession } from '@/lib/auth';
import { listPublishedEvents } from '@/lib/bookings';
import { QrScanner } from '@/components/admin/QrScanner';
import { TicketLookup } from '@/components/admin/TicketLookup';

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
        <h1 className="font-display text-2xl font-bold text-ink">Scan tickets</h1>
        <p className="mt-1 text-[13px] text-slate">
          Each pass admits one person and works exactly once.
        </p>
      </div>

      <QrScanner events={options} />

      {/*
        Below the scanner, not above it: the QR is the way in, and this is the
        fallback for a customer who cannot show one. Putting it second keeps the
        camera the obvious first move.
      */}
      <TicketLookup />
    </div>
  );
}
