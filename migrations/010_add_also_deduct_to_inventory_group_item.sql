-- Al vender el producto de este ítem del grupo, además del grupo se puede descontar de una variante de otro producto.
-- Ej: producto 22 en el grupo → también descontar de producto 28, variante Sabor:Limonada.
-- Idempotente: se puede ejecutar varias veces sin error.

DELIMITER //
DROP PROCEDURE IF EXISTS ppp_010_add_also_deduct_columns//
CREATE PROCEDURE ppp_010_add_also_deduct_columns()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppp_inventory_group_item' AND COLUMN_NAME = 'also_deduct_product_id'
  ) THEN
    ALTER TABLE ppp_inventory_group_item ADD COLUMN also_deduct_product_id INT NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppp_inventory_group_item' AND COLUMN_NAME = 'also_deduct_attribute_name'
  ) THEN
    ALTER TABLE ppp_inventory_group_item ADD COLUMN also_deduct_attribute_name VARCHAR(100) NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppp_inventory_group_item' AND COLUMN_NAME = 'also_deduct_attribute_value'
  ) THEN
    ALTER TABLE ppp_inventory_group_item ADD COLUMN also_deduct_attribute_value VARCHAR(100) NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppp_inventory_group_item' AND COLUMN_NAME = 'also_deduct_base_units'
  ) THEN
    ALTER TABLE ppp_inventory_group_item ADD COLUMN also_deduct_base_units DECIMAL(10,4) NULL;
  END IF;
END//
DELIMITER ;
CALL ppp_010_add_also_deduct_columns();
DROP PROCEDURE IF EXISTS ppp_010_add_also_deduct_columns;

-- FK solo si no existe
DELIMITER //
DROP PROCEDURE IF EXISTS ppp_010_add_also_deduct_fk//
CREATE PROCEDURE ppp_010_add_also_deduct_fk()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppp_inventory_group_item' AND CONSTRAINT_NAME = 'fk_grp_item_also_deduct_product'
  ) THEN
    ALTER TABLE ppp_inventory_group_item
      ADD CONSTRAINT fk_grp_item_also_deduct_product
      FOREIGN KEY (also_deduct_product_id) REFERENCES ppp_products(id) ON DELETE SET NULL;
  END IF;
END//
DELIMITER ;
CALL ppp_010_add_also_deduct_fk();
DROP PROCEDURE IF EXISTS ppp_010_add_also_deduct_fk;
