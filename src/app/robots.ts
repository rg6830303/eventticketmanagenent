import type { MetadataRoute } from 'next';

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // /booking and /t hold live passes keyed only by an unguessable value —
      // indexing them would put working tickets into search results.
      disallow: ['/admin', '/admin/', '/api/', '/booking/', '/t/'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
