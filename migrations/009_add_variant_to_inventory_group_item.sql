-- Permite que un ítem del grupo sea producto (nivel producto) o producto+variante.
-- attribute_name/attribute_value vacíos = nivel producto; si tienen valor = esa variante comparte el pool del grupo.
-- Idempotente: se puede ejecutar varias veces sin error.

-- Añadir columnas solo si no existen
DELIMITER //
DROP PROCEDURE IF EXISTS ppp_009_add_variant_columns//
CREATE PROCEDURE ppp_009_add_variant_columns()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppp_inventory_group_item' AND COLUMN_NAME = 'attribute_name'
  ) THEN
    ALTER TABLE ppp_inventory_group_item ADD COLUMN attribute_name VARCHAR(100) NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppp_inventory_group_item' AND COLUMN_NAME = 'attribute_value'
  ) THEN
    ALTER TABLE ppp_inventory_group_item ADD COLUMN attribute_value VARCHAR(100) NOT NULL DEFAULT '';
  END IF;
END//
DELIMITER ;
CALL ppp_009_add_variant_columns();
DROP PROCEDURE IF EXISTS ppp_009_add_variant_columns;

-- Primero añadir el nuevo índice (group_id, product_id son prefijo, así las FKs siguen teniendo índice).
-- Luego quitar el antiguo; si se quita antes, las foreign key fallan.
DELIMITER //
DROP PROCEDURE IF EXISTS ppp_009_add_new_index//
CREATE PROCEDURE ppp_009_add_new_index()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppp_inventory_group_item' AND INDEX_NAME = 'uq_group_product_variant'
  ) THEN
    ALTER TABLE ppp_inventory_group_item
      ADD UNIQUE KEY uq_group_product_variant (group_id, product_id, attribute_name, attribute_value);
  END IF;
END//
DELIMITER ;
CALL ppp_009_add_new_index();
DROP PROCEDURE IF EXISTS ppp_009_add_new_index;

-- Ahora quitar el índice antiguo (las FKs ya usan el nuevo).
DELIMITER //
DROP PROCEDURE IF EXISTS ppp_009_drop_old_index//
CREATE PROCEDURE ppp_009_drop_old_index()
BEGIN
  IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppp_inventory_group_item' AND INDEX_NAME = 'uq_group_product'
  ) THEN
    ALTER TABLE ppp_inventory_group_item DROP INDEX uq_group_product;
  END IF;
END//
DELIMITER ;
CALL ppp_009_drop_old_index();
DROP PROCEDURE IF EXISTS ppp_009_drop_old_index;
