'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn, formatInr } from '@/lib/utils';
import { clearCart, type CartItem } from '@/lib/cart';
import { loadCheckout } from '@/components/payment/RazorpayCheckout';

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
  /** Signed-in customer. Null means show the sign-in prompt instead of a form. */
  account: { name: string; email: string; phone: string } | null;
}

type Phase = 'idle' | 'booking' | 'starting-payment' | 'paying' | 'verifying' | 'redirecting' | 'error';

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
  account,
}: Props) {
  if (!account) return <SignInToBuy />;
  return (
    <CheckoutForm
      eventSlug={eventSlug}
      items={items}
      totalPasses={totalPasses}
      totalPaise={totalPaise}
      referralCode={referralCode}
      maxPasses={maxPasses}
      checkoutEnabled={checkoutEnabled}
      account={account}
    />
  );
}

/**
 * Buying needs an account, so a signed-out cart asks for one — and sends them
 * straight back here afterwards with the cart intact, because the cart lives in
 * the browser and survives the round trip.
 */
function SignInToBuy() {
  return (
    <div className="card-print mt-6 overflow-hidden">
      <div className="border-b-[1.5px] border-ink bg-vybe-100 px-6 py-4">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-ink">
          Checkout
        </p>
      </div>
      <div className="space-y-4 px-6 py-6">
        <p className="font-display text-xl font-bold text-ink">Sign in to buy your passes</p>
        <p className="text-[0.9375rem] leading-relaxed text-slate">
          Tickets are tied to your Houz of Vybe account, so your QR passes are always one sign-in
          away. Your cart is saved — you will land right back here.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/login?next=/cart" className="btn-primary">
            Sign in
          </Link>
          <Link href="/signup?next=/cart" className="btn-outline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}

function CheckoutForm({
  eventSlug,
  items,
  totalPasses,
  totalPaise,
  referralCode,
  maxPasses,
  checkoutEnabled,
  account,
}: Props & { account: NonNullable<Props['account']> }) {
  const router = useRouter();
  const reduce = useReducedMotion();

  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Prefilled from the account. The email is fixed to it: passes go to the
  // inbox the customer signed in with, and the server enforces the same.
  const [form, setForm] = useState({
    name: account.name,
    email: account.email,
    phone: account.phone,
    consent: false,
    updates: false,
  });

  // Regenerated per attempt, not per render: a retry after a network timeout
  // must replay the same key so a booking that actually committed is returned
  // instead of written twice.
  const idempotencyKey = useRef<string | null>(null);

  // Reference of a booking already held by an earlier press. A retry pays for
  // that booking instead of holding a second one.
  const heldRef = useRef<string | null>(null);
  const poller = useRef<ReturnType<typeof setInterval> | null>(null);
  const [heldReference, setHeldReference] = useState<string | null>(null);

  const busy =
    phase === 'booking' || phase === 'starting-payment' || phase === 'paying' || phase === 'verifying' || phase === 'redirecting';
  const overLimit = totalPasses > maxPasses;

  // Warm Razorpay's script while they fill the form, so Pay opens instantly.
  useEffect(() => {
    loadCheckout().catch(() => {});
    return () => {
      if (poller.current) clearInterval(poller.current);
    };
  }, []);

  const set = (field: keyof typeof form) => (value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const finish = useCallback(
    (reference: string) => {
      if (poller.current) clearInterval(poller.current);
      poller.current = null;
      clearCart();
      setPhase('redirecting');
      router.replace(`/booking/${reference}?paid=1`);
    },
    [router],
  );

  /** Ask the server (which asks Razorpay) whether this booking is paid. */
  const checkPaid = useCallback(
    async (reference: string) => {
      try {
        const response = await fetch(`/api/bookings/${reference}/claim`, { method: 'POST' });
        const body = (await response.json()) as { data?: { status?: string } };
        if (body.data?.status === 'confirmed') {
          finish(reference);
          return true;
        }
      } catch {
        /* next tick */
      }
      return false;
    },
    [finish],
  );

  /** Create (or reuse) the booking. Null means an error was already shown. */
  const holdBooking = useCallback(async (): Promise<{ reference: string; requiresPayment: boolean } | null> => {
    if (heldRef.current) return { reference: heldRef.current, requiresPayment: true };
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();

    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey.current },
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
      data?: { reference: string; requiresPayment: boolean };
      error?: string;
      details?: FieldErrors;
    };

    // The session lapsed; sign in and come straight back. The cart survives.
    if (response.status === 401) {
      window.location.assign('/login?next=/cart');
      return null;
    }
    if (!response.ok || !body.data) {
      idempotencyKey.current = null;
      setPhase('error');
      setFieldErrors(body.details ?? {});
      setError(body.error ?? 'We could not hold those passes. Try again in a moment.');
      return null;
    }
    heldRef.current = body.data.reference;
    setHeldReference(body.data.reference);
    return body.data;
  }, [eventSlug, items, form, referralCode]);

  /**
   * Pay straight from the cart: hold the booking, create the Razorpay order,
   * open the modal. No intermediate page. The cart is only cleared once the
   * payment is confirmed, so a dismissed modal leaves everything in place and
   * the next press reuses the same held booking.
   */
  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (busy) return;

      setError(null);
      setFieldErrors({});
      setPhase('booking');

      let reference: string | null = null;
      try {
        const held = await holdBooking();
        if (!held) return;
        reference = held.reference;

        if (!held.requiresPayment) {
          clearCart();
          router.replace(`/booking/${reference}`);
          return;
        }

        setPhase('starting-payment');
        // Script and order in parallel: the modal opens as soon as both land.
        const [, orderResponse] = await Promise.all([
          loadCheckout(),
          fetch('/api/payments/razorpay/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference }),
          }),
        ]);
        const orderBody = (await orderResponse.json()) as {
          data?: { orderId: string; amount: number; currency: string; keyId: string };
          error?: string;
        };
        if (!orderResponse.ok || !orderBody.data) {
          if (await checkPaid(reference)) return;
          setPhase('error');
          setError(orderBody.error ?? 'We could not start the payment. Your passes are held — press Pay to try again.');
          return;
        }

        const Razorpay = window.Razorpay;
        if (!Razorpay) throw new Error('checkout unavailable');
        const ref = reference;
        const rzp = new Razorpay({
          key: orderBody.data.keyId,
          order_id: orderBody.data.orderId,
          amount: orderBody.data.amount,
          currency: orderBody.data.currency,
          name: 'Houz of Vybe',
          description: `${totalPasses} ${totalPasses === 1 ? 'pass' : 'passes'}`,
          prefill: { name: form.name, email: form.email, contact: form.phone },
          notes: { reference: ref },
          theme: { color: '#2586ef', backdrop_color: '#0a2138' },
          retry: { enabled: false },
          handler: async (payload: unknown) => {
            setPhase('verifying');
            try {
              const response = await fetch('/api/payments/razorpay/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              if (response.ok) {
                finish(ref);
                return;
              }
            } catch {
              /* fall through to asking the server */
            }
            if (!(await checkPaid(ref))) {
              setPhase('error');
              setError(
                'Your payment went through but we are still confirming it. Do not pay again — your passes will arrive by email.',
              );
            }
          },
          modal: {
            confirm_close: true,
            ondismiss: () => {
              setPhase((current) => (current === 'verifying' || current === 'redirecting' ? current : 'idle'));
              void checkPaid(ref);
            },
          },
        });
        rzp.on('payment.failed', (payload: unknown) => {
          const detail = payload as { error?: { description?: string } };
          setPhase('error');
          setError(detail.error?.description ?? 'The payment did not go through. Nothing was charged — press Pay to try again.');
        });

        setPhase('paying');
        rzp.open();

        // UPI apps can evict this tab mid-payment; keep asking the server.
        if (poller.current) clearInterval(poller.current);
        const deadline = Date.now() + 8 * 60 * 1000;
        poller.current = setInterval(() => {
          if (Date.now() > deadline) {
            if (poller.current) clearInterval(poller.current);
          } else void checkPaid(ref);
        }, 5000);
      } catch {
        setPhase('error');
        if (!reference) idempotencyKey.current = null;
        setError(
          reference
            ? 'We could not open the payment window. If you are inside Instagram, open this page in your browser — your passes are held.'
            : 'We could not reach the server. Check your connection and try again.',
        );
      }
    },
    [busy, holdBooking, checkPaid, finish, router, form, totalPasses],
  );

  const buttonLabel =
    phase === 'booking'
      ? 'Holding your passes…'
      : phase === 'starting-payment'
        ? 'Opening secure checkout…'
        : phase === 'paying'
          ? 'Complete payment in the Razorpay window…'
          : phase === 'verifying'
            ? 'Confirming your payment…'
            : phase === 'redirecting'
              ? 'Paid! Issuing your passes…'
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
          hint="Your account email — the QR passes are sent here and saved to your account."
          value={form.email}
          onChange={set('email')}
          autoComplete="email"
          inputMode="email"
          errors={fieldErrors.email}
          disabled

        />

        <Field
          id="cart-phone"
          label="Mobile number"
          type="tel"
          hint="Any format works — +91, spaces or dashes. Used only if we need to reach you about this order."
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
                {heldReference && phase === 'error' && (
                  <>
                    {' '}
                    <Link href={`/pay/${heldReference}`} className="font-semibold underline">
                      Open payment page
                    </Link>
                  </>
                )}
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
