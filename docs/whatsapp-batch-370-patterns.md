# Tanda370: bebida conservada durante la elección de variante

Fuente: chat01/11, mensajes448–459. El cliente pide «1 combo de pollo y medio pollo broaster con pepsi», elige1 y recibe un resumen con Colombiana. Se reprodujo con el router completo, agente off/mock y dependencias externas simuladas. Código `2f5d2a00201367c4078a8e729770c966c70f1a9f`.

## Diagnóstico y cambio

Dos pérdidas: la cola de productos asignaba el final «con Pepsi» al medio pollo, que no tiene bebida incluida; al elegir la preparación, el combo se reconstruía únicamente con su nombre, sin su texto original. Ahora una bebida final exacta se conserva en el único grupo compatible por catálogo, incluso si falta elegir variante. No se redistribuye cuando ya hay bebida explícita, el producto origen tiene bebida, es una bebida aparte, hay varios grupos compatibles o alguna variante no admite la opción. La selección conserva el segmento propio (cantidad/opciones), y los demás productos mantienen los suyos.

Baseline inicial2/2 fallan; matriz final14/40 fallan antes del cambio y26 controles ya pasaban.40 pruebas nuevas:4 reproducciones con respuesta por número/nombre;32 recorridos con dos catálogos × agente off/mock × cantidad1/2 × bebida al final/junto al combo × Pepsi/Ginger;4 controles de bebida aparte con/sin bebida explícita del combo. Se completan40 pedidos simulados y se comprueban cantidades, atributos del carrito/DTO y respuesta. Foco108/4 aprobado. Global34804/438 aprobada;656 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. Staging370 desplegado/verificado: `5afe0c3f`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41587846053; evidencia370-staging-deployment. Controles compilados existentes aprobados; cobertura370 local.

## Alcance y siguientes casos

El precio del fixture no acredita precios actuales del restaurante. La matriz recorre tanto resolución directa como aclaración, según la respuesta real del router; no envía una selección numérica si no hay selección pendiente. No hubo OpenAI/Meta/órdenes externas. Presupuesto267/256/11 intacto. Producción349/Kamppo321 sin cambios.

Quedan referencias abreviadas, condiciones «si hay, si no pregúntame», varias compras que podrían recibir la misma bebida y reparación de cantidades repartidas. Próxima prioridad: chat438–447, reparar un pedido de4 ejecutivos (3fritos/1broaster) sin sumar unidades ni perder sopa/bebida; duplicaciones sin reproducción todavía requieren trazas. La cobertura sintética no prueba modelo/canal real ni cierra todo el corpus.
