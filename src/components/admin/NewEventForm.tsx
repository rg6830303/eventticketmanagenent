'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Create an event.
 *
 * Asks for the four things that cannot be guessed — what it is called, where,
 * when it starts, when it ends — and nothing else. Everything else has a
 * sensible default and belongs on the edit screen, where there is room to
 * explain it. A create form that asks for the runsheet is a create form nobody
 * finishes in one sitting.
 *
 * The result is always a draft, so nothing reaches the public site until the
 * rest is filled in and Publish is pressed.
 */
export function NewEventForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    venueName: '',
    startsAt: '',
    endsAt: '',
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          venueName: form.venueName || undefined,
          // datetime-local has no timezone; the browser's own offset is the
          // right reading — an operator types the venue's wall clock while
          // sitting in that timezone.
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? 'Could not create that event.');
        setBusy(false);
        return;
      }

      router.push(`/admin/events/${body.data.event.id}`);
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary btn-sm">
        New event
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-paper p-4 shadow-soft ring-hair">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[1.05rem] font-semibold text-ink">New event</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] font-medium text-slate hover:text-ink"
        >
          Cancel
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-md bg-flare-100 px-3 py-2 text-[12px] text-flare-600">
          {error}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Name</span>
          <input
            type="text"
            required
            className="field"
            placeholder="OFF Campus"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>

        <label className="block">
          <span className="label">Venue</span>
          <input
            type="text"
            className="field"
            placeholder="Kingdome Klub & Kitchen"
            value={form.venueName}
            onChange={(e) => set('venueName', e.target.value)}
          />
        </label>

        <label className="block">
          <span className="label">Starts</span>
          <input
            type="datetime-local"
            required
            className="field"
            value={form.startsAt}
            onChange={(e) => set('startsAt', e.target.value)}
          />
        </label>

        <label className="block">
          <span className="label">Ends</span>
          <input
            type="datetime-local"
            className="field"
            value={form.endsAt}
            onChange={(e) => set('endsAt', e.target.value)}
          />
        </label>
      </div>

      <button type="submit" disabled={busy} className="btn-primary btn-sm mt-4">
        {busy ? 'Creating…' : 'Create as draft'}
      </button>
    </form>
  );
}
