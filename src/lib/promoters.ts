import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { env } from './env';
import { query, queryOne, transaction } from './db';
import { signingKey } from './signing-key';

/**
 * Promoter distribution.
 *
 * An admin allocates passes to a promoter for nothing. The promoter issues them
 * to their own buyers from /promoter, collects the money themselves, and
 * settles with the admin outside the platform. Every pass they issue is minted
 * inactive — it is emailed, it has its own unique code, but the door refuses it
 * — until an admin who has been paid activates it. The admin can deactivate and
 * reactivate at any time.
 *
 * A promoter signs in with a single code. The code is stored only as an HMAC,
 * so a database dump does not hand anyone a working login, and changing it
 * bumps `code_version`, which signs out every session holding the old one.
 */

const COOKIE = 'hov_promoter';
const AUDIENCE = 'hov-promoter';
const SESSION_HOURS = 24 * 7;

let cachedKey: Promise<Uint8Array> | null = null;
function key(): Promise<Uint8Array> {
  cachedKey ??= signingKey('PROMOTER_SESSION_SECRET', 'promoter-session-jwt');
  return cachedKey;
}

/** Codes are case- and spacing-insensitive: "rahul 2026" and "RAHUL-2026" differ, "Rahul2026" and "RAHUL2026" do not. */
export function normaliseCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export async function hashCode(code: string): Promise<string> {
  return crypto.createHmac('sha256', await key()).update(`promoter-code:${normaliseCode(code)}`).digest('hex');
}

/** Letters and digits with the easily confused ones (0/O, 1/I/L) left out. */
export function generateCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export function validateCode(code: string): string | null {
  const c = normaliseCode(code);
  if (c.length < 6) return 'The code must be at least 6 characters';
  if (c.length > 32) return 'The code must be 32 characters or fewer';
  if (!/^[A-Z0-9-]+$/.test(c)) return 'Use letters, numbers and dashes only';
  return null;
}

function hintFor(code: string): string {
  const c = normaliseCode(code);
  return `${c.slice(0, 2)}…${c.slice(-2)}`;
}

// ---------------------------------------------------------------------------
// Rows and stats
// ---------------------------------------------------------------------------

export interface PromoterRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  code_hint: string;
  code_version: number;
  allocated: number;
  deal_price_paise: number;
  active: boolean;
  notes: string | null;
  event_id: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface PromoterStats extends PromoterRow {
  issued: number;
  remaining: number;
  activated: number;
  pending: number;
  admitted: number;
  voided: number;
  paid_tickets: number;
  received_paise: number;
  due_paise: number;
  last_issued_at: string | null;
}

const PROMOTER_COLUMNS = `p.id, p.name, p.phone, p.email, p.code_hint, p.code_version, p.allocated,
  p.deal_price_paise, p.active, p.notes, p.event_id, p.last_login_at, p.created_at`;

const STATS_SQL = `
  SELECT ${PROMOTER_COLUMNS},
         COALESCE(t.issued, 0)    AS issued,
         COALESCE(t.activated, 0) AS activated,
         COALESCE(t.pending, 0)   AS pending,
         COALESCE(t.admitted, 0)  AS admitted,
         COALESCE(t.voided, 0)    AS voided,
         t.last_issued_at,
         COALESCE(a.paid_tickets, 0)   AS paid_tickets,
         COALESCE(a.received_paise, 0) AS received_paise
    FROM promoters p
    LEFT JOIN LATERAL (
      SELECT count(*) FILTER (WHERE status <> 'void')::int                        AS issued,
             count(*) FILTER (WHERE status <> 'void' AND active)::int             AS activated,
             count(*) FILTER (WHERE status <> 'void' AND NOT active)::int         AS pending,
             count(*) FILTER (WHERE status = 'used')::int                         AS admitted,
             count(*) FILTER (WHERE status = 'void')::int                         AS voided,
             max(created_at)                                                      AS last_issued_at
        FROM tickets WHERE promoter_id = p.id
    ) t ON true
    LEFT JOIN LATERAL (
      SELECT sum(CASE kind WHEN 'payment' THEN quantity WHEN 'payment_removed' THEN -quantity ELSE 0 END)::int AS paid_tickets,
             sum(CASE kind WHEN 'payment' THEN amount_paise WHEN 'payment_removed' THEN -amount_paise ELSE 0 END)::bigint AS received_paise
        FROM promoter_activity WHERE promoter_id = p.id
    ) a ON true`;

