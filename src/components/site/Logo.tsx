import { Logo as BrandLogo } from '@/components/brand/Logo';

/**
 * Backwards-compatible wrapper. The real mark lives in components/brand/Logo;
 * this keeps the older `compact` call sites working without a sweeping rename.
 */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return <BrandLogo variant={compact ? 'mark' : 'inline'} className={compact ? `h-8 w-8 ${className ?? ''}` : className} />;
}
