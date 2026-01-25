-- Migration: Create ppp_order_extras table for additional charges (extras, platos, etc.)
-- Run this migration against your MariaDB/MySQL database.
-- Usage: mysql -u USER -p DATABASE < migrations/001_create_ppp_order_extras.sql

-- Create table for order extras (adicionales)
CREATE TABLE IF NOT EXISTS `ppp_order_extras` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `title` varchar(255) NOT NULL COMMENT 'Título o descripción del adicional (ej. Plato extra, Cubierto)',
  `description` text DEFAULT NULL COMMENT 'Detalle opcional',
  `amount` decimal(10,2) NOT NULL COMMENT 'Precio del adicional',
  `quantity` int NOT NULL DEFAULT 1 COMMENT 'Cantidad',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_ppp_order_extras_order_id` (`order_id`),
  CONSTRAINT `FK_ppp_order_extras_order` FOREIGN KEY (`order_id`) REFERENCES `ppp_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
