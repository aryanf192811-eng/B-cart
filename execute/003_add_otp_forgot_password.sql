-- ═══════════════════════════════════════════════════════════════
--  B-CART OTP MIGRATION
--  File: migrations/003_add_otp_forgot_password.sql
--
--  SAFE TO RUN: Uses IF NOT EXISTS / IF NOT EXISTS guards everywhere.
--  Running twice will not duplicate anything.
--
--  Run with:
--    psql -d your_db -f migrations/003_add_otp_forgot_password.sql
--  Or in Node:
--    await db.query(fs.readFileSync('./migrations/003_add_otp_forgot_password.sql', 'utf8'));
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1.  Add phone column to users table
--     (SKIP this block if your users table already has phone)
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'phone'
  ) THEN
    ALTER TABLE users ADD COLUMN phone VARCHAR(15);
    -- nullable: existing users may not have phone yet
    -- they fill it in when requesting OTP the first time
    RAISE NOTICE 'Added phone column to users table';
  ELSE
    RAISE NOTICE 'phone column already exists on users — skipped';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2.  OTP requests table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The phone the OTP was sent to
  phone        VARCHAR(15) NOT NULL,

  -- SHA-256 hash of the actual OTP (never store plain-text)
  otp_hash     VARCHAR(64) NOT NULL,

  -- Why the OTP was issued
  purpose      VARCHAR(50) NOT NULL DEFAULT 'forgot_password',
  -- other possible values: 'login', 'phone_verify'

  -- Has it been consumed?
  is_used      BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Failed verification attempts (lock out after 3)
  attempts     INTEGER     NOT NULL DEFAULT 0,

  -- Timestamps
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes'
);

-- ── Indexes ──
-- Speed up the "find valid OTP for this phone" query
CREATE INDEX IF NOT EXISTS idx_otp_phone_valid
  ON otp_requests (phone, is_used, expires_at);

-- Speed up cleanup job
CREATE INDEX IF NOT EXISTS idx_otp_created
  ON otp_requests (created_at);

-- ────────────────────────────────────────────────────────────
-- 3.  Password reset tokens table
--     (Issued AFTER OTP is verified — valid for 15 minutes)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(64) NOT NULL,   -- SHA-256 of the raw token
  is_used      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes'
);

CREATE INDEX IF NOT EXISTS idx_reset_token_hash
  ON password_reset_tokens (token_hash, is_used, expires_at);

CREATE INDEX IF NOT EXISTS idx_reset_user
  ON password_reset_tokens (user_id);

-- ────────────────────────────────────────────────────────────
-- 4.  Auto-cleanup function (optional, call from a cron job)
--     Deletes expired + used records older than 24 hours
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM otp_requests
  WHERE (expires_at < NOW() - INTERVAL '24 hours')
     OR (is_used = TRUE AND created_at < NOW() - INTERVAL '24 hours');

  DELETE FROM password_reset_tokens
  WHERE (expires_at < NOW() - INTERVAL '24 hours')
     OR (is_used = TRUE AND created_at < NOW() - INTERVAL '24 hours');
END;
$$;

COMMIT;

-- ────────────────────────────────────────────────────────────
-- VERIFY (run this after migration to confirm)
-- ────────────────────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'users' AND column_name = 'phone';
--
-- SELECT table_name FROM information_schema.tables
--  WHERE table_name IN ('otp_requests','password_reset_tokens');
