-- Métodos de pago configurables para WhatsApp (JSON).
ALTER TABLE ppp_whatsapp_settings
  ADD COLUMN payment_methods JSON NULL;
