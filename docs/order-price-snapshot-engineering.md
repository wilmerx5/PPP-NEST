# Bug: Órdenes históricas muestran total con precios actuales

## Problema

Al actualizar precios de productos en el panel de admin y luego consultar **órdenes de ayer** (o cualquier fecha pasada), el total de esas órdenes aparece recalculado con los **precios actuales** de los productos, no con los precios vigentes en el momento del pedido. Eso distorsiona reportes, cortes de caja y vista de historial.

## Causa raíz

1. **Modelo actual**
   - `OrderItem` (tabla `ppp_order_items`) solo guarda: `order_id`, `product_id`, `note`, `kitchen_prepared_at`.
   - **No hay columna de precio** en el ítem; el precio se resuelve siempre desde la relación `item.product.price`.
   - Al crear la orden se hace `product: { id: item.productId }` y no se copia el precio del producto al ítem.

2. **Dónde se “recalcula” con precios actuales**
   - **Backend:** `mapOrderToGroupedFormat()` pone `price = item.product.price` al armar la respuesta de la API (órdenes del día, historial, etc.).
   - **Backend:** Reportes como `getDailySummary`, estadísticas por período, etc., usan `item.product.price` (producto actual) para subtotales y totales.
   - **Front:** Si el front recibe `item.price` en la orden, ese valor viene del backend y ya está calculado con precio actual; si el front calcula total con `product.price` de un catálogo actual, mismo efecto.

3. **Extras**
   - `OrderExtra` sí guarda `amount` (precio del adicional en el momento del pedido). Ahí no hay bug para históricos.

## Objetivo

Que el **total (y subtotal) de una orden** quede fijado en el momento de la creación y no cambie cuando después se actualicen precios de productos. Es decir: **precio histórico por ítem**.

---

## Opciones de solución

### Opción A: Precio unitario en `OrderItem` (recomendada)

**Idea:** Guardar en cada ítem de la orden el precio unitario que tenía el producto **en el momento de crear la orden**.

**Cambios:**

1. **Modelo**
   - Añadir en `OrderItem` una columna, por ejemplo: `unitPrice` (decimal, ej. `precision: 10, scale: 2`).
   - Migración: `ALTER TABLE ppp_order_items ADD COLUMN unit_price DECIMAL(10,2) NULL;`
   - Para **órdenes ya existentes** sin `unit_price`: en backend, al leer un ítem sin `unitPrice` usar `item.product.price` como fallback (comportamiento actual). Opcional: job/migración que rellene `unit_price` con el precio actual del producto para datos viejos (solo como aproximación).

2. **Crear orden**
   - Al crear cada `OrderItem`, cargar el producto (o su precio) y asignar `unitPrice = product.price` antes de guardar.

3. **Actualizar ítems (updateOrderItems)**
   - Al reemplazar ítems de una orden existente, para cada ítem nuevo asignar `unitPrice` con el precio actual del producto en ese momento.

4. **Leer orden / reportes**
   - Donde hoy se usa `item.product.price` para totales o para devolver `price` en la orden:
     - Usar `item.unitPrice ?? item.product.price` (si existe precio guardado, usarlo; si no, fallback a producto actual).
   - Aplicar esto en:
     - `mapOrderToGroupedFormat()` (respuesta API de órdenes).
     - `getDailySummary`, estadísticas por período y cualquier lugar que calcule subtotal/total por ítem.

5. **Front**
   - Si la API ya envía `price` por ítem (o por línea), el front debe usar ese valor y no recalcular con catálogo actual. Revisar vistas de “órdenes de ayer” y reportes para que usen siempre el precio que viene en la orden.

**Pros:** Histórico correcto, reportes y cortes coherentes, solución estándar.  
**Contras:** Migración + tocar creación/actualización de ítems y todos los sitios que calculan totales.

---

### Opción B: Total (y subtotal) en la orden

**Idea:** Guardar en la tabla `Order` el `subtotal` y/o `total` en el momento de crear (y quizá al actualizar ítems).

**Cambios:**

- Columnas en `Order`: por ejemplo `storedSubtotal`, `storedTotal` (o solo `storedTotal`).
- Al crear la orden (y al hacer updateOrderItems): calcular total con precios actuales del producto y guardar en la orden.
- En reportes y en API de detalle de orden: usar ese total guardado en lugar de recalcular desde ítems.

**Pros:** Implementación más acotada (menos sitios que toquen ítems).  
**Contras:** No tienes desglose histórico por ítem (no sabes a cuánto salió cada línea en el pasado); si en el futuro quieres mostrar “precio pagado por unidad” en historial, no lo tienes. Además hay que asegurar que cada vez que se modifican ítems se vuelva a calcular y guardar el total.

---

### Opción C: Híbrido (precio en ítem + total en orden)

- Guardar `unitPrice` en `OrderItem` (como en A).
- Opcionalmente guardar `storedTotal` (y subtotal) en `Order` al crear/actualizar para no recalcular en reportes pesados.

Da máximo de información y flexibilidad, a costa de más cambios y redundancia.

---

### Opción D: No guardar precio; “congelar” en una tabla de historial de precios

**Idea:** Mantener una tabla `product_prices` con (product_id, price, valid_from, valid_to) y al calcular total de una orden histórica usar el precio vigente en `order.createdAt`.

**Contras:** No tienes hoy esa tabla; habría que poblarla con historial (complejo) o solo desde hoy; consultas más complejas; no resuelve el pasado ya vivido sin ese historial. No recomendable como primera medida.

---

## Recomendación

- **Implementar Opción A:** añadir `unitPrice` en `OrderItem`, rellenarlo al crear y al actualizar ítems, y usar “precio del ítem si existe, si no producto actual” en todo cálculo de totales y en la respuesta de la API.
- **Datos antiguos:** aceptar que órdenes ya creadas no tienen `unit_price`; en backend usar siempre el fallback `item.product.price` para esos ítems (comportamiento actual). Opcionalmente un script único que rellene `unit_price` con el precio actual del producto como aproximación para reportes pasados.
- **Front:** Revisar pantallas de “órdenes de ayer” y reportes para que muestren el total (y desglose) que envía la API de órdenes y no recalculen con precios del catálogo actual.

## Resumen de impacto

| Componente              | Cambio principal                                                |
|-------------------------|-----------------------------------------------------------------|
| `OrderItem` entity      | Nueva columna `unitPrice` (nullable decimal).                   |
| Creación de orden       | Asignar `unitPrice = product.price` por ítem.                  |
| updateOrderItems        | Asignar `unitPrice` al crear ítems nuevos.                     |
| mapOrderToGroupedFormat | Usar `item.unitPrice ?? item.product.price` para `price`.      |
| getDailySummary / stats | Calcular subtotal/total con `item.unitPrice ?? item.product.price`. |
| Front (órdenes ayer)    | Usar total/precios que vienen en la orden, no recalcular.       |

No se ha ejecutado ningún cambio de código; este documento es solo ingeniería y propuesta.
