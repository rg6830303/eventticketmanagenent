import type { Metadata } from 'next';
import { AuthForm } from '@/components/account/AuthForm';

export const metadata: Metadata = { title: 'Forgot password', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <div className="shell flex min-h-[80dvh] items-center justify-center pb-20 pt-32">
      <div className="w-full max-w-md">
        <AuthForm mode="forgot" />
      </div>
    </div>
  );
}
