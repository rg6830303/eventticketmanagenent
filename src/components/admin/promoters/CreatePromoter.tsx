'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CodeReveal, Field, Note, call } from './ui';

const EMPTY = { name: '', phone: '', email: '', code: '', allocated: '', dealPriceRupees: '', notes: '' };

export function CreatePromoter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [issued, setIssued] = useState<{ code: string; name: string; id: string } | null>(null);

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await call<{ code: string; promoter: { id: string; name: string } }>('/api/admin/promoters', 'POST', {
      ...draft,
      allocated: Number(draft.allocated) || 0,
      dealPriceRupees: Number(draft.dealPriceRupees) || 0,
    });
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.error);
      return;
    }
    setIssued({ code: result.data.code, name: result.data.promoter.name, id: result.data.promoter.id });
    setDraft(EMPTY);
    router.refresh();
  }

  if (issued) {
    return (
      <div className="panel p-4">
        <p className="mb-3 font-display text-lg font-bold text-ink">{issued.name} is set up</p>
        <CodeReveal
          code={issued.code}
          name={issued.name}
          onDone={() => {
            setIssued(null);
            setOpen(false);
          }}
        />
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn-primary w-full px-5 py-3 text-[14px] sm:w-auto" onClick={() => setOpen(true)}>
        + New promoter
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="panel space-y-3 p-4">
      <p className="font-display text-lg font-bold text-ink">New promoter</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Name *">
          <input className="field py-2 text-[14px]" value={draft.name} onChange={set('name')} required autoComplete="off" />
        </Field>
        <Field label="Phone">
          <input className="field py-2 text-[14px]" value={draft.phone} onChange={set('phone')} inputMode="tel" />
        </Field>
        <Field label="Email">
          <input className="field py-2 text-[14px]" value={draft.email} onChange={set('email')} type="email" />
        </Field>
        <Field label="Passes to allocate" hint="Free to the promoter. You can add or take back later.">
          <input className="field py-2 text-[14px]" value={draft.allocated} onChange={set('allocated')} inputMode="numeric" placeholder="0" />
        </Field>
        <Field label="Deal price per pass (₹)" hint="What they owe you per pass issued. Used for “amount due”.">
          <input className="field py-2 text-[14px]" value={draft.dealPriceRupees} onChange={set('dealPriceRupees')} inputMode="decimal" placeholder="0" />
        </Field>
        <Field label="Login code" hint="Leave blank to generate one. 6+ letters/numbers.">
          <input className="field py-2 font-mono text-[14px] uppercase" value={draft.code} onChange={set('code')} autoComplete="off" placeholder="auto" />
        </Field>
        <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
          <textarea className="field min-h-[60px] py-2 text-[14px]" value={draft.notes} onChange={set('notes')} />
        </Field>
      </div>
      {error && <Note tone="bad">{error}</Note>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="btn-primary px-5 py-2.5 text-[13px] disabled:opacity-50">
          {busy ? 'Creating…' : 'Create promoter'}
        </button>
        <button type="button" className="btn-outline px-4 py-2.5 text-[13px]" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
