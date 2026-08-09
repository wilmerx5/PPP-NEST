-- 3/5 festivos / dias puntuales de cierre.

CREATE TABLE IF NOT EXISTS ppp_holiday_closures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  closure_date DATE NOT NULL,
  name VARCHAR(255) NOT NULL,
  all_day TINYINT(1) NOT NULL DEFAULT 1,
  start_time VARCHAR(5) NULL,
  end_time VARCHAR(5) NULL,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP(),
  UNIQUE KEY uq_holiday_closure_date (closure_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
