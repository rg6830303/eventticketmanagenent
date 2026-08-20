import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

const BASE = getSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // /booking, /pay and /t are all keyed only by an unguessable reference.
      // Indexing them would put working passes — and a live checkout for
      // somebody else's order — into search results.
      disallow: ['/admin', '/admin/', '/api/', '/booking/', '/pay/', '/t/'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
