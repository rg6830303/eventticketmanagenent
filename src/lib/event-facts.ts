import 'server-only';
import { query, queryOne } from './db';
import type { EventRow } from './types';

/**
 * Which events the platform is about.
 *
 * The site used to be built around one hard-coded night. Houz of Vybe runs
 * more than one, so the answer now comes from the events table: the soonest
 * event still ahead is featured, and everything that has already happened is
 * an archive. Announcing the next drop in the console moves the site to it
 * without a code change.
 */

export interface EventWithStats extends EventRow {
  tickets_sold: number;
  checked_in: number;
  bookings: number;
  revenue_paise: number;
}

/** Past means the doors have opened and closed, not that sales have stopped. */
export function isPastEvent(event: Pick<EventRow, 'starts_at' | 'ends_at'>): boolean {
  const end = event.ends_at ?? event.starts_at;
  return new Date(end).getTime() < Date.now();
}

/**
 * The event the platform leads with.
 *
 * Soonest upcoming wins. With nothing upcoming, the most recent past event
 * stands in rather than an empty page — somebody arriving between drops should
 * still see what we do.
 */
export async function getFeaturedEvent(): Promise<EventRow | null> {
  return queryOne<EventRow>(
    `SELECT * FROM events
      WHERE status IN ('published', 'sold_out')
      ORDER BY (COALESCE(ends_at, starts_at) < now()) ASC,
               CASE WHEN COALESCE(ends_at, starts_at) >= now() THEN starts_at END ASC,
               starts_at DESC
      LIMIT 1`,
  ).catch(() => null);
}

export async function listUpcomingEvents(): Promise<EventRow[]> {
  return query<EventRow>(
    `SELECT * FROM events
      WHERE status IN ('published', 'sold_out') AND COALESCE(ends_at, starts_at) >= now()
      ORDER BY starts_at ASC`,
  ).catch(() => []);
}

const STATS = `
  (SELECT count(*)::int FROM tickets t WHERE t.event_id = e.id AND t.status IN ('valid','used')) AS tickets_sold,
  (SELECT count(*)::int FROM tickets t WHERE t.event_id = e.id AND t.checked_in_at IS NOT NULL) AS checked_in,
  (SELECT count(*)::int FROM bookings b WHERE b.event_id = e.id AND b.status = 'confirmed') AS bookings,
  (SELECT COALESCE(sum(b.amount_paise),0)::bigint FROM bookings b WHERE b.event_id = e.id AND b.status = 'confirmed') AS revenue_paise`;

export async function listPastEvents(): Promise<EventWithStats[]> {
  const rows = await query<EventWithStats>(
    `SELECT e.*, ${STATS} FROM events e
      WHERE e.status IN ('published', 'sold_out', 'archived') AND COALESCE(e.ends_at, e.starts_at) < now()
      ORDER BY e.starts_at DESC`,
  ).catch(() => []);
  return rows.map((r) => ({ ...r, revenue_paise: Number(r.revenue_paise) }));
}

/** Every event with its numbers, for the console. */
export async function listAllEventsWithStats(): Promise<EventWithStats[]> {
  const rows = await query<EventWithStats>(
    `SELECT e.*, ${STATS} FROM events e ORDER BY e.starts_at DESC`,
  ).catch(() => []);
  return rows.map((r) => ({ ...r, revenue_paise: Number(r.revenue_paise) }));
}
