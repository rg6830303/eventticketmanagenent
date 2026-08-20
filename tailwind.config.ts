import type { Config } from 'tailwindcss';

/**
 * Design tokens for Houz of Vybe.
 *
 * The palette is a daylight one — the flagship event runs from noon, and a
 * midnight-black club site would be lying about what the afternoon feels like.
 *
 * The ground is blue, not white. White cards float on it and get their contrast
 * from that relationship; a white page with pale blue accents would flatten the
 * whole thing into a default template. One saturated azure carries every
 * action, a violet lifted off the event artwork appears only inside gradients,
 * and one warm red is reserved for scarcity and errors.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // --- Surfaces. `paper` sits on `canvas`, never the other way round. ---
        paper: '#ffffff',
        frost: '#f3f8fe',
        canvas: '#e4eefa',
        canvasDeep: '#d3e3f5',
        mist: '#cfe0f4',
        edge: '#c2d8ee',
        edgeStrong: '#9dbfe1',

        // --- Text ramp ---
        ink: '#0a2138',
        slate: '#3c5c7d',
        muted: '#7891ad',

        // --- Primary: azure ---
        vybe: {
          50: '#f0f7ff',
          100: '#dfeeff',
          200: '#bcdcff',
          300: '#8ac3ff',
          400: '#51a4fb',
          500: '#2586ef',
          600: '#1268cd',
          700: '#0f53a4',
          800: '#123f78',
          900: '#14355f',
          950: '#0b2a4d',
        },

        // --- Lifted off the event artwork. Gradients and glows only: at any
        //     size it stops supporting the blue and starts competing with it. ---
        orchid: {
          200: '#e2d5ff',
          300: '#c9b0ff',
          400: '#a985fb',
          500: '#8b5cf0',
          600: '#6d3fd1',
        },

        // --- Secondary: a cooler cyan for gradients and data ---
        pulse: {
          200: '#b6f0f6',
          300: '#7fe2ef',
          400: '#3fcbe0',
          500: '#18aec7',
          600: '#0d8aa1',
        },

        // --- Signal: the cherry red off the poster. Never a large fill. ---
        flare: {
          DEFAULT: '#e1303c',
          200: '#ffd4d7',
          300: '#f88b93',
          400: '#ef5a65',
          500: '#e1303c',
          600: '#bd1b26',
        },

        // --- Success / confirmed ---
        leaf: {
          100: '#d9f5e8',
          400: '#34c48c',
          500: '#12a06c',
          600: '#0b7d54',
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
          'linear-gradient(to right, rgba(37,134,239,0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,134,239,0.09) 1px, transparent 1px)',
        sheen: 'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.55) 48%, transparent 70%)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
      },
      boxShadow: {
        // A blue-tinted shadow ramp. Neutral grey shadows go muddy on a blue
        // ground, so every level carries the same hue as the background. Each
        // step pairs a tight contact shadow with a wide ambient one, which is
        // what stops a white card on blue from looking like a sticker.
        low: '0 1px 2px rgba(10,45,85,0.06), 0 3px 10px -3px rgba(10,45,85,0.08)',
        mid: '0 2px 4px rgba(10,45,85,0.06), 0 14px 32px -12px rgba(10,45,85,0.2)',
        high: '0 4px 8px rgba(10,45,85,0.07), 0 32px 68px -24px rgba(10,45,85,0.3)',
        lift: '0 12px 24px -10px rgba(10,45,85,0.2), 0 40px 80px -28px rgba(10,45,85,0.34)',
        azure: '0 10px 24px -10px rgba(37,134,239,0.55)',
        'azure-lg': '0 18px 40px -14px rgba(37,134,239,0.6)',
        ring: 'inset 0 0 0 1px rgba(194,216,238,0.9)',
        // Reads as light catching the top edge of a raised surface.
        bevel: 'inset 0 1px 0 0 rgba(255,255,255,0.9)',
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
        // The aurora behind the page. Three blobs on different periods, so the
        // composite never visibly repeats.
        aurora1: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(6%,-4%,0) scale(1.12)' },
        },
        aurora2: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1.05)' },
          '50%': { transform: 'translate3d(-7%,5%,0) scale(0.94)' },
        },
        aurora3: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(0.96)' },
          '50%': { transform: 'translate3d(4%,7%,0) scale(1.1)' },
        },
      },
      animation: {
        marquee: 'marquee 38s linear infinite',
        sheen: 'sheen 2.6s linear infinite',
        drift: 'drift 7s ease-in-out infinite',
        breathe: 'breathe 6s ease-in-out infinite',
        ping2: 'ping2 2.2s cubic-bezier(0,0,0.2,1) infinite',
        'spin-slow': 'spinSlow 40s linear infinite',
        aurora1: 'aurora1 26s ease-in-out infinite',
        aurora2: 'aurora2 34s ease-in-out infinite',
        aurora3: 'aurora3 30s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
