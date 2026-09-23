import { cn } from '@/lib/utils';

/**
 * The one-line outcome under a form.
 *
 * Colour alone does not carry the meaning: the error variant is announced
 * assertively and the success one politely, so a screen reader hears the
 * failure immediately and is not interrupted mid-sentence by a confirmation.
 */
export function FormMessage({
  tone,
  children,
  className,
}: {
  tone: 'error' | 'success' | 'info';
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'rounded-md px-4 py-3 text-[0.875rem] leading-relaxed',
        tone === 'error' && 'bg-flare-100 text-flare-600 ring-1 ring-inset ring-flare-300',
        tone === 'success' && 'bg-leaf-100 text-leaf-600 ring-1 ring-inset ring-leaf-400/40',
        tone === 'info' && 'bg-vybe-50 text-vybe-700 ring-1 ring-inset ring-vybe-200',
        className,
      )}
    >
      {children}
    </p>
  );
}
