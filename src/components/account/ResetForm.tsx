'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FormMessage } from './FormMessage';

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    // Checked here rather than on the server: the server has no idea what the
    // customer meant to type twice, and a round trip to say "these differ" is
    // a round trip wasted.
    if (password !== confirm) {
      setError('Those two passwords do not match.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/account/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? 'Could not reset your password.');
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

  if (!token) {
    return (
      <div className="space-y-5">
        <FormMessage tone="error">
          This link is missing its token. Ask for a new reset email.
        </FormMessage>
        <Link href="/account/forgot" className="btn-primary w-full">
          Send a new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {error && <FormMessage tone="error">{error}</FormMessage>}

      <div>
        <label htmlFor="password" className="label">
          New password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="help">At least 10 characters.</p>
      </div>

      <div>
        <label htmlFor="confirm" className="label">
          Type it again
        </label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          className="field"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      <button type="submit" disabled={busy} className="btn-primary btn-lg w-full">
        {busy ? 'Saving…' : 'Save and sign in'}
      </button>
    </form>
  );
}
