-- ============================================
-- EJECUTAR ESTE SCRIPT EN ORDEN
-- IMPORTANTE: Haz backup primero con:
-- CREATE TABLE ppp_users_backup AS SELECT * FROM ppp_users;
-- ============================================

-- PASO 1: Verificar estructura actual (ejecutar primero para ver qué tienes)
-- DESCRIBE ppp_users;

-- PASO 2: Verificar foreign keys (ejecutar para ver qué tablas dependen de ppp_users)
-- SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME
-- FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
-- WHERE REFERENCED_TABLE_NAME = 'ppp_users' AND REFERENCED_COLUMN_NAME = 'id';

-- PASO 3: Agregar columna temporal UUID
ALTER TABLE ppp_users ADD COLUMN id_uuid VARCHAR(36) NULL AFTER id;

-- PASO 4: Generar UUIDs únicos para cada fila existente
UPDATE ppp_users SET id_uuid = UUID() WHERE id_uuid IS NULL;

-- PASO 5: Verificar que todos tienen UUID (ejecutar para confirmar)
-- SELECT COUNT(*) as total, COUNT(id_uuid) as with_uuid FROM ppp_users;
-- Ambos números deben ser iguales

-- PASO 6: Si tienes estas tablas, ejecuta estas actualizaciones:
-- (Descomenta solo las que existan en tu base de datos)

-- Si tienes ppp_user_points:
-- UPDATE ppp_user_points up JOIN ppp_users u ON up.user_id = u.id SET up.user_id = u.id_uuid;

-- Si tienes ppp_point_redemptions:
-- UPDATE ppp_point_redemptions pr JOIN ppp_users u ON pr.user_id = u.id SET pr.user_id = u.id_uuid;

-- Si tienes ppp_addresses:
-- UPDATE ppp_addresses a JOIN ppp_users u ON a.user_id = u.id SET a.user_id = u.id_uuid;

-- Si tienes ppp_phones:
-- UPDATE ppp_phones p JOIN ppp_users u ON p.user_id = u.id SET p.user_id = u.id_uuid;

-- Si tienes ppp_verification_tokens:
-- UPDATE ppp_verification_tokens vt JOIN ppp_users u ON vt.user_id = u.id SET vt.user_id = u.id_uuid;

-- PASO 7: Hacer la columna UUID NOT NULL
ALTER TABLE ppp_users MODIFY COLUMN id_uuid VARCHAR(36) NOT NULL;

-- PASO 8: Eliminar PRIMARY KEY y columna id antigua
ALTER TABLE ppp_users DROP PRIMARY KEY;
ALTER TABLE ppp_users DROP COLUMN id;

-- PASO 9: Renombrar id_uuid a id y establecer como PRIMARY KEY
ALTER TABLE ppp_users CHANGE COLUMN id_uuid id VARCHAR(36) NOT NULL PRIMARY KEY;

-- PASO 10: Verificar resultado final
-- DESCRIBE ppp_users;
-- Debe mostrar: id VARCHAR(36) NOT NULL PRIMARY KEY
