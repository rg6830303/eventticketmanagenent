import { requireSession } from '@/lib/auth';
import { listReferralCodesWithStats } from '@/lib/referrals';
import { ReferralCodes } from '@/components/admin/ReferralCodes';
import { ExcelButton } from '@/components/admin/ExcelButton';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Referral codes', robots: { index: false, follow: false } };

/**
 * Referral codes.
 *
 * Manager-gated: a code is money. Creating one, or switching a live one off
 * mid-sale, is a commercial decision, and door staff have no reason to reach it.
 */
export default async function ReferralsPage() {
  await requireSession('manager');

  const codes = await listReferralCodesWithStats().catch(() => []);

  const totals = {
    active: codes.filter((code) => code.active).length,
    sales: codes.reduce((sum, code) => sum + code.sales, 0),
    revenuePaise: codes.reduce((sum, code) => sum + Number(code.revenue_paise), 0),
    discountGivenPaise: codes.reduce((sum, code) => sum + Number(code.discount_given_paise), 0),
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h1 className="font-display text-2xl font-bold text-ink">Referral codes</h1>
        <p className="mt-1 text-[13px] text-slate">
          Every code, what it has actually sold, and who bought with it. New codes work on the site
          the moment they are created.
        </p>
        </div>
        <ExcelButton sheet="referrals" label="Codes (Excel)" />
      </div>

      <ReferralCodes initialCodes={codes} initialTotals={totals} />
    </div>
  );
}
