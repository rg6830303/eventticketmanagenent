'use client';

import { useRef } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type MotionProps,
  type Transition,
} from 'framer-motion';
import { Globe } from '@/components/brand/Globe';
import { cn, formatDateTime } from '@/lib/utils';
import type { ScanOutcome, ScanResult as ScanResultCode } from '@/lib/types';

type Tone = 'go' | 'hold' | 'stop';

/** Verdict → visual treatment. Green means go; amber means stop and talk; red means refuse. */
const TONE: Record<ScanResultCode, { tone: Tone; verdict: string }> = {
  admitted: { tone: 'go', verdict: 'ADMITTED' },
  duplicate: { tone: 'hold', verdict: 'ALREADY USED' },
  wrong_event: { tone: 'hold', verdict: 'WRONG EVENT' },
  void: { tone: 'hold', verdict: 'CANCELLED' },
  refunded: { tone: 'hold', verdict: 'REFUNDED' },
  invalid_signature: { tone: 'stop', verdict: 'INVALID' },
  not_found: { tone: 'stop', verdict: 'NOT FOUND' },
};

const SKIN: Record<Tone, { shell: string; text: string; chip: string; flash: string; note: string }> = {
  go: {
    shell: 'border-leaf-400 bg-leaf-100',
    text: 'text-leaf-600',
    chip: 'bg-leaf-500 text-white',
    flash: 'bg-leaf-400',
    note: 'bg-leaf-100 text-leaf-600',
  },
  hold: {
    shell: 'border-amber-400/70 bg-amber-400/[0.12]',
    text: 'text-amber-700',
    chip: 'bg-amber-400 text-black',
    flash: 'bg-amber-300',
    note: 'bg-amber-400/10 text-amber-700',
  },
  stop: {
    shell: 'border-flare-500/70 bg-flare-500/[0.12]',
    text: 'text-flare-600',
    chip: 'bg-flare-500 text-white',
    flash: 'bg-flare-400',
    note: 'bg-flare-500/10 text-flare-600',
  },
};

const SPRING: Transition = { type: 'spring', stiffness: 460, damping: 24, mass: 0.7 };

type Entrance = Required<Pick<MotionProps, 'initial' | 'animate' | 'exit' | 'transition'>>;

