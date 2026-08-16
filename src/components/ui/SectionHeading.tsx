import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Reveal } from './Reveal';

/**
 * The one heading block every marketing section uses, so eyebrow/title/lede
 * rhythm and entrance timing stay identical down the page.
 */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = 'left',
  className,
  children,
}: {
  eyebrow?: string;
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
      {eyebrow && (
        <Reveal>
          <p className="eyebrow mb-4">{eyebrow}</p>
        </Reveal>
      )}
      <Reveal delay={0.06}>
        <h2 className="display-2">{title}</h2>
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
