# Conversaciones con el modelo real y el router completo

`yarn beta:whatsapp:router` ejecuta los mensajes secuenciales de `scripts/fixtures/whatsapp-live-router-cases.json` contra `WhatsappOrchestratorService`, `WhatsappAgentService`, `WhatsappAiService` y el catálogo reales. Requiere `WHATSAPP_BETA_LIVE=1`, `OPENAI_API_KEY` y `WHATSAPP_BETA_MODEL` igual al snapshot desplegado. `WHATSAPP_BETA_REPEATS` admite 1–3; `WHATSAPP_BETA_CASE_IDS` permite investigar casos concretos.

La persistencia, clientes, pedidos, domicilio y transportes son sintéticos. Solo se permiten solicitudes a la inferencia de OpenAI: no se envían mensajes de WhatsApp, pagos ni pedidos a cocina. El reporte conserva cada turno, carrito, atributos, estado, pedidos simulados y consumo reportado, sin credenciales, en `tmp/whatsapp-live-router-report.json`. Un error del agente, ausencia de respuesta, diferencia de cantidad/estado/atributos o ejecución incompleta rechaza la ronda. El workflow manual `WhatsApp Real Model Router` conserva el reporte y no genera consumo en cada push.

Este nivel complementa las pruebas unitarias con IA simulada, los casos amplios del agente aislado y las integraciones con MariaDB desechable. No acredita por sí solo entrega por Meta, recepción en cocina, concurrencia de mensajes ni configuración de producción. Para reproducir un prompt personalizado, usar `WHATSAPP_BETA_SYSTEM_PROMPT`; el workflow sin ese valor usa el prompt predeterminado del servicio.

## Cobertura y hallazgos del 10 de octubre de 2026

Doce conversaciones, dos repeticiones con `gpt-4.1-2025-04-14`, cubren cantidades después de aclaraciones, consultas sin compra, errores de escritura, reinicio, eliminación selectiva, dirección durante selección, cambio de dirección después de escoger pago, productos agregados durante pago, preparación y nombres de paquetes. Se usa el modelo efectivo de staging y el prompt predeterminado efectivo, con efectivo y transferencia.

La primera ronda aceptó 20/24. Detectó que «tres hamburguesas clásicas», nombre de un paquete del catálogo, se convertía en tres paquetes. La regla nueva interpreta el número que forma parte del nombre como contenido; «dos paquetes de tres …» conserva dos copias. Tiene regresiones con productos sintéticos y verificaciones de cantidades e inventario en MariaDB: no depende de IDs de PPP.

La expectativa inicial de preguntar preparación de sobrebarriga se corrigió porque el sistema ya tiene la política de seleccionar la primera opción predeterminada. La conversación ahora valida esa política y una elección posterior explícita. Esto descubrió un fallo real adicional: «en salsa» se ignoraba mientras se preguntaba el pago. Una opción exacta y única del carrito ahora puede actualizarse durante checkout y retomar el siguiente dato faltante, sin perder cantidades ni notas; las coincidencias ambiguas no se aplican como cambios implícitos.

La ronda posterior aceptó **24/24**, con **57 respuestas de inferencia exitosas**, sin errores HTTP ni del agente. Las **1.004 pruebas unitarias en 56 suites** y TypeScript también pasan. Estos resultados son evidencia acotada de estos escenarios, no una garantía de que todo texto libre posible sea correcto. Los fallos nuevos deben conservarse como regresiones generales antes de cambiar el código.
