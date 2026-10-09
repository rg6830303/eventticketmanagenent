import type { Config } from 'tailwindcss';

/**
 * Design tokens for Houz of Vybe.
 *
 * Navratri at night: a deep sindoor-maroon ground, marigold for every action,
 * rani pink and peacock teal from chaniya-choli embroidery for gradients and
 * data, cream for text. Values live in globals.css as RGB channels so opacity
 * modifiers (`bg-ink/20`) keep working.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      // Every colour is a CSS variable (globals.css). The public site runs the
      // festival-night palette; the console swaps back to daylight with
      // `.theme-console`, so one set of class names serves both.
      colors: {
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
        frost: 'rgb(var(--c-frost) / <alpha-value>)',
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        canvasDeep: 'rgb(var(--c-canvas-deep) / <alpha-value>)',
        mist: 'rgb(var(--c-mist) / <alpha-value>)',
        edge: 'rgb(var(--c-edge) / <alpha-value>)',
        edgeStrong: 'rgb(var(--c-edge-strong) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        slate: 'rgb(var(--c-slate) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        night: 'rgb(var(--c-night) / <alpha-value>)',
        vybe: {
          50: 'rgb(var(--c-vybe-50) / <alpha-value>)',
          100: 'rgb(var(--c-vybe-100) / <alpha-value>)',
          200: 'rgb(var(--c-vybe-200) / <alpha-value>)',
          300: 'rgb(var(--c-vybe-300) / <alpha-value>)',
          400: 'rgb(var(--c-vybe-400) / <alpha-value>)',
          500: 'rgb(var(--c-vybe-500) / <alpha-value>)',
          600: 'rgb(var(--c-vybe-600) / <alpha-value>)',
          700: 'rgb(var(--c-vybe-700) / <alpha-value>)',
          800: 'rgb(var(--c-vybe-800) / <alpha-value>)',
          900: 'rgb(var(--c-vybe-900) / <alpha-value>)',
          950: 'rgb(var(--c-vybe-950) / <alpha-value>)',
        },
        orchid: {
          200: 'rgb(var(--c-orchid-200) / <alpha-value>)',
          300: 'rgb(var(--c-orchid-300) / <alpha-value>)',
          400: 'rgb(var(--c-orchid-400) / <alpha-value>)',
          500: 'rgb(var(--c-orchid-500) / <alpha-value>)',
          600: 'rgb(var(--c-orchid-600) / <alpha-value>)',
        },
        pulse: {
          200: 'rgb(var(--c-pulse-200) / <alpha-value>)',
          300: 'rgb(var(--c-pulse-300) / <alpha-value>)',
          400: 'rgb(var(--c-pulse-400) / <alpha-value>)',
          500: 'rgb(var(--c-pulse-500) / <alpha-value>)',
          600: 'rgb(var(--c-pulse-600) / <alpha-value>)',
        },
        flare: {
          DEFAULT: 'rgb(var(--c-flare-500) / <alpha-value>)',
          200: 'rgb(var(--c-flare-200) / <alpha-value>)',
          300: 'rgb(var(--c-flare-300) / <alpha-value>)',
          400: 'rgb(var(--c-flare-400) / <alpha-value>)',
          500: 'rgb(var(--c-flare-500) / <alpha-value>)',
          600: 'rgb(var(--c-flare-600) / <alpha-value>)',
        },
        leaf: {
          100: 'rgb(var(--c-leaf-100) / <alpha-value>)',
          400: 'rgb(var(--c-leaf-400) / <alpha-value>)',
          500: 'rgb(var(--c-leaf-500) / <alpha-value>)',
          600: 'rgb(var(--c-leaf-600) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        script: ['var(--font-script)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.045em',
      },
      backgroundImage: {
        'grid-blue':
          'linear-gradient(to right, rgb(var(--c-vybe-500) / 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--c-vybe-500) / 0.08) 1px, transparent 1px)',
        sheen: 'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.18) 48%, transparent 70%)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
      },
      boxShadow: {
        // Solid offsets, no blur. Interactive things cast the accent; passive
        // surfaces cast a deep shadow tone so the page stays calm.
        press: '3px 3px 0 0 rgb(var(--c-press))',
        'press-lg': '5px 5px 0 0 rgb(var(--c-press))',
        'press-sm': '2px 2px 0 0 rgb(var(--c-press))',
        stamp: '6px 6px 0 0 rgb(var(--c-stamp) / var(--stamp-a))',
        'stamp-lg': '10px 10px 0 0 rgb(var(--c-stamp) / var(--stamp-a))',
        'stamp-blue': '6px 6px 0 0 rgb(var(--c-vybe-200))',
        ring: 'inset 0 0 0 1px rgb(var(--c-edge) / 0.9)',
        bevel: 'inset 0 1px 0 0 rgb(255 255 255 / 0.08)',
        low: '3px 3px 0 0 rgb(var(--c-stamp) / var(--stamp-a))',
        mid: '6px 6px 0 0 rgb(var(--c-stamp) / var(--stamp-a))',
        high: '10px 10px 0 0 rgb(var(--c-stamp) / var(--stamp-a))',
        lift: '12px 12px 0 0 rgb(var(--c-stamp) / var(--stamp-a))',
        azure: '3px 3px 0 0 rgb(var(--c-press))',
        'azure-lg': '5px 5px 0 0 rgb(var(--c-press))',
      },
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        sheen: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        drift: {
          '0%,100%': { transform: 'translate3d(0,0,0)' },
          '50%': { transform: 'translate3d(0,-14px,0)' },
        },
        breathe: {
          '0%,100%': { transform: 'scale(1)', opacity: '0.55' },
          '50%': { transform: 'scale(1.08)', opacity: '0.85' },
        },
        ping2: {
          '0%': { transform: 'scale(0.85)', opacity: '0.7' },
          '75%,100%': { transform: 'scale(1.9)', opacity: '0' },
        },
        spinSlow: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        marquee: 'marquee 38s linear infinite',
        sheen: 'sheen 2.6s linear infinite',
        drift: 'drift 7s ease-in-out infinite',
        breathe: 'breathe 6s ease-in-out infinite',
        ping2: 'ping2 2.2s cubic-bezier(0,0,0.2,1) infinite',
        'spin-slow': 'spinSlow 40s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
