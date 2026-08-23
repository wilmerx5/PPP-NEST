-- Contexto del local para WhatsApp IA.
-- Preferible: el boot del API (ensureWhatsappSettingsColumns) ya las crea.
-- Si ejecutas a mano y alguna columna existe, ignora el error 1060.

ALTER TABLE ppp_whatsapp_settings ADD COLUMN restaurant_name VARCHAR(120) NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN restaurant_address VARCHAR(500) NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN restaurant_city VARCHAR(120) NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN restaurant_neighborhood VARCHAR(120) NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN maps_url VARCHAR(500) NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN public_phone VARCHAR(40) NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN landmarks TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN pickup_notes TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN delivery_notes TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN ai_extra_context TEXT NULL;
