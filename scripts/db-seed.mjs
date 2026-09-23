#!/usr/bin/env node
import pg from 'pg';
import { loadEnv, requireDatabaseUrl, sslConfig } from './_env.mjs';

loadEnv();

const pool = new pg.Pool({
  connectionString: requireDatabaseUrl(),
  ssl: sslConfig(),
  max: 1,
  connectionTimeoutMillis: 20_000,
});

/**
 * Seed for OFF Campus — Freshers '26.
 *
 * Venue: Kingdome Klub & Kitchen in Hyderabad's Financial District,
 * Saturday 12 September 2026, doors at noon, music until four.
 *
 * Prices and stock are the operator's call — edit TIERS below and re-run, the
 * insert is an upsert and will not lower a tier's quantity under what has
 * already sold.
 *
 * Quantities are deliberately enormous rather than absent: the CHECK
 * (sold <= quantity) constraint is what stops a race overselling the room, and
 * it is worth keeping even when the ceiling is effectively infinite. Set a real
 * number here the day the door actually has a limit.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** A wall-clock IST time expressed as the UTC instant it actually happens at. */
function ist(year, month, day, hour, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MS);
}

/**
 * The editorial layer for OFF Campus, moved out of src/content/site.ts.
 *
 * It lived in TypeScript while there was one event that was never going to
 * change. Now that events are created from the console it belongs in the row
 * it describes, or an archived party goes on being described in the present
 * tense by the site's source code.
 */
const OFFCAMPUS_CONTENT = {
  presentedBy: 'Houz of Vybe × Kingdome Klub & Kitchen',
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
    area: 'Financial District',
    addressLines: [
      '251/8, E/1, Kingdome Klub Rd, Financial District',
      'Hyderabad, Telangana 500075',
    ],
    mapsUrl: 'https://share.google/LiUERsDBUai9sXKAS',
    landmark: 'Kingdome Klub Road, Financial District',
  },
  activities: [
    { title: 'Non-stop DJ', note: 'One booth, no dead air, from the first hour to the last.', icon: 'deck' },
    { title: 'Photo booth', note: 'Props, prints and a backdrop that does not look like a wall.', icon: 'camera' },
    { title: 'Temporary tattoos', note: 'Pick a design, wear it for the weekend, regret nothing.', icon: 'tattoo' },
    { title: 'Private booth', note: 'A curtained corner of your own. Entirely opt-in.', icon: 'booth' },
    { title: 'Find your Vybe', note: 'Short rounds, new faces, no pressure to stay past the buzzer.', icon: 'stopwatch' },
    { title: 'And more on the day', note: 'A few extras we are keeping off the poster on purpose.', icon: 'gift' },
  ],
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
    { q: 'How do I get my ticket?', a: 'You book on this site and the QR pass is emailed to you within a minute. It also appears on your booking page straight away, so you have it even before the email lands.' },
    { q: 'Do I have to print it?', a: 'No. Show the QR on your phone. Screenshot it before you leave home, because it scans fine offline and venue signal is never reliable.' },
    { q: 'Can two of us use one QR?', a: 'No. Every QR admits one person and is dead the moment it is scanned. Book two tickets and you get two codes in the same email.' },
    { q: 'How do referral codes work?', a: 'Type the code into the referral box when you book. A valid code takes a flat ₹100 off the whole order, applied before you pay. One code per booking.' },
    { q: 'Is there a dress code?', a: 'It is a day party, so wear what you would wear to one. No shorts is not a rule here, but the venue reserves the right of admission.' },
    { q: 'Can I get a refund?', a: 'Tickets are non-refundable once issued. If we cancel or move the date, you get the full amount back automatically, to the same method you paid with, within 7 working days.' },
    { q: 'Can I change the name on a ticket?', a: 'Yes, up to 24 hours before doors. Email us from the address you booked with and we will reissue it. The old QR dies at that moment.' },
    { q: 'How do I get there?', a: 'Kingdome Klub & Kitchen is on Kingdome Klub Road in the Financial District. Cabs drop at the entrance. Parking on site is limited on the day.' },
  ],
  ticker: [
    'OFF CAMPUS',
    "FRESHERS '26",
    'KINGDOME KLUB',
    'NON-STOP DJ',
    'FINANCIAL DISTRICT',
    '12PM — 4PM',
  ],
};

