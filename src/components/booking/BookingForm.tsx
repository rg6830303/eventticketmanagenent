'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { cn, formatInr } from '@/lib/utils';
import { suggestEmailCorrection } from '@/lib/validation';

export interface TierOption {
  code: string;
  name: string;
  description: string | null;
  pricePaise: number;
  remaining: number;
  perks: string[];
}

interface BookingFormProps {
  eventSlug: string;
  eventName: string;
  tiers: TierOption[];
  initialTier?: string;
  maxQuantity: number;
  onChange?: (state: { tierCode: string; quantity: number }) => void;
}

type Field = 'name' | 'email' | 'phone';

const PROGRESS_STEPS = ['Reserving your spot…', 'Issuing tickets…', 'Sending your QR…'];

export function BookingForm({
  eventSlug,
  eventName,
  tiers,
  initialTier,
  maxQuantity,
  onChange,
}: BookingFormProps) {
  const router = useRouter();

  const available = useMemo(() => tiers.filter((tier) => tier.remaining > 0), [tiers]);
  const [tierCode, setTierCode] = useState(
    initialTier && tiers.some((t) => t.code === initialTier && t.remaining > 0)
      ? initialTier
      : (available[0]?.code ?? ''),
  );
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState('');

  const [touched, setTouched] = useState<Record<Field, boolean>>({
    name: false,
    email: false,
    phone: false,
  });
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);

  // One key per form instance: a double-click sends the same key twice and the
  // server returns the original booking instead of creating a second one.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const selectedTier = tiers.find((tier) => tier.code === tierCode) ?? null;
  const ceiling = Math.min(maxQuantity, selectedTier?.remaining ?? maxQuantity);

  useEffect(() => {
    onChange?.({ tierCode, quantity });
  }, [tierCode, quantity, onChange]);

  // Dropping to a tier with less stock must not leave an impossible quantity.
  useEffect(() => {
    setQuantity((current) => Math.min(current, Math.max(1, ceiling)));
  }, [ceiling]);

  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => {
      setProgress((step) => Math.min(step + 1, PROGRESS_STEPS.length - 1));
    }, 1400);
    return () => window.clearInterval(id);
  }, [pending]);

  const normalisedPhone = phone.replace(/[\s\-()]/g, '').replace(/^(\+91|0091|91|0)/, '');
  const emailSuggestion = email.includes('@') ? suggestEmailCorrection(email) : null;

  const localErrors: Partial<Record<Field, string>> = {};
  if (touched.name && name.trim().length < 2) localErrors.name = 'Enter your full name';
  if (touched.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
    localErrors.email = 'Enter a valid email address';
  }
  if (touched.phone && !/^[6-9]\d{9}$/.test(normalisedPhone)) {
    localErrors.phone = 'Enter a valid 10-digit Indian mobile number';
  }

  function errorFor(field: Field): string | undefined {
    return serverErrors[field]?.[0] ?? localErrors[field];
  }

  const canSubmit =
    Boolean(tierCode) &&
    name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) &&
    /^[6-9]\d{9}$/.test(normalisedPhone) &&
    consent &&
    quantity >= 1 &&
    !pending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ name: true, email: true, phone: true });
    if (!canSubmit) return;

    setPending(true);
    setProgress(0);
    setTopError(null);
    setServerErrors({});

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          eventSlug,
          tierCode,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: normalisedPhone,
          quantity,
          company,
          consent,
        }),
      });

      const body = (await response.json()) as {
        data?: { reference: string };
        error?: string;
        details?: Record<string, string[]>;
      };

      if (!response.ok || !body.data) {
        setServerErrors(body.details ?? {});
        setTopError(
          response.status === 429
            ? (body.error ?? 'Too many attempts. Give it a minute and try again.')
            : (body.error ?? 'We could not complete your booking. Please try again.'),
        );
        setPending(false);
        return;
      }

      // A fresh key so a later booking from the same open tab is not deduped
      // against this one.
      setIdempotencyKey(crypto.randomUUID());
      router.push(`/booking/${body.data.reference}`);
    } catch {
      setTopError('Could not reach the server. Check your connection and try again.');
      setPending(false);
    }
  }

  if (available.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-xl font-bold text-chalk">Sold out</p>
        <p className="mt-2 text-sm text-haze">
          Every tier for {eventName} has gone. Follow us for the next release.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-7">
      <div className="rounded-xl border border-vybe-500/30 bg-vybe-500/[0.08] px-4 py-3.5">
        <p className="text-[13px] font-medium text-vybe-100">No payment required right now</p>
        <p className="mt-1 text-[12px] leading-relaxed text-haze">
          Card payments are not switched on yet. Your tickets are issued immediately and emailed
          to you free of charge.
        </p>
      </div>

      <fieldset disabled={pending} className="space-y-7">
        <section>
          <legend className="eyebrow mb-3">01 — Choose your ticket</legend>
          <div className="space-y-2.5">
            {tiers.map((tier) => {
              const soldOut = tier.remaining <= 0;
              const selected = tier.code === tierCode;
              return (
                <label
                  key={tier.code}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
                    selected
                      ? 'border-vybe-500 bg-vybe-500/10'
                      : 'border-hairline hover:border-vybe-700',
                    soldOut && 'cursor-not-allowed opacity-45 hover:border-hairline',
                  )}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={tier.code}
                    checked={selected}
                    disabled={soldOut}
                    onChange={() => setTierCode(tier.code)}
                    className="mt-1 h-4 w-4 shrink-0 accent-vybe-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-display text-[15px] font-semibold text-chalk">
                        {tier.name}
                      </span>
                      <span className="font-display text-[15px] font-bold text-vybe-200">
                        {tier.pricePaise === 0 ? 'Free' : formatInr(tier.pricePaise)}
                      </span>
                    </span>
                    {tier.description && (
                      <span className="mt-1 block text-[12px] leading-relaxed text-haze">
                        {tier.description}
                      </span>
                    )}
                    {tier.perks.length > 0 && (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {tier.perks.map((perk) => (
                          <span
                            key={perk}
                            className="rounded-full border border-hairline px-2 py-0.5 text-[10px] text-haze"
                          >
                            {perk}
                          </span>
                        ))}
                      </span>
                    )}
                    <span className="mt-2 block text-[11px] text-dim">
                      {soldOut
                        ? 'Sold out'
                        : tier.remaining <= 20
                          ? `Only ${tier.remaining} left`
                          : `${tier.remaining} available`}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <section>
          <legend className="eyebrow mb-3">02 — How many?</legend>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 rounded-full border border-hairline p-1">
              <StepButton
                label="Remove one ticket"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                −
              </StepButton>
              <span className="w-12 text-center font-display text-xl font-bold tabular-nums text-chalk">
                {quantity}
              </span>
              <StepButton
                label="Add one ticket"
                onClick={() => setQuantity((q) => Math.min(ceiling, q + 1))}
                disabled={quantity >= ceiling}
              >
                +
              </StepButton>
            </div>
            <p className="text-[12px] text-dim">
              Up to {ceiling} per booking. Each person gets their own QR.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <legend className="eyebrow mb-3">03 — Where do we send the tickets?</legend>

          <div>
            <label htmlFor="name" className="label">
              Full name
            </label>
            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              autoComplete="name"
              className={cn('field', errorFor('name') && 'field-error')}
              placeholder="As it appears on your ID"
            />
            {errorFor('name') && <p className="error-text">{errorFor('name')}</p>}
            <p className="help">Door staff check this against your photo ID.</p>
          </div>

          <div>
            <label htmlFor="email" className="label">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              autoComplete="email"
              inputMode="email"
              className={cn('field', errorFor('email') && 'field-error')}
              placeholder="you@example.com"
            />
            {errorFor('email') && <p className="error-text">{errorFor('email')}</p>}
            {/* A typo'd domain means the ticket is simply lost, so offer the fix. */}
            {emailSuggestion && !errorFor('email') && (
              <button
                type="button"
                onClick={() => setEmail(emailSuggestion)}
                className="mt-1.5 text-[12px] text-vybe-300 underline underline-offset-2"
              >
                Did you mean {emailSuggestion}?
              </button>
            )}
            <p className="help">Your QR ticket goes here. Double-check it.</p>
          </div>

          <div>
            <label htmlFor="phone" className="label">
              Mobile number
            </label>
            <div className="flex">
              <span className="flex items-center rounded-l-xl border border-r-0 border-hairline bg-elevated px-3.5 text-[15px] text-haze">
                +91
              </span>
              <input
                id="phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                autoComplete="tel-national"
                inputMode="numeric"
                maxLength={14}
                className={cn('field rounded-l-none', errorFor('phone') && 'field-error')}
                placeholder="98765 43210"
              />
            </div>
            {errorFor('phone') && <p className="error-text">{errorFor('phone')}</p>}
            <p className="help">Used only if we need to reach you about this event.</p>
          </div>

          {/* Honeypot — hidden from people, irresistible to bots. */}
          <div aria-hidden className="absolute h-0 w-0 overflow-hidden opacity-0">
            <label htmlFor="company">Company</label>
            <input
              id="company"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-hairline p-4">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-vybe-500"
            />
            <span className="text-[12px] leading-relaxed text-haze">
              I&apos;m 21 or older, I&apos;ll bring a government photo ID matching this name, and I
              accept the{' '}
              <Link href="/legal/terms" className="text-vybe-300 underline underline-offset-2">
                entry terms
              </Link>
              .
            </span>
          </label>
        </section>
      </fieldset>

      <div aria-live="assertive" className="min-h-[20px]">
        {topError && (
          <p className="error-text" role="alert">
            <span aria-hidden>⚠</span>
            {topError}
          </p>
        )}
      </div>

      <button type="submit" disabled={!canSubmit} className="btn-primary w-full py-4 text-[15px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={pending ? PROGRESS_STEPS[progress] : 'idle'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {pending
              ? PROGRESS_STEPS[progress]
              : selectedTier && selectedTier.pricePaise > 0
                ? `Confirm ${quantity} ticket${quantity === 1 ? '' : 's'} — free right now`
                : `Get ${quantity} ticket${quantity === 1 ? '' : 's'}`}
          </motion.span>
        </AnimatePresence>
      </button>

      <p className="text-center text-[11px] leading-relaxed text-dim">
        No account needed. We only use your details to issue and deliver this ticket.
      </p>
    </form>
  );
}

function StepButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-chalk transition-colors hover:bg-elevated disabled:opacity-30"
    >
      {children}
    </button>
  );
}
