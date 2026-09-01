-- ===========================================================================
-- Houz of Vybe — Postgres schema
-- Idempotent: safe to run repeatedly (`npm run db:push`).
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- --------------------------------------------------------------------------
-- events
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  tagline         TEXT,
  description     TEXT,
  venue_name      TEXT NOT NULL,
  venue_address   TEXT,
  city            TEXT NOT NULL DEFAULT 'Hyderabad',
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  doors_at        TIMESTAMPTZ,
  capacity        INTEGER NOT NULL DEFAULT 500 CHECK (capacity >= 0),
  age_limit       INTEGER NOT NULL DEFAULT 21,
  hero_image      TEXT,
  status          TEXT NOT NULL DEFAULT 'published'
                    CHECK (status IN ('draft', 'published', 'sold_out', 'cancelled', 'archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- ticket_tiers — price bands within an event
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_tiers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  price_paise     INTEGER NOT NULL DEFAULT 0 CHECK (price_paise >= 0),
  quantity        INTEGER NOT NULL DEFAULT 100 CHECK (quantity >= 0),
  sold            INTEGER NOT NULL DEFAULT 0 CHECK (sold >= 0),
  perks           JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, code),
  CONSTRAINT sold_within_quantity CHECK (sold <= quantity)
);

-- --------------------------------------------------------------------------
-- referral_codes — flat-amount discounts handed out by promoters
--
-- Codes are stored upper-case and matched upper-case, so KAVYANSH100 and
-- kavyansh100 are the same code. `discount_paise` is a flat amount off the
-- whole order, not a per-ticket or percentage discount: percentages invite
-- rounding disputes on a ₹ amount, and a flat cut is what gets advertised.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,
  label           TEXT,
  discount_paise  INTEGER NOT NULL DEFAULT 10000 CHECK (discount_paise > 0),
  active          BOOLEAN NOT NULL DEFAULT true,
  -- NULL = unlimited. Otherwise the code stops working once uses reaches it.
  max_uses        INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  uses            INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0),
  starts_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_codes_active_idx ON referral_codes (active);

