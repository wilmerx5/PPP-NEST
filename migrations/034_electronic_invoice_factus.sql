-- Facturación electrónica Factus (emisión manual desde tomar pedidos)
ALTER TABLE ppp_orders
  ADD COLUMN IF NOT EXISTS electronic_invoice_status VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS electronic_invoice_reference VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS electronic_invoice_number VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS electronic_invoice_cufe VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS electronic_invoice_public_url VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS electronic_invoice_qr_url VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS electronic_invoice_issued_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS electronic_invoice_error VARCHAR(1000) NULL,
  ADD COLUMN IF NOT EXISTS invoice_customer_doc_type VARCHAR(5) NULL,
  ADD COLUMN IF NOT EXISTS invoice_customer_doc_number VARCHAR(20) NULL;

CREATE INDEX IF NOT EXISTS idx_ppp_orders_einvoice_status
  ON ppp_orders (electronic_invoice_status);

CREATE INDEX IF NOT EXISTS idx_ppp_orders_einvoice_number
  ON ppp_orders (electronic_invoice_number);
