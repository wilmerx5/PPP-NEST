-- Migration: Add inventory tracking to ppp_products
-- Run against your MariaDB/MySQL database.
-- When track_inventory = 1, stock is checked on order create/update and decremented.
-- Stock is per product (code); future rules may deduct by variant/attribute.

ALTER TABLE ppp_products
ADD COLUMN track_inventory TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '1 = controlar stock y descontar en órdenes',
ADD COLUMN stock INT NOT NULL DEFAULT 0
  COMMENT 'Unidades en inventario (solo aplica si track_inventory = 1)';
