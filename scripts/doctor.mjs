#!/usr/bin/env node
import pg from 'pg';
import { loadEnv, sslConfig } from './_env.mjs';

loadEnv();

/**
 * Why can't this deployment sell a ticket?
 *
 * The console has the same report at /admin/status, but that needs a running
 * deployment you can log into — which is exactly what you do not have when the
 * answer is "the database was never set up" or "nobody ever created an admin
 * user". This runs against a connection string and nothing else, so it works
 * before the first deploy and during an outage.
 *
 *   npm run doctor
 *   DATABASE_URL=postgres://... npm run doctor
 *
 * Reads only. It will never change anything it finds.
 */

const checks = [];
const add = (status, label, detail, fix) => checks.push({ status, label, detail, fix });

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const MARK = { ok: '\x1b[32m✓\x1b[0m', warn: '\x1b[33m!\x1b[0m', fail: '\x1b[31m✗\x1b[0m' };

function has(name) {
  return Boolean(process.env[name]?.trim());
}

function firstOf(...names) {
  return names.find((name) => has(name)) ?? null;
}

async function main() {
  console.log('\n  Houz of Vybe — go-live check');
  console.log('  ────────────────────────────\n');

  /* --- The pause switch, first because it is the usual answer ---------- */
  const paused = (process.env.SITE_PAUSED ?? '').trim().toLowerCase() === 'true';
  add(
    paused ? 'fail' : 'ok',
    'Public site',
    paused
      ? 'SITE_PAUSED=true — every public page serves a 503 maintenance notice.'
      : 'Not paused.',
    paused
      ? 'Remove SITE_PAUSED (or set it to false) in your hosting environment, then redeploy.'
      : null,
  );

  /* --- Connection string ------------------------------------------------ */
  const dbVar = firstOf(
    'DATABASE_URL',
    'POSTGRES_URL',
    'POSTGRES_PRISMA_URL',
    'POSTGRES_URL_NON_POOLING',
  );
  add(
    dbVar ? 'ok' : 'fail',
    'Database URL',
    dbVar ? `Reading ${dbVar}.` : 'None of DATABASE_URL / POSTGRES_URL / … are set.',
    dbVar ? null : 'Set DATABASE_URL, or connect the Supabase integration which supplies POSTGRES_URL.',
  );

  /* --- Signing keys ----------------------------------------------------- */
  const derivable = firstOf(
    'SUPABASE_JWT_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SECRET_KEY',
    'POSTGRES_PASSWORD',
  );
  for (const name of ['ADMIN_SESSION_SECRET', 'TICKET_SIGNING_SECRET']) {
    add(
      has(name) || derivable ? 'ok' : 'fail',
      name,
      has(name)
        ? 'Set explicitly.'
        : derivable
          ? `Not set — will be derived from ${derivable}.`
          : 'Not set, and nothing to derive it from.',
      has(name) || derivable
        ? null
        : `Set ${name} to 32+ random characters: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }

  /* --- Money and mail --------------------------------------------------- */
  const provider = (process.env.PAYMENT_PROVIDER ?? 'none').trim().toLowerCase();
  const paymentsOn = ['1', 'true', 'yes', 'on'].includes(
    (process.env.PAYMENTS_ENABLED ?? '').trim().toLowerCase(),
  );
  add(
    provider !== 'none' && paymentsOn ? 'ok' : 'fail',
    'Payments',
    provider === 'none'
      ? 'PAYMENT_PROVIDER is not set — checkout cannot take money.'
      : paymentsOn
        ? `${provider}, enabled.`
        : `${provider} configured, but PAYMENTS_ENABLED is off.`,
    provider !== 'none' && paymentsOn
      ? null
      : 'Set PAYMENT_PROVIDER, its key and secret, and PAYMENTS_ENABLED=true.',
  );

  const smtp = has('SMTP_USER') && has('SMTP_PASSWORD');
  add(
    smtp ? 'ok' : 'warn',
    'Email',
    smtp
      ? 'SMTP credentials present.'
      : 'No SMTP credentials — no ticket emails, and account verification cannot work at all.',
    smtp ? null : 'Set SMTP_USER, SMTP_PASSWORD and MAIL_FROM_ADDRESS.',
  );

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  add(
    siteUrl ? 'ok' : 'warn',
    'Public URL',
    siteUrl ? siteUrl : 'NEXT_PUBLIC_SITE_URL is not set — emailed links may point at a preview URL.',
    siteUrl ? null : 'Set NEXT_PUBLIC_SITE_URL to the customer-facing domain.',
  );

  /* --- Everything that needs the database ------------------------------- */
  if (dbVar) {
    const pool = new pg.Pool({
      connectionString: process.env[dbVar],
      ssl: sslConfig(),
      max: 1,
      connectionTimeoutMillis: 15_000,
    });

    try {
      const started = Date.now();
      await pool.query('SELECT 1');
      add('ok', 'Database', `Connected in ${Date.now() - started}ms.`);

      // Schema. Checked by column, not by table: a database created before
      // this release has the tables and throws on every query for a column it
      // has never heard of, which reads in the logs like a bug rather than a
      // migration that was never run.
      const { rows: cols } = await pool.query(
        `SELECT table_name || '.' || column_name AS key
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND (table_name, column_name) IN (
              ('events','content'), ('events','featured'),
              ('customers','password_hash'), ('customer_tokens','token_hash')
            )`,
      );
      const present = new Set(cols.map((row) => row.key));
      const wanted = [
        'events.content',
        'events.featured',
        'customers.password_hash',
        'customer_tokens.token_hash',
      ];
      const absent = wanted.filter((key) => !present.has(key));
      add(
        absent.length === 0 ? 'ok' : 'fail',
        'Schema',
        absent.length === 0 ? 'Up to date.' : `Missing: ${absent.join(', ')}`,
        absent.length === 0 ? null : 'Run `npm run db:push`.',
      );

      if (absent.length === 0) {
        const { rows: admins } = await pool.query(
          'SELECT count(*)::int AS n FROM admin_users WHERE active',
        );
        add(
          admins[0].n > 0 ? 'ok' : 'fail',
          'Console access',
          `${admins[0].n} active staff account${admins[0].n === 1 ? '' : 's'}.`,
          admins[0].n > 0 ? null : 'Run `npm run admin:create`.',
        );

        const { rows: events } = await pool.query(
          `SELECT count(*) FILTER (WHERE status IN ('published','sold_out')
                                     AND COALESCE(ends_at, starts_at) >= now())::int AS upcoming,
                  count(*) FILTER (WHERE status = 'published'
                                     AND COALESCE(ends_at, starts_at) >= now()
                                     AND EXISTS (SELECT 1 FROM ticket_tiers t
                                                  WHERE t.event_id = events.id
                                                    AND t.active AND t.quantity > t.sold))::int AS sellable
             FROM events`,
        );
        const { upcoming, sellable } = events[0];
        add(
          sellable > 0 ? 'ok' : upcoming > 0 ? 'warn' : 'fail',
          'Events on sale',
          sellable > 0
            ? `${sellable} published with passes available.`
            : upcoming > 0
              ? `${upcoming} upcoming, none with a pass in stock.`
              : 'Nothing upcoming.',
          sellable > 0
            ? null
            : 'In the console: /admin/events → create or edit a date, add a pass, set it to Published.',
        );
      }
    } catch (error) {
      add('fail', 'Database', `Cannot connect: ${error.message}`, 'Check the connection string and that your host is allowed to connect.');
    } finally {
      await pool.end().catch(() => {});
    }
  }

  /* --- Report ----------------------------------------------------------- */
  for (const check of checks) {
    console.log(`  ${MARK[check.status]} ${check.label}`);
    console.log(`     ${DIM}${check.detail}${RESET}`);
    if (check.fix) console.log(`     → ${check.fix}`);
    console.log('');
  }

  const failures = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warn').length;

  if (failures > 0) {
    console.log(`  ${failures} blocking issue${failures === 1 ? '' : 's'}. Customers cannot buy a ticket yet.\n`);
    process.exitCode = 1;
  } else if (warnings > 0) {
    console.log(`  Ready to sell, with ${warnings} thing${warnings === 1 ? '' : 's'} degraded.\n`);
  } else {
    console.log('  Ready to sell.\n');
  }
}

main().catch((error) => {
  console.error('\n  The check itself failed:', error.message, '\n');
  process.exit(1);
});
