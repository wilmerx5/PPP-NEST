CREATE TABLE IF NOT EXISTS ppp_factus_tax_cache (
  environment VARCHAR(100) NOT NULL,
  invoice_number VARCHAR(64) NOT NULL,
  consumption_tax DECIMAL(16,2) NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (environment, invoice_number)
);