const EVENT = {
  slug: 'offcampus',
  name: 'OFF Campus',
  tagline: "Freshers '26",
  edition: "Freshers '26",
  content: OFFCAMPUS_CONTENT,
  description:
    'The Freshers welcome for the class of 2026, thrown by Houz of Vybe at Kingdome Klub & Kitchen in the Financial District. Non-stop DJ, photo booth, temporary tattoos and more, from noon to four.',
  venueName: 'Kingdome Klub & Kitchen',
  venueAddress:
    '251/8, E/1, Kingdome Klub Rd, Financial District, Hyderabad, Telangana 500075',
  city: 'Hyderabad',
  starts: ist(2026, 9, 12, 12, 0),
  ends: ist(2026, 9, 12, 16, 0),
  doors: ist(2026, 9, 12, 12, 0),
  capacity: 100000,
  ageLimit: 18,
};

const TIERS = [
  {
    code: 'NORMAL',
    name: 'Normal Pass',
    description:
      'Solo entry to the complete non-alcoholic party, with part of the pass value redeemable at the venue.',
    price_paise: 130000,
    quantity: 100000,
    admits: 1,
    redeemable_paise: 50000,
    perks: ['Admits 1 guest', '₹500 cover redeemable', 'Full party access'],
    sort_order: 1,
  },
  {
    code: 'COUPLE',
    name: 'Couple Pass',
    description:
      'A two-person pass designed for pairs, with a shared redeemable value at the venue.',
    price_paise: 250000,
    quantity: 100000,
    admits: 2,
    redeemable_paise: 100000,
    perks: ['Admits 2 guests', '₹1,000 cover redeemable', 'Best for pairs'],
    sort_order: 2,
  },
  {
    code: 'GROUP',
    name: 'Group Pass',
    description:
      'Entry for five, with half the cover value of a VIP table. The cheapest way in for a group.',
    price_paise: 555500,
    quantity: 100000,
    admits: 5,
    redeemable_paise: 250000,
    perks: ['Admits 5 guests', '₹2,500 cover redeemable', 'Best value for a group'],
    sort_order: 3,
  },
  {
    code: 'VIPTABLE',
    name: 'VIP Pass',
    description:
      'A reserved VIP table for five guests, with a generous cover value redeemable at the venue.',
    price_paise: 1000000,
    quantity: 100000,
    admits: 5,
    redeemable_paise: 500000,
    perks: ['Admits 5 guests', '₹5,000 cover redeemable', 'Reserved VIP table'],
    sort_order: 4,
  },
];

/**
 * Referral codes. KAVYANSH100 is the first one and is deliberately unlimited —
 * add `max_uses` to any code that should stop working after a while.
 */
const REFERRAL_CODES = [
  { code: 'KRISH100', label: 'Krish', discount_paise: 10000, max_uses: null },
  { code: 'SID100', label: 'Sid', discount_paise: 10000, max_uses: null },
  { code: 'RAHUL100', label: 'Rahul', discount_paise: 10000, max_uses: null },
  { code: 'SAMARTH100', label: 'Samarth', discount_paise: 10000, max_uses: null },
  { code: 'NEEL100', label: 'Neel', discount_paise: 10000, max_uses: null },
  { code: 'KRISHA100', label: 'Krisha', discount_paise: 10000, max_uses: null },
  { code: 'ARPITA100', label: 'Arpita', discount_paise: 10000, max_uses: null },
  { code: 'RISHITA100', label: 'Rishita', discount_paise: 10000, max_uses: null },
  { code: 'RITIK100', label: 'Ritik', discount_paise: 10000, max_uses: null },
  { code: 'VIHAAN100', label: 'Vihaan', discount_paise: 10000, max_uses: null },
  { code: 'RAJ100', label: 'Raj', discount_paise: 10000, max_uses: null },
  { code: 'RAUNAK100', label: 'Raunak', discount_paise: 10000, max_uses: null },
  { code: 'YASHASWINI100', label: 'Yashaswini', discount_paise: 10000, max_uses: null },
  { code: 'KAVYANSH100', label: 'Kavyansh', discount_paise: 10000, max_uses: null },
  { code: 'ANTRA100', label: 'Antra', discount_paise: 10000, max_uses: null },
];

