'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { cn, formatInr } from '@/lib/utils';
import { suggestEmailCorrection } from '@/lib/validation';
import { EVENT, REFERRAL } from '@/content/site';

export interface TierOption {
  code: string;
  name: string;
  description: string | null;
  pricePaise: number;
  remaining: number;
  perks: string[];
  redeemablePaise?: number;
  pax?: number;
  priceUnit?: string;
}

export interface ReferralState {
  code: string;
  discountPaise: number;
  status: 'empty' | 'checking' | 'valid' | 'invalid';
  message: string | null;
}

interface BookingFormProps {
  eventSlug: string;
  eventName: string;
  tiers: TierOption[];
  initialTier?: string;
  initialReferral?: string;
  maxQuantity: number;
  paymentsEnabled: boolean;
  onChange?: (state: {
    tierCode: string;
    quantity: number;
    referral: ReferralState;
  }) => void;
}

type Field = 'name' | 'email' | 'phone';

const EASE = [0.16, 1, 0.3, 1] as const;

export function BookingForm({
  eventSlug,
  eventName,
  tiers,
  initialTier,
  initialReferral,
  maxQuantity,
  paymentsEnabled,
  onChange,
}: BookingFormProps) {
  const router = useRouter();
  const reduce = useReducedMotion();

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

  const [referralInput, setReferralInput] = useState(initialReferral ?? '');
  const [referral, setReferral] = useState<ReferralState>({
    code: '',
    discountPaise: 0,
    status: 'empty',
    message: null,
  });

  const [touched, setTouched] = useState<Record<Field, boolean>>({
    name: false,
    email: false,
    phone: false,
  });
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // One key per form instance: a double-click sends the same key twice and the
  // server returns the original booking instead of creating a second one.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const selectedTier = tiers.find((tier) => tier.code === tierCode) ?? null;
  const ceiling = Math.max(1, Math.min(maxQuantity, selectedTier?.remaining ?? maxQuantity));
  const subtotal = (selectedTier?.pricePaise ?? 0) * quantity;

  useEffect(() => {
    onChange?.({ tierCode, quantity, referral });
  }, [tierCode, quantity, referral, onChange]);

  // Dropping to a tier with less stock must not leave an impossible quantity.
  useEffect(() => {
    setQuantity((current) => Math.min(current, ceiling));
  }, [ceiling]);

  // ---- Referral checking --------------------------------------------------
  // Debounced, and every response carries the input it was asked about so a
  // slow reply for an old code cannot overwrite the verdict for a newer one.
  const requestSeq = useRef(0);

  const checkReferral = useCallback(
    async (raw: string, orderPaise: number) => {
      const code = raw.trim().toUpperCase();
      if (!code) {
        setReferral({ code: '', discountPaise: 0, status: 'empty', message: null });
        return;
      }

      const seq = ++requestSeq.current;
      setReferral((current) => ({ ...current, code, status: 'checking' }));

      try {
        const response = await fetch('/api/referrals/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, amountPaise: orderPaise }),
        });
        const body = (await response.json()) as {
          data?: { valid: boolean; discountPaise: number; reason?: string };
          error?: string;
        };
        if (seq !== requestSeq.current) return;

        if (body.data?.valid) {
          setReferral({
            code,
            discountPaise: body.data.discountPaise,
            status: 'valid',
            message: `₹${Math.round(body.data.discountPaise / 100)} off applied`,
          });
        } else {
          setReferral({
            code,
            discountPaise: 0,
            status: 'invalid',
            message: body.data?.reason ?? body.error ?? 'That code did not work.',
          });
        }
      } catch {
        if (seq !== requestSeq.current) return;
        setReferral({
          code,
          discountPaise: 0,
          status: 'invalid',
          message: 'Could not check that code. It will be re-checked when you book.',
        });
      }
    },
    [],
  );

  useEffect(() => {
    const raw = referralInput.trim();
    if (!raw) {
      requestSeq.current += 1;
      setReferral({ code: '', discountPaise: 0, status: 'empty', message: null });
      return;
    }
    const id = window.setTimeout(() => void checkReferral(raw, subtotal), 450);
    return () => window.clearTimeout(id);
  }, [referralInput, subtotal, checkReferral]);

  // ---- Validation ---------------------------------------------------------
  const normalisedPhone = phone.replace(/[\s\-()]/g, '').replace(/^(\+91|0091|91|0)/, '');
  const emailSuggestion = email.includes('@') ? suggestEmailCorrection(email) : null;

  const nameValid = name.trim().length >= 2;
  const emailValid = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email);
  const phoneValid = /^[6-9]\d{9}$/.test(normalisedPhone);

  const localErrors: Partial<Record<Field, string>> = {};
  if (touched.name && !nameValid) localErrors.name = 'Enter your full name';
  if (touched.email && !emailValid) localErrors.email = 'Enter a valid email address';
  if (touched.phone && !phoneValid) {
    localErrors.phone = 'Enter a valid 10-digit Indian mobile number';
  }

  function errorFor(field: Field): string | undefined {
    return serverErrors[field]?.[0] ?? localErrors[field];
  }

  const canSubmit =
    Boolean(tierCode) && nameValid && emailValid && phoneValid && consent && !pending;

  const discount = referral.status === 'valid' ? Math.min(referral.discountPaise, subtotal) : 0;
  const total = Math.max(0, subtotal - discount);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ name: true, email: true, phone: true });
    if (!canSubmit) return;

    setPending(true);
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
          referralCode: referral.status === 'valid' ? referral.code : referralInput.trim(),
          company,
          consent,
        }),
      });

      const body = (await response.json()) as {
        data?: { reference: string; requiresPayment: boolean };
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
      router.push(
        body.data.requiresPayment
          ? `/pay/${body.data.reference}`
          : `/booking/${body.data.reference}`,
      );
    } catch {
      setTopError('Could not reach the server. Check your connection and try again.');
      setPending(false);
    }
  }

  if (available.length === 0) {
    return (
      <div className="panel p-10 text-center">
        <p className="h-card">Sold out</p>
        <p className="mt-2 text-[0.9375rem] text-slate">
          Every ticket for {eventName} has gone. Follow us on Instagram — returns and the next
          release get posted there first.
        </p>
      </div>
    );
  }

  const submitLabel = pending
    ? paymentsEnabled && total > 0
      ? 'Holding your spot…'
      : 'Issuing your passes…'
    : paymentsEnabled && total > 0
      ? `Continue to payment · ${formatInr(total)}`
      : `Get ${quantity} pass${quantity === 1 ? '' : 'es'}`;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      <fieldset disabled={pending} className="min-w-0 space-y-8">
        <legend className="sr-only">Booking details</legend>

        {/* ---------------- 01 · ticket ---------------- */}
        <section aria-labelledby="step-tier">
          <StepHeading id="step-tier" number="01" title="Pick your ticket" />
          <div role="radiogroup" aria-labelledby="step-tier" className="mt-4 space-y-3">
            {tiers.map((tier) => {
              const soldOut = tier.remaining <= 0;
              const selected = tier.code === tierCode;
              const scarce = !soldOut && tier.remaining <= 20;
              return (
                <label
                  key={tier.code}
                  className={cn(
                    'relative flex cursor-pointer items-start gap-4 rounded-[14px] border-[1.5px] bg-paper p-5 transition-all duration-200',
                    selected
                      ? 'border-ink shadow-press'
                      : 'border-ink/25 hover:border-ink/60',
                    soldOut && 'cursor-not-allowed opacity-50 hover:border-ink/25',
                  )}
                >
                  {/* One travelling outline rather than four static ones, so the
                      selection reads as a move instead of a repaint. */}
                  {selected && !reduce && (
                    <motion.span
                      aria-hidden
                      layoutId="tier-outline"
                      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                      className="pointer-events-none absolute inset-0 rounded-[14px] ring-2 ring-vybe-500/50"
                    />
                  )}
                  <input
                    type="radio"
                    name="tier"
                    value={tier.code}
                    checked={selected}
                    disabled={soldOut}
                    onChange={() => setTierCode(tier.code)}
                    className="relative mt-1 h-[18px] w-[18px] shrink-0 accent-vybe-500"
                  />
                  <span className="relative min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-display text-[1.0625rem] font-semibold text-ink">
                        {tier.name}
                      </span>
                      <span className="tnum font-display text-[1.0625rem] font-bold text-ink">
                        {tier.pricePaise === 0 ? 'Free' : formatInr(tier.pricePaise)}
                      </span>
                    </span>
                    {tier.description && (
                      <span className="mt-1 block text-[0.8125rem] leading-relaxed text-slate">
                        {tier.description}
                      </span>
                    )}
                    {tier.perks.length > 0 && (
                      <span className="mt-2.5 flex flex-wrap gap-1.5">
                        {tier.perks.map((perk) => (
                          <span
                            key={perk}
                            className="rounded-[6px] border border-ink/25 bg-frost px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.06em] text-slate"
                          >
                            {perk}
                          </span>
                        ))}
                      </span>
                    )}
                    <span
                      className={cn(
                        'mt-2.5 block text-[0.75rem] font-medium',
                        scarce ? 'text-flare-600' : 'text-muted',
                      )}
                    >
                      {soldOut
                        ? 'Sold out'
                        : scarce
                          ? `Only ${tier.remaining} left`
                          : `${tier.remaining} available`}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        {/* ---------------- 02 · quantity ---------------- */}
        <section aria-labelledby="step-qty">
          <StepHeading id="step-qty" number="02" title="How many of you?" />
          <div className="mt-4 flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-1 rounded-[12px] border-[1.5px] border-ink bg-paper p-1 shadow-press-sm">
              <StepButton
                label="Remove one ticket"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                −
              </StepButton>
              <span className="relative block h-9 w-12 overflow-hidden">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    key={quantity}
                    initial={reduce ? { opacity: 1 } : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
                    transition={{ duration: reduce ? 0 : 0.24, ease: EASE }}
                    className="tnum absolute inset-0 grid place-items-center font-display text-xl font-bold text-ink"
                  >
                    {quantity}
                  </motion.span>
                </AnimatePresence>
              </span>
              <StepButton
                label="Add one ticket"
                onClick={() => setQuantity((q) => Math.min(ceiling, q + 1))}
                disabled={quantity >= ceiling}
              >
                +
              </StepButton>
            </div>
            <p className="text-[0.8125rem] text-muted">
              Up to {ceiling} per booking. Everyone gets their own QR.
            </p>
          </div>
        </section>

        {/* ---------------- 03 · referral ---------------- */}
        <section aria-labelledby="step-referral">
          <StepHeading id="step-referral" number="03" title={REFERRAL.headline} optional />
          <div className="mt-4">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  id="referral"
                  value={referralInput}
                  onChange={(event) => setReferralInput(event.target.value.toUpperCase())}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-describedby="referral-help"
                  className={cn(
                    'field font-mono uppercase tracking-[0.12em]',
                    referral.status === 'valid' && 'border-leaf-500 focus:border-leaf-500 focus:shadow-[2px_2px_0_0_theme(colors.leaf.500)]',
                    referral.status === 'invalid' && 'field-error',
                  )}
                />
                {referral.status === 'checking' && (
                  <span className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-edge border-t-vybe-500" />
                )}
                {referral.status === 'valid' && (
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-leaf-500">
                    <Tick className="h-4 w-4" />
                  </span>
                )}
              </div>
              {referralInput && (
                <button
                  type="button"
                  onClick={() => setReferralInput('')}
                  className="btn-outline btn-sm shrink-0"
                >
                  Clear
                </button>
              )}
            </div>

            <Collapse show={Boolean(referral.message)} reduce={Boolean(reduce)}>
              <p
                className={cn(
                  'mt-2 flex items-center gap-1.5 text-[0.8125rem] font-medium',
                  referral.status === 'valid' ? 'text-leaf-600' : 'text-flare-600',
                )}
              >
                {referral.message}
              </p>
            </Collapse>

            <p id="referral-help" className="help">
              {REFERRAL.copy}
            </p>
          </div>
        </section>

        {/* ---------------- 04 · details ---------------- */}
        <section aria-labelledby="step-details">
          <StepHeading id="step-details" number="04" title="Where do the passes go?" />

          <div className="mt-4 space-y-5">
            <div>
              <label htmlFor="name" className="label">
                Full name
              </label>
              <div className="relative">
                <input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                  autoComplete="name"
                  className={cn('field pr-11', errorFor('name') && 'field-error')}
                  placeholder="As printed on your ID"
                />
                <FieldTick show={nameValid && !errorFor('name')} reduce={Boolean(reduce)} />
              </div>
              <Collapse show={Boolean(errorFor('name'))} reduce={Boolean(reduce)}>
                <p className="error-text">{errorFor('name')}</p>
              </Collapse>
              <p className="help">The door checks this against your photo ID.</p>
            </div>

            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  autoComplete="email"
                  inputMode="email"
                  className={cn('field pr-11', errorFor('email') && 'field-error')}
                  placeholder="you@example.com"
                />
                <FieldTick
                  show={emailValid && !errorFor('email') && !emailSuggestion}
                  reduce={Boolean(reduce)}
                />
              </div>
              <Collapse show={Boolean(errorFor('email'))} reduce={Boolean(reduce)}>
                <p className="error-text">{errorFor('email')}</p>
              </Collapse>
              {/* A typo'd domain means the pass is simply lost, so offer the fix. */}
              <Collapse show={Boolean(emailSuggestion) && !errorFor('email')} reduce={Boolean(reduce)}>
                <button
                  type="button"
                  onClick={() => emailSuggestion && setEmail(emailSuggestion)}
                  className="mt-2 text-[0.8125rem] font-medium text-vybe-600 underline underline-offset-2"
                >
                  Did you mean {emailSuggestion}?
                </button>
              </Collapse>
              <p className="help">Your QR passes are sent here. Check it twice.</p>
            </div>

            <div>
              <label htmlFor="phone" className="label">
                Mobile number
              </label>
              <div className="flex">
                <span className="flex items-center rounded-l-[13px] border border-r-0 border-edgeStrong bg-frost px-4 text-[0.9375rem] font-medium text-slate">
                  +91
                </span>
                <div className="relative min-w-0 flex-1">
                  <input
                    id="phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                    autoComplete="tel-national"
                    inputMode="numeric"
                    maxLength={14}
                    className={cn('field rounded-l-none pr-11', errorFor('phone') && 'field-error')}
                    placeholder="98765 43210"
                  />
                  <FieldTick show={phoneValid && !errorFor('phone')} reduce={Boolean(reduce)} />
                </div>
              </div>
              <Collapse show={Boolean(errorFor('phone'))} reduce={Boolean(reduce)}>
                <p className="error-text">{errorFor('phone')}</p>
              </Collapse>
              <p className="help">Only used if something changes about the event.</p>
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

            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-[12px] border-[1.5px] p-4 transition-colors',
                consent ? 'border-ink bg-vybe-50 shadow-press-sm' : 'border-ink/25 bg-paper',
              )}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-vybe-500"
              />
              <span className="text-[0.8125rem] leading-relaxed text-slate">
                I am {EVENT.ageLabel.replace('+', '')} or older, I will carry a government photo ID
                matching this name, and I accept the{' '}
                <Link href="/legal/terms" className="font-medium text-vybe-600 underline underline-offset-2">
                  entry terms
                </Link>
                .
              </span>
            </label>
          </div>
        </section>
      </fieldset>

      <div aria-live="assertive" className="min-h-[24px]">
        {topError && (
          <p className="error-text text-[0.875rem]" role="alert">
            <span aria-hidden>⚠</span>
            {topError}
          </p>
        )}
      </div>

      {/* Sticky only where the running total is off-screen. On desktop the
          summary column already shows it, and a floating button over a
          two-column layout just covers the form. */}
      <div className="z-10 max-lg:sticky max-lg:bottom-4">
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-primary relative w-full overflow-hidden py-[18px] text-base"
        >
          {pending && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 animate-sheen bg-sheen"
              style={{ backgroundSize: '200% 100%' }}
            />
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={submitLabel}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              {submitLabel}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>

      <p className="text-center text-[0.75rem] leading-relaxed text-muted">
        No account needed. Your details are used to issue and deliver these passes, nothing else.
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------------- */

function StepHeading({
  id,
  number,
  title,
  optional,
}: {
  id: string;
  number: string;
  title: string;
  optional?: boolean;
}) {
  return (
    <h2 id={id} className="flex items-center gap-3 border-t-2 border-ink pt-5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border-[1.5px] border-ink bg-vybe-100 font-mono text-[0.75rem] font-medium text-ink shadow-press-sm">
        {number}
      </span>
      <span className="font-display text-[1.15rem] font-semibold tracking-[-0.02em] text-ink">
        {title}
      </span>
      {optional && (
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted">
          optional
        </span>
      )}
    </h2>
  );
}

function Tick({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <motion.path
        d="M4 12.5l5.5 5.5L20 7"
        stroke="currentColor"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 0.32, ease: 'easeOut' }}
      />
    </motion.svg>
  );
}

function FieldTick({ show, reduce }: { show: boolean; reduce: boolean }) {
  return (
    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
      <AnimatePresence initial={false}>
        {show && (
          <motion.span
            key="tick"
            aria-hidden
            className="block text-leaf-500"
            initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: EASE }}
          >
            <Tick className="h-4 w-4" />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Height-animated slot so a message appearing does not snap the layout. */
function Collapse({
  show,
  reduce,
  children,
}: {
  show: boolean;
  reduce: boolean;
  children: ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="slot"
          className="overflow-hidden"
          initial={reduce ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.26, ease: EASE }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StepButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: ReactNode;
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
      className="flex h-10 w-10 items-center justify-center rounded-[9px] text-xl text-ink transition-colors hover:bg-vybe-100 disabled:opacity-25"
    >
      {children}
    </button>
  );
}
