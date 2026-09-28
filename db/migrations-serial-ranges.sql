-- Promoter serials: 1000-4999 (was 1000-5000), and payments recorded
-- against the exact serials they cover. Idempotent.
BEGIN;
ALTER TABLE promoter_serials DROP CONSTRAINT IF EXISTS promoter_serials_serial_check;
ALTER TABLE promoter_serials ADD CONSTRAINT promoter_serials_serial_check CHECK (serial BETWEEN 1000 AND 4999);
ALTER TABLE promoter_activity ADD COLUMN IF NOT EXISTS serials INTEGER[];
COMMIT;
