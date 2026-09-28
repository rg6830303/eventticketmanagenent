import 'server-only';
import { serialRanges } from './utils';

/**
 * Serial numbers.
 *
 *   0–4999     promoter passes. The admin allocates an explicit range to a
 *              promoter; the promoter types the serial of each pass they sell.
 *   5001+      website and console passes, from events.next_serial.
 *
 * Everything here runs inside the caller's transaction. Promoter-range changes
 * take a per-event advisory lock, so two admins allocating at once (or a
 * promoter issuing while an admin allocates) cannot collide on a serial.
 */

export const PROMOTER_SERIAL_MIN = 0;
export const PROMOTER_SERIAL_MAX = 4999;

interface Client {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

export class SerialError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
  }
}

async function lockPromoterRange(client: Client, eventId: string): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended('promoter-serials:' || $1::text, 0))`, [eventId]);
}

/** The next `count` serials for a website or console pass. Atomic under the event row lock. */
export async function takeEventSerials(client: Client, eventId: string, count: number): Promise<number[]> {
  if (count <= 0) return [];
  const { rows } = await client.query<{ first: number }>(
    `UPDATE events SET next_serial = next_serial + $2 WHERE id = $1 RETURNING next_serial - $2 AS first`,
    [eventId, count],
  );
  const first = Number(rows[0]?.first ?? 5001);
  return Array.from({ length: count }, (_, i) => first + i);
}

function rangeOf(from: number, to: number): number[] {
  if (!Number.isInteger(from) || !Number.isInteger(to)) throw new SerialError('Enter whole serial numbers', 422);
  if (from > to) throw new SerialError('The first serial must not be after the last', 422);
  if (from < PROMOTER_SERIAL_MIN || to > PROMOTER_SERIAL_MAX) {
    throw new SerialError(`Promoter serials run from ${PROMOTER_SERIAL_MIN} to ${PROMOTER_SERIAL_MAX}`, 422);
  }
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/**
 * Allocate an exact serial range to a promoter. Refuses the whole range if any
 * serial in it already belongs to someone or is on a pass, and says which.
 */
export async function allocateSerialRange(
  client: Client,
  eventId: string,
  promoterId: string,
  from: number,
  to: number,
): Promise<number[]> {
  const serials = rangeOf(from, to);
  await lockPromoterRange(client, eventId);
  const { rows: taken } = await client.query<{ serial: number; name: string | null }>(
    `SELECT s AS serial, p.name
       FROM unnest($2::int[]) s
       LEFT JOIN promoter_serials ps ON ps.event_id = $1 AND ps.serial = s
       LEFT JOIN promoters p ON p.id = ps.promoter_id
      WHERE ps.serial IS NOT NULL
         OR EXISTS (SELECT 1 FROM tickets t WHERE t.event_id = $1 AND t.serial = s)`,
    [eventId, serials],
  );
  if (taken.length > 0) {
    const owners = [...new Set(taken.map((r) => r.name).filter(Boolean))];
    throw new SerialError(
      `#${serialRanges(taken.map((r) => Number(r.serial)))} ${taken.length === 1 ? 'is' : 'are'} already allocated` +
        (owners.length ? ` (to ${owners.join(', ')})` : '') +
        '. Choose a free range.',
    );
  }
  await client.query(
    `INSERT INTO promoter_serials (event_id, serial, promoter_id) SELECT $1, s, $2 FROM unnest($3::int[]) s`,
    [eventId, promoterId, serials],
  );
  return serials;
}

/**
 * Take an exact range back from a promoter. Only unsold serials are released;
 * sold ones are in customers' hands, so a range containing any is refused.
 */
export async function releaseSerialRange(client: Client, promoterId: string, from: number, to: number): Promise<number[]> {
  const serials = rangeOf(from, to);
  const { rows } = await client.query<{ serial: number; ticket_id: string | null }>(
    'SELECT serial, ticket_id FROM promoter_serials WHERE promoter_id = $1 AND serial = ANY($2::int[])',
    [promoterId, serials],
  );
  if (rows.length === 0) throw new SerialError(`None of #${serialRanges(serials)} is allocated to this promoter`, 422);
  const sold = rows.filter((r) => r.ticket_id).map((r) => Number(r.serial));
  if (sold.length > 0) {
    throw new SerialError(`#${serialRanges(sold)} ${sold.length === 1 ? 'is' : 'are'} already sold and cannot be taken back. Deactivate the pass instead.`);
  }
  await client.query('DELETE FROM promoter_serials WHERE promoter_id = $1 AND serial = ANY($2::int[])', [
    promoterId,
    rows.map((r) => Number(r.serial)),
  ]);
  return rows.map((r) => Number(r.serial)).sort((a, b) => a - b);
}

/**
 * Claim the exact serials a promoter typed for a sale. Each must be in their
 * allocated range and not yet sold; the rows are locked so two phones cannot
 * sell the same serial.
 */
export async function claimRequestedSerials(
  client: Client,
  eventId: string,
  promoterId: string,
  requested: number[],
): Promise<number[]> {
  await lockPromoterRange(client, eventId);
  const { rows } = await client.query<{ serial: number; ticket_id: string | null }>(
    `SELECT serial, ticket_id FROM promoter_serials
      WHERE promoter_id = $1 AND event_id = $2 AND serial = ANY($3::int[])
      FOR UPDATE`,
    [promoterId, eventId, requested],
  );
  const mine = new Map(rows.map((r) => [Number(r.serial), r.ticket_id]));
  const notMine = requested.filter((s) => !mine.has(s));
  if (notMine.length > 0) {
    throw new SerialError(`#${serialRanges(notMine)} ${notMine.length === 1 ? 'is' : 'are'} not in your allocated range`, 422);
  }
  const sold = requested.filter((s) => mine.get(s));
  if (sold.length > 0) throw new SerialError(`#${serialRanges(sold)} ${sold.length === 1 ? 'is' : 'are'} already sold`);
  return requested;
}
