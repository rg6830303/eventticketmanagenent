#!/usr/bin/env node
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { loadEnv, requireDatabaseUrl, sslConfig } from './_env.mjs';

loadEnv();

const pool = new pg.Pool({
  connectionString: requireDatabaseUrl(),
  ssl: sslConfig(),
  max: 1,
  connectionTimeoutMillis: 20_000,
});

const ROLES = ['owner', 'manager', 'gate'];
const MIN_PASSWORD_LENGTH = 10;

function readArgs() {
  const [email, name, password, role] = process.argv.slice(2);

  if (email && password) {
    return { email, name: name || email.split('@')[0], password, role: role || 'owner' };
  }

  return {
    email: process.env.ADMIN_BOOTSTRAP_EMAIL,
    name: process.env.ADMIN_BOOTSTRAP_NAME || 'Operations',
    password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    role: process.env.ADMIN_BOOTSTRAP_ROLE || 'owner',
  };
}

async function main() {
  const { email, name, password, role } = readArgs();

  if (!email || !password) {
    console.error('\n  ✗ Missing email or password.\n');
    console.error('    Either set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD in .env.local,');
    console.error('    or pass them directly:\n');
    console.error('      node scripts/create-admin.mjs ops@houzofvybe.com "Ops Lead" "<password>" owner\n');
    process.exit(1);
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`\n  ✗ Password must be at least ${MIN_PASSWORD_LENGTH} characters.\n`);
    process.exit(1);
  }

  if (!ROLES.includes(role)) {
    console.error(`\n  ✗ Role must be one of: ${ROLES.join(', ')}\n`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  const { rows } = await pool.query(
    `INSERT INTO admin_users (email, name, password_hash, role, active)
     VALUES ($1,$2,$3,$4,true)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       password_hash = EXCLUDED.password_hash,
       role = EXCLUDED.role,
       active = true,
       -- Re-running this is the documented way to recover a locked-out operator.
       failed_logins = 0,
       locked_until = NULL
     RETURNING id, email, name, role, (xmax = 0) AS created`,
    [email.toLowerCase().trim(), name, hash, role],
  );

  const user = rows[0];
  console.log('\n  Houz of Vybe — admin user');
  console.log('  ───────────────────────────');
  console.log(`  ${user.created ? '✓ Created' : '✓ Updated'}: ${user.email}`);
  console.log(`  Name: ${user.name}`);
  console.log(`  Role: ${user.role}`);
  // The password is deliberately never echoed — shell history and CI logs keep it.
  console.log('\n  Sign in at /admin/login with the password you supplied.');
  console.log('  Remove ADMIN_BOOTSTRAP_PASSWORD from .env.local once you have.\n');
}

main()
  .catch((error) => {
    console.error('\n  ✗ Could not create admin:', error.message);
    console.error('    Have you run npm run db:push first?\n');
    process.exitCode = 1;
  })
  .finally(() => pool.end());
