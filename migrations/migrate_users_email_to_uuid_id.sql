-- ============================================
-- Migración: Cambiar PRIMARY KEY de email a id UUID
-- La tabla actualmente tiene email como PRIMARY KEY
-- Necesitamos agregar id UUID y cambiar la clave primaria
-- ============================================

-- PASO 1: BACKUP (EJECUTAR PRIMERO)
CREATE TABLE ppp_users_backup AS SELECT * FROM ppp_users;

-- PASO 2: Verificar foreign keys que usan email (ejecutar para ver dependencias)
-- SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME
-- FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
-- WHERE REFERENCED_TABLE_NAME = 'ppp_users' 
--   AND REFERENCED_COLUMN_NAME = 'email';

-- PASO 3: Agregar columna id UUID (nullable inicialmente)
ALTER TABLE ppp_users ADD COLUMN id VARCHAR(36) NULL;

-- PASO 4: Generar UUIDs únicos para cada fila
UPDATE ppp_users SET id = UUID() WHERE id IS NULL;

-- PASO 5: Verificar que todos tienen UUID
-- SELECT COUNT(*) as total, COUNT(id) as with_id FROM ppp_users;
-- Ambos números deben ser iguales

-- PASO 6: Actualizar foreign keys que usan email como referencia
-- Si tienes estas tablas, ejecuta estas actualizaciones:
-- (Descomenta solo las que existan en tu base de datos)

-- Si ppp_user_points usa email para referenciar usuarios:
-- UPDATE ppp_user_points up 
-- JOIN ppp_users u ON up.user_email = u.email 
-- SET up.user_id = u.id;

-- Si ppp_point_redemptions usa email:
-- UPDATE ppp_point_redemptions pr 
-- JOIN ppp_users u ON pr.user_email = u.email 
-- SET pr.user_id = u.id;

-- Si ppp_addresses usa email:
-- UPDATE ppp_addresses a 
-- JOIN ppp_users u ON a.user_email = u.email 
-- SET a.user_id = u.id;

-- Si ppp_phones usa email:
-- UPDATE ppp_phones p 
-- JOIN ppp_users u ON p.user_email = u.email 
-- SET p.user_id = u.id;

-- Si ppp_verification_tokens usa email:
-- UPDATE ppp_verification_tokens vt 
-- JOIN ppp_users u ON vt.user_email = u.email 
-- SET vt.user_id = u.id;

-- PASO 7: Hacer id NOT NULL
ALTER TABLE ppp_users MODIFY COLUMN id VARCHAR(36) NOT NULL;

-- PASO 8: Eliminar PRIMARY KEY de email (pero mantener UNIQUE)
-- Primero eliminamos la PRIMARY KEY
ALTER TABLE ppp_users DROP PRIMARY KEY;

-- Luego agregamos UNIQUE constraint a email
ALTER TABLE ppp_users ADD UNIQUE KEY unique_email (email);

-- PASO 9: Establecer id como PRIMARY KEY
ALTER TABLE ppp_users ADD PRIMARY KEY (id);

-- PASO 10: Verificar resultado final
-- DESCRIBE ppp_users;
-- Debe mostrar:
-- - id VARCHAR(36) NOT NULL PRIMARY KEY
-- - email VARCHAR(255) NOT NULL UNIQUE (pero ya no PRIMARY KEY)

-- PASO 11: Verificar que todos los registros tienen id
-- SELECT COUNT(*) FROM ppp_users WHERE id IS NULL;
-- Debe devolver 0
