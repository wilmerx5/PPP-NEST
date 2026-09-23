-- Guarda líneas del lote para poder reintentar FE fallidas
ALTER TABLE ppp_factus_standalone_invoices
  ADD COLUMN IF NOT EXISTS lines_json LONGTEXT NULL
  AFTER planned_sum;
