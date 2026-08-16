import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={cn('card card-lit p-4', accent && 'border-vybe-600/50 bg-vybe-500/[0.07]')}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums leading-none text-chalk sm:text-3xl">
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[11px] text-haze">{hint}</p>}
    </div>
  );
}
