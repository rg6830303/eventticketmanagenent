-- Houz of Vybe as a platform: customer accounts, password resets, abandoned
-- checkout nudges, and more than one event at a time.

-- Accounts live on the customers row. A customer who has bought before and then
-- signs up is the same person, and their history should come with them rather
-- than start again under a second record keyed by the same email.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash  TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS registered_at  TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_login_at  TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS customers_registered_idx ON customers (registered_at DESC) WHERE registered_at IS NOT NULL;

-- Reset links. Only a hash of the token is stored, so a leaked table cannot be
-- turned into working reset links.
CREATE TABLE IF NOT EXISTS password_resets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_resets_customer_idx ON password_resets (customer_id, created_at DESC);

-- One "you did not finish" email per unpaid booking, ever.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS nudge_sent_at TIMESTAMPTZ;

-- Platform fee, 2.5% of the net pass price, charged through Razorpay and
-- already included in amount_paise. Kept separately so reports can split it.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fee_paise INTEGER NOT NULL DEFAULT 0;
