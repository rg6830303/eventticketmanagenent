'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { formatInr } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { REFERRAL } from '@/content/site';

export interface RailTier {
  code: string;
  name: string;
  description: string | null;
  pricePaise: number;
  remaining: number;
  total: number;
  perks: string[];
}

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Pricing, on the landing page.
 *
 * Ticket cards are shaped like tickets: a notched tear line across the middle
 * separates what you get from what it costs. The middle tier is marked as the
 * recommended one because on a three-price grid people pick the middle
 * anyway — saying so out loud just removes a decision.
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
  const feature = tiers.length === 3 ? 1 : 0;

  if (tiers.length === 0) {
    return (
      <div className="panel p-10 text-center">
        <p className="h-card">Tickets are not up yet</p>
        <p className="mt-2 text-[0.9375rem] text-slate">
          Prices go live here first. Follow us and you will not miss it.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-3">
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
                'relative flex flex-col overflow-hidden rounded-[22px] border bg-paper transition-[transform,box-shadow,border-color] duration-300 ease-out',
                featured
                  ? 'border-vybe-300 shadow-lift md:-mt-4 md:mb-4'
                  : 'border-edge shadow-mid hover:-translate-y-1 hover:shadow-high',
                soldOut && 'opacity-60',
              )}
            >
              {featured && (
                <p className="bg-vybe-500 py-2 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-white">
                  Most people pick this
                </p>
              )}

              <div className="flex-1 p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
                    {tier.name}
                  </h3>
                  {scarce && <span className="chip chip-hot shrink-0">{tier.remaining} left</span>}
                  {soldOut && <span className="chip shrink-0">Sold out</span>}
                </div>

                <p className="mt-4 flex items-baseline gap-1.5">
                  <span className="tnum font-display text-[2.5rem] font-bold leading-none tracking-[-0.04em] text-ink">
                    {tier.pricePaise === 0 ? 'Free' : formatInr(tier.pricePaise)}
                  </span>
                  <span className="text-[0.8125rem] text-muted">per person</span>
                </p>

                {tier.description && (
                  <p className="mt-3 text-[0.875rem] leading-relaxed text-slate">
                    {tier.description}
                  </p>
                )}
              </div>

              {/* Tear line. The notches are what make it read as a ticket. */}
              <div className="relative">
                <span
                  aria-hidden
                  className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-edge bg-canvasDeep"
                />
                <span
                  aria-hidden
                  className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-edge bg-canvasDeep"
                />
                <span aria-hidden className="perforation mx-5 block h-px" />
              </div>

              <div className="p-6">
                <ul className="space-y-2.5">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex gap-2.5 text-[0.875rem] text-slate">
                      <svg
                        aria-hidden
                        viewBox="0 0 16 16"
                        className="mt-[3px] h-3.5 w-3.5 shrink-0 text-vybe-500"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2.5 8.5 6 12l7.5-8" />
                      </svg>
                      {perk}
                    </li>
                  ))}
                </ul>

                <Link
                  href={soldOut ? '/book' : `/book?tier=${tier.code}`}
                  aria-disabled={soldOut}
                  className={cn(
                    'mt-6 w-full',
                    soldOut ? 'btn-outline pointer-events-none opacity-50' : featured ? 'btn-primary' : 'btn-outline',
                  )}
                >
                  {soldOut ? 'Sold out' : `Get ${tier.name}`}
                </Link>
              </div>
            </motion.div>
          );
        })}
      </div>

      {showReferralNote && (
        <p className="mt-6 text-center text-[0.875rem] text-slate">
          Got a referral code? Enter it at checkout for a flat ₹{REFERRAL.discountRupees} off your
          order.
        </p>
      )}
    </div>
  );
}
