'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { Globe } from '@/components/brand/Globe';
import { SafeDecoration } from '@/components/ui/SafeDecoration';
import { Ticket3D } from '@/components/game/Ticket3D';
import { formatEventDate, formatEventTime, formatInr } from '@/lib/utils';
import { BookingForm, type TierOption } from './BookingForm';

interface BookingExperienceProps {
  eventSlug: string;
  eventName: string;
  eventTagline: string | null;
  startsAt: string;
  doorsAt: string | null;
  venueName: string;
  tiers: TierOption[];
  initialTier?: string;
  maxQuantity: number;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Holds the shared state between the form and the order summary. The form is
 * the source of truth; the summary is a read-only mirror, so the two cannot
 * drift out of sync.
 */
export function BookingExperience(props: BookingExperienceProps) {
  const reduce = useReducedMotion();
  const [selection, setSelection] = useState({
    tierCode: props.initialTier ?? props.tiers[0]?.code ?? '',
    quantity: 1,
  });

  const handleChange = useCallback((next: { tierCode: string; quantity: number }) => {
    setSelection(next);
  }, []);

  const tier = props.tiers.find((t) => t.code === selection.tierCode) ?? null;
  const total = (tier?.pricePaise ?? 0) * selection.quantity;
  const tierName = tier?.name ?? 'General entry';

  const flatPreview = (
    <FlatPass eventName={props.eventName} tierName={tierName} quantity={selection.quantity} />
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
      <div>
        <BookingForm
          eventSlug={props.eventSlug}
          eventName={props.eventName}
          tiers={props.tiers}
          initialTier={props.initialTier}
          maxQuantity={props.maxQuantity}
          onChange={handleChange}
        />
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card card-lit overflow-hidden">
          <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-vybe-950 via-surface to-ink">
            <div aria-hidden className="absolute inset-0 grid-overlay opacity-60" />
            <Globe
              className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 text-flare/[0.09]"
              strokeWidth={1.4}
            />

            {/* The pass the visitor is actually assembling. Boundaried so a 3D
                transform failure degrades to the flat card, not the page. */}
            <div className="absolute inset-0">
              <SafeDecoration label="ticket-3d" fallback={flatPreview}>
                <Ticket3D
                  eventName={props.eventName}
                  tierName={tierName}
                  venue={props.venueName}
                />
              </SafeDecoration>
            </div>

            <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[10px] uppercase tracking-[0.22em] text-dim">
              Live preview
            </p>
          </div>

          <div className="space-y-3 border-t border-hairline p-6 text-[13px]">
            <p className="eyebrow mb-1">Your order</p>
            <p className="font-display text-xl font-bold leading-tight text-chalk">
              {props.eventName}
            </p>
            {props.eventTagline && (
              <p className="!mt-1 text-[13px] text-haze">{props.eventTagline}</p>
            )}

            <div className="divider !my-4" />

            <Row label="Date" value={formatEventDate(props.startsAt)} />
            <Row label="Doors" value={formatEventTime(props.doorsAt ?? props.startsAt)} />
            <Row label="Venue" value={props.venueName} />
            <div className="divider !my-4" />
            <SwapRow label="Ticket" value={tierName} reduce={Boolean(reduce)} />
            <SwapRow
              label="Quantity"
              value={`${selection.quantity} × QR pass`}
              reduce={Boolean(reduce)}
            />
            <SwapRow
              label="Price each"
              value={tier ? (tier.pricePaise === 0 ? 'Free' : formatInr(tier.pricePaise)) : '—'}
              reduce={Boolean(reduce)}
            />
            <div className="divider !my-4" />
            <div className="flex items-baseline justify-between">
              <span className="text-haze">Total</span>
              <span className="text-right">
                {/* Face value is shown struck through so the guest knows what the
                    ticket is normally worth, without implying a charge today. */}
                {total > 0 && (
                  <span className="mr-2 text-[13px] text-dim line-through">{formatInr(total)}</span>
                )}
                <span className="font-display text-xl font-bold text-vybe-200">₹0</span>
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-dim">
              Payments are not enabled yet — nothing is charged today.
            </p>
          </div>
        </div>

        <ul className="mt-5 space-y-2.5 text-[12px] text-haze">
          {[
            'QR pass emailed instantly, one per person',
            'Works offline — screenshot it before you arrive',
            '21+ with government photo ID',
          ].map((line) => (
            <li key={line} className="flex gap-2.5">
              <span aria-hidden className="mt-[3px] text-vybe-400">
                ✦
              </span>
              {line}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-dim">{label}</span>
      <span className="text-right text-chalk">{value}</span>
    </div>
  );
}

/** Same as `Row`, but the value cross-fades when the selection changes. */
function SwapRow({ label, value, reduce }: { label: string; value: string; reduce: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-dim">{label}</span>
      <span className="relative min-w-0 flex-1 text-right">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={value}
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: EASE }}
            className="block truncate text-chalk"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
    </div>
  );
}

/**
 * Flat stand-in for the 3D pass. Shown whenever WebGL is unavailable, so the
 * summary still previews what the visitor is about to receive.
 */
function FlatPass({
  eventName,
  tierName,
  quantity,
}: {
  eventName: string;
  tierName: string;
  quantity: number;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center p-6">
      <div className="w-full max-w-[220px] rounded-2xl border border-hairline bg-elevated/80 p-4 shadow-glow backdrop-blur-md">
        <p className="eyebrow text-[9px]">Entry pass</p>
        <p className="mt-1.5 truncate font-display text-[15px] font-bold text-chalk">{eventName}</p>
        <p className="mt-0.5 truncate text-[11px] text-haze">{tierName}</p>
        <div className="my-3 border-t border-dashed border-hairline" />
        <div className="flex items-end justify-between">
          <span className="text-[10px] uppercase tracking-[0.18em] text-dim">Passes</span>
          <span className="font-display text-lg font-bold tabular-nums text-vybe-200">
            {quantity}
          </span>
        </div>
      </div>
    </div>
  );
}
