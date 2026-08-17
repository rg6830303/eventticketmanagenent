/**
 * Site copy and marketing content.
 *
 * Anything that changes per event — dates, prices, live stock — lives in
 * Postgres and is read at request time. What sits here is brand voice and the
 * editorial layer, in one module so the whole site speaks with one voice.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A NOTE ON CLAIMS
 * Every statement in this file is either a verifiable property of the platform
 * (a QR admits one person; capacity is capped in the database) or a statement of
 * intent the operator controls. There are deliberately no invented attendance
 * figures, ratings or customer testimonials: on a site selling real tickets
 * those are fabricated social proof, and they are also the fastest way to look
 * untrustworthy to anyone who checks.
 *
 * Items marked NEEDS REAL DATA are placeholders the operator must replace
 * before launch. They are written so that being unreplaced reads as honest
 * ("line-up announced soon") rather than as a lie.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const BRAND = {
  name: 'Houz of Vybe',
  shortName: 'HOV',
  tagline: 'Hyderabad after dark',
  description:
    'Houz of Vybe runs capped-capacity club nights in Hyderabad. Book in under a minute, walk in with a QR — no queue, no guest list, no app.',
  city: 'Hyderabad',
  // NEEDS REAL DATA — swap for the real inboxes and number before launch.
  email: 'hello@houzofvybe.com',
  supportEmail: 'tickets@houzofvybe.com',
  phone: '+91 90000 00000',
  instagram: 'https://instagram.com/houzofvybe',
  socials: [
    { label: 'Instagram', href: 'https://instagram.com/houzofvybe' },
    { label: 'YouTube', href: 'https://youtube.com/@houzofvybe' },
    { label: 'Spotify', href: 'https://open.spotify.com' },
  ],
} as const;

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/events/offcampus', label: 'OffCampus' },
  { href: '/events', label: 'Events' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
] as const;

export const FOOTER_LINKS = {
  Explore: [
    { href: '/events/offcampus', label: 'OffCampus Night' },
    { href: '/events', label: 'All events' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/book', label: 'Book tickets' },
  ],
  Company: [
    { href: '/about', label: 'About us' },
    { href: '/contact', label: 'Contact' },
    { href: '/faq', label: 'FAQ' },
  ],
  Legal: [
    { href: '/legal/terms', label: 'Terms of service' },
    { href: '/legal/privacy', label: 'Privacy policy' },
    { href: '/legal/refunds', label: 'Refunds & cancellations' },
  ],
} as const;

export const FEATURED_EVENT_SLUG = 'offcampus';

export const OFFCAMPUS = {
  slug: FEATURED_EVENT_SLUG,
  eyebrow: 'Season One · Opening Night',
  title: 'OFFCAMPUS',
  subtitle: 'The after-hours chapter',
  blurb:
    'A campus-night themed party built around the hours nobody films — the walk back at 2am, the corridor that turned into a dancefloor, the playlist nobody admits to loving. Three rooms, one arc, capped capacity.',
  longform: [
    'Every campus story has a part that never made it to screen. OffCampus is that part, staged properly — three rooms that each sound like a different hour of the same night.',
    'The Lecture Hall opens warm and melodic while the room fills. The Corridor takes the pressure up through Afro house and desi bass. The Rooftop closes it out at sunrise-adjacent tempo with the city underneath you.',
    'Capacity is capped in the system, not on a clipboard. When the last ticket goes, booking closes automatically — we do not oversell rooms and there is no door-list overflow.',
  ],
  themeNote:
    'An independently produced themed night. Not affiliated with, endorsed by, or licensed from the producers of any television series.',
  rooms: [
    {
      name: 'The Lecture Hall',
      time: '9:00 PM — 11:00 PM',
      sound: 'Melodic house · Indie electronica',
      copy: 'Doors, first drinks, and a slow build. The room fills while the tempo stays honest.',
      hue: 214,
    },
    {
      name: 'The Corridor',
      time: '11:00 PM — 2:00 AM',
      sound: 'Afro house · Desi bass · Techno',
      copy: 'Peak hour. Low ceiling, high pressure, and the main rig doing what it was bought to do.',
      hue: 228,
    },
    {
      name: 'The Rooftop',
      time: '2:00 AM — 4:00 AM',
      sound: 'Progressive · Organic house',
      copy: 'Open air, city skyline, and the set people text about the next morning.',
      hue: 200,
    },
  ],
  /**
   * NEEDS REAL DATA — replace `name: null` with the booked artist once confirmed.
   * Rendering a null slot as "To be announced" is accurate; inventing a DJ name
   * is not, and it is the kind of detail people screenshot and check.
   */
  lineup: [
    { name: null, slot: '01:00 — 03:00', room: 'The Corridor', tag: 'Headline' },
    { name: null, slot: '11:30 — 01:00', room: 'The Corridor', tag: 'Support' },
    { name: null, slot: '09:30 — 11:30', room: 'The Lecture Hall', tag: 'Opening' },
    { name: null, slot: '02:00 — 04:00', room: 'The Rooftop', tag: 'Closing' },
  ] as ReadonlyArray<{ name: string | null; slot: string; room: string; tag: string }>,
  highlights: [
    { title: 'Three rooms', copy: 'Three distinct sounds under one roof, running back to back until 4am.' },
    { title: 'Instant QR entry', copy: 'Your pass reaches your inbox in under a minute. Scan once and walk in.' },
    { title: 'Capped capacity', copy: 'The room size is enforced by the booking system. Sold out means sold out.' },
    { title: 'One scan per pass', copy: 'Every QR is signed and dies on first use. Nobody copies their way in.' },
  ],
  faqs: [
    {
      q: 'How do I get my ticket?',
      a: 'The moment your booking is confirmed, a QR pass is emailed to the address you entered — usually within a minute. It is also shown on your booking page immediately, so you have it even before the email lands.',
    },
    {
      q: 'Do I need to print anything?',
      a: 'No. Show the QR on your phone at the door. Screenshot it before you arrive — venue signal is unreliable, and a screenshot scans exactly the same.',
    },
    {
      q: 'Can one QR get two people in?',
      a: 'No. Each QR admits one person and is consumed on the first scan. Book three tickets and you get three separate QRs in the same email.',
    },
    {
      q: 'What ID do I need?',
      a: 'A government photo ID showing you are 21 or over — Aadhaar, passport, driving licence or voter ID. The name should match your booking. DigiLocker copies are accepted.',
    },
    {
      q: 'What is the dress code?',
      a: 'Smart casual and up. No shorts, no flip-flops, no sportswear. Management reserves the right of admission.',
    },
    {
      q: 'Do you do refunds?',
      a: 'Tickets are non-refundable once issued. If we cancel or reschedule, you are refunded in full, automatically, to the original payment method within 7 working days.',
    },
    {
      q: 'Can I transfer my ticket to a friend?',
      a: 'Yes, up to 24 hours before doors. Email us from the address you booked with and we will reissue the pass in their name — the old QR is voided at the same moment.',
    },
    {
      q: 'Is there parking?',
      a: 'Valet parking is available at the venue entrance. Space is limited on the night, so a cab is usually faster after 10pm.',
    },
  ],
} as const;

