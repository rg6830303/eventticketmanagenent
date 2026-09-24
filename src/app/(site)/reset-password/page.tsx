import type { Metadata } from 'next';
import { AuthForm } from '@/components/account/AuthForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reset password', robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="shell flex min-h-[80dvh] items-center justify-center pb-20 pt-32">
      <div className="w-full max-w-md">
        <AuthForm mode="reset" token={token} />
      </div>
    </div>
  );
}
