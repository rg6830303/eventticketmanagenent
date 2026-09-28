-- Promoter serials start at 0 (range 0-4999), and promoter sales can be
-- reversed from the console. Idempotent.
BEGIN;
ALTER TABLE promoter_serials DROP CONSTRAINT IF EXISTS promoter_serials_serial_check;
ALTER TABLE promoter_serials ADD CONSTRAINT promoter_serials_serial_check CHECK (serial BETWEEN 0 AND 4999);
ALTER TABLE promoter_activity DROP CONSTRAINT IF EXISTS promoter_activity_kind_check;
ALTER TABLE promoter_activity ADD CONSTRAINT promoter_activity_kind_check CHECK (kind IN (
  'created', 'updated', 'code_changed', 'allocated', 'revoked', 'issued', 'reversed',
  'payment', 'payment_removed', 'activated', 'deactivated', 'login'));
COMMIT;
