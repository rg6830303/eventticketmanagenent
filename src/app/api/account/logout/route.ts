import { handleError, ok } from '@/lib/api';
import { endCustomerSession } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await endCustomerSession();
    return ok({ signedOut: true });
  } catch (error) {
    return handleError(error, 'account.logout');
  }
}
