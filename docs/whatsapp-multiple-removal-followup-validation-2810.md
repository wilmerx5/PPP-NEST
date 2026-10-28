# Tanda265 — aclaración incremental de retiradas múltiples

Base: `4290ddd44a1c636482e809806b827bca63ffffa0`. Derivado del patrón CHAT2510-28; no replay completo del chat original.

El router antes pedía un nombre completo sin guardar la retirada múltiple. Doce recorridos reprodujeron que una respuesta corta no completaba las dos retiradas. No atribuir este fallo al modelo: pruebas sin inferencia, router y catálogo reales con dependencias externas simuladas.

Se conserva un plan de grupos de líneas dentro de `pendingCartRemoval.batchGroups`. La selección por número, nombre distintivo o nota resuelve solo la lista mostrada. El carrito no cambia hasta resolver todos los grupos; entonces se retiran juntos. La firma del carrito invalida el plan si cambió. Una orden múltiple nueva reemplaza el plan anterior; una cancelación explícita lo descarta. Pago u otra selección pendiente bloquean la aplicación. Se reutiliza el bloqueo central de confirmación de cambios pendientes.

96 regresiones nuevas: tres menús sintéticos, agente simulado off/on, construcción y confirmación; recorrido hasta DTO/recibo, entradas ambiguas, preguntas, compra nueva durante la aclaración, números inválidos, cancelación, firma caducada, dos grupos ambiguos, notas de variantes, pago pendiente, tercer producto desconocido y confirmación directa. Foco final360/360 en seis suites; baseline12/12 rojas. TypeScript y global se documentan por separado al cierre, no se deducen del foco.

Límites: carrito inicial preparado, catálogos sintéticos, sin canal Meta ni evaluación acústica/modelo real. Los comandos desconocidos durante esta selección piden aclarar la lista. No se acredita diálogo libre general ni todos los alias. Desconocidos completos no generan planes parciales. La confirmación atómica no elimina dos veces una línea repetida en la lista.

Persistencia: nuevo campo opcional JSON dentro de un pendiente existente, sin migración SQL. Una imagen anterior ignora `batchGroups` y podría retirar solo la opción elegida: antes de un rollback, resolver o cancelar los borradores afectados mediante el flujo normal; no borrar datos de clientes.

Cero llamadas pagadas, Meta u órdenes externas. Presupuesto267/256/11 intacto. Modelos y configuración sin cambios. Solo staging; producción sin modificaciones.

Validación final: global21060 pruebas/330 suites, inventario exacto, 541fuentes congeladas; TypeScript general/build y Node aprobados. `whatsapp-batch-265-validation.json`.

Código `f0ae0d00` publicado y desplegado solo en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED;16controles compilados nuevos/previos y guard central aprobados, con servicios externos aislados. Env/compose/modelos intactos; producción244 verificada sin cambios. Evidencia `whatsapp-batch-265-staging-deployment.json`. Commit posterior documental, sin reconstrucción.