-- --------------------------------------------------------------------------
-- bookings — one row per checkout, may contain many tickets
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference          TEXT NOT NULL UNIQUE,
  event_id           UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  tier_id            UUID REFERENCES ticket_tiers(id) ON DELETE SET NULL,
  customer_name      TEXT NOT NULL,
  customer_email     TEXT NOT NULL,
  customer_phone     TEXT NOT NULL,
  quantity           INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  amount_paise       INTEGER NOT NULL DEFAULT 0 CHECK (amount_paise >= 0),
  currency           TEXT NOT NULL DEFAULT 'INR',
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'confirmed', 'cancelled', 'refunded', 'failed')),
  payment_provider   TEXT NOT NULL DEFAULT 'none'
                       CHECK (payment_provider IN ('none', 'razorpay', 'comp', 'cash')),
  payment_order_id   TEXT,
  payment_id         TEXT,
  payment_signature  TEXT,
  paid_at            TIMESTAMPTZ,
  -- Callers send an Idempotency-Key so a double-submit cannot double-book.
  idempotency_key    TEXT UNIQUE,
  source             TEXT NOT NULL DEFAULT 'web',
  notes              TEXT,
  ip_address         INET,
  user_agent         TEXT,
  email_sent_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_event_idx      ON bookings (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_email_idx      ON bookings (lower(customer_email));
CREATE INDEX IF NOT EXISTS bookings_phone_idx      ON bookings (customer_phone);
CREATE INDEX IF NOT EXISTS bookings_status_idx     ON bookings (status);
CREATE INDEX IF NOT EXISTS bookings_created_idx    ON bookings (created_at DESC);

-- Discount trail. subtotal_paise is face value before any code; amount_paise is
-- what the customer actually owes and is the only figure the payment layer
-- reads, so a discount can never be applied twice.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS referral_code   TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_paise  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS subtotal_paise  INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS bookings_referral_idx ON bookings (referral_code)
  WHERE referral_code IS NOT NULL;

-- --------------------------------------------------------------------------
-- upi_payment_claims — customer-declared UPI payments awaiting a human check
--
-- A UTR is a number the customer types into a form. Nothing about it can be
-- verified without bank API access, so a claim NEVER confirms a booking on its
-- own: it parks the order until an operator finds the payment in their UPI app
-- and approves it, which is what actually mints the tickets.
--
-- The partial unique index below is the one real fraud control available here:
-- a given UTR can back exactly one live claim, so the same reference number
-- cannot be reused across two bookings.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS upi_payment_claims (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  -- Stored normalised: digits only, no spaces.
  utr           TEXT NOT NULL,
  -- Snapshot of what was owed when the claim was made, so a later price change
  -- cannot make an old claim look short-paid.
  amount_paise  INTEGER NOT NULL CHECK (amount_paise >= 0),
  vpa           TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('submitted', 'approved', 'rejected')),
  note          TEXT,
  reviewed_by   UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS upi_claims_booking_idx ON upi_payment_claims (booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS upi_claims_status_idx  ON upi_payment_claims (status, created_at DESC);

-- One UTR backs one booking. Rejected claims are excluded so a genuine payer
-- whose first attempt was refused can resubmit the same reference.
CREATE UNIQUE INDEX IF NOT EXISTS upi_claims_utr_live_idx
  ON upi_payment_claims (utr) WHERE status <> 'rejected';

-- Allow 'upi' alongside the existing providers. Written as a drop-and-add so
-- the whole file stays re-runnable.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_provider_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_provider_check
  CHECK (payment_provider IN ('none', 'razorpay', 'upi', 'comp', 'cash'));

-- --------------------------------------------------------------------------
-- tickets — one row per admitted head; this is what the QR resolves to
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  tier_id        UUID REFERENCES ticket_tiers(id) ON DELETE SET NULL,
  code           TEXT NOT NULL UNIQUE,
  seat_label     TEXT,
  holder_name    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'valid'
                   CHECK (status IN ('valid', 'used', 'void', 'refunded')),
  checked_in_at  TIMESTAMPTZ,
  checked_in_by  UUID,
  checked_in_gate TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tickets_booking_idx ON tickets (booking_id);
CREATE INDEX IF NOT EXISTS tickets_event_idx   ON tickets (event_id, status);
CREATE INDEX IF NOT EXISTS tickets_status_idx  ON tickets (status);

-- --------------------------------------------------------------------------
-- admin_users
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'gate'
                   CHECK (role IN ('owner', 'manager', 'gate')),
  active         BOOLEAN NOT NULL DEFAULT true,
  last_login_at  TIMESTAMPTZ,
  -- Brute-force guard: cleared on a successful login.
  failed_logins  INTEGER NOT NULL DEFAULT 0,
  locked_until   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- scan_log — every scan attempt, including the rejected ones. This is the
-- forensic record for gate disputes, so nothing is ever deleted from here.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scan_log (
  id            BIGSERIAL PRIMARY KEY,
  ticket_id     UUID REFERENCES tickets(id) ON DELETE SET NULL,
  event_id      UUID REFERENCES events(id) ON DELETE SET NULL,
  scanned_code  TEXT,
  result        TEXT NOT NULL
                  CHECK (result IN ('admitted', 'duplicate', 'invalid_signature',
                                    'not_found', 'void', 'wrong_event', 'refunded')),
  message       TEXT,
  operator_id   UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  gate          TEXT,
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scan_log_event_idx   ON scan_log (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scan_log_result_idx  ON scan_log (result);
CREATE INDEX IF NOT EXISTS scan_log_created_idx ON scan_log (created_at DESC);

-- --------------------------------------------------------------------------
-- email_log — delivery outcome per outbound message
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_log (
  id           BIGSERIAL PRIMARY KEY,
  booking_id   UUID REFERENCES bookings(id) ON DELETE CASCADE,
  recipient    TEXT NOT NULL,
  subject      TEXT NOT NULL,
  template     TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  provider_id  TEXT,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_log_booking_idx ON email_log (booking_id, created_at DESC);

-- --------------------------------------------------------------------------
-- audit_log — admin-side mutations
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGSERIAL PRIMARY KEY,
  actor_id     UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_email  TEXT,
  action       TEXT NOT NULL,
  entity       TEXT,
  entity_id    TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address   INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);

-- --------------------------------------------------------------------------
-- rate_limits — fixed-window counter. Serverless has no shared memory, so the
-- window lives in Postgres where every lambda can see it.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       TEXT PRIMARY KEY,
  hits         INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON rate_limits (window_start);

-- --------------------------------------------------------------------------
-- contact_messages — website enquiry form
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  subject     TEXT,
  message     TEXT NOT NULL,
  handled     BOOLEAN NOT NULL DEFAULT false,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- updated_at triggers
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_touch   ON events;
CREATE TRIGGER events_touch   BEFORE UPDATE ON events   FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS bookings_touch ON bookings;
CREATE TRIGGER bookings_touch BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ===========================================================================
-- Customer catalogue, multi-item carts and the gateway ledger.
--
-- Appended rather than woven into the sections above so this file stays a
-- single idempotent script: everything here depends on tables defined earlier,
-- and `npm run db:push` replays the whole file top to bottom.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- customers — one row per human, deduplicated on email
--
-- Bookings already carry a name/email/phone, but they carry a *copy* per
-- checkout, so "who has ever bought from us" was previously a GROUP BY over a
-- table whose rows get voided and refunded. This is the durable record: it
-- survives a cancelled booking, accumulates across events, and is what the
-- admin console reads.
--
-- Email is the key because it is the address tickets are delivered to. Phone is
-- stored and indexed but not unique — shared family numbers are common.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL UNIQUE,
  phone             TEXT,
  name              TEXT NOT NULL,
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Rollups maintained by the trigger below, never written by application code,
  -- so they cannot drift when a booking changes state from a webhook.
  bookings_count    INTEGER NOT NULL DEFAULT 0,
  tickets_count     INTEGER NOT NULL DEFAULT 0,
  lifetime_paise    BIGINT  NOT NULL DEFAULT 0,
  marketing_opt_in  BOOLEAN NOT NULL DEFAULT false,
  first_source      TEXT,
  last_ip           INET,
  last_user_agent   TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_phone_idx     ON customers (phone);
CREATE INDEX IF NOT EXISTS customers_last_seen_idx ON customers (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS customers_name_idx      ON customers (lower(name));

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id UUID
  REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_customer_idx ON bookings (customer_id, created_at DESC);

-- --------------------------------------------------------------------------
-- booking_items — one row per pass type in a cart
--
-- `bookings.tier_id` holds a single tier, which was true when the only way in
-- was the one-tier booking form. The cart lets somebody buy 2 Normal + 1 Couple
-- in one payment, so the line detail lives here and `bookings.tier_id` keeps
-- pointing at the largest line, which is what the existing admin views and the
-- email template already read.
--
-- Prices are snapshotted per line: a tier repriced after the sale must not
-- retroactively change what an old order says it cost.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tier_id           UUID REFERENCES ticket_tiers(id) ON DELETE SET NULL,
  tier_code         TEXT NOT NULL,
  tier_name         TEXT NOT NULL,
  unit_price_paise  INTEGER NOT NULL CHECK (unit_price_paise >= 0),
  quantity          INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 50),
  -- How many heads one pass of this type admits. A Couple Pass is 2, a VIP
  -- table is 5. The ticket row carries it forward so the door knows without a
  -- lookup.
  admits_each       INTEGER NOT NULL DEFAULT 1 CHECK (admits_each >= 1),
  redeemable_paise  INTEGER NOT NULL DEFAULT 0 CHECK (redeemable_paise >= 0),
  line_total_paise  INTEGER NOT NULL CHECK (line_total_paise >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, tier_code)
);

CREATE INDEX IF NOT EXISTS booking_items_booking_idx ON booking_items (booking_id);

-- Each ticket knows which line it came from and how many people it admits.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS admits INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS booking_item_id UUID
  REFERENCES booking_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tickets_item_idx ON tickets (booking_item_id);

-- --------------------------------------------------------------------------
-- Cashfree joins the provider list. Drop-and-add so the file stays re-runnable.
-- --------------------------------------------------------------------------
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_provider_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_provider_check
  CHECK (payment_provider IN ('none', 'razorpay', 'cashfree', 'upi', 'comp', 'cash'));

-- --------------------------------------------------------------------------
-- payments — gateway transaction ledger
--
-- Every observation of a payment is appended here: the order we created, what
-- the return URL reported, and what the webhook said. Nothing is updated in
-- place, because the point of the table is answering "what did Cashfree
-- actually tell us, and when" during a chargeback or a support call.
--
-- `raw` keeps the provider payload verbatim, so reconciliation questions nobody
-- anticipated are answerable without another API call.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID REFERENCES bookings(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL DEFAULT 'cashfree',
  order_id        TEXT NOT NULL,
  payment_id      TEXT,
  status          TEXT NOT NULL,
  amount_paise    INTEGER NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'INR',
  method          TEXT,
  bank_reference  TEXT,
  message         TEXT,
  -- 'order' | 'return' | 'webhook' | 'poll' — which code path observed this.
  source          TEXT NOT NULL DEFAULT 'return',
  raw             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments (booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_order_idx   ON payments (order_id);
CREATE INDEX IF NOT EXISTS payments_status_idx  ON payments (status, created_at DESC);

-- --------------------------------------------------------------------------
-- customer rollups
--
-- A trigger rather than application code because a booking reaches 'confirmed'
-- from four different places: the free path, the Cashfree return, the Cashfree
-- webhook, and an operator releasing a UPI claim. Recomputing from the bookings
-- table means every one of them stays correct without remembering to call
-- anything.
--
-- Only confirmed bookings count. A pending cart that was never paid is not
-- lifetime value, and a refund removes itself on the way out.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_customer_rollup() RETURNS TRIGGER AS $$
DECLARE
  target UUID;
BEGIN
  target := COALESCE(NEW.customer_id, OLD.customer_id);
  IF target IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE customers c
     SET bookings_count = s.n,
         tickets_count  = s.q,
         lifetime_paise = s.amt
    FROM (
      SELECT count(*)::int                          AS n,
             COALESCE(sum(quantity), 0)::int        AS q,
             COALESCE(sum(amount_paise), 0)::bigint AS amt
        FROM bookings
       WHERE customer_id = target AND status = 'confirmed'
    ) s
   WHERE c.id = target;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bookings_customer_rollup ON bookings;
CREATE TRIGGER bookings_customer_rollup
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION refresh_customer_rollup();

DROP TRIGGER IF EXISTS customers_touch ON customers;
CREATE TRIGGER customers_touch BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- --------------------------------------------------------------------------
-- Backfill: adopt any booking written before the customers table existed.
-- Runs on every push and is a no-op once every booking has a customer_id.
-- --------------------------------------------------------------------------
INSERT INTO customers (email, name, phone, first_seen_at, last_seen_at, first_source)
SELECT lower(b.customer_email),
       (array_agg(b.customer_name  ORDER BY b.created_at DESC))[1],
       (array_agg(b.customer_phone ORDER BY b.created_at DESC))[1],
       min(b.created_at),
       max(b.created_at),
       (array_agg(b.source ORDER BY b.created_at ASC))[1]
  FROM bookings b
 WHERE b.customer_id IS NULL
 GROUP BY lower(b.customer_email)
ON CONFLICT (email) DO NOTHING;

UPDATE bookings b
   SET customer_id = c.id
  FROM customers c
 WHERE b.customer_id IS NULL AND c.email = lower(b.customer_email);

-- --------------------------------------------------------------------------
-- Pass shape lives on the tier, not in a lookup table in the code.
--
-- `admits` is how many heads one pass of this tier lets in — 1 for a solo
-- pass, 2 for a couple, 5 for a VIP table. `redeemable_paise` is the part of
-- the price that comes back as venue credit. Both were previously hard-coded
-- in src/content/ticketing.ts, which meant repricing a tier in the database
-- silently disagreed with what the door and the receipt believed.
-- --------------------------------------------------------------------------
ALTER TABLE ticket_tiers ADD COLUMN IF NOT EXISTS admits INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ticket_tiers ADD COLUMN IF NOT EXISTS redeemable_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ticket_tiers DROP CONSTRAINT IF EXISTS ticket_tiers_admits_check;
ALTER TABLE ticket_tiers ADD CONSTRAINT ticket_tiers_admits_check CHECK (admits >= 1);
ALTER TABLE ticket_tiers DROP CONSTRAINT IF EXISTS ticket_tiers_redeemable_check;
ALTER TABLE ticket_tiers ADD CONSTRAINT ticket_tiers_redeemable_check CHECK (redeemable_paise >= 0);

-- --------------------------------------------------------------------------
-- price_unit — the "/ pass", "/ couple", "/ table" suffix beside a price.
--
-- Previously hard-coded per tier code in src/content/ticketing.ts, which meant
-- a tier created or renamed from the admin console had no way to say how its
-- price is denominated. It belongs with the price it qualifies.
-- --------------------------------------------------------------------------
ALTER TABLE ticket_tiers ADD COLUMN IF NOT EXISTS price_unit TEXT NOT NULL DEFAULT '/ pass';
