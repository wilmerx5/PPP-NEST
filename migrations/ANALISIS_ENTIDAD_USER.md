# Análisis de la Entidad User y Problemas Identificados

## ❌ PROBLEMAS ENCONTRADOS:

### 1. **DISCREPANCIA ENTRE ENTIDAD Y BASE DE DATOS:**

**Entidad User (`user.entity.ts`):**
- Define `id` como `@PrimaryGeneratedColumn('uuid')` (UUID)
- Espera que `id` sea VARCHAR(36) UUID PRIMARY KEY

**Base de Datos Actual:**
- ❌ NO tiene columna `id`
- ✅ PRIMARY KEY es `email` (varchar(255))
- ✅ Columnas existentes: email, password, fullName, isActive, phone, roles, created_at, google_id, provider

### 2. **TypeORM está intentando ejecutar:**
```sql
ALTER TABLE `ppp_users` ADD `id` uuid NOT NULL PRIMARY KEY
```
Pero esto FALLA porque:
- Ya existe una PRIMARY KEY (`email`)
- No puede agregar una nueva columna como PRIMARY KEY sin eliminar la anterior primero

### 3. **ENTIDADES RELACIONADAS QUE ESPERAN `user_id` UUID:**

Todas estas entidades tienen `user_id` VARCHAR que debe referenciar al UUID del usuario:

- ✅ `ppp_user_points` → `user_id` VARCHAR (nullable) → Espera UUID
- ✅ `ppp_point_redemptions` → `user_id` VARCHAR (NOT NULL) → Espera UUID
- ✅ `ppp_user_addresses` → `user_id` VARCHAR (NOT NULL) → Espera UUID
- ✅ `ppp_user_phones` → `user_id` VARCHAR (NOT NULL) → Espera UUID
- ⚠️ `ppp_verification_token` → No tiene `user_id` explícito, TypeORM lo creará automáticamente como VARCHAR

## ✅ SOLUCIÓN REQUERIDA:

### En la Base de Datos debe crearse:

1. **Columna `id` VARCHAR(36) UUID como PRIMARY KEY**
   - Generar UUIDs únicos para cada usuario existente
   - Establecer como PRIMARY KEY

2. **Cambiar `email` de PRIMARY KEY a UNIQUE KEY**
   - Mantener la unicidad del email
   - Pero ya no será PRIMARY KEY

3. **Actualizar foreign keys** (si existen tablas relacionadas con datos):
   - Las tablas relacionadas esperan `user_id` VARCHAR(36) UUID
   - Si ya tienen datos, actualizar las referencias de `email` a `id` UUID

## 📋 ESTRUCTURA FINAL ESPERADA:

```sql
ppp_users:
  - id VARCHAR(36) NOT NULL PRIMARY KEY (UUID)
  - email VARCHAR(255) NOT NULL UNIQUE
  - password VARCHAR(255) NULL
  - fullName VARCHAR(255) NOT NULL
  - isActive TINYINT(4) NOT NULL DEFAULT 0
  - phone VARCHAR(255) NULL
  - roles TEXT NULL
  - created_at TIMESTAMP NOT NULL
  - google_id VARCHAR(255) NULL UNIQUE
  - provider VARCHAR(255) NULL DEFAULT 'local'
```

## 🔧 SCRIPT DE MIGRACIÓN:

Ver archivo: `migrate_users_email_to_uuid_id.sql`
