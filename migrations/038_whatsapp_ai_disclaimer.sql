-- Aviso IA / beta en el primer mensaje de WhatsApp
ALTER TABLE ppp_whatsapp_settings
  ADD COLUMN ai_disclaimer_message TEXT NULL;
