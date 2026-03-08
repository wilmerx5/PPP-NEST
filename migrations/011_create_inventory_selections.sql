-- Selección con nombre: agrupa varios productos bajo una misma opción en el modal (ej. "Bebida" = producto 28 o 37).
-- Al vender el producto del group_item, el usuario elige una opción de esta selección; se descuenta ese producto/variante.

CREATE TABLE IF NOT EXISTS ppp_inventory_selection (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT 'Nombre mostrado en el modal (ej. Bebida, Sopa)',
  group_item_id INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_selection_group_item FOREIGN KEY (group_item_id) REFERENCES ppp_inventory_group_item(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ppp_inventory_selection_product (
  id INT AUTO_INCREMENT PRIMARY KEY,
  selection_id INT NOT NULL,
  product_id INT NOT NULL,
  base_units DECIMAL(10,4) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_selection_product (selection_id, product_id),
  CONSTRAINT fk_selprod_selection FOREIGN KEY (selection_id) REFERENCES ppp_inventory_selection(id) ON DELETE CASCADE,
  CONSTRAINT fk_selprod_product FOREIGN KEY (product_id) REFERENCES ppp_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
