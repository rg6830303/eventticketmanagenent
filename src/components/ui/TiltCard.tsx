'use client';

import { motion, useMotionTemplate, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Maximum rotation in degrees at the card's corners. */
  intensity?: number;
  /** Adds a specular highlight that tracks the pointer. */
  glare?: boolean;
}

/**
 * Pointer-reactive 3D tilt.
 *
 * The rotation is driven by springs rather than raw pointer values, so the card
 * keeps moving for a beat after the cursor stops — that overshoot is what makes
 * it read as a physical object instead of a CSS transform.
 *
 * Touch devices are skipped entirely: without hover there is no tilt to preview,
 * and binding to touchmove would fight the page scroll.
 */
export function TiltCard({ children, className, intensity = 9, glare = true }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  const spring = { stiffness: 220, damping: 22, mass: 0.6 };
  const rotateX = useSpring(useMotionValue(0), spring);
  const rotateY = useSpring(useMotionValue(0), spring);

  const glareBackground = useMotionTemplate`radial-gradient(circle 220px at ${useMotionTemplate`calc(${x} * 100%)`} ${useMotionTemplate`calc(${y} * 100%)`}, rgba(122,178,255,0.22), transparent 70%)`;

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (reduce || event.pointerType === 'touch' || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    x.set(px);
    y.set(py);
    // Invert Y so pushing the cursor up tips the top edge away from the viewer.
    rotateX.set((0.5 - py) * intensity * 2);
    rotateY.set((px - 0.5) * intensity * 2);
  }

  function handlePointerLeave() {
    rotateX.set(0);
    rotateY.set(0);
    x.set(0.5);
    y.set(0.5);
  }

  if (reduce) {
    return <div className={cn('relative', className)}>{children}</div>;
  }

  return (
    <div className="perspective">
      <motion.div
        ref={ref}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className={cn('relative will-change-transform', className)}
      >
        {children}
        {glare && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: glareBackground }}
          />
        )}
      </motion.div>
    </div>
  );
}

/**
 * Lifts a child forward on the Z axis inside a TiltCard, so headings and badges
 * separate from the card face as it rotates. Only meaningful within a
 * `preserve-3d` parent.
 */
export function TiltLayer({
  children,
  z = 40,
  className,
}: {
  children: ReactNode;
  z?: number;
  className?: string;
}) {
  return (
    <div className={cn('preserve-3d', className)} style={{ transform: `translateZ(${z}px)` }}>
      {children}
    </div>
  );
}