function withDerived(row: Omit<PromoterStats, 'remaining' | 'due_paise'>): PromoterStats {
  const received = Number(row.received_paise);
  return {
    ...row,
    received_paise: received,
    remaining: Math.max(0, row.allocated - row.issued),
    due_paise: Math.max(0, row.issued * row.deal_price_paise - received),
  };
}

export async function listPromoterStats(): Promise<PromoterStats[]> {
  const rows = await query<Omit<PromoterStats, 'remaining' | 'due_paise'>>(`${STATS_SQL} ORDER BY p.active DESC, p.created_at DESC`);
  return rows.map(withDerived);
}

export async function getPromoterStats(id: string): Promise<PromoterStats | null> {
  const row = await queryOne<Omit<PromoterStats, 'remaining' | 'due_paise'>>(`${STATS_SQL} WHERE p.id = $1`, [id]);
  return row ? withDerived(row) : null;
}

export interface PromoterTicket {
  id: string;
  code: string;
  holder_name: string;
  status: string;
  active: boolean;
  activated_at: string | null;
  checked_in_at: string | null;
  created_at: string;
  reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  email_sent_at: string | null;
  promoter_id: string | null;
  promoter_name: string | null;
}

const TICKET_SQL = `
  SELECT t.id, t.code, t.holder_name, t.status, t.active, t.activated_at, t.checked_in_at, t.created_at,
         b.reference, b.customer_name, b.customer_email, b.customer_phone, b.email_sent_at,
         t.promoter_id, p.name AS promoter_name
    FROM tickets t
    JOIN bookings b ON b.id = t.booking_id
    LEFT JOIN promoters p ON p.id = t.promoter_id`;

export async function listPromoterTickets(promoterId: string, limit = 2000): Promise<PromoterTicket[]> {
  return query<PromoterTicket>(`${TICKET_SQL} WHERE t.promoter_id = $1 ORDER BY t.created_at DESC LIMIT $2`, [promoterId, limit]);
}

/** Passes issued by promoters whose accounts were since deleted. */
export async function listOrphanedPromoterTickets(limit = 2000): Promise<PromoterTicket[]> {
  return query<PromoterTicket>(
    `${TICKET_SQL} WHERE t.promoter_id IS NULL AND b.payment_provider = 'promoter' ORDER BY t.created_at DESC LIMIT $1`,
    [limit],
  );
}

export interface ActivityRow {
  id: string;
  kind: string;
  quantity: number;
  amount_paise: number;
  reference: string | null;
  note: string | null;
  actor: string | null;
  created_at: string;
}

export async function listActivity(promoterId: string, limit = 200): Promise<ActivityRow[]> {
  return query<ActivityRow>(
    `SELECT id, kind, quantity, amount_paise, reference, note, actor, created_at
       FROM promoter_activity WHERE promoter_id = $1 AND kind <> 'login'
      ORDER BY created_at DESC LIMIT $2`,
    [promoterId, limit],
  );
}

export async function listRecentActivity(limit = 40): Promise<Array<ActivityRow & { promoter_id: string; promoter_name: string }>> {
  return query(
    `SELECT a.id, a.kind, a.quantity, a.amount_paise, a.reference, a.note, a.actor, a.created_at,
            a.promoter_id, p.name AS promoter_name
       FROM promoter_activity a JOIN promoters p ON p.id = a.promoter_id
      WHERE a.kind <> 'login'
      ORDER BY a.created_at DESC LIMIT $1`,
    [limit],
  );
}

