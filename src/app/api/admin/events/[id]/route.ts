import { revalidatePath } from 'next/cache';
import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson } from '@/lib/api';
import { requireSession, verifyOrigin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { queryOne } from '@/lib/db';
import { clientIp } from '@/lib/validation.server';
import type { EventRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = ['draft', 'published', 'sold_out', 'cancelled', 'archived'] as const;

/**
 * Edit an event.
 *
 * Name, date, venue and poster are what customers see and what the ticket
 * email prints, so they belong in the console rather than in a deploy. Tickets
 * already issued read these at send and scan time — correcting a venue here
 * corrects it everywhere from then on.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);
    const { id } = await params;

    const existing = await queryOne<EventRow>('SELECT * FROM events WHERE id = $1', [id]);
    if (!existing) return fail('That event does not exist', 'not_found', 404);

    const body = (await readJson(request)) as Partial<{
      name: string;
      tagline: string | null;
      description: string | null;
      venueName: string;
      venueAddress: string | null;
      city: string;
      startsAt: string;
      doorsAt: string | null;
      endsAt: string | null;
      heroImage: string | null;
      status: string;
    }>;

    const toIso = (value: string | null | undefined, field: string): string | null | undefined => {
      if (value === undefined) return undefined;
      if (value === null || value === '') return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) throw new Error(`${field} is not a valid date`);
      return d.toISOString();
    };

    let startsAt: string | null | undefined;
    let doorsAt: string | null | undefined;
    let endsAt: string | null | undefined;
    try {
      startsAt = toIso(body.startsAt, 'Start');
      doorsAt = toIso(body.doorsAt, 'Doors');
      endsAt = toIso(body.endsAt, 'End');
    } catch (error) {
      return fail((error as Error).message, 'invalid_date', 422);
    }
    if (startsAt === null) return fail('An event needs a start time', 'invalid_date', 422);

    const finalStart = new Date(startsAt ?? existing.starts_at).getTime();
    const finalEnd = endsAt === undefined ? existing.ends_at : endsAt;
    if (finalEnd && new Date(finalEnd).getTime() <= finalStart) {
      return fail('The end time must be after the start', 'invalid_date', 422);
    }
    if (body.name !== undefined && !body.name.trim()) return fail('The event needs a name', 'invalid_name', 422);
    if (body.venueName !== undefined && !body.venueName.trim()) {
      return fail('The event needs a venue name', 'invalid_venue', 422);
    }
    if (body.status !== undefined && !STATUSES.includes(body.status as (typeof STATUSES)[number])) {
      return fail('Unknown status', 'invalid_status', 422);
    }
    if (body.heroImage && !/^(\/|https:\/\/)/.test(body.heroImage)) {
      return fail('The poster must be a site path like /events/poster.jpg or an https URL', 'invalid_image', 422);
    }

    const updated = await queryOne<EventRow>(
      `UPDATE events SET
         name          = COALESCE($2, name),
         tagline       = CASE WHEN $3::boolean THEN $4 ELSE tagline END,
         description   = CASE WHEN $5::boolean THEN $6 ELSE description END,
         venue_name    = COALESCE($7, venue_name),
         venue_address = CASE WHEN $8::boolean THEN $9 ELSE venue_address END,
         city          = COALESCE($10, city),
         starts_at     = COALESCE($11::timestamptz, starts_at),
         doors_at      = CASE WHEN $12::boolean THEN $13::timestamptz ELSE doors_at END,
         ends_at       = CASE WHEN $14::boolean THEN $15::timestamptz ELSE ends_at END,
         hero_image    = CASE WHEN $16::boolean THEN $17 ELSE hero_image END,
         status        = COALESCE($18, status),
         updated_at    = now()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        body.name?.trim() ?? null,
        body.tagline !== undefined, body.tagline?.trim() || null,
        body.description !== undefined, body.description?.trim() || null,
        body.venueName?.trim() ?? null,
        body.venueAddress !== undefined, body.venueAddress?.trim() || null,
        body.city?.trim() || null,
        startsAt ?? null,
        doorsAt !== undefined, doorsAt ?? null,
        endsAt !== undefined, endsAt ?? null,
        body.heroImage !== undefined, body.heroImage?.trim() || null,
        body.status ?? null,
      ],
    );

    await recordAudit({
      actor: session,
      action: 'event.update',
      entity: 'event',
      entityId: existing.slug,
      metadata: { changed: Object.keys(body) },
      ipAddress: clientIp(request.headers),
    });

    for (const path of ['/', '/events', `/events/${existing.slug}`, '/cart']) revalidatePath(path);

    return ok({ event: updated });
  } catch (error) {
    return handleError(error, 'admin.events.update');
  }
}
