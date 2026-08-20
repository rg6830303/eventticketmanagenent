import 'server-only';
import { queryOne } from './db';

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
