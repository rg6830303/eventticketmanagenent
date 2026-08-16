'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { cn } from '@/lib/utils';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        // The server already phrases these safely (it never reveals whether an
        // account exists), so it is shown verbatim.
        setError(body.error ?? 'Sign in failed. Try again.');
        setPending(false);
        return;
      }

      // Only relative paths — an open redirect here would be a phishing vector.
      const destination = next.startsWith('/') && !next.startsWith('//') ? next : '/admin';
      router.push(destination);
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="email" className="label">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={cn('field', error && 'field-error')}
          placeholder="you@houzofvybe.com"
          disabled={pending}
        />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={cn('field pr-16', error && 'field-error')}
            placeholder="••••••••••"
            disabled={pending}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold uppercase tracking-wider text-dim transition-colors hover:text-chalk"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div aria-live="assertive" className="min-h-[20px]">
        {error && (
          <p className="error-text" role="alert">
            <span aria-hidden>⚠</span>
            {error}
          </p>
        )}
      </div>

      <button type="submit" disabled={pending || !email || !password} className="btn-primary w-full">
        {pending ? 'Checking…' : 'Sign in'}
      </button>
    </form>
  );
}
