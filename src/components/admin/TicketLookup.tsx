'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn, formatInr } from '@/lib/utils';
import type { TicketLookupRow } from '@/app/api/admin/tickets/lookup/route';

/**
 * Find a pass by who the customer is.
 *
 * The door's normal path is the QR, and the fallback after that is a booking
 * reference read off a confirmation email. Both assume the customer can show
 * you something. This is for when they cannot — a flat battery, a deleted
 * email, a ticket a friend bought — and the only thing available is a name or
 * a phone number.
 *
 * It deliberately does NOT admit anyone. Finding a pass and spending it are
 * different decisions, and a screen that could do both from a name would make
 * the QR pointless. What it gives an operator is the pass code, which they can
 * then type into the scanner above with the usual once-only guarantee.
 */
export function TicketLookup() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<TicketLookupRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const search = useCallback(async (term: string) => {
    const mine = ++seq.current;
    if (term.trim().length < 3) {
      setRows(null);
      setError(null);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tickets/lookup?q=${encodeURIComponent(term.trim())}`, {
        cache: 'no-store',
      });
      const body = (await response.json()) as {
        data?: { tickets: TicketLookupRow[] };
        error?: string;
      };
      // A slow earlier request must not overwrite a newer answer — somebody
      // typing a name produces several of these in flight at once.
      if (mine !== seq.current) return;
      if (!response.ok || !body.data) {
        setError(body.error ?? 'Could not search.');
        setRows(null);
        return;
      }
      setRows(body.data.tickets);
    } catch {
      if (mine === seq.current) setError('Could not reach the server.');
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }, []);

  // Debounced, because this runs while somebody types a name at a door.
  useEffect(() => {
    const timer = setTimeout(() => void search(q), 300);
    return () => clearTimeout(timer);
  }, [q, search]);

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[1.05rem] font-semibold text-ink">Find a pass</h2>
        <p className="text-[12px] text-muted">Name, phone, email or booking reference</p>
      </div>

      <input
        type="search"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="e.g. Priya, 9876543210, priya@…, HOV-AB12CD"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="field mt-3 py-3 text-[15px]"
        aria-label="Search for a customer's pass"
      />

      <div aria-live="polite" className="mt-3">
        {error && <p className="text-[13px] font-medium text-flare-600">{error}</p>}

        {!error && busy && q.trim().length >= 3 && (
          <p className="text-[13px] text-muted">Searching…</p>
        )}

        {!error && !busy && rows !== null && rows.length === 0 && (
          <p className="text-[13px] text-slate">
            Nothing under that name — paid or otherwise. Check the spelling, try their phone number,
            or ask which email the booking was made with.
          </p>
        )}

        {!error && rows !== null && rows.length > 0 && (
          <>
            <p className="mb-2 text-[12px] text-muted">
              {rows.length} {rows.length === 1 ? 'pass' : 'passes'} found
            </p>
            <ul className="space-y-2">
              {rows.map((row) => (
                <PassCard key={row.code} row={row} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function PassCard({ row }: { row: TicketLookupRow }) {
  const used = row.checked_in_at !== null;
  const zeroCover = (row.redeemable_paise ?? 0) === 0;

  /*
   * Three different reasons a pass does not admit anyone, and they are not
   * interchangeable at a door. Unpaid means send them to pay. Cancelled means
   * someone has to explain. A void or refunded ticket means the booking stands
   * but this particular pass does not.
   */
  const unpaid = row.booking_status === 'pending';
  const cancelled = row.booking_status === 'cancelled' || row.booking_status === 'refunded';
  const deadTicket = row.status === 'void' || row.status === 'refunded';
  const dead = unpaid || cancelled || deadTicket;

  const label = unpaid
    ? 'Not paid'
    : cancelled
      ? 'Cancelled'
      : deadTicket
        ? row.status
        : used
          ? 'Already in'
          : 'Not used';

  return (
    <li
      className={cn(
        'rounded-xl border p-3',
        dead
          ? 'border-flare-400/70 bg-flare-500/[0.08]'
          : used
            ? 'border-amber-400/70 bg-amber-400/[0.10]'
            : 'border-leaf-400 bg-leaf-100/60',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-[1.05rem] font-bold leading-tight text-ink">
            {row.holder_name}
          </p>
          <p className="mt-0.5 text-[12px] text-slate">
            {row.tier_name ?? 'Pass'}
            {row.admits > 1 && ` · admits ${row.admits}`}
            {' · '}
            {row.reference}
          </p>
        </div>

        {/* The state the door is actually asking about. */}
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em]',
            dead
              ? 'bg-flare-500 text-white'
              : used
                ? 'bg-amber-400 text-black'
                : 'bg-leaf-500 text-white',
          )}
        >
          {label}
        </span>
      </div>

      {/* The code, so it can be typed into the scanner above — which is the only
          thing that actually admits anyone. */}
      <p className="tnum mt-2 select-all font-mono text-[13px] font-semibold tracking-[0.06em] text-ink">
        {row.code}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className={cn('font-semibold', zeroCover ? 'text-flare-600' : 'text-leaf-600')}>
          {zeroCover ? 'Zero redeemable' : `${formatInr(row.redeemable_paise)} redeemable`}
        </span>
        <span className="text-muted">{row.customer_email}</span>
        {row.customer_phone && <span className="tnum text-muted">{row.customer_phone}</span>}
      </div>

      {unpaid && (
        <p className="mt-1.5 text-[11px] font-medium text-flare-600">
          This booking was never paid for. Do not admit — send them to pay.
        </p>
      )}
      {cancelled && (
        <p className="mt-1.5 text-[11px] font-medium text-flare-600">
          This booking was {row.booking_status}. Do not admit without checking with a manager.
        </p>
      )}

      {used && !dead && (
        <p className="mt-1.5 text-[11px] font-medium text-amber-700">
          Scanned {new Date(row.checked_in_at as string).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
          })}
          {row.checked_in_gate ? ` · ${row.checked_in_gate}` : ''}
        </p>
      )}
    </li>
  );
}
