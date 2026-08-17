'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Globe } from '@/components/brand/Globe';
import { TiltCard, TiltLayer } from '@/components/ui/TiltCard';

export interface RoomSpec {
  name: string;
  time: string;
  sound: string;
  copy: string;
  /** Hue in degrees, from the content module. Drives this room's whole tint. */
  hue: number;
}

function tint(hue: number, lightness: number, alpha: number) {
  return `hsl(${hue} 84% ${lightness}% / ${alpha})`;
}

/**
 * The card face.
 *
 * No `overflow-hidden` on the element that carries `preserve-3d`: browsers flatten
 * a 3D context the moment overflow is clipped, which would collapse every
 * TiltLayer back onto the card face. Clipping happens on the decorative
 * sub-layers instead, which have no children to keep in 3D.
 */
function RoomFace({ room, index }: { room: RoomSpec; index: number }) {
  return (
    <article
      className="preserve-3d relative flex h-full flex-col rounded-2xl border bg-surface/70 p-7 backdrop-blur-md"
      style={{
        borderColor: tint(room.hue, 62, 0.3),
        boxShadow: `0 30px 80px -40px ${tint(room.hue, 55, 0.55)}`,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 overflow-hidden rounded-[inherit]"
        style={{
          background: `radial-gradient(120% 85% at 10% 0%, ${tint(room.hue, 48, 0.34)}, transparent 62%)`,
        }}
      >
        <div className="absolute inset-0 grid-overlay opacity-60" />
        <div
          className="absolute -right-12 -top-14 h-44 w-44"
          style={{ color: tint(room.hue, 70, 0.13) }}
        >
          <Globe className="h-full w-full" strokeWidth={1.6} />
        </div>
        {/* Top bevel, tinted to the room rather than the global blue. */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${tint(room.hue, 78, 0.7)}, transparent)`,
          }}
        />
      </div>

      <TiltLayer z={70} className="relative flex items-center justify-between gap-4">
        <p
          className="font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: tint(room.hue, 78, 0.95) }}
        >
          {room.time}
        </p>
        <span className="font-mono text-[10px] text-dim">0{index + 1}</span>
      </TiltLayer>

      <TiltLayer z={96} className="relative mt-4">
        <h3 className="font-display text-2xl font-bold leading-tight text-chalk">{room.name}</h3>
      </TiltLayer>

      <TiltLayer z={54} className="relative mt-2">
        <p className="text-[12px] font-medium" style={{ color: tint(room.hue, 72, 0.9) }}>
          {room.sound}
        </p>
      </TiltLayer>

      <TiltLayer z={26} className="relative mt-5">
        <p className="text-[14px] leading-relaxed text-haze">{room.copy}</p>
      </TiltLayer>

      <TiltLayer z={40} className="relative mt-auto pt-7">
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ borderColor: tint(room.hue, 62, 0.35), color: tint(room.hue, 80, 0.95) }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: tint(room.hue, 70, 1) }}
          />
          Room {index + 1} of 3
        </span>
      </TiltLayer>
    </article>
  );
}

/**
 * Rooms rendered as physical objects.
 *
 * Pointers that can hover get the tilt; everything else gets a 3D entrance
 * instead, because a tilt nobody can trigger is dead weight in the bundle's
 * behaviour, not a feature.
 */
export function RoomCards({ rooms }: { rooms: readonly RoomSpec[] }) {
  const reduce = useReducedMotion();
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    setCanHover(query.matches);
    const onChange = (event: MediaQueryListEvent) => setCanHover(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return (
    <ul className="perspective-1000 mt-14 grid list-none gap-5 lg:grid-cols-3">
      {rooms.map((room, index) => (
        <li key={room.name} className="h-full">
          {canHover && !reduce ? (
            <TiltCard intensity={11} className="group h-full">
              <RoomFace room={room} index={index} />
            </TiltCard>
          ) : reduce ? (
            <RoomFace room={room} index={index} />
          ) : (
            <motion.div
              className="h-full preserve-3d"
              initial={{ opacity: 0, y: 34, rotateX: -14, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.75, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <RoomFace room={room} index={index} />
            </motion.div>
          )}
        </li>
      ))}
    </ul>
  );
}
