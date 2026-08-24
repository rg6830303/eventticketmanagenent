import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson, tooManyRequests } from '@/lib/api';
import { requireSession, verifyOrigin } from '@/lib/auth';
import { checkInTicket, logRejectedScan, resolveScanInput } from '@/lib/bookings';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { parseQrPayload } from '@/lib/tickets';
import { scanSchema } from '@/lib/validation';
import { clientIp } from '@/lib/validation.server';
import type { ScanOutcome } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REJECTION_COPY: Record<'malformed' | 'version' | 'signature', { title: string; message: string }> = {
  malformed: {
    title: 'Not our ticket',
    message: 'That QR is not a Houz of Vybe pass. Ask for the booking email.',
  },
  version: {
    title: 'Outdated pass',
    message: 'This pass was issued by an older system. Ask the guest to resend their ticket.',
  },
  signature: {
    title: 'Invalid pass',
    message: 'This code failed its security check — it is forged or edited. Do not admit.',
  },
};

/**
 * Gate scanner endpoint.
 *
 * A rejected scan returns HTTP 200 carrying a failure ScanOutcome rather than a
 * 4xx. At a door, "this pass is fake" is a normal operational result, not a
 * protocol error, and the client gets exactly one render path for every verdict.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession('gate');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const parsed = scanSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return fail('Nothing usable was scanned', 'validation_error', 422);
    }
    const { payload, eventSlug, gate, mode } = parsed.data;

    const limit = await rateLimit(`scan:${session.sub}`, LIMITS.scan.limit, LIMITS.scan.window);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const ip = clientIp(request.headers);
    const verified = await parseQrPayload(payload);

    // A signed payload is the normal path. When the input is not one, it may
    // still be an operator typing a code off a customer's confirmation email
    // because their phone is dead — resolve that before rejecting them.
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
        session.sub,
        gate ?? null,
        ip,
      );
      const outcome: ScanOutcome = {
        result: 'invalid_signature',
        ok: false,
        title: copy.title,
        message: copy.message,
      };
      return ok(outcome);
    }

    const outcome = await checkInTicket({
      code,
      mode,
      operatorId: session.sub,
      eventSlug: eventSlug ?? null,
      gate: gate ?? null,
      ipAddress: ip,
    });

    // Say plainly that this was typed rather than scanned, and which pass of a
    // multi-pass booking it was — an operator holding a queue needs to know
    // whether the other three people are still to come through.
    if (manual && outcome.ok) {
      const where =
        manual.via === 'booking_reference' && manual.position
          ? ` Pass ${manual.position.index} of ${manual.position.total} on this booking.`
          : '';
      return ok({
        ...outcome,
        message: `${outcome.message}${where} Entered by hand, not scanned.`,
      } satisfies ScanOutcome);
    }

    return ok(outcome);
  } catch (error) {
    return handleError(error, 'admin.scan');
  }
}
