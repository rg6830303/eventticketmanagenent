export const FALLBACK_TICKET_TIERS = [
  {
    code: 'VVIP',
    name: 'VVIP',
    description:
      'The premium party experience with priority-style entry and the most elevated arrival.',
    pricePaise: 200_000,
    remaining: 80,
    total: 80,
    perks: ['Premium entry experience', 'All party activities included', 'Ideal for groups'],
  },
  {
    code: 'VIP',
    name: 'VIP',
    description:
      'A balanced premium ticket for guests who want extra comfort while enjoying the full party.',
    pricePaise: 150_000,
    remaining: 140,
    total: 140,
    perks: ['Priority-style entry', 'All party activities included', 'Most popular choice'],
  },
  {
    code: 'GA',
    name: 'GA',
    description:
      'The straightforward all-access ticket for the complete non-alcoholic party experience.',
    pricePaise: 111_100,
    remaining: 220,
    total: 220,
    perks: ['Full event access', 'All party activities included', 'Best-value entry'],
  },
] as const;

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

