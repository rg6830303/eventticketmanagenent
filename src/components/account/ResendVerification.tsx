'use client';

import { useState } from 'react';
import { FormMessage } from './FormMessage';

export function ResendVerification() {
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'failed'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    setState('busy');
    try {
      const response = await fetch('/api/account/resend-verification', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(payload.error ?? 'Could not send that email.');
        setState('failed');
        return;
      }
      setState('sent');
    } catch {
      setMessage('Could not reach the server. Try again in a moment.');
      setState('failed');
    }
  }

  if (state === 'sent') {
    return <FormMessage tone="success">Sent. Check your inbox, and your spam folder.</FormMessage>;
  }

  return (
    <div className="space-y-3">
      {state === 'failed' && message && <FormMessage tone="error">{message}</FormMessage>}
      <button type="button" onClick={resend} disabled={state === 'busy'} className="btn-primary">
        {state === 'busy' ? 'Sending…' : 'Send it again'}
      </button>
    </div>
  );
}
