-- Límites y contexto operativo WhatsApp (boot también asegura columnas)
ALTER TABLE ppp_whatsapp_settings ADD COLUMN max_order_amount INT NOT NULL DEFAULT 0;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN max_units_per_item INT NOT NULL DEFAULT 10;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN max_total_units INT NOT NULL DEFAULT 0;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN max_cart_lines INT NOT NULL DEFAULT 0;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN handoff_when_max_exceeded TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN large_order_handoff_message TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN allergens_note TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN promotions_note TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN service_area_note TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN cash_change_note TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN transfer_info_note TEXT NULL;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN special_requests_note TEXT NULL;
