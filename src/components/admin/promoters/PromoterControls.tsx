'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn, parseSerialList, serialRanges } from '@/lib/utils';
import { CodeReveal, Field, Note, call } from './ui';

interface Props {
  promoter: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    notes: string | null;
    active: boolean;
    allocated: number;
    issued: number;
    remaining: number;
    deal_price_paise: number;
  };
  /** Suggested first serial for a new block. */
  nextStart: number;
  /** This promoter's serials, for hints. */
  unsold: number[];
  soldUnpaid: number[];
}

type Panel = 'allocate' | 'payment' | 'edit' | 'code' | null;

/**
 * Every admin action on one promoter, as a row of buttons that each open a
 * small form. One panel at a time so a phone screen never holds three forms.
 */
export function PromoterControls({ promoter, nextStart, unsold, soldUnpaid }: Props) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);

  const base = `/api/admin/promoters/${promoter.id}`;

  async function run(method: 'POST' | 'PATCH' | 'DELETE', body: unknown, success: string) {
    setBusy(true);
    setNote(null);
    const result = await call<{ code?: string | null }>(base, method, body);
    setBusy(false);
    if (!result.ok) {
      setNote({ tone: 'bad', text: result.error ?? 'Failed' });
      return false;
    }
    if (result.data?.code) setNewCode(result.data.code);
    setNote({ tone: 'ok', text: success });
    setPanel(null);
    router.refresh();
    return true;
  }

  const toggle = (p: Panel) => {
    setNote(null);
    setPanel((current) => (current === p ? null : p));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Btn active={panel === 'allocate'} onClick={() => toggle('allocate')}>Allocate / take back serials</Btn>
        <Btn active={panel === 'payment'} onClick={() => toggle('payment')}>Log payment</Btn>
        <Btn active={panel === 'edit'} onClick={() => toggle('edit')}>Edit details</Btn>
        <Btn active={panel === 'code'} onClick={() => toggle('code')}>Change code</Btn>
        <Btn
          onClick={() =>
            void run(
              'PATCH',
              { active: !promoter.active },
              promoter.active ? 'Suspended — they are signed out and cannot issue.' : 'Re-enabled.',
            )
          }
          disabled={busy}
        >
          {promoter.active ? 'Suspend' : 'Re-enable'}
        </Btn>
        <Btn
          danger
          disabled={busy}
          onClick={async () => {
            const typed = window.prompt(
              `Delete ${promoter.name}? Their ${promoter.issued} issued passes stay with the customers (and keep their current active/inactive state), but the promoter account and its payment ledger are removed for good.\n\nType DELETE to confirm.`,
            );
            if (typed !== 'DELETE') return;
            const ok = await run('DELETE', undefined, 'Deleted.');
            if (ok) router.push('/admin/promoters');
          }}
        >
          Delete
        </Btn>
      </div>

      {note && <Note tone={note.tone}>{note.text}</Note>}
      {newCode && <CodeReveal code={newCode} name={promoter.name} onDone={() => setNewCode(null)} />}

      {panel === 'allocate' && <AllocateForm nextStart={nextStart} unsold={unsold} busy={busy} run={run} />}
      {panel === 'payment' && <PaymentForm promoter={promoter} soldUnpaid={soldUnpaid} busy={busy} run={run} />}
      {panel === 'edit' && <EditForm promoter={promoter} busy={busy} run={run} />}
      {panel === 'code' && (
        <CodeForm
          busy={busy}
          onSubmit={(code) => run('PATCH', { code }, 'Code changed. Their old code and sessions no longer work.')}
        />
      )}
    </div>
  );
}

type Run = (method: 'POST' | 'PATCH' | 'DELETE', body: unknown, success: string) => Promise<boolean>;

function AllocateForm({ nextStart, unsold, busy, run }: { nextStart: number; unsold: number[]; busy: boolean; run: Run }) {
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const f = Number(from);
  const t = Number(to);
  const count = from && to && t >= f ? t - f + 1 : 0;
  return (
    <form
      className="panel space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          'POST',
          { action: 'allocate', mode, from: f, to: t, note: text },
          mode === 'add' ? `Allocated #${f}–${t} (${count} passes).` : `Took back #${f}–${t}.`,
        );
      }}
    >
      <div className="inline-flex rounded-lg border border-edge p-0.5 text-[12px] font-semibold">
        {(['add', 'remove'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn('rounded-md px-3 py-1.5', mode === m ? 'bg-ink text-white' : 'text-slate')}
          >
            {m === 'add' ? 'Allocate a range' : 'Take back a range'}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-slate">
        {mode === 'add'
          ? `Promoter serials are 1000–4999, and a range must not overlap anyone else's. Next free block starts at #${nextStart}.`
          : unsold.length
            ? `Only unsold serials can be taken back. Their unsold serials: #${serialRanges(unsold)}.`
            : 'They have no unsold serials to take back.'}
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
        <Field label="First serial">
          <input className="field py-2 font-mono text-[14px]" inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value)} placeholder={mode === 'add' ? String(nextStart) : ''} />
        </Field>
        <Field label="Last serial" hint={count ? `${count} pass${count === 1 ? '' : 'es'}` : undefined}>
          <input className="field py-2 font-mono text-[14px]" inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value)} placeholder={mode === 'add' ? String(Math.min(4999, nextStart + 99)) : ''} />
        </Field>
        <Field label="Note (optional)">
          <input className="field py-2 text-[14px]" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      </div>
      <button type="submit" disabled={busy || count <= 0} className="btn-primary px-5 py-2 text-[13px] disabled:opacity-50">
        {mode === 'add' ? `Allocate ${count ? `#${f}–${t}` : 'range'}` : `Take back ${count ? `#${f}–${t}` : 'range'}`}
      </button>
    </form>
  );
}

