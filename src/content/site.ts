/**
 * Static site copy and marketing content.
 *
 * Anything that changes per event (dates, prices, stock) lives in Postgres and
 * is read at request time. What sits here is brand copy, navigation and the
 * pieces of the event page that are editorial rather than transactional — kept
 * in one module so the whole site speaks with one voice and one set of facts.
 */

export const BRAND = {
  name: 'Houz of Vybe',
  shortName: 'HOV',
  tagline: 'Hyderabad after dark',
  description:
    'Houz of Vybe throws Hyderabad’s loudest nights — curated line-ups, serious sound and rooms that actually move. Book in seconds, walk in with a QR.',
  city: 'Hyderabad',
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

/**
 * The flagship night. `slug` must match the row seeded into `events`, because
 * every price, date and stock number on the page comes from the database —
 * this object only carries the editorial layer.
 */
export const FEATURED_EVENT_SLUG = 'offcampus';

export const OFFCAMPUS = {
  slug: FEATURED_EVENT_SLUG,
  eyebrow: 'Season One · Opening Night',
  title: 'OFFCAMPUS',
  subtitle: 'The after-hours chapter',
  blurb:
    'Inspired by the Prime Video series, OffCampus is a one-night rebuild of everything that happened after the lecture hall emptied. Hostel-corridor bass, canteen-neon lighting and a line-up that does not know when to stop.',
  longform: [
    'Every campus story has the part that never made it to screen — the walk back at 2am, the corridor that turned into a dancefloor, the playlist nobody admits to loving. OffCampus is that part, staged properly.',
    'Three rooms, one arc. The Lecture Hall opens warm and melodic. The Corridor turns the pressure up through Afro house and desi bass. The Rooftop closes it out at sunrise-adjacent tempo with the city laid out underneath you.',
    'Capacity is deliberately tight. When it is gone, it is gone — we do not oversell rooms.',
  ],
  themeNote:
    'An independently produced themed night. Not affiliated with, endorsed by, or licensed from the producers of the series.',
  rooms: [
    {
      name: 'The Lecture Hall',
      time: '9:00 PM — 11:00 PM',
      sound: 'Melodic house · Indie electronica',
      copy: 'Doors, first drinks, and a slow build. The room fills while the tempo stays honest.',
    },
    {
      name: 'The Corridor',
      time: '11:00 PM — 2:00 AM',
      sound: 'Afro house · Desi bass · Techno',
      copy: 'Peak hour. Low ceiling, high pressure, the sound system doing what it was bought to do.',
    },
    {
      name: 'The Rooftop',
      time: '2:00 AM — 4:00 AM',
      sound: 'Progressive · Organic house',
      copy: 'Open air, city skyline, and the set everyone texts about the next morning.',
    },
  ],
  lineup: [
    { name: 'KRSNA B2B ARJN', slot: '01:00 — 03:00', room: 'The Corridor', tag: 'Headline' },
    { name: 'MAAYA', slot: '11:30 — 01:00', room: 'The Corridor', tag: 'Support' },
    { name: 'NOCTRN', slot: '09:30 — 11:30', room: 'The Lecture Hall', tag: 'Opening' },
    { name: 'DJ SAAHIL', slot: '02:00 — 04:00', room: 'The Rooftop', tag: 'Closing' },
  ],
  highlights: [
    { title: '3 rooms', copy: 'Three distinct sounds under one roof, running back to back until 4am.' },
    { title: 'L-Acoustics rig', copy: 'Line array in the main room. Tuned on the day, not the week before.' },
    { title: 'Instant QR entry', copy: 'Your pass lands in your inbox in under a minute. Scan and walk in.' },
    { title: 'Capped capacity', copy: 'We stop selling when the room is full. No queue-outside-in-the-cold surprises.' },
  ],
  faqs: [
    {
      q: 'How do I get my ticket?',
      a: 'The moment your booking is confirmed we email a QR pass to the address you entered. It usually lands within 60 seconds — check spam if it does not, then use the resend link on your booking page.',
    },
    {
      q: 'Do I need to print anything?',
      a: 'No. Show the QR on your phone at the door. Screenshot it before you arrive — venue signal is unreliable and a screenshot scans exactly the same.',
    },
    {
      q: 'Can one QR get two people in?',
      a: 'No. Each QR admits one person and is consumed on the first scan. If you booked three tickets you get three separate QRs in the same email.',
    },
    {
      q: 'What ID do I need?',
      a: 'A government photo ID showing you are 21 or older — Aadhaar, passport, driving licence or voter ID. The name should match your booking. Digital copies in DigiLocker are accepted.',
    },
    {
      q: 'What is the dress code?',
      a: 'Smart casual and up. No shorts, no flip-flops, no sportswear. Management reserves the right of admission.',
    },
    {
      q: 'Do you do refunds?',
      a: 'Tickets are non-refundable once issued. If we cancel or reschedule the event you are refunded in full, automatically, to the original payment method within 7 working days.',
    },
    {
      q: 'Can I transfer my ticket to a friend?',
      a: 'Yes, up to 24 hours before doors. Email us from the address you booked with and we will reissue the pass in their name — the old QR is voided at the same time.',
    },
    {
      q: 'Is there parking?',
      a: 'Valet parking is available at the venue entrance. Space is limited on the night, so a cab is usually faster after 10pm.',
    },
  ],
} as const;

export const VENUE = {
  name: 'The Vault, Jubilee Hills',
  addressLines: ['Road No. 36, Jubilee Hills', 'Hyderabad, Telangana 500033'],
  mapsQuery: 'Jubilee Hills, Hyderabad, Telangana',
  landmark: 'Opposite Jubilee Hills Check Post',
} as const;

export const STATS = [
  { value: '40+', label: 'Nights produced' },
  { value: '25k', label: 'People through the door' },
  { value: '60s', label: 'Average ticket delivery' },
  { value: '4.8', label: 'Average night rating' },
] as const;

export const ABOUT_STORY = {
  heading: 'We started because Hyderabad deserved better nights.',
  paragraphs: [
    'Houz of Vybe began in 2022 with one rented rig, a borrowed rooftop and a guest list written on somebody’s phone. The pitch was simple: put the sound first, cap the room, and stop treating the crowd like a spreadsheet.',
    'Forty-odd nights later the rig is ours, the rooms are bigger, and the guest list is a QR code. What has not changed is the ceiling on capacity — we would rather sell out early than sell you a night you have to fight through.',
    'We produce everything in-house: booking, sound design, lighting, door operations and the ticketing platform you are looking at right now. That vertical integration is why a ticket reaches your inbox in under a minute and why the door queue actually moves.',
  ],
  values: [
    {
      title: 'Sound before spectacle',
      copy: 'The rig gets the budget first. Everything else is arranged around what the room sounds like at 1am.',
    },
    {
      title: 'Capped rooms, always',
      copy: 'We publish capacity and we stop at it. An oversold room is a worse night for everyone in it.',
    },
    {
      title: 'A door that respects you',
      copy: 'QR entry, trained staff, zero-tolerance harassment policy and a welfare lead on shift every night.',
    },
  ],
} as const;

/**
 * Gallery placeholders. Each item is rendered as a generated gradient tile, so
 * the site ships with no binary assets and no licensing questions — drop real
 * photography in by replacing `src` with an image path.
 */
export const GALLERY = [
  { id: 1, caption: 'Corridor, 1:40am', event: 'OffCampus Preview', hue: 218, span: 'tall' },
  { id: 2, caption: 'Rooftop opening', event: 'Skyline Sessions', hue: 205, span: 'wide' },
  { id: 3, caption: 'Front row', event: 'Bass Theory', hue: 232, span: 'normal' },
  { id: 4, caption: 'Booth view', event: 'OffCampus Preview', hue: 196, span: 'normal' },
  { id: 5, caption: 'Doors, 9pm', event: 'Neon Semester', hue: 224, span: 'wide' },
  { id: 6, caption: 'Closing set', event: 'Skyline Sessions', hue: 210, span: 'tall' },
  { id: 7, caption: 'Lecture Hall warm-up', event: 'OffCampus Preview', hue: 240, span: 'normal' },
  { id: 8, caption: 'The last hour', event: 'Bass Theory', hue: 200, span: 'normal' },
  { id: 9, caption: 'Rig check', event: 'Production', hue: 214, span: 'wide' },
] as const;

export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Pick your night',
    copy: 'Choose the event and the ticket tier that fits. Live stock, so what you see is what is actually left.',
  },
  {
    step: '02',
    title: 'Three fields, no account',
    copy: 'Name, a working email and your mobile number. No password, no sign-up, no marketing wall.',
  },
  {
    step: '03',
    title: 'QR hits your inbox',
    copy: 'A signed QR pass per head, emailed instantly. Screenshot it — it works offline.',
  },
  {
    step: '04',
    title: 'Scan and walk in',
    copy: 'Our door team scans once. The pass is consumed on the spot, so nobody can copy it in.',
  },
] as const;

export const TESTIMONIALS = [
  {
    quote: 'Booked at 6pm, ticket was in my inbox before I finished typing my number. Door queue took ninety seconds.',
    name: 'Aditya R.',
    context: 'Skyline Sessions',
  },
  {
    quote: 'The Corridor room at 1am is genuinely the best sound in the city right now. Not close.',
    name: 'Nikita S.',
    context: 'Bass Theory',
  },
  {
    quote: 'They capped the room and it showed — you could actually move, actually hear, actually get a drink.',
    name: 'Farhan M.',
    context: 'Neon Semester',
  },
] as const;
