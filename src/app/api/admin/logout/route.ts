import type { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api';
import { clearSessionCookie, getSession } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { clientIp } from '@/lib/validation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    await clearSessionCookie();
    if (session) {
      await recordAudit({
        actor: session,
        action: 'admin.logout',
        ipAddress: clientIp(request.headers),
      });
    }
    return ok({ signedOut: true });
  } catch (error) {
    return handleError(error, 'admin.logout');
  }
}
