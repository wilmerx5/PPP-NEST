# Migraciones PPP-NEST

## Automático al arrancar (recomendado)

En `.env`:

```env
RUN_MIGRATIONS=true
```

Al iniciar Nest (`start` / `start:prod`), se aplican los `.sql` pendientes de esta carpeta (en orden) y se registran en `ppp_schema_migrations`. Si una columna/tabla ya existía, se marca como aplicada y continúa.

Dejar en `false` en runtime normal después de desplegar.

## Manual

Desde la raíz del proyecto:

```bash
mysql -u TU_USUARIO -p TU_BASE_DE_DATOS < migrations/NOMBRE_ARCHIVO.sql
```

O desde el cliente MySQL/MariaDB:

```sql
SOURCE /ruta/a/PPP-NEST/migrations/NOMBRE_ARCHIVO.sql;
```

---

## 001_create_ppp_order_extras.sql

Crea la tabla `ppp_order_extras` para **adicionales** (extras, platos, cubiertos, etc.) asociados a una orden. El código **90** en ppp-orders-front abre un modal para añadir estos adicionales en lugar de registrar un producto.

### Estructura de la tabla

- `id`: PK, autoincrement
- `order_id`: FK → `ppp_orders.id` (CASCADE on delete)
- `title`: título o descripción del adicional (ej. "Plato extra", "Cubierto")
- `description`: detalle opcional (nullable)
- `amount`: precio del adicional
- `quantity`: cantidad (default 1)
- `created_at`: timestamp

---

## 002_add_kitchen_prepared_at_to_order_items.sql

Añade `kitchen_prepared_at` a `ppp_order_items` para marcar cuándo cocina da por listos los ítems.

---

## 003_add_is_active_to_ppp_products.sql

Añade la columna `is_active` a `ppp_products` para poder activar/desactivar productos desde el admin.

- **Valores**: `1` = activo (visible en listados y se puede agregar a pedidos), `0` = desactivado.
- **Por defecto**: los productos existentes quedan con `1` (activos).
- Los listados públicos (`GET /products`, `GET /products/categories`) solo devuelven productos activos.
- Al crear una orden, si algún producto está desactivado el backend responde 400 con mensaje claro.
- El admin usa `GET /admin/products` (ve todos) y `PATCH /admin/products/:id/active` para cambiar el estado.

---

## 004_add_unit_price_to_order_items.sql

Añade `unit_price` a `ppp_order_items` para guardar el **precio unitario en el momento del pedido**.

- **Objetivo:** Que las órdenes históricas no cambien de total cuando se actualicen precios de productos en el admin. El total de una orden debe ser el que tenía cuando se creó.
- **Columna:** `unit_price` DECIMAL(10,2) NULL. NULL en ítems de órdenes antiguas (se usa `product.price` como fallback).
- **Uso:** Al crear una orden o al actualizar ítems, se guarda el precio actual del producto en `unit_price`. En reportes, API y correos se usa `item.unit_price ?? product.price`.
