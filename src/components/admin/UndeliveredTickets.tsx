'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn, formatInr } from '@/lib/utils';

interface Booking {
  reference: string;
  customer_name: string;
  customer_email: string;
  amount_paise: number;
  paid_at: string;
  last_error: string | null;
}

/**
 * Paid customers still waiting for their pass.
 *
 * This should always read zero. When it does not, somebody has had money taken
 * and has no ticket — which once went unnoticed for hours here because the only
 * way to find out was a customer getting in touch.
 *
 * Deliberately silent when there is nothing wrong: a green "all delivered"
 * badge on every page load is noise, and noise is what people learn to skip
 * past on the day it finally says something.
 */
export function UndeliveredTickets() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/tickets/undelivered', { cache: 'no-store' });
      const body = (await response.json()) as { data?: { bookings: Booking[] } };
      setBookings(body.data?.bookings ?? []);
    } catch {
      setBookings([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sendAll = useCallback(async () => {
    setSending(true);
    setResult(null);
    try {
      const response = await fetch('/api/admin/tickets/undelivered', { method: 'POST' });
      const body = (await response.json()) as {
        data?: { attempted: number; sent: number; failed: Array<{ reference: string; error: string }> };
        error?: string;
      };
      if (!response.ok || !body.data) {
        setResult(body.error ?? 'Could not send.');
        return;
      }
      setResult(
        body.data.failed.length === 0
          ? `Sent ${body.data.sent} ticket${body.data.sent === 1 ? '' : 's'}.`
          : `Sent ${body.data.sent} of ${body.data.attempted}. Still failing: ${body.data.failed
              .map((f) => f.reference)
              .join(', ')}.`,
      );
      await load();
    } catch {
      setResult('Could not reach the server.');
    } finally {
      setSending(false);
    }
  }, [load]);

  // Nothing outstanding is the normal case, and it says so by staying quiet.
  if (bookings === null || bookings.length === 0) return null;

  return (
    <div className="rounded-xl border border-flare-400 bg-flare-200/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-flare-600">
            Paid, but no ticket sent
          </p>
          <p className="mt-1 font-display text-lg font-bold text-flare-600">
            {bookings.length} customer{bookings.length === 1 ? '' : 's'} waiting
          </p>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-slate">
            These people paid and have no pass in their inbox. Their tickets exist and are valid at
            the door — only the email is missing.
          </p>
        </div>

        <button
          type="button"
          onClick={sendAll}
          disabled={sending}
          className={cn('btn-primary shrink-0 px-5 py-2.5 text-[12px] disabled:opacity-40')}
        >
          {sending ? 'Sending…' : 'Send them now'}
        </button>
      </div>

      <ul className="mt-3 space-y-1 border-t border-flare-300/60 pt-3">
        {bookings.slice(0, 8).map((booking) => (
          <li key={booking.reference} className="text-[12px] text-slate">
            <span className="font-mono text-ink">{booking.reference}</span> · {booking.customer_name}{' '}
            · <span className="break-all">{booking.customer_email}</span> ·{' '}
            {formatInr(booking.amount_paise)}
            {booking.last_error && (
              <span className="block pl-1 text-[11px] text-flare-600">↳ {booking.last_error}</span>
            )}
          </li>
        ))}
        {bookings.length > 8 && (
          <li className="text-[12px] text-muted">…and {bookings.length - 8} more</li>
        )}
      </ul>

      {result && (
        <p aria-live="polite" className="mt-3 text-[12px] font-medium text-slate">
          {result}
        </p>
      )}
    </div>
  );
}
