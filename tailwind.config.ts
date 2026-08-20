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
        // Print shadows: solid offsets, no blur. A blurred drop shadow says
        // "floating UI chrome"; a hard offset says "a card laid on a table",
        // which is the whole visual argument of this system. Interactive
        // things cast ink; large passive surfaces cast a paler blue so the
        // page doesn't turn into a woodcut.
        press: '3px 3px 0 0 #0a2138',
        'press-lg': '5px 5px 0 0 #0a2138',
        'press-sm': '2px 2px 0 0 #0a2138',
        stamp: '6px 6px 0 0 rgba(15,83,164,0.16)',
        'stamp-lg': '10px 10px 0 0 rgba(15,83,164,0.16)',
        'stamp-blue': '6px 6px 0 0 #bcdcff',
        ring: 'inset 0 0 0 1px rgba(194,216,238,0.9)',
        bevel: 'inset 0 1px 0 0 rgba(255,255,255,0.9)',
        // Legacy names still referenced by the admin console; mapped onto the
        // print ramp so nothing there silently loses its elevation.
        low: '3px 3px 0 0 rgba(15,83,164,0.12)',
        mid: '6px 6px 0 0 rgba(15,83,164,0.16)',
        high: '10px 10px 0 0 rgba(15,83,164,0.16)',
        lift: '12px 12px 0 0 rgba(15,83,164,0.18)',
        azure: '3px 3px 0 0 #0a2138',
        'azure-lg': '5px 5px 0 0 #0a2138',
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
