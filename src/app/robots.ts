import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

const BASE = getSiteUrl();

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