export async function logActivity(
  promoterId: string,
  kind: string,
  fields: { quantity?: number; amountPaise?: number; reference?: string | null; note?: string | null; actor?: string | null } = {},
): Promise<void> {
  await query(
    `INSERT INTO promoter_activity (promoter_id, kind, quantity, amount_paise, reference, note, actor)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      promoterId,
      kind,
      fields.quantity ?? 0,
      fields.amountPaise ?? 0,
      fields.reference ?? null,
      fields.note?.slice(0, 500) ?? null,
      fields.actor ?? null,
    ],
  );
}

// ---------------------------------------------------------------------------
// Admin operations
// ---------------------------------------------------------------------------

export class PromoterError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

async function assertCodeFree(hash: string, exceptId?: string): Promise<void> {
  const clash = await queryOne<{ id: string }>('SELECT id FROM promoters WHERE code_hash = $1', [hash]);
  if (clash && clash.id !== exceptId) throw new PromoterError('Another promoter already uses that code', 409);
}

export async function createPromoter(input: {
  name: string;
  phone?: string | null;
  email?: string | null;
  code?: string | null;
  allocated?: number;
  dealPricePaise?: number;
  notes?: string | null;
  eventId?: string | null;
  actor: string;
}): Promise<{ promoter: PromoterRow; code: string }> {
  const code = input.code?.trim() ? normaliseCode(input.code) : generateCode();
  const invalid = validateCode(code);
  if (invalid) throw new PromoterError(invalid, 422);
  const hash = await hashCode(code);
  await assertCodeFree(hash);

  const promoter = await queryOne<PromoterRow>(
    `INSERT INTO promoters (name, phone, email, code_hash, code_hint, allocated, deal_price_paise, notes, event_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, name, phone, email, code_hint, code_version, allocated, deal_price_paise, active, notes, event_id, last_login_at, created_at`,
    [
      input.name.trim(),
      input.phone?.trim() || null,
      input.email?.trim().toLowerCase() || null,
      hash,
      hintFor(code),
      Math.max(0, Math.round(input.allocated ?? 0)),
      Math.max(0, Math.round(input.dealPricePaise ?? 0)),
      input.notes?.trim() || null,
      input.eventId ?? null,
    ],
  );
  if (!promoter) throw new PromoterError('Could not create the promoter', 500);
  await logActivity(promoter.id, 'created', { actor: input.actor });
  if (promoter.allocated > 0) {
    await logActivity(promoter.id, 'allocated', { quantity: promoter.allocated, actor: input.actor, note: 'Opening allocation' });
  }
  return { promoter, code };
}

export async function updatePromoter(
  id: string,
  input: Partial<{ name: string; phone: string | null; email: string | null; dealPricePaise: number; notes: string | null; active: boolean; code: string }>,
  actor: string,
): Promise<{ code: string | null }> {
  const existing = await queryOne<PromoterRow>('SELECT id FROM promoters WHERE id = $1', [id]);
  if (!existing) throw new PromoterError('That promoter does not exist', 404);

  let newCode: string | null = null;
  if (input.code !== undefined) {
    newCode = input.code.trim() ? normaliseCode(input.code) : generateCode();
    const invalid = validateCode(newCode);
    if (invalid) throw new PromoterError(invalid, 422);
    const hash = await hashCode(newCode);
    await assertCodeFree(hash, id);
    await query(
      `UPDATE promoters SET code_hash = $2, code_hint = $3, code_version = code_version + 1, updated_at = now() WHERE id = $1`,
      [id, hash, hintFor(newCode)],
    );
    await logActivity(id, 'code_changed', { actor, note: 'Login code changed; old sessions signed out' });
  }

  if (input.name !== undefined && !input.name.trim()) throw new PromoterError('The promoter needs a name', 422);
  await query(
    `UPDATE promoters SET
       name             = COALESCE($2, name),
       phone            = CASE WHEN $3::boolean THEN $4 ELSE phone END,
       email            = CASE WHEN $5::boolean THEN $6 ELSE email END,
       deal_price_paise = COALESCE($7, deal_price_paise),
       notes            = CASE WHEN $8::boolean THEN $9 ELSE notes END,
       active           = COALESCE($10, active),
       updated_at       = now()
     WHERE id = $1`,
    [
      id,
      input.name?.trim() ?? null,
      input.phone !== undefined, input.phone?.trim() || null,
      input.email !== undefined, input.email?.trim().toLowerCase() || null,
      input.dealPricePaise === undefined ? null : Math.max(0, Math.round(input.dealPricePaise)),
      input.notes !== undefined, input.notes?.trim() || null,
      input.active ?? null,
    ],
  );
  const changed = Object.entries(input)
    .filter(([k, v]) => k !== 'code' && v !== undefined)
    .map(([k]) => k);
  if (changed.length) {
    await logActivity(id, 'updated', {
      actor,
      note: input.active === false ? 'Account suspended' : input.active === true && changed.length === 1 ? 'Account re-enabled' : `Changed ${changed.join(', ')}`,
    });
  }
  return { code: newCode };
}

/**
 * Give passes to, or take unissued passes back from, a promoter.
 *
 * Taking back can never go below what they have already issued — those passes
 * are in customers' inboxes. To pull an issued pass, deactivate or void it.
 */
export async function adjustAllocation(id: string, delta: number, note: string | null, actor: string): Promise<number> {
  const quantity = Math.round(delta);
  if (!quantity) throw new PromoterError('Enter a number of passes', 422);
  return transaction(async (client) => {
    const { rows } = await client.query<{ allocated: number }>('SELECT allocated FROM promoters WHERE id = $1 FOR UPDATE', [id]);
    if (!rows[0]) throw new PromoterError('That promoter does not exist', 404);
    const { rows: used } = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM tickets WHERE promoter_id = $1 AND status <> 'void'`,
      [id],
    );
    const issued = used[0]?.n ?? 0;
    const next = rows[0].allocated + quantity;
    if (next < issued) {
      throw new PromoterError(
        `They have already issued ${issued}. You can take back at most ${rows[0].allocated - issued} unissued passes.`,
        409,
      );
    }
    if (next > 100000) throw new PromoterError('That allocation is implausibly large', 422);
    await client.query('UPDATE promoters SET allocated = $2, updated_at = now() WHERE id = $1', [id, next]);
    await client.query(
      `INSERT INTO promoter_activity (promoter_id, kind, quantity, note, actor) VALUES ($1,$2,$3,$4,$5)`,
      [id, quantity > 0 ? 'allocated' : 'revoked', Math.abs(quantity), note?.slice(0, 500) ?? null, actor],
    );
    return next;
  });
}

