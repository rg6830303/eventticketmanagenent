'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { cn, formatInr } from '@/lib/utils';
import {
  loadCashfreeSdk,
  openCashfreeCheckout,
  type CashfreeMode,
} from './cashfree-sdk';

type Phase = 'idle' | 'starting' | 'redirecting' | 'error';

interface Props {
  reference: string;
  amountPaise: number;
  /** Rendered on the button; the server is what actually prices the order. */
  label?: string;
  className?: string;
  /**
   * True when a second rail is on the same page. Changes what a failure says:
   * pointing somebody at the UPI box below is far better than apologising when
   * the thing they need is six inches further down.
   */
  hasUpiFallback?: boolean;
}

/**
 * Cashfree checkout button.
 *
 * The flow is a full-page redirect (`redirectTarget: '_self'`) rather than an
 * in-page modal. On Indian mobile that is the difference between a UPI intent
 * that opens the customer's payment app and one that dies inside an iframe, and
 * the return URL brings them back to a server-verified confirmation either way.
 *
 * Nothing here decides whether a payment succeeded. The button's whole job is
 * to reach Cashfree; `/api/payments/cashfree/return` re-reads the order from
 * Cashfree's API and that is what issues the passes.
 */
export function CashfreeCheckout({
  reference,
  amountPaise,
  label,
  className,
  hasUpiFallback = false,
}: Props) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  // Warm the SDK up front. By the time anyone has read the order summary and
  // reached for the button, checkout opens instantly instead of after a
  // network round trip.
  useEffect(() => {
    loadCashfreeSdk().catch(() => {
      /* Reported on click instead — a silent prefetch failure is not worth an alert. */
    });
  }, []);

  const pay = useCallback(async () => {
    setError(null);
    setPhase('starting');

    try {
      const [, response] = await Promise.all([
        loadCashfreeSdk(),
        fetch('/api/payments/cashfree/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference }),
        }),
      ]);

      const body = (await response.json()) as {
        data?: {
          alreadyPaid?: boolean;
          reference?: string;
          paymentSessionId?: string;
          mode?: CashfreeMode;
        };
        error?: string;
      };

      if (!response.ok || !body.data) {
        setPhase('error');
        const serverText = body.error ?? 'We could not start the payment. Try again in a moment.';
        setError(
          hasUpiFallback && response.status === 503
            ? 'Card payment is unavailable right now — nothing has been charged. ' +
              'Use the UPI option just below instead; it works and your passes are still held.'
            : serverText,
        );
        return;
      }

      // A previous attempt settled while this tab was idle. Never open a second
      // checkout for money that has already been taken.
      if (body.data.alreadyPaid) {
        setPhase('redirecting');
        router.replace(`/booking/${body.data.reference ?? reference}?paid=1`);
        return;
      }

      const { paymentSessionId, mode } = body.data;
      if (!paymentSessionId) throw new Error('checkout unavailable');

      setPhase('redirecting');

      // Reached only when the SDK refuses to leave the page — a successful
      // redirect never returns.
      const opened = await openCashfreeCheckout(paymentSessionId, mode ?? 'production');
      if (!opened.ok) {
        setPhase('error');
        setError(opened.message);
      }
    } catch {
      setPhase('error');
      setError('We could not open the payment window. Check your connection and try again.');
    }
  }, [reference, router, hasUpiFallback]);

  const busy = phase === 'starting' || phase === 'redirecting';

  const buttonLabel =
    phase === 'starting'
      ? 'Starting secure checkout…'
      : phase === 'redirecting'
        ? 'Taking you to payment…'
        : (label ?? `Pay ${formatInr(amountPaise)}`);

  return (
    <div>
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className={cn('btn-primary relative w-full overflow-hidden py-[18px] text-base', className)}
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
            transition={{ duration: 0.2 }}
            className="relative flex items-center justify-center gap-2"
          >
            {!busy && <LockIcon />}
            {buttonLabel}
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
        Payment is handled by Cashfree. Card, UPI and net-banking details are entered on their
        secure page and never reach our servers.
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
