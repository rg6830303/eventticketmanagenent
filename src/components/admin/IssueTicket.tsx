'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { cn, formatInr } from '@/lib/utils';
import { ExcelButton } from './ExcelButton';

export interface TierOption {
  code: string;
  name: string;
  pricePaise: number;
  admits: number;
  remaining: number;
}

export interface IssuedBooking {
  reference: string;
  customer_name: string;
  customer_email: string;
  quantity: number;
  amount_paise: number;
  status: string;
  notes: string | null;
  email_sent_at: string | null;
  created_at: string;
  tier_name: string | null;
  checked_in: number;
}

interface IssueResult {
  reference: string;
  quantity: number;
  amountPaise: number;
  tierName: string | null;
  tickets: Array<{ code: string; admits: number; holderName: string }>;
  emailSent: boolean;
  emailError: string | null;
  sentTo: string;
}

const CUSTOM = '__custom__';

/**
 * Issue passes by hand.
 *
 * The box-office and guest-list path: a comp for a promoter, a pass for someone
 * who paid in cash, a replacement for a booking that went wrong. The passes it
 * mints are identical to bought ones — same code format, same signature, same
 * behaviour at the door — so nothing at the gate needs to know the difference.
 */
export function IssueTicket({
  tiers,
  initialIssued,
}: {
  tiers: TierOption[];
  initialIssued: IssuedBooking[];
}) {
  const reduce = useReducedMotion();
  const [issued, setIssued] = useState(initialIssued);
  const [result, setResult] = useState<IssueResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    tierCode: tiers[0]?.code ?? CUSTOM,
    customLabel: 'Guest pass',
    admits: '1',
    quantity: '1',
    amountRupees: '0',
    note: '',
    sendEmail: true,
  });

  const isCustom = form.tierCode === CUSTOM;
  const selectedTier = tiers.find((tier) => tier.code === form.tierCode) ?? null;

  const set = (field: keyof typeof form) => (value: string | boolean) =>
    setForm((current) => ({ ...current, [field]: value }));

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (busy) return;

      setBusy(true);
      setError(null);
      setResult(null);

      try {
        const response = await fetch('/api/admin/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            phone: form.phone,
            tierCode: isCustom ? null : form.tierCode,
            customLabel: isCustom ? form.customLabel : null,
            admits: Number(form.admits),
            quantity: Number(form.quantity),
            amountRupees: Number(form.amountRupees),
            note: form.note || null,
            sendEmail: form.sendEmail,
          }),
        });
        const body = (await response.json()) as { data?: IssueResult; error?: string };

        if (!response.ok || !body.data) {
          setError(body.error ?? 'Could not issue those passes.');
          return;
        }

        setResult(body.data);
        setForm((current) => ({ ...current, name: '', email: '', phone: '', note: '' }));

        const list = await fetch('/api/admin/tickets').then((r) => r.json());
        if (list.data?.issued) setIssued(list.data.issued);
      } catch {
        setError('Could not reach the server.');
      } finally {
        setBusy(false);
      }
    },
    [busy, form, isCustom],
  );

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="rounded-xl border border-edge bg-frost p-4 sm:p-5">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          Issue passes
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="t-name" label="Guest name" value={form.name} onChange={set('name')} />
          <Field id="t-email" label="Email" type="email" value={form.email} onChange={set('email')} />
          <Field id="t-phone" label="Mobile" type="tel" value={form.phone} onChange={set('phone')} />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="t-tier" className="mb-1 block text-[11px] font-medium text-muted">
              Pass type
            </label>
            <select
              id="t-tier"
              value={form.tierCode}
              onChange={(event) => set('tierCode')(event.target.value)}
              className="field py-2 text-[13px]"
            >
              {tiers.map((tier) => (
                <option key={tier.code} value={tier.code}>
                  {tier.name} · admits {tier.admits} · {tier.remaining} left
                </option>
              ))}
              <option value={CUSTOM}>Custom pass…</option>
            </select>
          </div>

          {isCustom ? (
            <>
              <Field
                id="t-label"
                label="Pass name"
                value={form.customLabel}
                onChange={set('customLabel')}
              />
              <Field
                id="t-admits"
                label="Admits each"
                type="number"
                value={form.admits}
                onChange={set('admits')}
              />
            </>
          ) : (
            <div className="sm:col-span-2 sm:self-end">
              <p className="rounded-lg border border-edge bg-canvas px-3 py-2 text-[12px] text-slate">
                {selectedTier?.name} admits <strong>{selectedTier?.admits}</strong> per pass ·{' '}
                {selectedTier?.remaining} in stock · face value{' '}
                {formatInr(selectedTier?.pricePaise ?? 0)}
              </p>
            </div>
          )}

          <Field
            id="t-qty"
            label="How many passes"
            type="number"
            value={form.quantity}
            onChange={set('quantity')}
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field
            id="t-amount"
            label="Collected ₹"
            type="number"
            value={form.amountRupees}
            onChange={set('amountRupees')}
            hint="0 = complimentary. Any other figure records cash taken off-gateway; nobody is charged."
          />
          <div className="sm:col-span-2">
            <Field id="t-note" label="Note (internal)" value={form.note} onChange={set('note')} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate">
            <input
              type="checkbox"
              checked={form.sendEmail}
              onChange={(event) => set('sendEmail')(event.target.checked)}
              className="h-4 w-4 accent-vybe-600"
            />
            Email the passes straight away
          </label>

          <button
            type="submit"
            disabled={busy || !form.name || !form.email || !form.phone}
            className="btn-primary px-6 py-2.5 text-[13px] disabled:opacity-40"
          >
            {busy ? 'Issuing…' : 'Issue and send'}
          </button>
        </div>
      </form>

      <div aria-live="polite">
        <AnimatePresence>
          {error && (
            <motion.p
              role="alert"
              initial={reduce ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-flare-300 bg-flare-200/30 px-4 py-3 text-[13px] text-flare-600"
            >
              {error}
            </motion.p>
          )}

          {result && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-leaf-400 bg-leaf-100 px-4 py-3"
            >
              <p className="text-[13px] font-semibold text-ink">
                {result.quantity} {result.quantity === 1 ? 'pass' : 'passes'} issued ·{' '}
                <span className="font-mono">{result.reference}</span>
              </p>
              <p className="mt-1 text-[12px] text-slate">
                {result.emailSent ? (
                  <>Emailed to {result.sentTo}.</>
                ) : (
                  <>
                    <strong className="text-flare-600">Not emailed.</strong>{' '}
                    {result.emailError ?? 'Sending was switched off.'} The passes are valid at the
                    door regardless — resend from the booking page.
                  </>
                )}
              </p>
              <ul className="mt-2 space-y-0.5">
                {result.tickets.map((ticket) => (
                  <li key={ticket.code} className="font-mono text-[12px] text-slate">
                    {ticket.code}
                    {ticket.admits > 1 && (
                      <span className="ml-2 font-sans text-[11px] text-vybe-700">
                        admits {ticket.admits}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[15px] font-semibold text-ink">Issued by hand</h2>
        <ExcelButton sheet="tickets" label="All tickets (Excel)" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-edge">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-edge bg-frost text-left">
              <Th>Reference</Th>
              <Th>Guest</Th>
              <Th>Pass</Th>
              <Th className="text-right">Qty</Th>
              <Th className="text-right">Collected</Th>
              <Th>Emailed</Th>
              <Th>Note</Th>
            </tr>
          </thead>
          <tbody>
            {issued.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted">
                  Nothing issued by hand yet.
                </td>
              </tr>
            ) : (
              issued.map((row) => (
                <tr key={row.reference} className="border-b border-edge/60 last:border-0">
                  <Td className="font-mono text-vybe-700">{row.reference}</Td>
                  <Td>
                    <span className="font-medium text-ink">{row.customer_name}</span>
                    <span className="block text-[11px] text-muted">{row.customer_email}</span>
                  </Td>
                  <Td>{row.tier_name ?? '—'}</Td>
                  <Td className="tnum text-right">
                    {row.quantity}
                    {row.checked_in > 0 && (
                      <span className="ml-1 text-[11px] text-leaf-600">({row.checked_in} in)</span>
                    )}
                  </Td>
                  <Td className="tnum text-right">
                    {row.amount_paise === 0 ? (
                      <span className="text-muted">Comp</span>
                    ) : (
                      formatInr(row.amount_paise)
                    )}
                  </Td>
                  <Td>
                    {row.email_sent_at ? (
                      <span className="text-leaf-600">Sent</span>
                    ) : (
                      <span className="text-flare-600">No</span>
                    )}
                  </Td>
                  <Td className="max-w-[220px] truncate text-muted" title={row.notes ?? ''}>
                    {row.notes ?? '—'}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
      {hint && <p className="mt-1 text-[10px] leading-relaxed text-muted">{hint}</p>}
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
