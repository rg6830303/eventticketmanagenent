import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getFeaturedEvent } from '@/lib/event-facts';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Buy tickets', robots: { index: false, follow: true } };

/** Old "buy" links land on whatever the platform is selling now. */
export default async function BookPage() {
  const event = await getFeaturedEvent();
  redirect(event ? `/events/${event.slug}#tickets` : '/events');
}
