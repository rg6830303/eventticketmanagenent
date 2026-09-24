'use client';

import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';

interface Props {
  mode: Mode;
  /** Where to go after signing in. Only same-site paths are honoured. */
  next?: string;
  /** Reset token from the emailed link. */
  token?: string;
}

const COPY: Record<Mode, { title: string; lede: string; button: string; busy: string }> = {
  login: {
    title: 'Sign in',
    lede: 'Sign in to book passes and see every ticket you have bought.',
    button: 'Sign in',
    busy: 'Signing in…',
  },
  signup: {
    title: 'Create your account',
    lede: 'One account for every Houz of Vybe night. Your QR passes live here as well as your inbox.',
    button: 'Create account',
    busy: 'Creating your account…',
  },
  forgot: {
    title: 'Forgot your password?',
    lede: 'Enter your account email and we will send you a link to choose a new one.',
    button: 'Send reset link',
    busy: 'Sending…',
  },
  reset: {
    title: 'Choose a new password',
    lede: 'Pick something you have not used here before. At least 8 characters.',
    button: 'Save new password',
    busy: 'Saving…',
  },
};

const ENDPOINT: Record<Mode, string> = {
  login: '/api/account/login',
  signup: '/api/account/signup',
  forgot: '/api/account/forgot',
  reset: '/api/account/reset',
};

/**
 * Only follow a `next` that stays on this site. An open redirect on a sign-in
 * page is the classic phishing aid: a link that looks like ours and lands the
 * customer somewhere that is not.
 */
function safeNext(next?: string): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/account';
  return next;
}

export function AuthForm({ mode, next, token }: Props) {
  const [fields, setFields] = useState({ name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const copy = COPY[mode];
  const set = (key: keyof typeof fields) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFields((f) => ({ ...f, [key]: event.target.value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const copyErrors = { ...e };
      delete copyErrors[key];
      return copyErrors;
    });
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setErrors({});

    const body =
      mode === 'login'
        ? { email: fields.email, password: fields.password }
        : mode === 'signup'
          ? fields
          : mode === 'forgot'
            ? { email: fields.email }
            : { token, password: fields.password };

    try {
      const response = await fetch(ENDPOINT[mode], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as { error?: string; details?: Record<string, string[]> };

      if (!response.ok) {
        setErrors(json.details ?? {});
        setMessage(json.error ?? 'Something went wrong. Try again.');
        return;
      }

      if (mode === 'forgot') {
        // Same answer whether or not the address has an account.
        setDone(true);
        return;
      }

      // Signed in. A full navigation rather than router.push, so the header
      // and every server component re-render as the signed-in customer.
      window.location.assign(safeNext(next));
    } catch {
      setMessage('We could not reach the server. Check your connection.');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'forgot' && done) {
    return (
      <div className="card-print p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-ink">Check your inbox</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-slate">
          If <strong className="text-ink">{fields.email}</strong> has a Houz of Vybe account, a reset
          link is on its way. It works once, for the next hour. Nothing there after a few minutes?
          Check spam.
        </p>
        <Link href="/login" className="btn-outline mt-6 inline-flex">
          Back to sign in
        </Link>
      </div>
    );
  }

  if (mode === 'reset' && !token) {
    return (
      <div className="card-print p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-ink">This link is incomplete</h1>
        <p className="mt-3 text-[0.9375rem] text-slate">
          Open the reset link straight from the email, or ask for a new one.
        </p>
        <Link href="/forgot-password" className="btn-primary mt-6 inline-flex">
          Send a new link
        </Link>
      </div>
    );
  }

  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : '';

  return (
    <form onSubmit={submit} noValidate className="card-print p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{copy.title}</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate">{copy.lede}</p>

      <div className="mt-6 space-y-4">
        {mode === 'signup' && (
          <Input id="name" label="Full name" value={fields.name} onChange={set('name')}
            autoComplete="name" errors={errors.name} />
        )}

        {mode !== 'reset' && (
          <Input id="email" label="Email" type="email" inputMode="email" value={fields.email}
            onChange={set('email')} autoComplete="email" errors={errors.email} />
        )}

        {mode === 'signup' && (
          <Input id="phone" label="Mobile number" type="tel" inputMode="tel" value={fields.phone}
            onChange={set('phone')} autoComplete="tel" errors={errors.phone}
            hint="Any format works — +91, spaces or dashes." />
        )}

        {mode !== 'forgot' && (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="password" className="label">
                {mode === 'reset' ? 'New password' : 'Password'}
              </label>
              {mode === 'login' && (
                <Link href="/forgot-password" className="text-[0.8125rem] font-medium text-vybe-700 underline underline-offset-2">
                  Forgot password?
                </Link>
              )}
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={fields.password}
                onChange={set('password')}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className={cn('field pr-16', errors.password && 'field-error')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 text-[0.75rem] font-semibold text-slate"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password ? (
              <p className="error-text">{errors.password[0]}</p>
            ) : (
              mode !== 'login' && <p className="help">At least 8 characters.</p>
            )}
          </div>
        )}
      </div>

      {message && (
        <p role="alert" className="mt-5 rounded-xl border border-flare-300 bg-flare-200/30 px-4 py-3 text-[0.875rem] text-flare-600">
          {message}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-primary mt-6 w-full py-4 disabled:opacity-60">
        {busy ? copy.busy : copy.button}
      </button>

      <p className="mt-5 text-center text-[0.875rem] text-slate">
        {mode === 'login' && (
          <>New here? <Link href={`/signup${nextQuery}`} className="font-semibold text-vybe-700 underline underline-offset-2">Create an account</Link></>
        )}
        {mode === 'signup' && (
          <>Already have an account? <Link href={`/login${nextQuery}`} className="font-semibold text-vybe-700 underline underline-offset-2">Sign in</Link></>
        )}
        {(mode === 'forgot' || mode === 'reset') && (
          <Link href="/login" className="font-semibold text-vybe-700 underline underline-offset-2">Back to sign in</Link>
        )}
      </p>
    </form>
  );
}

function Input({
  id,
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  inputMode,
  errors,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel';
  errors?: string[];
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} type={type} value={value} onChange={onChange} autoComplete={autoComplete}
        inputMode={inputMode} className={cn('field', errors?.length && 'field-error')} />
      {errors?.length ? <p className="error-text">{errors[0]}</p> : hint ? <p className="help">{hint}</p> : null}
    </div>
  );
}
