-- 5/5 horarios por producto (dias/horas en que se muestra en la web).

CREATE TABLE IF NOT EXISTS ppp_product_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  day_of_week TINYINT NOT NULL COMMENT '0=Domingo ... 6=Sabado',
  start_time VARCHAR(5) NULL,
  end_time VARCHAR(5) NULL,
  INDEX idx_product_schedules_product (product_id),
  CONSTRAINT fk_product_schedules_product
    FOREIGN KEY (product_id) REFERENCES ppp_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
