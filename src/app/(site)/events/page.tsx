import { redirect } from 'next/navigation';
import { getFeaturedEvent } from '@/lib/event-facts';

export const dynamic = 'force-dynamic';

/** One event on sale at a time, so the listing is that event's page. */
export default async function EventsIndex() {
  const featured = await getFeaturedEvent().catch(() => null);
  redirect(featured ? `/events/${featured.slug}` : '/');
}
