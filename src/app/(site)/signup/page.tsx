import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCustomerSession } from '@/lib/customer-auth';
import { AuthShell } from '@/components/account/AuthShell';
import { SignUpForm } from '@/components/account/SignUpForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Keep every pass you have bought in one place.',
  robots: { index: false, follow: false },
};

export default async function SignUpPage() {
  if (await getCustomerSession()) redirect('/account');

  return (
    <AuthShell
      eyebrow="Your account"
      title="Create an account."
      lede="Optional — you can always buy as a guest. An account keeps every pass in one place and fills the checkout in for you."
      footer={
        <>
          Already have one?{' '}
          <Link href="/login" className="font-semibold text-vybe-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
