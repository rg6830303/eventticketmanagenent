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
      database: {
        ok: db.ok,
        latencyMs: db.latencyMs,
        // Naming the variable turns "the database is down" into "the deployment
        // is reading the wrong one", which are very different problems.
        source: env.databaseUrlSource,
        ...(db.error ? { error: db.error } : {}),
      },
      smtp: { configured: env.smtpConfigured },
      // Reports the provider actually selected rather than a hard-coded name,
      // so "payments are on" and "which gateway" cannot disagree in a probe.
      payments: {
        enabled: env.paymentsEnabled,
        provider: env.paymentsEnabled ? env.paymentProvider : 'none',
        mode:
          env.paymentProvider === 'cashfree'
            ? env.cashfree.sandbox
              ? 'sandbox'
              : 'production'
            : null,
        configured: env.paymentProvider === 'cashfree' ? env.cashfree.configured : undefined,
      },
      upi: { enabled: env.upi.enabled },
    },
  };

  return NextResponse.json(body, {
    status: db.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
