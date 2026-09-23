import { revalidatePath } from 'next/cache';
import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson } from '@/lib/api';
import { requireSession, verifyOrigin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { query, queryOne, transaction } from '@/lib/db';
import { clientIp } from '@/lib/validation.server';
import type { EventRow, EventStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES: EventStatus[] = ['draft', 'published', 'sold_out', 'cancelled', 'archived'];

/** Text fields that are stored as `null` when cleared, not as an empty string. */
function nullable(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const { id } = await params;
    const existing = await queryOne<EventRow>('SELECT * FROM events WHERE id = $1', [id]);
    if (!existing) return fail('That event no longer exists', 'not_found', 404);

    const body = (await readJson(request)) as {
      name?: string;
      edition?: string | null;
      tagline?: string | null;
      description?: string | null;
      venueName?: string;
      venueAddress?: string | null;
      city?: string;
      startsAt?: string;
      endsAt?: string | null;
      doorsAt?: string | null;
      capacity?: number;
      ageLimit?: number;
      status?: EventStatus;
      featured?: boolean;
      content?: Record<string, unknown>;
    };

    if (body.status && !STATUSES.includes(body.status)) {
      return fail('That is not a status an event can have', 'invalid_status', 422);
    }
    if (body.name !== undefined && !body.name.trim()) {
      return fail('The event needs a name', 'invalid_name', 422);
    }

    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    if (body.startsAt && (!startsAt || Number.isNaN(startsAt.getTime()))) {
      return fail('That start time is not a date', 'invalid_start', 422);
    }
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (body.endsAt && endsAt && Number.isNaN(endsAt.getTime())) {
      return fail('That end time is not a date', 'invalid_end', 422);
    }

    const finalStart = startsAt ?? new Date(existing.starts_at);
    const finalEnd = body.endsAt === undefined ? existing.ends_at && new Date(existing.ends_at) : endsAt;
    if (finalEnd && finalEnd <= finalStart) {
      return fail('The event has to end after it starts', 'end_before_start', 422);
    }

    /*
     * Publishing is the one transition worth refusing.
     *
     * An event with no tier on sale renders a pricing section with nothing in
     * it and a Buy button that leads to an empty cart, which looks exactly
     * like a broken site to the customer who followed the announcement link.
     * Saying so here costs one sentence; finding out from a customer costs the
     * launch.
     */
    if (body.status === 'published' && existing.status !== 'published') {
      const tiers = await query<{ id: string }>(
        'SELECT id FROM ticket_tiers WHERE event_id = $1 AND active = true LIMIT 1',
        [id],
      );
      if (tiers.length === 0) {
        return fail(
          'Add at least one pass before publishing — without one the page shows a Buy button that leads to an empty cart.',
          'no_tiers',
          422,
        );
      }
    }

    const event = await transaction(async (client) => {
      // `featured` is enforced singular by a partial unique index, so the old
      // holder has to be cleared in the same transaction or the update trips
      // over the constraint.
      if (body.featured === true) {
        await client.query('UPDATE events SET featured = false WHERE featured = true AND id <> $1', [
          id,
        ]);
      }

      const { rows } = await client.query<EventRow>(
        `UPDATE events SET
           name          = COALESCE($2, name),
           edition       = CASE WHEN $3::boolean THEN $4 ELSE edition END,
           tagline       = CASE WHEN $5::boolean THEN $6 ELSE tagline END,
           description   = CASE WHEN $7::boolean THEN $8 ELSE description END,
           venue_name    = COALESCE($9, venue_name),
           venue_address = CASE WHEN $10::boolean THEN $11 ELSE venue_address END,
           city          = COALESCE($12, city),
           starts_at     = COALESCE($13, starts_at),
           ends_at       = CASE WHEN $14::boolean THEN $15 ELSE ends_at END,
           doors_at      = CASE WHEN $16::boolean THEN $17 ELSE doors_at END,
           capacity      = COALESCE($18, capacity),
           age_limit     = COALESCE($19, age_limit),
           status        = COALESCE($20, status),
           featured      = COALESCE($21, featured),
           content       = COALESCE($22::jsonb, content)
         WHERE id = $1
         RETURNING *`,
        [
          id,
          body.name?.trim() ?? null,
          body.edition !== undefined,
          nullable(body.edition) ?? null,
          body.tagline !== undefined,
          nullable(body.tagline) ?? null,
          body.description !== undefined,
          nullable(body.description) ?? null,
          body.venueName?.trim() || null,
          body.venueAddress !== undefined,
          nullable(body.venueAddress) ?? null,
          body.city?.trim() || null,
          startsAt?.toISOString() ?? null,
          body.endsAt !== undefined,
          endsAt?.toISOString() ?? null,
          body.doorsAt !== undefined,
          body.doorsAt ? new Date(body.doorsAt).toISOString() : null,
          Number.isFinite(body.capacity) ? Math.max(0, Math.round(body.capacity!)) : null,
          Number.isFinite(body.ageLimit) ? Math.max(0, Math.round(body.ageLimit!)) : null,
          body.status ?? null,
          body.featured ?? null,
          body.content ? JSON.stringify(body.content) : null,
        ],
      );
      return rows[0];
    });

    await recordAudit({
      actor: session,
      action: 'event.update',
      entity: 'event',
      entityId: id,
      metadata: {
        from: { status: existing.status, starts_at: existing.starts_at, featured: existing.featured },
        to: { status: event.status, starts_at: event.starts_at, featured: event.featured },
      },
      ipAddress: clientIp(request.headers),
    });

    for (const path of ['/', '/events', '/cart', '/book']) revalidatePath(path);
    revalidatePath('/events/[slug]', 'page');

    return ok({ event });
  } catch (error) {
    return handleError(error, 'admin.events.update');
  }
}

/**
 * Deleting an event is deliberately not possible.
 *
 * `bookings.event_id` is ON DELETE RESTRICT, so Postgres would refuse anyway
 * the moment a single ticket had been sold — and it is right to. An event is
 * the thing a QR code is checked against; removing it would orphan every pass
 * issued for it and erase the scan log that settles door disputes.
 *
 * `archived` is the operation people actually want: off the front of the shop,
 * still in the books.
 */
export async function DELETE() {
  return fail(
    'Events are archived, not deleted — their bookings, tickets and scan history have to stay. Set the status to Archived instead.',
    'not_deletable',
    405,
  );
}
