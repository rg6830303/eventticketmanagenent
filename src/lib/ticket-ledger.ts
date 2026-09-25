import 'server-only';
import { query } from './db';

/**
 * Every pass, one row each, with where it came from and who holds it.
 *
 * One query shape serves the All tickets ledger, a promoter's pass list and
 * the console-issued list, so the three views can never disagree about a pass.
 */

export type TicketSource = 'website' | 'admin' | 'promoter';

export interface LedgerTicket {
  id: string;
  serial: number | null;
  code: string;
  holder_name: string;
  status: string;
  active: boolean;
  activated_at: string | null;
  checked_in_at: string | null;
  created_at: string;
  reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  email_sent_at: string | null;
  tier_name: string;
  /** Face value of this pass as sold (0 for console comps and promoter passes). */
  price_paise: number;
  /** Promoter passes: what the promoter owes per pass under their deal. */
  deal_price_paise: number | null;
  source: TicketSource;
  promoter_id: string | null;
  promoter_name: string | null;
  booking_status: string;
}

const SQL = `
  SELECT t.id, t.serial, t.code, t.holder_name, t.status, t.active, t.activated_at, t.checked_in_at, t.created_at,
         b.reference, b.customer_name, b.customer_email, b.customer_phone, b.email_sent_at, b.status AS booking_status,
         COALESCE(bi.tier_name, tt.name, 'General Entry') AS tier_name,
         COALESCE(bi.unit_price_paise, tt.price_paise, 0) AS price_paise,
         p.deal_price_paise,
         CASE WHEN b.payment_provider = 'promoter' OR b.source = 'promoter' THEN 'promoter'
              WHEN b.source = 'admin' THEN 'admin'
              ELSE 'website' END AS source,
         t.promoter_id, p.name AS promoter_name
    FROM tickets t
    JOIN bookings b ON b.id = t.booking_id
    LEFT JOIN booking_items bi ON bi.id = t.booking_item_id
    LEFT JOIN ticket_tiers tt ON tt.id = t.tier_id
    LEFT JOIN promoters p ON p.id = t.promoter_id`;

export async function listLedger(
  filter: { eventId?: string; promoterId?: string; source?: TicketSource; orphaned?: boolean },
  limit = 20000,
): Promise<LedgerTicket[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.eventId) {
    params.push(filter.eventId);
    where.push(`t.event_id = $${params.length}`);
  }
  if (filter.promoterId) {
    params.push(filter.promoterId);
    where.push(`t.promoter_id = $${params.length}`);
  }
  if (filter.source === 'admin') where.push(`b.source = 'admin'`);
  if (filter.source === 'promoter') where.push(`(b.payment_provider = 'promoter' OR b.source = 'promoter')`);
  if (filter.source === 'website') where.push(`b.source NOT IN ('admin', 'promoter') AND b.payment_provider <> 'promoter'`);
  if (filter.orphaned) where.push(`t.promoter_id IS NULL AND b.payment_provider = 'promoter'`);
  params.push(limit);
  const rows = await query<LedgerTicket>(
    `${SQL} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY t.serial ASC NULLS LAST, t.created_at ASC LIMIT $${params.length}`,
    params,
  );
  return rows.map((r) => ({ ...r, price_paise: Number(r.price_paise), deal_price_paise: r.deal_price_paise === null ? null : Number(r.deal_price_paise) }));
}
