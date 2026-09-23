import 'server-only';
import { query } from './db';
import type { BookingStatus, EventRow } from './types';

/**
 * What a signed-in customer sees on their account page.
 *
 * A deliberately narrow projection rather than a reuse of `BookingDetail`: the
 * account list needs one row per booking with enough to recognise it, and
 * fetching every ticket and line item for a customer with a dozen orders is a
 * lot of round trips to render a list nobody reads in full. The passes
 * themselves live on the booking page, which this links to.
 */
export interface AccountBooking {
  reference: string;
  status: BookingStatus;
  quantity: number;
  amount_paise: number;
  created_at: string;
  paid_at: string | null;
  event: Pick<EventRow, 'id' | 'slug' | 'name' | 'venue_name' | 'starts_at' | 'ends_at'> & {
    edition: string | null;
  };
  /** Passes still valid — what they can actually walk in with. */
  valid_tickets: number;
  /** Passes already scanned. */
  used_tickets: number;
}

/**
 * Every booking this customer has made, newest first.
 *
 * Matched on `customer_id` alone, never on the email string.
 *
 * That distinction is the whole security model of this page. Matching on email
 * would hand the account any booking whose typed-in address happens to equal
 * this one, including bookings made before the account existed by somebody
 * else who mistyped their address into a checkout form. The customer_id is set
 * by the booking pipeline and the backfill in schema.sql, and it is the only
 * link that means "this row belongs to this person".
 */
export async function listAccountBookings(customerId: string): Promise<AccountBooking[]> {
  return query<AccountBooking>(
    `SELECT b.reference,
            b.status,
            b.quantity,
            b.amount_paise,
            b.created_at,
            b.paid_at,
            jsonb_build_object(
              'id', e.id, 'slug', e.slug, 'name', e.name, 'edition', e.edition,
              'venue_name', e.venue_name, 'starts_at', e.starts_at, 'ends_at', e.ends_at
            ) AS event,
            COALESCE(t.valid_count, 0)::int AS valid_tickets,
            COALESCE(t.used_count, 0)::int  AS used_tickets
       FROM bookings b
       JOIN events e ON e.id = b.event_id
       LEFT JOIN (
         SELECT booking_id,
                count(*) FILTER (WHERE status = 'valid') AS valid_count,
                count(*) FILTER (WHERE status = 'used')  AS used_count
           FROM tickets
          GROUP BY booking_id
       ) t ON t.booking_id = b.id
      WHERE b.customer_id = $1
      ORDER BY b.created_at DESC
      LIMIT 100`,
    [customerId],
  );
}

/*
 * There is deliberately no "attach this booking to this account" step.
 *
 * `upsertCustomerInTransaction` already keys the customer row on the email
 * submitted at checkout, so an order placed with an account's address lands on
 * that account's row without anybody wiring the session into the booking
 * pipeline. Adding a second path that stamped `customer_id` from the cookie
 * would mean two sources of truth for who owns an order — and the one taken
 * from the session would quietly be wrong every time somebody buys tickets for
 * a friend using the friend's email.
 */
