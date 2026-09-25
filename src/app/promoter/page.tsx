import type { Metadata } from 'next';
import { getFeaturedEvent } from '@/lib/event-facts';
import { getPromoterSerials, getPromoterStats, getSignedInPromoter, listPromoterTickets } from '@/lib/promoters';
import { serialRanges } from '@/lib/utils';
import { Logo } from '@/components/brand/Logo';
import { PromoterLogin, PromoterIssue, PromoterSignOut } from '@/components/promoter/PromoterDashboard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Promoter Dashboard',
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The promoter's dashboard. Unlisted: nothing links here, it is not in the
 * sitemap, and robots are told to stay out. The code is the only way in.
 */
export default async function PromoterPage() {
  const signedIn = await getSignedInPromoter();

  if (!signedIn) {
    return (
      <Shell>
        <PromoterLogin />
      </Shell>
    );
  }

  const [stats, tickets, event, serials] = await Promise.all([
    getPromoterStats(signedIn.id),
    listPromoterTickets(signedIn.id),
    getFeaturedEvent(),
    getPromoterSerials(signedIn.id),
  ]);
  const issuedSerials = new Set(serials.issued);
  const unissued = serials.all.filter((s) => !issuedSerials.has(s));
  const remaining = stats?.remaining ?? 0;
  const issued = stats?.issued ?? 0;

  return (
    <Shell>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Promoter dashboard</p>
          <h1 className="mt-1 truncate font-display text-2xl font-bold text-ink">Hi {signedIn.name.split(' ')[0]}</h1>
          {event && <p className="text-[13px] text-slate">{event.name} {event.tagline ?? ''}</p>}
        </div>
        <PromoterSignOut />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border-[1.5px] border-ink bg-vybe-500 p-4 text-white shadow-press-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">Left to issue</p>
          <p className="mt-1 font-display text-4xl font-bold tnum">{remaining}</p>
        </div>
        <div className="rounded-2xl border-[1.5px] border-ink bg-paper p-4 shadow-press-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Issued so far</p>
          <p className="mt-1 font-display text-4xl font-bold text-ink tnum">{issued}</p>
        </div>
      </div>

      {serials.all.length > 0 && (
        <div className="mt-3 space-y-1 rounded-2xl border border-edge bg-paper p-4 text-[13px]">
          <p className="flex flex-wrap gap-x-2">
            <span className="font-semibold text-ink">Your serials</span>
            <span className="break-all font-mono text-slate">#{serialRanges(serials.all)}</span>
          </p>
          {serials.issued.length > 0 && (
            <p className="flex flex-wrap gap-x-2">
              <span className="font-semibold text-ink">Issued</span>
              <span className="break-all font-mono text-leaf-600">#{serialRanges(serials.issued)}</span>
            </p>
          )}
          {unissued.length > 0 && <p className="text-[12px] text-muted">Next pass you issue: #{unissued[0]}</p>}
        </div>
      )}

      <div className="mt-6">
        <PromoterIssue remaining={remaining} />
      </div>

      {tickets.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Issued passes ({tickets.length})</h2>
          <ul className="mt-2 divide-y divide-edge/70 overflow-hidden rounded-xl border border-edge bg-paper">
            {tickets.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink">
                    {t.serial !== null && <span className="mr-1.5 font-mono text-vybe-700">#{t.serial}</span>}
                    {t.holder_name}
                  </p>
                  <p className="truncate text-[12px] text-slate">{t.customer_email}</p>
                  <p className="font-mono text-[11px] text-muted">{t.code}</p>
                </div>
                <span
                  className={
                    t.status === 'void'
                      ? 'shrink-0 rounded-full bg-mist px-2 py-0.5 text-[11px] font-semibold text-muted'
                      : t.active
                        ? 'shrink-0 rounded-full bg-leaf-600/10 px-2 py-0.5 text-[11px] font-semibold text-leaf-600'
                        : 'shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800'
                  }
                >
                  {t.status === 'void'
                    ? 'Cancelled'
                    : t.status === 'used'
                      ? 'Checked in'
                      : t.active
                        ? 'Active'
                        : t.activated_at
                          ? 'Deactivated'
                          : 'Pending'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-muted">
            Pending passes become Active once the organiser confirms your payment. Customers can check their pass status from the link in their email.
          </p>
        </section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-edge bg-paper">
        <div className="mx-auto flex max-w-lg items-center px-4 py-3">
          <Logo />
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}
