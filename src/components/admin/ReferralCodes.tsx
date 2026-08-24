'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { cn, formatInr } from '@/lib/utils';
import type { ReferralCodeStats, ReferralCustomer } from '@/lib/referrals';

interface Totals {
  active: number;
  sales: number;
  revenuePaise: number;
  discountGivenPaise: number;
}

interface Props {
  initialCodes: ReferralCodeStats[];
  initialTotals: Totals;
}

/**
 * Referral codes.
 *
 * The column that matters is `sales`, not `uses`. `uses` counts claims — it
 * increments the moment somebody types a code at checkout, including the many
 * who then never pay, because that is what makes a max_uses ceiling mean
 * anything. Showing a promoter that number as "how many you sold" would
 * overstate it every time, so both are shown and only one is called sales.
 */
export function ReferralCodes({ initialCodes, initialTotals }: Props) {
  const reduce = useReducedMotion();
  const [codes, setCodes] = useState(initialCodes);
  const [totals, setTotals] = useState(initialTotals);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch('/api/admin/referrals');
    const body = (await response.json()) as {
      data?: { codes: ReferralCodeStats[]; totals: Totals };
    };
    if (body.data) {
      setCodes(body.data.codes);
      setTotals(body.data.totals);
    }
  }, []);

  async function toggle(code: string, active: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/referrals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, active }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) setError(body.error ?? 'Could not update that code.');
      else {
        setNotice(`${code} is now ${active ? 'live' : 'switched off'}.`);
        await refresh();
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Live codes" value={String(totals.active)} hint={`${codes.length} total`} />
        <Stat label="Tickets sold" value={String(totals.sales)} hint="Paid bookings only" />
        <Stat label="Revenue" value={formatInr(totals.revenuePaise)} hint="Collected via codes" />
        <Stat
          label="Discount given"
          value={formatInr(totals.discountGivenPaise)}
          hint="On paid bookings"
        />
      </div>

      <CreateForm
        onCreated={async (message) => {
          setNotice(message);
          setError(null);
          await refresh();
        }}
        onError={setError}
      />

      <div aria-live="polite" className="min-h-[20px]">
        {error && <p className="text-[13px] font-medium text-flare-600">{error}</p>}
        {!error && notice && <p className="text-[13px] font-medium text-leaf-600">{notice}</p>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-edge">
        <table className="w-full min-w-[860px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-edge bg-frost text-left">
              <Th>Code</Th>
              <Th>Owner</Th>
              <Th className="text-right">Discount</Th>
              <Th className="text-right">Sold</Th>
              <Th className="text-right">Claimed</Th>
              <Th className="text-right">Revenue</Th>
              <Th>Limit</Th>
              <Th className="text-right">Status</Th>
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted">
                  No referral codes yet. Create one above.
                </td>
              </tr>
            ) : (
              codes.map((code) => (
                <tr key={code.id} className="border-b border-edge/60 last:border-0">
                  <Td>
                    <button
                      type="button"
                      onClick={() => setOpen(code.code)}
                      className="font-mono font-semibold tracking-[0.06em] text-vybe-700 underline underline-offset-2"
                      title="See who bought with this code"
                    >
                      {code.code}
                    </button>
                  </Td>
                  <Td>{code.label ?? <span className="text-muted">—</span>}</Td>
                  <Td className="tnum text-right">{formatInr(code.discount_paise)}</Td>
                  <Td className="tnum text-right font-semibold text-ink">{code.sales}</Td>
                  <Td className="tnum text-right text-muted" title="Includes checkouts never paid for">
                    {code.uses}
                    {code.pending > 0 && (
                      <span className="ml-1 text-[11px] text-flare-600">+{code.pending} unpaid</span>
                    )}
                  </Td>
                  <Td className="tnum text-right">{formatInr(Number(code.revenue_paise))}</Td>
                  <Td className="text-muted">
                    {code.max_uses === null ? 'Unlimited' : `${code.uses} / ${code.max_uses}`}
                  </Td>
                  <Td className="text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggle(code.code, !code.active)}
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-40',
                        code.active
                          ? 'border-leaf-500 text-leaf-600 hover:bg-leaf-100'
                          : 'border-edge text-muted hover:bg-frost',
                      )}
                    >
                      {code.active ? 'Live' : 'Off'}
                    </button>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] leading-relaxed text-muted">
        <strong className="text-slate">Sold</strong> counts bookings that were actually paid for.{' '}
        <strong className="text-slate">Claimed</strong> counts every checkout that entered the code,
        including ones abandoned before payment — that is the number a usage limit is measured
        against. Click a code to see who bought with it.
      </p>

      <AnimatePresence>
        {open && (
          <CustomerPopup code={open} onClose={() => setOpen(null)} reduce={Boolean(reduce)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------

function CreateForm({
  onCreated,
  onError,
}: {
  onCreated: (message: string) => void;
  onError: (message: string | null) => void;
}) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [discount, setDiscount] = useState('100');
  const [maxUses, setMaxUses] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError(null);

    try {
      const response = await fetch('/api/admin/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          label: label || null,
          discountRupees: Number(discount),
          maxUses: maxUses ? Number(maxUses) : null,
        }),
      });
      const body = (await response.json()) as { error?: string; data?: unknown };

      if (!response.ok) {
        onError(body.error ?? 'Could not create that code.');
        return;
      }

      onCreated(`${code.toUpperCase()} is live — ₹${discount} off, usable immediately.`);
      setCode('');
      setLabel('');
      setMaxUses('');
    } catch {
      onError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-edge bg-frost p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        New code
      </p>
      <div className="grid gap-3 sm:grid-cols-[1.1fr_1.1fr_0.8fr_0.8fr_auto] sm:items-end">
        <Field
          id="ref-code"
          label="Code"
          value={code}
          onChange={(v) => setCode(v.toUpperCase())}
          placeholder=""
          mono
        />
        <Field id="ref-label" label="Owner" value={label} onChange={setLabel} placeholder="" />
        <Field
          id="ref-discount"
          label="Discount ₹"
          value={discount}
          onChange={setDiscount}
          type="number"
        />
        <Field
          id="ref-max"
          label="Max uses"
          value={maxUses}
          onChange={setMaxUses}
          type="number"
          hint="Blank = unlimited"
        />
        <button type="submit" disabled={busy || !code} className="btn-primary px-5 py-2.5 text-[13px]">
          {busy ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  mono,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  mono?: boolean;
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
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        className={cn('field py-2 text-[13px]', mono && 'font-mono uppercase tracking-[0.08em]')}
      />
      {hint && <p className="mt-1 text-[10px] text-muted">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CustomerPopup({
  code,
  onClose,
  reduce,
}: {
  code: string;
  onClose: () => void;
  reduce: boolean;
}) {
  const [customers, setCustomers] = useState<ReferralCustomer[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/admin/referrals/${encodeURIComponent(code)}/customers`)
      .then((r) => r.json())
      .then((body: { data?: { customers: ReferralCustomer[] } }) => {
        if (live) setCustomers(body.data?.customers ?? []);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [code]);

  // Escape closes it: this opens over a list an operator is working through,
  // and reaching for a close button on a phone means losing their place.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Customers who used ${code}`}
        initial={reduce ? false : { y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reduce ? { opacity: 0 } : { y: 24, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[80dvh] w-full max-w-2xl overflow-hidden rounded-t-2xl border border-edge bg-canvas shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-edge px-5 py-4">
          <div>
            <p className="font-mono text-[15px] font-semibold tracking-[0.08em] text-ink">{code}</p>
            <p className="text-[12px] text-muted">
              {customers === null
                ? 'Loading…'
                : `${customers.length} paid booking${customers.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-outline btn-sm px-3 py-1.5 text-[12px]">
            Close
          </button>
        </div>

        <div className="max-h-[60dvh] overflow-y-auto">
          {failed ? (
            <p className="px-5 py-8 text-center text-[13px] text-flare-600">
              Could not load that list.
            </p>
          ) : customers === null ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted">Loading…</p>
          ) : customers.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted">
              Nobody has bought a ticket with this code yet.
            </p>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.reference} className="border-b border-edge/60 last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{customer.customer_name}</p>
                      <a
                        href={`mailto:${customer.customer_email}`}
                        className="link-swipe break-all text-[12px] text-slate"
                      >
                        {customer.customer_email}
                      </a>
                      <p className="font-mono text-[11px] text-muted">
                        {customer.reference} · {customer.customer_phone}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right align-top">
                      <p className="tnum font-semibold text-ink">
                        {formatInr(customer.amount_paise)}
                      </p>
                      <p className="tnum text-[11px] text-leaf-600">
                        −{formatInr(customer.discount_paise)}
                      </p>
                      <p className="text-[11px] text-muted">
                        {customer.quantity} {customer.quantity === 1 ? 'pass' : 'passes'}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-edge bg-canvas p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="tnum mt-1 font-display text-2xl font-bold text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted',
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td title={title} className={cn('px-3 py-2.5 align-top text-slate', className)}>
      {children}
    </td>
  );
}
