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
 * The next upcoming Saturday at 21:00 IST, as a UTC instant.
 *
 * Computed rather than hardcoded on purpose: a seeded date in the past makes
 * createBooking() reject every single booking with "This event has already
 * happened", which looks like a broken app rather than stale data.
 */
function nextSaturday2100IST() {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);

  const daysUntilSaturday = (6 - nowIst.getUTCDay() + 7) % 7 || 7;

  const startIst = Date.UTC(
    nowIst.getUTCFullYear(),
    nowIst.getUTCMonth(),
    nowIst.getUTCDate() + daysUntilSaturday,
    21,
    0,
    0,
  );

  const starts = new Date(startIst - IST_OFFSET_MS);
  // Doors with the music; the night runs to 4am the following morning.
  const ends = new Date(starts.getTime() + 7 * 60 * 60 * 1000);
  return { starts, ends };
}

const TIERS = [
  {
    code: 'EARLY',
    name: 'Early Bird',
    description: 'First release. Same access as General Entry, lower price, limited count.',
    price_paise: 99900,
    quantity: 150,
    perks: ['Entry before 11 PM', 'Access to all three rooms'],
    sort_order: 1,
  },
  {
    code: 'GA',
    name: 'General Entry',
    description: 'Standard admission for the full night across every room.',
    price_paise: 149900,
    quantity: 300,
    perks: ['Access to all three rooms', 'Cloakroom included'],
    sort_order: 2,
  },
  {
    code: 'VIP',
    name: 'VIP Access',
    description: 'Skip the queue, elevated viewing deck and a dedicated bar.',
    price_paise: 299900,
    quantity: 100,
    perks: ['Priority entry lane', 'VIP deck access', 'Dedicated bar', 'Cloakroom included'],
    sort_order: 3,
  },
  {
    code: 'TABLE',
    name: 'Table for 4',
    description: 'Reserved table in the Corridor room for four, with bottle service.',
    price_paise: 1199900,
    quantity: 20,
    perks: ['Reserved table for 4', 'Bottle service', 'Priority entry lane', 'Dedicated host'],
    sort_order: 4,
  },
];

async function main() {
  const { starts, ends } = nextSaturday2100IST();

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
         status = EXCLUDED.status
       RETURNING id, name, starts_at`,
      [
        'offcampus',
        'OFFCAMPUS',
        'The after-hours chapter',
        'A one-night rebuild of everything that happened after the lecture hall emptied. Three rooms, one arc, capped capacity.',
        'The Vault, Jubilee Hills',
        'Road No. 36, Jubilee Hills, Hyderabad, Telangana 500033',
        'Hyderabad',
        starts.toISOString(),
        ends.toISOString(),
        starts.toISOString(),
        600,
        21,
        'published',
      ],
    );

    const event = rows[0];
    console.log(`  ✓ Event: ${event.name}`);

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

    await client.query('COMMIT');

    console.log('\n  Tiers seeded:');
    console.log('    CODE    NAME             PRICE        QTY');
    for (const tier of TIERS) {
      console.log(
        `    ${tier.code.padEnd(7)} ${tier.name.padEnd(16)} ₹${String(tier.price_paise / 100).padEnd(11)} ${tier.quantity}`,
      );
    }

    const istDate = new Date(event.starts_at).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'short',
    });
    console.log(`\n  Event date: ${istDate} IST`);
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
