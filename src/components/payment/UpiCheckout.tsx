'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { cn, formatInr } from '@/lib/utils';
import { formatUtr, isValidUtr, normaliseUtr } from '@/lib/upi';

interface UpiCheckoutProps {
  reference: string;
  amountPaise: number;
  payeeName: string;
  vpa: string;
  /** `upi://pay?…`, built server-side so the amount cannot be tampered with. */
  upiUri: string;
  /** QR of `upiUri`, rendered to a data URL on the server. */
  qrDataUrl: string;
  /** Set when the customer has already filed a UTR for this booking. */
  existingUtr?: string | null;
}

type Phase = 'pay' | 'declare' | 'submitting' | 'pending';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Direct-UPI checkout.
 *
 * Two steps, and the split is the point. Step one is paying: a QR carrying the
 * exact amount, plus the raw VPA and a deep link for people already on a
 * phone. Step two is *declaring* that you paid, which is a different act and
 * is worded as one — the copy never claims the payment has been checked,
 * because it has not been.
 *
 * The QR arrives as a prop rather than being generated here. That keeps a QR
 * library out of the bundle, and more importantly means the amount encoded in
 * the code is the one the server computed: a tampered client cannot render a
 * ₹1 QR and then claim the order is settled.
 */
export function UpiCheckout({
  reference,
  amountPaise,
  payeeName,
  vpa,
  upiUri,
  qrDataUrl,
  existingUtr,
}: UpiCheckoutProps) {
  const router = useRouter();
  const reduce = useReducedMotion();

  const [phase, setPhase] = useState<Phase>(existingUtr ? 'pending' : 'pay');
  const [utr, setUtr] = useState(existingUtr ?? '');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'vpa' | 'amount' | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  /*
   * `upi://` only resolves where a UPI app is installed, so the deep-link
   * button is gated on the device looking like a phone.
   *
   * Two signals, OR'd, because the two failure modes are not symmetric. A
   * false positive shows a desktop user a button that does nothing — mildly
   * annoying, and the QR beside it still works. A false negative strands a
   * phone user with a QR they cannot scan, because you cannot point a phone
   * camera at its own screen. So this errs toward showing the button.
   */
  useEffect(() => {
    const uaLooksMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
    const coarsePointer =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    setIsMobile(uaLooksMobile || coarsePointer);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = useCallback(async (value: string, what: 'vpa' | 'amount') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
    } catch {
      // Clipboard is blocked in insecure contexts and some in-app browsers.
      // The value is on screen and selectable, so this is a silent downgrade.
    }
  }, []);

  const valid = isValidUtr(utr);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!valid || phase === 'submitting') return;

    setPhase('submitting');
    setError(null);

    try {
      const response = await fetch('/api/payments/upi/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, utr: normaliseUtr(utr) }),
      });
      const body = (await response.json()) as { data?: { utr: string }; error?: string };

      if (!response.ok || !body.data) {
        setPhase('declare');
        setError(body.error ?? 'We could not record that reference. Try again in a moment.');
        return;
      }

      setPhase('pending');
      // Pull the server state so a refresh shows the same thing this does.
      router.refresh();
    } catch {
      setPhase('declare');
      setError('Could not reach the server. Check your connection and try again.');
    }
  }

  /* ---------------------------------------------------------------- pending */
  if (phase === 'pending') {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="card-print overflow-hidden"
        aria-live="polite"
      >
        <div className="flex items-center justify-between border-b-[1.5px] border-ink bg-amber-100 px-6 py-3.5">
          <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-amber-800">
            Pending verification
          </p>
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping2 rounded-full bg-amber-500" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-600" />
          </span>
        </div>

        <div className="p-6">
          <h3 className="h-card">We have your reference</h3>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate">
            Someone checks the account and releases your passes — usually within a few hours, and
            always before doors. The QR codes are emailed the moment that happens.
          </p>

          <dl className="mt-6 border-t-2 border-ink">
            <Row label="Booking" value={reference} mono />
            <Row label="UTR you gave us" value={formatUtr(utr)} mono />
            <Row label="Amount" value={formatInr(amountPaise)} />
          </dl>

          <p className="mt-6 rounded-[10px] border-[1.5px] border-ink/25 bg-frost px-4 py-3 text-[0.8125rem] leading-relaxed text-slate">
            Nothing else to do. Do not pay again — if anything looks wrong we will email you rather
            than take a second payment.
          </p>
        </div>
      </motion.div>
    );
  }

  /* ------------------------------------------------------------------- pay */
  return (
    <div className="card-print overflow-hidden">
      <div className="flex items-center justify-between border-b-[1.5px] border-ink bg-vybe-100 px-6 py-3.5">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-ink">
          Pay by UPI
        </p>
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink/60">
          {phase === 'pay' ? 'Step 1 of 2' : 'Step 2 of 2'}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {phase === 'pay' ? (
          <motion.div
            key="scan"
            initial={reduce ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="p-6"
          >
            {/* The amount is the loudest thing on the panel. Under-paying is
                the single most common failure on this rail, and it costs the
                operator a refund and the customer their passes. */}
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-vybe-700">
              Pay exactly
            </p>
            <p className="tnum mt-1 font-display text-[2.75rem] font-bold leading-none tracking-[-0.04em] text-ink">
              {formatInr(amountPaise)}
            </p>

            {/* White quiet zone is not decoration: scanners need ~4 modules of
                margin, and a QR bleeding into a coloured card fails on a real
                share of Android cameras. */}
            <div className="mt-6 flex justify-center">
              <div className="rounded-[14px] border-[1.5px] border-ink bg-white p-4 shadow-press">
                {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL has nothing for next/image to optimise. */}
                <img
                  src={qrDataUrl}
                  alt={`UPI QR code to pay ${formatInr(amountPaise)} to ${payeeName}`}
                  width={232}
                  height={232}
                  className="h-[232px] w-[232px]"
                />
              </div>
            </div>

            <p className="mt-4 text-center text-[0.8125rem] leading-relaxed text-slate">
              {isMobile
                ? 'Scan this from another device, or tap below to pay on this one. The amount and reference are already filled in — do not edit them.'
                : 'Scan with GPay, PhonePe, Paytm or any UPI app. The amount and reference are already filled in — do not edit them.'}
            </p>

            {isMobile && (
              <a href={upiUri} className="btn-primary mt-5 w-full">
                Open my UPI app
              </a>
            )}

            <div className="mt-5 border-t-2 border-ink pt-5">
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-vybe-700">
                Or pay this UPI ID
              </p>
              {/* The VPA gets its own row and wraps rather than truncating:
                  people retype this by hand, and "sh.kavy…" is unusable. */}
              <code className="mt-2 block break-all rounded-[9px] border-[1.5px] border-ink/25 bg-frost px-3 py-2.5 font-mono text-[0.875rem] text-ink">
                {vpa}
              </code>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => copy(vpa, 'vpa')}
                  className="btn-outline btn-sm flex-1"
                >
                  {copied === 'vpa' ? 'Copied' : 'Copy ID'}
                </button>
                <button
                  type="button"
                  onClick={() => copy((amountPaise / 100).toFixed(2), 'amount')}
                  className="btn-outline btn-sm flex-1"
                >
                  {copied === 'amount' ? 'Copied' : 'Copy amount'}
                </button>
              </div>
              <p className="help">
                Paying by ID? Put <strong className="text-ink">{reference}</strong> in the note so we
                can match it.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setPhase('declare')}
              className="btn-dark mt-6 w-full"
            >
              I&apos;ve paid — enter my UTR
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="declare"
            onSubmit={handleSubmit}
            noValidate
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="p-6"
          >
            <h3 className="h-card">Enter your UPI reference</h3>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate">
              Open the payment in your UPI app and look for{' '}
              <strong className="text-ink">UTR</strong>,{' '}
              <strong className="text-ink">RRN</strong> or{' '}
              <strong className="text-ink">UPI transaction ID</strong>. It is 12 digits.
            </p>

            <div className="mt-5">
              <label htmlFor="utr" className="label">
                12-digit UTR
              </label>
              <input
                id="utr"
                value={formatUtr(utr)}
                onChange={(event) => setUtr(normaliseUtr(event.target.value))}
                onBlur={() => setTouched(true)}
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                placeholder="1234 5678 9012"
                aria-describedby="utr-help"
                aria-invalid={touched && !valid}
                className={cn(
                  'field font-mono tracking-[0.16em]',
                  touched && !valid && utr.length > 0 && 'field-error',
                )}
              />
              <p id="utr-help" className="help">
                Numbers only. We use it to find your payment in the account — it is not a password.
              </p>
              {touched && utr.length > 0 && !valid && (
                <p className="error-text">
                  <span aria-hidden>⚠</span>
                  That is {normaliseUtr(utr).length} digits. A UTR is exactly 12.
                </p>
              )}
            </div>

            <div aria-live="assertive" className="min-h-[22px]">
              {error && (
                <p
                  role="alert"
                  className="mt-3 rounded-[10px] border-[1.5px] border-flare-500 bg-flare-200/50 px-4 py-3 text-[0.8125rem] leading-relaxed text-flare-600"
                >
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!valid || phase === 'submitting'}
              className="btn-primary mt-4 w-full"
            >
              {phase === 'submitting' ? 'Sending…' : 'Submit for verification'}
            </button>

            <button
              type="button"
              onClick={() => setPhase('pay')}
              className="btn-quiet mt-2 w-full"
            >
              ← Back to the QR
            </button>

            <p className="mt-4 text-center text-[0.75rem] leading-relaxed text-muted">
              Submitting this does not charge you. It tells us to go and find the payment.
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink/15 py-3">
      <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className={cn('text-right font-medium text-ink', mono && 'font-mono tracking-[0.08em]')}>
        {value}
      </dd>
    </div>
  );
}
