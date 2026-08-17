'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useState, type FormEvent } from 'react';
import { cn } from '@/lib/utils';
import { Globe } from '@/components/brand/Globe';

const SUBJECTS = [
  'Ticket problem',
  'Table / group booking',
  'Press & partnerships',
  'I want to play',
  'Something else',
];

export function ContactForm() {
  const [values, setValues] = useState({
    name: '',
    email: '',
    phone: '',
    subject: SUBJECTS[0],
    message: '',
    company: '',
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const reduce = useReducedMotion();

  function set(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setErrors({});
    setTopError(null);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = (await response.json()) as {
        error?: string;
        details?: Record<string, string[]>;
      };

      if (!response.ok) {
        setErrors(body.details ?? {});
        setTopError(body.error ?? 'We could not send that. Please try again.');
        setPending(false);
        return;
      }

      setSent(true);
    } catch {
      setTopError('Could not reach the server. Check your connection and try again.');
      setPending(false);
    }
  }

  if (sent) {
    return (
      <motion.div
        initial={reduce ? undefined : { opacity: 0, y: 12 }}
        animate={reduce ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden py-12 text-center"
        role="status"
      >
        <Globe
          spin
          strokeWidth={1}
          className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 text-vybe-500/12 [animation-duration:50s]"
        />
        <div className="relative">
          <motion.div
            initial={reduce ? undefined : { scale: 0.7, opacity: 0 }}
            animate={reduce ? undefined : { scale: 1, opacity: 1 }}
            transition={{ delay: 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-vybe-500/40 bg-vybe-500/15"
          >
            <span
              aria-hidden
              className="absolute inset-0 animate-pulse-ring rounded-full border border-vybe-400/40"
            />
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className="h-7 w-7 text-vybe-300"
              aria-hidden
            >
              <motion.path
                d="M4 12.5l5.5 5.5L20 7"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={reduce ? undefined : { pathLength: 0 }}
                animate={reduce ? undefined : { pathLength: 1 }}
                transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
              />
            </svg>
          </motion.div>
          <h2 className="font-display text-2xl font-bold text-chalk">Message sent</h2>
          <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-haze">
            We&apos;ve got it, and a confirmation is on its way to your inbox. Someone from the crew
            replies within one working day.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-chalk">Send us a message</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dim">
          No account, no newsletter sign-up. A reply lands within one working day.
        </p>
      </div>

      <div className="divider" />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="label">
            Your name
          </label>
          <input
            id="c-name"
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
            autoComplete="name"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'c-name-error' : undefined}
            className={cn('field', errors.name && 'field-error')}
            placeholder="Full name"
          />
          {errors.name && (
            <p id="c-name-error" className="error-text">
              {errors.name[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="c-email" className="label">
            Email
          </label>
          <input
            id="c-email"
            type="email"
            value={values.email}
            onChange={(event) => set('email', event.target.value)}
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'c-email-error' : undefined}
            className={cn('field', errors.email && 'field-error')}
            placeholder="you@example.com"
          />
          {errors.email && (
            <p id="c-email-error" className="error-text">
              {errors.email[0]}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="c-phone" className="label">
            Phone <span className="text-dim">(optional)</span>
          </label>
          <input
            id="c-phone"
            value={values.phone}
            onChange={(event) => set('phone', event.target.value)}
            autoComplete="tel"
            inputMode="tel"
            className="field"
            placeholder="+91 98765 43210"
          />
        </div>

        <div>
          <label htmlFor="c-subject" className="label">
            What&apos;s it about?
          </label>
          <select
            id="c-subject"
            value={values.subject}
            onChange={(event) => set('subject', event.target.value)}
            className="field appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-11"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%2374abff' stroke-width='1.8'%3E%3Cpath d='M6 8l4 4 4-4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
            }}
          >
            {SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="c-message" className="label">
            Message
          </label>
          <span aria-hidden className="mb-2 font-mono text-[11px] text-dim">
            {values.message.trim().length}
          </span>
        </div>
        <textarea
          id="c-message"
          rows={5}
          value={values.message}
          onChange={(event) => set('message', event.target.value)}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? 'c-message-error' : undefined}
          className={cn('field resize-y leading-relaxed', errors.message && 'field-error')}
          placeholder="Include your booking reference if this is about a ticket."
        />
        {errors.message && (
          <p id="c-message-error" className="error-text">
            {errors.message[0]}
          </p>
        )}
      </div>

      {/* Honeypot */}
      <div aria-hidden className="absolute h-0 w-0 overflow-hidden opacity-0">
        <label htmlFor="c-company">Company</label>
        <input
          id="c-company"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={values.company}
          onChange={(event) => set('company', event.target.value)}
        />
      </div>

      <div aria-live="assertive" className="min-h-[20px]">
        {topError && (
          <p className="error-text" role="alert">
            <span aria-hidden>⚠</span>
            {topError}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn-primary group relative w-full overflow-hidden py-4"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
        />
        <span className="relative">{pending ? 'Sending…' : 'Send message'}</span>
      </button>

      <p className="text-center text-[11px] leading-relaxed text-dim">
        We use your details only to reply to this message.
      </p>
    </form>
  );
}