async function main() {
  console.log('\n  Houz of Vybe — seed');
  console.log('  ─────────────────────');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    /*
     * Status is derived, not asserted.
     *
     * This used to write 'published' unconditionally, which is a quiet way to
     * resurrect a party that already happened: re-running the seed after the
     * date passed would put OFF Campus back on sale. An event whose end time
     * is behind us is archived instead — that is what "past event" means here,
     * and it is what takes the date off the front of the shop while leaving
     * every booking, ticket and scan attached to it untouched.
     */
    const finished = (EVENT.ends ?? EVENT.starts).getTime() < Date.now();
    const status = finished ? 'archived' : 'published';

    const { rows } = await client.query(
      `INSERT INTO events (
         slug, name, tagline, edition, description, venue_name, venue_address, city,
         starts_at, ends_at, doors_at, capacity, age_limit, status, content
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         tagline = EXCLUDED.tagline,
         edition = EXCLUDED.edition,
         description = EXCLUDED.description,
         venue_name = EXCLUDED.venue_name,
         venue_address = EXCLUDED.venue_address,
         starts_at = EXCLUDED.starts_at,
         ends_at = EXCLUDED.ends_at,
         doors_at = EXCLUDED.doors_at,
         capacity = EXCLUDED.capacity,
         age_limit = EXCLUDED.age_limit,
         status = EXCLUDED.status,
         -- Only fill content that is not already there. An operator who has
         -- edited this event in the console must not have their words replaced
         -- by the ones hard-coded in this file every time the seed is re-run.
         content = CASE WHEN events.content = '{}'::jsonb
                        THEN EXCLUDED.content ELSE events.content END
       RETURNING id, name, starts_at, status`,
      [
        EVENT.slug,
        EVENT.name,
        EVENT.tagline,
        EVENT.edition,
        EVENT.description,
        EVENT.venueName,
        EVENT.venueAddress,
        EVENT.city,
        EVENT.starts.toISOString(),
        EVENT.ends.toISOString(),
        EVENT.doors.toISOString(),
        EVENT.capacity,
        EVENT.ageLimit,
        status,
        JSON.stringify(EVENT.content),
      ],
    );

    const event = rows[0];
    console.log(
      `  ✓ Event: ${event.name} ${EVENT.tagline}` +
        (finished ? '  (archived — this date has passed)' : ''),
    );

    // Retire earlier pricing phases without deleting their booking history.
    await client.query(
      'UPDATE ticket_tiers SET active = false WHERE event_id = $1 AND NOT (code = ANY($2::text[]))',
      [event.id, TIERS.map((tier) => tier.code)],
    );

    for (const tier of TIERS) {
      await client.query(
        `INSERT INTO ticket_tiers (
           event_id, code, name, description, price_paise, quantity,
           perks, sort_order, admits, redeemable_paise, active
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
         ON CONFLICT (event_id, code) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           price_paise = EXCLUDED.price_paise,
           -- Never lower quantity below what has already been sold; the CHECK
           -- constraint would reject it and take the whole seed down.
           quantity = GREATEST(EXCLUDED.quantity, ticket_tiers.sold),
           perks = EXCLUDED.perks,
           sort_order = EXCLUDED.sort_order,
           admits = EXCLUDED.admits,
           redeemable_paise = EXCLUDED.redeemable_paise,
           active = true`,
        [
          event.id,
          tier.code,
          tier.name,
          tier.description,
          tier.price_paise,
          tier.quantity,
          JSON.stringify(tier.perks),
          tier.sort_order,
          tier.admits,
          tier.redeemable_paise,
        ],
      );
    }

    // Tiers from an earlier line-up are deactivated rather than deleted: a
    // tier that has ever sold a ticket is referenced by those tickets, and the
    // admin console still has to be able to name what somebody bought.
    // `active = false` takes it off sale and out of every listing.
    const { rowCount: retired } = await client.query(
      `UPDATE ticket_tiers
          SET active = false
        WHERE event_id = $1 AND active = true AND code <> ALL($2::text[])`,
      [event.id, TIERS.map((tier) => tier.code)],
    );
    if (retired > 0) {
      console.log(`  ✓ Retired ${retired} tier${retired === 1 ? '' : 's'} from an earlier line-up`);
    }

    for (const referral of REFERRAL_CODES) {
      await client.query(
        `INSERT INTO referral_codes (code, label, discount_paise, max_uses, active)
         VALUES (upper($1), $2, $3, $4, true)
         ON CONFLICT (code) DO UPDATE SET
           label = EXCLUDED.label,
           discount_paise = EXCLUDED.discount_paise,
           max_uses = EXCLUDED.max_uses,
           active = true`,
        [referral.code, referral.label, referral.discount_paise, referral.max_uses],
      );
    }

    /*
     * A draft for the next date.
     *
     * Created only when there is no future-dated event at all, so re-running
     * the seed after a real one has been set up does not litter the console
     * with templates. It is a `draft`, which is invisible to every public
     * route — the placeholder name and date below can never be shown to a
     * customer, and publishing is a deliberate act in the console once the
     * real details are in.
     */
    const { rows: future } = await client.query(
      `SELECT 1 FROM events WHERE COALESCE(ends_at, starts_at) >= now() LIMIT 1`,
    );

    if (future.length === 0) {
      const start = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      start.setUTCHours(6, 30, 0, 0); // 06:30 UTC is noon IST

      const { rows: draftRows } = await client.query(
        `INSERT INTO events (
           slug, name, tagline, description, venue_name, city,
           starts_at, ends_at, doors_at, capacity, age_limit, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft')
         ON CONFLICT (slug) DO NOTHING
         RETURNING id, slug`,
        [
          'next-event',
          'Untitled event',
          'Draft — not yet announced',
          'Replace this copy in the console before publishing.',
          'To be confirmed',
          EVENT.city,
          start.toISOString(),
          new Date(start.getTime() + 4 * 60 * 60 * 1000).toISOString(),
          start.toISOString(),
          500,
          18,
        ],
      );

      if (draftRows.length > 0) {
        await client.query(
          `INSERT INTO ticket_tiers (
             event_id, code, name, description, price_paise, quantity,
             perks, sort_order, admits, redeemable_paise, active
           ) VALUES ($1,'GENERAL','General Access','Set the real price before publishing.',
                     0, 200, '[]'::jsonb, 1, 1, 0, true)
           ON CONFLICT (event_id, code) DO NOTHING`,
          [draftRows[0].id],
        );
        console.log('  ✓ Draft created for the next date — open /admin/events to fill it in');
      }
    }

    await client.query('COMMIT');

    console.log('\n  Tiers:');
    console.log('    CODE    NAME             PRICE     QTY');
    for (const tier of TIERS) {
      console.log(
        `    ${tier.code.padEnd(7)} ${tier.name.padEnd(16)} ₹${String(tier.price_paise / 100).padEnd(8)} ${tier.quantity}`,
      );
    }

    console.log('\n  Referral codes:');
    for (const referral of REFERRAL_CODES) {
      console.log(
        `    ${referral.code.padEnd(14)} ₹${referral.discount_paise / 100} off   ${
          referral.max_uses ? `${referral.max_uses} uses` : 'unlimited'
        }`,
      );
    }

    const istDate = new Date(event.starts_at).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'short',
    });
    console.log(`\n  Doors: ${istDate} IST`);
    console.log('  Next: npm run admin:create\n');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error('\n  ✗ Seed failed:', error.message);
    console.error('    Have you run npm run db:push first?\n');
    process.exitCode = 1;
  })
  .finally(() => pool.end());