export const VENUE = {
  // NEEDS REAL DATA — confirm the venue before promoting it.
  name: 'The Vault, Jubilee Hills',
  addressLines: ['Road No. 36, Jubilee Hills', 'Hyderabad, Telangana 500033'],
  mapsQuery: 'Jubilee Hills, Hyderabad, Telangana',
  landmark: 'Opposite Jubilee Hills Check Post',
} as const;

/**
 * Facts about how the platform works. Each one is true by construction — it
 * describes behaviour enforced in code, not a claim about past events.
 */
export const PLATFORM_FACTS = [
  { value: '3', label: 'Rooms in one night', detail: 'Each with its own rig and its own tempo.' },
  { value: '<60s', label: 'Ticket delivery', detail: 'Signed QR emailed the moment you book.' },
  { value: '1', label: 'Scan per pass', detail: 'Consumed on first use. Copies are refused.' },
  { value: '0', label: 'Oversold rooms', detail: 'Capacity is enforced by the database.' },
] as const;

export const ABOUT_STORY = {
  heading: 'Sound first. Capped rooms. A door that actually moves.',
  paragraphs: [
    'Houz of Vybe produces club nights in Hyderabad on a simple principle: put the sound first, cap the room, and stop treating the crowd like a spreadsheet.',
    'We produce in-house — booking, sound, lighting, door operations and the ticketing platform you are looking at. That is why a pass reaches your inbox in under a minute and why the queue at the door is a scan rather than a search through a printed list.',
    'Capacity is not a suggestion here. It is a number in the database, and when it is reached the booking form closes itself. An oversold room is a worse night for everyone standing in it.',
  ],
  values: [
    {
      title: 'Sound before spectacle',
      copy: 'The rig gets the budget first. Everything else is arranged around what the room sounds like at 1am.',
    },
    {
      title: 'Capped rooms, always',
      copy: 'We publish the capacity and the system stops at it. No overflow, no queue you cannot see the end of.',
    },
    {
      title: 'A door that respects you',
      copy: 'Signed QR entry, trained staff, a zero-tolerance harassment policy and a welfare lead on shift.',
    },
  ],
} as const;

