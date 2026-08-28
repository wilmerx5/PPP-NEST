-- TOTP 2FA for staff (authenticator app)
ALTER TABLE ppp_users
  ADD COLUMN IF NOT EXISTS totp_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS totp_recovery_codes TEXT NULL;
