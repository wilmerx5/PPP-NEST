# Conversaciones con el modelo real y el router completo

`yarn beta:whatsapp:router` ejecuta los mensajes secuenciales de `scripts/fixtures/whatsapp-live-router-cases.json` contra `WhatsappOrchestratorService`, `WhatsappAgentService`, `WhatsappAiService` y el catálogo reales. Requiere `WHATSAPP_BETA_LIVE=1`, `OPENAI_API_KEY` y `WHATSAPP_BETA_MODEL` igual al snapshot desplegado. `WHATSAPP_BETA_REPEATS` admite 1–3; `WHATSAPP_BETA_CASE_IDS` permite investigar casos concretos.

La persistencia, clientes, pedidos, domicilio y transportes son sintéticos. Solo se permiten solicitudes a la inferencia de OpenAI: no se envían mensajes de WhatsApp, pagos ni pedidos a cocina. El reporte conserva cada turno, carrito, atributos, estado, pedidos simulados y consumo reportado, sin credenciales, en `tmp/whatsapp-live-router-report.json`. Un error del agente, ausencia de respuesta, diferencia de cantidad/estado/atributos o ejecución incompleta rechaza la ronda. El workflow manual `WhatsApp Real Model Router` conserva el reporte y no genera consumo en cada push.

Este nivel complementa las pruebas unitarias con IA simulada, los casos amplios del agente aislado y las integraciones con MariaDB desechable. No acredita por sí solo entrega por Meta, recepción en cocina, concurrencia de mensajes ni configuración de producción. Para reproducir un prompt personalizado, usar `WHATSAPP_BETA_SYSTEM_PROMPT`; el workflow sin ese valor usa el prompt predeterminado del servicio.

## Cobertura y hallazgos del 10 de octubre de 2026

Doce conversaciones, dos repeticiones con `gpt-4.1-2025-04-14`, cubren cantidades después de aclaraciones, consultas sin compra, errores de escritura, reinicio, eliminación selectiva, dirección durante selección, cambio de dirección después de escoger pago, productos agregados durante pago, preparación y nombres de paquetes. Se usa el modelo efectivo de staging y el prompt predeterminado efectivo, con efectivo y transferencia.

La primera ronda aceptó 20/24. Detectó que «tres hamburguesas clásicas», nombre de un paquete del catálogo, se convertía en tres paquetes. La regla nueva interpreta el número que forma parte del nombre como contenido; «dos paquetes de tres …» conserva dos copias. Tiene regresiones con productos sintéticos y verificaciones de cantidades e inventario en MariaDB: no depende de IDs de PPP.

La expectativa inicial de preguntar preparación de sobrebarriga se corrigió porque el sistema ya tiene la política de seleccionar la primera opción predeterminada. La conversación ahora valida esa política y una elección posterior explícita. Esto descubrió un fallo real adicional: «en salsa» se ignoraba mientras se preguntaba el pago. Una opción exacta y única del carrito ahora puede actualizarse durante checkout y retomar el siguiente dato faltante, sin perder cantidades ni notas; las coincidencias ambiguas no se aplican como cambios implícitos.

La ronda posterior aceptó **24/24**, con **57 respuestas de inferencia exitosas**, sin errores HTTP ni del agente. Las **1.004 pruebas unitarias en 56 suites** y TypeScript también pasan. MariaDB 10.11 local aprobó **79/79 integraciones en tres suites**, incluida persistencia, eventos e inventario de paquetes con nombres sintéticos. Estos resultados son evidencia acotada de estos escenarios, no una garantía de que todo texto libre posible sea correcto. Los fallos nuevos deben conservarse como regresiones generales antes de cambiar el código.

## Ampliación y revalidación integrada

Se integraron las correcciones de dirección, selección de cuarto de pollo, pechuga, yuca y jugos de `997b5a13`, además del cambio local que separa medidas de cantidades. La matriz creció a 33 conversaciones. La primera ampliación aceptó 62/64 ejecuciones: pedir gaseosa 250 ml agregaba también una de 400 ml. La validación ahora rechaza presentaciones con tamaño explícito incompatible y el resolver de bebida independiente exige el tamaño exacto, sin sustituirlo por una botella cercana preferida.

Una integración firmada detectó que una nota dirigida a la variante de arepas blancas, seguida de «el de fritas déjalo igual», se interpretaba como cambio de atributo. El parser conserva ahora las instrucciones de preservación reconocidas y aplica la nota solo a la línea indicada. La prueba verifica nota, preparación, cantidades, inventario y payload de cocina; no exige que una ruta específica llame a la IA.

La revalidación del candidato integrado aprobó **33/33 conversaciones** con GPT-4.1, 73 inferencias exitosas y sin errores HTTP, además de **6/6 ejecuciones focalizadas** (tres por fallo). Pasaron **1.174 unitarias/56 suites**, TypeScript y **81 integraciones/3 suites** con MariaDB 10.11 local. La matriz determinista verifica 65 productos, una presentación por nombre y dos unidades por código. El caso de arroz chino con medio pollo pasó en el router completo: la omisión observada en el ensayo del agente aislado no obliga a cambiar la política de defaults ni aceptar un carrito vacío.

El runner agrega comparación exacta de líneas/variantes y pacing de 1.500 ms entre inicios de inferencias. La ronda inicial tuvo dos respuestas 429 de rate limit recuperadas; esto se conserva como evidencia, no se presenta como ausencia de errores de proveedor. No se compararon modelos ni se volvió a ejecutar el corpus amplio completo por rutina.


## Comprensión e intención: campaña adicional

El foco actual es lenguaje y continuidad del pedido; pagos, eventos de cocina y transporte quedan fuera de esta campaña. Se añadieron 17 conversaciones, para un total de 50. Incluyen consultas de precio/cantidad y disponibilidad sin compra, hipótesis, recomendaciones, negaciones, referencias sin antecedente, sustitución de producto, aceptación de una cotización, corrección coloquial de cantidades, eliminación con preservación, compra junto con consulta, cierre cortés y notas acumuladas.

La primera ampliación de intención aceptó 13/17. Detectó cuatro fallos: aceptación referencial sin producto persistido, una pregunta de precio que bloqueaba la compra en otra cláusula, un demostrativo ambiguo que activaba un candidato ajeno y cierre cortés que no avanzaba. Las correcciones consultan nombres del catálogo y contexto real; no agregan IDs, precios ni excepciones de productos PPP al runtime. Una consulta con varios productos unidos por «y» conserva su intención de cotización.

El runner también verifica hechos requeridos y prohibidos en las respuestas (`replyAny`, `replyAll`, `replyForbid`), además del carrito y el estado. Estas comprobaciones son acotadas; no equivalen a evaluar automáticamente toda la calidad semántica de cada respuesta. Se inspeccionan también los diálogos completos.

La revalidación aprobó **50/50 conversaciones** con `gpt-4.1-2025-04-14`, **113 respuestas de inferencia**, sin errores HTTP ni del agente. Los dos casos de aceptación y compra con consulta aprobaron además **6/6 repeticiones focalizadas**. Pasaron **1.177 pruebas unitarias en 56 suites** y TypeScript. Los respaldos de las primeras rondas conservan los fallos; no se presentan como rondas aprobadas.
