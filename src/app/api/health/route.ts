import { NextResponse, type NextRequest } from 'next/server';
import { pingDatabase } from '@/lib/db';
import { env } from '@/lib/env';
import { signingKeyReport } from '@/lib/signing-key';
import { probeGateway } from '@/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness/readiness probe. The database is the only hard dependency, so a
 * failed ping is a 503; SMTP is reported but not probed — `verifySmtp()` opens
 * a real authenticated connection to Gmail, which would be a rude thing to do
 * on every uptime check.
 */
export async function GET(request: NextRequest) {
  const db = await pingDatabase();

  // Opt-in, because it creates a real order at the gateway that nobody pays.
  // Worth having: an account that can authenticate but cannot trade looks
  // completely healthy from every other check.
  const probe =
    new URL(request.url).searchParams.get('probe') === 'gateway'
      ? await probeGateway().catch(() => ({ ok: false, reason: 'probe threw' }))
      : null;

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
      // Names and presence only, never values. "configured: false" with no
      // clue which of the two variables is missing is a guessing game played
      // one redeploy at a time, and the answer is not a secret — whether an
      // env var exists is already inferable from the behaviour.
      smtp: {
        configured: env.smtpConfigured,
        present: Object.fromEntries(
          ['SMTP_USER', 'SMTP_PASSWORD', 'SMTP_HOST', 'SMTP_PORT', 'MAIL_FROM_ADDRESS'].map(
            (name) => [name, Boolean(process.env[name]?.trim())],
          ),
        ),
      },
      // Which variable each signing key came from, and whether it was derived.
      // Never the key itself. "derived: true" against SUPABASE_JWT_SECRET means
      // rotating that secret will invalidate every QR pass already issued.
      signing: signingKeyReport(),
      // Reports the provider actually selected rather than a hard-coded name,
      // so "payments are on" and "which gateway" cannot disagree in a probe.
      payments: {
        enabled: env.paymentsEnabled,
        provider: env.paymentsEnabled ? env.paymentProvider : 'none',
        configured: Boolean(env.razorpay.keyId && env.razorpay.keySecret),
        // rzp_test_ keys are sandbox; rzp_live_ take real money.
        mode: env.razorpay.keyId.startsWith('rzp_test') ? 'test' : 'live',
      },
      upi: { enabled: env.upi.enabled },
      ...(probe ? { gateway: probe } : {}),
    },
  };

  return NextResponse.json(body, {
    status: db.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