export function ScanResult({ outcome, mode }: { outcome: ScanOutcome | null; mode: 'check' | 'admit' }) {
  const reduce = useReducedMotion();

  // A guest can present the same failing pass twice in a row. Keying off the
  // outcome's identity rather than its contents makes every scan re-animate, so
  // the second attempt still visibly resolves.
  const seenRef = useRef<ScanOutcome | null>(null);
  const nonceRef = useRef(0);
  if (outcome !== seenRef.current) {
    seenRef.current = outcome;
    nonceRef.current += 1;
  }

  const meta = outcome ? TONE[outcome.result] : null;
  const skin = meta ? SKIN[meta.tone] : null;
  // In preview mode nothing was consumed, so "ADMITTED" would be a lie.
  const verdict = outcome && meta ? (outcome.ok && mode === 'check' ? 'VALID' : meta.verdict) : '';
  const ticket = outcome?.ticket;

  const entrance = (tone: Tone): Entrance => {
    if (reduce) {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      };
    }
    if (tone === 'go') {
      return {
        initial: { opacity: 0, scale: 0.9, y: 10 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.98 },
        transition: SPRING,
      };
    }
    // A refusal should feel like a refusal: the card physically recoils.
    const travel = tone === 'stop' ? [0, -16, 13, -8, 5, 0] : [0, -10, 8, -4, 0];
    return {
      initial: { opacity: 0, scale: 0.97 },
      animate: { opacity: 1, scale: 1, x: travel },
      exit: { opacity: 0, scale: 0.98 },
      transition: { duration: tone === 'stop' ? 0.5 : 0.4, ease: 'easeOut' },
    };
  };

  return (
    <div role="status" aria-live="assertive" aria-atomic="true">
      <AnimatePresence mode="wait" initial={false}>
        {!outcome || !meta || !skin ? (
          <motion.div
            key="idle"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            // Short on purpose: a verdict must never wait on an idle card fading.
            transition={{ duration: 0.14 }}
            className="panel flex min-h-[220px] flex-col items-center justify-center p-6 text-center"
          >
            <Globe
              spin
              strokeWidth={2}
              className="h-14 w-14 text-vybe-500/25 [animation-duration:14s]"
            />
            <p className="mt-4 font-display text-lg font-semibold text-slate">Ready to scan</p>
            <p className="mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-muted">
              Hold the guest&apos;s QR inside the frame. The verdict appears here.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={nonceRef.current}
            {...entrance(meta.tone)}
            className={cn('panel relative border-2 p-5 sm:p-6', skin.shell)}
          >
            {/* One-shot wash of the verdict colour. Reads as "resolved" from across
                a dark doorway, before anyone has parsed the words. */}
            {!reduce && (
              <motion.span
                aria-hidden
                className={cn('pointer-events-none absolute inset-0', skin.flash)}
                initial={{ opacity: 0.4 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
              />
            )}

            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <Verdict tone={meta.tone} className={cn('h-9 w-9 shrink-0 sm:h-11 sm:w-11', skin.text)} />
                  <p
                    className={cn(
                      'font-display font-extrabold uppercase leading-[0.9] tracking-tight',
                      'text-[42px] sm:text-6xl',
                      skin.text,
                    )}
                  >
                    {verdict}
                  </p>
                </div>
                <p className="mt-3 text-[14px] leading-relaxed text-slate">{outcome.message}</p>
              </div>

              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider',
                  skin.chip,
                )}
              >
                {mode === 'check' ? 'preview' : 'live'}
              </span>
            </div>

            {ticket && (
              <div className="relative mt-5 space-y-3 border-t border-edge pt-4">
                {/* Sized to be readable at arm's length while the guest holds the phone. */}
                <p className="font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">
                  {ticket.holderName}
                </p>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
                  <Row label="Ticket" value={ticket.code} mono />
                  <Row label="Booking" value={ticket.bookingReference} mono />
                  {ticket.tierName && <Row label="Tier" value={ticket.tierName} />}
                  {ticket.seatLabel && <Row label="Pass" value={ticket.seatLabel} mono />}
                  {ticket.quantity > 1 && <Row label="In booking" value={`${ticket.quantity} tickets`} />}
                  {outcome.event && <Row label="Event" value={outcome.event.name} />}
                </dl>

                {outcome.result === 'duplicate' && ticket.checkedInAt && (
                  <p className={cn('rounded-lg px-3 py-2 text-[13px] font-medium', skin.note)}>
                    First scanned {formatDateTime(ticket.checkedInAt)}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** One glyph per tone. Shape carries the verdict even before colour registers. */
function Verdict({ tone, className }: { tone: Tone; className?: string }) {
  if (tone === 'go') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className} aria-hidden>
        <circle cx="12" cy="12" r="9.5" strokeWidth="1.6" opacity="0.5" />
        <path d="m7.5 12.4 3.2 3.2 6-6.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === 'hold') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className} aria-hidden>
        <path d="M12 3.2 22 20H2Z" strokeWidth="1.8" strokeLinejoin="round" opacity="0.6" />
        <path d="M12 9.5v4.6" strokeLinecap="round" />
        <circle cx="12" cy="17.1" r="1.15" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9.5" strokeWidth="1.6" opacity="0.5" />
      <path d="m8.4 8.4 7.2 7.2M15.6 8.4l-7.2 7.2" strokeLinecap="round" />
    </svg>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className={cn('mt-0.5 text-ink', mono && 'font-mono text-[12px] tracking-tight')}>
        {value}
      </dd>
    </div>
  );
}
