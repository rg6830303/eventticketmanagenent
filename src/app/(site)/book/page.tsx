import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { EVENT } from '@/content/site';

export const metadata: Metadata = {
  title: 'Buy tickets',
  description: `Choose your ${EVENT.name} ${EVENT.edition} ticket and add it to your cart.`,
  alternates: { canonical: '/events/offcampus#tickets' },
};

export default function BookPage() {
  redirect('/events/offcampus#tickets');
}
