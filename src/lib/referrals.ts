import 'server-only';
import { query, queryOne } from './db';

/**
 * Referral codes.
 *
 * A code is a flat amount off the whole order — not per ticket, not a
 * percentage. That is what gets advertised ("₹100 off with my code") and it is
 * the only shape that cannot produce a rounding argument at the door.
 *
 * The authoritative check runs inside the booking transaction (see
 * `applyReferralInTransaction`). Everything exported here that runs outside a
 * transaction is a preview for the UI and is never trusted for pricing.
 */

export interface ReferralCodeRow {
  id: string;
  code: string;
  label: string | null;
  discount_paise: number;
  active: boolean;
  max_uses: number | null;
  uses: number;
  starts_at: string | null;
  expires_at: string | null;
}

export interface ReferralCheck {
  valid: boolean;
  code: string;
  /** Amount this code would take off, already clamped to the order value. */
  discountPaise: number;
  label: string | null;
  /** Customer-safe explanation when `valid` is false. */
  reason?: string;
}

/**
 * Codes are printed on stories and typed on phones, so the input is messy:
 * trailing spaces from a paste, a lowercase autocorrect, an en dash where a
 * hyphen was meant. Normalise all of that away before it reaches SQL.
 */
export function normaliseReferralCode(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, '')
    .toUpperCase()
    .slice(0, 32);
}

/** Shape check only — cheap enough to run on every keystroke. */
export function looksLikeReferralCode(raw: string): boolean {
  return /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(normaliseReferralCode(raw));
}

interface TxClient {
  query: <T = unknown>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>;
}

/**
 * Why the code was refused, or null when it is good.
 *
 * The messages are written to be shown verbatim: "this code has been used up"
 * is actionable, "invalid code" makes people retype a code that will never
 * work.
 */
function refusalReason(row: ReferralCodeRow | undefined, now = Date.now()): string | null {
  if (!row) return 'That code does not exist. Check the spelling and try again.';
  if (!row.active) return 'That code is no longer active.';
  if (row.starts_at && new Date(row.starts_at).getTime() > now) {
    return 'That code is not live yet.';
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < now) {
    return 'That code has expired.';
  }
  if (row.max_uses !== null && row.uses >= row.max_uses) {
    return 'That code has been fully claimed.';
  }
  return null;
}

/**
 * Non-locking preview for the booking form. Deliberately separate from the
 * transactional path: this can go stale between the keystroke and the submit,
 * and the price the customer pays is always the one computed under the lock.
 */
export async function previewReferral(rawCode: string, orderPaise: number): Promise<ReferralCheck> {
  const code = normaliseReferralCode(rawCode);

  if (!looksLikeReferralCode(code)) {
    return { valid: false, code, discountPaise: 0, label: null, reason: 'Enter a valid code.' };
  }

  const row = await queryOne<ReferralCodeRow>('SELECT * FROM referral_codes WHERE code = $1', [
    code,
  ]);

  const reason = refusalReason(row ?? undefined);
  if (reason || !row) {
    return { valid: false, code, discountPaise: 0, label: null, reason: reason ?? undefined };
  }

  return {
    valid: true,
    code: row.code,
    // Never larger than the order: a ₹100 code on an ₹80 order is ₹80 off, not
    // ₹20 owed back to the customer.
    discountPaise: Math.min(row.discount_paise, Math.max(0, orderPaise)),
    label: row.label,
  };
}

/**
 * The authoritative claim, run inside the booking transaction.
 *
 * `FOR UPDATE` serialises two people racing to spend the last use of a limited
 * code, which is the only way a `max_uses` ceiling means anything. The usage
 * counter is incremented here rather than at payment time, matching how tier
 * inventory is reserved for pending bookings.
 *
 * Returns a zero discount rather than throwing when the code is bad: a wrong
 * code should never cost someone their booking, it should just cost them the
 * discount, and the caller reports which happened.
 */
