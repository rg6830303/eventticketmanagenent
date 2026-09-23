'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FormMessage } from './FormMessage';

export function SignUpForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    marketingOptIn: false,
    company: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await fetch('/api/account/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFieldErrors(payload.details ?? {});
        setError(payload.error ?? 'Could not create that account.');
        setBusy(false);
        return;
      }

      router.replace('/account');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setBusy(false);
    }
  }

  const fieldError = (key: string) => fieldErrors[key]?.[0];

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {error && <FormMessage tone="error">{error}</FormMessage>}

      <div>
        <label htmlFor="name" className="label">
          Your name
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          required
          className={`field ${fieldError('name') ? 'field-error' : ''}`}
          placeholder="Full name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
        />
        {fieldError('name') && <p className="error-text">{fieldError('name')}</p>}
      </div>

      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          className={`field ${fieldError('email') ? 'field-error' : ''}`}
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
        />
        <p className="help">Use the address you book tickets with and your past orders appear here.</p>
        {fieldError('email') && <p className="error-text">{fieldError('email')}</p>}
      </div>

      <div>
        <label htmlFor="phone" className="label">
          Phone <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          className={`field ${fieldError('phone') ? 'field-error' : ''}`}
          placeholder="+91 98765 43210"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
        {fieldError('phone') && <p className="error-text">{fieldError('phone')}</p>}
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className={`field ${fieldError('password') ? 'field-error' : ''}`}
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
        />
        <p className="help">At least 10 characters. Nothing else to remember.</p>
        {fieldError('password') && <p className="error-text">{fieldError('password')}</p>}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-frost p-4 ring-hair-strong">
        <input
          type="checkbox"
          className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-vybe-500"
          checked={form.marketingOptIn}
          onChange={(e) => set('marketingOptIn', e.target.checked)}
        />
        <span className="text-[0.875rem] leading-relaxed text-slate">
          Email me when a new date goes on sale. No more than once a month.
        </span>
      </label>

      {/* Honeypot. Hidden from people, irresistible to bots. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        value={form.company}
        onChange={(e) => set('company', e.target.value)}
      />

      <button type="submit" disabled={busy} className="btn-primary btn-lg w-full">
        {busy ? 'Creating your account…' : 'Create account'}
      </button>
    </form>
  );
}
