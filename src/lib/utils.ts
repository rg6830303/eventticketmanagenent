import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class joiner used by every component. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** 250000 -> "₹2,500" */
export function formatInr(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees);
}

const IST = 'Asia/Kolkata';

/** Dates are always rendered in IST — the venue's clock, not the viewer's. */
export function formatEventDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: IST,
  }).format(date);
}

export function formatEventTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: IST,
  }).format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: IST,
  }).format(date);
}

/** "2 min ago" / "just now" — used in the admin live feed. */
export function timeAgo(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Mask an address for display in the admin list: r****l@gmail.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 6))}${local.at(-1)}@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  return `${digits.slice(0, 2)}${'*'.repeat(digits.length - 4)}${digits.slice(-2)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Milliseconds until `target`, broken into display units. Never negative. */
export function countdownParts(target: string | Date) {
  const date = typeof target === 'string' ? new Date(target) : target;
  const diff = Math.max(0, date.getTime() - Date.now());
  return {
    total: diff,
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  };
}

/** [1000,1001,1002,1005] → "1000–1002, 1005". Empty string for none. */
export function serialRanges(serials: number[]): string {
  const sorted = [...new Set(serials)].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j += 1;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j + 1;
  }
  return parts.join(', ');
}

/**
 * Parse serials as people type them: "1005", "1005, 1007", "1005-1010",
 * "#1005 1006". Returns sorted unique numbers, or an error message.
 */
export function parseSerialList(input: string, max = 4000): { serials: number[] } | { error: string } {
  const text = input.replace(/#/g, '').trim();
  if (!text) return { error: 'Enter a serial number' };
  const out = new Set<number>();
  for (const part of text.split(/[,\s]+/).filter(Boolean)) {
    const range = part.match(/^(\d{1,5})\s*[-–]\s*(\d{1,5})$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (from > to) return { error: `${part}: the first number must come first` };
      if (to - from + 1 > max) return { error: `${part} is more than ${max} serials` };
      for (let n = from; n <= to; n += 1) out.add(n);
    } else if (/^\d{1,5}$/.test(part)) {
      out.add(Number(part));
    } else {
      return { error: `"${part}" is not a serial number` };
    }
    if (out.size > max) return { error: `At most ${max} serials at once` };
  }
  return { serials: [...out].sort((a, b) => a - b) };
}
