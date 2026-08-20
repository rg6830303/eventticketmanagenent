import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Reveal } from './Reveal';

/**
 * The section opener, set editorially: heading and index label share a heavy
 * baseline rule, the lede hangs under it. One pattern for every page, so
 * "kicker above centred heading above lede" — the generated-landing-page
 * signature — appears nowhere.
 */
export function SectionHeading({
  kicker,
  title,
  lede,
  align = 'left',
  className,
  children,
}: {
  kicker?: string;
  title: ReactNode;
  lede?: ReactNode;
  /** Kept for call-site compatibility; the ruled head is always left-set. */
  align?: 'left' | 'center';
  className?: string;
  children?: ReactNode;
}) {
  void align;
  return (
    <div className={cn('max-w-none', className)}>
      <Reveal>
        <div className="edit-head">
          <h2 className="h-section max-w-[20ch]">{title}</h2>
          {kicker && <span className="edit-index">{kicker}</span>}
        </div>
      </Reveal>
      {lede && (
        <Reveal delay={0.08}>
          <p className="lede mt-4 max-w-2xl">{lede}</p>
        </Reveal>
      )}
      {children && (
        <Reveal delay={0.14}>
          <div className="mt-8">{children}</div>
        </Reveal>
      )}
    </div>
  );
}
