import 'server-only';

/**
 * Serial numbers.
 *
 *   1000–5000  promoter passes, reserved to a promoter at allocation time
 *   5001+      website and console passes, from events.next_serial
 *
 * Everything here runs inside the caller's transaction. Promoter-range changes
 * take a per-event advisory lock, so two admins allocating at once (or a
 * promoter issuing while an admin allocates) cannot reserve the same serial.
 */

export const PROMOTER_SERIAL_MIN = 1000;
export const PROMOTER_SERIAL_MAX = 5000;

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

/** Lowest free serials in the promoter range for this event. */
async function freePromoterSerials(client: Client, eventId: string, count: number): Promise<number[]> {
  const { rows } = await client.query<{ s: number }>(
    `SELECT s FROM generate_series(${PROMOTER_SERIAL_MIN}, ${PROMOTER_SERIAL_MAX}) s
      WHERE NOT EXISTS (SELECT 1 FROM promoter_serials p WHERE p.event_id = $1 AND p.serial = s)
        AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.event_id = $1 AND t.serial = s)
      ORDER BY s LIMIT $2`,
    [eventId, count],
  );
  return rows.map((r) => Number(r.s));
}

/** Reserve `count` serials to a promoter. Fails if the 1000–5000 range cannot hold them. */
export async function reservePromoterSerials(client: Client, eventId: string, promoterId: string, count: number): Promise<number[]> {
  if (count <= 0) return [];
  await lockPromoterRange(client, eventId);
  const serials = await freePromoterSerials(client, eventId, count);
  if (serials.length < count) {
    throw new SerialError(
      `Only ${serials.length} promoter serials (${PROMOTER_SERIAL_MIN}–${PROMOTER_SERIAL_MAX}) are free for this event.`,
    );
  }
  await client.query(
    `INSERT INTO promoter_serials (event_id, serial, promoter_id)
     SELECT $1, s, $2 FROM unnest($3::int[]) s`,
    [eventId, promoterId, serials],
  );
  return serials;
}

/** Release a promoter's `count` highest unissued serials back to the pool. */
export async function releasePromoterSerials(client: Client, promoterId: string, count: number): Promise<number[]> {
  if (count <= 0) return [];
  const { rows } = await client.query<{ serial: number }>(
    `DELETE FROM promoter_serials WHERE (event_id, serial) IN (
       SELECT event_id, serial FROM promoter_serials
        WHERE promoter_id = $1 AND ticket_id IS NULL
        ORDER BY serial DESC LIMIT $2)
     RETURNING serial`,
    [promoterId, count],
  );
  return rows.map((r) => Number(r.serial));
}

/**
 * The serials a promoter's new passes get: their lowest unissued reserved
 * ones, topping up from the pool if their block ran short (which happens when
 * an admin voids one of their passes and so frees allocation).
 */
export async function claimPromoterSerials(client: Client, eventId: string, promoterId: string, count: number): Promise<number[]> {
  if (count <= 0) return [];
  await lockPromoterRange(client, eventId);
  const { rows } = await client.query<{ serial: number }>(
    `SELECT serial FROM promoter_serials
      WHERE promoter_id = $1 AND event_id = $2 AND ticket_id IS NULL
      ORDER BY serial LIMIT $3`,
    [promoterId, eventId, count],
  );
  const serials = rows.map((r) => Number(r.serial));
  if (serials.length < count) serials.push(...(await reservePromoterSerials(client, eventId, promoterId, count - serials.length)));
  return serials;
}
