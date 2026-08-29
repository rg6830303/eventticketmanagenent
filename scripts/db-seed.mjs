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

const EVENT = {
  slug: 'offcampus',
  name: 'OFF Campus',
  tagline: "Freshers '26",
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

    const { rows } = await client.query(
      `INSERT INTO events (
         slug, name, tagline, description, venue_name, venue_address, city,
         starts_at, ends_at, doors_at, capacity, age_limit, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         tagline = EXCLUDED.tagline,
         description = EXCLUDED.description,
         venue_name = EXCLUDED.venue_name,
         venue_address = EXCLUDED.venue_address,
         starts_at = EXCLUDED.starts_at,
         ends_at = EXCLUDED.ends_at,
         doors_at = EXCLUDED.doors_at,
         capacity = EXCLUDED.capacity,
         age_limit = EXCLUDED.age_limit,
         status = EXCLUDED.status
       RETURNING id, name, starts_at`,
      [
        EVENT.slug,
        EVENT.name,
        EVENT.tagline,
        EVENT.description,
        EVENT.venueName,
        EVENT.venueAddress,
        EVENT.city,
        EVENT.starts.toISOString(),
        EVENT.ends.toISOString(),
        EVENT.doors.toISOString(),
        EVENT.capacity,
        EVENT.ageLimit,
        'published',
      ],
    );

    const event = rows[0];
    console.log(`  ✓ Event: ${event.name} ${EVENT.tagline}`);

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
