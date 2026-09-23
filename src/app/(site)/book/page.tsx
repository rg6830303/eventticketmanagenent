import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getFeaturedEvent, getPublicEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Buy tickets',
  description: 'Choose your pass and add it to your cart.',
};

/**
 * `/book` is a shortcut, not a page.
 *
 * It used to redirect to a hard-coded `/events/offcampus#tickets`, which is a
 * dead end the moment that date passes. Now it resolves whichever event is
 * being sold — or honours `?event=<slug>` when a link names one, which is what
 * every CTA on a specific event's page passes so the shortcut cannot land the
 * customer on a different party than the one they were reading about.
 */
export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event: slug } = await searchParams;

  const target = slug
    ? await getPublicEvent(slug).catch(() => null)
    : await getFeaturedEvent().catch(() => null);

  // No such event, or nothing on sale: the events index explains itself far
  // better than a 404 does.
  if (!target || target.isPast) redirect('/events');

  redirect(`/events/${target.row.slug}#tickets`);
}
