'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
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
}

type Panel = 'allocate' | 'payment' | 'edit' | 'code' | null;

/**
 * Every admin action on one promoter, as a row of buttons that each open a
 * small form. One panel at a time so a phone screen never holds three forms.
 */
export function PromoterControls({ promoter }: Props) {
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
        <Btn active={panel === 'allocate'} onClick={() => toggle('allocate')}>Issue / remove passes</Btn>
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

      {panel === 'allocate' && <AllocateForm promoter={promoter} busy={busy} run={run} />}
      {panel === 'payment' && <PaymentForm promoter={promoter} busy={busy} run={run} />}
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

function AllocateForm({ promoter, busy, run }: { promoter: Props['promoter']; busy: boolean; run: Run }) {
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [count, setCount] = useState('');
  const [text, setText] = useState('');
  const n = Math.round(Number(count) || 0);
  return (
    <form
      className="panel space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const delta = mode === 'add' ? n : -n;
        void run('POST', { action: 'allocate', delta, note: text }, mode === 'add' ? `Issued ${n} passes to ${promoter.name}.` : `Took back ${n} unissued passes.`);
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
            {m === 'add' ? 'Issue more' : 'Take back'}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <Field
          label="Passes"
          hint={mode === 'remove' ? `At most ${promoter.remaining} (unissued).` : `Currently ${promoter.allocated} allocated.`}
        >
          <input className="field py-2 text-[14px]" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <input className="field py-2 text-[14px]" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      </div>
      <button type="submit" disabled={busy || n <= 0} className="btn-primary px-5 py-2 text-[13px] disabled:opacity-50">
        {mode === 'add' ? `Issue ${n || ''} passes` : `Take back ${n || ''}`}
      </button>
    </form>
  );
}

function PaymentForm({ promoter, busy, run }: { promoter: Props['promoter']; busy: boolean; run: Run }) {
  const [amount, setAmount] = useState('');
  const [tickets, setTickets] = useState('');
  const [text, setText] = useState('');
  const [correction, setCorrection] = useState(false);
  const deal = promoter.deal_price_paise / 100;
  return (
    <form
      className="panel space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          'POST',
          { action: correction ? 'payment_correction' : 'payment', amountRupees: Number(amount) || 0, tickets: Number(tickets) || 0, note: text },
          correction ? 'Correction recorded.' : 'Payment logged.',
        );
      }}
    >
      <p className="text-[12px] text-slate">
        Money the promoter paid you directly (UPI, bank, cash). This records it; it does not activate passes — do that
        below once you are satisfied.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Amount received (₹)">
          <input className="field py-2 text-[14px]" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Passes it covers" hint={deal ? `At ₹${deal}/pass that is ${Math.floor((Number(amount) || 0) / deal)}.` : undefined}>
          <input className="field py-2 text-[14px]" inputMode="numeric" value={tickets} onChange={(e) => setTickets(e.target.value)} />
        </Field>
        <Field label="Note / UTR">
          <input className="field py-2 text-[14px]" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[12px] text-slate">
        <input type="checkbox" checked={correction} onChange={(e) => setCorrection(e.target.checked)} className="accent-vybe-600" />
        This is a correction (subtract a mistaken entry)
      </label>
      <button type="submit" disabled={busy} className="btn-primary px-5 py-2 text-[13px] disabled:opacity-50">
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
