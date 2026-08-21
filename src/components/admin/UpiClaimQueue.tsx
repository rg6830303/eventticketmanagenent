'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { formatInr, formatDateTime, cn } from '@/lib/utils';
import { formatUtr } from '@/lib/upi';

export interface UpiClaimItem {
  id: string;
  utr: string;
  amountPaise: number;
  createdAt: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  quantity: number;
  eventName: string;
  bookingAmountPaise: number;
}

/**
 * The queue an operator works through with their banking app open.
 *
 * Every row states the two things that decide the call — the UTR to search for
 * and the exact amount to match — and nothing else competes with them. Approve
 * mints and emails the passes; reject hands the booking back so the customer
 * can pay again.
 *
 * A short-paid claim is flagged rather than blocked: partial payments happen,
 * and the operator is better placed than a rule to decide whether to let one
 * through.
 */
export function UpiClaimQueue({ claims }: { claims: UpiClaimItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function review(id: string, action: 'approve' | 'reject') {
    if (busy) return;
    if (action === 'reject' && !window.confirm('Reject this claim? The booking becomes payable again.')) {
      return;
    }
    setBusy(id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/upi-claims/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json()) as {
        data?: { status: string; emailSent?: boolean };
        error?: string;
      };

      if (!response.ok || !body.data) {
        setError(body.error ?? 'That did not go through. Try again.');
        setBusy(null);
        return;
      }

      setDone((current) => ({
        ...current,
        [id]:
          body.data!.status === 'approved'
            ? body.data!.emailSent
              ? 'Passes issued and emailed'
              : 'Passes issued — email failed, resend from the booking'
            : 'Rejected',
      }));
      setBusy(null);
      router.refresh();
    } catch {
      setError('Could not reach the server.');
      setBusy(null);
    }
  }

  if (claims.length === 0) {
    return (
      <div className="card-print p-8 text-center">
        <p className="h-card">Nothing waiting</p>
        <p className="mt-2 text-[0.875rem] text-slate">
          UPI payments customers have declared show up here for you to confirm.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-[10px] border-[1.5px] border-flare-500 bg-flare-200/50 px-4 py-3 text-[0.8125rem] font-medium text-flare-600"
        >
          {error}
        </p>
      )}

      <ul className="space-y-4">
        {claims.map((claim) => {
          const settled = done[claim.id];
          const short = claim.amountPaise < claim.bookingAmountPaise;

          return (
            <li key={claim.id}>
              <div className="card-print overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] border-ink bg-vybe-100 px-5 py-3">
                  <Link
                    href={`/booking/${claim.reference}`}
                    className="font-mono text-[0.8125rem] font-medium tracking-[0.08em] text-ink underline-offset-4 hover:underline"
                  >
                    {claim.reference}
                  </Link>
                  <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink/60">
                    {formatDateTime(claim.createdAt)}
                  </span>
                </div>

                <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-vybe-700">
                        Search this UTR
                      </p>
                      <p className="tnum font-mono text-[1.25rem] font-medium tracking-[0.12em] text-ink">
                        {formatUtr(claim.utr)}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[0.875rem]">
                      <span className="tnum font-display text-[1.375rem] font-semibold text-ink">
                        {formatInr(claim.amountPaise)}
                      </span>
                      {short && (
                        <span className="chip chip-hot">
                          Booking is {formatInr(claim.bookingAmountPaise)}
                        </span>
                      )}
                      <span className="text-slate">
                        {claim.customerName} · {claim.quantity} × pass
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[0.8125rem] text-muted">
                      {claim.customerEmail} · {claim.eventName}
                    </p>
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                    {settled ? (
                      <motion.p
                        key="settled"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                          'rounded-[10px] border-[1.5px] px-4 py-2.5 text-[0.8125rem] font-medium',
                          settled === 'Rejected'
                            ? 'border-flare-500 bg-flare-200/50 text-flare-600'
                            : 'border-leaf-500 bg-leaf-100 text-leaf-600',
                        )}
                      >
                        {settled}
                      </motion.p>
                    ) : (
                      <motion.div key="actions" className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => review(claim.id, 'reject')}
                          disabled={busy === claim.id}
                          className="btn-outline btn-sm"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => review(claim.id, 'approve')}
                          disabled={busy === claim.id}
                          className="btn-primary btn-sm"
                        >
                          {busy === claim.id ? 'Working…' : 'Money received'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
