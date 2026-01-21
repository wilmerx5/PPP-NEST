-- ============================================
-- Script Flexible - Se adapta a la estructura actual
-- IMPORTANTE: Haz backup primero
-- CREATE TABLE ppp_users_backup AS SELECT * FROM ppp_users;
-- ============================================

-- PASO 1: Verificar estructura actual
-- Ejecuta esto primero y envíame el resultado:
DESCRIBE ppp_users;
SHOW CREATE TABLE ppp_users;

-- PASO 2: Verificar qué columna es la PRIMARY KEY
-- Esto te mostrará todas las columnas y cuál es la clave primaria actual
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    IS_NULLABLE, 
    COLUMN_KEY,
    EXTRA
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'ppp_users'
ORDER BY ORDINAL_POSITION;

-- PASO 3: Una vez que sepamos la estructura, ajustaremos el script
-- Por ahora, intenta agregar la columna UUID sin especificar AFTER id:

ALTER TABLE ppp_users ADD COLUMN id_uuid VARCHAR(36) NULL;

-- PASO 4: Si el PASO 3 funciona, continúa con:
UPDATE ppp_users SET id_uuid = UUID() WHERE id_uuid IS NULL;

-- PASO 5: Verificar
SELECT COUNT(*) as total, COUNT(id_uuid) as with_uuid FROM ppp_users;

-- Después de esto, necesitaremos saber:
-- 1. Qué columna es actualmente la PRIMARY KEY (puede ser 'id', 'user_id', etc.)
-- 2. Qué tipo de dato tiene esa columna
