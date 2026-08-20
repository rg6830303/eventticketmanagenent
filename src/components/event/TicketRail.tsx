'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { cn, formatInr } from '@/lib/utils';
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
 * Pricing, as three physical ticket stubs.
 *
 * Ink border, solid offset shadow, a tinted header band, a perforated tear
 * line with punched notches, and a barcode strip at the foot. The outer two
 * sit a fraction of a degree off true and straighten on hover, the way three
 * tickets laid on a table by hand would. The middle tier is called out
 * because on a three-price rail people pick the middle anyway — saying so
 * removes a decision.
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
      <div className="card-print p-10 text-center">
        <p className="h-card">Tickets are not up yet</p>
        <p className="mt-2 text-[0.9375rem] text-slate">
          Prices go live here first. Follow us and you will not miss it.
        </p>
      </div>
    );
  }

  const lean = ['-rotate-1', 'rotate-0', 'rotate-1'];

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
                'relative flex flex-col overflow-hidden rounded-[16px] border-[1.5px] border-ink bg-paper transition-transform duration-300 ease-out',
                featured ? 'shadow-press-lg md:-mt-3 md:mb-3' : 'shadow-stamp',
                !reduce && lean[index % 3],
                !reduce && 'hover:rotate-0 hover:-translate-y-1',
                soldOut && 'opacity-60',
              )}
            >
              {/* Header band: tier code left, verdict right, like a stub. */}
              <div
                className={cn(
                  'flex items-center justify-between border-b-[1.5px] border-ink px-5 py-2.5',
                  featured ? 'bg-vybe-500 text-white' : 'bg-vybe-100 text-ink',
                )}
              >
                <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em]">
                  {tier.code}
                </span>
                <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em]">
                  {soldOut
                    ? 'Sold out'
                    : featured
                      ? 'Most picked'
                      : scarce
                        ? `${tier.remaining} left`
                        : 'On sale'}
                </span>
              </div>

              <div className="flex-1 p-6">
                <h3 className="font-display text-[1.4rem] font-semibold tracking-[-0.02em] text-ink">
                  {tier.name}
                </h3>
                {tier.description && (
                  <p className="mt-2 text-[0.875rem] leading-relaxed text-slate">
                    {tier.description}
                  </p>
                )}

                <p className="mt-5 flex items-baseline gap-2">
                  <span className="tnum font-display text-[2.75rem] font-bold leading-none tracking-[-0.04em] text-ink">
                    {tier.pricePaise === 0 ? 'Free' : formatInr(tier.pricePaise)}
                  </span>
                  <span className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
                    / person
                  </span>
                </p>
              </div>

              {/* Tear line, notches punched through to the ground. */}
              <div className="relative">
                <span
                  aria-hidden
                  className="absolute -left-[9px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-r-[1.5px] border-ink bg-canvasDeep"
                />
                <span
                  aria-hidden
                  className="absolute -right-[9px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-l-[1.5px] border-ink bg-canvasDeep"
                />
                <span aria-hidden className="perforation mx-5 block h-px" />
              </div>

              <div className="p-6 pt-5">
                <ul className="space-y-2">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex gap-2.5 text-[0.875rem] text-slate">
                      <span aria-hidden className="mt-[9px] h-[5px] w-[5px] shrink-0 bg-vybe-500" />
                      {perk}
                    </li>
                  ))}
                </ul>

                <Link
                  href={soldOut ? '/book' : `/book?tier=${tier.code}`}
                  aria-disabled={soldOut}
                  className={cn(
                    'mt-6 w-full',
                    soldOut
                      ? 'btn-outline pointer-events-none opacity-50'
                      : featured
                        ? 'btn-primary'
                        : 'btn-outline',
                  )}
                >
                  {soldOut ? 'Sold out' : `Get ${tier.name}`}
                </Link>
              </div>

              {/* Barcode foot. Decorative, and honest about it. */}
              <div className="flex items-center justify-between gap-4 border-t-[1.5px] border-ink bg-frost px-5 py-2.5">
                <span aria-hidden className="barcode h-5 w-24 opacity-70" />
                <span className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted">
                  HOV·26·{tier.code}
                </span>
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
