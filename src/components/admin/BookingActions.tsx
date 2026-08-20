'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function BookingActions({
  bookingId,
  reference,
  status,
  canVoid,
}: {
  bookingId: string;
  reference: string;
  status: string;
  canVoid: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<'resend' | 'void' | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [confirmingVoid, setConfirmingVoid] = useState(false);

  async function resend() {
    setPending('resend');
    setMessage(null);
    try {
      const response = await fetch(`/api/bookings/${reference}/resend`, { method: 'POST' });
      const body = (await response.json()) as { data?: { sentTo: string }; error?: string };
      setMessage(
        response.ok && body.data
          ? { tone: 'ok', text: `Ticket email resent to ${body.data.sentTo}` }
          : { tone: 'bad', text: body.error ?? 'Could not resend the email' },
      );
      if (response.ok) router.refresh();
    } catch {
      setMessage({ tone: 'bad', text: 'Network error — try again' });
    } finally {
      setPending(null);
    }
  }

  async function voidBooking() {
    setPending('void');
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/void`, { method: 'POST' });
      const body = (await response.json()) as { data?: { voided: number }; error?: string };
      setMessage(
        response.ok && body.data
          ? { tone: 'ok', text: `Booking cancelled · ${body.data.voided} pass(es) voided` }
          : { tone: 'bad', text: body.error ?? 'Could not void this booking' },
      );
      setConfirmingVoid(false);
      if (response.ok) router.refresh();
    } catch {
      setMessage({ tone: 'bad', text: 'Network error — try again' });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={resend}
          disabled={pending !== null || status !== 'confirmed'}
          className="btn-outline px-4 py-2.5 text-[12px]"
        >
          {pending === 'resend' ? 'Sending…' : 'Resend ticket email'}
        </button>

        {canVoid && status !== 'cancelled' && (
          // Two-step: voiding kills live passes and cannot be undone from here.
          confirmingVoid ? (
            <span className="flex gap-2">
              <button
                type="button"
                onClick={voidBooking}
                disabled={pending !== null}
                className="btn border border-red-500/60 bg-red-500/15 px-4 py-2.5 text-[12px] text-red-200"
              >
                {pending === 'void' ? 'Voiding…' : 'Confirm void'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingVoid(false)}
                className="btn-outline btn-sm px-4 py-2.5 text-[12px]"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingVoid(true)}
              className="btn border border-edge px-4 py-2.5 text-[12px] text-red-300 hover:border-red-500/50"
            >
              Void tickets
            </button>
          )
        )}
      </div>

      <div aria-live="polite" className="min-h-[18px]">
        {message && (
          <p className={message.tone === 'ok' ? 'text-[12px] text-vybe-600' : 'text-[12px] text-red-300'}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
