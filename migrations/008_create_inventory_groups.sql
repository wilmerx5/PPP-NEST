-- Grupos de inventario: productos que comparten un pool en unidades base (ej. pollo completo = 1, medio = 0.5, cuarto = 0.25).
-- Si se activa inventario en uno, se activa en todos los del grupo. El stock se maneja a nivel grupo.

CREATE TABLE IF NOT EXISTS ppp_inventory_group (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  stock DECIMAL(12,4) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ppp_inventory_group_item (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  product_id INT NOT NULL,
  base_units DECIMAL(10,4) NOT NULL,
  UNIQUE KEY uq_group_product (group_id, product_id),
  CONSTRAINT fk_grp_item_group FOREIGN KEY (group_id) REFERENCES ppp_inventory_group(id) ON DELETE CASCADE,
  CONSTRAINT fk_grp_item_product FOREIGN KEY (product_id) REFERENCES ppp_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
