-- Script para actualizar el enum de la columna 'type' en ppp_user_points
-- Ejecutar este script en la base de datos para agregar 'admin' al enum

ALTER TABLE `ppp_user_points` 
MODIFY COLUMN `type` ENUM('automatic', 'manual', 'admin') NOT NULL DEFAULT 'automatic';
