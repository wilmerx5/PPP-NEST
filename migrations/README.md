# Migraciones PPP-NEST

## 001_create_ppp_order_extras.sql

Crea la tabla `ppp_order_extras` para **adicionales** (extras, platos, cubiertos, etc.) asociados a una orden. El código **90** en ppp-orders-front abre un modal para añadir estos adicionales en lugar de registrar un producto.

### Cómo ejecutar

```bash
# Desde la raíz del proyecto PPP-NEST
mysql -u TU_USUARIO -p TU_BASE_DE_DATOS < migrations/001_create_ppp_order_extras.sql
```

O desde tu cliente MySQL/MariaDB:

```sql
SOURCE /ruta/a/PPP-NEST/migrations/001_create_ppp_order_extras.sql;
```

### Estructura de la tabla

- `id`: PK, autoincrement
- `order_id`: FK → `ppp_orders.id` (CASCADE on delete)
- `title`: título o descripción del adicional (ej. "Plato extra", "Cubierto")
- `description`: detalle opcional (nullable)
- `amount`: precio del adicional
- `quantity`: cantidad (default 1)
- `created_at`: timestamp
