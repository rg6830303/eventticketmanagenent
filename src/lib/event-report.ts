import 'server-only';
import { query, queryOne } from './db';

/**
 * Read-only reporting for one event: who holds passes and where the money
 * came from. Used by the view-only /promoview dashboard.
 *
 * Sources: 'website' is a gateway purchase, 'admin' a console-issued pass,
 * 'promoter' a promoter's pass (settled off-platform, tracked in the
 * promoter ledger).
 */

const SOURCE = `CASE WHEN b.payment_provider = 'promoter' OR b.source = 'promoter' THEN 'promoter'
                    WHEN b.source = 'admin' THEN 'admin' ELSE 'website' END`;

export interface EventCustomer {
  email: string;
  name: string;
  phone: string | null;
  bookings: number;
  passes: number;
  paid_paise: number;
  sources: string[];
  promoters: string[];
  registered: boolean;
  first_at: string;
}

/** Everyone holding a confirmed pass for this event, one row per email. */
export async function listEventCustomers(eventId: string): Promise<EventCustomer[]> {
  const rows = await query<EventCustomer>(
    `SELECT lower(b.customer_email) AS email,
            (array_agg(b.customer_name ORDER BY b.created_at DESC))[1] AS name,
            (array_agg(b.customer_phone ORDER BY b.created_at DESC))[1] AS phone,
            count(*)::int AS bookings,
            sum(b.quantity)::int AS passes,
            sum(CASE WHEN ${SOURCE} = 'website' THEN b.amount_paise ELSE 0 END)::bigint AS paid_paise,
            array_agg(DISTINCT ${SOURCE}) AS sources,
            array_remove(array_agg(DISTINCT p.name), NULL) AS promoters,
            bool_or(c.registered_at IS NOT NULL) AS registered,
            min(b.created_at) AS first_at
       FROM bookings b
       LEFT JOIN promoters p ON p.id = b.promoter_id
       LEFT JOIN customers c ON c.id = b.customer_id
      WHERE b.event_id = $1 AND b.status = 'confirmed'
      GROUP BY lower(b.customer_email)
      ORDER BY min(b.created_at) DESC`,
    [eventId],
  );
  return rows.map((r) => ({ ...r, paid_paise: Number(r.paid_paise) }));
}

export interface EventFinancials {
  website: { bookings: number; passes: number; gross_paise: number; fee_paise: number; discount_paise: number };
  console: { bookings: number; passes: number; collected_paise: number };
  promoter: { passes: number; expected_paise: number; received_paise: number };
  pending: { bookings: number; passes: number; value_paise: number };
  tiers: Array<{ tier_name: string; passes: number; revenue_paise: number; unit_paise: number }>;
  daily: Array<{ day: string; passes: number; gross_paise: number }>;
}

export async function getEventFinancials(eventId: string): Promise<EventFinancials> {
  const [bySource, pending, tiers, promoter, daily] = await Promise.all([
    query<{ source: string; bookings: number; passes: number; amount: number; fee: number; discount: number }>(
      `SELECT ${SOURCE} AS source, count(*)::int AS bookings, sum(b.quantity)::int AS passes,
              sum(b.amount_paise)::bigint AS amount, sum(COALESCE(b.fee_paise, 0))::bigint AS fee,
              sum(COALESCE(b.discount_paise, 0))::bigint AS discount
         FROM bookings b WHERE b.event_id = $1 AND b.status = 'confirmed' GROUP BY 1`,
      [eventId],
    ),
    queryOne<{ bookings: number; passes: number; value: number }>(
      `SELECT count(*)::int AS bookings, COALESCE(sum(quantity), 0)::int AS passes, COALESCE(sum(amount_paise), 0)::bigint AS value
         FROM bookings WHERE event_id = $1 AND status = 'pending'`,
      [eventId],
    ),
    query<{ tier_name: string; passes: number; revenue_paise: number; unit_paise: number }>(
      `SELECT bi.tier_name, sum(bi.quantity)::int AS passes, sum(bi.line_total_paise)::bigint AS revenue_paise,
              max(bi.unit_price_paise) AS unit_paise
         FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id
        WHERE b.event_id = $1 AND b.status = 'confirmed' AND ${SOURCE} = 'website'
        GROUP BY bi.tier_name ORDER BY passes DESC`,
      [eventId],
    ),
    queryOne<{ expected: number; received: number }>(
      `SELECT COALESCE(sum(p.deal_price_paise * (SELECT count(*) FROM tickets t WHERE t.promoter_id = p.id AND t.status <> 'void')), 0)::bigint AS expected,
              COALESCE((SELECT sum(CASE a.kind WHEN 'payment' THEN a.amount_paise ELSE -a.amount_paise END)
                          FROM promoter_activity a JOIN promoters q ON q.id = a.promoter_id
                         WHERE a.kind IN ('payment', 'payment_removed') AND (q.event_id = $1 OR q.event_id IS NULL)), 0)::bigint AS received
         FROM promoters p WHERE p.event_id = $1 OR p.event_id IS NULL`,
      [eventId],
    ),
    query<{ day: string; passes: number; gross_paise: number }>(
      `SELECT to_char((b.paid_at AT TIME ZONE 'Asia/Kolkata')::date, 'DD Mon') AS day,
              sum(b.quantity)::int AS passes, sum(b.amount_paise)::bigint AS gross_paise
         FROM bookings b
        WHERE b.event_id = $1 AND b.status = 'confirmed' AND ${SOURCE} = 'website' AND b.paid_at IS NOT NULL
        GROUP BY (b.paid_at AT TIME ZONE 'Asia/Kolkata')::date
        ORDER BY (b.paid_at AT TIME ZONE 'Asia/Kolkata')::date DESC
        LIMIT 30`,
      [eventId],
    ),
  ]);

  const get = (s: string) => bySource.find((r) => r.source === s);
  const web = get('website');
  const con = get('admin');
  const pro = get('promoter');
  return {
    website: {
      bookings: web?.bookings ?? 0,
      passes: web?.passes ?? 0,
      gross_paise: Number(web?.amount ?? 0),
      fee_paise: Number(web?.fee ?? 0),
      discount_paise: Number(web?.discount ?? 0),
    },
    console: { bookings: con?.bookings ?? 0, passes: con?.passes ?? 0, collected_paise: Number(con?.amount ?? 0) },
    promoter: {
      passes: pro?.passes ?? 0,
      expected_paise: Number(promoter?.expected ?? 0),
      received_paise: Number(promoter?.received ?? 0),
    },
    pending: { bookings: pending?.bookings ?? 0, passes: pending?.passes ?? 0, value_paise: Number(pending?.value ?? 0) },
    tiers: tiers.map((t) => ({ ...t, revenue_paise: Number(t.revenue_paise), unit_paise: Number(t.unit_paise) })),
    daily: daily.map((d) => ({ ...d, gross_paise: Number(d.gross_paise) })),
  };
}
