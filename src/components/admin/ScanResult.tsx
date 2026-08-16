'use client';

import { cn, formatDateTime } from '@/lib/utils';
import type { ScanOutcome, ScanResult as ScanResultCode } from '@/lib/types';

/** Verdict → visual treatment. Blue means go; amber means stop and talk; red means refuse. */
const TONE: Record<ScanResultCode, { ring: string; text: string; chip: string; verdict: string }> = {
  admitted: {
    ring: 'border-vybe-400/70 bg-vybe-500/12',
    text: 'text-vybe-200',
    chip: 'bg-vybe-500 text-white',
    verdict: 'ADMITTED',
  },
  duplicate: {
    ring: 'border-amber-400/60 bg-amber-400/10',
    text: 'text-amber-200',
    chip: 'bg-amber-400 text-black',
    verdict: 'ALREADY USED',
  },
  wrong_event: {
    ring: 'border-amber-400/60 bg-amber-400/10',
    text: 'text-amber-200',
    chip: 'bg-amber-400 text-black',
    verdict: 'WRONG EVENT',
  },
  void: {
    ring: 'border-amber-400/60 bg-amber-400/10',
    text: 'text-amber-200',
    chip: 'bg-amber-400 text-black',
    verdict: 'CANCELLED',
  },
  refunded: {
    ring: 'border-amber-400/60 bg-amber-400/10',
    text: 'text-amber-200',
    chip: 'bg-amber-400 text-black',
    verdict: 'REFUNDED',
  },
  invalid_signature: {
    ring: 'border-red-500/60 bg-red-500/10',
    text: 'text-red-200',
    chip: 'bg-red-500 text-white',
    verdict: 'INVALID',
  },
  not_found: {
    ring: 'border-red-500/60 bg-red-500/10',
    text: 'text-red-200',
    chip: 'bg-red-500 text-white',
    verdict: 'NOT FOUND',
  },
};

export function ScanResult({ outcome, mode }: { outcome: ScanOutcome | null; mode: 'check' | 'admit' }) {
  if (!outcome) {
    return (
      <div className="card flex min-h-[190px] flex-col items-center justify-center p-6 text-center">
        <p className="font-display text-lg font-semibold text-haze">Ready to scan</p>
        <p className="mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-dim">
          Hold the guest&apos;s QR inside the frame. The result appears here.
        </p>
      </div>
    );
  }

  const tone = TONE[outcome.result];
  // In preview mode nothing was consumed, so "ADMITTED" would be a lie.
  const verdict = outcome.ok && mode === 'check' ? 'VALID' : tone.verdict;
  const ticket = outcome.ticket;

  return (
    <div
      role="status"
      aria-live="assertive"
      className={cn('card border-2 p-5 transition-colors sm:p-6', tone.ring)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn('font-display text-3xl font-extrabold leading-none sm:text-4xl', tone.text)}>
            {verdict}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-haze">{outcome.message}</p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider',
            tone.chip,
          )}
        >
          {mode === 'check' ? 'preview' : 'live'}
        </span>
      </div>

      {ticket && (
        <div className="mt-5 space-y-3 border-t border-hairline pt-4">
          {/* Sized to be readable at arm's length while the guest holds the phone. */}
          <p className="font-display text-2xl font-bold leading-tight text-chalk">
            {ticket.holderName}
          </p>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
            <Row label="Ticket" value={ticket.code} mono />
            <Row label="Booking" value={ticket.bookingReference} mono />
            {ticket.tierName && <Row label="Tier" value={ticket.tierName} />}
            {ticket.seatLabel && <Row label="Pass" value={ticket.seatLabel} mono />}
            {ticket.quantity > 1 && (
              <Row label="In booking" value={`${ticket.quantity} tickets`} />
            )}
            {outcome.event && <Row label="Event" value={outcome.event.name} />}
          </dl>

          {outcome.result === 'duplicate' && ticket.checkedInAt && (
            <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-[12px] font-medium text-amber-200">
              First scanned {formatDateTime(ticket.checkedInAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-dim">{label}</dt>
      <dd className={cn('mt-0.5 text-chalk', mono && 'font-mono text-[12px] tracking-tight')}>
        {value}
      </dd>
    </div>
  );
}
