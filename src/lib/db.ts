import 'server-only';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { env } from './env';

/**
 * Postgres access layer.
 *
 * Serverless functions are recycled aggressively, so the pool is cached on
 * globalThis to survive hot reloads in dev and warm-lambda reuse in prod.
 * `max` is deliberately small: every concurrent lambda holds its own pool, so
 * a large per-pool cap is how you exhaust a Postgres connection limit. Point
 * DATABASE_URL at a pooler (Supabase pgBouncer / Neon pooled endpoint) in
 * production.
 */

declare global {
  // eslint-disable-next-line no-var
  var __hovPool: Pool | undefined;
}

/**
 * Supabase and Neon both hand you a URL ending in `?sslmode=require`.
 *
 * As of pg 8.23, `sslmode=require` in the connection string is treated as
 * `verify-full` and takes precedence over the `ssl` option below — so the
 * connection dies with "self-signed certificate in certificate chain" against
 * providers whose chain Node does not ship a root for. Stripping the parameter
 * hands the decision back to the explicit `ssl` config.
 */
function connectionString(): string {
  const raw = env.databaseUrl;
  try {
    const url = new URL(raw);
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    // libpq key=value form rather than a URL — leave it untouched.
    return raw;
  }
}

function createPool(): Pool {
  const pool = new Pool({
    connectionString: connectionString(),
    ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });

  // An unhandled 'error' event on an idle client crashes the process.
  pool.on('error', (err) => {
    console.error('[db] idle client error', err.message);
  });

  return pool;
}

export function getPool(): Pool {
  if (!globalThis.__hovPool) {
    globalThis.__hovPool = createPool();
  }
  return globalThis.__hovPool;
}

/** Run a parameterised query. Never interpolate values into the SQL string. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const started = Date.now();
  try {
    const result = await getPool().query<T>(text, params as unknown[]);
    return result.rows;
  } finally {
    const ms = Date.now() - started;
    if (ms > 1_000) {
      console.warn(`[db] slow query ${ms}ms: ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
    }
  }
}

/** Fetch exactly one row, or null. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Run `fn` inside a transaction. Commits on resolve, rolls back on throw, and
 * always returns the client to the pool.
 */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The connection is already broken; the pool will discard it.
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Cheap liveness probe for /api/health. */
export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = Date.now();
  try {
    await query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'unknown error',
    };
  }
}