export async function recordPayment(
  id: string,
  input: { amountPaise: number; tickets: number; note: string | null; removal?: boolean },
  actor: string,
): Promise<void> {
  const exists = await queryOne<{ id: string }>('SELECT id FROM promoters WHERE id = $1', [id]);
  if (!exists) throw new PromoterError('That promoter does not exist', 404);
  const amount = Math.round(input.amountPaise);
  const tickets = Math.round(input.tickets);
  if (amount < 0 || tickets < 0 || (amount === 0 && tickets === 0)) {
    throw new PromoterError('Enter the amount received and/or the number of passes it covers', 422);
  }
  await logActivity(id, input.removal ? 'payment_removed' : 'payment', {
    quantity: tickets,
    amountPaise: amount,
    note: input.note,
    actor,
  });
}

export async function deletePromoter(id: string): Promise<{ name: string } | null> {
  // Their issued passes survive the account: the tickets and bookings keep the
  // customer's pass, and the booking notes still name the promoter.
  return queryOne<{ name: string }>('DELETE FROM promoters WHERE id = $1 RETURNING name', [id]);
}

/**
 * Activate or deactivate passes. `activated_at` is kept once set, so a pass
 * that is inactive but has an activation time was deliberately deactivated
 * rather than never activated.
 */
export async function setTicketsActive(
  ticketIds: string[],
  active: boolean,
  actor: string,
): Promise<{ changed: number }> {
  if (ticketIds.length === 0) return { changed: 0 };
  const rows = await query<{ id: string; promoter_id: string | null; reference: string; code: string }>(
    `UPDATE tickets t
        SET active = $2, activated_at = CASE WHEN $2 THEN now() ELSE t.activated_at END
       FROM bookings b
      WHERE t.id = ANY($1::uuid[]) AND b.id = t.booking_id AND t.active <> $2 AND t.status <> 'void'
      RETURNING t.id, t.promoter_id, b.reference, t.code`,
    [ticketIds, active],
  );

  // One activity line per promoter per action, listing the pass codes.
  const byPromoter = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.promoter_id) continue;
    byPromoter.set(row.promoter_id, [...(byPromoter.get(row.promoter_id) ?? []), row.code]);
  }
  for (const [promoterId, codes] of byPromoter) {
    await logActivity(promoterId, active ? 'activated' : 'deactivated', {
      quantity: codes.length,
      actor,
      note: codes.slice(0, 20).join(', ') + (codes.length > 20 ? ` +${codes.length - 20} more` : ''),
    });
  }
  return { changed: rows.length };
}

// ---------------------------------------------------------------------------
// Promoter sessions
// ---------------------------------------------------------------------------

export async function findPromoterByCode(code: string): Promise<PromoterRow | null> {
  if (validateCode(code)) return null;
  return queryOne<PromoterRow>(
    `SELECT ${PROMOTER_COLUMNS} FROM promoters p WHERE p.code_hash = $1`,
    [await hashCode(code)],
  );
}

export async function startPromoterSession(promoter: PromoterRow): Promise<void> {
  const token = await new SignJWT({ v: promoter.code_version })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(promoter.id)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(await key());
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  });
  await query('UPDATE promoters SET last_login_at = now() WHERE id = $1', [promoter.id]);
}

export async function endPromoterSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/** The signed-in promoter, re-read from the database; null if suspended, deleted or the code changed. */
export async function getSignedInPromoter(): Promise<PromoterRow | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await key(), { audience: AUDIENCE });
    if (!payload.sub) return null;
    const row = await queryOne<PromoterRow>(`SELECT ${PROMOTER_COLUMNS} FROM promoters p WHERE p.id = $1`, [payload.sub]);
    if (!row || !row.active || row.code_version !== payload.v) return null;
    return row;
  } catch {
    return null;
  }
}
