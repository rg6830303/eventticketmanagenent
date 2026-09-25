-- Promoter distribution.
--
-- A promoter is handed a number of passes up front at no cost, sells them at
-- their own price, and settles with the house directly. Their passes are
-- minted INACTIVE: the QR exists and is emailed, but the door refuses it until
-- an admin, having been paid, activates it. Activation can be reversed.
--
-- Idempotent: safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS promoters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  phone            TEXT,
  email            TEXT,
  -- HMAC-SHA256 of the normalised login code. Unique so a code maps to exactly
  -- one promoter; the plain code is only ever shown to the admin who set it.
  code_hash        TEXT NOT NULL UNIQUE,
  code_hint        TEXT NOT NULL,
  -- Bumped on every code change, and carried in the session, so changing a
  -- code signs the promoter out everywhere.
  code_version     INTEGER NOT NULL DEFAULT 1,
  allocated        INTEGER NOT NULL DEFAULT 0 CHECK (allocated >= 0),
  -- The agreed settlement price per pass, for the "amount due" figure.
  deal_price_paise INTEGER NOT NULL DEFAULT 0 CHECK (deal_price_paise >= 0),
  active           BOOLEAN NOT NULL DEFAULT true,
  notes            TEXT,
  event_id         UUID REFERENCES events(id) ON DELETE SET NULL,
  last_login_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Everything that happens to a promoter, in one ledger: passes allocated or
-- taken back, passes issued, payments logged, activations. Payments received
-- are summed from here, so there is exactly one place the money is recorded.
CREATE TABLE IF NOT EXISTS promoter_activity (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_id   UUID NOT NULL REFERENCES promoters(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN (
                  'created', 'updated', 'code_changed', 'allocated', 'revoked',
                  'issued', 'payment', 'payment_removed', 'activated', 'deactivated',
                  'login')),
  quantity      INTEGER NOT NULL DEFAULT 0,
  amount_paise  INTEGER NOT NULL DEFAULT 0,
  reference     TEXT,
  note          TEXT,
  actor         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS promoter_activity_idx ON promoter_activity (promoter_id, created_at DESC);

ALTER TABLE tickets  ADD COLUMN IF NOT EXISTS active       BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE tickets  ADD COLUMN IF NOT EXISTS promoter_id  UUID REFERENCES promoters(id) ON DELETE SET NULL;
ALTER TABLE tickets  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promoter_id  UUID REFERENCES promoters(id) ON DELETE SET NULL;
-- Snapshot of doors admitted, so an event's record survives its tickets being
-- purged to save space.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS admitted_count INTEGER;

CREATE INDEX IF NOT EXISTS tickets_promoter_idx  ON tickets (promoter_id) WHERE promoter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_promoter_idx ON bookings (promoter_id) WHERE promoter_id IS NOT NULL;

-- Passes issued by a promoter are a booking source of their own.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_provider_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_provider_check
  CHECK (payment_provider = ANY (ARRAY['none','razorpay','cashfree','upi','comp','cash','promoter']));

COMMIT;
