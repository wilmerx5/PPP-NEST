# Migración de ppp_users.id de INT a UUID

## Problema
TypeORM intenta ejecutar `ALTER TABLE ppp_users ADD id uuid NOT NULL PRIMARY KEY`, pero la tabla ya existe con un `id` de otro tipo (probablemente INT), causando el error:
```
Duplicate entry '00000000-0000-0000-0000-000000000000' for key 'PRIMARY'
```

## Solución

### Opción 1: Script Manual (RECOMENDADO)
1. **Hacer backup de la base de datos primero**
2. Ejecutar el script `migrate_users_id_to_uuid_safe.sql` sección por sección
3. Verificar cada paso antes de continuar

### Opción 2: Script Simplificado
Si tu tabla `ppp_users` NO tiene foreign keys de otras tablas, puedes usar el script simplificado:

```sql
-- 1. Agregar columna temporal UUID
ALTER TABLE ppp_users ADD COLUMN id_uuid VARCHAR(36) NULL;

-- 2. Generar UUIDs únicos para cada fila
UPDATE ppp_users SET id_uuid = UUID() WHERE id_uuid IS NULL;

-- 3. Hacer NOT NULL
ALTER TABLE ppp_users MODIFY COLUMN id_uuid VARCHAR(36) NOT NULL;

-- 4. Eliminar PRIMARY KEY y columna antigua
ALTER TABLE ppp_users DROP PRIMARY KEY;
ALTER TABLE ppp_users DROP COLUMN id;

-- 5. Renombrar y establecer como PRIMARY KEY
ALTER TABLE ppp_users CHANGE COLUMN id_uuid id VARCHAR(36) NOT NULL PRIMARY KEY;
```

### Opción 3: Verificar estructura actual
Primero verifica qué tipo tiene actualmente el `id`:

```sql
DESCRIBE ppp_users;
```

Si el `id` actual es INT y quieres mantener los valores existentes como strings, puedes hacer:

```sql
-- Convertir INT a VARCHAR manteniendo los valores
ALTER TABLE ppp_users MODIFY COLUMN id VARCHAR(36) NOT NULL;
-- Luego generar UUIDs nuevos
UPDATE ppp_users SET id = UUID();
ALTER TABLE ppp_users DROP PRIMARY KEY;
ALTER TABLE ppp_users ADD PRIMARY KEY (id);
```

## IMPORTANTE
- ⚠️ **SIEMPRE haz backup antes de ejecutar migraciones**
- ⚠️ Si hay foreign keys, actualízalas antes de eliminar la columna antigua
- ⚠️ Verifica cada paso antes de continuar
- ⚠️ Prueba primero en un ambiente de staging si es posible

## Después de la migración
Una vez completada la migración exitosamente, el código con `synchronize: true` debería funcionar sin problemas.
