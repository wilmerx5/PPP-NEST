CREATE TABLE IF NOT EXISTS ppp_bold_online_settings (
 id VARCHAR(40) NOT NULL PRIMARY KEY,
 identityKeyEnc TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS ppp_bold_qr_attempts (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 requestKey VARCHAR(80) NOT NULL,
 reference VARCHAR(80) NOT NULL,
 createdBy VARCHAR(36) NOT NULL,
 merchantId VARCHAR(100) NOT NULL,
 amount DECIMAL(14,2) NOT NULL,
 status VARCHAR(20) NOT NULL,
 transactionId VARCHAR(100) NULL,
 qrImage MEDIUMTEXT NULL,
 expiresAt DATETIME(3) NULL,
 intentExpiresAt DATETIME(3) NOT NULL,
 error VARCHAR(200) NULL,
 lastCheckedAt DATETIME(3) NULL,
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_bold_qr_request (requestKey),
 UNIQUE KEY uq_bold_qr_reference (reference),
 INDEX idx_bold_qr_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE ppp_bold_receipts ADD COLUMN confirmationSource VARCHAR(24) NOT NULL DEFAULT 'webhook';
ALTER TABLE ppp_bold_events ADD INDEX idx_bold_event_payment (paymentId);
