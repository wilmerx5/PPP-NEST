CREATE TABLE IF NOT EXISTS ppp_bold_receipts (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 paymentId VARCHAR(100) NOT NULL,
 merchantId VARCHAR(100) NOT NULL,
 amount DECIMAL(14,2) NOT NULL,
 currency VARCHAR(3) NOT NULL,
 status VARCHAR(24) NOT NULL,
 method VARCHAR(40) NOT NULL,
 paidAt DATETIME(3) NOT NULL,
 receivedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 payerEmail VARCHAR(255) NULL,
 payerName VARCHAR(160) NULL,
 claimedBy VARCHAR(36) NULL,
 claimedByName VARCHAR(160) NULL,
 claimedAt DATETIME(3) NULL,
 orderId INT NULL,
 advanceAmount DECIMAL(14,2) NULL,
 returnedBy VARCHAR(36) NULL,
 returnedByName VARCHAR(160) NULL,
 returnedAt DATETIME(3) NULL,
 UNIQUE KEY uq_bold_payment (paymentId),
 UNIQUE KEY uq_bold_order (orderId),
 INDEX idx_bold_received (receivedAt),
 INDEX idx_bold_paid (paidAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS ppp_bold_events (
 id INT AUTO_INCREMENT PRIMARY KEY,
 eventId VARCHAR(100) NOT NULL,
 paymentId VARCHAR(100) NOT NULL,
 type VARCHAR(30) NOT NULL,
 bodyHash VARCHAR(64) NOT NULL,
 receivedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_bold_event (eventId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
