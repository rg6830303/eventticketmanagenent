import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';

/**
 * The frame every account screen sits in.
 *
 * One plate, centred, narrow. These pages have exactly one job each and the
 * layout says so — no nav, no marketing, nothing to click that is not the
 * thing they came to do.
 */
export function AuthShell({
  eyebrow,
  title,
  lede,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="shell-narrow flex min-h-[80dvh] flex-col justify-center py-28">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-block rounded-pill" aria-label="Houz of Vybe — home">
          <Logo variant="inline" />
        </Link>
      </div>

      <div className="card p-7 sm:p-9">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="h-section mt-3 text-[clamp(1.6rem,4vw,2.1rem)]">{title}</h1>
        {lede && <p className="mt-3 text-[0.9375rem] leading-relaxed text-slate">{lede}</p>}
        <div className="mt-7">{children}</div>
      </div>

      {footer && <div className="mt-6 text-center text-[0.875rem] text-slate">{footer}</div>}
    </div>
  );
}
