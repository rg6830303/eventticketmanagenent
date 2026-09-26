'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface EditableEvent {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  venue_name: string;
  venue_address: string | null;
  city: string;
  starts_at: string;
  doors_at: string | null;
  ends_at: string | null;
  hero_image: string | null;
  status: string;
}

/** ISO → the value a datetime-local input wants, in IST. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 330 * 60_000);
  return d.toISOString().slice(0, 16);
}

/** datetime-local (entered in IST) → ISO. */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}:00+05:30`).toISOString();
}

/**
 * Edit an event in place.
 *
 * Times are entered and shown in IST whatever the operator's own browser is set
 * to — a laptop on UTC must not quietly move doors by five and a half hours.
 */
export function EventEditor({ event }: { event: EditableEvent }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [draft, setDraft] = useState({
    name: event.name,
    tagline: event.tagline ?? '',
    description: event.description ?? '',
    venueName: event.venue_name,
    venueAddress: event.venue_address ?? '',
    city: event.city,
    startsAt: toLocalInput(event.starts_at),
    doorsAt: toLocalInput(event.doors_at),
    endsAt: toLocalInput(event.ends_at),
    heroImage: event.hero_image ?? '',
    status: event.status,
  });

  const set = (key: keyof typeof draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch(`/api/admin/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          startsAt: fromLocalInput(draft.startsAt),
          doorsAt: fromLocalInput(draft.doorsAt),
          endsAt: fromLocalInput(draft.endsAt),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNote({ tone: 'bad', text: body.error ?? 'Could not save.' });
        return;
      }
      setNote({ tone: 'ok', text: 'Saved — live on the site now.' });
      window.location.reload();
    } catch {
      setNote({ tone: 'bad', text: 'Could not reach the server.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn-outline px-3 py-1.5 text-[12px]">
        {open ? 'Close' : 'Edit details'}
      </button>

      {open && (
        <div className="mt-4 grid gap-3 border-t border-edge pt-4 sm:grid-cols-2">
          <F label="Event name"><input className="field py-2 text-[13px]" value={draft.name} onChange={set('name')} /></F>
          <F label="Edition / subtitle"><input className="field py-2 text-[13px]" value={draft.tagline} onChange={set('tagline')} placeholder="2026" /></F>
          <F label="Description" wide>
            <textarea className="field min-h-[84px] py-2 text-[13px]" value={draft.description} onChange={set('description')} />
          </F>
          <F label="Venue name"><input className="field py-2 text-[13px]" value={draft.venueName} onChange={set('venueName')} /></F>
          <F label="City"><input className="field py-2 text-[13px]" value={draft.city} onChange={set('city')} /></F>
          <F label="Venue address" wide><input className="field py-2 text-[13px]" value={draft.venueAddress} onChange={set('venueAddress')} /></F>
          <F label="Starts (IST)"><input type="datetime-local" className="field py-2 text-[13px]" value={draft.startsAt} onChange={set('startsAt')} /></F>
          <F label="Doors open (IST)"><input type="datetime-local" className="field py-2 text-[13px]" value={draft.doorsAt} onChange={set('doorsAt')} /></F>
          <F label="Ends (IST)"><input type="datetime-local" className="field py-2 text-[13px]" value={draft.endsAt} onChange={set('endsAt')} /></F>
          <F label="Status">
            <select className="field py-2 text-[13px]" value={draft.status} onChange={set('status')}>
              <option value="published">Published — visible and selling</option>
              <option value="sold_out">Sold out — visible, not selling</option>
              <option value="draft">Draft — hidden</option>
              <option value="cancelled">Cancelled</option>
              <option value="archived">Archived — hidden</option>
            </select>
          </F>
          <F label="Poster image path" wide hint="A file in /public, e.g. /events/dandiya-project-2026-poster.jpg">
            <input className="field py-2 text-[13px]" value={draft.heroImage} onChange={set('heroImage')} />
          </F>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="button" onClick={save} disabled={busy} className="btn-primary px-5 py-2 text-[13px] disabled:opacity-50">
              {busy ? 'Saving…' : 'Save and publish'}
            </button>
            {note && (
              <p className={cn('text-[13px] font-medium', note.tone === 'ok' ? 'text-leaf-600' : 'text-flare-600')}>{note.text}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function F({ label, children, wide, hint }: { label: string; children: React.ReactNode; wide?: boolean; hint?: string }) {
  return (
    <label className={cn('block', wide && 'sm:col-span-2')}>
      <span className="mb-1 block text-[11px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-muted">{hint}</span>}
    </label>
  );
}
