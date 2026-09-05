import 'server-only';
import { query, transaction } from './db';

/**
 * Bring unpaid bookings up to the current price.
 *
 * A booking snapshots what each pass cost when it was made, which is exactly
 * right for one that has been paid: a receipt has to keep saying what was
 * actually charged, however often the tier is repriced afterwards. It is wrong
 * for one that has not. Somebody who filled a cart at ₹1,111 and wandered off
 * would come back weeks later and still be charged ₹1,111, and there were 176
 * such bookings sitting against prices that had moved.
 *
 * So: confirmed bookings are never touched, and pending ones follow the tier.
 * Both directions — a price cut reaches the people still deciding too, and
 * charging somebody more than the sticker price on the page they are looking at
 * is not defensible.
 *
 * The discount stays as it was. It is a flat amount off, granted to that
 * customer for their referral, and it belongs to them regardless of what the
 * pass now costs.
 *
 * This deliberately does NOT cancel any payment order already raised. Orders
 * carry their own amount and are honoured against it, so a customer who is
 * mid-payment when a price changes completes at the figure they were shown
 * rather than being told they are suddenly short. The next press of Pay raises
 * a fresh order at the new price.
 */
export async function repricePendingBookings(tierCode?: string): Promise<{
  bookings: number;
  items: number;
}> {
  return transaction(async (client) => {
    // Line items first: unit price, and the two figures that travel with a
    // pass and are just as capable of going stale — what it admits and what it
    // is worth at the bar.
    const items = await client.query(
      `UPDATE booking_items bi
          SET unit_price_paise = t.price_paise,
              line_total_paise = t.price_paise * bi.quantity,
              admits_each      = t.admits,
              redeemable_paise = t.redeemable_paise
         FROM ticket_tiers t, bookings b
        WHERE t.code = bi.tier_code
          AND b.id = bi.booking_id
          AND b.status = 'pending'
          AND ($1::text IS NULL OR bi.tier_code = $1)
          AND (bi.unit_price_paise <> t.price_paise
               OR bi.admits_each <> t.admits
               OR bi.redeemable_paise <> t.redeemable_paise)`,
      [tierCode ?? null],
    );

    // Then the booking totals, recomputed from the lines that now exist rather
    // than adjusted by a delta — the sum is the truth and arithmetic on stale
    // numbers is how a total drifts away from the rows it is meant to describe.
    const bookings = await client.query(
      `UPDATE bookings b
          SET subtotal_paise = s.total,
              amount_paise   = GREATEST(0, s.total - b.discount_paise)
         FROM (SELECT booking_id, SUM(line_total_paise)::int AS total
                 FROM booking_items GROUP BY booking_id) s
        WHERE s.booking_id = b.id
          AND b.status = 'pending'
          AND (b.subtotal_paise <> s.total
               OR b.amount_paise <> GREATEST(0, s.total - b.discount_paise))`,
    );

    return { bookings: bookings.rowCount ?? 0, items: items.rowCount ?? 0 };
  });
}

/**
 * The same, for one booking, at the moment it matters most.
 *
 * The admin hook keeps carts current whenever a price is edited, but this is
 * the last point before money moves, and "what the customer is charged matches
 * what the site says" should not depend on a hook having fired earlier. Cheap:
 * it touches nothing when nothing has drifted.
 */
export async function repriceBooking(bookingId: string): Promise<boolean> {
  return transaction(async (client) => {
    await client.query(
      `UPDATE booking_items bi
          SET unit_price_paise = t.price_paise,
              line_total_paise = t.price_paise * bi.quantity,
              admits_each      = t.admits,
              redeemable_paise = t.redeemable_paise
         FROM ticket_tiers t, bookings b
        WHERE t.code = bi.tier_code
          AND b.id = bi.booking_id
          AND b.id = $1
          AND b.status = 'pending'
          AND (bi.unit_price_paise <> t.price_paise
               OR bi.admits_each <> t.admits
               OR bi.redeemable_paise <> t.redeemable_paise)`,
      [bookingId],
    );

    const updated = await client.query(
      `UPDATE bookings b
          SET subtotal_paise = s.total,
              amount_paise   = GREATEST(0, s.total - b.discount_paise)
         FROM (SELECT booking_id, SUM(line_total_paise)::int AS total
                 FROM booking_items WHERE booking_id = $1 GROUP BY booking_id) s
        WHERE s.booking_id = b.id
          AND b.id = $1
          AND b.status = 'pending'
          AND (b.subtotal_paise <> s.total
               OR b.amount_paise <> GREATEST(0, s.total - b.discount_paise))`,
      [bookingId],
    );

    return (updated.rowCount ?? 0) > 0;
  });
}

/**
 * How far the unpaid bookings have drifted from current prices.
 *
 * Read-only, for showing an operator what a reprice would touch before it
 * happens and for confirming afterwards that nothing was left behind.
 */
export async function pendingPriceDrift(): Promise<
  Array<{ tier_code: string; booked_at_paise: number; current_paise: number; bookings: number }>
> {
  return query(
    `SELECT bi.tier_code,
            bi.unit_price_paise AS booked_at_paise,
            t.price_paise       AS current_paise,
            count(*)::int       AS bookings
       FROM booking_items bi
       JOIN bookings b ON b.id = bi.booking_id
       JOIN ticket_tiers t ON t.code = bi.tier_code
      WHERE b.status = 'pending' AND bi.unit_price_paise <> t.price_paise
      GROUP BY 1, 2, 3
      ORDER BY 4 DESC`,
  );
}
