import type { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { customersForReferralCode } from '@/lib/referrals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Who actually bought with a code.
 *
 * Paid bookings only unless `?unpaid=1`. "Who used my code" from a promoter
 * means "who bought a ticket", and counting abandoned checkouts as uses is how
 * a commission conversation goes wrong.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    await requireSession('manager');
    const { code } = await params;
    const includeUnpaid = new URL(request.url).searchParams.get('unpaid') === '1';

    const customers = await customersForReferralCode(decodeURIComponent(code), includeUnpaid);

    return ok({
      code: decodeURIComponent(code).toUpperCase(),
      customers,
      paid: customers.filter((customer) => customer.status === 'confirmed').length,
    });
  } catch (error) {
    return handleError(error, 'admin.referrals.customers');
  }
}
