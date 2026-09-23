import 'server-only';
import { query, queryOne } from './db';
import { resolveEvent, type ResolvedEvent } from './event-content';
import type { EventRow } from './types';

/**
 * Which event the site is currently about.
 *
 * The home page, the header CTA, the sticky buy bar and the footer all need to
 * agree on one answer, and for most of this product's life that answer was a
 * string constant — `FEATURED_EVENT_SLUG = 'offcampus'`. That works until the
 * date passes, at which point the site goes on advertising a party that has
 * already happened until somebody ships a release.
 *
 * So it is a query now. The rule is the one an operator would state out loud:
 *
 *   the featured event is the next published date that has not finished
 *
 * with a manual pin available for the case that rule gets wrong — two dates on
 * sale at once and the bigger one should lead. When everything is in the past,
 * the most recent one is returned rather than nothing, so the site still has
 * something to be about while the next date is being put together; callers
 * check `isPast` to decide whether to sell or to commemorate.
 */

/** Statuses a customer is allowed to see. Drafts are invisible until published. */
const PUBLIC_STATUSES = ['published', 'sold_out', 'cancelled', 'archived'] as const;

/**
 * An event is over once it has ended, falling back to its start when no end
 * time was given. `now()` is evaluated by Postgres so the answer does not
 * depend on the clock of whichever lambda happened to serve the request.
 */
const NOT_FINISHED = `COALESCE(ends_at, starts_at) >= now()`;

export async function getFeaturedEvent(): Promise<ResolvedEvent | null> {
  /*
   * The pin and the date rule in one pass: `featured DESC` puts a pinned event
   * first when there is one, and `starts_at ASC` picks the soonest otherwise.
   *
   * Written as an ORDER BY rather than a UNION of three candidate queries
   * because UNION ALL does not promise to emit its branches in the order they
   * were written — it usually does, which is the kind of "usually" that turns
   * into a wrong event on the home page under a plan change nobody asked for.
   */
  const live = await queryOne<EventRow>(
    `SELECT * FROM events
      WHERE status IN ('published', 'sold_out')
        AND (featured = true OR ${NOT_FINISHED})
      ORDER BY featured DESC, starts_at ASC
      LIMIT 1`,
  );
  if (live) return resolveEvent(live);

  // Everything has happened. Fall back to the most recent date so the site is
  // still about something; callers check `isPast` before offering to sell it.
  const latest = await queryOne<EventRow>(
    `SELECT * FROM events
      WHERE status IN ('published', 'sold_out', 'archived')
      ORDER BY starts_at DESC
      LIMIT 1`,
  );
  return latest ? resolveEvent(latest) : null;
}

/** On sale or about to be: published, not yet finished, soonest first. */
export async function listUpcomingEvents(): Promise<ResolvedEvent[]> {
  const rows = await query<EventRow>(
    `SELECT * FROM events
      WHERE status IN ('published', 'sold_out') AND ${NOT_FINISHED}
      ORDER BY starts_at ASC`,
  );
  return rows.map(resolveEvent);
}

/**
 * Done. Most recent first.
 *
 * `archived` is included deliberately: archiving an event is how an operator
 * says "this is history now", and history is exactly what this list is for.
 * Cancelled dates are left out — a party that never happened is not a past
 * event, it is an absence, and listing it invites "was I supposed to be there?"
 */
export async function listPastEvents(): Promise<ResolvedEvent[]> {
  const rows = await query<EventRow>(
    `SELECT * FROM events
      WHERE status IN ('published', 'sold_out', 'archived')
        AND COALESCE(ends_at, starts_at) < now()
      ORDER BY starts_at DESC`,
  );
  return rows.map(resolveEvent);
}

/** One event by slug, for the public route. Drafts return null. */
export async function getPublicEvent(slug: string): Promise<ResolvedEvent | null> {
  const row = await queryOne<EventRow>(
    `SELECT * FROM events WHERE slug = $1 AND status = ANY($2::text[])`,
    [slug, PUBLIC_STATUSES],
  );
  return row ? resolveEvent(row) : null;
}

/** Every event including drafts, for the console. */
export async function listAllEvents(): Promise<ResolvedEvent[]> {
  const rows = await query<EventRow>('SELECT * FROM events ORDER BY starts_at DESC');
  return rows.map(resolveEvent);
}

export async function getEventById(id: string): Promise<ResolvedEvent | null> {
  const row = await queryOne<EventRow>('SELECT * FROM events WHERE id = $1', [id]);
  return row ? resolveEvent(row) : null;
}

/** Slugs for the sitemap. Public events only. */
export async function listPublicSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  return query<{ slug: string; updated_at: string }>(
    `SELECT slug, updated_at FROM events WHERE status = ANY($1::text[]) ORDER BY starts_at DESC`,
    [PUBLIC_STATUSES],
  );
}
