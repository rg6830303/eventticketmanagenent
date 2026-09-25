'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/** POST/PATCH/DELETE JSON to the console API and return `{ ok, data, error }`. */
export async function call<T = Record<string, unknown>>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<{ ok: boolean; data: T | null; error: string | null }> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await response.json().catch(() => ({}))) as { data?: T; error?: string };
    if (!response.ok) return { ok: false, data: null, error: json.error ?? `Request failed (${response.status})` };
    return { ok: true, data: json.data ?? null, error: null };
  } catch {
    return { ok: false, data: null, error: 'Could not reach the server' };
  }
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="mb-1 block text-[11px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10.5px] leading-snug text-muted">{hint}</span>}
    </label>
  );
}

export function Note({ tone, children }: { tone: 'ok' | 'bad'; children: React.ReactNode }) {
  return (
    <p
      role={tone === 'bad' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg px-3 py-2 text-[12.5px] font-medium',
        tone === 'ok' ? 'bg-leaf-600/10 text-leaf-600' : 'bg-flare-200/40 text-flare-600',
      )}
    >
      {children}
    </p>
  );
}

/** Shows a freshly set login code once, with copy and share. */
export function CodeReveal({ code, name, onDone }: { code: string; name: string; onDone?: () => void }) {
  const [copied, setCopied] = useState(false);
  const message = `Hi ${name.split(' ')[0]}, your Houz of Vybe promoter dashboard: https://www.houzofvybe.com/promoter\nLogin code: ${code}`;
  return (
    <div className="rounded-xl border-[1.5px] border-ink bg-vybe-100 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Login code — shown once</p>
      <p className="mt-1 break-all font-mono text-2xl font-bold tracking-[0.12em] text-ink">{code}</p>
      <p className="mt-1 text-[12px] text-slate">
        Share it with {name}. They sign in at <span className="font-mono">houzofvybe.com/promoter</span>. It
        cannot be viewed again — set a new one if it is lost.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-outline px-3 py-1.5 text-[12px]"
          onClick={() => {
            void navigator.clipboard?.writeText(message).then(() => setCopied(true));
          }}
        >
          {copied ? 'Copied' : 'Copy message'}
        </button>
        <a
          className="btn-outline px-3 py-1.5 text-[12px]"
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
        >
          Send on WhatsApp
        </a>
        {onDone && (
          <button type="button" className="btn-primary px-3 py-1.5 text-[12px]" onClick={onDone}>
            Done
          </button>
        )}
      </div>
    </div>
  );
}
