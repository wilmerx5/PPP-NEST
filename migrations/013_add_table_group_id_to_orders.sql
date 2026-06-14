-- Vincular cuentas de varias mesas (grupo de mesas linkeadas)
-- Patrón igual que 006_add_inventory_to_ppp_products.sql
--
-- DBeaver: selecciona SOLO el ALTER (líneas 8-11) y Ctrl+Enter.
-- Si dice "Duplicate column", la columna ya existe — ejecuta solo el CREATE INDEX de abajo.

ALTER TABLE ppp_orders
ADD COLUMN table_group_id BIGINT NULL DEFAULT NULL
  COMMENT 'ID de grupo cuando varias mesas comparten cuenta',
ADD INDEX idx_ppp_orders_table_group_id (table_group_id);

-- Si el ALTER falló porque la columna ya existe, ejecuta solo esto:
-- CREATE INDEX idx_ppp_orders_table_group_id ON ppp_orders (table_group_id);
