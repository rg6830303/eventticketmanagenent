import { after } from 'next/server';
import { maybeReconcile } from '@/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * The payment heartbeat, pinged by public pages after they load.
 *
 * It used to run from the site layout with after(), which on Vercel held every
 * page response open until the sweep finished; pages painted, then sat
 * "loading" for minutes. As its own request nobody waits on it: the browser
 * fires it and moves on, and the sweep's lock still limits it to one run every
 * ninety seconds across all visitors.
 */
export async function POST() {
  after(() => maybeReconcile().catch(() => {}));
  return new Response(null, { status: 204 });
}
