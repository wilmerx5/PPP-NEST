-- Stock por variante (atributo): ej. producto 28 Bebida, atributo Sabor → stock por Limonada, Gaseosa, etc.
-- Las órdenes descontarán de esta tabla cuando el ítem tenga el atributo seleccionado.
CREATE TABLE IF NOT EXISTS ppp_product_variant_stock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  attribute_name VARCHAR(100) NOT NULL,
  attribute_value VARCHAR(100) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_product_attr_value (product_id, attribute_name, attribute_value),
  CONSTRAINT fk_variant_stock_product FOREIGN KEY (product_id) REFERENCES ppp_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
