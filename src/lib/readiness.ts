import 'server-only';
import { env, missingCoreConfig } from './env';
import { pingDatabase, query } from './db';

/**
 * Is this deployment actually able to sell a ticket?
 *
 * `/api/health` answers "is the process alive", which is the question a
 * monitor asks. This answers the question a person asks when the site is up
 * and nothing is working: what, specifically, is missing.
 *
 * Every check names the variable or the action that fixes it. A readiness
 * report that says "payments: false" has told you nothing you could not see
 * from the site; one that says "PAYMENTS_ENABLED is not set" has finished the
 * job.
 */

export type CheckStatus = 'ok' | 'warn' | 'fail';

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  /** What is true right now. */
  detail: string;
  /** What to do about it, when it is not ok. */
  fix?: string;
}

export interface Readiness {
  /** fail = customers cannot buy. warn = they can, but something is degraded. */
  status: CheckStatus;
  checks: Check[];
}

export async function readiness(): Promise<Readiness> {
  const checks: Check[] = [];

  /* ---------------------------------------------------------------------
   * The pause switch, checked first and on purpose.
   *
   * This is the single most likely reason a working deployment serves nothing
   * but a maintenance page, and it is invisible from the code: the middleware
   * reads SITE_PAUSED from the environment and returns 503 for the whole
   * public site before any page renders. Somebody set it during an incident
   * and it outlived the incident.
   * ------------------------------------------------------------------- */
  const paused = (process.env.SITE_PAUSED ?? 'false').trim().toLowerCase() === 'true';
  checks.push({
    id: 'site_paused',
    label: 'Public site',
    status: paused ? 'fail' : 'ok',
    detail: paused
      ? 'SITE_PAUSED is set, so every public page returns a 503 maintenance notice.'
      : 'Open. Customers can reach the site.',
    fix: paused
      ? 'Delete the SITE_PAUSED environment variable in your hosting dashboard (or set it to false) and redeploy.'
      : undefined,
  });

  /* --- Core configuration --------------------------------------------- */
  const missing = missingCoreConfig();
  checks.push({
    id: 'config',
    label: 'Core configuration',
    status: missing.length > 0 ? 'fail' : 'ok',
    detail:
      missing.length > 0
        ? `Not set: ${missing.join(', ')}.`
        : 'Database URL and signing keys are all resolvable.',
    fix:
      missing.length > 0
        ? 'Set these in the deployment environment. ADMIN_SESSION_SECRET and TICKET_SIGNING_SECRET can be derived automatically if the Supabase integration is connected.'
        : undefined,
  });

  /* --- Database -------------------------------------------------------- */
  const db = await pingDatabase();
  checks.push({
    id: 'database',
    label: 'Database',
    status: db.ok ? 'ok' : 'fail',
    detail: db.ok
      ? `Reachable in ${db.latencyMs}ms via ${env.databaseUrlSource}.`
      : `Cannot connect: ${db.error ?? 'unknown error'}`,
    fix: db.ok
      ? undefined
      : 'Check the connection string, and that the database accepts connections from your host.',
  });

  // Everything below needs a working database. Asking anyway produces a wall
  // of identical connection errors that buries the one real answer above.
  if (!db.ok) {
    return { status: 'fail', checks };
  }

  /* --- Schema ---------------------------------------------------------- */
  const schema = await schemaState();
  checks.push(schema);

  if (schema.status === 'fail') {
    return { status: 'fail', checks };
  }

  /* --- Someone to run it ----------------------------------------------- */
  const [{ count: admins }] = await query<{ count: number }>(
    `SELECT count(*)::int AS count FROM admin_users WHERE active`,
  );
  checks.push({
    id: 'admins',
    label: 'Console access',
    status: admins > 0 ? 'ok' : 'fail',
    detail: admins > 0 ? `${admins} active staff account${admins === 1 ? '' : 's'}.` : 'No staff accounts exist.',
    fix: admins > 0 ? undefined : 'Run `npm run admin:create` to make the first one.',
  });

  /* --- Something to sell ------------------------------------------------ */
  const [events] = await query<{
    published: number;
    upcoming: number;
    sellable: number;
  }>(
    `SELECT count(*) FILTER (WHERE status IN ('published','sold_out'))::int AS published,
            count(*) FILTER (WHERE status IN ('published','sold_out')
                               AND COALESCE(ends_at, starts_at) >= now())::int AS upcoming,
            count(*) FILTER (WHERE status = 'published'
                               AND COALESCE(ends_at, starts_at) >= now()
                               AND EXISTS (SELECT 1 FROM ticket_tiers t
                                            WHERE t.event_id = events.id
                                              AND t.active
                                              AND t.quantity > t.sold))::int AS sellable
       FROM events`,
  );

  checks.push({
    id: 'events',
    label: 'Events on sale',
    status: events.sellable > 0 ? 'ok' : events.upcoming > 0 ? 'warn' : 'fail',
    detail:
      events.sellable > 0
        ? `${events.sellable} event${events.sellable === 1 ? '' : 's'} published with passes available.`
        : events.upcoming > 0
          ? `${events.upcoming} upcoming event${events.upcoming === 1 ? '' : 's'}, but none with a pass in stock.`
          : `No upcoming events. ${events.published} published date${events.published === 1 ? ' has' : 's have'} already happened.`,
    fix:
      events.sellable > 0
        ? undefined
        : 'Open /admin/events, create or edit a date, add at least one pass, and set its status to Published.',
  });

  /* --- Money ------------------------------------------------------------ */
  const payments = env.paymentsEnabled && env.paymentProvider !== 'none';
  checks.push({
    id: 'payments',
    label: 'Payments',
    status: payments ? 'ok' : 'fail',
    detail: payments
      ? `${env.paymentProvider} is configured and enabled.`
      : env.paymentProvider === 'none'
        ? 'No payment provider is configured — checkout cannot take money.'
        : 'A provider is configured but PAYMENTS_ENABLED is off.',
    fix: payments
      ? undefined
      : 'Set PAYMENT_PROVIDER and its key/secret, and PAYMENTS_ENABLED=true. UPI collection can run alongside.',
  });

  /* --- Delivery --------------------------------------------------------- */
  checks.push({
    id: 'smtp',
    label: 'Email delivery',
    status: env.smtpConfigured ? 'ok' : 'warn',
    detail: env.smtpConfigured
      ? 'SMTP credentials are present. Probe them with /api/health?probe=smtp.'
      : 'Not configured. Tickets will not be emailed, and account verification and password resets cannot work at all.',
    fix: env.smtpConfigured
      ? undefined
      : 'Set SMTP_USER, SMTP_PASSWORD and MAIL_FROM_ADDRESS. Customers can still see passes on their booking page without it, but nobody can verify an account.',
  });

  /* --- Where the links point -------------------------------------------- */
  const siteUrl = env.siteUrl;
  const localish = /localhost|127\.0\.0\.1|vercel\.app$/.test(new URL(siteUrl).hostname);
  checks.push({
    id: 'site_url',
    label: 'Public URL',
    status: localish && env.isProduction ? 'warn' : 'ok',
    detail: `Links in emails and QR passes point at ${siteUrl}.`,
    fix:
      localish && env.isProduction
        ? 'Set NEXT_PUBLIC_SITE_URL to the customer-facing domain, or every emailed ticket links to a preview URL.'
        : undefined,
  });

  const status: CheckStatus = checks.some((check) => check.status === 'fail')
    ? 'fail'
    : checks.some((check) => check.status === 'warn')
      ? 'warn'
      : 'ok';

  return { status, checks };
}

/**
 * Has `npm run db:push` been run, and recently enough?
 *
 * Checks for the columns this release added rather than merely for the tables,
 * because a database created before it is a database where the site throws on
 * every query for a missing column — which looks like an outage and reads in
 * the logs like a bug.
 */
async function schemaState(): Promise<Check> {
  const required: [string, string][] = [
    ['events', 'content'],
    ['events', 'featured'],
    ['customers', 'password_hash'],
    ['customer_tokens', 'token_hash'],
  ];

  const rows = await query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (table_name, column_name) IN (
          ('events','content'), ('events','featured'),
          ('customers','password_hash'), ('customer_tokens','token_hash')
        )`,
  );

  const present = new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));
  const absent = required
    .map(([table, column]) => `${table}.${column}`)
    .filter((key) => !present.has(key));

  return {
    id: 'schema',
    label: 'Database schema',
    status: absent.length === 0 ? 'ok' : 'fail',
    detail:
      absent.length === 0
        ? 'Up to date with this release.'
        : `Missing: ${absent.join(', ')}.`,
    fix: absent.length === 0 ? undefined : 'Run `npm run db:push` against this database.',
  };
}
