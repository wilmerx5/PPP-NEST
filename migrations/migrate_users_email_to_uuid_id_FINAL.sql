-- ============================================
-- MIGRACIÓN FINAL: Cambiar PRIMARY KEY de email a id UUID
-- ============================================
-- PROBLEMA: La tabla ppp_users tiene email como PRIMARY KEY
--          pero la entidad User espera id UUID como PRIMARY KEY
-- SOLUCIÓN: Crear columna id UUID y cambiar la clave primaria
-- ============================================

-- ⚠️ PASO 0: BACKUP OBLIGATORIO (EJECUTAR PRIMERO)
CREATE TABLE ppp_users_backup AS SELECT * FROM ppp_users;

-- ============================================
-- PASO 1: Verificar estructura actual
-- ============================================
-- DESCRIBE ppp_users;
-- Debe mostrar: email como PRIMARY KEY

-- ============================================
-- PASO 2: Verificar foreign keys existentes
-- ============================================
-- Ejecutar para ver qué tablas dependen de ppp_users:
-- SELECT 
--     TABLE_NAME,
--     CONSTRAINT_NAME,
--     COLUMN_NAME
-- FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
-- WHERE REFERENCED_TABLE_NAME = 'ppp_users';

-- ============================================
-- PASO 3: Agregar columna id UUID (nullable inicialmente)
-- ============================================
ALTER TABLE ppp_users ADD COLUMN id VARCHAR(36) NULL;

-- ============================================
-- PASO 4: Generar UUIDs únicos para cada fila existente
-- ============================================
UPDATE ppp_users SET id = UUID() WHERE id IS NULL;

-- ============================================
-- PASO 5: Verificar que todos tienen UUID
-- ============================================
-- SELECT COUNT(*) as total, COUNT(id) as with_id FROM ppp_users;
-- Ambos números DEBEN ser iguales. Si no, hay un problema.

-- ============================================
-- PASO 6: Actualizar foreign keys en tablas relacionadas
-- ============================================
-- Si estas tablas ya existen y tienen datos, ejecuta estas actualizaciones:
-- IMPORTANTE: Solo ejecuta las que existan en tu base de datos

-- Si tienes ppp_user_points con datos:
-- UPDATE ppp_user_points up
-- JOIN ppp_users u ON up.user_id = u.email  -- Si usan email como FK
-- SET up.user_id = u.id;

-- Si tienes ppp_point_redemptions con datos:
-- UPDATE ppp_point_redemptions pr
-- JOIN ppp_users u ON pr.user_id = u.email
-- SET pr.user_id = u.id;

-- Si tienes ppp_user_addresses con datos:
-- UPDATE ppp_user_addresses a
-- JOIN ppp_users u ON a.user_id = u.email
-- SET a.user_id = u.id;

-- Si tienes ppp_user_phones con datos:
-- UPDATE ppp_user_phones p
-- JOIN ppp_users u ON p.user_id = u.email
-- SET p.user_id = u.id;

-- Si tienes ppp_verification_token con datos:
-- UPDATE ppp_verification_token vt
-- JOIN ppp_users u ON vt.user_id = u.email
-- SET vt.user_id = u.id;

-- ============================================
-- PASO 7: Hacer id NOT NULL
-- ============================================
ALTER TABLE ppp_users MODIFY COLUMN id VARCHAR(36) NOT NULL;

-- ============================================
-- PASO 8: Eliminar PRIMARY KEY de email
-- ============================================
ALTER TABLE ppp_users DROP PRIMARY KEY;

-- ============================================
-- PASO 9: Agregar UNIQUE constraint a email
-- ============================================
-- Esto mantiene la unicidad del email sin ser PRIMARY KEY
ALTER TABLE ppp_users ADD UNIQUE KEY unique_email (email);

-- ============================================
-- PASO 10: Establecer id como PRIMARY KEY
-- ============================================
ALTER TABLE ppp_users ADD PRIMARY KEY (id);

-- ============================================
-- PASO 11: Verificar resultado final
-- ============================================
-- DESCRIBE ppp_users;
-- Debe mostrar:
--   - id VARCHAR(36) NOT NULL PRIMARY KEY
--   - email VARCHAR(255) NOT NULL (con UNIQUE, no PRIMARY)
--   - ... resto de columnas

-- Verificar que no hay filas sin id:
-- SELECT COUNT(*) FROM ppp_users WHERE id IS NULL;
-- Debe devolver 0

-- ============================================
-- ¡MIGRACIÓN COMPLETA!
-- Ahora TypeORM con synchronize: true debería funcionar sin errores
-- ============================================
