import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Logo } from '@/components/brand/Logo';
import { Globe } from '@/components/brand/Globe';
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
        <div className="absolute inset-0 gridfield fade-edges" />
        <div className="absolute left-1/2 top-0 h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-vybe-600/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[380px] w-[380px] translate-x-1/4 translate-y-1/3 rounded-full bg-pulse-500/10 blur-[110px]" />

        {/* The mark itself, turning behind the card. Slow enough to read as
            atmosphere rather than as something demanding attention. */}
        <div className="absolute left-1/2 top-1/2 h-[min(150vw,760px)] w-[min(150vw,760px)] -translate-x-1/2 -translate-y-1/2">
          <Globe spin strokeWidth={0.8} className="h-full w-full text-vybe-500/10" />
        </div>
      </div>

      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo variant="full" className="w-[190px]" />
          <h1 className="mt-5 font-display text-2xl font-bold text-ink">Staff sign in</h1>
          <p className="mt-2 text-sm text-slate">
            Door and operations console. Guests should use the main site.
          </p>
        </div>

        <div className="panel shadow-mid p-6 sm:p-7">
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-[12px] leading-relaxed text-muted">
          Access is logged. Repeated failed attempts lock the account for 15 minutes.
        </p>
      </div>
    </div>
  );
}

/** Matches the form's real rhythm so the card does not resize when it swaps in. */
function LoginFormFallback() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-frost/70" />
        <div className="h-[52px] w-full animate-pulse rounded-xl bg-frost/50" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-20 rounded bg-frost/70" />
        <div className="h-[52px] w-full animate-pulse rounded-xl bg-frost/50" />
      </div>
      <div className="min-h-[24px]" />
      <div className="h-[52px] w-full animate-pulse rounded-full bg-frost/50" />
    </div>
  );
}
