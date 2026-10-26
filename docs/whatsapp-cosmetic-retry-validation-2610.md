# Tanda 203 — eliminar inferencia de resumen cosmético

Fecha: 26/10/2026. Base: `845e90de`, rama `staging`.

## Problema y cambio

El agente repetía una inferencia cuando su respuesta terminada superaba 420 caracteres, aunque las acciones ya estuvieran aplicadas. Esa segunda llamada se utilizaba únicamente para resumir. Se elimina ese camino; se conserva el texto terminado dentro del límite preexistente de 3500 caracteres.

No cambian modelos, presupuesto de salida, herramientas, reintentos HTTP ni recuperaciones de compras incompletas o afirmaciones de compra sin acción. La corrección no depende de productos o restaurantes.

## Evidencia focalizada

El diagnóstico 198 tenía 12 casos: ocho verdes y cuatro fallidos por el salto 420→421 caracteres. Se promueve a spec, sin duplicar el repro, comprobando también igualdad de respuesta. Abarca Chat y Responses con dos menús ficticios. Los 12 pasan con una solicitud simulada por respuesta completa.

Cuatro controles adicionales en ambos protocolos verifican respuestas largas con precio, advertencia de domicilio y siguiente paso al final: una compra aplicada conserva una sola acción y dos solicitudes (herramienta + respuesta); una afirmación sin acción sigue necesitando tres solicitudes para recuperar y aplicar la compra. Se conserva la recuperación, no se eliminan llamadas indiscriminadamente.

La suite de telemetría ahora comprueba correlación entre `initial` y `tool_results`, en lugar de depender del resumen eliminado. La suite premium conserva cobertura de recuperación parcial y timeout sin duplicar acciones.

Foco: 74/74 en tres suites. TypeScript general y build aprobados; Node 92/92. Evidencia local: `/tmp/ppp-203-focus.json`, `/tmp/ppp-203-node.log`.

Validación completa: 18.776 pruebas / 269 suites. La primera global congelada terminó con 18.775 aprobadas y un fallo: `whatsapp-agent.spec.ts` exigía la segunda inferencia de resumen retirada por esta tanda. Se actualizó esa expectativa (sin modificar runtime) y se repitió la suite completa afectada: 48/48. Auditoría de 575 hashes verifica que ese spec fue el único archivo fuente cambiado después de la global; inventario combinado exacto, sin suites duplicadas u omitidas. No presentar esto como una segunda global congelada: es global + repetición del contrato actualizado. Evidencia `/tmp/ppp-203-global-summary.json`, `/tmp/ppp-203-burst.json`, `/tmp/ppp-203-rest.json` y `/tmp/ppp-203-contract.json`.

## Alcance y límites

Todos los proveedores están simulados: cero llamadas pagadas, Meta u órdenes externas. Estas pruebas verifican el contrato del servicio y sus acciones; no miden calidad del modelo real ni cierres DTO nuevos. El diagnóstico de 12 casos pasa de dos a una llamada únicamente en las respuestas afectadas (>420 caracteres). No significa reducir toda la factura un 50%.

La instrumentación de la tanda 199 sigue pendiente de despliegue, modalidades adicionales y asociación a orden. No hay ahorro productivo medido. Las respuestas pueden ser más largas que el resumen anterior; se mantiene el límite existente de 3500 caracteres y las instrucciones de estilo, sin truncarlas a 420.

Referencia de estrategia: [OpenAI — Cost optimization](https://developers.openai.com/api/docs/guides/cost-optimization), reducción de solicitudes y tokens conservando calidad.

## Siguiente trabajo

1. Retomar los ocho diagnósticos pendientes de composición 197, con variantes de otros menús y cierre DTO.
2. Completar medición por conversación/orden y modalidades antes de atribuir costos por pedido. `whatsapp-ai.service.ts` aún hace solicitudes directas para asistencia, clasificación, transcripción y visión: no pasan por la observación del agente textual. Instrumentar sin registrar contenido privado y con pruebas de ausencia de usage/timeout.
3. Tras despliegue agrupado autorizado, comparar intentos, tokens, latencia y cierres reales en ventanas equivalentes. No cambiar modelo solo por promedios sin conciliación.

Solo staging. Sin despliegue en esta tanda, Main preservada. No declarar vendible por conteos de pruebas.
