import type { Config } from 'tailwindcss';

/**
 * Design tokens for Houz of Vybe.
 *
 * The palette is a daylight one — the flagship event runs from noon, and a
 * midnight-black club site would be lying about what the afternoon feels like.
 * The ground is blue, not white. Surfaces float on it and get their contrast
 * from that relationship.
 *
 * The *colours* below are unchanged. Everything built on top of them was
 * rebuilt: the previous system was a print pastiche — ink hairlines and hard
 * offset shadows, a woodcut of a website. It photographed well and worked
 * badly: every surface shouted at the same volume, so nothing could be
 * emphasised, and on a phone the 1.5px black boxes stacked into a grid of
 * cells with no depth to read.
 *
 * What replaces it is soft depth. One light source, shadows tinted with the
 * ink rather than black, hairline rings instead of borders, and generous
 * radii. Elevation now carries meaning: the further a surface is off the page,
 * the more it matters. Colour is reserved for action — one azure gradient
 * carries every primary CTA, and nothing else in the interface uses it.
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
          100: '#ffe9eb',
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
      /**
       * Radii as a named ramp rather than ad-hoc pixel values. Controls are
       * `pill`; things that hold content step up with their size, so a modal
       * is never as tight as the chip inside it.
       */
      borderRadius: {
        xs: '8px',
        sm: '10px',
        md: '14px',
        lg: '18px',
        xl: '24px',
        '2xl': '30px',
        '3xl': '38px',
        pill: '999px',
      },
      backgroundImage: {
        // The one gradient that means "this is the action".
        aurora: 'linear-gradient(135deg, #2586ef 0%, #1268cd 55%, #6d3fd1 130%)',
        'aurora-soft': 'linear-gradient(135deg, #dfeeff 0%, #f0f7ff 45%, #e2d5ff 120%)',
        'aurora-line': 'linear-gradient(90deg, #2586ef, #18aec7 45%, #8b5cf0)',
        'ink-deep': 'linear-gradient(150deg, #123f78 0%, #0a2138 60%, #0b2a4d 100%)',
        sheen: 'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.55) 48%, transparent 70%)',
        'grid-blue':
          'linear-gradient(to right, rgba(37,134,239,0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,134,239,0.09) 1px, transparent 1px)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
      },
      /**
       * One light source, high and slightly forward. Every shadow is tinted
       * with the ink (#0a2138) rather than black, so elevation reads as depth
       * in a blue room instead of a grey smudge laid over it.
       *
       * `hair` → `soft` → `raise` → `float` → `loft` is the elevation ladder.
       * Nothing should skip two rungs inside one screen.
       */
      boxShadow: {
        hair: '0 0 0 1px rgba(10,33,56,0.06)',
        soft: '0 1px 2px rgba(10,33,56,0.04), 0 4px 14px -4px rgba(10,33,56,0.08)',
        raise:
          '0 1px 2px rgba(10,33,56,0.04), 0 6px 16px -4px rgba(10,33,56,0.08), 0 14px 32px -12px rgba(10,33,56,0.12)',
        float:
          '0 2px 4px rgba(10,33,56,0.04), 0 12px 28px -8px rgba(10,33,56,0.12), 0 28px 60px -20px rgba(10,33,56,0.18)',
        loft:
          '0 4px 8px rgba(10,33,56,0.05), 0 20px 44px -12px rgba(10,33,56,0.16), 0 44px 96px -32px rgba(10,33,56,0.24)',
        // Colour-bearing elevation: only the primary action gets it.
        glow: '0 6px 16px -4px rgba(37,134,239,0.38), 0 14px 34px -12px rgba(37,134,239,0.34)',
        'glow-lg': '0 10px 24px -6px rgba(37,134,239,0.45), 0 24px 52px -16px rgba(37,134,239,0.4)',
        bevel: 'inset 0 1px 0 0 rgba(255,255,255,0.75)',
        ring: 'inset 0 0 0 1px rgba(194,216,238,0.9)',
        /* ---- Legacy names ----------------------------------------------
           Names from the print system, still referenced in places that have
           not been touched since. Remapped onto the ladder above so nothing
           renders an offset black block by accident. */
        press: '0 1px 2px rgba(10,33,56,0.04), 0 4px 14px -4px rgba(10,33,56,0.08)',
        'press-sm': '0 1px 2px rgba(10,33,56,0.05)',
        'press-lg':
          '0 1px 2px rgba(10,33,56,0.04), 0 6px 16px -4px rgba(10,33,56,0.08), 0 14px 32px -12px rgba(10,33,56,0.12)',
        stamp: '0 1px 2px rgba(10,33,56,0.04), 0 4px 14px -4px rgba(10,33,56,0.08)',
        'stamp-lg':
          '0 2px 4px rgba(10,33,56,0.04), 0 12px 28px -8px rgba(10,33,56,0.12), 0 28px 60px -20px rgba(10,33,56,0.18)',
        'stamp-blue': '0 6px 16px -4px rgba(37,134,239,0.24)',
        low: '0 1px 2px rgba(10,33,56,0.04), 0 4px 14px -4px rgba(10,33,56,0.08)',
        mid: '0 1px 2px rgba(10,33,56,0.04), 0 6px 16px -4px rgba(10,33,56,0.08), 0 14px 32px -12px rgba(10,33,56,0.12)',
        high: '0 2px 4px rgba(10,33,56,0.04), 0 12px 28px -8px rgba(10,33,56,0.12), 0 28px 60px -20px rgba(10,33,56,0.18)',
        lift: '0 4px 8px rgba(10,33,56,0.05), 0 20px 44px -12px rgba(10,33,56,0.16)',
        azure: '0 6px 16px -4px rgba(37,134,239,0.38)',
        'azure-lg': '0 10px 24px -6px rgba(37,134,239,0.45)',
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
        // Slow parallax wander for the background blooms.
        bloom: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(2%,-3%,0) scale(1.06)' },
        },
        // Used by loading rows and the skeleton state.
        shimmer: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(100%)' },
        },
      },
      animation: {
        marquee: 'marquee 38s linear infinite',
        sheen: 'sheen 2.6s linear infinite',
        drift: 'drift 7s ease-in-out infinite',
        breathe: 'breathe 6s ease-in-out infinite',
        ping2: 'ping2 2.2s cubic-bezier(0,0,0.2,1) infinite',
        'spin-slow': 'spinSlow 40s linear infinite',
        bloom: 'bloom 22s ease-in-out infinite',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
