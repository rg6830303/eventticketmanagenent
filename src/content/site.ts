/**
 * Editorial layer.
 *
 * Prices, stock and the on-sale state live in Postgres and are read per
 * request. What sits here is the fixed identity of the event and the words
 * around it, in one module so the whole site says the same thing.
 *
 * Everything below comes off the event artwork or is a policy the operator
 * controls. Nothing invents attendance numbers, ratings or reviews.
 */

export const BRAND = {
  name: 'Houz of Vybe',
  shortName: 'HOV',
  tagline: 'Hyderabad day parties',
  description:
    'OFF Campus is a Freshers day party by Houz of Vybe at Kingdome Klub & Kitchen, Financial District. Saturday 12 September 2026, 12 PM to 4 PM. Book online, get a QR pass by email, walk straight in.',
  city: 'Hyderabad',
  // TODO(operator): swap in the live inboxes and number before you announce.
  email: 'hello@houzofvybe.com',
  supportEmail: 'tickets@houzofvybe.com',
  phone: '+91 88867 44499',
  whatsapp: '918886744499',
  instagram: 'https://instagram.com/houzofvybe',
  socials: [
    { label: 'Instagram', href: 'https://instagram.com/houzofvybe' },
    { label: 'WhatsApp', href: 'https://wa.me/918886744499' },
  ],
} as const;

/** The venue partner named on the artwork. */
export const PARTNER = {
  name: 'Kingdome Klub & Kitchen',
  role: 'Venue partner',
} as const;

export const FEATURED_EVENT_SLUG = 'offcampus';

