'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

async function post<T>(url: string, body?: unknown): Promise<{ ok: boolean; data: T | null; error: string | null; details?: Record<string, string[]> }> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const json = (await response.json().catch(() => ({}))) as { data?: T; error?: string; details?: Record<string, string[]> };
    if (response.status === 429) return { ok: false, data: null, error: 'Too many attempts. Wait a few minutes and try again.' };
    if (!response.ok) return { ok: false, data: null, error: json.error ?? 'Something went wrong', details: json.details };
    return { ok: true, data: json.data ?? null, error: null };
  } catch {
    return { ok: false, data: null, error: 'Could not reach the server. Check your connection.' };
  }
}

export function PromoterLogin() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-10 rounded-2xl border-[1.5px] border-ink bg-paper p-6 shadow-press"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const result = await post('/api/promoter/login', { code });
        if (!result.ok) {
          setBusy(false);
          setError(result.error);
          return;
        }
        window.location.reload();
      }}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Promoter dashboard</p>
      <h1 className="mt-2 font-display text-2xl font-bold text-ink">Enter your code</h1>
      <p className="mt-1 text-[14px] text-slate">The organiser gave you a login code. It is not case-sensitive.</p>
      <input
        className="field mt-5 py-3 text-center font-mono text-xl uppercase tracking-[0.2em]"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoFocus
        placeholder="XXXX-XXXX"
        aria-label="Promoter code"
      />
      {error && <p role="alert" className="mt-3 text-[13px] font-medium text-flare-600">{error}</p>}
      <button type="submit" disabled={busy || code.trim().length < 6} className="btn-primary mt-5 w-full py-3.5 disabled:opacity-50">
        {busy ? 'Checking…' : 'Sign in'}
      </button>
    </form>
  );
}

export function PromoterSignOut() {
  return (
    <button
      type="button"
      className="shrink-0 rounded-lg border border-edge px-3 py-1.5 text-[12px] font-semibold text-slate"
      onClick={async () => {
        await post('/api/promoter/logout');
        window.location.reload();
      }}
    >
      Sign out
    </button>
  );
}

const EMPTY = { name: '', phone: '', email: '' };

export function PromoterIssue({ remaining }: { remaining: number }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState<{ sentTo: string; codes: string[]; emailSent: boolean } | null>(null);

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setFieldErrors((f) => ({ ...f, [key]: [] }));
  };

  if (remaining <= 0 && !done) {
    return (
      <div className="rounded-2xl border border-dashed border-edgeStrong bg-paper p-6 text-center">
        <p className="font-display text-lg font-bold text-ink">No passes left to issue</p>
        <p className="mt-1 text-[14px] text-slate">Ask the organiser to allocate more.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border-[1.5px] border-leaf-600 bg-leaf-600/5 p-5">
        <p className="font-display text-lg font-bold text-ink">
          {done.codes.length === 1 ? 'Pass issued' : `${done.codes.length} passes issued`}
        </p>
        <p className="mt-1 text-[14px] text-slate">
          {done.emailSent ? (
            <>Sent to <strong className="break-all text-ink">{done.sentTo}</strong>.</>
          ) : (
            <>Issued, but the email to <strong className="break-all">{done.sentTo}</strong> did not go through — the organiser can resend it.</>
          )}{' '}
          It stays pending until the organiser activates it.
        </p>
        <p className="mt-2 font-mono text-[12px] text-muted">{done.codes.join(' · ')}</p>
        <button type="button" className="btn-primary mt-4 w-full py-3" onClick={() => setDone(null)}>
          Issue another
        </button>
      </div>
    );
  }

  const max = Math.min(10, remaining);

  return (
    <form
      className="rounded-2xl border-[1.5px] border-ink bg-paper p-5 shadow-press-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        setFieldErrors({});
        const result = await post<{ sentTo: string; codes: string[]; emailSent: boolean }>('/api/promoter/issue', { ...form, quantity });
        setBusy(false);
        if (!result.ok || !result.data) {
          if (result.error?.includes('session')) {
            window.location.reload();
            return;
          }
          setError(result.error);
          setFieldErrors(result.details ?? {});
          return;
        }
        setDone(result.data);
        setForm(EMPTY);
        setQuantity(1);
        router.refresh();
      }}
    >
      <p className="font-display text-lg font-bold text-ink">Issue a pass</p>
      <p className="mt-0.5 text-[13px] text-slate">The QR pass is emailed to the customer straight away.</p>

      <div className="mt-4 space-y-3">
        <Input label="Customer name" value={form.name} onChange={set('name')} autoComplete="off" error={fieldErrors.name?.[0]} />
        <Input label="Phone number" value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="off" error={fieldErrors.phone?.[0]} />
        <Input label="Email" value={form.email} onChange={set('email')} type="email" inputMode="email" autoComplete="off" error={fieldErrors.email?.[0]} />

        <div>
          <span className="mb-1 block text-[12px] font-medium text-muted">Passes for this customer</span>
          <div className="flex items-center gap-3">
            <button type="button" className="h-11 w-11 rounded-xl border border-edge text-xl font-bold text-ink disabled:opacity-30" disabled={quantity <= 1} onClick={() => setQuantity((q) => q - 1)} aria-label="Fewer">
              −
            </button>
            <span className="w-10 text-center font-display text-2xl font-bold tnum text-ink">{quantity}</span>
            <button type="button" className="h-11 w-11 rounded-xl border border-edge text-xl font-bold text-ink disabled:opacity-30" disabled={quantity >= max} onClick={() => setQuantity((q) => q + 1)} aria-label="More">
              +
            </button>
            <span className="text-[12px] text-muted">max {max}</span>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg bg-flare-200/40 px-3 py-2 text-[13px] font-medium text-flare-600">{error}</p>}

      <button type="submit" disabled={busy} className="btn-primary mt-5 w-full py-3.5 text-[15px] disabled:opacity-50">
        {busy ? 'Issuing and emailing…' : `Issue ${quantity} pass${quantity === 1 ? '' : 'es'}`}
      </button>
    </form>
  );
}

function Input({
  label,
  error,
  ...props
}: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-muted">{label}</span>
      <input className={error ? 'field field-error py-3 text-[15px]' : 'field py-3 text-[15px]'} required {...props} />
      {error && <span className="mt-1 block text-[12px] font-medium text-flare-600">{error}</span>}
    </label>
  );
}
