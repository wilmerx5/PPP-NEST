-- Timeouts / idle WhatsApp
ALTER TABLE ppp_whatsapp_settings ADD COLUMN human_agent_idle_minutes INT NOT NULL DEFAULT 30;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN human_client_idle_minutes INT NOT NULL DEFAULT 120;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN order_draft_idle_minutes INT NOT NULL DEFAULT 45;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN pending_choice_idle_minutes INT NOT NULL DEFAULT 15;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN mp_payment_idle_minutes INT NOT NULL DEFAULT 60;
ALTER TABLE ppp_whatsapp_settings ADD COLUMN session_idle_notify TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE ppp_whatsapp_conversations ADD COLUMN human_takeover_at TIMESTAMP NULL;
ALTER TABLE ppp_whatsapp_conversations ADD COLUMN last_human_outbound_at TIMESTAMP NULL;