export const NAV_LINKS = [
  { href: '/events/offcampus', label: 'The party' },
  { href: '/#lineup', label: "What's on" },
  { href: '/#tickets', label: 'Tickets' },
  { href: '/cart', label: 'Cart' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
] as const;

export const FOOTER_LINKS = {
  'The party': [
    { href: '/events/offcampus', label: 'OFF Campus 2026' },
    { href: '/book', label: 'Buy tickets' },
    { href: '/cart', label: 'Cart' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/events', label: 'Upcoming dates' },
  ],
  'Houz of Vybe': [
    { href: '/about', label: 'Who we are' },
    { href: '/contact', label: 'Contact & bookings' },
    { href: '/faq', label: 'Help & FAQ' },
  ],
  Legal: [
    { href: '/legal/terms', label: 'Terms of service' },
    { href: '/legal/privacy', label: 'Privacy policy' },
    { href: '/legal/refunds', label: 'Refunds & cancellations' },
  ],
} as const;

/**
 * The flagship event. `slug` must match the row seeded into `events`, because
 * the date, price and stock shown on the page come from the database, not from
 * here.
 */
export const EVENT = {
  slug: FEATURED_EVENT_SLUG,
  name: 'OFF Campus',
  edition: "Freshers '26",
  editionShort: "'26",
  presentedBy: 'Houz of Vybe × Kingdome Klub & Kitchen',
  // Kept as strings for copy; the authoritative timestamps are in Postgres.
  dateLabel: 'Saturday 12 September 2026',
  dateShort: '12.09.2026',
  timeLabel: '12 PM — 4 PM',
  headline: 'The first party of your first year.',
  subhead:
    'Four hours, one rooftop bar, and the entire fresher batch in one place. Doors at noon, music until four.',
  standfirst:
    'OFF Campus is the Freshers welcome for the class of 2026. It runs in daylight at Kingdome Klub & Kitchen in the Financial District, with a non-stop DJ, a photo booth, temporary tattoos and a few things we are not printing on the poster.',
  body: [
    'You get one first week of college. This is the part of it people actually remember, and it happens on a Saturday afternoon instead of at 2 AM on a weeknight.',
    'The room is Kingdome Klub & Kitchen in the Financial District. Music runs without a break from noon to four, the booths open when the doors do, and the kitchen is open through the whole thing.',
    'Entry is by QR pass. You book here, the pass lands in your inbox, and the door team scans it once. No printed list, no calling someone at the gate to get your name on it.',
  ],

  venue: {
    name: 'Kingdome Klub & Kitchen',
    area: 'Financial District',
    addressLines: [
      '251/8, E/1, Kingdome Klub Rd, Financial District',
      'Hyderabad, Telangana 500075',
    ],
    mapsUrl: 'https://share.google/LiUERsDBUai9sXKAS',
    landmark: 'Kingdome Klub Road, Financial District',
  },

  /**
   * Straight off the artwork. `note` is ours, added so each line says something
   * useful rather than repeating the label.
   */
  activities: [
    {
      title: 'Non-stop DJ',
      note: 'One booth, no dead air, from the first hour to the last.',
      icon: 'deck',
    },
    {
      title: 'Photo booth',
      note: 'Props, prints and a backdrop that does not look like a wall.',
      icon: 'camera',
    },
    {
      title: 'Temporary tattoos',
      note: 'Pick a design, wear it for the weekend, regret nothing.',
      icon: 'tattoo',
    },
    {
      title: 'Private booth',
      // The old note read "exactly what it says on the poster", which only
      // worked while the title was self-explanatory. It no longer is.
      note: 'A curtained corner of your own. Entirely opt-in.',
      icon: 'booth',
    },
    {
      title: 'Find your Vybe',
      note: 'Short rounds, new faces, no pressure to stay past the buzzer.',
      icon: 'stopwatch',
    },
    {
      title: 'And more on the day',
      note: 'A few extras we are keeping off the poster on purpose.',
      icon: 'gift',
    },
  ],

  /** Hour by hour. Times are the plan, not a contract. */
  runsheet: [
    { time: '12:00', title: 'Doors', copy: 'Scan in, grab a drink, booths open.' },
    { time: '1:00', title: 'Warm-up set', copy: 'Room fills. Photo booth is at its emptiest.' },
    { time: '2:30', title: 'Peak', copy: 'Main set. This is the hour people film.' },
    { time: '3:00', title: 'Last hour', copy: 'Closing set, last call, group photos.' },
    { time: '4:00', title: 'Wrap', copy: 'Music stops. The afterparty is your problem.' },
  ],

  entryRules: [
    'One QR admits one person. Each ticket in your order gets its own code.',
    'Right of admission reserved. The door team can refuse entry.',
    'No re-entry once you leave the venue.',
  ],

  faqs: [
    {
      q: 'How do I get my ticket?',
      a: 'You book on this site and the QR pass is emailed to you within a minute. It also appears on your booking page straight away, so you have it even before the email lands.',
    },
    {
      q: 'Do I have to print it?',
      a: 'No. Show the QR on your phone. Screenshot it before you leave home, because it scans fine offline and venue signal is never reliable.',
    },
    {
      q: 'Can two of us use one QR?',
      a: 'No. Every QR admits one person and is dead the moment it is scanned. Book two tickets and you get two codes in the same email.',
    },
    {
      q: 'How do referral codes work?',
      a: 'Type the code into the referral box when you book. A valid code takes a flat ₹100 off the whole order, applied before you pay. One code per booking.',
    },
    {
      q: 'Is there a dress code?',
      a: 'It is a day party, so wear what you would wear to one. No shorts is not a rule here, but the venue reserves the right of admission.',
    },
    {
      q: 'Can I get a refund?',
      a: 'Tickets are non-refundable once issued. If we cancel or move the date, you get the full amount back automatically, to the same method you paid with, within 7 working days.',
    },
    {
      q: 'Can I change the name on a ticket?',
      a: 'Yes, up to 24 hours before doors. Email us from the address you booked with and we will reissue it. The old QR dies at that moment.',
    },
    {
      q: 'How do I get there?',
      a: 'Kingdome Klub & Kitchen is on Kingdome Klub Road in the Financial District. Cabs drop at the entrance. Parking on site is limited on the day.',
    },
  ],
} as const;

/** Legacy alias — a few older modules still import OFFCAMPUS. */
export const OFFCAMPUS = EVENT;
export const VENUE = EVENT.venue;

/** Referral programme, as shown to the customer. Codes themselves live in the database. */
export const REFERRAL = {
  discountRupees: 100,
  headline: 'Got a referral code?',
  copy: 'A valid code takes a flat ₹100 off your order, however many tickets are in it. One code per booking.',
  /**
   * The code printed as a tear-off coupon on the home page.
   *
   * This is a LIVE, redeemable row in `referral_codes`, not an illustration.
   * Never use it as an input placeholder: styled like the field's own value it
   * reads as pre-filled, and it hands every visitor who copies it a ₹100
   * discount attributed to whoever the code belongs to. The referral inputs
   * deliberately have no placeholder — they have a label and help text, which
   * is what a code field actually needs.
   */
  sampleCode: 'KAVYANSH100',
} as const;

/** Three steps, because that is genuinely how many there are. */
export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Pick your ticket',
    copy: 'Choose a tier and how many you need. Stock is live, so what you see is what is left.',
  },
  {
    step: '02',
    title: 'Pay online',
    copy: 'Add your tickets to cart, drop in a referral code if you have one, and finish payment online through Razorpay.',
  },
  {
    step: '03',
    title: 'Scan in at noon',
    copy: 'Your QR arrives by email. Show it at the door, get scanned once, and you are in.',
  },
] as const;

