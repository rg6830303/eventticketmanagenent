'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface CelebrationProps {
  /** Flip to true at the moment worth celebrating. Flipping back and true again re-fires. */
  fire: boolean;
  className?: string;
}

/** Brand blues carry the burst; the logo red is a single accent, not a colour. */
const COLOURS = ['#1f6bff', '#4189ff', '#74abff', '#38dcf5', '#7df2ff', '#e9eefc'];
const ACCENT = '#F5242B';

const COUNT = 120;
const GRAVITY = 0.32;
const DRAG = 0.988;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  rot: number;
  spin: number;
  colour: string;
}

export function Celebration({ fire, className }: CelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Resolved after mount so the server render and the first client render
  // agree; under reduced motion the component simply never exists.
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (!enabled || !fire) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let frame = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const originX = width / 2;
    const originY = height * 0.42;

    const particles: Particle[] = Array.from({ length: COUNT }, (_, index) => {
      const angle = (index / COUNT) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 3.2 + Math.random() * 6.4;
      const max = 62 + Math.random() * 48;
      return {
        x: originX + (Math.random() - 0.5) * 24,
        y: originY + (Math.random() - 0.5) * 16,
        vx: Math.cos(angle) * speed,
        // Biased upward so it reads as a burst rather than an explosion in a jar.
        vy: Math.sin(angle) * speed - 3.4,
        life: max,
        max,
        size: 3 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.28,
        colour: index % 12 === 0 ? ACCENT : COLOURS[index % COLOURS.length],
      };
    });

    let previous = performance.now();

    const step = (now: number) => {
      const delta = Math.min(48, now - previous) / 16.6667;
      previous = now;

      ctx.clearRect(0, 0, width, height);
      let alive = 0;

      for (const particle of particles) {
        if (particle.life <= 0) continue;

        particle.vy += GRAVITY * delta;
        particle.vx *= Math.pow(DRAG, delta);
        particle.vy *= Math.pow(DRAG, delta);
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.rot += particle.spin * delta;
        particle.life -= delta;

        if (particle.life <= 0 || particle.y - particle.size > height) continue;
        alive += 1;

        const fade = Math.max(0, Math.min(1, particle.life / particle.max));
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rot);
        ctx.fillStyle = particle.colour;
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.62);
        ctx.restore();
      }

      // Self-terminating: once nothing is left to draw the loop stops instead of
      // holding a frame callback open for the life of the page.
      if (alive === 0) {
        ctx.clearRect(0, 0, width, height);
        frame = 0;
        return;
      }

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    window.addEventListener('resize', resize);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, width, height);
    };
  }, [enabled, fire]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  );
}

export default Celebration;