export async function applyReferralInTransaction(
  client: TxClient,
  rawCode: string | null | undefined,
  orderPaise: number,
): Promise<ReferralCheck> {
  if (!rawCode || !rawCode.trim()) {
    return { valid: false, code: '', discountPaise: 0, label: null };
  }

  const code = normaliseReferralCode(rawCode);
  if (!looksLikeReferralCode(code)) {
    return { valid: false, code, discountPaise: 0, label: null, reason: 'Enter a valid code.' };
  }

  const { rows } = await client.query<ReferralCodeRow>(
    'SELECT * FROM referral_codes WHERE code = $1 FOR UPDATE',
    [code],
  );
  const row = rows[0];

  const reason = refusalReason(row);
  if (reason || !row) {
    return { valid: false, code, discountPaise: 0, label: null, reason: reason ?? undefined };
  }

  const discountPaise = Math.min(row.discount_paise, Math.max(0, orderPaise));

  await client.query('UPDATE referral_codes SET uses = uses + 1 WHERE id = $1', [row.id]);

  return { valid: true, code: row.code, discountPaise, label: row.label };
}

/** Hand a use back when a booking that claimed a code never gets paid. */
export async function releaseReferral(client: TxClient, code: string | null): Promise<void> {
  if (!code) return;
  await client.query(
    'UPDATE referral_codes SET uses = GREATEST(uses - 1, 0) WHERE code = $1',
    [normaliseReferralCode(code)],
  );
}

// ---------------------------------------------------------------------------
// Admin console
// ---------------------------------------------------------------------------

export interface ReferralCodeStats extends ReferralCodeRow {
  /**
   * Bookings that were actually paid for with this code.
   *
   * Deliberately not `uses`. That counter increments the moment a code is
   * claimed at checkout, including by people who then never pay — which is the
   * right behaviour for enforcing `max_uses`, and the wrong number to show a
   * promoter who wants to know how many tickets they sold.
   */
  sales: number;
  /** Bookings holding this code that have not been paid for. */
  pending: number;
  /** Revenue actually collected on bookings that used this code. */
  revenue_paise: number;
  /** Total discount given away through this code, on paid bookings only. */
  discount_given_paise: number;
  /** Passes sold through this code. */
  passes: number;
}

/** Every code, newest first, with the numbers that matter to an operator. */
export async function listReferralCodesWithStats(): Promise<ReferralCodeStats[]> {
  return query<ReferralCodeStats>(
    `SELECT r.*,
            COALESCE(s.sales, 0)::int                  AS sales,
            COALESCE(s.passes, 0)::int                 AS passes,
            COALESCE(s.revenue_paise, 0)::bigint       AS revenue_paise,
            COALESCE(s.discount_given_paise, 0)::bigint AS discount_given_paise,
            COALESCE(p.pending, 0)::int                AS pending
       FROM referral_codes r
       LEFT JOIN LATERAL (
         SELECT count(*)                     AS sales,
                COALESCE(sum(b.quantity), 0) AS passes,
                COALESCE(sum(b.amount_paise), 0)   AS revenue_paise,
                COALESCE(sum(b.discount_paise), 0) AS discount_given_paise
           FROM bookings b
          WHERE upper(b.referral_code) = r.code AND b.status = 'confirmed'
       ) s ON true
       LEFT JOIN LATERAL (
         SELECT count(*) AS pending
           FROM bookings b
          WHERE upper(b.referral_code) = r.code AND b.status = 'pending'
       ) p ON true
      ORDER BY COALESCE(s.sales, 0) DESC, r.created_at DESC`,
  );
}

export interface ReferralCustomer {
  reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  quantity: number;
  amount_paise: number;
  discount_paise: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

/**
 * Who actually bought with this code.
 *
 * Confirmed bookings only by default. A promoter asking "who used my code"
 * means "who bought", not "who typed it into a checkout and wandered off".
 */
export async function customersForReferralCode(
  rawCode: string,
  includeUnpaid = false,
): Promise<ReferralCustomer[]> {
  const code = normaliseReferralCode(rawCode);
  return query<ReferralCustomer>(
    `SELECT b.reference, b.customer_name, b.customer_email, b.customer_phone,
            b.quantity, b.amount_paise, b.discount_paise, b.status,
            b.paid_at, b.created_at
       FROM bookings b
      WHERE upper(b.referral_code) = $1
        AND ($2::boolean OR b.status = 'confirmed')
      ORDER BY b.paid_at DESC NULLS LAST, b.created_at DESC
      LIMIT 500`,
    [code, includeUnpaid],
  );
}

export interface CreateReferralArgs {
  code: string;
  label?: string | null;
  discountPaise: number;
  maxUses?: number | null;
  expiresAt?: string | null;
}

export class ReferralError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'ReferralError';
  }
}

