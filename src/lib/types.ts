/** Shared row/DTO shapes. Mirrors db/schema.sql. */

export type EventStatus = 'draft' | 'published' | 'sold_out' | 'cancelled' | 'archived';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'refunded' | 'failed';
export type TicketStatus = 'valid' | 'used' | 'void' | 'refunded';
export type AdminRole = 'owner' | 'manager' | 'gate';
export type ScanResult =
  | 'admitted'
  | 'duplicate'
  | 'invalid_signature'
  | 'not_found'
  | 'void'
  | 'wrong_event'
  | 'refunded';

export interface EventRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  venue_name: string;
  venue_address: string | null;
  city: string;
  starts_at: string;
  ends_at: string | null;
  doors_at: string | null;
  capacity: number;
  age_limit: number;
  hero_image: string | null;
  status: EventStatus;
  created_at: string;
  updated_at: string;
}

export interface TicketTierRow {
  id: string;
  event_id: string;
  code: string;
  name: string;
  description: string | null;
  price_paise: number;
  quantity: number;
  sold: number;
  perks: string[];
  sort_order: number;
  /** Heads admitted by one pass of this tier: 1 solo, 2 couple, 5 VIP table. */
  admits: number;
  /** Part of the price returned as venue credit. */
  redeemable_paise: number;
  active: boolean;
}

export interface BookingRow {
  id: string;
  reference: string;
  event_id: string;
  /** The durable customer record behind this checkout. Null only for rows
   *  written before the customers table existed. */
  customer_id: string | null;
  tier_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  quantity: number;
  /** Face value before any discount. */
  subtotal_paise: number;
  /** Flat amount taken off by a referral code. Zero when none was used. */
  discount_paise: number;
  referral_code: string | null;
  /** What the customer actually owes: subtotal minus discount, never below 0. */
  amount_paise: number;
  currency: string;
  status: BookingStatus;
  payment_provider: 'none' | 'razorpay' | 'cashfree' | 'upi' | 'comp' | 'cash';
  payment_order_id: string | null;
  payment_id: string | null;
  paid_at: string | null;
  email_sent_at: string | null;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketRow {
  id: string;
  booking_id: string;
  event_id: string;
  tier_id: string | null;
  code: string;
  seat_label: string | null;
  holder_name: string;
  status: TicketStatus;
  checked_in_at: string | null;
  checked_in_by: string | null;
  checked_in_gate: string | null;
  /** How many heads this one QR admits. 1 for a solo pass, 2 for a couple. */
  admits: number;
  booking_item_id: string | null;
  created_at: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  last_login_at: string | null;
}

export interface AdminSession {
  sub: string;
  email: string;
  name: string;
  role: AdminRole;
}

/** Booking + its event + its tickets, as returned to the confirmation page. */
export interface BookingDetail {
  booking: BookingRow;
  event: EventRow;
  tier: TicketTierRow | null;
  tickets: TicketRow[];
  /** Every pass type in the cart. Single-tier bookings have exactly one. */
  items: BookingItemRow[];
  /** The catalogued buyer, when the booking has been linked to one. */
  customer: CustomerRow | null;
}

export interface ScanOutcome {
  result: ScanResult;
  ok: boolean;
  title: string;
  message: string;
  ticket?: {
    code: string;
    holderName: string;
    tierName: string | null;
    seatLabel: string | null;
    bookingReference: string;
    quantity: number;
    checkedInAt: string | null;
    /** Heads this one QR lets through. */
    admits: number;
  };
  event?: { name: string; slug: string };
}

export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, string[]>;
}

/**
 * The durable customer record. Distinct from the name/email/phone copied onto
 * each booking: those are a snapshot of one checkout, this accumulates.
 */
export interface CustomerRow {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  first_seen_at: string;
  last_seen_at: string;
  /** Rollups maintained by a database trigger — never written by app code. */
  bookings_count: number;
  tickets_count: number;
  lifetime_paise: number;
  marketing_opt_in: boolean;
  first_source: string | null;
  last_ip: string | null;
  last_user_agent: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** A customer row plus the derived columns the admin list shows. */
export interface CustomerWithBookings extends CustomerRow {
  last_reference: string | null;
  pending_count: number;
  checked_in_count: number;
}

/** One pass type within a cart. A booking has one row per distinct tier. */
export interface BookingItemRow {
  id: string;
  booking_id: string;
  tier_id: string | null;
  tier_code: string;
  tier_name: string;
  /** Snapshotted at purchase — a later reprice must not rewrite an old order. */
  unit_price_paise: number;
  quantity: number;
  admits_each: number;
  redeemable_paise: number;
  line_total_paise: number;
  created_at: string;
}

/** One observation of a gateway payment. Append-only; nothing is updated. */
export interface PaymentRow {
  id: string;
  booking_id: string | null;
  provider: string;
  order_id: string;
  payment_id: string | null;
  status: string;
  amount_paise: number;
  currency: string;
  method: string | null;
  bank_reference: string | null;
  message: string | null;
  source: 'order' | 'return' | 'webhook' | 'poll' | string;
  raw: Record<string, unknown>;
  created_at: string;
}

/** What the customer asked for, before any of it is priced or reserved. */
export interface CartLineInput {
  tierCode: string;
  quantity: number;
}
