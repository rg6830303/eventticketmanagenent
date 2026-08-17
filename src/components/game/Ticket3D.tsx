'use client';

import { motion, useReducedMotion, useSpring } from 'framer-motion';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Globe } from '@/components/brand/Globe';
import { cn } from '@/lib/utils';

interface Ticket3DProps {
  holderName?: string;
  code?: string;
  tierName?: string;
  eventName?: string;
  date?: string;
  venue?: string;
  className?: string;
}

const SPRING = { stiffness: 160, damping: 18, mass: 0.9 };
const MAX_TILT_X = 30;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * A stand-in for a scannable code. Deterministic on purpose: a random pattern
 * would differ between the server and client render and blow up hydration, and
 * a real QR here would be a code that leads nowhere.
 */
function QrBlock({ className }: { className?: string }) {
  const n = 13;
  const cells: string[] = [];
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const inFinder =
        (x < 4 && y < 4) || (x >= n - 4 && y < 4) || (x < 4 && y >= n - 4);
      if (inFinder) continue;
      if ((x * 7 + y * 13 + x * y * 5) % 5 < 2) cells.push(`${x}-${y}`);
    }
  }

  return (
    <svg viewBox={`0 0 ${n} ${n}`} aria-hidden className={className}>
      {cells.map((id) => {
        const [x, y] = id.split('-').map(Number);
        return <rect key={id} x={x} y={y} width={1} height={1} rx={0.2} fill="currentColor" />;
      })}
      {([[0, 0], [n - 3, 0], [0, n - 3]] as const).map(([fx, fy]) => (
        <g key={`f-${fx}-${fy}`}>
          <rect
            x={fx + 0.3}
            y={fy + 0.3}
            width={2.4}
            height={2.4}
            rx={0.6}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.55}
          />
          <rect x={fx + 1.1} y={fy + 1.1} width={0.8} height={0.8} rx={0.2} fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

function Notches() {
  return (
    <>
      <span
        aria-hidden
        className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-hairline bg-void"
      />
      <span
        aria-hidden
        className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-hairline bg-void"
      />
    </>
  );
}

export function Ticket3D({
  holderName = 'Your name here',
  code = 'HOV-PREVIEW',
  tierName = 'General entry',
  eventName = 'Houz of Vybe',
  date = 'To be announced',
  venue = 'Hyderabad',
  className,
}: Ticket3DProps) {
  const reduce = useReducedMotion() ?? false;
  const [flipped, setFlipped] = useState(false);

  const rotateX = useSpring(0, SPRING);
  const rotateY = useSpring(0, SPRING);
  const drag = useRef<{ id: number; x: number; y: number; baseX: number; baseY: number } | null>(
    null,
  );

  useEffect(() => {
    if (reduce) return;
    rotateY.set(flipped ? 180 : 0);
    rotateX.set(0);
  }, [flipped, reduce, rotateX, rotateY]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (reduce) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      baseX: rotateX.get(),
      baseY: rotateY.get(),
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    rotateY.set(active.baseY + (event.clientX - active.x) * 0.45);
    rotateX.set(clamp(active.baseX - (event.clientY - active.y) * 0.35, -MAX_TILT_X, MAX_TILT_X));
  }

  function handlePointerRelease() {
    if (!drag.current) return;
    drag.current = null;
    rotateX.set(0);
    rotateY.set(flipped ? 180 : 0);
  }

  const front = (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[24px] border border-hairline bg-elevated/80 backdrop-blur-md shadow-[0_28px_70px_-34px_rgba(3,6,15,0.95)]">
      <Globe
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 text-flare/[0.08]"
        strokeWidth={1.8}
      />
      <span
        aria-hidden
        className="absolute inset-y-6 left-0 w-[5px] rounded-full bg-gradient-to-b from-pulse-400 via-vybe-500 to-vybe-700"
      />

      <div className="px-6 pt-6">
        <p className="eyebrow">{tierName}</p>
        <h3 className="mt-2 font-display text-2xl font-extrabold leading-none tracking-tight text-chalk">
          {eventName}
        </h3>
        <p className="mt-2 text-[13px] text-haze">{holderName}</p>
      </div>

      <div className="relative mt-5">
        <div className="mx-6 border-t border-dashed border-hairline/90" />
        <Notches />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-6">
        <div className="rounded-2xl border border-hairline bg-ink/70 p-4">
          <QrBlock className="h-28 w-28 text-vybe-200/85" />
        </div>
        <p className="mt-4 font-mono text-[13px] font-medium tracking-[0.18em] text-chalk">{code}</p>
        <p className="mt-1.5 text-center text-[11px] leading-relaxed text-dim">
          Artwork, not a scannable pass. The real QR is emailed when you book.
        </p>
      </div>
    </div>
  );

  const back = (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[24px] border border-hairline bg-surface/85 backdrop-blur-md shadow-[0_28px_70px_-34px_rgba(3,6,15,0.95)]">
      <Globe
        className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 text-vybe-500/[0.08]"
        strokeWidth={1.8}
      />

      <div className="px-6 pt-6">
        <p className="eyebrow">Pass details</p>
        <h3 className="mt-2 font-display text-xl font-bold leading-tight tracking-tight text-chalk">
          {eventName}
        </h3>
      </div>

      <dl className="mt-5 flex-1 space-y-4 px-6">
        <Row label="Holder" value={holderName} />
        <Row label="Tier" value={tierName} />
        <Row label="Doors" value={date} />
        <Row label="Venue" value={venue} />
        <Row label="Reference" value={code} mono />
      </dl>

      <div className="border-t border-hairline px-6 py-4">
        <p className="text-[11px] leading-relaxed text-dim">
          One scan per pass. Bring a government photo ID that matches the booking name.
        </p>
      </div>
    </div>
  );

  const faceBase = 'absolute inset-0 backface-hidden';

  return (
    <div className={cn('w-full max-w-[340px]', className)}>
      <div className={cn(!reduce && 'perspective-1000')}>
        {reduce ? (
          <div className="relative aspect-[3/4.15] w-full">{flipped ? back : front}</div>
        ) : (
          <motion.div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerRelease}
            onPointerCancel={handlePointerRelease}
            style={{ rotateX, rotateY, transformStyle: 'preserve-3d', touchAction: 'pan-y' }}
            className="preserve-3d relative aspect-[3/4.15] w-full cursor-grab will-change-transform active:cursor-grabbing"
          >
            <div className={faceBase} aria-hidden={flipped}>
              {front}
            </div>
            <div
              className={faceBase}
              style={{ transform: 'rotateY(180deg)' }}
              aria-hidden={!flipped}
            >
              {back}
            </div>
          </motion.div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setFlipped((current) => !current)}
          aria-pressed={flipped}
          className="btn-secondary px-5 py-2.5 text-[13px]"
        >
          {flipped ? 'Show the pass' : 'Show the details'}
        </button>
        {!reduce && (
          <p className="text-[11px] text-dim" aria-hidden>
            Drag to tilt
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline/70 pb-3 last:border-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-dim">{label}</dt>
      <dd
        className={cn(
          'min-w-0 truncate text-right text-[13px] text-chalk',
          mono && 'font-mono tracking-[0.12em]',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export default Ticket3D;
