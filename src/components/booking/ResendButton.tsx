'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ResendButton({ reference }: { reference: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  async function resend() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/bookings/${reference}/resend`, { method: 'POST' });
      const body = (await response.json()) as { data?: { sentTo: string }; error?: string };

      if (response.ok && body.data) {
        setMessage({ tone: 'ok', text: `Sent again to ${body.data.sentTo}` });
        router.refresh();
      } else {
        setMessage({
          tone: 'bad',
          text: body.error ?? 'We could not resend it just now. Try again shortly.',
        });
      }
    } catch {
      setMessage({ tone: 'bad', text: 'Network error — check your connection.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={resend}
        disabled={pending}
        className="btn-outline px-5 py-2.5 text-[12px]"
      >
        {pending ? 'Sending…' : 'Resend email'}
      </button>
      <span aria-live="polite" className="min-h-[16px]">
        {message && (
          <span
            className={
              message.tone === 'ok' ? 'text-[11px] text-vybe-600' : 'text-[11px] text-red-300'
            }
          >
            {message.text}
          </span>
        )}
      </span>
    </div>
  );
}
