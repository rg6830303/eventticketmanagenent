'use client';

import { useCallback, useState } from 'react';
import { TiltCard, TiltLayer } from '@/components/ui/TiltCard';
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

/**
 * Holds the shared state between the form and the order summary. The form is
 * the source of truth; the summary is a read-only mirror, so the two cannot
 * drift out of sync.
 */
export function BookingExperience(props: BookingExperienceProps) {
  const [selection, setSelection] = useState({
    tierCode: props.initialTier ?? props.tiers[0]?.code ?? '',
    quantity: 1,
  });

  const handleChange = useCallback((next: { tierCode: string; quantity: number }) => {
    setSelection(next);
  }, []);

  const tier = props.tiers.find((t) => t.code === selection.tierCode) ?? null;
  const total = (tier?.pricePaise ?? 0) * selection.quantity;

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
        <TiltCard intensity={7} className="group">
          <div className="card card-lit overflow-hidden">
            <div className="relative bg-gradient-to-br from-vybe-900/80 via-surface to-ink p-6">
              <div aria-hidden className="absolute inset-0 grid-overlay opacity-60" />
              <TiltLayer z={30} className="relative">
                <p className="eyebrow mb-2">Your order</p>
                <p className="font-display text-2xl font-bold leading-tight text-chalk">
                  {props.eventName}
                </p>
                {props.eventTagline && (
                  <p className="mt-1 text-[13px] text-haze">{props.eventTagline}</p>
                )}
              </TiltLayer>
            </div>

            <div className="space-y-3 p-6 text-[13px]">
              <Row label="Date" value={formatEventDate(props.startsAt)} />
              <Row label="Doors" value={formatEventTime(props.doorsAt ?? props.startsAt)} />
              <Row label="Venue" value={props.venueName} />
              <div className="divider my-4" />
              <Row label="Ticket" value={tier?.name ?? '—'} />
              <Row label="Quantity" value={String(selection.quantity)} />
              <Row
                label="Price each"
                value={tier ? (tier.pricePaise === 0 ? 'Free' : formatInr(tier.pricePaise)) : '—'}
              />
              <div className="divider my-4" />
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
        </TiltCard>

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
