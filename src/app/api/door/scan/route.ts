import type { NextRequest } from 'next/server';
import { corsPreflight, withCors } from '@/lib/cors';
import { fail, handleError, ok, readJson, tooManyRequests } from '@/lib/api';
import { checkInTicket, logRejectedScan, resolveScanInput } from '@/lib/bookings';
import { bearerFrom, verifyDoorToken } from '@/lib/door-auth';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { parseQrPayload } from '@/lib/tickets';
import { scanSchema } from '@/lib/validation';
import { clientIp } from '@/lib/validation.server';
import type { ScanOutcome } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

/**
 * Preflight. The scanner sends an Authorization header, which is a non-simple
 * header, so the WebView asks permission before every scan call.
 */
export async function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}

const REJECTION_COPY: Record<'malformed' | 'version' | 'signature', { title: string; message: string }> = {
  malformed: {
    title: 'Not our ticket',
    message: 'That QR is not a Houz of Vybe pass. Ask for the booking email.',
  },
  version: {
    title: 'Outdated pass',
    message: 'This pass was issued by an older system. Check the booking in the console.',
  },
  signature: {
    title: 'Not genuine',
    message: 'This QR did not verify. Do not admit — check the booking reference.',
  },
};

/**
 * Scanning, for the door app.
 *
 * Deliberately the same two modes, the same resolver and the same
 * checkInTicket as the console, because the two have to agree: a pass admitted
 * on a phone at the door must read as used in the console a second later, and
 * one admitted in the console must be refused at the door. Sharing the
 * implementation is what makes that true rather than hoped for.
 *
 * Authorised by the door token, not an admin session. Whoever holds this can
 * mark a pass used and nothing else — no customer list, no exports, no prices.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyDoorToken(bearerFrom(request.headers));
    if (!auth.valid) {
      return withCors(fail(
        auth.reason === 'expired' ? 'Session expired — sign in again' : 'Not signed in',
        auth.reason === 'expired' ? 'token_expired' : 'unauthorised',
        401,
      ), request);
    }

    const parsed = scanSchema.safeParse(await readJson(request));
    if (!parsed.success) return withCors(fail('Nothing usable was scanned', 'validation_error', 422), request);
    const { payload, eventSlug, gate, mode } = parsed.data;

    const ip = clientIp(request.headers);
    const limit = await rateLimit(`door-scan:${ip ?? 'unknown'}`, LIMITS.scan.limit, LIMITS.scan.window);
    if (!limit.allowed) return withCors(tooManyRequests(limit.retryAfterSeconds), request);

    const verified = await parseQrPayload(payload);

    // A signed payload is the normal path. Falling back to the manual resolver
    // matters more here than in the console: a phone with a dead battery at the
    // door is common, and the code read off a confirmation email should still
    // get that person in.
    let code: string | null = verified.valid ? verified.code : null;
    let manual: Awaited<ReturnType<typeof resolveScanInput>> = null;
    if (!code) {
      manual = await resolveScanInput(payload);
      code = manual?.code ?? null;
    }

    if (!code) {
      const copy = REJECTION_COPY[verified.valid ? 'malformed' : verified.reason];
      await logRejectedScan(
        verified.code ?? payload.slice(0, 64),
        'invalid_signature',
        copy.message,
        null,
        gate ?? 'Door app',
        ip,
      );
      const outcome: ScanOutcome = {
        result: 'invalid_signature',
        ok: false,
        title: copy.title,
        message: copy.message,
      };
      return withCors(ok(outcome), request);
    }

    const outcome = await checkInTicket({
      code,
      mode,
      eventSlug: eventSlug ?? null,
      gate: gate ?? 'Door app',
      ipAddress: ip,
    });

    if (manual && outcome.ok) {
      const where =
        manual.via === 'booking_reference' && manual.position
          ? ` Pass ${manual.position.index} of ${manual.position.total} on this booking.`
          : '';
      return withCors(ok({
        ...outcome,
        message: `${outcome.message}${where} Entered by hand, not scanned.`,
      } satisfies ScanOutcome), request);
    }

    return withCors(ok(outcome), request);
  } catch (error) {
    return withCors(handleError(error, 'door.scan'), request);
  }
}
