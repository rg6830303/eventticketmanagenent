'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Globe } from '@/components/brand/Globe';
import { cn } from '@/lib/utils';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/admin';
  const reduce = useReducedMotion();

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
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-dim transition-colors hover:text-chalk"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div aria-live="assertive" className="min-h-[24px]">
        <AnimatePresence initial={false} mode="wait">
          {error && (
            <motion.p
              key={error}
              role="alert"
              className="error-text text-flare-300"
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 0 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, x: [0, -7, 6, -3, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0.15 : 0.38, ease: 'easeOut' }}
            >
              <ErrorIcon className="mt-px h-3.5 w-3.5 shrink-0" />
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <button
        type="submit"
        disabled={pending || !email || !password}
        className="btn-primary w-full gap-2.5"
      >
        {pending && (
          <Globe
            spin
            strokeWidth={6}
            className="h-4 w-4 text-white/80 [animation-duration:1.3s]"
          />
        )}
        {pending ? 'Checking…' : 'Sign in'}
      </button>
    </form>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9.5" strokeWidth="1.6" />
      <path d="M12 7.5v5.2" strokeLinecap="round" />
      <circle cx="12" cy="16.4" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}
