import type { NextRequest } from 'next/server';
import { created, fail, handleError, ok, readJson } from '@/lib/api';
import { requireSession, verifyOrigin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { clientIp } from '@/lib/validation.server';
import {
  ReferralError,
  createReferralCode,
  listReferralCodesWithStats,
  updateReferralCode,
} from '@/lib/referrals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Referral codes.
 *
 * Manager and above. A code is money — creating one with a large discount, or
 * switching a live one off mid-sale, is a commercial decision rather than a
 * door decision, and gate staff have no reason to reach it.
 */
export async function GET() {
  try {
    await requireSession('manager');
    const codes = await listReferralCodesWithStats();

    return ok({
      codes,
      totals: {
        active: codes.filter((code) => code.active).length,
        sales: codes.reduce((sum, code) => sum + code.sales, 0),
        revenuePaise: codes.reduce((sum, code) => sum + Number(code.revenue_paise), 0),
        discountGivenPaise: codes.reduce(
          (sum, code) => sum + Number(code.discount_given_paise),
          0,
        ),
      },
    });
  } catch (error) {
    return handleError(error, 'admin.referrals.list');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const body = (await readJson(request)) as {
      code?: string;
      label?: string;
      discountRupees?: number;
      maxUses?: number | null;
      expiresAt?: string | null;
    };

    if (!body.code) return fail('Enter a code', 'missing_code', 422);

    // The form talks in rupees because that is how the discount is advertised;
    // everything past this line is paise, as the rest of the system is.
    const discountPaise = Math.round(Number(body.discountRupees) * 100);

    const row = await createReferralCode({
      code: body.code,
      label: body.label ?? null,
      discountPaise,
      maxUses: body.maxUses ?? null,
      expiresAt: body.expiresAt ?? null,
    });

    await recordAudit({
      actor: session,
      action: 'referral.create',
      entity: 'referral_code',
      entityId: row.code,
      metadata: { discountPaise, maxUses: row.max_uses },
      ipAddress: clientIp(request.headers),
    });

    return created({ code: row });
  } catch (error) {
    if (error instanceof ReferralError) return fail(error.message, error.code, error.status);
    return handleError(error, 'admin.referrals.create');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const body = (await readJson(request)) as {
      code?: string;
      active?: boolean;
      discountRupees?: number;
      label?: string | null;
      maxUses?: number | null;
    };

    if (!body.code) return fail('Which code?', 'missing_code', 422);

    const row = await updateReferralCode(body.code, {
      active: body.active,
      discountPaise:
        body.discountRupees === undefined ? undefined : Math.round(body.discountRupees * 100),
      label: body.label,
      maxUses: body.maxUses,
    });

    await recordAudit({
      actor: session,
      action: 'referral.update',
      entity: 'referral_code',
      entityId: row.code,
      metadata: { active: row.active, discountPaise: row.discount_paise },
      ipAddress: clientIp(request.headers),
    });

    return ok({ code: row });
  } catch (error) {
    if (error instanceof ReferralError) return fail(error.message, error.code, error.status);
    return handleError(error, 'admin.referrals.update');
  }
}
