import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCustomerAccount } from '@/lib/customer-auth';
import { AuthForm } from '@/components/account/AuthForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Already signed in: go where they were heading instead of showing a form.
  if (await getCustomerAccount()) redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : '/account');

  return (
    <div className="shell flex min-h-[80dvh] items-center justify-center pb-20 pt-32">
      <div className="w-full max-w-md">
        <AuthForm mode="login" next={next} />
      </div>
    </div>
  );
}
