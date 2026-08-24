/** @type {import('next').NextConfig} */

// Content-Security-Policy is intentionally strict but permits the pieces this
// app genuinely needs: the Cashfree checkout SDK, Razorpay (kept for the
// legacy rail), blob: workers for the QR scanner, and data:/blob: images for
// generated QRs.
//
// form-action has to list Cashfree: their SDK leaves the page by POSTing a
// form to the hosted checkout, and 'self' alone silently blocks it — the
// button appears to do nothing and the console message is easy to miss.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.cashfree.com https://*.cashfree.com https://checkout.razorpay.com https://*.razorpay.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: data:",
  "connect-src 'self' https://*.cashfree.com https://sdk.cashfree.com https://*.razorpay.com https://lumberjack.razorpay.com",
  "frame-src 'self' https://*.cashfree.com https://*.razorpay.com https://www.google.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.cashfree.com",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // The admin console needs the camera; everything else is denied.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(self)' },
];

const nextConfig = {
  // An unrelated lockfile in the parent directory makes Next guess the wrong
  // workspace root, which breaks file tracing on Vercel.
  outputFileTracingRoot: import.meta.dirname,
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ['framer-motion', '@react-three/drei'],
  },
  transpilePackages: ['three'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Ticket pages and scan endpoints must never be cached by a CDN.
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },
  async redirects() {
    return [
      // '/tickets' is deliberately NOT here. next.config redirects run before
      // middleware, so a marketing redirect on that path fires on every host —
      // including the console's, where /tickets is a real page. It lives in
      // middleware now, where the host is already known.
      { source: '/offcampus', destination: '/events/offcampus', permanent: true },
    ];
  },
};

export default nextConfig;
