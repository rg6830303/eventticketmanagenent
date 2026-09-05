'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn, formatInr } from '@/lib/utils';

/* Minimal shape of the global the Razorpay script installs. */
interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: string, handler: (payload: unknown) => void) => void;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/**
 * Loads checkout.js once per page, no matter how many times the customer
 * retries. A second <script> tag for the same src re-registers the global and
 * has been known to leave two modals stacked on top of each other.
 */
let checkoutPromise: Promise<void> | null = null;

function loadCheckout(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.Razorpay) return Promise.resolve();
  if (checkoutPromise) return checkoutPromise;

  checkoutPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    const script = existing ?? document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => {
      // Let a later attempt try again rather than caching the failure forever —
      // this fails on flaky mobile data far more often than for any real reason.
      checkoutPromise = null;
      reject(new Error('Could not load the payment window'));
    });
    if (!existing) document.body.appendChild(script);
  });

  return checkoutPromise;
}

type Phase = 'idle' | 'opening' | 'open' | 'verifying' | 'done' | 'error';

interface Props {
  reference: string;
  amountPaise: number;
  eventName: string;
  tierName: string;
  quantity: number;
  customer: { name: string; email: string; phone: string };
}

export function RazorpayCheckout({
  reference,
  amountPaise,
  eventName,
  tierName,
  quantity,
  customer,
}: Props) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const instance = useRef<RazorpayInstance | null>(null);
  const watcher = useRef<{ timer: ReturnType<typeof setInterval> | null; onVisible: (() => void) | null }>(
    { timer: null, onVisible: null },
  );

  const stopWatching = useCallback(() => {
    if (watcher.current.timer) clearInterval(watcher.current.timer);
    if (watcher.current.onVisible) {
      document.removeEventListener('visibilitychange', watcher.current.onVisible);
    }
    watcher.current = { timer: null, onVisible: null };
  }, []);

  /**
   * Ask the server whether this booking has been paid.
   *
   * The server does not take our word for it — it asks Razorpay's API about the
   * order. This is only a nudge to look.
   */
  const checkPaid = useCallback(async () => {
    try {
      const response = await fetch(`/api/bookings/${reference}/claim`, { method: 'POST' });
      const body = (await response.json()) as { data?: { status?: string } };
      if (body.data?.status === 'confirmed') {
        stopWatching();
        setPhase('done');
        router.replace(`/booking/${reference}?paid=1`);
        return true;
      }
    } catch {
      /* Offline or mid-redirect; the next tick tries again. */
    }
    return false;
  }, [reference, router, stopWatching]);

  /**
   * Watch for the payment landing without us being told.
   *
   * Razorpay's `handler` callback fires in this page, and on a phone that is a
   * fragile place to keep the only copy of "they paid". Paying by UPI sends the
   * browser to the background to open GPay or PhonePe, and an in-app webview —
   * Instagram's above all, which is where most of this traffic arrives from —
   * is routinely evicted while it waits there. The customer pays, returns to a
   * page that has been reloaded out from under the callback, and nothing tells
   * the server anything.
   *
   * So we poll, and we check the instant the tab is looked at again, which is
   * the exact moment somebody comes back from their UPI app. Whichever notices
   * first wins; the server ignores a second confirmation.
   */
  const startWatching = useCallback(() => {
    stopWatching();
    const deadline = Date.now() + 8 * 60 * 1000;

    watcher.current.timer = setInterval(() => {
      if (Date.now() > deadline) {
        stopWatching();
        return;
      }
      void checkPaid();
    }, 5000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkPaid();
    };
    document.addEventListener('visibilitychange', onVisible);
    watcher.current.onVisible = onVisible;
  }, [checkPaid, stopWatching]);

  // Warm the script up front. By the time anyone has read the summary and
  // reached for the button, the modal opens instantly instead of after a
  // network round trip.
  useEffect(() => {
    loadCheckout().catch(() => {
      /* Reported on click instead — a silent prefetch failure is not worth an alert. */
    });
    return () => {
      instance.current?.close();
      stopWatching();
    };
  }, [stopWatching]);

  /**
   * Watch from the moment this page exists, not from the moment Pay is pressed.
   *
   * Someone can arrive here having *already* paid: their webview was evicted
   * while they were in their UPI app, and coming back reloaded the page with a
   * fresh, un-clicked Pay button. The server checks the gateway before
   * rendering, which catches almost all of these, but the payment can also land
   * in the seconds after that check — while this page sits open in front of
   * them. So the tab regaining focus is always worth a question, for the whole
   * time the page is open.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkPaid();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [checkPaid]);

  const verify = useCallback(
    async (payload: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => {
      setPhase('verifying');
      stopWatching();
      try {
        const response = await fetch('/api/payments/razorpay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = (await response.json()) as { data?: { reference: string }; error?: string };

        if (!response.ok || !body.data) {
          // The money may well have left the account — never tell someone the
          // payment failed when only our confirmation did.
          // The money has very likely left their account, so do not stop here.
          // Watching asks the server to check with Razorpay directly, which
          // usually resolves this within seconds and without anyone paying twice.
          startWatching();
          setPhase('error');
          setError(
            body.error ??
              'Your payment went through but we could not confirm it here. Do not pay again — we are still checking, and your passes will arrive by email.',
          );
          return;
        }

        setPhase('done');
        router.replace(`/booking/${body.data.reference}?paid=1`);
      } catch {
        startWatching();
        setPhase('error');
        setError(
          'Your payment may have gone through. Do not pay again — we are still checking, and your passes will arrive by email.',
        );
      }
    },
    [router, stopWatching, startWatching],
  );

  const pay = useCallback(async () => {
    setError(null);
    setPhase('opening');

    try {
      await loadCheckout();

      const orderResponse = await fetch('/api/payments/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });
      const orderBody = (await orderResponse.json()) as {
        data?: { orderId: string; amount: number; currency: string; keyId: string };
        error?: string;
      };

      if (!orderResponse.ok || !orderBody.data) {
        setPhase('error');
        setError(orderBody.error ?? 'We could not start the payment. Try again in a moment.');
        return;
      }

      const { orderId, amount, currency, keyId } = orderBody.data;
      const Razorpay = window.Razorpay;
      if (!Razorpay) throw new Error('checkout unavailable');

      const rzp = new Razorpay({
        key: keyId,
        order_id: orderId,
        amount,
        currency,
        name: 'Houz of Vybe',
        description: `${eventName} · ${quantity} × ${tierName}`,
        prefill: {
          name: customer.name,
          email: customer.email,
          contact: `+91${customer.phone}`,
        },
        notes: { reference },
        theme: { color: '#2586ef', backdrop_color: '#0a2138' },
        retry: { enabled: false },
        handler: (response: unknown) => {
          const payload = response as {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          };
          void verify(payload);
        },
        modal: {
          confirm_close: true,
          ondismiss: () => {
            // Closing the modal is not an error, and it is not proof they did
            // not pay — plenty of people finish in their UPI app and shut this
            // window on the way back. The booking is still held, and the
            // watcher keeps checking.
            setPhase((current) => (current === 'verifying' ? current : 'idle'));
          },
        },
      });

      rzp.on('payment.failed', (payload: unknown) => {
        const detail = payload as { error?: { description?: string; reason?: string } };
        setPhase('error');
        setError(
          detail.error?.description ??
            'The payment did not go through. Nothing has been charged — try again or use another method.',
        );
      });

      instance.current = rzp;
      setPhase('open');
      rzp.open();

      // From here the payment may complete somewhere we cannot see — in a UPI
      // app, after this webview has been evicted. Start watching now rather
      // than trusting the callback to be the thing that tells us.
      startWatching();
    } catch {
      setPhase('error');
      setError('We could not open the payment window. Check your connection and try again.');
    }
  }, [reference, eventName, tierName, quantity, customer, verify, startWatching]);

  const busy = phase === 'opening' || phase === 'verifying' || phase === 'done';

  const label =
    phase === 'opening'
      ? 'Opening secure checkout…'
      : phase === 'verifying'
        ? 'Confirming your payment…'
        : phase === 'done'
          ? 'Paid. Issuing your passes…'
          : `Pay ${formatInr(amountPaise)}`;

  return (
    <div>
      <button
        type="button"
        onClick={pay}
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
            key={label}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="relative flex items-center gap-2"
          >
            {!busy && <LockIcon />}
            {label}
          </motion.span>
        </AnimatePresence>
      </button>

      <div aria-live="assertive" className="min-h-[22px]">
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
        Payment is handled by Razorpay. Card and UPI details are entered on their window and never
        reach our servers.
      </p>
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
