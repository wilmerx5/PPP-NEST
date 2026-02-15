-- Migration: Add is_active to ppp_products (activate/deactivate products from admin)
-- Run this migration against your MariaDB/MySQL database.
-- Usage: mysql -u USER -p DATABASE < migrations/003_add_is_active_to_ppp_products.sql
--
-- Products with is_active = 0 are excluded from public lists (GET /products, GET /products/categories)
-- and cannot be added to new orders. Admin can toggle via PATCH /admin/products/:id/active

ALTER TABLE ppp_products
ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1
COMMENT '1 = activo (visible y pedible), 0 = desactivado por admin';
