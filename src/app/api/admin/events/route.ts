import { revalidatePath } from 'next/cache';
import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson, created } from '@/lib/api';
import { requireSession, verifyOrigin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { query, queryOne } from '@/lib/db';
import { clientIp } from '@/lib/validation.server';
import type { EventRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Events.
 *
 * Creating a date used to mean editing `src/content/site.ts`, running the seed
 * and shipping a release. This is the endpoint that makes a launch an
 * afternoon's work in the console instead.
 *
 * Manager and above: announcing an event is a commercial act, not a door one.
 */
export async function GET() {
  try {
    await requireSession('manager');

    const events = await query<EventRow & { tier_count: number; sold: number }>(
      `SELECT e.*,
              (SELECT count(*)::int FROM ticket_tiers t
                WHERE t.event_id = e.id AND t.active) AS tier_count,
              (SELECT COALESCE(sum(t.sold), 0)::int FROM ticket_tiers t
                WHERE t.event_id = e.id) AS sold
         FROM events e
        ORDER BY e.starts_at DESC`,
    );

    return ok({ events });
  } catch (error) {
    return handleError(error, 'admin.events.list');
  }
}

/** Lower-case, hyphenated, no leading or trailing separators. */
function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const body = (await readJson(request)) as {
      name?: string;
      slug?: string;
      venueName?: string;
      city?: string;
      startsAt?: string;
      endsAt?: string | null;
    };

    const name = body.name?.trim();
    if (!name) return fail('The event needs a name', 'invalid_name', 422);

    const slug = slugify(body.slug?.trim() || name);
    if (!slug) return fail('That name does not make a usable web address', 'invalid_slug', 422);

    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return fail('When does it start?', 'invalid_start', 422);
    }

    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      return fail('That end time is not a date', 'invalid_end', 422);
    }
    if (endsAt && endsAt <= startsAt) {
      return fail('The event has to end after it starts', 'end_before_start', 422);
    }

    const clash = await queryOne<{ id: string }>('SELECT id FROM events WHERE slug = $1', [slug]);
    if (clash) {
      return fail(
        `There is already an event at /events/${slug}. Give this one a different name or web address.`,
        'slug_taken',
        409,
      );
    }

    /*
     * Always a draft.
     *
     * Creating and publishing are separate acts on purpose: an event created
     * live is an event whose half-written copy and placeholder prices were on
     * the internet for as long as it took to fill the rest of the form in.
     */
    const event = await queryOne<EventRow>(
      `INSERT INTO events (slug, name, venue_name, city, starts_at, ends_at, doors_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $5, 'draft')
       RETURNING *`,
      [
        slug,
        name,
        body.venueName?.trim() || 'To be confirmed',
        body.city?.trim() || 'Hyderabad',
        startsAt.toISOString(),
        endsAt?.toISOString() ?? null,
      ],
    );

    await recordAudit({
      actor: session,
      action: 'event.create',
      entity: 'event',
      entityId: event!.id,
      metadata: { slug, name },
      ipAddress: clientIp(request.headers),
    });

    revalidatePath('/events');

    return created({ event });
  } catch (error) {
    return handleError(error, 'admin.events.create');
  }
}
