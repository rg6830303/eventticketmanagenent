'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds of delay before this element animates. */
  delay?: number;
  direction?: Direction;
  /** Travel distance in px. */
  distance?: number;
  /** Run every time it scrolls into view instead of only the first time. */
  repeat?: boolean;
  as?: 'div' | 'section' | 'article' | 'li' | 'span';
}

const OFFSETS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
  none: { x: 0, y: 0 },
};

/**
 * Scroll-triggered entrance. The whole site's motion vocabulary funnels through
 * this component and `Stagger`, so timing stays consistent instead of every
 * section inventing its own easing.
 *
 * Reduced-motion users get the final state immediately — no fade, no travel.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  direction = 'up',
  distance = 24,
  repeat = false,
  as = 'div',
}: RevealProps) {
  const reduce = useReducedMotion();
  const offset = OFFSETS[direction];
  const Component = motion[as];

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <Component
      className={cn(className)}
      initial={{ opacity: 0, x: offset.x * distance, y: offset.y * distance }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: !repeat, margin: '-80px 0px -80px 0px' }}
      transition={{
        duration: 0.7,
        delay,
        // Strong ease-out: fast start, long settle. Reads as "arriving", not "sliding".
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </Component>
  );
}

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } },
};

/** Wrap a list; every direct <StaggerItem> child cascades in. */
export function Stagger({
  children,
  className,
  amount = 0.2,
}: {
  children: ReactNode;
  className?: string;
  amount?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
