import { requireSession } from '@/lib/auth';
import { readiness, type CheckStatus } from '@/lib/readiness';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Go-live status', robots: { index: false, follow: false } };

const TONE: Record<CheckStatus, { chip: string; ring: string; label: string }> = {
  ok: { chip: 'chip-ok', ring: 'ring-leaf-400/30', label: 'Ready' },
  warn: { chip: 'chip-hot', ring: 'ring-amber-300/50', label: 'Degraded' },
  fail: { chip: 'chip-hot', ring: 'ring-flare-300', label: 'Blocked' },
};

/**
 * What is stopping this deployment from selling a ticket.
 *
 * Exists because "the site is down" is almost never one thing, and the usual
 * causes — a pause switch left on, a database that never had the schema pushed,
 * no published event, payments disabled — all look identical from the outside:
 * a site that loads and sells nothing.
 *
 * Behind the console login, because the fixes name environment variables.
 */
export default async function StatusPage() {
  await requireSession('manager');

  const report = await readiness().catch((error) => ({
    status: 'fail' as const,
    checks: [
      {
        id: 'readiness',
        label: 'Readiness check',
        status: 'fail' as const,
        detail: error instanceof Error ? error.message : 'The check itself failed to run.',
        fix: 'This usually means the database is unreachable from this deployment.',
      },
    ],
  }));

  const blocked = report.checks.filter((check) => check.status === 'fail');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Go-live status</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-slate">
          Everything that has to be true before a customer can buy a ticket, and what to do about
          each one that is not.
        </p>
      </div>

      <div
        className={cn(
          'rounded-xl p-5 shadow-soft ring-1 ring-inset',
          report.status === 'ok' ? 'bg-leaf-100 ring-leaf-400/40' : 'bg-flare-100 ring-flare-300',
        )}
      >
        <p className="font-display text-[1.15rem] font-semibold text-ink">
          {report.status === 'ok'
            ? 'Ready to sell.'
            : report.status === 'warn'
              ? 'Selling, with something degraded.'
              : `Not selling — ${blocked.length} thing${blocked.length === 1 ? '' : 's'} to fix.`}
        </p>
        {blocked.length > 0 && (
          <p className="mt-1 text-[13px] text-slate">
            Start at the top: the checks are ordered so the first failure is usually the cause of
            the rest.
          </p>
        )}
      </div>

      <ul className="space-y-3">
        {report.checks.map((check) => (
          <li
            key={check.id}
            className={cn('rounded-xl bg-paper p-4 shadow-soft ring-1 ring-inset', TONE[check.status].ring)}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-[1.05rem] font-semibold text-ink">{check.label}</h2>
              <span className={cn('chip', TONE[check.status].chip)}>{TONE[check.status].label}</span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-slate">{check.detail}</p>
            {check.fix && (
              <p className="mt-2 rounded-lg bg-frost px-3 py-2 text-[12px] leading-relaxed text-ink ring-hair">
                <strong className="font-semibold">Fix: </strong>
                {check.fix}
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="text-[12px] leading-relaxed text-muted">
        Two deeper probes are deliberately not run here, because each one costs something:{' '}
        <code className="font-mono">/api/health?probe=smtp</code> opens a real authenticated
        connection to your mail provider, and{' '}
        <code className="font-mono">/api/health?probe=gateway</code> creates a real order nobody
        pays.
      </p>
    </div>
  );
}
