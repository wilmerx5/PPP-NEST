-- Agent V1: LLM + tools (feature flag para probar en PPP antes de SaaS)
ALTER TABLE ppp_whatsapp_settings
  ADD COLUMN agent_v1_enabled TINYINT(1) NOT NULL DEFAULT 0;
