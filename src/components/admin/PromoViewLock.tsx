'use client';

import { useState } from 'react';

export function PromoViewLock() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mx-auto mt-16 w-full max-w-sm rounded-2xl border-[1.5px] border-ink bg-paper p-6 shadow-press"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const response = await fetch('/api/admin/promoview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });
          if (response.ok) {
            window.location.reload();
            return;
          }
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          setError(response.status === 429 ? 'Too many attempts. Try again in a few minutes.' : body.error ?? 'That code is not right');
        } catch {
          setError('Could not reach the server.');
        }
        setBusy(false);
      }}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Promoter overview · view only</p>
      <h1 className="mt-2 font-display text-2xl font-bold text-ink">Enter the access code</h1>
      <input
        className="field mt-5 py-3 text-center font-mono text-lg uppercase tracking-[0.18em]"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="PV-XXXX-XXXX"
        autoFocus
        autoComplete="off"
        aria-label="Access code"
      />
      {error && <p role="alert" className="mt-3 text-[13px] font-medium text-flare-600">{error}</p>}
      <button type="submit" disabled={busy || code.trim().length < 6} className="btn-primary mt-5 w-full py-3.5 disabled:opacity-50">
        {busy ? 'Checking…' : 'Unlock'}
      </button>
    </form>
  );
}

export function PromoViewSignOut() {
  return (
    <button
      type="button"
      className="shrink-0 rounded-lg border border-edge px-3 py-1.5 text-[12px] font-semibold text-slate"
      onClick={async () => {
        await fetch('/api/admin/promoview', { method: 'DELETE' }).catch(() => {});
        window.location.reload();
      }}
    >
      Lock
    </button>
  );
}
