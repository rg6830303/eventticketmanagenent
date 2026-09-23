'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn, formatInr } from '@/lib/utils';
import type { EventRow, EventStatus, TicketTierRow } from '@/lib/types';
import type { EventContent } from '@/lib/event-content';
import { NewTierForm } from './NewTierForm';

/**
 * Edit one event.
 *
 * Three groups, in the order a launch actually happens: the facts (what, where,
 * when), the passes, and then the words. Publishing sits at the top because it
 * is the thing you come back to this screen to do.
 *
 * Every field writes to the same PATCH endpoint, which is why Save is one
 * button rather than one per section — a half-saved event whose date moved but
 * whose copy did not is a worse state than either.
 */

const STATUSES: { value: EventStatus; label: string; hint: string }[] = [
  { value: 'draft', label: 'Draft', hint: 'Invisible to customers. Safe to leave half-written.' },
  { value: 'published', label: 'Published', hint: 'Live on the site and on sale.' },
  { value: 'sold_out', label: 'Sold out', hint: 'Visible, but nothing can be bought.' },
  { value: 'cancelled', label: 'Cancelled', hint: 'Visible and clearly cancelled. Refunds are yours to issue.' },
  { value: 'archived', label: 'Archived', hint: 'Moved to past dates. Bookings and scans are kept.' },
];

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" in the browser's own timezone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** One item per line, in and out. The least surprising editor for a short list. */
function linesToArray(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function EventEditor({
  event,
  tiers,
}: {
  event: EventRow;
  tiers: (TicketTierRow & { price_unit: string })[];
}) {
  const router = useRouter();
  const content = (event.content ?? {}) as EventContent;

  const [form, setForm] = useState({
    name: event.name,
    edition: event.edition ?? '',
    tagline: event.tagline ?? '',
    description: event.description ?? '',
    venueName: event.venue_name,
    venueAddress: event.venue_address ?? '',
    city: event.city,
    startsAt: toLocalInput(event.starts_at),
    endsAt: toLocalInput(event.ends_at),
    doorsAt: toLocalInput(event.doors_at),
    capacity: String(event.capacity),
    ageLimit: String(event.age_limit),
    status: event.status,
    featured: event.featured,
    // --- editorial ---
    presentedBy: content.presentedBy ?? '',
    headline: content.headline ?? '',
    subhead: content.subhead ?? '',
    standfirst: content.standfirst ?? '',
    body: (content.body ?? []).join('\n\n'),
    venueArea: content.venue?.area ?? '',
    addressLines: (content.venue?.addressLines ?? []).join('\n'),
    mapsUrl: content.venue?.mapsUrl ?? '',
    landmark: content.venue?.landmark ?? '',
    activities: (content.activities ?? []).map((a) => `${a.title} | ${a.note}`).join('\n'),
    runsheet: (content.runsheet ?? []).map((r) => `${r.time} | ${r.title} | ${r.copy}`).join('\n'),
    entryRules: (content.entryRules ?? []).join('\n'),
    faqs: (content.faqs ?? []).map((f) => `${f.q} | ${f.a}`).join('\n'),
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);

    const nextContent: EventContent = {
      presentedBy: form.presentedBy || undefined,
      headline: form.headline || undefined,
      subhead: form.subhead || undefined,
      standfirst: form.standfirst || undefined,
      body: form.body ? form.body.split('\n\n').map((p) => p.trim()).filter(Boolean) : [],
      venue: {
        area: form.venueArea || undefined,
        addressLines: linesToArray(form.addressLines),
        mapsUrl: form.mapsUrl || undefined,
        landmark: form.landmark || undefined,
      },
      // "Title | note" per line. Anything without a separator is kept as a
      // title with no note rather than dropped — losing an operator's typing
      // because they forgot a pipe is not an acceptable way to validate.
      activities: linesToArray(form.activities).map((line) => {
        const [title, note] = line.split('|').map((part) => part.trim());
        return { title, note: note ?? '' };
      }),
      runsheet: linesToArray(form.runsheet).map((line) => {
        const [time, title, copy] = line.split('|').map((part) => part.trim());
        return { time: time ?? '', title: title ?? '', copy: copy ?? '' };
      }),
      entryRules: linesToArray(form.entryRules),
      faqs: linesToArray(form.faqs).map((line) => {
        const [q, a] = line.split('|').map((part) => part.trim());
        return { q: q ?? '', a: a ?? '' };
      }),
    };

    try {
      const response = await fetch(`/api/admin/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          edition: form.edition,
          tagline: form.tagline,
          description: form.description,
          venueName: form.venueName,
          venueAddress: form.venueAddress,
          city: form.city,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          doorsAt: form.doorsAt ? new Date(form.doorsAt).toISOString() : null,
          capacity: Number(form.capacity),
          ageLimit: Number(form.ageLimit),
          status: form.status,
          featured: form.featured,
          content: nextContent,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? 'Could not save.');
        setBusy(false);
        return;
      }

      setNotice(
        form.status === 'published'
          ? 'Saved and live. The site is selling this event now.'
          : 'Saved.',
      );
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
    }
    setBusy(false);
  }

  const liveTiers = tiers.filter((tier) => tier.active);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{event.name}</h1>
          <p className="mt-1 font-mono text-[11px] text-muted">/events/{event.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          {event.status === 'published' && (
            <Link
              href={`/events/${event.slug}`}
              target="_blank"
              className="btn-outline btn-sm"
            >
              View live ↗
            </Link>
          )}
          <button type="button" onClick={save} disabled={busy} className="btn-primary btn-sm">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-flare-100 px-4 py-3 text-[13px] text-flare-600">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-md bg-leaf-100 px-4 py-3 text-[13px] text-leaf-600">
          {notice}
        </p>
      )}

      {/* ---- Status ------------------------------------------------------ */}
      <Panel title="Status" hint="What customers can see and do.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STATUSES.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer gap-3 rounded-lg p-3 transition-colors',
                form.status === option.value
                  ? 'bg-vybe-50 ring-1 ring-inset ring-vybe-300'
                  : 'bg-frost ring-hair',
              )}
            >
              <input
                type="radio"
                name="status"
                className="mt-0.5 h-4 w-4 shrink-0 accent-vybe-500"
                checked={form.status === option.value}
                onChange={() => set('status', option.value)}
              />
              <span>
                <span className="block text-[13px] font-semibold text-ink">{option.label}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate">
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </div>

        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg bg-frost p-3 ring-hair">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-vybe-500"
            checked={form.featured}
            onChange={(e) => set('featured', e.target.checked)}
          />
          <span className="text-[12px] leading-relaxed text-slate">
            <strong className="text-ink">Pin to the home page.</strong> Usually unnecessary — the
            home page already sells the next published date. Use this only when two are on sale and
            the other one should lead.
          </span>
        </label>
      </Panel>

      {/* ---- Facts ------------------------------------------------------- */}
      <Panel title="The facts" hint="Name, place and time. These drive the date shown everywhere.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" value={form.name} onChange={(v) => set('name', v)} />
          <Field
            label="Edition"
            hint="The line beside the name, e.g. Freshers '26"
            value={form.edition}
            onChange={(v) => set('edition', v)}
          />
          <Field label="Venue" value={form.venueName} onChange={(v) => set('venueName', v)} />
          <Field label="City" value={form.city} onChange={(v) => set('city', v)} />
          <Field
            label="Starts"
            type="datetime-local"
            value={form.startsAt}
            onChange={(v) => set('startsAt', v)}
          />
          <Field
            label="Ends"
            type="datetime-local"
            value={form.endsAt}
            onChange={(v) => set('endsAt', v)}
          />
          <Field
            label="Doors"
            type="datetime-local"
            hint="When the countdown on the site runs out."
            value={form.doorsAt}
            onChange={(v) => set('doorsAt', v)}
          />
          <Field
            label="Capacity"
            type="number"
            hint="Shown in the closing line on the home page."
            value={form.capacity}
            onChange={(v) => set('capacity', v)}
          />
          <Field
            label="Minimum age"
            type="number"
            value={form.ageLimit}
            onChange={(v) => set('ageLimit', v)}
          />
          <Field
            label="Venue address"
            hint="One line. The long version goes under Words."
            value={form.venueAddress}
            onChange={(v) => set('venueAddress', v)}
          />
        </div>
        <Textarea
          label="Search description"
          hint="Shown in Google results and when the link is shared."
          rows={2}
          value={form.description}
          onChange={(v) => set('description', v)}
        />
      </Panel>

      {/* ---- Passes ------------------------------------------------------ */}
      <Panel
        title="Passes"
        hint="An event cannot be published without at least one. Prices are edited on the Prices screen."
      >
        {liveTiers.length === 0 ? (
          <p className="rounded-lg bg-flare-100 px-4 py-3 text-[13px] text-flare-600">
            No passes on sale yet. Add one before publishing.
          </p>
        ) : (
          <ul className="space-y-2">
            {liveTiers.map((tier) => (
              <li
                key={tier.id}
                className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg bg-frost px-4 py-3 ring-hair"
              >
                <span className="text-[13px] font-semibold text-ink">
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                    {tier.code}
                  </span>{' '}
                  {tier.name}
                </span>
                <span className="tnum text-[13px] text-slate">
                  {formatInr(tier.price_paise)} · admits {tier.admits} · {tier.sold}/{tier.quantity}{' '}
                  sold
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <NewTierForm eventId={event.id} />
          <Link href="/admin/prices" className="text-[12px] font-medium text-vybe-700 hover:underline">
            Edit prices →
          </Link>
        </div>
      </Panel>

      {/* ---- Words ------------------------------------------------------- */}
      <Panel
        title="Words"
        hint="What the event page says. Anything left blank falls back to a generic line rather than rendering empty."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Presented by"
            value={form.presentedBy}
            onChange={(v) => set('presentedBy', v)}
          />
          <Field label="Headline" value={form.headline} onChange={(v) => set('headline', v)} />
        </div>
        <Textarea label="Subhead" rows={2} value={form.subhead} onChange={(v) => set('subhead', v)} />
        <Textarea
          label="Standfirst"
          hint="The opening paragraph."
          rows={3}
          value={form.standfirst}
          onChange={(v) => set('standfirst', v)}
        />
        <Textarea
          label="Body"
          hint="One paragraph per blank line."
          rows={6}
          value={form.body}
          onChange={(v) => set('body', v)}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Venue area" value={form.venueArea} onChange={(v) => set('venueArea', v)} />
          <Field label="Maps link" value={form.mapsUrl} onChange={(v) => set('mapsUrl', v)} />
          <Field label="Landmark" value={form.landmark} onChange={(v) => set('landmark', v)} />
        </div>
        <Textarea
          label="Address"
          hint="One line per line."
          rows={2}
          value={form.addressLines}
          onChange={(v) => set('addressLines', v)}
        />

        <Textarea
          label="What's on"
          hint="One per line: Title | short note"
          rows={6}
          value={form.activities}
          onChange={(v) => set('activities', v)}
        />
        <Textarea
          label="Runsheet"
          hint="One per line: Time | Title | what happens"
          rows={5}
          value={form.runsheet}
          onChange={(v) => set('runsheet', v)}
        />
        <Textarea
          label="Door policy"
          hint="One rule per line."
          rows={4}
          value={form.entryRules}
          onChange={(v) => set('entryRules', v)}
        />
        <Textarea
          label="FAQs"
          hint="One per line: Question | Answer"
          rows={6}
          value={form.faqs}
          onChange={(v) => set('faqs', v)}
        />
      </Panel>

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={busy} className="btn-primary">
          {busy ? 'Saving…' : 'Save event'}
        </button>
      </div>
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-paper p-4 shadow-soft ring-hair sm:p-5">
      <h2 className="font-display text-[1.05rem] font-semibold text-ink">{title}</h2>
      {hint && <p className="mt-1 text-[12px] leading-relaxed text-slate">{hint}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        type={type}
        className="field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <span className="help">{hint}</span>}
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea
        rows={rows}
        className="field resize-y"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <span className="help">{hint}</span>}
    </label>
  );
}
