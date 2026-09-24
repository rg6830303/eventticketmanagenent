/**
 * The platform fee.
 *
 * 2.5% of what the customer is paying for passes — after any referral
 * discount, because charging a fee on money they are not paying would be a fee
 * on a discount. Added on top and charged through Razorpay with everything
 * else, so the gateway, the ledger and the receipt all agree on one total.
 *
 * Shared by the server, which is the only thing that decides what is charged,
 * and the cart, which only shows it. Plain module with no server imports so
 * both can use the same arithmetic and never disagree by a paisa.
 */

/** Basis points: 250 = 2.5%. */
export const PLATFORM_FEE_BPS = 250;

export const PLATFORM_FEE_LABEL = `Platform fee (${PLATFORM_FEE_BPS / 100}%)`;

/** Fee on an amount in paise, rounded to the nearest paisa. Zero on zero. */
export function platformFeePaise(netPaise: number): number {
  if (!Number.isFinite(netPaise) || netPaise <= 0) return 0;
  return Math.round((netPaise * PLATFORM_FEE_BPS) / 10_000);
}
