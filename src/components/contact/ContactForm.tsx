'use client';

import { motion } from 'framer-motion';
import { useState, type FormEvent } from 'react';
import { cn } from '@/lib/utils';

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
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="py-10 text-center"
        role="status"
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-vybe-500/40 bg-vybe-500/15">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            className="h-6 w-6 text-vybe-300"
            aria-hidden
          >
            <path d="M4 12.5l5.5 5.5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-chalk">Message sent</h2>
        <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-haze">
          We&apos;ve got it, and a confirmation is on its way to your inbox. Someone from the crew
          replies within one working day.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="label">
            Your name
          </label>
          <input
            id="c-name"
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
            autoComplete="name"
            className={cn('field', errors.name && 'field-error')}
            placeholder="Full name"
          />
          {errors.name && <p className="error-text">{errors.name[0]}</p>}
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
            className={cn('field', errors.email && 'field-error')}
            placeholder="you@example.com"
          />
          {errors.email && <p className="error-text">{errors.email[0]}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
            className="field"
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
        <label htmlFor="c-message" className="label">
          Message
        </label>
        <textarea
          id="c-message"
          rows={5}
          value={values.message}
          onChange={(event) => set('message', event.target.value)}
          className={cn('field resize-y', errors.message && 'field-error')}
          placeholder="Include your booking reference if this is about a ticket."
        />
        {errors.message && <p className="error-text">{errors.message[0]}</p>}
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

      <button type="submit" disabled={pending} className="btn-primary w-full py-3.5">
        {pending ? 'Sending…' : 'Send message'}
      </button>

      <p className="text-center text-[11px] leading-relaxed text-dim">
        We use your details only to reply to this message.
      </p>
    </form>
  );
}
