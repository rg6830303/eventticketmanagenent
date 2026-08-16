import type { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set(['pending', 'confirmed', 'cancelled', 'refunded', 'failed']);

export interface AdminBookingRow {
  id: string;
  reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  quantity: number;
  amount_paise: number;
  status: string;
  created_at: string;
  event_name: string;
  event_slug: string;
  tier_name: string | null;
  tickets_total: number;
  tickets_used: number;
}

export async function GET(request: NextRequest) {
  try {
    await requireSession();

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const status = url.searchParams.get('status') ?? '';
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(5, Number.parseInt(url.searchParams.get('limit') ?? '25', 10) || 25));
    const offset = (page - 1) * limit;

    // Filters are appended as numbered placeholders — `q` never reaches the SQL
    // string itself, so a reference like "'; DROP" is just a search term.
    const where: string[] = [];
    const params: unknown[] = [];

    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      const p = `$${params.length}`;
      where.push(
        `(lower(b.reference) LIKE ${p} OR lower(b.customer_name) LIKE ${p}
          OR lower(b.customer_email) LIKE ${p} OR b.customer_phone LIKE ${p})`,
      );
    }
    if (status && ALLOWED_STATUSES.has(status)) {
      params.push(status);
      where.push(`b.status = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRows = await query<{ total: string }>(
      `SELECT count(*)::text AS total FROM bookings b ${whereSql}`,
      params,
    );

    params.push(limit, offset);
    const rows = await query<AdminBookingRow>(
      `SELECT b.id, b.reference, b.customer_name, b.customer_email, b.customer_phone,
              b.quantity, b.amount_paise, b.status, b.created_at,
              e.name AS event_name, e.slug AS event_slug, tt.name AS tier_name,
              (SELECT count(*) FROM tickets t WHERE t.booking_id = b.id)::int AS tickets_total,
              (SELECT count(*) FROM tickets t WHERE t.booking_id = b.id AND t.status = 'used')::int AS tickets_used
       FROM bookings b
       JOIN events e ON e.id = b.event_id
       LEFT JOIN ticket_tiers tt ON tt.id = b.tier_id
       ${whereSql}
       ORDER BY b.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return ok({ rows, total: Number(countRows[0]?.total ?? 0), page, limit });
  } catch (error) {
    return handleError(error, 'admin.bookings.list');
  }
}
