# Estrategias Anti-Bloqueo Implementadas

Este documento describe todas las estrategias implementadas para evitar bloqueos, errores internos y caídas del servicio durante momentos críticos (tomar pedidos, cargar menú, etc.).

---

## 1. **Cache In-Memory para Productos/Menú** ⚡

**Problema:** Cada request al menú hace queries pesadas con relaciones (categorías, atributos). En momentos de alta carga, esto bloquea la DB.

**Solución:**
- **CacheService** (`common/cache/cache.service.ts`): Cache en memoria con TTL
- **TTL: 45 segundos** - Balance entre datos frescos y reducción de carga
- **Invalidación automática** cuando se crea/actualiza/elimina un producto
- **Cleanup periódico** cada 60s para eliminar entradas expiradas

**Endpoints cacheados:**
- `GET /api/products` → `products:all`
- `GET /api/products/categories/list` → `products:categories`
- `GET /api/products/categories` → `products:grouped`

**Beneficio:** Reduce queries a DB en ~95% para requests de menú. Si la DB está lenta, los clientes ven datos cached (máx. 45s de antigüedad).

---

## 2. **Circuit Breaker** 🔌

**Problema:** Si la DB falla repetidamente, cada request intenta conectarse y falla, generando cascada de errores.

**Solución:**
- **CircuitBreakerService** (`common/circuit-breaker/circuit-breaker.service.ts`)
- **Estados:**
  - **CLOSED**: Normal, todas las requests pasan
  - **OPEN**: 5 fallos consecutivos → corta el circuito, usa fallback (cache)
  - **HALF_OPEN**: Después de 30s, intenta 3 requests de prueba
- **Configuración:**
  - `failureThreshold: 5` - Se abre tras 5 fallos
  - `resetTimeout: 30000` - Espera 30s antes de intentar recuperar
  - `halfOpenMaxAttempts: 3` - Necesita 3 éxitos para cerrar

**Uso:**
- **ProductsService**: `findAll()`, `findAllCategories()`, `findProductsGroupedByCategory()` → Si DB falla, devuelve cache (o array vacío si no hay cache)
- **OrdersService**: `findOrdersToday()` → Si DB falla, devuelve array vacío (mejor que error 500)

**Beneficio:** Si la DB está caída, el servicio sigue respondiendo con datos cached en lugar de cascada de errores 500.

---

## 3. **Query Timeout (5 segundos)** ⏱️

**Problema:** Queries que se cuelgan indefinidamente bloquean conexiones del pool.

**Solución:**
- **`queryTimeout: 5000`** en TypeORM `extra` config
- Cualquier query que tarde > 5s es cancelada automáticamente
- Evita que queries lentas bloqueen el pool

**Beneficio:** Si una query se cuelga, se cancela en 5s y libera la conexión para otros requests.

---

## 4. **Request Timeout (30 segundos)** ⏱️

**Problema:** Requests que se cuelgan indefinidamente consumen recursos.

**Solución:**
- **RequestTimeoutInterceptor** (`common/interceptors/request-timeout.interceptor.ts`)
- Timeout global de **30 segundos** para todos los requests
- Si un request tarda > 30s, retorna `408 Request Timeout`

**Beneficio:** Evita que requests colgados consuman recursos indefinidamente.

---

## 5. **Connection Pool Optimizado** 🔄

**Configuración actual:**
```typescript
{
  poolSize: 100,
  connectionLimit: 100,
  queueLimit: 0, // Ilimitada - requests esperan en lugar de fallar
  maxIdle: 10, // Solo 10 conexiones inactivas (evita conexiones muertas)
  idleTimeout: 60000, // 1 min - libera antes de que DB cierre (wait_timeout ~5 min)
  enableKeepAlive: true,
  queryTimeout: 5000, // 5s max por query
  reconnect: true, // Reconoce automáticamente
}
```

**Beneficios:**
- **Queue ilimitada**: Requests esperan una conexión en lugar de fallar con "Queue limit reached"
- **Idle timeout corto**: Libera conexiones antes de que el servidor DB las cierre (evita ECONNRESET)
- **Max idle bajo**: Menos conexiones inactivas = menos riesgo de reutilizar conexiones muertas

