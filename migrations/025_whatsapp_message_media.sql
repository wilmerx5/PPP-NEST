-- Audio/imagen en inbox WhatsApp (boot también asegura columnas)
ALTER TABLE ppp_whatsapp_messages ADD COLUMN media_id VARCHAR(128) NULL;
ALTER TABLE ppp_whatsapp_messages ADD COLUMN mime_type VARCHAR(120) NULL;
