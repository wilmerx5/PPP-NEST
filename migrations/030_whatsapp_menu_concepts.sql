-- Grupos concepto del menú WhatsApp (carne → churrasco, sobrebarriga…).
ALTER TABLE ppp_whatsapp_settings
  ADD COLUMN menu_concept_groups JSON NULL;
