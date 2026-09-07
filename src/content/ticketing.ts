/**
 * Last-resort pass list.
 *
 * The database is the source of truth for what a pass costs and what it is
 * worth at the bar; this exists only so a deployment whose database is
 * unreachable renders last-known prices instead of an empty page.
 *
 * Every figure here is a Final Phase figure, and every cover is zero. A stale
 * fallback that promised a redeemable value would be worse than no page at all
 * — somebody would buy on the strength of it and be turned away at the counter.
 */
export const FALLBACK_TICKET_TIERS = [
  {
    code: 'NORMAL',
    name: 'General Access',
    description:
      'Solo entry to the complete non-alcoholic party. Zero redeemable — this pass buys entry, nothing at the bar.',
    pricePaise: 111_100,
    redeemablePaise: 0,
    pax: 1,
    priceUnit: '/ pass',
    remaining: 100_000,
    total: 100_000,
    perks: ['Admits 1 guest', 'Zero redeemable · entry only', 'Full party access'],
  },
  {
    code: 'GROUP',
    name: 'Group of 5',
    description: 'Entry for five. Zero redeemable — this pass buys entry, nothing at the bar.',
    pricePaise: 444_400,
    redeemablePaise: 0,
    pax: 5,
    priceUnit: '/ group',
    remaining: 100_000,
    total: 100_000,
    perks: ['Admits 5 guests', 'Zero redeemable · entry only', 'Best value for a group'],
  },
  {
    code: 'EARLY',
    name: 'Group of 10',
    description: 'Entry for ten. Zero redeemable — this pass buys entry, nothing at the bar.',
    pricePaise: 888_800,
    redeemablePaise: 0,
    pax: 10,
    priceUnit: '/ group',
    remaining: 100_000,
    total: 100_000,
    perks: ['Admits 10 guests', 'Zero redeemable · entry only', 'Full party access'],
  },
] as const;
