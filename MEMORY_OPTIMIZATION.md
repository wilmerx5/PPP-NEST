# Optimizaciones de Memoria - Prevención de Out of Memory

Este documento describe las optimizaciones implementadas para prevenir errores de "JavaScript heap out of memory".

---

## Problemas Identificados

1. **Cache sin límite**: El cache podía crecer indefinidamente
2. **Queries ineficientes**: El leaderboard cargaba todos los registros para contar
3. **Sin límite de memoria Node.js**: El proceso podía consumir memoria ilimitada
4. **Cleanup infrecuente**: El cache se limpiaba cada 60s, permitiendo crecimiento

---

## Optimizaciones Implementadas

### 1. **Límite Máximo en Cache** ✅

**Archivo**: `src/common/cache/cache.service.ts`

- **Límite**: 1000 entradas máximo
- **Eviction**: Si el cache está lleno, primero limpia expiradas, luego elimina la más antigua (FIFO)
- **Beneficio**: Previene crecimiento indefinido del cache

```typescript
private readonly maxSize = 1000; // Límite máximo

set<T>(key: string, data: T, ttlMs = this.defaultTtl): void {
  if (this.cache.size >= this.maxSize) {
    this.cleanup();
    if (this.cache.size >= this.maxSize) {
      // Eliminar entrada más antigua
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }
  this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}
```

---

### 2. **Optimización de Leaderboard Query** ✅

**Archivo**: `src/auth/services/points.service.ts`

**Antes**:
```typescript
const totalResult = await countQuery.getRawMany(); // ❌ Carga TODOS los registros
const total = totalResult.length;
```

**Ahora**:
```typescript
const countQuery = this.pointsRepo
  .createQueryBuilder('point')
  .select('COUNT(DISTINCT point.userId)', 'total') // ✅ Solo cuenta, no carga datos
  .where('point.userId IS NOT NULL');
const countResult = await countQuery.getRawOne();
const total = parseInt(countResult?.total || '0', 10);
```

**Beneficio**: Reduce memoria de O(n) a O(1) para el conteo total.

---

### 3. **Límite de Memoria Node.js** ✅

**Archivo**: `package.json`

**Antes**:
```json
"start:prod": "node dist/main"
```

**Ahora**:
```json
"start:prod": "node --max-old-space-size=512 dist/main"
```

**Beneficio**: Limita el heap a 512MB. Si se excede, Node.js falla rápido en lugar de consumir toda la RAM del servidor.

**Nota**: Si necesitas más memoria, puedes aumentar a `--max-old-space-size=1024` (1GB).

---

### 4. **Cleanup Más Frecuente** ✅

**Archivo**: `src/common/common.module.ts`

**Antes**: Cleanup cada 60 segundos
**Ahora**: Cleanup cada 30 segundos

**Beneficio**: Limpia entradas expiradas más rápido, reduciendo el tamaño del cache.

---

## Recomendaciones Adicionales

### Monitoreo de Memoria

Añade logging para monitorear el uso de memoria:

```typescript
// En main.ts o un servicio de monitoreo
setInterval(() => {
  const used = process.memoryUsage();
  const mb = (bytes: number) => Math.round(bytes / 1024 / 1024 * 100) / 100;
  console.log(`[Memory] Heap: ${mb(used.heapUsed)}/${mb(used.heapTotal)} MB | RSS: ${mb(used.rss)} MB`);
  
  if (used.heapUsed > 400 * 1024 * 1024) { // > 400MB
    console.warn('[Memory] ⚠️ High memory usage detected!');
  }
}, 60000); // Cada minuto
```

### Límites en Queries

Asegúrate de que todas las queries tengan límites:

```typescript
// ✅ Bueno
.find({ take: 100 })

// ❌ Malo (puede cargar miles de registros)
.find()
```

### Paginación Obligatoria

Para endpoints que listan datos, siempre usa paginación:

```typescript
@Query('limit') limit?: number = 50,
@Query('offset') offset?: number = 0,
```

---

## Verificación

Para verificar que las optimizaciones funcionan:

1. **Monitorea el tamaño del cache**:
   ```typescript
   // En health endpoint
   cacheSize: this.cache.size(), // Debe estar < 1000
   ```

2. **Revisa logs de memoria**:
   - Busca warnings de "Cache limit reached"
   - Monitorea heap usage

3. **Prueba el leaderboard**:
   - Con muchos usuarios, el COUNT debe ser rápido
   - No debe cargar todos los registros en memoria

---

## Si Aún Tienes Problemas

1. **Aumenta el límite de memoria Node.js**:
   ```json
   "start:prod": "node --max-old-space-size=1024 dist/main"
   ```

2. **Reduce el tamaño del cache**:
   ```typescript
   private readonly maxSize = 500; // En lugar de 1000
   ```

3. **Revisa queries específicas**:
   - Usa `select` específicos en lugar de cargar relaciones completas
   - Añade `take` a todas las queries de listado
   - Usa streaming para datasets grandes

4. **Considera usar Redis**:
   - En lugar de cache in-memory, usa Redis
   - Redis maneja memoria automáticamente
   - Mejor para múltiples instancias

---

## Resumen

✅ Cache limitado a 1000 entradas  
✅ Leaderboard usa COUNT en lugar de cargar todos los registros  
✅ Node.js limitado a 512MB heap  
✅ Cleanup cada 30s en lugar de 60s  

Estas optimizaciones deberían prevenir la mayoría de los errores de "out of memory".
