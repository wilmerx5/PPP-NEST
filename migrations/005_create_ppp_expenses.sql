-- Egresos: pago proveedores, impuestos, nómina, arriendo, servicios, otros.
-- expense_date = día del egreso (zona Colombia, mismo criterio que órdenes).
CREATE TABLE IF NOT EXISTS ppp_expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_expense_date (expense_date),
  INDEX idx_category (category)
);
