'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { cn, formatInr } from '@/lib/utils';
import { clearCart, type CartItem } from '@/lib/cart';

const EASE = [0.16, 1, 0.3, 1] as const;

interface Props {
  eventSlug: string;
  items: CartItem[];
  totalPasses: number;
  totalPaise: number;
  referralCode: string;
  maxPasses: number;
  /** False when the deployment has no live gateway configured. */
  checkoutEnabled: boolean;
}

type Phase = 'idle' | 'booking' | 'starting-payment' | 'redirecting' | 'error';

interface FieldErrors {
  [field: string]: string[];
}

/**
 * Cart checkout.
 *
 * Collects the three things a ticket cannot be issued without — a name to print
 * on it, an address to send it to, a number to reach the buyer on — and then
 * does the whole handoff in one action: create the booking, open the payment
 * session, redirect.
 *
 * The failure design matters more than the happy path. Once `/api/bookings`
 * returns, inventory is reserved and the booking exists, so **every** later
 * failure routes to `/pay/<reference>` rather than showing an error on the
 * cart. A customer who sees "something went wrong" on a cart whose stock is
 * already held has lost their passes as far as they can tell; a customer who
 * lands on a checkout page with a Pay button has not.
 */
export function CartCheckout({
  eventSlug,
  items,
  totalPasses,
  totalPaise,
  referralCode,
  maxPasses,
  checkoutEnabled,
}: Props) {
  const router = useRouter();
  const reduce = useReducedMotion();

  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState({ name: '', email: '', phone: '', consent: false, updates: false });

  // Regenerated per attempt, not per render: a retry after a network timeout
  // must replay the same key so a booking that actually committed is returned
  // instead of written twice.
  const idempotencyKey = useRef<string | null>(null);

  const busy = phase === 'booking' || phase === 'starting-payment' || phase === 'redirecting';
  const overLimit = totalPasses > maxPasses;

  const set = (field: keyof typeof form) => (value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (busy) return;

      setError(null);
      setFieldErrors({});
      setPhase('booking');

      if (!idempotencyKey.current) {
        idempotencyKey.current = crypto.randomUUID();
      }

      let reference: string | null = null;

      try {
        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey.current,
          },
          body: JSON.stringify({
            eventSlug,
            items: items.map((item) => ({ tierCode: item.code, quantity: item.quantity })),
            name: form.name,
            email: form.email,
            phone: form.phone,
            referralCode: referralCode || '',
            marketingOptIn: form.updates,
            consent: form.consent,
            company: '',
          }),
        });

        const body = (await response.json()) as {
          data?: {
            reference: string;
            requiresPayment: boolean;
            payUrl: string | null;
            amountPaise: number;
            referralRejected?: boolean;
            referralMessage?: string | null;
          };
          error?: string;
          details?: FieldErrors;
        };

        if (!response.ok || !body.data) {
          // The booking never committed, so the cart is still the right place
          // to be and the key can be reused on the next attempt.
          idempotencyKey.current = null;
          setPhase('error');
          setFieldErrors(body.details ?? {});
          setError(body.error ?? 'We could not hold those passes. Try again in a moment.');
          return;
        }

        reference = body.data.reference;

        // Inventory is reserved from here on. The cart has done its job.
        clearCart();

        if (!body.data.requiresPayment) {
          router.push(`/booking/${reference}`);
          return;
        }

        setPhase('starting-payment');

        // Gateway-agnostic: the server creates the order and decides which rail
        // is live, so the cart never names a provider. Razorpay's checkout needs
        // its own component mounted with the order id, so the handoff is always
        // to the checkout page rather than straight to a hosted page.
        const sessionResponse = await fetch('/api/payments/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference }),
        });
        const sessionBody = (await sessionResponse.json()) as {
          data?: { alreadyPaid?: boolean; payUrl?: string };
        };

        if (sessionBody.data?.alreadyPaid) {
          router.push(`/booking/${reference}?paid=1`);
          return;
        }

        setPhase('redirecting');
        router.push(sessionBody.data?.payUrl ?? body.data.payUrl ?? `/pay/${reference}`);
      } catch {
        if (reference) {
          router.push(`/pay/${reference}`);
          return;
        }
        idempotencyKey.current = null;
        setPhase('error');
        setError('We could not reach the server. Check your connection and try again.');
      }
    },
    [busy, eventSlug, items, form, referralCode, router],
  );

  const buttonLabel =
    phase === 'booking'
      ? 'Holding your passes…'
      : phase === 'starting-payment'
        ? 'Starting secure checkout…'
        : phase === 'redirecting'
          ? 'Taking you to payment…'
          : `Pay ${formatInr(totalPaise)}`;

  return (
    <form onSubmit={submit} noValidate className="card-print mt-6 overflow-hidden">
      <div className="border-b-[1.5px] border-ink bg-vybe-100 px-6 py-4">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-ink">
          Checkout
        </p>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-slate">
          {totalPasses} {totalPasses === 1 ? 'pass' : 'passes'} · QR tickets are emailed the moment
          your payment clears.
        </p>
      </div>

      <div className="space-y-4 px-6 py-5">
        <Field
          id="cart-name"
          label="Full name"
          hint="This is the name printed on your pass."
          value={form.name}
          onChange={set('name')}
          autoComplete="name"
          errors={fieldErrors.name}
          disabled={busy}
        />

        <Field
          id="cart-email"
          label="Email"
          type="email"
          hint="Where the QR passes are sent. Check it twice."
          value={form.email}
          onChange={set('email')}
          autoComplete="email"
          inputMode="email"
          errors={fieldErrors.email}
          disabled={busy}
        />

        <Field
          id="cart-phone"
          label="Mobile number"
          type="tel"
          hint="10 digits. Used only if we need to reach you about this order."
          value={form.phone}
          onChange={set('phone')}
          autoComplete="tel"
          inputMode="numeric"
          errors={fieldErrors.phone}
          disabled={busy}
        />

        <label className="flex cursor-pointer items-start gap-3 pt-1 text-[0.8125rem] leading-relaxed text-slate">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(event) => set('consent')(event.target.checked)}
            disabled={busy}
            className="mt-[3px] h-4 w-4 shrink-0 accent-vybe-600"
          />
          <span>
            I accept the{' '}
            <Link href="/legal/terms" className="link-swipe font-medium text-ink">
              entry terms
            </Link>{' '}
            and the{' '}
            <Link href="/legal/refunds" className="link-swipe font-medium text-ink">
              refund policy
            </Link>
            .
          </span>
        </label>
        {fieldErrors.consent && (
          <p className="text-[0.8125rem] font-medium text-flare-600">{fieldErrors.consent[0]}</p>
        )}

        <label className="flex cursor-pointer items-start gap-3 text-[0.8125rem] leading-relaxed text-slate">
          <input
            type="checkbox"
            checked={form.updates}
            onChange={(event) => set('updates')(event.target.checked)}
            disabled={busy}
            className="mt-[3px] h-4 w-4 shrink-0 accent-vybe-600"
          />
          <span>Tell me about the next Houz of Vybe drop. Optional, and easy to leave.</span>
        </label>
      </div>

      <div className="border-t-[1.5px] border-ink px-6 py-5">
        {overLimit ? (
          <p className="rounded-xl border border-flare-300 bg-flare-200/30 px-4 py-3 text-[0.8125rem] leading-relaxed text-flare-600">
            <span className="font-semibold">
              {totalPasses} passes is over the {maxPasses}-pass limit.
            </span>{' '}
            Reduce the cart, or email us for a group booking.
          </p>
        ) : !checkoutEnabled ? (
          <p className="rounded-xl border border-flare-300 bg-flare-200/30 px-4 py-3 text-[0.8125rem] leading-relaxed text-flare-600">
            <span className="font-semibold">Online payment is switched off.</span> Card and UPI
            checkout will appear here as soon as it is live.
          </p>
        ) : (
          <button
            type="submit"
            disabled={busy}
            className={cn('btn-primary relative w-full overflow-hidden py-[18px] text-base')}
          >
            {busy && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 animate-sheen bg-sheen"
                style={{ backgroundSize: '200% 100%' }}
              />
            )}
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={buttonLabel}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: reduce ? 0 : 0.2, ease: EASE }}
                className="relative flex items-center justify-center gap-2"
              >
                {!busy && <LockIcon />}
                {buttonLabel}
              </motion.span>
            </AnimatePresence>
          </button>
        )}

        <div aria-live="assertive">
          <AnimatePresence>
            {error && (
              <motion.p
                role="alert"
                initial={reduce ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 rounded-xl border border-flare-300 bg-flare-200/30 px-4 py-3 text-[0.8125rem] leading-relaxed text-flare-600"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-4 text-center text-[0.75rem] leading-relaxed text-muted">
          Payment is handled by Razorpay. Card, UPI and net-banking details are entered on their
          secure page and never reach our servers.
        </p>
      </div>
    </form>
  );
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'numeric' | 'tel';
  errors?: string[];
  disabled?: boolean;
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  type = 'text',
  autoComplete,
  inputMode,
  errors,
  disabled,
}: FieldProps) {
  const invalid = Boolean(errors?.length);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn('field', invalid && 'field-error')}
      />
      {invalid ? (
        <p id={`${id}-error`} className="text-[0.8125rem] font-medium text-flare-600">
          {errors?.[0]}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="help">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="3" y="7" width="10" height="7" rx="2" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}
