ALTER TABLE ppp_products
  ADD COLUMN combo_base_product_id INT NULL,
  ADD CONSTRAINT fk_product_combo_base FOREIGN KEY (combo_base_product_id) REFERENCES ppp_products(id) ON DELETE RESTRICT;