/**
 * What the ticketing actually guarantees. Each line describes behaviour that is
 * enforced in code, not a promise about the night itself.
 */
export const TICKETING_FACTS = [
  {
    label: 'Pass delivery',
    value: 'Under a minute',
    detail: 'Signed QR by email the moment payment clears.',
  },
  {
    label: 'Scans per pass',
    value: 'Exactly one',
    detail: 'Consumed on first use. A forwarded screenshot is refused.',
  },
  {
    label: 'Capacity',
    value: 'Hard capped',
    detail: 'Sales close on their own when the room is full.',
  },
  {
    label: 'Payments',
    value: 'Razorpay',
    detail: 'UPI, cards, net banking and wallets. Nothing card-related touches our servers.',
  },
] as const;

/**
 * Gallery placeholders, drawn as generated compositions so the repo ships with
 * no binary assets and no licensing questions.
 * TODO(operator): replace with photographs from the day.
 */
export const GALLERY = [
  { id: 1, caption: 'Doors, just after noon', event: 'OFF Campus', hue: 205, span: 'tall' },
  { id: 2, caption: 'Photo booth queue', event: 'OFF Campus', hue: 198, span: 'wide' },
  { id: 3, caption: 'Front of the booth', event: 'OFF Campus', hue: 212, span: 'normal' },
  { id: 4, caption: 'Tattoo table', event: 'OFF Campus', hue: 190, span: 'normal' },
  { id: 5, caption: 'Terrace, 2 PM', event: 'OFF Campus', hue: 208, span: 'wide' },
  { id: 6, caption: 'Peak hour', event: 'OFF Campus', hue: 216, span: 'tall' },
  { id: 7, caption: 'Bar service', event: 'Kingdome', hue: 200, span: 'normal' },
  { id: 8, caption: 'Closing set', event: 'OFF Campus', hue: 194, span: 'normal' },
  { id: 9, caption: 'Sound check', event: 'Production', hue: 210, span: 'wide' },
] as const;

export const ABOUT_STORY = {
  heading: 'We throw parties in daylight, and we run our own door.',
  paragraphs: [
    'Houz of Vybe is a small Hyderabad crew that puts on day parties for college crowds. OFF Campus is our Freshers edition, made with Kingdome Klub & Kitchen.',
    'We handle it end to end: the booking, the sound, the booths, the door and the ticketing platform you are on right now. That is why a pass reaches your inbox in under a minute instead of after a WhatsApp conversation.',
    'Capacity is a number in a database here, not a guess at the gate. When it is reached, the site stops selling. A packed room is good, an oversold one is not.',
  ],
  values: [
    {
      title: 'Daylight, deliberately',
      copy: 'Noon to four means you get the party and still have your evening.',
    },
    {
      title: 'A door that moves',
      copy: 'QR scanning at the gate, trained staff, and a welfare lead on shift all day.',
    },
    {
      title: 'No guest-list games',
      copy: 'One price on the site for everyone. Referral codes are the only discount.',
    },
  ],
} as const;
