import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';
import { listPublicSlugs } from '@/lib/events';

const BASE = getSiteUrl();

/**
 * The static routes, plus whatever events exist.
 *
 * The event list is queried but never allowed to fail the build: a sitemap
 * that 500s because Postgres was briefly unreachable is worse than one missing
 * a date, so the query is caught and the static half is served regardless.
 * The hard-coded `/events/offcampus` entry that used to sit here became a 404
 * in the sitemap the day that slug was retired.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const events = await listPublicSlugs().catch(() => []);

  const routes: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  }> = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
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

  return [
    ...routes.map((route) => ({
      url: `${BASE}${route.path}`,
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...events.map((event) => ({
      url: `${BASE}/events/${event.slug}`,
      lastModified: new Date(event.updated_at),
      changeFrequency: 'daily' as const,
      priority: 0.95,
    })),
  ];
}
