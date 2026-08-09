-- 1/5 horario: settings del restaurante.
-- En DBeaver: Ctrl+Enter en ESTE archivo (una sola sentencia).

CREATE TABLE IF NOT EXISTS ppp_restaurant_settings (
  id INT PRIMARY KEY,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Bogota',
  weekly_closed_days LONGTEXT NULL,
  open_time VARCHAR(5) NOT NULL DEFAULT '11:00',
  close_time VARCHAR(5) NOT NULL DEFAULT '22:00',
  updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
