export const FALLBACK_TICKET_TIERS = [
  {
    code: 'NORMAL',
    name: 'Normal Pass',
    description:
      'Solo entry to the complete non-alcoholic party, with part of the pass value redeemable at the venue.',
    pricePaise: 130_000,
    redeemablePaise: 50_000,
    pax: 1,
    priceUnit: '/ pass',
    remaining: 100_000,
    total: 100_000,
    perks: ['Admits 1 guest', '₹500 cover redeemable', 'Full party access'],
  },
  {
    code: 'COUPLE',
    name: 'Couple Pass',
    description:
      'A two-person pass designed for pairs, with a shared redeemable value at the venue.',
    pricePaise: 250_000,
    redeemablePaise: 100_000,
    pax: 2,
    priceUnit: '/ couple',
    remaining: 100_000,
    total: 100_000,
    perks: ['Admits 2 guests', '₹1,000 cover redeemable', 'Best for pairs'],
  },
  {
    code: 'VIPTABLE',
    name: 'VIP Table - 10 Pass',
    description:
      'A reserved VIP table package for ten guests, with a generous cover value redeemable at the venue.',
    pricePaise: 1_000_000,
    redeemablePaise: 500_000,
    pax: 10,
    priceUnit: '/ table',
    remaining: 100_000,
    total: 100_000,
    perks: ['Admits 10 guests', '₹5,000 cover redeemable', 'Reserved VIP table'],
  },
] as const;

export function getTicketTierMeta(code: string) {
  return FALLBACK_TICKET_TIERS.find((tier) => tier.code === code.toUpperCase());
}

export const REFERRAL_CODES = [
  { code: 'KRISH100', label: 'Krish' },
  { code: 'SID100', label: 'Sid' },
  { code: 'RAHUL100', label: 'Rahul' },
  { code: 'SAMARTH100', label: 'Samarth' },
  { code: 'NEEL100', label: 'Neel' },
  { code: 'KRISHA100', label: 'Krisha' },
  { code: 'ARPITA100', label: 'Arpita' },
  { code: 'RISHITA100', label: 'Rishita' },
  { code: 'RITIK100', label: 'Ritik' },
  { code: 'VIHAAN100', label: 'Vihaan' },
  { code: 'RAJ100', label: 'Raj' },
  { code: 'RAUNAK100', label: 'Raunak' },
  { code: 'YASHASWINI100', label: 'Yashaswini' },
  { code: 'KAVYANSH100', label: 'Kavyansh' },
  { code: 'ANTRA100', label: 'Antra' },
] as const;

export const REFERRAL_DISCOUNT_PAISE = 10_000;
