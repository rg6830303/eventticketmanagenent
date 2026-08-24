import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { listCustomers } from '@/lib/customers';
import { listReferralCodesWithStats } from '@/lib/referrals';
import { XLSX_CONTENT_TYPE, buildXlsx, type Sheet } from '@/lib/xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Workbook exports.
 *
 * Built on the server rather than assembled in the browser, which is what the
 * old CSV buttons did. That capped an export at whatever page the table had
 * already loaded; this covers every row. It also arrives as an ordinary
 * download instead of a blob the browser has to be talked into saving.
 *
 * Manager and above: these files carry every customer's email and phone.
 */

const rupees = (paise: number | string | null | undefined): number => Number(paise ?? 0) / 100;
const asDate = (value: string | null | undefined): Date | null =>
  value ? new Date(value) : null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySheet = Sheet<any>;

async function bookingsSheet(): Promise<AnySheet> {
  const rows = await query(
    `SELECT b.reference, b.customer_name, b.customer_email, b.customer_phone,
            e.name AS event_name,
            (SELECT string_agg(bi.tier_name || ' x' || bi.quantity, ', ' ORDER BY bi.tier_name)
               FROM booking_items bi WHERE bi.booking_id = b.id) AS tiers,
            b.quantity, b.subtotal_paise, b.discount_paise, b.amount_paise,
            b.referral_code, b.status, b.payment_provider, b.payment_id,
            b.paid_at, b.email_sent_at, b.source, b.created_at,
            (SELECT count(*)::int FROM tickets t WHERE t.booking_id = b.id) AS tickets_total,
            (SELECT count(*)::int FROM tickets t WHERE t.booking_id = b.id AND t.status = 'used') AS tickets_used
       FROM bookings b JOIN events e ON e.id = b.event_id
      ORDER BY b.created_at DESC`,
  );

  return {
    name: 'Bookings',
    rows,
    columns: [
      { header: 'Reference', width: 14, value: (r) => r.reference },
      { header: 'Name', width: 24, value: (r) => r.customer_name },
      { header: 'Email', width: 30, value: (r) => r.customer_email },
      { header: 'Phone', width: 14, value: (r) => r.customer_phone },
      { header: 'Event', width: 18, value: (r) => r.event_name },
      { header: 'Passes bought', width: 28, value: (r) => r.tiers },
      { header: 'Quantity', width: 10, value: (r) => r.quantity },
      { header: 'Subtotal', width: 12, value: (r) => rupees(r.subtotal_paise) },
      { header: 'Discount', width: 11, value: (r) => rupees(r.discount_paise) },
      { header: 'Paid', width: 12, value: (r) => rupees(r.amount_paise) },
      { header: 'Referral code', width: 16, value: (r) => r.referral_code },
      { header: 'Status', width: 12, value: (r) => r.status },
      { header: 'Method', width: 12, value: (r) => r.payment_provider },
      { header: 'Payment ID', width: 16, value: (r) => r.payment_id },
      { header: 'Paid at', width: 20, value: (r) => asDate(r.paid_at) },
      { header: 'Ticket emailed', width: 20, value: (r) => asDate(r.email_sent_at) },
      { header: 'Passes issued', width: 13, value: (r) => r.tickets_total },
      { header: 'Checked in', width: 12, value: (r) => r.tickets_used },
      { header: 'Source', width: 10, value: (r) => r.source },
      { header: 'Booked at', width: 20, value: (r) => asDate(r.created_at) },
    ],
  };
}

