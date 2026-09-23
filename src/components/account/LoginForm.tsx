'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FormMessage } from './FormMessage';

/**
 * Sign in.
 *
 * `next` is validated before it is followed. An open redirect on a login page
 * is the classic phishing primitive — a link that really does go to our
 * domain, really does log you in, and then drops you somewhere else entirely —
 * so anything that is not a plain in-site path is discarded.
 */
export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const destination = next && /^\/(?!\/)/.test(next) ? next : '/account';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/account/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? 'Could not sign you in. Try again.');
        setBusy(false);
        return;
      }

      // refresh() so every server component re-reads the new cookie; without it
      // the header would still say "Sign in" on the page we navigate to.
      router.replace(destination);
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setBusy(false);
    }
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
          name="email"
          type="email"
          autoComplete="email"
          required
          className="field"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="password" className="label">
            Password
          </label>
          <Link
            href="/account/forgot"
            className="mb-2 text-[0.75rem] font-semibold text-vybe-700 hover:underline"
          >
            Forgot it?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button type="submit" disabled={busy} className="btn-primary btn-lg w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
