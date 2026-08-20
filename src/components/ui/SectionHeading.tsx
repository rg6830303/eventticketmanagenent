import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Reveal } from './Reveal';

/**
 * The one heading block every marketing section uses, so kicker/title/lede
 * rhythm and entrance timing stay identical down the page.
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
  align?: 'left' | 'center';
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'max-w-3xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {kicker && (
        <Reveal>
          <p className="kicker mb-4">{kicker}</p>
        </Reveal>
      )}
      <Reveal delay={0.06}>
        <h2 className="h-section">{title}</h2>
      </Reveal>
      {lede && (
        <Reveal delay={0.12}>
          <p className={cn('lede mt-5', align === 'center' && 'mx-auto max-w-2xl')}>{lede}</p>
        </Reveal>
      )}
      {children && (
        <Reveal delay={0.18}>
          <div className="mt-8">{children}</div>
        </Reveal>
      )}
    </div>
  );
}
