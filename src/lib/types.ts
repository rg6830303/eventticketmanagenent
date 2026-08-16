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
  active: boolean;
}

export interface BookingRow {
  id: string;
  reference: string;
  event_id: string;
  tier_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  quantity: number;
  amount_paise: number;
  currency: string;
  status: BookingStatus;
  payment_provider: 'none' | 'razorpay' | 'comp' | 'cash';
  payment_order_id: string | null;
  payment_id: string | null;
  email_sent_at: string | null;
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
  };
  event?: { name: string; slug: string };
}

export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, string[]>;
}
