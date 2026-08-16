import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Logo } from '@/components/site/Logo';
import { LoginForm } from '@/components/admin/LoginForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Staff sign in',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  // Already signed in — skip the form rather than showing a redundant login.
  if (await getSession()) redirect('/admin');

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 grid-overlay" />
        <div className="absolute left-1/2 top-0 h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-vybe-600/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[380px] w-[380px] translate-x-1/4 translate-y-1/3 rounded-full bg-pulse-500/10 blur-[110px]" />
      </div>

      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <div className="mb-6 flex justify-center">
            <Logo />
          </div>
          <h1 className="font-display text-2xl font-bold text-chalk">Staff sign in</h1>
          <p className="mt-2 text-sm text-haze">
            Door and operations console. Guests should use the main site.
          </p>
        </div>

        <div className="card card-lit p-6 sm:p-7">
          <Suspense fallback={<div className="h-[280px] animate-pulse rounded-xl bg-elevated/50" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-[12px] leading-relaxed text-dim">
          Access is logged. Repeated failed attempts lock the account for 15 minutes.
        </p>
      </div>
    </div>
  );
}