async function ticketsSheet(): Promise<AnySheet> {
  const rows = await query(
    `SELECT t.code, t.holder_name, t.seat_label, t.admits, t.status,
            t.checked_in_at, t.checked_in_gate,
            b.reference, b.customer_name, b.customer_email, b.customer_phone,
            b.status AS booking_status,
            COALESCE(bi.tier_name, tt.name) AS tier_name
       FROM tickets t
       JOIN bookings b ON b.id = t.booking_id
       LEFT JOIN booking_items bi ON bi.id = t.booking_item_id
       LEFT JOIN ticket_tiers tt ON tt.id = t.tier_id
      ORDER BY b.created_at DESC, t.seat_label ASC`,
  );

  return {
    name: 'Tickets',
    rows,
    columns: [
      { header: 'Ticket code', width: 22, value: (r) => r.code },
      { header: 'Holder', width: 24, value: (r) => r.holder_name },
      { header: 'Pass type', width: 18, value: (r) => r.tier_name },
      { header: 'Admits', width: 9, value: (r) => r.admits },
      { header: 'Seat', width: 12, value: (r) => r.seat_label },
      { header: 'Ticket status', width: 13, value: (r) => r.status },
      { header: 'Checked in at', width: 20, value: (r) => asDate(r.checked_in_at) },
      { header: 'Gate', width: 10, value: (r) => r.checked_in_gate },
      { header: 'Booking', width: 14, value: (r) => r.reference },
      { header: 'Booking status', width: 14, value: (r) => r.booking_status },
      { header: 'Guest', width: 24, value: (r) => r.customer_name },
      { header: 'Email', width: 30, value: (r) => r.customer_email },
      { header: 'Phone', width: 14, value: (r) => r.customer_phone },
    ],
  };
}

async function customersSheet(): Promise<AnySheet> {
  const { customers } = await listCustomers({ limit: 500 });
  return {
    name: 'Customers',
    rows: customers,
    columns: [
      { header: 'Name', width: 24, value: (r) => r.name },
      { header: 'Email', width: 30, value: (r) => r.email },
      { header: 'Phone', width: 14, value: (r) => r.phone },
      { header: 'Confirmed orders', width: 16, value: (r) => r.bookings_count },
      { header: 'Passes', width: 10, value: (r) => r.tickets_count },
      { header: 'Checked in', width: 12, value: (r) => r.checked_in_count },
      { header: 'Lifetime spend', width: 15, value: (r) => rupees(r.lifetime_paise) },
      { header: 'Marketing opt-in', width: 16, value: (r) => r.marketing_opt_in },
      { header: 'Latest reference', width: 16, value: (r) => r.last_reference },
      { header: 'First seen', width: 20, value: (r) => asDate(r.first_seen_at) },
      { header: 'Last seen', width: 20, value: (r) => asDate(r.last_seen_at) },
      { header: 'Source', width: 10, value: (r) => r.first_source },
    ],
  };
}

async function referralsSheet(): Promise<AnySheet> {
  const rows = await listReferralCodesWithStats();
  return {
    name: 'Referral codes',
    rows,
    columns: [
      { header: 'Code', width: 18, value: (r) => r.code },
      { header: 'Owner', width: 18, value: (r) => r.label },
      { header: 'Discount', width: 11, value: (r) => rupees(r.discount_paise) },
      { header: 'Sold', width: 9, value: (r) => r.sales },
      { header: 'Passes sold', width: 12, value: (r) => r.passes },
      { header: 'Claimed', width: 10, value: (r) => r.uses },
      { header: 'Unpaid holds', width: 13, value: (r) => r.pending },
      { header: 'Revenue', width: 13, value: (r) => rupees(r.revenue_paise) },
      { header: 'Discount given', width: 15, value: (r) => rupees(r.discount_given_paise) },
      { header: 'Max uses', width: 11, value: (r) => r.max_uses },
      { header: 'Active', width: 9, value: (r) => r.active },
      { header: 'Created', width: 20, value: (r) => asDate(r.created_at) },
    ],
  };
}

const BUILDERS: Record<string, () => Promise<AnySheet>> = {
  bookings: bookingsSheet,
  tickets: ticketsSheet,
  customers: customersSheet,
  referrals: referralsSheet,
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ sheet: string }> }) {
  await requireSession('manager');

  const { sheet } = await params;
  const key = sheet.replace(/\.xlsx$/i, '').toLowerCase();

  // `all` is a tab per table in one file, which is what somebody means when
  // they ask for "the numbers" rather than one specific list.
  const sheets: AnySheet[] =
    key === 'all'
      ? await Promise.all([bookingsSheet(), ticketsSheet(), customersSheet(), referralsSheet()])
      : BUILDERS[key]
        ? [await BUILDERS[key]()]
        : [];

  if (sheets.length === 0) {
    return new Response('Unknown export', { status: 404 });
  }

  const workbook = buildXlsx(sheets);
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(workbook), {
    headers: {
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="houz-of-vybe-${key}-${stamp}.xlsx"`,
      'Content-Length': String(workbook.length),
      'Cache-Control': 'no-store',
    },
  });
}
