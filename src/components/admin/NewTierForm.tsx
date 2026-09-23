'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Add a pass to an event. Prices are edited afterwards on the Prices screen. */
export function NewTierForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    priceRupees: '',
    coverRupees: '0',
    quantity: '200',
    admits: '1',
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/events/${eventId}/tiers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          priceRupees: Number(form.priceRupees),
          coverRupees: Number(form.coverRupees),
          quantity: Number(form.quantity),
          admits: Number(form.admits),
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? 'Could not add that pass.');
        setBusy(false);
        return;
      }

      setOpen(false);
      setForm({ code: '', name: '', priceRupees: '', coverRupees: '0', quantity: '200', admits: '1' });
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-outline btn-sm">
        Add a pass
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="w-full rounded-lg bg-frost p-4 ring-hair">
      {error && (
        <p role="alert" className="mb-3 rounded-md bg-flare-100 px-3 py-2 text-[12px] text-flare-600">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label">Code</span>
          <input
            type="text"
            required
            className="field font-mono uppercase"
            placeholder="NORMAL"
            value={form.code}
            onChange={(e) => set('code', e.target.value.toUpperCase())}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Name</span>
          <input
            type="text"
            required
            className="field"
            placeholder="General Access"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Price (₹)</span>
          <input
            type="number"
            min="0"
            required
            className="field"
            value={form.priceRupees}
            onChange={(e) => set('priceRupees', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Cover (₹)</span>
          <input
            type="number"
            min="0"
            className="field"
            value={form.coverRupees}
            onChange={(e) => set('coverRupees', e.target.value)}
          />
          <span className="help">Redeemable at the bar. Zero is a real answer.</span>
        </label>
        <label className="block">
          <span className="label">Admits</span>
          <input
            type="number"
            min="1"
            max="50"
            className="field"
            value={form.admits}
            onChange={(e) => set('admits', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">How many for sale</span>
          <input
            type="number"
            min="1"
            className="field"
            value={form.quantity}
            onChange={(e) => set('quantity', e.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? 'Adding…' : 'Add pass'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] font-medium text-slate hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
