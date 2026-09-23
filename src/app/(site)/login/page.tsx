import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCustomerSession } from '@/lib/customer-auth';
import { AuthShell } from '@/components/account/AuthShell';
import { LoginForm } from '@/components/account/LoginForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to see your tickets.',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getCustomerSession()) redirect('/account');

  return (
    <AuthShell
      eyebrow="Your account"
      title="Sign in."
      lede="Your passes, your past orders, and a checkout that already knows who you are."
      footer={
        <>
          No account yet?{' '}
          <Link href="/signup" className="font-semibold text-vybe-700 hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
