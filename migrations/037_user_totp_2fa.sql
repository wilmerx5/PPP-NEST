-- TOTP 2FA for staff (MySQL-compatible; IF NOT EXISTS no es portable en todos los MySQL)
-- Preferir el ensure al boot; este archivo queda para historial / RUN_MIGRATIONS.

ALTER TABLE ppp_users ADD COLUMN totp_enabled TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE ppp_users ADD COLUMN totp_secret VARCHAR(64) NULL;
ALTER TABLE ppp_users ADD COLUMN totp_recovery_codes TEXT NULL;