/**
 * Mint a code.
 *
 * The discount is a flat amount off the whole order, matching how these are
 * advertised. It is capped below the cheapest pass on sale: a code worth more
 * than a ticket turns every order into a zero-value one, which skips the
 * payment step entirely and hands out free passes.
 */
export async function createReferralCode(args: CreateReferralArgs): Promise<ReferralCodeRow> {
  const code = normaliseReferralCode(args.code);

  if (!looksLikeReferralCode(code)) {
    throw new ReferralError(
      'A code must be 3–32 characters, letters and numbers only (hyphens and underscores allowed).',
      'invalid_code',
      422,
    );
  }

  const discountPaise = Math.round(args.discountPaise);
  if (!Number.isFinite(discountPaise) || discountPaise <= 0) {
    throw new ReferralError('The discount must be more than ₹0.', 'invalid_discount', 422);
  }

  const cheapest = await queryOne<{ price_paise: number }>(
    `SELECT min(price_paise) AS price_paise FROM ticket_tiers WHERE active = true`,
  );
  const ceiling = cheapest?.price_paise ?? 0;
  if (ceiling > 0 && discountPaise >= ceiling) {
    throw new ReferralError(
      `That discount is at or above the cheapest pass (₹${ceiling / 100}). ` +
        `A code worth a whole ticket would make orders free and skip payment entirely.`,
      'discount_too_large',
      422,
    );
  }

  const existing = await queryOne<{ code: string }>(
    'SELECT code FROM referral_codes WHERE code = $1',
    [code],
  );
  if (existing) throw new ReferralError(`${code} already exists.`, 'duplicate_code', 409);

  const rows = await query<ReferralCodeRow>(
    `INSERT INTO referral_codes (code, label, discount_paise, max_uses, expires_at, active)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING *`,
    [
      code,
      args.label?.trim() || null,
      discountPaise,
      args.maxUses && args.maxUses > 0 ? Math.round(args.maxUses) : null,
      args.expiresAt || null,
    ],
  );
  return rows[0];
}

export interface UpdateReferralArgs {
  active?: boolean;
  discountPaise?: number;
  label?: string | null;
  maxUses?: number | null;
}

/** Change a code. Turning one off takes effect on the next checkout. */
export async function updateReferralCode(
  rawCode: string,
  args: UpdateReferralArgs,
): Promise<ReferralCodeRow> {
  const code = normaliseReferralCode(rawCode);

  if (args.discountPaise !== undefined) {
    const cheapest = await queryOne<{ price_paise: number }>(
      `SELECT min(price_paise) AS price_paise FROM ticket_tiers WHERE active = true`,
    );
    const ceiling = cheapest?.price_paise ?? 0;
    if (args.discountPaise <= 0) {
      throw new ReferralError('The discount must be more than ₹0.', 'invalid_discount', 422);
    }
    if (ceiling > 0 && args.discountPaise >= ceiling) {
      throw new ReferralError(
        `That discount is at or above the cheapest pass (₹${ceiling / 100}).`,
        'discount_too_large',
        422,
      );
    }
  }

  const rows = await query<ReferralCodeRow>(
    `UPDATE referral_codes SET
       active         = COALESCE($2, active),
       discount_paise = COALESCE($3, discount_paise),
       label          = COALESCE($4, label),
       max_uses       = CASE WHEN $5::text = 'clear' THEN NULL
                             WHEN $6::int IS NOT NULL THEN $6::int
                             ELSE max_uses END
     WHERE code = $1
     RETURNING *`,
    [
      code,
      args.active ?? null,
      args.discountPaise ?? null,
      args.label ?? null,
      args.maxUses === null ? 'clear' : null,
      args.maxUses ?? null,
    ],
  );

  if (!rows[0]) throw new ReferralError(`${code} does not exist.`, 'not_found', 404);
  return rows[0];
}
