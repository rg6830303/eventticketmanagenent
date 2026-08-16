import type { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ScanLogRow {
  id: string;
  result: string;
  message: string | null;
  gate: string | null;
  created_at: string;
  ticket_code: string | null;
  holder_name: string | null;
  event_name: string | null;
  operator_name: string | null;
}

/**
 * Door feed. `since` lets the client poll for deltas instead of re-fetching the
 * whole list every few seconds.
 */
export async function GET(request: NextRequest) {
  try {
    await requireSession();

    const url = new URL(request.url);
    const since = url.searchParams.get('since');
    const limit = Math.min(200, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '50', 10) || 50));

    const params: unknown[] = [];
    let whereSql = '';
    if (since) {
      const parsed = new Date(since);
      if (!Number.isNaN(parsed.getTime())) {
        params.push(parsed.toISOString());
        whereSql = `WHERE s.created_at > $${params.length}`;
      }
    }

    params.push(limit);
    const rows = await query<ScanLogRow>(
      `SELECT s.id::text, s.result, s.message, s.gate, s.created_at,
              t.code AS ticket_code, t.holder_name,
              e.name AS event_name, a.name AS operator_name
       FROM scan_log s
       LEFT JOIN tickets t     ON t.id = s.ticket_id
       LEFT JOIN events e      ON e.id = s.event_id
       LEFT JOIN admin_users a ON a.id = s.operator_id
       ${whereSql}
       ORDER BY s.created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    return ok({ rows, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return handleError(error, 'admin.checkins');
  }
}
