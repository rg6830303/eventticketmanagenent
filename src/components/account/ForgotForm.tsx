'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FormMessage } from './FormMessage';

export function ForgotForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/account/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? 'Could not send that email. Try again.');
        setBusy(false);
        return;
      }
      setSent(true);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    }
    setBusy(false);
  }

  /*
   * The confirmation is deliberately non-committal about whether the address
   * has an account. Saying "we sent it" only when one exists turns this form
   * into a way to test whether a given person is on our customer list.
   */
  if (sent) {
    return (
      <div className="space-y-5">
        <FormMessage tone="success">
          If {email} has an account with us, a reset link is on its way. It works for two hours.
        </FormMessage>
        <p className="text-[0.875rem] leading-relaxed text-slate">
          Nothing in your inbox after a few minutes? Check spam, then try again — a typo in the
          address is the usual answer.
        </p>
        <Link href="/login" className="btn-outline w-full">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {error && <FormMessage tone="error">{error}</FormMessage>}

      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          className="field"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <button type="submit" disabled={busy} className="btn-primary btn-lg w-full">
        {busy ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}
