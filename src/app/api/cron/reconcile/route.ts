import { NextResponse, type NextRequest } from 'next/server';
import { reconcilePending } from '@/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Scheduled recovery of payments that were taken but never confirmed.
 *
 * The browser-side callback is the normal confirmation path and it is not
 * reliable on its own — a closed tab, a dropped connection or a backgrounded
 * mobile browser all leave a customer charged with no ticket. Four of them sat
 * that way for a day because the only recovery was a button somebody had to
 * remember to press.
 *
 * Vercel signs cron invocations with CRON_SECRET when it is set. Without it the
 * route stays reachable, because an unauthenticated sweep can only ever confirm
 * bookings the gateway already reports as paid — it cannot invent a payment,
 * and the worst an attacker achieves is delivering tickets to people who bought
 * them slightly sooner.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  try {
    const results = await reconcilePending();
    const paid = results.filter((r) => r.outcome === 'paid');

    if (paid.length > 0) {
      console.error(
        `[cron] recovered ${paid.length} paid booking(s): ${paid.map((r) => r.reference).join(', ')}`,
      );
    }

    return NextResponse.json({
      ok: true,
      checked: results.length,
      recovered: paid.length,
      references: paid.map((r) => r.reference),
    });
  } catch (error) {
    console.error('[cron] sweep failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
