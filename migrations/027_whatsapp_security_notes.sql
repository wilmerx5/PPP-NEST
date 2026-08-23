-- Seguridad / ops WhatsApp
ALTER TABLE ppp_whatsapp_settings ADD COLUMN app_secret TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN ask_order_notes TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN rate_limit_per_minute INT NOT NULL DEFAULT 25;