function PaymentForm({
  promoter,
  soldUnpaid,
  busy,
  run,
}: {
  promoter: Props['promoter'];
  soldUnpaid: number[];
  busy: boolean;
  run: Run;
}) {
  const [amount, setAmount] = useState('');
  const [serials, setSerials] = useState('');
  const [text, setText] = useState('');
  const [correction, setCorrection] = useState(false);
  const parsed = serials.trim() ? parseSerialList(serials) : null;
  const n = parsed && 'serials' in parsed ? parsed.serials.length : 0;
  const deal = promoter.deal_price_paise / 100;
  return (
    <form
      className="panel space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          'POST',
          { action: correction ? 'payment_correction' : 'payment', amountRupees: Number(amount) || 0, serials, note: text },
          correction ? 'Correction recorded.' : 'Payment logged against those serials.',
        );
      }}
    >
      <p className="text-[12px] text-slate">
        Money the promoter paid you directly, recorded against the exact serials it covers. This does not activate passes —
        do that from the pass list once you are satisfied.
        {soldUnpaid.length > 0 && <> Sold but unpaid: <span className="font-mono">#{serialRanges(soldUnpaid)}</span>.</>}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Serials covered"
          hint={parsed && 'error' in parsed ? parsed.error : n ? `${n} pass${n === 1 ? '' : 'es'}${deal ? ` · ₹${(n * deal).toLocaleString('en-IN')} at the deal price` : ''}` : 'e.g. 1000-1019 or 1003, 1007'}
        >
          <input className="field py-2 font-mono text-[14px]" value={serials} onChange={(e) => setSerials(e.target.value)} placeholder="1000-1019" />
        </Field>
        <Field label="Amount received (₹)">
          <input className="field py-2 text-[14px]" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={n && deal ? String(n * deal) : ''} />
        </Field>
        <Field label="Note / UTR">
          <input className="field py-2 text-[14px]" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[12px] text-slate">
        <input type="checkbox" checked={correction} onChange={(e) => setCorrection(e.target.checked)} className="accent-vybe-600" />
        This is a correction (subtract a mistaken entry)
      </label>
      <button type="submit" disabled={busy || n === 0 || !(Number(amount) > 0)} className="btn-primary px-5 py-2 text-[13px] disabled:opacity-50">
        {correction ? 'Record correction' : 'Log payment'}
      </button>
    </form>
  );
}

function EditForm({ promoter, busy, run }: { promoter: Props['promoter']; busy: boolean; run: Run }) {
  const [d, setD] = useState({
    name: promoter.name,
    phone: promoter.phone ?? '',
    email: promoter.email ?? '',
    dealPriceRupees: String(promoter.deal_price_paise / 100),
    notes: promoter.notes ?? '',
  });
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className="panel grid gap-3 p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run('PATCH', { ...d, dealPriceRupees: Number(d.dealPriceRupees) || 0 }, 'Saved.');
      }}
    >
      <Field label="Name"><input className="field py-2 text-[14px]" value={d.name} onChange={set('name')} /></Field>
      <Field label="Phone"><input className="field py-2 text-[14px]" value={d.phone} onChange={set('phone')} /></Field>
      <Field label="Email"><input className="field py-2 text-[14px]" value={d.email} onChange={set('email')} /></Field>
      <Field label="Deal price per pass (₹)"><input className="field py-2 text-[14px]" inputMode="decimal" value={d.dealPriceRupees} onChange={set('dealPriceRupees')} /></Field>
      <Field label="Notes" className="sm:col-span-2"><textarea className="field min-h-[60px] py-2 text-[14px]" value={d.notes} onChange={set('notes')} /></Field>
      <div className="sm:col-span-2">
        <button type="submit" disabled={busy} className="btn-primary px-5 py-2 text-[13px] disabled:opacity-50">Save</button>
      </div>
    </form>
  );
}

function CodeForm({ busy, onSubmit }: { busy: boolean; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('');
  return (
    <form
      className="panel space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(code);
      }}
    >
      <Field label="New login code" hint="Leave blank to generate a random one. The old code stops working immediately.">
        <input className="field py-2 font-mono text-[14px] uppercase" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" placeholder="auto" />
      </Field>
      <button type="submit" disabled={busy} className="btn-primary px-5 py-2 text-[13px] disabled:opacity-50">Set code</button>
    </form>
  );
}

function Btn({
  children,
  onClick,
  active,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition-colors disabled:opacity-50',
        active ? 'border-ink bg-ink text-white' : danger ? 'border-flare-300 text-flare-600 hover:bg-flare-200/30' : 'border-edge bg-paper text-ink hover:border-ink',
      )}
    >
      {children}
    </button>
  );
}
