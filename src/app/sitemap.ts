import type { MetadataRoute } from 'next';

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/**
 * Static route list. Deliberately does not query Postgres — a sitemap that
 * fails to build because the database is briefly unreachable is worse than one
 * that omits a not-yet-announced event.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  }> = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/events/offcampus', priority: 0.95, changeFrequency: 'daily' },
    { path: '/events', priority: 0.9, changeFrequency: 'daily' },
    { path: '/book', priority: 0.85, changeFrequency: 'daily' },
    { path: '/gallery', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/faq', priority: 0.55, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/legal/terms', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/legal/privacy', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/legal/refunds', priority: 0.3, changeFrequency: 'yearly' },
  ];

  return routes.map((route) => ({
    url: `${BASE}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
