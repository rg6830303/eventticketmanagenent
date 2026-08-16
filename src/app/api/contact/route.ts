import type { NextRequest } from 'next/server';
import { created, fail, handleError, readJson, tooManyRequests } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { query } from '@/lib/db';
import { sendContactAck } from '@/lib/mailer';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { contactSchema, fieldErrors } from '@/lib/validation';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) {
      return fail('Request blocked', 'bad_origin', 403);
    }

    const parsed = contactSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return fail('Please check the highlighted fields', 'validation_error', 422, fieldErrors(parsed.error));
    }
    const input = parsed.data;

    if (input.company) {
      return created({ received: true });
    }

    const ip = clientIp(request.headers);
    const limit = await rateLimit(
      `contact:${ip ?? 'unknown'}`,
      LIMITS.contact.limit,
      LIMITS.contact.window,
    );
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    await query(
      `INSERT INTO contact_messages (name, email, phone, subject, message, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [input.name, input.email, input.phone || null, input.subject || null, input.message, ip],
    );

    // The message is already stored; a failed acknowledgement is cosmetic.
    await sendContactAck(input.name, input.email).catch((error) => {
      console.error('[contact] ack failed', error);
    });

    return created({ received: true });
  } catch (error) {
    return handleError(error, 'contact.create');
  }
}
