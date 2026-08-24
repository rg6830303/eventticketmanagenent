import 'server-only';
import { query, queryOne } from './db';
import type { CustomerRow, CustomerWithBookings } from './types';

/**
 * The customer catalogue.
 *
 * A booking stores a snapshot of who bought it. That is the right thing for a
 * booking — the name on a pass must not change because somebody later corrected
 * a typo in their profile — but it makes the customer list a derived, lossy
 * thing. This module keeps the durable record alongside it.
 *
 * Email is the identity. It is what a ticket is delivered to, it is the only
 * field the customer is forced to get right, and it is already unique-indexed.
 * A repeat buyer who changes their phone or spells their name differently is
 * still one row.
 *
 * The rollup columns (bookings_count, tickets_count, lifetime_paise) are
 * maintained by a database trigger, never written here — see the
 * `refresh_customer_rollup` trigger in db/schema.sql for why.
 */

export interface UpsertCustomerArgs {
  email: string;
  name: string;
  phone: string;
  source?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  marketingOptIn?: boolean;
}

interface TxClient {
  query: <T = unknown>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>;
}

/**
 * Find or create the customer behind a checkout, inside the caller's
 * transaction so the booking and the customer commit together.
 *
 * The name and phone are refreshed on every visit because the most recent
 * checkout is the best information available about how to reach someone.
 * `first_seen_at` and `first_source` are deliberately never overwritten: they
 * answer "where did this person come from", which a later visit cannot.
 *
 * Marketing consent only ever moves from false to true. An opt-in given once is
 * not silently withdrawn by a later checkout where the box happened to be
 * unticked; withdrawing consent is an explicit action, not a side effect.
 */
export async function upsertCustomerInTransaction(
  client: TxClient,
  args: UpsertCustomerArgs,
): Promise<CustomerRow> {
  const email = args.email.trim().toLowerCase();

  const { rows } = await client.query<CustomerRow>(
    `INSERT INTO customers (
       email, name, phone, first_source, last_ip, last_user_agent, marketing_opt_in
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (email) DO UPDATE SET
       name             = EXCLUDED.name,
       phone            = COALESCE(NULLIF(EXCLUDED.phone, ''), customers.phone),
       last_seen_at     = now(),
       last_ip          = COALESCE(EXCLUDED.last_ip, customers.last_ip),
       last_user_agent  = COALESCE(EXCLUDED.last_user_agent, customers.last_user_agent),
       marketing_opt_in = customers.marketing_opt_in OR EXCLUDED.marketing_opt_in
     RETURNING *`,
    [
      email,
      args.name.trim(),
      args.phone.trim(),
      args.source ?? 'web',
      args.ipAddress ?? null,
      args.userAgent ?? null,
      args.marketingOptIn ?? false,
    ],
  );

  return rows[0];
}

// ---------------------------------------------------------------------------
// Reads — the admin console
// ---------------------------------------------------------------------------

export interface ListCustomersArgs {
  search?: string | null;
  limit?: number;
  offset?: number;
  /** Only customers who have at least one confirmed booking. */
  buyersOnly?: boolean;
}

export interface ListCustomersResult {
  customers: CustomerWithBookings[];
  total: number;
}

/**
 * Paged customer list with a single free-text search across name, email and
 * phone — one box, because an operator on the phone to a customer has exactly
 * one piece of information and does not know which field it lives in.
 */
export async function listCustomers(args: ListCustomersArgs = {}): Promise<ListCustomersResult> {
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 500);
  const offset = Math.max(args.offset ?? 0, 0);
  const search = args.search?.trim() ?? '';

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    const placeholder = `$${params.length}`;
    conditions.push(
      `(lower(c.name) LIKE ${placeholder} OR lower(c.email) LIKE ${placeholder} OR c.phone LIKE ${placeholder})`,
    );
  }
  if (args.buyersOnly) {
    conditions.push('c.bookings_count > 0');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query<CustomerWithBookings & { total_count: string }>(
    `SELECT c.*,
            COUNT(*) OVER()::text AS total_count,
            (SELECT b.reference FROM bookings b
              WHERE b.customer_id = c.id AND b.status = 'confirmed'
              ORDER BY b.created_at DESC LIMIT 1) AS last_reference,
            (SELECT count(*)::int FROM bookings b
              WHERE b.customer_id = c.id AND b.status = 'pending')   AS pending_count,
            (SELECT count(*)::int FROM tickets t
               JOIN bookings b ON b.id = t.booking_id
              WHERE b.customer_id = c.id AND t.status = 'used')      AS checked_in_count
       FROM customers c
       ${where}
      ORDER BY c.last_seen_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params,
  );

  return {
    // node-postgres hands back BIGINT as a string to avoid a silent precision
    // loss it cannot rule out. `lifetime_paise` is comfortably inside Number's
    // safe range at any realistic ticket volume, and every consumer wants a
    // number, so the conversion happens once here rather than at each call site.
    customers: rows.map(({ total_count: _ignored, ...customer }) => ({
      ...customer,
      lifetime_paise: Number(customer.lifetime_paise),
    })),
    // COUNT(*) OVER() is absent when the page is empty, which is also the only
    // case where the total is unambiguously zero.
    total: Number(rows[0]?.total_count ?? 0),
  };
}

export async function getCustomerByEmail(email: string): Promise<CustomerRow | null> {
  return queryOne<CustomerRow>('SELECT * FROM customers WHERE email = $1', [
    email.trim().toLowerCase(),
  ]);
}

export async function getCustomerById(id: string): Promise<CustomerRow | null> {
  return queryOne<CustomerRow>('SELECT * FROM customers WHERE id = $1', [id]);
}

/** Headline numbers for the admin dashboard. */
export async function customerStats(): Promise<{
  total: number;
  buyers: number;
  repeatBuyers: number;
  lifetimePaise: number;
  optedIn: number;
}> {
  const row = await queryOne<{
    total: string;
    buyers: string;
    repeat_buyers: string;
    lifetime_paise: string;
    opted_in: string;
  }>(
    `SELECT count(*)::text                                             AS total,
            count(*) FILTER (WHERE bookings_count > 0)::text           AS buyers,
            count(*) FILTER (WHERE bookings_count > 1)::text           AS repeat_buyers,
            COALESCE(sum(lifetime_paise), 0)::text                     AS lifetime_paise,
            count(*) FILTER (WHERE marketing_opt_in)::text             AS opted_in
       FROM customers`,
  );

  return {
    total: Number(row?.total ?? 0),
    buyers: Number(row?.buyers ?? 0),
    repeatBuyers: Number(row?.repeat_buyers ?? 0),
    lifetimePaise: Number(row?.lifetime_paise ?? 0),
    optedIn: Number(row?.opted_in ?? 0),
  };
}
