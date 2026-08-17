import { getSession } from '@/lib/auth';
import { Logo } from '@/components/brand/Logo';
import { Globe } from '@/components/brand/Globe';
import { AdminNav } from '@/components/admin/AdminNav';
import { LogoutButton } from '@/components/admin/LogoutButton';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Console',
  robots: { index: false, follow: false },
};

/**
 * Console chrome. Deliberately denser and flatter than the marketing site —
 * this is a tool used one-handed, on a phone, in a dark room.
 *
 * /admin/login renders inside this layout too, so an absent session falls
 * through to bare children rather than redirecting (middleware already handles
 * the redirect for every other route).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    return <div className="min-h-dvh bg-void">{children}</div>;
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-void">
      {/* Brand watermark, kept near-invisible. Any more contrast and it would
          compete with the numbers staff are trying to read in a dark room. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <Globe
          className="absolute -right-40 top-24 h-[560px] w-[560px] text-flare/[0.03]"
          strokeWidth={1}
        />
      </div>

      <header className="sticky top-0 z-40 border-b border-hairline bg-void/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Logo variant="inline" className="origin-left scale-[0.88] sm:scale-100" />
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-dim sm:inline">
              Console
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[13px] font-medium leading-tight text-chalk">{session.name}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-dim">
                {session.role}
              </p>
            </div>
            <span className="badge px-2.5 py-0.5 text-[10px] sm:hidden">{session.role}</span>
            <LogoutButton />
          </div>
        </div>

        <div className="hidden border-t border-hairline/60 sm:block">
          <div className="mx-auto w-full max-w-6xl px-4">
            <AdminNav />
          </div>
        </div>
      </header>

      {/* Bottom padding clears the mobile tab bar. */}
      <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:pb-10">
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-void/95 backdrop-blur-xl sm:hidden">
        <AdminNav variant="tabs" />
      </div>

      <footer className="relative hidden border-t border-hairline px-4 py-4 sm:block">
        <p className="mx-auto flex max-w-6xl items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-dim">
          <Globe className="h-3 w-3 text-flare/60" strokeWidth={5} />
          {env.appEnv} · payments {env.paymentsEnabled ? 'live' : 'disabled'} · smtp{' '}
          {env.smtpConfigured ? 'configured' : 'not configured'}
        </p>
      </footer>
    </div>
  );
}
