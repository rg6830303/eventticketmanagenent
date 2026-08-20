'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface ShareCrewProps {
  reference?: string;
  url?: string;
  title?: string;
  className?: string;
}

type Status = 'idle' | 'copied' | 'shared' | 'failed';

const SLOTS = 3;

export function ShareCrew({ reference, url, title = 'Houz of Vybe', className }: ShareCrewProps) {
  const [shareUrl, setShareUrl] = useState(url ?? '');
  const [canShare, setCanShare] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [invited, setInvited] = useState<boolean[]>(() => Array(SLOTS).fill(false));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  useEffect(() => {
    if (url) {
      setShareUrl(url);
      return;
    }
    // A booking or short-link URL carries somebody's live pass. Never hand that
    // out as the "bring your crew" link — fall back to the site root instead.
    const { origin, href, pathname } = window.location;
    const isPrivate = pathname.startsWith('/booking/') || pathname.startsWith('/t/');
    setShareUrl(isPrivate ? origin : href);
  }, [url]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function flash(next: Status) {
    setStatus(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), 2600);
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        flash('copied');
        return;
      }
    } catch {
      // Permission denied or a non-secure context — fall through to the shim.
    }

    try {
      const field = document.createElement('textarea');
      field.value = shareUrl;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.top = '0';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(field);
      flash(ok ? 'copied' : 'failed');
    } catch {
      flash('failed');
    }
  }

  async function share() {
    if (!shareUrl) return;
    if (canShare) {
      try {
        await navigator.share({ title, url: shareUrl });
        flash('shared');
        return;
      } catch (error) {
        // A dismissed sheet is not a failure; anything else falls back to copy.
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    await copy();
  }

  const message: Record<Status, string> = {
    idle: '',
    copied: 'Link copied.',
    shared: 'Share sheet opened.',
    failed: 'Could not copy — select the link above.',
  };

  return (
    <section
      className={cn('panel shadow-mid p-6 sm:p-7', className)}
      aria-label="Bring your crew"
    >
      <p className="kicker">Bring your crew</p>
      <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-ink">
        Send the link, not a screenshot
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-slate">
        Everyone books their own pass. One QR admits one person, so a forwarded screenshot gets your
        friend turned away at the door.
      </p>

      <p className="mt-5 truncate rounded-xl border border-edge bg-mist/70 px-4 py-3 font-mono text-[12px] tracking-wide text-slate">
        {shareUrl || 'Loading link…'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={share} className="btn-primary px-6 py-3 text-[13px]">
          {canShare ? 'Share link' : 'Copy link'}
        </button>
        {canShare && (
          <button type="button" onClick={copy} className="btn-outline btn-sm px-5 py-2.5 text-[13px]">
            Copy instead
          </button>
        )}
      </div>

      <p aria-live="polite" className="mt-3 min-h-[18px] text-[12px] text-pulse-600">
        {message[status]}
      </p>

      <div className="mt-5 border-t border-edge pt-5">
        <div className="flex items-center gap-3">
          <p
            id="share-crew-slots-label"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
          >
            Invite up to {SLOTS}
          </p>
          <div className="flex items-center gap-2" role="group" aria-labelledby="share-crew-slots-label">
            {invited.map((filled, index) => (
              <button
                key={index}
                type="button"
                aria-pressed={filled}
                aria-label={`Slot ${index + 1}${filled ? ', ticked off' : ', not ticked off'}`}
                onClick={() =>
                  setInvited((current) =>
                    current.map((value, position) => (position === index ? !value : value)),
                  )
                }
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-full border transition-all duration-200',
                  filled
                    ? 'border-vybe-400/70 bg-vybe-500/20 text-vybe-700'
                    : 'border-dashed border-edge text-muted hover:border-vybe-600 hover:text-slate',
                )}
              >
                {filled ? (
                  <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
                    <path
                      d="M5 12.5l4.2 4.2L19 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
                    <circle
                      cx="12"
                      cy="8.5"
                      r="3.4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    <path
                      d="M5.5 19c1.4-3.2 4-4.8 6.5-4.8s5.1 1.6 6.5 4.8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          A private tally for your own benefit — tick people off as you tell them. Nothing is sent,
          stored or counted.
          {reference ? ` Your booking reference is ${reference}.` : ''}
        </p>
      </div>
    </section>
  );
}

export default ShareCrew;
