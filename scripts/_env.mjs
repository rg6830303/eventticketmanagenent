import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Minimal .env loader.
 *
 * These scripts run outside Next.js, which is what loads .env.local normally.
 * Pulling in dotenv for ~15 lines of parsing is not worth a dependency.
 * Values already present in process.env win, so CI and one-off overrides
 * (DATABASE_URL=... node scripts/db-push.mjs) behave as expected.
 */
export function loadEnv(files = ['.env.local', '.env']) {
  for (const file of files) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;

    for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const eq = line.indexOf('=');
      if (eq === -1) continue;

      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

export function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('\n  ✗ DATABASE_URL is not set.');
    console.error('    Copy .env.example to .env.local and fill it in, or pass it inline:');
    console.error('    DATABASE_URL="postgresql://…" npm run db:push\n');
    process.exit(1);
  }
  return url;
}

/**
 * Supabase and Neon both terminate TLS with a certificate chain Node does not
 * ship a root for, so verification is disabled rather than the connection.
 * Set DATABASE_SSL=false only for a local Postgres with no TLS at all.
 */
export function sslConfig() {
  const flag = (process.env.DATABASE_SSL ?? 'true').toLowerCase();
  return ['0', 'false', 'no', 'off'].includes(flag) ? undefined : { rejectUnauthorized: false };
}
