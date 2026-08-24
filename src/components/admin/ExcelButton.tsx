'use client';

import { cn } from '@/lib/utils';

/**
 * Download an .xlsx export.
 *
 * A plain anchor, not a fetch-and-blob dance. The server sets
 * Content-Disposition, so the browser saves the file itself — which also means
 * the download survives the page navigating away mid-transfer, and there is no
 * object URL to leak or revoke at the wrong moment.
 */
export function ExcelButton({
  sheet,
  label,
  className,
}: {
  /** 'bookings' | 'tickets' | 'customers' | 'referrals' | 'all' */
  sheet: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={`/api/admin/exports/${sheet}.xlsx`}
      download
      className={cn('btn-outline btn-sm gap-2 whitespace-nowrap px-4 py-2 text-[12px]', className)}
    >
      <ExcelIcon className="h-3.5 w-3.5" />
      {label ?? 'Download Excel'}
    </a>
  );
}

function ExcelIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
      aria-hidden
    >
      <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8Z" />
      <path d="M14 3v5h5" />
      <path d="m9.5 12.5 4 5M13.5 12.5l-4 5" strokeLinecap="round" />
    </svg>
  );
}
