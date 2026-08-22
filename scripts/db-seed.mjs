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
 * Saturday 12 September 2026, doors at noon, music until five.
 *
 * Prices and stock are the operator's call — edit TIERS below and re-run, the
 * insert is an upsert and will not lower a tier's quantity under what has
 * already sold.
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
    'The Freshers welcome for the class of 2026, thrown by Houz of Vybe at Kingdome Klub & Kitchen in the Financial District. Non-stop DJ, photo booth, temporary tattoos and more, from noon to five.',
  venueName: 'Kingdome Klub & Kitchen',
  venueAddress:
    '251/8, E/1, Kingdome Klub Rd, Financial District, Hyderabad, Telangana 500075',
  city: 'Hyderabad',
  starts: ist(2026, 9, 12, 12, 0),
  ends: ist(2026, 9, 12, 17, 0),
  doors: ist(2026, 9, 12, 12, 0),
  capacity: 400,
  ageLimit: 18,
};

const TIERS = [
  {
    code: 'VVIP',
    name: 'VVIP',
    description:
      'Our premium front-line pick for guests who want the sharpest entry experience and the most polished first impression.',
    price_paise: 200000,
    quantity: 80,
    perks: ['Premium entry feel', 'All activities included', 'Best for groups'],
    sort_order: 1,
  },
  {
    code: 'VIP',
    name: 'VIP',
    description:
      'The balanced premium choice with a stronger-than-basic experience for people who want to arrive in style.',
    price_paise: 150000,
    quantity: 140,
    perks: ['Priority-style entry', 'All activities included', 'Popular middle tier'],
    sort_order: 2,
  },
  {
    code: 'GA',
    name: 'GA',
    description:
      'The straightforward all-access ticket: simple, affordable and perfect if you just want the full party.',
    price_paise: 111100,
    quantity: 220,
    perks: ['Full event access', 'All activities included', 'Best value entry'],
    sort_order: 3,
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

    for (const tier of TIERS) {
      await client.query(
        `INSERT INTO ticket_tiers (event_id, code, name, description, price_paise, quantity, perks, sort_order, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
         ON CONFLICT (event_id, code) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           price_paise = EXCLUDED.price_paise,
           -- Never lower quantity below what has already been sold; the CHECK
           -- constraint would reject it and take the whole seed down.
           quantity = GREATEST(EXCLUDED.quantity, ticket_tiers.sold),
           perks = EXCLUDED.perks,
           sort_order = EXCLUDED.sort_order,
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
        ],
      );
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
