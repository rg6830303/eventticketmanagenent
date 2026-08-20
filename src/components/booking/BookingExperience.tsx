'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { SafeDecoration } from '@/components/ui/SafeDecoration';
import { Ticket3D } from '@/components/game/Ticket3D';
import { formatEventDate, formatEventTime, formatInr } from '@/lib/utils';
import { EVENT } from '@/content/site';
import { BookingForm, type ReferralState, type TierOption } from './BookingForm';

interface BookingExperienceProps {
  eventSlug: string;
  eventName: string;
  eventTagline: string | null;
  startsAt: string;
  doorsAt: string | null;
  venueName: string;
  tiers: TierOption[];
  initialTier?: string;
  initialReferral?: string;
  maxQuantity: number;
  paymentsEnabled: boolean;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Holds the state shared between the form and the running total. The form owns
 * it; the summary is a read-only mirror, so the number under the button and the
 * number in the summary cannot disagree.
 */
export function BookingExperience(props: BookingExperienceProps) {
  const reduce = useReducedMotion();
  const [selection, setSelection] = useState<{
    tierCode: string;
    quantity: number;
    referral: ReferralState;
  }>({
    tierCode: props.initialTier ?? props.tiers[0]?.code ?? '',
    quantity: 1,
    referral: { code: '', discountPaise: 0, status: 'empty', message: null },
  });

  const handleChange = useCallback(
    (next: { tierCode: string; quantity: number; referral: ReferralState }) => {
      setSelection(next);
    },
    [],
  );

  const tier = props.tiers.find((t) => t.code === selection.tierCode) ?? null;
  const tierName = tier?.name ?? 'General entry';
  const subtotal = (tier?.pricePaise ?? 0) * selection.quantity;
  const discount =
    selection.referral.status === 'valid'
      ? Math.min(selection.referral.discountPaise, subtotal)
      : 0;
  const total = Math.max(0, subtotal - discount);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_368px] lg:gap-14">
      <div className="min-w-0">
        <BookingForm
          eventSlug={props.eventSlug}
          eventName={props.eventName}
          tiers={props.tiers}
          initialTier={props.initialTier}
          initialReferral={props.initialReferral}
          maxQuantity={props.maxQuantity}
          paymentsEnabled={props.paymentsEnabled}
          onChange={handleChange}
        />
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        {/* The summary is set as a till receipt: header band, dashed rules,
            mono figures. A receipt is the one artefact everyone already reads
            as "what am I being charged", which beats any card layout at the
            same job. */}
        <div className="card-print overflow-hidden">
          <div className="border-b-[1.5px] border-ink bg-vybe-100 px-6 py-4">
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-ink">
                Order summary
              </p>
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink/60">
                Step 1 / 2
              </p>
            </div>
            <p className="h-card mt-2">
              {EVENT.name} <span className="accent text-vybe-600">{EVENT.edition}</span>
            </p>
            <p className="mt-1 text-[0.8125rem] text-slate">
              {formatEventDate(props.startsAt)} · {formatEventTime(props.doorsAt ?? props.startsAt)}
            </p>
          </div>

          <div className="space-y-3.5 px-6 py-5 text-[0.875rem]">
            <Row label="Venue" value={props.venueName} />
            <SwapRow label="Ticket" value={tierName} reduce={Boolean(reduce)} />
            <SwapRow
              label="Passes"
              value={`${selection.quantity} × QR`}
              reduce={Boolean(reduce)}
            />
            <SwapRow
              label="Price each"
              value={tier ? (tier.pricePaise === 0 ? 'Free' : formatInr(tier.pricePaise)) : '—'}
              reduce={Boolean(reduce)}
            />

            <div className="rule-receipt my-4" />

            <Row label="Subtotal" value={subtotal === 0 ? '₹0' : formatInr(subtotal)} />

            <AnimatePresence initial={false}>
              {discount > 0 && (
                <motion.div
                  key="discount"
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: reduce ? 0 : 0.28, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="flex items-baseline justify-between gap-4 py-0.5">
                    <span className="font-medium text-leaf-600">
                      Code {selection.referral.code}
                    </span>
                    <span className="tnum font-semibold text-leaf-600">
                      − {formatInr(discount)}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="rule-receipt my-4" />

            <div className="flex items-baseline justify-between gap-4">
              <span className="font-semibold text-ink">
                {props.paymentsEnabled ? 'Total payable' : 'Total'}
              </span>
              <span className="text-right">
                {discount > 0 && (
                  <span className="tnum mr-2 text-[0.8125rem] text-muted line-through">
                    {formatInr(subtotal)}
                  </span>
                )}
                <AnimatedTotal value={total} reduce={Boolean(reduce)} />
              </span>
            </div>

            <p className="text-[0.75rem] leading-relaxed text-muted">
              {props.paymentsEnabled
                ? 'Paid securely through Razorpay on the next step. Nothing is charged until you confirm there.'
                : 'Online payment is not switched on, so nothing is charged. Your passes are issued straight away.'}
            </p>
          </div>
        </div>

        {/* The pass being assembled. Boundaried so a 3D transform failure on an
            old browser costs the preview, not the checkout. */}
        <div className="mt-6 hidden justify-center lg:flex">
          <SafeDecoration label="ticket-3d">
            <Ticket3D
              eventName={`${EVENT.name}`}
              tierName={tierName}
              venue={props.venueName}
              date={formatEventTime(props.doorsAt ?? props.startsAt)}
              className="max-w-[300px]"
            />
          </SafeDecoration>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-slate">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

/** Same as `Row`, but the value cross-fades when the selection changes. */
function SwapRow({ label, value, reduce }: { label: string; value: string; reduce: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-slate">{label}</span>
      <span className="relative min-w-0 flex-1 text-right">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={value}
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduce ? 0 : 0.2, ease: EASE }}
            className="block truncate font-medium text-ink"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
    </div>
  );
}

function AnimatedTotal({ value, reduce }: { value: number; reduce: boolean }) {
  return (
    <span className="relative inline-block align-baseline">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={value}
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: reduce ? 0 : 0.24, ease: EASE }}
          className="tnum inline-block font-display text-2xl font-bold text-ink"
        >
          {value === 0 ? '₹0' : formatInr(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
