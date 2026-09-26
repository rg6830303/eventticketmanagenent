-- One-code lock for the view-only promoter overview at /promoview.
-- The code itself is never stored: only a bcrypt hash, inserted separately.
CREATE TABLE IF NOT EXISTS view_passcodes (
  name       TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
