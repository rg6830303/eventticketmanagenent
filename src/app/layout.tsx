import type { Metadata, Viewport } from 'next';
import { Rozha_One, Mukta, Yatra_One, DM_Mono } from 'next/font/google';
import './globals.css';
import { BRAND, EVENT } from '@/content/site';
import { getSiteUrl } from '@/lib/site-url';
import { Environment } from '@/components/site/Environment';

/**
 * Type system, picked for a Navratri night rather than a SaaS dashboard:
 *   Rozha One  — headlines. A high-contrast display face drawn for Devanagari
 *     and Latin together; it reads like a hand-painted festival banner.
 *   Mukta      — body and fields. Built for Indian screens, sturdy at small
 *     sizes on cheap phones in bright light.
 *   Yatra One  — accent words only, the brush-lettered flourish.
 *   DM Mono    — ticket codes, references and timers that must line up.
 *
 * next/font self-hosts all four, so the CSP stays strict.
 */
const display = Rozha_One({
  subsets: ['latin'],
  display: 'swap',
  weight: '400',
  variable: '--font-display',
});

const sans = Mukta({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
});

const script = Yatra_One({
  subsets: ['latin'],
  display: 'swap',
  weight: '400',
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
    default: `${BRAND.name} — Hyderabad events, tickets and nights out`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  keywords: [
    'Dandiya Hyderabad',
    'garba night Hyderabad',
    'Navratri events Hyderabad',
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
    title: `${BRAND.name} — Hyderabad events and nights out`,
    description: BRAND.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — Hyderabad events and nights out`,
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
  themeColor: '#180611',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  colorScheme: 'dark',
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
          Runs before first paint. The poster intro is server-rendered as an
          opaque overlay, so a returning visitor would otherwise see a frame of
          it on every navigation before React could take it away. Setting the
          flag here lets CSS hide it in the same paint.
        */}
        <script
          // eslint-disable-next-line react/no-danger -- must execute synchronously, before paint.
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem('hov:intro-seen')==='1'){document.documentElement.setAttribute('data-intro-seen','1')}}catch(e){}`,
          }}
        />
        {/*
          Scroll-triggered entrances render at opacity 0 and are animated in by
          JavaScript. With scripting off they would never arrive, and whole
          sections — the activity grid, the prices — would simply be blank. This
          hands every one of them back the moment JS is unavailable, and drops
          the intro overlay that would otherwise never lift.
        */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}#poster-intro{display:none!important}`}</style>
        </noscript>
      </head>
      <body className="min-h-dvh">
        <Environment />
        {/* Keyboard users land here first; the nav is long on mobile. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]
                     focus:rounded-xl focus:bg-ink focus:px-5 focus:py-3 focus:text-sm
                     focus:font-semibold focus:text-night"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
