import type { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import type { EventRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface AdminStats {
  event: { slug: string; name: string; startsAt: string; capacity: number } | null;
  /** Distinct people, not bookings — one person booking twice is one customer. */
  customers: number;
  bookings: number;
  ticketsIssued: number;
  checkedIn: number;
  /** Issued but not yet through the door. */
  yetToArrive: number;
  capacityUsed: number;
  revenuePaise: number;
  scansLastHour: number;
  duplicatesBlocked: number;
  lastScanAt: string | null;
  updatedAt: string;
}

interface Row {
  customers: string;
  bookings: string;
  tickets: string;
  used: string;
  revenue: string;
  attendees: string;
  scans_hour: string;
  duplicates: string;
  last_scan: string | null;
}

/**
 * Live counters for the dashboard, polled by the console.
 *
 * Everything is computed from the same tables the door writes to, so the
 * numbers move the instant a pass is scanned. `duplicatesBlocked` is deliberately
 * surfaced: it is the visible proof that single-use enforcement is working.
 */
export async function GET(request: NextRequest) {
  try {
    await requireSession();

    const slug = new URL(request.url).searchParams.get('event');

    const event = slug
      ? await queryOne<EventRow>('SELECT * FROM events WHERE slug = $1', [slug])
      : await queryOne<EventRow>(
          `SELECT * FROM events
           WHERE status IN ('published','sold_out')
           ORDER BY (starts_at < now()), starts_at ASC
           LIMIT 1`,
        );

    if (!event) {
      return ok<AdminStats>({
        event: null,
        customers: 0,
        bookings: 0,
        ticketsIssued: 0,
        checkedIn: 0,
        yetToArrive: 0,
        capacityUsed: 0,
        revenuePaise: 0,
        scansLastHour: 0,
        duplicatesBlocked: 0,
        lastScanAt: null,
        updatedAt: new Date().toISOString(),
      });
    }

    const row = await queryOne<Row>(
      `SELECT
         (SELECT count(DISTINCT lower(customer_email)) FROM bookings
            WHERE event_id = $1 AND status = 'confirmed')::text                       AS customers,
         (SELECT count(*) FROM bookings
            WHERE event_id = $1 AND status = 'confirmed')::text                       AS bookings,
         (SELECT count(*) FROM tickets WHERE event_id = $1)::text                     AS tickets,
         (SELECT count(*) FROM tickets
            WHERE event_id = $1 AND status = 'used')::text                            AS used,
         (SELECT COALESCE(SUM(amount_paise),0) FROM bookings
            WHERE event_id = $1 AND status = 'confirmed')::text                       AS revenue,
         (SELECT COALESCE(SUM(quantity),0) FROM bookings
            WHERE event_id = $1 AND status IN ('pending','confirmed'))::text          AS attendees,
         (SELECT count(*) FROM scan_log
            WHERE event_id = $1 AND created_at > now() - interval '1 hour')::text     AS scans_hour,
         (SELECT count(*) FROM scan_log
            WHERE event_id = $1 AND result = 'duplicate')::text                       AS duplicates,
         (SELECT max(created_at) FROM scan_log WHERE event_id = $1)                   AS last_scan`,
      [event.id],
    );

    const ticketsIssued = Number(row?.tickets ?? 0);
    const checkedIn = Number(row?.used ?? 0);
    const attendees = Number(row?.attendees ?? 0);

    return ok<AdminStats>({
      event: {
        slug: event.slug,
        name: event.name,
        startsAt: event.starts_at,
        capacity: event.capacity,
      },
      customers: Number(row?.customers ?? 0),
      bookings: Number(row?.bookings ?? 0),
      ticketsIssued,
      checkedIn,
      yetToArrive: Math.max(0, ticketsIssued - checkedIn),
      capacityUsed: event.capacity > 0 ? Math.round((attendees / event.capacity) * 100) : 0,
      revenuePaise: Number(row?.revenue ?? 0),
      scansLastHour: Number(row?.scans_hour ?? 0),
      duplicatesBlocked: Number(row?.duplicates ?? 0),
      lastScanAt: row?.last_scan ? new Date(row.last_scan).toISOString() : null,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, 'admin.stats');
  }
}
