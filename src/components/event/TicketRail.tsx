'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { cn, formatInr } from '@/lib/utils';
import { REFERRAL } from '@/content/site';
import { addToCart } from '@/lib/cart';

export interface RailTier {
  code: string;
  name: string;
  description: string | null;
  pricePaise: number;
  remaining: number;
  total: number;
  perks: string[];
  redeemablePaise: number;
  pax: number;
  priceUnit: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Pricing.
 *
 * Three plates at three elevations. The recommended tier sits higher, carries
 * the accent edge and the only filled button on the rail — so the eye lands on
 * it before it has read a single price, which is the entire job of a pricing
 * page. The other two stay quiet and identical to each other; giving all three
 * the same weight, as the old stub design did, meant the customer had to make
 * the comparison unaided.
 *
 * The ticket motif survives where it is literal — a notched waist and a
 * perforation across the card — because the object being drawn really is a
 * ticket. It is stated once per card, softly, rather than four times.
 */
export function TicketRail({
  tiers,
  showReferralNote = true,
}: {
  tiers: RailTier[];
  /** Off where the page already carries a full referral callout of its own. */
  showReferralNote?: boolean;
}) {
  const reduce = useReducedMotion();
  const [recentlyAdded, setRecentlyAdded] = useState<Record<string, boolean>>({});
  const feature = tiers.length === 3 ? 1 : 0;

  if (tiers.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="h-card">Tickets are not up yet</p>
        <p className="mt-2 text-[0.9375rem] text-slate">
          Prices go live here first. Follow us and you will not miss it.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-6 md:grid-cols-3 md:gap-5">
        {tiers.map((tier, index) => {
          const soldOut = tier.remaining <= 0;
          const scarce = !soldOut && tier.remaining <= Math.max(10, tier.total * 0.15);
          const featured = index === feature && !soldOut;

          return (
            <motion.div
              data-reveal=""
              key={tier.code}
              initial={reduce ? false : { opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-70px' }}
              transition={{ duration: 0.55, delay: index * 0.08, ease: EASE }}
              className={cn(
                'group relative flex h-full flex-col overflow-hidden',
                featured ? 'card-feature md:-mt-4' : 'card-lift',
                soldOut && 'opacity-60',
              )}
            >
              {/* Status line. One row, one fact, no competing badges. */}
              <div className="flex items-center justify-between gap-3 px-6 pt-6">
                <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted">
                  {tier.code}
                </span>
                <span
                  className={cn(
                    'chip',
                    soldOut
                      ? 'chip-quiet'
                      : featured
                        ? ''
                        : scarce
                          ? 'chip-hot'
                          : 'chip-quiet',
                  )}
                >
                  {soldOut
                    ? 'Sold out'
                    : featured
                      ? 'Most picked'
                      : scarce
                        ? `${tier.remaining} left`
                        : 'On sale'}
                </span>
              </div>

              <div className="flex-1 px-6 pt-5">
                <h3 className="font-display text-[1.4rem] font-semibold tracking-[-0.02em] text-ink">
                  {tier.name}
                </h3>
                {tier.description && (
                  <p className="mt-2 text-[0.875rem] leading-relaxed text-slate">
                    {tier.description}
                  </p>
                )}

                <p className="mt-6 flex items-baseline gap-2">
                  <span className="tnum font-display text-[2.875rem] font-bold leading-none tracking-[-0.04em] text-ink">
                    {tier.pricePaise === 0 ? 'Free' : formatInr(tier.pricePaise)}
                  </span>
                  <span className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
                    {tier.priceUnit}
                  </span>
                </p>

                {/*
                  The cover sits on the price, at the price's size.

                  Rendering a zero as "₹0 redeemable" in the same reassuring
                  green as a real balance is how somebody buys a pass believing
                  they have a tab. Zero gets its own words and its own colour, so
                  the difference is read rather than inferred.
                */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={cn('chip', tier.redeemablePaise === 0 ? 'chip-hot' : 'chip-ok')}>
                    {tier.redeemablePaise === 0
                      ? 'Zero redeemable'
                      : `${formatInr(tier.redeemablePaise)} redeemable`}
                  </span>
                  <span className="chip chip-quiet">
                    {tier.pax} {tier.pax === 1 ? 'guest' : 'guests'}
                  </span>
                </div>
              </div>

              {/* The ticket waist: notches punched to the ground, one soft
                  perforation between them. */}
              <div className="relative mt-7">
                <span
                  aria-hidden
                  className="absolute -left-[9px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-pill bg-canvas"
                />
                <span
                  aria-hidden
                  className="absolute -right-[9px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-pill bg-canvas"
                />
                <span aria-hidden className="perforation mx-6 block h-px" />
              </div>

              <div className="flex flex-1 flex-col px-6 pb-6 pt-6">
                <ul className="space-y-2.5">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex gap-2.5 text-[0.875rem] leading-relaxed text-slate">
                      <svg
                        aria-hidden
                        viewBox="0 0 16 16"
                        className="mt-[3px] h-4 w-4 shrink-0 text-vybe-500"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m3.5 8.5 3 3 6-7" />
                      </svg>
                      {perk}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={soldOut}
                  onClick={() => {
                    addToCart(tier.code, 1);
                    setRecentlyAdded((current) => ({ ...current, [tier.code]: true }));
                  }}
                  className={cn(
                    // mt-auto, so three cards of different length still line
                    // their buttons up along one edge.
                    'mt-auto w-full pt-7',
                    soldOut
                      ? 'btn-outline pointer-events-none opacity-50'
                      : featured
                        ? 'btn-primary'
                        : 'btn-outline',
                  )}
                >
                  {soldOut
                    ? 'Sold out'
                    : recentlyAdded[tier.code]
                      ? 'Added to cart ✓'
                      : 'Add to cart'}
                </button>

                {/* Secondary route, and only where it has been earned: before
                    anything is in the cart, "open cart" on every card is three
                    dead links. */}
                {recentlyAdded[tier.code] && !soldOut && (
                  <Link href="/cart" className="btn-ghost mt-2 w-full">
                    Go to cart →
                  </Link>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {showReferralNote && (
        <p className="mt-8 text-center text-[0.875rem] text-slate">
          Got a referral code? Add it in the cart for a flat ₹{REFERRAL.discountRupees} off your
          order.
        </p>
      )}
    </div>
  );
}
