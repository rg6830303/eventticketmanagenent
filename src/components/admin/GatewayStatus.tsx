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
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<string | null>(null);

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

  // Without a webhook secret nothing pushes us a "payment captured" event, so
  // a customer who pays and closes the tab sits pending with their money taken.
  // This asks the gateway about every recent pending booking and finishes the
  // ones that were actually paid.
  const sweep = useCallback(async () => {
    setSweeping(true);
    setSweepResult(null);
    try {
      const response = await fetch('/api/admin/payments/reconcile', { method: 'POST' });
      const body = (await response.json()) as {
        data?: { checked: number; recovered: number; references: string[] };
        error?: string;
      };
      if (!response.ok || !body.data) {
        setSweepResult(body.error ?? 'Could not check.');
        return;
      }
      setSweepResult(
        body.data.recovered > 0
          ? `Recovered ${body.data.recovered} paid booking${body.data.recovered === 1 ? '' : 's'} — ${body.data.references.join(', ')}. Tickets sent.`
          : `Checked ${body.data.checked} pending booking${body.data.checked === 1 ? '' : 's'} — none had been paid.`,
      );
    } catch {
      setSweepResult('Could not reach the server.');
    } finally {
      setSweeping(false);
    }
  }, []);

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

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={sweep}
            disabled={sweeping}
            className="btn-outline btn-sm px-4 py-2 text-[12px] disabled:opacity-40"
            title="Ask the gateway whether any pending booking was actually paid"
          >
            {sweeping ? 'Checking payments…' : 'Find missed payments'}
          </button>
          <button
            type="button"
            onClick={check}
            disabled={checking}
            className="btn-outline btn-sm px-4 py-2 text-[12px] disabled:opacity-40"
          >
            {checking ? 'Checking…' : 'Check again'}
          </button>
        </div>
      </div>

      {sweepResult && (
        <p aria-live="polite" className="mt-3 border-t border-edge/60 pt-3 text-[12px] text-slate">
          {sweepResult}
        </p>
      )}
    </div>
  );
}