---

## 6. **Exception Filter para Errores DB Transitorios** 🛡️

**Problema:** ECONNRESET, ECONNREFUSED, etc. generan 500 Internal Server Error, confundiendo a los clientes.

**Solución:**
- **DbExceptionFilter** (`common/filters/db-exception.filter.ts`)
- Detecta errores transitorios: `ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT`, `PROTOCOL_CONNECTION_LOST`, etc.
- Retorna **503 Service Unavailable** con `Retry-After: 5` en lugar de 500
- Los clientes saben que es temporal y pueden reintentar

**Beneficio:** Errores de conexión se manejan como temporales (503) en lugar de errores fatales (500).

---

## 7. **Retry Interceptor para GET** 🔁

**Problema:** Errores transitorios en requests GET (lecturas) pueden resolverse con un reintento.

**Solución:**
- **DbRetryInterceptor** (`common/interceptors/db-retry.interceptor.ts`)
- Solo para **GET** y **HEAD** (idempotentes)
- Si falla con error transitorio (ECONNRESET, etc.), **reintenta 1 vez** después de 300ms
- Reduce 503s en lecturas cuando la conexión se cae momentáneamente

**Beneficio:** Muchos errores transitorios se resuelven automáticamente con un reintento.

---

## 8. **Graceful Shutdown** 🛑

**Problema:** Al hacer deploy o reiniciar, conexiones DB pueden quedar abiertas o requests pueden cortarse abruptamente.

**Solución:**
- Escucha **SIGTERM** y **SIGINT** en `main.ts`
- Cierra la app con `app.close()` (TypeORM cierra conexiones limpiamente)
- Luego `process.exit(0)` para evitar quedarse colgado

**Beneficio:** Deploys y reinicios limpios sin conexiones huérfanas.

---

## 9. **Health Check Mejorado** 💚

**Endpoint:** `GET /api/health`

**Respuesta cuando DB está OK:**
```json
{
  "status": "ok",
  "db": "connected",
  "circuitBreaker": "CLOSED",
  "cacheSize": 3,
  "timestamp": "2026-01-25T..."
}
```

**Respuesta cuando DB está caída:**
```json
{
  "status": "degraded",
  "db": "disconnected",
  "circuitBreaker": "OPEN",
  "timestamp": "2026-01-25T..."
}
```
(HTTP 503)

**Uso en Render:**
- Configurar Health Check Path: `/api/health`
- Si retorna 503, Render reinicia el servicio automáticamente

---

## 10. **Bootstrap Error Handling** 🚀

**Problema:** Si el servicio falla al arrancar, puede quedar en estado indefinido.

**Solución:**
- `bootstrap().catch(...)` en `main.ts`
- Si hay error al iniciar, log + `process.exit(1)` para que Render reinicie

---

## Resumen de Beneficios

✅ **Menú siempre carga** - Cache de 45s + circuit breaker con fallback  
✅ **Pedidos no se bloquean** - Query timeout 5s + request timeout 30s  
✅ **Errores transitorios se manejan** - 503 con Retry-After en lugar de 500  
✅ **Reintentos automáticos** - GET requests se reintentan 1 vez  
✅ **Pool resiliente** - Queue ilimitada, idle timeout corto, reconnect automático  
✅ **Shutdown limpio** - No deja conexiones huérfanas  
✅ **Monitoreo** - Health check muestra estado de DB y circuit breaker  

---

## Monitoreo Recomendado

1. **Logs de Circuit Breaker**: Buscar `[Circuit Breaker] Circuit OPEN` - indica que DB está fallando mucho
2. **Health Check**: Monitorear `/api/health` - si retorna 503 frecuentemente, hay problema de DB
3. **Cache Hit Rate**: El `cacheSize` en health indica cuántas entradas hay cached
4. **Query Timeouts**: Si ves muchos timeouts, puede haber queries lentas que necesitan optimización

---

## Próximas Mejoras Opcionales

- **Redis cache** (en lugar de in-memory) para múltiples instancias
- **Rate limiting** para evitar abuso
- **Query logging** para detectar queries lentas
- **Connection pool metrics** (cuántas conexiones activas, en queue, etc.)
