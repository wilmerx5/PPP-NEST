-- 4/5 flag de disponibilidad limitada en productos.
-- Si dice "Duplicate column name 'has_schedule'", ya esta: pasa al 019.

ALTER TABLE ppp_products
  ADD COLUMN has_schedule TINYINT(1) NOT NULL DEFAULT 0;
