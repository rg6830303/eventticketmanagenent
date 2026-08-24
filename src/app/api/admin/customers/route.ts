import type { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { listCustomers, customerStats } from '@/lib/customers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The customer catalogue, paged and searchable.
 *
 * Manager-and-above only. Door staff need to scan tickets, not to read a full
 * marketing list with every buyer's email and phone in it — the gate phone is
 * the device most likely to be handed to somebody, lost, or left unlocked on a
 * counter, and this is the endpoint that would turn that into a data breach.
 */
export async function GET(request: NextRequest) {
  try {
    await requireSession('manager');

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const buyersOnly = url.searchParams.get('buyers') === '1';
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(
      500,
      Math.max(5, Number.parseInt(url.searchParams.get('limit') ?? '50', 10) || 50),
    );

    const [{ customers, total }, stats] = await Promise.all([
      listCustomers({ search: q, buyersOnly, limit, offset: (page - 1) * limit }),
      customerStats(),
    ]);

    return ok({ rows: customers, total, page, limit, stats });
  } catch (error) {
    return handleError(error, 'admin.customers.list');
  }
}
