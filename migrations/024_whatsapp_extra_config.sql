-- Más config WhatsApp (URLs, mensajes, operación). El boot del API también las asegura.

ALTER TABLE ppp_whatsapp_settings ADD COLUMN menu_url VARCHAR(500) NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN website_url VARCHAR(500) NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN instagram_url VARCHAR(500) NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN ignore_business_hours TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN prep_time_note VARCHAR(255) NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN delivery_time_note VARCHAR(255) NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN min_order_amount INT NOT NULL DEFAULT 0;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN payment_instructions TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN hours_note TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN cancel_policy_note TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN human_handoff_message TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN closed_message TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN menu_link_message TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN order_success_message TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN ai_temperature DECIMAL(3,2) NULL DEFAULT 0.20;
