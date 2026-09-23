import type { NextRequest } from 'next/server';
import { handleError, fail, ok } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { clearCustomerCookie } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);
    await clearCustomerCookie();
    return ok({ signedOut: true });
  } catch (error) {
    return handleError(error, 'account.logout');
  }
}
