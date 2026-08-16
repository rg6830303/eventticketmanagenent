'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: GridIcon, exact: true },
  { href: '/admin/scan', label: 'Scan', icon: ScanIcon },
  { href: '/admin/bookings', label: 'Bookings', icon: ListIcon },
  { href: '/admin/checkins', label: 'Door log', icon: PulseIcon },
];

export function AdminNav({ variant = 'bar' }: { variant?: 'bar' | 'tabs' }) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  if (variant === 'tabs') {
    return (
      <nav aria-label="Console" className="grid grid-cols-4">
        {ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              // Tall targets: this is tapped with a thumb, often while holding a phone
              // in one hand and a guest's screen in the other.
              className={cn(
                'flex min-h-[60px] flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                active ? 'text-vybe-300' : 'text-dim',
              )}
            >
              <item.icon className="h-5 w-5" active={active} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Console" className="flex items-center gap-1 overflow-x-auto">
      {ITEMS.map((item) => {
        const active = isActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
              active
                ? 'border-vybe-500 text-chalk'
                : 'border-transparent text-haze hover:text-chalk',
            )}
          >
            <item.icon className="h-4 w-4" active={active} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

type IconProps = { className?: string; active?: boolean };

function GridIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ScanIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8" strokeLinecap="round" />
      <path d="M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8" strokeLinecap="round" />
      <path d="M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16" strokeLinecap="round" />
      <path d="M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" strokeLinecap="round" />
      <path d="M3 12h18" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" />
      <circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PulseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <path d="M2 12h4l3-8 6 16 3-8h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
