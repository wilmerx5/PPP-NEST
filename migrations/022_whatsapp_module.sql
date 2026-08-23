-- WhatsApp bot: configuración, conversaciones y mensajes

CREATE TABLE IF NOT EXISTS ppp_whatsapp_settings (
  id INT NOT NULL PRIMARY KEY DEFAULT 1,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  display_phone VARCHAR(32) NULL COMMENT 'Número visible para clientes (+57...)',
  phone_number_id VARCHAR(64) NULL COMMENT 'Meta Phone Number ID',
  waba_id VARCHAR(64) NULL COMMENT 'WhatsApp Business Account ID',
  access_token TEXT NULL COMMENT 'Token permanente Meta Graph API',
  verify_token VARCHAR(128) NULL COMMENT 'Token verificación webhook GET',
  openai_api_key TEXT NULL,
  openai_model VARCHAR(64) NOT NULL DEFAULT 'gpt-4o-mini',
  system_prompt TEXT NULL,
  default_delivery_fee INT NOT NULL DEFAULT 0,
  allow_mercado_pago TINYINT(1) NOT NULL DEFAULT 1,
  welcome_message TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO ppp_whatsapp_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS ppp_whatsapp_conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wa_id VARCHAR(32) NOT NULL COMMENT 'ID usuario WhatsApp (Meta)',
  phone_e164 VARCHAR(32) NOT NULL,
  customer_name VARCHAR(120) NULL,
  state VARCHAR(40) NOT NULL DEFAULT 'building_cart',
  session_data JSON NULL,
  human_takeover TINYINT(1) NOT NULL DEFAULT 0,
  human_agent_id VARCHAR(36) NULL,
  human_agent_name VARCHAR(120) NULL,
  last_message_at TIMESTAMP NULL,
  last_inbound_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_whatsapp_wa_id (wa_id),
  INDEX idx_whatsapp_conv_phone (phone_e164),
  INDEX idx_whatsapp_conv_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ppp_whatsapp_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  direction ENUM('in', 'out') NOT NULL,
  message_type VARCHAR(20) NOT NULL DEFAULT 'text',
  body TEXT NULL,
  wa_message_id VARCHAR(128) NULL,
  sent_by VARCHAR(20) NOT NULL DEFAULT 'bot' COMMENT 'bot | human | system',
  raw_payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_whatsapp_msg_conv (conversation_id),
  INDEX idx_whatsapp_msg_created (created_at),
  CONSTRAINT fk_whatsapp_msg_conv
    FOREIGN KEY (conversation_id) REFERENCES ppp_whatsapp_conversations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
