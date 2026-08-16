import { NextResponse } from 'next/server';
import { pingDatabase } from '@/lib/db';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness/readiness probe. The database is the only hard dependency, so a
 * failed ping is a 503; SMTP is reported but not probed — `verifySmtp()` opens
 * a real authenticated connection to Gmail, which would be a rude thing to do
 * on every uptime check.
 */
export async function GET() {
  const db = await pingDatabase();

  const body = {
    status: db.ok ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: env.appEnv,
    checks: {
      database: { ok: db.ok, latencyMs: db.latencyMs, ...(db.error ? { error: db.error } : {}) },
      smtp: { configured: env.smtpConfigured },
      payments: { enabled: env.paymentsEnabled, provider: env.paymentsEnabled ? 'razorpay' : 'none' },
    },
  };

  return NextResponse.json(body, {
    status: db.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
