import { requireSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { CheckinFeed } from '@/components/admin/CheckinFeed';
import type { ScanLogRow } from '@/app/api/admin/checkins/route';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Door log', robots: { index: false, follow: false } };

export default async function CheckinsPage() {
  await requireSession();

  const rows = await query<ScanLogRow>(
    `SELECT s.id::text, s.result, s.message, s.gate, s.created_at,
            t.code AS ticket_code, t.holder_name,
            e.name AS event_name, a.name AS operator_name
     FROM scan_log s
     LEFT JOIN tickets t     ON t.id = s.ticket_id
     LEFT JOIN events e      ON e.id = s.event_id
     LEFT JOIN admin_users a ON a.id = s.operator_id
     ORDER BY s.created_at DESC
     LIMIT 50`,
  ).catch(() => []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-chalk">Door log</h1>
        <p className="mt-1 text-[13px] text-haze">
          Every scan attempt, including rejections. Nothing here is ever deleted.
        </p>
      </div>

      <CheckinFeed initialRows={rows} />
    </div>
  );
}
