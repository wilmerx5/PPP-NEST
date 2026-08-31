-- FE de lote admin (sin orden PPP)
CREATE TABLE IF NOT EXISTS ppp_factus_standalone_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id VARCHAR(64) NOT NULL,
  batch_index INT NOT NULL,
  reference_code VARCHAR(100) NOT NULL,
  customer_name VARCHAR(100) NOT NULL DEFAULT 'Consumidor final',
  invoice_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  invoice_number VARCHAR(64) NULL,
  invoice_cufe VARCHAR(128) NULL,
  public_url VARCHAR(500) NULL,
  qr_url VARCHAR(500) NULL,
  issued_at TIMESTAMP NULL,
  invoice_error VARCHAR(1000) NULL,
  planned_sum INT NOT NULL DEFAULT 0,
  invoice_customer_doc_type VARCHAR(5) NULL,
  invoice_customer_doc_number VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ppp_fsi_issued_at (issued_at),
  INDEX idx_ppp_fsi_number (invoice_number),
  INDEX idx_ppp_fsi_batch (batch_id)
);
