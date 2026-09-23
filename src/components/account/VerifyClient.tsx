'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FormMessage } from './FormMessage';

type State = 'working' | 'done' | 'failed';

/**
 * Spends a verification token on arrival.
 *
 * The token is posted rather than followed as a link, because mail scanners
 * and link-preview crawlers fetch every URL in a message. A verification that
 * completes when Outlook's safe-links bot touches it is not a verification,
 * and it burns the token before the customer ever clicks.
 */
export function VerifyClient({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>(token ? 'working' : 'failed');
  const [message, setMessage] = useState<string | null>(
    token ? null : 'This link is missing its token.',
  );
  // React runs effects twice in development; without this the second run spends
  // an already-spent token and reports a failure on a success.
  const fired = useRef(false);

  useEffect(() => {
    if (!token || fired.current) return;
    fired.current = true;

    (async () => {
      try {
        const response = await fetch('/api/account/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          setMessage(payload.error ?? 'That link is no longer valid.');
          setState('failed');
          return;
        }

        setState('done');
        router.refresh();
      } catch {
        setMessage('Could not reach the server. Try the link again in a moment.');
        setState('failed');
      }
    })();
  }, [token, router]);

  if (state === 'working') {
    return <p className="text-[0.9375rem] text-slate">Confirming your email…</p>;
  }

  if (state === 'done') {
    return (
      <div className="space-y-5">
        <FormMessage tone="success">
          Confirmed. Your tickets are on your account page.
        </FormMessage>
        <Link href="/account" className="btn-primary btn-lg w-full">
          Go to my tickets
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FormMessage tone="error">{message}</FormMessage>
      <p className="text-[0.875rem] leading-relaxed text-slate">
        Verification links last three days and work once. Sign in and ask for a fresh one.
      </p>
      <Link href="/account" className="btn-outline w-full">
        Go to my account
      </Link>
    </div>
  );
}
