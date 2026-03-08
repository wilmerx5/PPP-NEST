-- "También descontar de" a nivel producto (para productos que NO están en grupos de inventario).
-- Idempotente.
DELIMITER //
DROP PROCEDURE IF EXISTS ppp_012_add_also_deduct_columns//
CREATE PROCEDURE ppp_012_add_also_deduct_columns()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppp_products' AND COLUMN_NAME = 'also_deduct_product_id') THEN
    ALTER TABLE ppp_products ADD COLUMN also_deduct_product_id INT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppp_products' AND COLUMN_NAME = 'also_deduct_attribute_name') THEN
    ALTER TABLE ppp_products ADD COLUMN also_deduct_attribute_name VARCHAR(100) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppp_products' AND COLUMN_NAME = 'also_deduct_attribute_value') THEN
    ALTER TABLE ppp_products ADD COLUMN also_deduct_attribute_value VARCHAR(100) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppp_products' AND COLUMN_NAME = 'also_deduct_base_units') THEN
    ALTER TABLE ppp_products ADD COLUMN also_deduct_base_units DECIMAL(10,4) NULL;
  END IF;
END//
DELIMITER ;
CALL ppp_012_add_also_deduct_columns();
DROP PROCEDURE IF EXISTS ppp_012_add_also_deduct_columns;

DELIMITER //
DROP PROCEDURE IF EXISTS ppp_012_add_also_deduct_fk//
CREATE PROCEDURE ppp_012_add_also_deduct_fk()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ppp_products' AND CONSTRAINT_NAME = 'fk_products_also_deduct_product'
  ) THEN
    ALTER TABLE ppp_products ADD CONSTRAINT fk_products_also_deduct_product
      FOREIGN KEY (also_deduct_product_id) REFERENCES ppp_products(id) ON DELETE SET NULL;
  END IF;
END//
DELIMITER ;
CALL ppp_012_add_also_deduct_fk();
DROP PROCEDURE IF EXISTS ppp_012_add_also_deduct_fk;
