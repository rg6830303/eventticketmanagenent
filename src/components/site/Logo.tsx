import { cn } from '@/lib/utils';

/**
 * Wordmark. Drawn in markup rather than shipped as an SVG asset so it inherits
 * the type scale and stays crisp at any size.
 */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span className="relative flex h-8 w-8 items-center justify-center">
        <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-vybe-400 to-vybe-700 opacity-90" />
        <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-vybe-400 to-vybe-700 blur-md opacity-60" />
        <span className="relative font-display text-[15px] font-extrabold leading-none text-white">
          H
        </span>
      </span>
      {!compact && (
        <span className="font-display text-[17px] font-extrabold leading-none tracking-tight text-chalk">
          HOUZ<span className="text-vybe-400">OF</span>VYBE
        </span>
      )}
    </span>
  );
}
