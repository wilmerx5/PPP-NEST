-- FE: DV, nota crédito, clientes fiscales guardados
ALTER TABLE ppp_orders
  ADD COLUMN IF NOT EXISTS invoice_customer_doc_dv VARCHAR(1) NULL,
  ADD COLUMN IF NOT EXISTS electronic_credit_note_number VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS electronic_credit_note_cufe VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS electronic_credit_note_public_url VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS electronic_credit_note_issued_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS ppp_invoice_customers (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  identification_document_code VARCHAR(5) NOT NULL,
  identification VARCHAR(20) NOT NULL,
  dv VARCHAR(1) NULL,
  legal_organization_code VARCHAR(1) NOT NULL,
  names VARCHAR(150) NULL,
  company VARCHAR(150) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(20) NULL,
  address VARCHAR(250) NULL,
  municipality_code VARCHAR(10) NULL,
  times_used INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_invoice_customer_doc (identification_document_code, identification)
);
