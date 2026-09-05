'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { cn, formatInr } from '@/lib/utils';

export interface PriceTier {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_paise: number;
  redeemable_paise: number;
  admits: number;
  price_unit: string;
  active: boolean;
  sold: number;
  confirmed: number;
  pending: number;
}

interface Draft {
  name: string;
  priceRupees: string;
  coverRupees: string;
  admits: string;
  priceUnit: string;
  description: string;
}

/**
 * Ticket prices.
 *
 * Editing here is the only place prices are set: the storefront, the cart and
 * every future booking read the same rows. What it deliberately cannot do is
 * rewrite history — `booking_items` snapshots the price and admit count at
 * purchase, so somebody who paid ₹1,111 keeps a receipt saying ₹1,111 however
 * often the tier is repriced afterwards.
 *
 * That is why the sold counts are shown beside each row. Repricing a pass that
 * ninety people have already bought is a different decision from repricing one
 * nobody has touched, and the number should be in front of you when you make it.
 */
export function PriceEditor({ initialTiers }: { initialTiers: PriceTier[] }) {
  const reduce = useReducedMotion();
  const [tiers, setTiers] = useState(initialTiers);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch('/api/admin/prices', { cache: 'no-store' });
    const body = (await response.json()) as { data?: { tiers: PriceTier[] } };
    if (body.data) setTiers(body.data.tiers);
  }, []);

  function startEdit(tier: PriceTier) {
    setError(null);
    setNotice(null);
    setEditing(tier.code);
    setDraft({
      name: tier.name,
      priceRupees: String(tier.price_paise / 100),
      coverRupees: String(tier.redeemable_paise / 100),
      admits: String(tier.admits),
      priceUnit: tier.price_unit,
      description: tier.description ?? '',
    });
  }

  async function save(code: string) {
    if (!draft) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/prices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name: draft.name,
          description: draft.description || null,
          priceRupees: Number(draft.priceRupees),
          coverRupees: Number(draft.coverRupees),
          admits: Number(draft.admits),
          priceUnit: draft.priceUnit,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        data?: { repriced?: { bookings: number } };
      };

      if (!response.ok) {
        setError(body.error ?? 'Could not save that.');
        return;
      }

      // Worth saying out loud. Repricing other people's unpaid carts is a real
      // consequence of pressing Save, and the operator should see the number
      // rather than discover it later.
      const moved = body.data?.repriced?.bookings ?? 0;
      setNotice(
        moved > 0
          ? `${draft.name} updated — live on the site now, and ${moved} unpaid ${
              moved === 1 ? 'booking' : 'bookings'
            } moved to the new price.`
          : `${draft.name} updated — live on the site now.`,
      );
      setEditing(null);
      setDraft(null);
      await refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(tier: PriceTier) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/prices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: tier.code, active: !tier.active }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) setError(body.error ?? 'Could not update that pass.');
      else {
        setNotice(
          `${tier.name} is now ${tier.active ? 'hidden from the site' : 'on sale'}.`,
        );
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="min-h-[20px]">
        {error && <p className="text-[13px] font-medium text-flare-600">{error}</p>}
        {!error && notice && <p className="text-[13px] font-medium text-leaf-600">{notice}</p>}
      </div>

      <div className="space-y-3">
        {tiers.map((tier) => {
          const isEditing = editing === tier.code;

          return (
            <div
              key={tier.id}
              className={cn(
                'rounded-xl border p-4',
                tier.active ? 'border-edge bg-canvas' : 'border-edge/60 bg-frost opacity-70',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                      {tier.code}
                    </span>
                    {!tier.active && (
                      <span className="rounded-md bg-flare-200/40 px-1.5 py-0.5 text-[10px] font-medium text-flare-600">
                        hidden
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-display text-[1.05rem] font-semibold text-ink">
                    {tier.name}
                  </p>
                  <p className="tnum mt-0.5 text-[13px] text-slate">
                    {formatInr(tier.price_paise)}{' '}
                    <span className="text-muted">{tier.price_unit}</span> ·{' '}
                    {formatInr(tier.redeemable_paise)} cover · admits {tier.admits}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    {tier.confirmed} sold
                    {tier.pending > 0 && ` · ${tier.pending} in unpaid carts`}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggle(tier)}
                    className="btn-outline btn-sm px-3 py-1.5 text-[12px] disabled:opacity-40"
                  >
                    {tier.active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => (isEditing ? setEditing(null) : startEdit(tier))}
                    className="btn-outline btn-sm px-3 py-1.5 text-[12px] disabled:opacity-40"
                  >
                    {isEditing ? 'Cancel' : 'Edit'}
                  </button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {isEditing && draft && (
                  <motion.div
                    initial={reduce ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 border-t border-edge pt-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Field
                          id={`${tier.code}-name`}
                          label="Pass name"
                          value={draft.name}
                          onChange={(v) => setDraft({ ...draft, name: v })}
                        />
                        <Field
                          id={`${tier.code}-price`}
                          label="Price ₹"
                          type="number"
                          value={draft.priceRupees}
                          onChange={(v) => setDraft({ ...draft, priceRupees: v })}
                        />
                        <Field
                          id={`${tier.code}-cover`}
                          label="Cover ₹"
                          type="number"
                          value={draft.coverRupees}
                          onChange={(v) => setDraft({ ...draft, coverRupees: v })}
                        />
                        <Field
                          id={`${tier.code}-admits`}
                          label="Admits"
                          type="number"
                          value={draft.admits}
                          onChange={(v) => setDraft({ ...draft, admits: v })}
                          hint="Heads one scan lets in"
                        />
                        <Field
                          id={`${tier.code}-unit`}
                          label="Price suffix"
                          value={draft.priceUnit}
                          onChange={(v) => setDraft({ ...draft, priceUnit: v })}
                          hint="e.g. / pass, / table"
                        />
                        <div className="sm:col-span-2 lg:col-span-3">
                          <Field
                            id={`${tier.code}-desc`}
                            label="Description"
                            value={draft.description}
                            onChange={(v) => setDraft({ ...draft, description: v })}
                          />
                        </div>
                      </div>

                      {tier.confirmed > 0 && (
                        <p className="mt-3 text-[12px] leading-relaxed text-slate">
                          <strong className="text-ink">{tier.confirmed} already sold.</strong>{' '}
                          Their receipts and passes keep the price and admit count they bought — this
                          only changes what the next customer pays.
                        </p>
                      )}

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => save(tier.code)}
                          className="btn-primary px-5 py-2 text-[13px] disabled:opacity-40"
                        >
                          {busy ? 'Saving…' : 'Save and publish'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <p className="text-[12px] leading-relaxed text-muted">
        Saving publishes immediately — the home page, the event page and the cart all read these
        rows, so no old figure is left anywhere. Customers who have already bought keep the price
        they paid.
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-medium text-muted">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        className="field py-2 text-[13px]"
      />
      {hint && <p className="mt-1 text-[10px] text-muted">{hint}</p>}
    </div>
  );
}
