# Tanda 229 — direcciones reales como fixtures y cierre con nombre guardado

Base `68997eef`, staging. Solo cobertura, sin cambios de runtime. 30 casos nuevos: seis destinos extraídos de chats por cuatro contratos de geocodificación, más tres menús por agente simulado off/on con nombre guardado y cierre completo.

## Qué se comprobó

Direcciones Calle10#81A-20, Carrera81B#6B-50, Calle10#79-15, Carrera81H#51A-39Sur, Diagonal3#83-02 y Transversal78C#6D-48, algunas con conjunto/interiores/referencias. Respuesta exacta al primer intento: una consulta y salida temprana. Recuperación sin símbolos: tercer intento. Parcial o puerta distinta: sin tarifa ni consulta de ruta y solicitud de ubicación. Máximo10 consultas únicas en cada escenario. Repetir una geocodificación acertada reutiliza caché; la ruta se calcula nuevamente. No confundir caché de geocodificación con caché de toda cotización.

Nombre válido guardado evita pedirlo otra vez al recibir plato y dirección; pasa a pago, conserva destinatario y un producto y no crea orden antes de confirmar. Se verifica respuesta, carrito, estado completed y DTO de una única orden simulada, en Arroz Con Pollo, Pizza Margarita y Bowl Vegetal.

## Validación y límites

Baseline24/24 del servicio, foco62/62 en4 suites (30 nuevos y32 existentes),13,485s. TypeScript general aprobado. No nueva global al modificar únicamente tests/docs; última global228:19.760 pruebas/295 suites, fuente congelada. No sumar las nuevas a esa ejecución histórica. Logs `/tmp/ppp-229-baseline.*`, `/tmp/ppp-229-focused.*`, `/tmp/ppp-229-tsc.log`.

Google/Meta/modelo/órdenes simulados; cero llamadas externas y cero gasto API en esta tanda. Los destinos provienen de chats pero las respuestas del proveedor son sintéticas: no acreditan geocodificación real ni latencia/costo real. No se implementó perfil de WhatsApp. El cache actual guarda aciertos por consulta, no una resolución global de todas las variantes: investigar consultas repetidas tras fallos antes de prometer ahorro.

Siguiente: probar reutilización cuando el acierto llegó después de varios fallos, aislamiento por restaurante y cambios de dirección; luego captura de perfil válido editable sin sobrescribir destinatario explícito. Main/modelos intactos, sin despliegue. Runtime210–228 pendiente agrupado;229 solo cobertura.
