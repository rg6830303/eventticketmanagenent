import type { EventRow } from './types';

/**
 * The editorial layer of an event.
 *
 * Prices, stock and the on-sale state are columns. This is the *words* — the
 * headline, what is running, how the day goes, what the door will refuse you
 * for — and it lives in `events.content` as JSONB so launching a date is a
 * form submission rather than a deploy.
 *
 * It used to be a hard-coded constant in src/content/site.ts. That was fine
 * while there was one event forever, and became a wall the moment there were
 * two: the home page described OFF Campus in the present tense with no way to
 * say anything else, and a new date could not be announced without a release.
 *
 * Every field is optional. A draft an operator has half-filled must still
 * render a coherent page, so anything absent falls through to the defaults
 * below rather than printing `undefined` at a customer.
 */
export interface EventContent {
  /** "Houz of Vybe × Kingdome Klub & Kitchen" — the line above the title. */
  presentedBy?: string;
  /** The hero headline. Distinct from the event's name. */
  headline?: string;
  /**
   * The part of the headline set in the script face.
   *
   * An explicit substring rather than "the last two words", because guessing
   * lands the flourish on "the door" as readily as on "first year". Must
   * appear in `headline` verbatim; when it does not, the headline simply
   * renders unaccented, which is a plain heading rather than a broken one.
   */
  headlineAccent?: string;
  /** One or two sentences under the headline. */
  subhead?: string;
  /** The opening paragraph on the event page. */
  standfirst?: string;
  /** Body paragraphs, in order. */
  body?: string[];
  venue?: {
    area?: string;
    addressLines?: string[];
    mapsUrl?: string;
    landmark?: string;
  };
  activities?: { title: string; note: string; icon?: string }[];
  runsheet?: { time: string; title: string; copy: string }[];
  entryRules?: string[];
  faqs?: { q: string; a: string }[];
  /** Shown on the ticker across the home page. */
  ticker?: string[];
}

/**
 * What an event says when its own content does not say it.
 *
 * Deliberately generic. These are the lines that are true of any Houz of Vybe
 * date — the QR mechanics, the door policy, how refunds work — and not one
 * word of them describes a specific party. A draft with an empty content blob
 * reads as a thin but honest page, never as the previous event wearing a new
 * name.
 */
export const DEFAULT_CONTENT: Required<Omit<EventContent, 'venue'>> & {
  venue: Required<NonNullable<EventContent['venue']>>;
} = {
  presentedBy: 'Houz of Vybe',
  headline: 'The next one.',
  headlineAccent: '',
  subhead: 'Book online, get a QR pass by email, walk straight in.',
  standfirst: 'Tickets are on sale here. Every pass is a QR scanned once at the door.',
  body: [
    'You book on this site and the pass lands in your inbox. The door team scans it once. No printed list, no calling someone at the gate to get your name on it.',
  ],
  venue: {
    area: '',
    addressLines: [],
    mapsUrl: '',
    landmark: '',
  },
  activities: [],
  runsheet: [],
  entryRules: [
    'One QR admits one person. Each ticket in your order gets its own code.',
    'Right of admission reserved. The door team can refuse entry.',
    'No re-entry once you leave the venue.',
  ],
  faqs: [
    {
      q: 'How do I get my ticket?',
      a: 'You book on this site and the QR pass is emailed to you within a minute. It also appears on your booking page straight away, so you have it even before the email lands.',
    },
    {
      q: 'Do I have to print it?',
      a: 'No. Show the QR on your phone. Screenshot it before you leave home, because it scans fine offline and venue signal is never reliable.',
    },
    {
      q: 'Can two of us use one QR?',
      a: 'No. Every QR admits one person and is dead the moment it is scanned. Book two tickets and you get two codes in the same email.',
    },
    {
      q: 'Can I get a refund?',
      a: 'Tickets are non-refundable once issued. If we cancel or move the date, you get the full amount back automatically, to the same method you paid with, within 7 working days.',
    },
  ],
  ticker: [],
};

const IST = 'Asia/Kolkata';

function label(value: string | null, options: Intl.DateTimeFormatOptions): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { ...options, timeZone: IST }).format(date);
}

/**
 * An event row plus everything a page needs to render it.
 *
 * The date strings are derived from the timestamps rather than stored as copy.
 * The old constant carried `dateLabel: 'Saturday 12 September 2026'` beside a
 * `starts_at` in Postgres, which is two sources of truth for one fact and
 * exactly the pair that drifts when a date moves.
 */
export interface ResolvedEvent {
  row: EventRow;
  content: typeof DEFAULT_CONTENT;
  /** "Saturday, 12 September 2026" */
  dateLabel: string;
  /** "12.09.2026" */
  dateShort: string;
  /** "12 PM — 4 PM", or just the start when there is no end. */
  timeLabel: string;
  /** The sub-title beside the name: "Freshers '26". */
  edition: string;
  /** True once the event has finished. */
  isPast: boolean;
  /** True when nothing can be sold: sold out, cancelled, or over. */
  isClosed: boolean;
}

/** Merge a row's stored content over the defaults, one level deep. */
export function eventContent(row: Pick<EventRow, 'content'>): typeof DEFAULT_CONTENT {
  const stored = (row.content ?? {}) as EventContent;
  return {
    ...DEFAULT_CONTENT,
    ...stripEmpty(stored),
    venue: { ...DEFAULT_CONTENT.venue, ...stripEmpty(stored.venue ?? {}) },
  };
}

/**
 * Drop keys that are present but empty.
 *
 * A form posts `""` for a field the operator cleared, and an empty string that
 * overrides a sensible default is worse than no value at all — it renders a
 * blank where the page expected a sentence. Empty arrays are kept: "this event
 * has no activities" is a real answer that must be able to override a default.
 */
function stripEmpty<T extends object>(input: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

export function resolveEvent(row: EventRow): ResolvedEvent {
  const content = eventContent(row);
  const ends = row.ends_at ?? null;

  const startTime = label(row.starts_at, { hour: 'numeric', hour12: true });
  const endTime = label(ends, { hour: 'numeric', hour12: true });

  // Finished, not started: a party is still on at half past its start time.
  const finishedAt = new Date(ends ?? row.starts_at).getTime();
  const isPast = Number.isFinite(finishedAt) && finishedAt < Date.now();

  return {
    row,
    content,
    dateLabel: label(row.starts_at, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    dateShort: label(row.starts_at, { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(
      /\//g,
      '.',
    ),
    timeLabel: endTime ? `${startTime} — ${endTime}` : startTime,
    edition: row.edition?.trim() || '',
    isPast,
    isClosed: isPast || row.status === 'sold_out' || row.status === 'cancelled',
  };
}