/**
 * Gallery placeholders. Rendered as generated compositions, so the site ships
 * with no binary assets and no licensing questions.
 * NEEDS REAL DATA — replace with photography from an actual night.
 */
export const GALLERY = [
  { id: 1, caption: 'Corridor, peak hour', event: 'The Corridor', hue: 218, span: 'tall' },
  { id: 2, caption: 'Rooftop, opening set', event: 'The Rooftop', hue: 205, span: 'wide' },
  { id: 3, caption: 'Front of house', event: 'The Corridor', hue: 232, span: 'normal' },
  { id: 4, caption: 'Booth view', event: 'The Corridor', hue: 196, span: 'normal' },
  { id: 5, caption: 'Doors, 9pm', event: 'The Lecture Hall', hue: 224, span: 'wide' },
  { id: 6, caption: 'Closing set', event: 'The Rooftop', hue: 210, span: 'tall' },
  { id: 7, caption: 'Warm-up', event: 'The Lecture Hall', hue: 240, span: 'normal' },
  { id: 8, caption: 'The last hour', event: 'The Rooftop', hue: 200, span: 'normal' },
  { id: 9, caption: 'Rig check', event: 'Production', hue: 214, span: 'wide' },
] as const;

export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Pick your night',
    copy: 'Choose the event and the tier that fits. Stock is live, so what you see is what is actually left.',
  },
  {
    step: '02',
    title: 'Three fields, no account',
    copy: 'Name, a working email and your mobile. No password, no sign-up, no marketing wall.',
  },
  {
    step: '03',
    title: 'QR hits your inbox',
    copy: 'A signed pass per head, emailed instantly and shown on screen. Screenshot it — it works offline.',
  },
  {
    step: '04',
    title: 'Scan and walk in',
    copy: 'The door team scans once. The pass is consumed on the spot, so nobody can copy it in.',
  },
] as const;

/**
 * First-person commitments, not third-party quotes. These are promises the
 * operator can be held to, which is the honest substitute for testimonials on a
 * site that has not collected any yet.
 */
export const PROMISES = [
  {
    title: 'Your ticket, in under a minute',
    copy: 'If the email has not arrived, your booking page shows the QR immediately and resends on one tap.',
  },
  {
    title: 'The room will not be oversold',
    copy: 'Capacity is enforced in the booking system. When it is reached, the form closes itself.',
  },
  {
    title: 'A pass that cannot be cloned',
    copy: 'Every QR is cryptographically signed and dies on first scan. Screenshots of someone else’s pass are refused at the door.',
  },
  {
    title: 'Cancelled means refunded',
    copy: 'If we cancel or reschedule, you are refunded in full without having to ask.',
  },
] as const;
