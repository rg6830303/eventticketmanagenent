-- Serial numbers on every pass.
--
-- The ticket code (HOV-DAND-XXXXXXXXXX) is unguessable on purpose, which also
-- makes it useless to say out loud. Every pass now also carries a short serial,
-- unique within its event:
--
--   1000–5000   promoter passes. Serials are reserved to a promoter when passes
--               are allocated, so every allocated pass is traceable before it
--               is even issued.
--   5001+       everything else — website sales and console-issued passes —
--               from a per-event counter.
--
-- Idempotent: safe to run more than once.

BEGIN;

ALTER TABLE events  ADD COLUMN IF NOT EXISTS next_serial INTEGER NOT NULL DEFAULT 5001;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS serial INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS tickets_event_serial_idx ON tickets (event_id, serial) WHERE serial IS NOT NULL;

-- One row per serial reserved to a promoter; ticket_id is filled when they
-- issue it. Deleting a promoter frees their unissued serials; issued ones stay
-- on the tickets themselves.
CREATE TABLE IF NOT EXISTS promoter_serials (
  event_id    UUID    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  serial      INTEGER NOT NULL CHECK (serial BETWEEN 1000 AND 5000),
  promoter_id UUID    NOT NULL REFERENCES promoters(id) ON DELETE CASCADE,
  ticket_id   UUID    REFERENCES tickets(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, serial)
);
CREATE INDEX IF NOT EXISTS promoter_serials_promoter_idx ON promoter_serials (promoter_id, serial);

-- Backfill: non-promoter passes get 5001+ in issue order, per event.
WITH numbered AS (
  SELECT t.id, t.event_id,
         5000 + row_number() OVER (PARTITION BY t.event_id ORDER BY t.created_at, t.id) AS serial
    FROM tickets t JOIN bookings b ON b.id = t.booking_id
   WHERE t.serial IS NULL AND b.promoter_id IS NULL AND b.payment_provider <> 'promoter'
)
UPDATE tickets t SET serial = n.serial FROM numbered n WHERE t.id = n.id;

UPDATE events e SET next_serial = GREATEST(e.next_serial,
  COALESCE((SELECT max(serial) + 1 FROM tickets t WHERE t.event_id = e.id AND t.serial > 5000), 5001));

-- Backfill: reserve each existing promoter's allocation as a contiguous block,
-- in creation order, and give their issued passes the first serials of it.
DO $$
DECLARE
  p RECORD;
  next_free INTEGER;
  ev UUID;
BEGIN
  FOR p IN SELECT * FROM promoters ORDER BY created_at LOOP
    ev := COALESCE(p.event_id, (SELECT id FROM events WHERE status = 'published' ORDER BY starts_at DESC LIMIT 1));
    IF ev IS NULL OR EXISTS (SELECT 1 FROM promoter_serials WHERE promoter_id = p.id) THEN CONTINUE; END IF;
    UPDATE promoters SET event_id = ev WHERE id = p.id AND event_id IS NULL;
    SELECT COALESCE(max(serial) + 1, 1000) INTO next_free FROM promoter_serials WHERE event_id = ev;
    INSERT INTO promoter_serials (event_id, serial, promoter_id)
      SELECT ev, s, p.id FROM generate_series(next_free, next_free + p.allocated - 1) s WHERE s <= 5000;
    WITH issued AS (
      SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM tickets WHERE promoter_id = p.id
    ), slots AS (
      SELECT serial, row_number() OVER (ORDER BY serial) AS rn FROM promoter_serials WHERE promoter_id = p.id
    )
    UPDATE tickets t SET serial = s.serial FROM issued i JOIN slots s ON s.rn = i.rn WHERE t.id = i.id;
    UPDATE promoter_serials ps SET ticket_id = t.id FROM tickets t
     WHERE t.promoter_id = p.id AND t.serial = ps.serial AND ps.event_id = t.event_id;
  END LOOP;
END $$;

COMMIT;
