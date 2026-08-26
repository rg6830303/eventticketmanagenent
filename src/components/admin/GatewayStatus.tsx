'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Gateway {
  ok: boolean;
  reason?: string;
  accountLevel?: boolean;
}

/**
 * Can we take money right now?
 *
 * Every other check can pass while the answer is no: a merchant account that
 * has been switched off still authenticates, still answers reads with 200, and
 * only refuses when you actually try to create an order. So this asks the
 * expensive question — it creates a real ₹1 order that nobody pays — which is
 * why it is a button rather than a poll.
 *
 * It exists because the alternative is finding out from a customer.
 */
export function GatewayStatus() {
  const [state, setState] = useState<Gateway | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch('/api/health?probe=gateway', { cache: 'no-store' });
      const body = (await response.json()) as { checks?: { gateway?: Gateway } };
      setState(body.checks?.gateway ?? { ok: false, reason: 'no answer from the probe' });
      setCheckedAt(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));
    } catch {
      setState({ ok: false, reason: 'could not reach the server' });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const ok = state?.ok === true;

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        state === null
          ? 'border-edge bg-canvas'
          : ok
            ? 'border-leaf-400 bg-leaf-100'
            : 'border-flare-400 bg-flare-200/30',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Card payments
          </p>
          <p
            className={cn(
              'mt-1 font-display text-lg font-bold',
              state === null ? 'text-slate' : ok ? 'text-leaf-600' : 'text-flare-600',
            )}
          >
            {state === null ? 'Checking…' : ok ? 'Taking payments' : 'NOT taking payments'}
          </p>

          {state && !ok && (
            <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-slate">
              {state.reason}
              {state.accountLevel && (
                <>
                  {' '}
                  <strong className="text-ink">
                    This is a block on the gateway account, not a fault on the site.
                  </strong>{' '}
                  Only the payment provider can lift it — contact their support.
                </>
              )}
            </p>
          )}

          {checkedAt && (
            <p className="mt-1.5 text-[11px] text-muted">Last checked {checkedAt}</p>
          )}
        </div>

        <button
          type="button"
          onClick={check}
          disabled={checking}
          className="btn-outline btn-sm shrink-0 px-4 py-2 text-[12px] disabled:opacity-40"
        >
          {checking ? 'Checking…' : 'Check again'}
        </button>
      </div>
    </div>
  );
}
