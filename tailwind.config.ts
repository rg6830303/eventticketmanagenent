import type { Config } from 'tailwindcss';

/**
 * Design tokens for Houz of Vybe.
 *
 * The palette is a daylight one — the flagship event runs from noon, and a
 * midnight-black club site would be lying about what the afternoon feels like.
 * Everything is built on a paper-white card surface floating over a pale blue
 * canvas, with a single saturated azure carrying every action and one warm red
 * reserved for scarcity and errors.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // --- Surfaces, lightest content first ---
        paper: '#ffffff',
        canvas: '#f2f7fd',
        frost: '#e9f1fb',
        mist: '#dde9f7',
        edge: '#cbdcef',
        edgeStrong: '#adc8e4',

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
      boxShadow: {
        // A blue-tinted shadow ramp. Neutral grey shadows go muddy on a blue
        // canvas, so every level carries the same hue as the background.
        low: '0 1px 2px rgba(12,45,80,0.05), 0 2px 8px -2px rgba(12,45,80,0.06)',
        mid: '0 2px 4px rgba(12,45,80,0.04), 0 12px 28px -10px rgba(12,45,80,0.16)',
        high: '0 4px 8px rgba(12,45,80,0.05), 0 28px 60px -20px rgba(12,45,80,0.24)',
        lift: '0 10px 20px -8px rgba(12,45,80,0.16), 0 32px 64px -24px rgba(12,45,80,0.28)',
        azure: '0 10px 24px -10px rgba(37,134,239,0.55)',
        'azure-lg': '0 18px 40px -14px rgba(37,134,239,0.6)',
        ring: 'inset 0 0 0 1px rgba(203,220,239,0.9)',
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
