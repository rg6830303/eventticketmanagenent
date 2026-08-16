import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Core surfaces — near-black with a blue cast.
        void: '#03060f',
        ink: '#060a18',
        surface: '#0a1024',
        elevated: '#0f1730',
        hairline: '#1b2648',

        // Brand blues.
        vybe: {
          50: '#eaf2ff',
          100: '#d3e4ff',
          200: '#a8caff',
          300: '#74abff',
          400: '#4189ff',
          500: '#1f6bff',
          600: '#0f4fe0',
          700: '#0c3cad',
          800: '#0d3080',
          900: '#0f2a63',
          950: '#08183d',
        },
        // Electric accent used sparingly for highlights and glows.
        pulse: {
          300: '#7df2ff',
          400: '#38dcf5',
          500: '#12c2e9',
          600: '#0a9cc0',
        },
        // Text ramp.
        chalk: '#e9eefc',
        haze: '#9aa8cc',
        dim: '#63719b',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '10xl': ['9.5rem', { lineHeight: '0.85', letterSpacing: '-0.04em' }],
      },
      backgroundImage: {
        'grid-blue':
          'linear-gradient(to right, rgba(31,107,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(31,107,255,0.07) 1px, transparent 1px)',
        'radial-vybe':
          'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(31,107,255,0.28), transparent 65%)',
        'sheen':
          'linear-gradient(110deg, transparent 25%, rgba(122,178,255,0.35) 48%, transparent 70%)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(31,107,255,0.25), 0 12px 40px -12px rgba(31,107,255,0.55)',
        'glow-lg': '0 0 0 1px rgba(31,107,255,0.3), 0 30px 90px -20px rgba(31,107,255,0.6)',
        inset: 'inset 0 1px 0 0 rgba(255,255,255,0.06)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        sheen: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.35)', opacity: '0' },
          '100%': { transform: 'scale(1.35)', opacity: '0' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both',
        marquee: 'marquee 32s linear infinite',
        sheen: 'sheen 3.5s linear infinite',
        'pulse-ring': 'pulseRing 2.4s cubic-bezier(0.4,0,0.6,1) infinite',
        float: 'float 6s ease-in-out infinite',
        scanline: 'scanline 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
