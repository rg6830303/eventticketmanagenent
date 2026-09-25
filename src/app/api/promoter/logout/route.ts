import { handleError, ok } from '@/lib/api';
import { endPromoterSession } from '@/lib/promoters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await endPromoterSession();
    return ok({ signedOut: true });
  } catch (error) {
    return handleError(error, 'promoter.logout');
  }
}
