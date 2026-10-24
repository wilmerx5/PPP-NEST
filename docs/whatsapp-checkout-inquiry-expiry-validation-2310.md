# Tanda156 — no ignorar consultas durante el pedido

## VIGENTE — tanda156: preguntas durante checkout y caducidad de sabor (23/10)

Baseaa160493, solo staging.36 casos nuevos:30 matriz de consultas de contenido/tiempo en nombre,dirección,teléfono,pago,confirmación (tres menús×agente simulado on/off);6 recorridos de sabor+apartamento con ejecución real de runSessionExpiry y clearPendingChoices, repositorio/envío simulados. Preguntas no cambian carrito/contacto/destino ni estado; luego datos corregidos y DTO. Caduca sabor, conserva plato y conflicto de apartamento, responde consulta, admite «2» como apartamento y cierra sin bebida caducada.

Sin cambios runtime. Foco90/90,10,639s; TypeScript general/build OK, Node92/92. /tmp/ppp-156-{baseline,focus,tsc,node}.log. No global redundante por tests/docs: última global154=17.317/222suites; no sumar focos a global. Cero API/Meta/órdenes externas. Publicación solo staging. Runtime154 sigue pendiente de deploy agrupado; servidor82b77757(152–153), Main intacta.

Énfasis solicitado por usuario: responder consultas a lo largo del flujo y luego retomar pendiente. Próximo: preguntas de ingredientes no documentados («de qué es la ensalada de hoy»), cambio de categoría durante sabor, pregunta+acción en un mismo turno, consulta tras confirmación y referentes tras caducidad. Plan detallado en whatsapp-checkout-inquiry-expiry-validation-2310.md. Modelo/mapa simulados; no declarar cobertura total ni vendible.

## Qué se verificó

1. Comprar plato con nota y consultar precio, acompañamientos, tiempo y carrito durante nombre/dirección/teléfono/pago/confirmación. Cada consulta conserva campos, carrito y estado; después se proporcionan datos, se corrigen nombre/teléfono y se valida DTO de una unidad y nota. Los estados del checkout se preparan explícitamente: esto acredita enrutamiento en cada estado, no la entrada natural a todos ellos.
2. Conversación natural compra→bebida sin sabor→dirección con apartamentos contradictorios→número ambiguo. Se ejecuta WhatsappCleanupService.runSessionExpiry y WhatsappConversationService.clearPendingChoices originales con adaptador de persistencia que fusiona patches como producción. El repositorio devuelve una elección vencida: no se prueba SQL ni reloj/umbral real. Meta sendText es mock y se verifica notificación de vencimiento. Después consulta, apartamento, pago y DTO sin bebida caducada.
3. Regresiones existentes:42 preguntas durante sabor y12 conversaciones completas. Son54 controles previos, no casos nuevos.36+54=90. Baseline nuevo36/36 ya verde; no hubo bug nuevo ni cambio productivo.

## Próximas tandas prioritarias

- Ingredientes no documentados: reconocer la pregunta y decir qué falta por confirmar, sin inventar ni responder solo «cómo pagas»; probar ensalada, salsa, relleno y caldo en menús distintos.
- Referente: preguntar por categoría nueva mientras se espera sabor o tras editar una opción; no devolver ficha del último plato por defecto.
- Pregunta con acción: «agrega uno, pero qué trae», «sí, pero cuánto tarda», «quita uno y cuánto queda». Verificar respuesta y mutación autorizada por separado.
- Después del pedido: tiempo/estado no deben abrir compra ni duplicar orden; no dar por confirmado un pedido que sigue pendiente.
- Caducidad: SQL/umbral y carreras entre limpieza y mensaje, pendingMultiOrder, selección reabierta y referencias a alternativa vencida.

En cada tanda: baseline pequeño, respuestas explícitas además de carrito/estado/DTO, múltiples cartas, modelo simulado on/off. Solo ampliar global si cambia runtime compartido. Contraste real acotado permanece pendiente según whatsapp-api-validation-next-2310.md: los mocks no acreditan comprensión del modelo real, audio ni mapas.
