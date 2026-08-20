import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Instrument_Sans, Instrument_Serif, DM_Mono } from 'next/font/google';
import './globals.css';
import { BRAND, EVENT } from '@/content/site';
import { getSiteUrl } from '@/lib/site-url';

/**
 * Type system.
 *
 * Four families, each with one job, chosen so the page does not read like a
 * framework default:
 *   Bricolage Grotesque — headlines. Slightly condensed, high x-height, the
 *     kind of face a poster is set in.
 *   Instrument Sans     — everything a person reads in a paragraph or a field.
 *   Instrument Serif    — italic accent words only. It is the serif companion
 *     to the body face, so the pairing is by design rather than by taste.
 *   DM Mono             — codes, timers, prices, labels. Anything where the
 *     characters need to line up in a column.
 *
 * next/font self-hosts all four at build time, so the strict CSP in
 * next.config.mjs stays honest and there is no render-blocking third party.
 */
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  axes: ['opsz'],
  variable: '--font-display',
});

const sans = Instrument_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const script = Instrument_Serif({
  subsets: ['latin'],
  display: 'swap',
  weight: '400',
  style: 'italic',
  variable: '--font-script',
});

const mono = DM_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--font-mono',
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${BRAND.name} — ${EVENT.name} ${EVENT.editionShort}, ${EVENT.venue.area}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  keywords: [
    'OFF Campus Hyderabad',
    'freshers party Hyderabad',
    'Babylon Nanakramguda',
    'college party Hyderabad',
    'day party Hyderabad',
    'Houz of Vybe',
    'Hyderabad event tickets',
  ],
  authors: [{ name: BRAND.name }],
  creator: BRAND.name,
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: siteUrl,
    siteName: BRAND.name,
    title: `${EVENT.name} ${EVENT.editionShort} — ${EVENT.dateLabel}, ${EVENT.venue.name}`,
    description: BRAND.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${EVENT.name} ${EVENT.editionShort} — ${EVENT.dateLabel}`,
    description: BRAND.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: { canonical: '/' },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: '#f2f7fd',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-IN"
      className={`${sans.variable} ${display.variable} ${script.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Scroll-triggered entrances render at opacity 0 and are animated in by
          JavaScript. With scripting off they would never arrive, and whole
          sections — the activity grid, the prices — would simply be blank. This
          hands every one of them back the moment JS is unavailable.
        */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body className="min-h-dvh">
        {/* Keyboard users land here first; the nav is long on mobile. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]
                     focus:rounded-xl focus:bg-ink focus:px-5 focus:py-3 focus:text-sm
                     focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
