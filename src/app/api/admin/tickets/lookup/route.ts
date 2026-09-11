import type { NextRequest } from 'next/server';
import { fail, handleError, ok, tooManyRequests } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { LIMITS, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TicketLookupRow {
  code: string;
  holder_name: string;
  tier_name: string | null;
  admits: number;
  redeemable_paise: number;
  status: string;
  checked_in_at: string | null;
  checked_in_gate: string | null;
  reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  booking_status: string;
}

/**
 * Find a customer's passes by who they are rather than by what they scanned.
 *
 * The door's normal path is a QR, and the fallback after that is a booking
 * reference read off a confirmation email. Both assume the customer can show
 * you something. This is for when they cannot: a flat battery, a deleted email,
 * a ticket bought by a friend who has not arrived yet. The person is standing
 * there saying their name, and until now that was the end of the line.
 *
 * Returns passes, not bookings, because the question at a door is always about
 * a pass: does one exist for this person, and has it already been used.
 *
 * Unpaid and cancelled bookings are included, flagged rather than hidden.
 * Filtering to confirmed made both of them indistinguishable from never having
 * bought, and they are not the same conversation: somebody whose payment never
 * completed can be sent to pay, and somebody whose booking was cancelled needs
 * an explanation. "No pass under that name" for either one sends the operator
 * looking for a spelling mistake that does not exist.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession('gate');

    const limit = await rateLimit(`lookup:${session.sub}`, LIMITS.scan.limit, LIMITS.scan.window);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const raw = (request.nextUrl.searchParams.get('q') ?? '').trim();
    // Two characters would match half the event. Three is short enough for a
    // name fragment and long enough to be worth searching.
    if (raw.length < 3) return fail('Type at least 3 characters', 'query_too_short', 422);

    /*
     * Phone numbers are typed in every shape a person can imagine — with +91,
     * with spaces, with the leading zero — and stored as ten bare digits. So a
     * query that is mostly digits is reduced to digits and matched against the
     * tail of the stored number, which makes "+91 98765 43210", "098765 43210"
     * and "9876543210" all find the same customer.
     */
    const digits = raw.replace(/\D/g, '');
    const asPhone = digits.length >= 4 ? digits.slice(-10) : null;
    const text = `%${raw.toLowerCase()}%`;

    const rows = await query<TicketLookupRow>(
      `SELECT t.code, t.holder_name, t.admits, t.redeemable_paise, t.status,
              t.checked_in_at, t.checked_in_gate,
              COALESCE(bi.tier_name, tt.name) AS tier_name,
              b.reference, b.customer_name, b.customer_email, b.customer_phone,
              b.status AS booking_status
         FROM tickets t
         JOIN bookings b ON b.id = t.booking_id
         LEFT JOIN booking_items bi ON bi.id = t.booking_item_id
         LEFT JOIN ticket_tiers tt  ON tt.id = t.tier_id
        WHERE (
            lower(b.customer_name)  LIKE $1
            OR lower(b.customer_email) LIKE $1
            OR lower(t.holder_name) LIKE $1
            OR lower(b.reference)   LIKE $1
            OR ($2::text IS NOT NULL AND b.customer_phone LIKE '%' || $2)
          )
        /*
         * Usable passes first, then used, then everything that will not get
         * anyone in. An operator reading top-down should hit the answer before
         * the noise.
         */
        ORDER BY (b.status = 'confirmed' AND t.status = 'valid') DESC,
                 t.checked_in_at IS NOT NULL,
                 b.created_at DESC,
                 t.code ASC
        LIMIT 60`,
      [text, asPhone],
    );

    return ok({ query: raw, count: rows.length, tickets: rows });
  } catch (error) {
    return handleError(error, 'admin.tickets.lookup');
  }
}
