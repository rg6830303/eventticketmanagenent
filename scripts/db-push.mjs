#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { loadEnv, requireDatabaseUrl, sslConfig } from './_env.mjs';

loadEnv();

const pool = new pg.Pool({
  connectionString: requireDatabaseUrl(),
  ssl: sslConfig(),
  max: 1,
  connectionTimeoutMillis: 20_000,
});

async function main() {
  const schemaPath = resolve(process.cwd(), 'db', 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf8');

  console.log('\n  Houz of Vybe — schema push');
  console.log('  ─────────────────────────────');
  console.log(`  Source: ${schemaPath}`);
  console.log('  The schema is idempotent, so re-running is safe.\n');

  const client = await pool.connect();
  try {
    // Executed as one batch: CREATE TABLE IF NOT EXISTS and the trigger
    // redefinitions are order-dependent, so splitting on ';' would break the
    // plpgsql function body anyway.
    await client.query(sql);
    console.log('  ✓ Schema applied');

    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`,
    );
    console.log(`\n  Tables (${rows.length}):`);
    for (const row of rows) console.log(`    · ${row.table_name}`);
    console.log('\n  Next: npm run db:seed && npm run admin:create\n');
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error('\n  ✗ Schema push failed:', error.message, '\n');
    process.exitCode = 1;
  })
  .finally(() => pool.end());
