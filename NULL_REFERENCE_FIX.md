# Fix: "Cannot read properties of null (reading 'id')"

## Problema

El Circuit Breaker estaba capturando errores de "Cannot read properties of null (reading 'id')" cuando se intentaba acceder a propiedades de objetos que eran `null`.

## Causa

En varios lugares del código se accedía a `item.product.id` o `category.id` sin verificar primero si `item.product` o `category` eran `null`. Esto puede ocurrir cuando:

1. **Relaciones no cargadas**: TypeORM no carga la relación `product` en algunos casos
2. **Productos eliminados**: Un producto fue eliminado pero el `OrderItem` sigue existiendo
3. **Datos inconsistentes**: Hay items en la base de datos con `product_id` null

## Correcciones Aplicadas

### 1. **OrdersService.mapOrderToGroupedFormat()** ✅

**Líneas 465-470 y 845-850**

**Antes**:
```typescript
for (const item of order.items) {
  const productId = item.product.id; // ❌ Puede fallar si product es null
  ...
}
```

**Ahora**:
```typescript
for (const item of order.items) {
  // Validate product exists before accessing properties
  if (!item.product) {
    console.warn(`[mapOrderToGroupedFormat] Order ${order.id} has item without product relation`);
    continue; // Skip items without product
  }
  const productId = item.product.id; // ✅ Seguro
  ...
}
```

### 2. **OrdersService.getDailySummary()** ✅

**Líneas 1160-1165**

**Antes**:
```typescript
for (const item of order.items) {
  const product = allProducts.find(p => p.id === item.product.id); // ❌
  ...
}
```

**Ahora**:
```typescript
for (const item of order.items) {
  if (!item.product) {
    console.warn(`[getDailySummary] Order has item without product relation`);
    continue; // Skip items without product
  }
  const product = allProducts.find(p => p.id === item.product.id); // ✅
  ...
}
```

### 3. **OrdersService.getDailySummary() - halfChickenItem** ✅

**Líneas 1189-1192**

**Antes**:
```typescript
const halfChickenItem = order.items.find(
  item => item.product.code === 2 || item.product.code === 5 // ❌
);
```

**Ahora**:
```typescript
const halfChickenItem = order.items.find(
  item => item.product && (item.product.code === 2 || item.product.code === 5) // ✅
);
if (halfChickenItem && halfChickenItem.product) { // ✅ Doble validación
  ...
}
```

### 4. **ProductsService.findProductsGroupedByCategory()** ✅

**Líneas 103-120**

**Antes**:
```typescript
const transformed = categories.map((category) => ({
  categoryId: category.id, // ❌ Puede fallar si category es null
  products: category.products.map((product) => ({
    id: product.id, // ❌ Puede fallar si product es null
    ...
  })),
}));
```

**Ahora**:
```typescript
const transformed = categories
  .filter((category) => category != null) // ✅ Filtra nulls
  .map((category) => ({
    categoryId: category.id,
    products: (category.products || [])
      .filter((product) => product != null) // ✅ Filtra nulls
      .map((product) => ({
        id: product.id,
        attributes: (product.attributes || [])
          .filter((attr) => attr != null) // ✅ Filtra nulls
          .map((attr) => ({
            attributeName: attr.attributeName,
            options: JSON.parse(attr.options || '[]'), // ✅ Default seguro
          })),
      })),
  }));
```

### 5. **CircuitBreakerService - Mejor Logging** ✅

**Ahora**:
- Detecta específicamente errores de "Cannot read properties of null"
- Muestra stack trace para debugging
- Logs más detallados para identificar el problema

## Resultado

✅ **Errores prevenidos**: Todas las accesos a `.id` ahora validan que el objeto no sea `null`  
✅ **Logging mejorado**: Errores de null reference se logean con más detalle  
✅ **Fallback seguro**: El Circuit Breaker usa fallback (cache) en lugar de fallar  
✅ **Datos consistentes**: Items sin producto se saltan en lugar de causar errores  

## Monitoreo

Si ves warnings como:
```
[mapOrderToGroupedFormat] Order X has item without product relation
```

Esto indica que hay items en la base de datos sin producto asociado. Deberías:

1. **Revisar la base de datos**:
   ```sql
   SELECT oi.id, oi.order_id, oi.product_id 
   FROM ppp_order_items oi 
   WHERE oi.product_id IS NULL;
   ```

2. **Limpiar datos huérfanos** (si es necesario):
   ```sql
   DELETE FROM ppp_order_items WHERE product_id IS NULL;
   ```

3. **Verificar integridad referencial**:
   - Asegurar que `product_id` en `ppp_order_items` tenga foreign key constraint
   - Verificar que productos eliminados no dejen items huérfanos

## Prevención Futura

Para evitar este problema en el futuro:

1. **Siempre validar relaciones** antes de acceder a propiedades:
   ```typescript
   if (!item.product) continue;
   ```

2. **Usar optional chaining** cuando sea apropiado:
   ```typescript
   const name = item.product?.name || 'Unknown';
   ```

3. **Filtrar nulls** en arrays:
   ```typescript
   items.filter(item => item.product != null)
   ```
