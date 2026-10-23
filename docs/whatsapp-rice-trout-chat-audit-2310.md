## Actualización 23/10 — implementación validada

Los caminos reproducidos se corrigieron en146–147; ver whatsapp-side-detail-preparation-validation-2310.md. La auditoría siguiente conserva el diagnóstico previo. No extrapolar a modelo/mapa real.

# Auditoría del chat: acompañamiento, compra y preparación ofrecida

Estado: diagnóstico abierto, NO corrección terminada. Base1e6bcc46; staging limpio antes del diagnóstico. Sin cambio de runtime, inferencia pagada, Meta u órdenes externas. No modificar Main ni desplegar por esta auditoría.

## Evidencia del chat

Correcto: la ficha del arroz sí describe sus acompañamientos; al final el bot reconoce que no conoce ingredientes de la ensalada; ofrece preparaciones disponibles de trucha y finalmente añade Asada. No se debe inventar la receta de hoy.

Fallos observables: pregunta específica sobre ensalada recibe ficha general; compra explícita más consulta provoca una confirmación redundante; después de añadir queda una pregunta de elección aparentemente residual; respuesta «una asada» pierde referencia a preparación ofrecida y declara inexistente lo que acaba de ofrecer. El último mensaje «qué más pescados tienes» no tiene respuesta adjunta, por lo que no se puede evaluar ese turno.

Hay mensajes de horarios/días mezclados y pausas largas. No atribuir toda pérdida de contexto a una única ruta ni afirmar causa de expiración sin registros. El vencimiento de una elección tras añadir sí merece investigar limpieza de pendingMatch/pendingAddOffer/pendingAttribute; el chat no revela cuál quedó persistido.

## Reproducción gratuita actual

Reproductor guardado como texto en docs/reproductions/whatsapp-side-detail-and-preparation.spec.ts.txt. Copiar temporalmente a src/whatsapp/whatsapp-side-detail-and-preparation.spec.ts y ejecutar:

    npx jest --runInBand --runTestsByPath src/whatsapp/whatsapp-side-detail-and-preparation.spec.ts --silent --testTimeout=15000

12 casos: arroz/pasta/bowl con ensalada/salsa/aderezo; trucha/tofu/berenjena con preparación no disponible; agente simulado on/off. Baseline12/12 fallidos, /tmp/ppp-145-baseline.log,5,939s. Son reproducciones rojas, NO pruebas aprobadas ni tanda cerrada. Guardadas fuera del inventario Jest para no confundir validación del ejecutable con escenarios aún sin resolver.

La primera familia falla ya en respuesta de detalle: ruta sin agente responde fuera de dominio; con agente simulado devuelve ficha sin admitir detalle desconocido. No alcanza las aserciones posteriores de compra/pendientes: esas etapas siguen sin acreditar. La segunda familia falla antes de selección: ruta sin agente ofrece nombre base sin opciones, ruta de agente simulado neutral pregunta «cuál prefieres» sin opciones. El mock no reproduce el texto del modelo de producción, así que no demuestra que su generación real sea igual; sí muestra ausencia de contrato determinista para la oferta esperada. No contar esos fallos como evidencia de doce causas distintas.

## Inspección de código

isProductDescriptionInquiry reconoce «de qué», pero la ruta compuesta con verbo de compra tiene restricciones; findProductsForCompositionQuestion usa foco, catálogo y pendientes, y buildProductCompositionReply solo detecta falta de detalle para «trae/incluye/lleva». No modela en esa guarda «de qué es la ensalada». La consulta del acompañamiento no debe buscar un nuevo producto ni establecer una compra pendiente por sí sola.

## Plan de corrección

1. Resolver referencia del acompañamiento usando producto enfocado y descripción. Si la carta solo dice ensalada/salsa/aderezo, decir que los ingredientes no están confirmados; si sí hay receta explícita, citarla. Probar sin foco, varios platos, receta conocida/desconocida y consulta sin compra.
2. Separar compra explícita de consulta factual en el mismo mensaje: conservar cantidad y notas, añadir una vez y responder la consulta. Evitar confirmación extra para un producto inequívoco. Limpiar solo la elección satisfecha; proteger otra selección independiente pendiente.
3. Registrar alternativas/preparaciones ofrecidas como estado estructurado basado en opciones reales del catálogo. «Una asada» selecciona ese producto, conserva cantidad y no es plato nuevo; preguntar si hay más de un referente. No inferir disponibilidad desde texto libre del modelo.
4. Completar conversaciones hasta DTO/cancelación y verificar inexistencia de selección residual tras compra; añadir tiempo simulado de expiración sin borrar un pedido correcto por una elección obsoleta. Incluir cambio de categoría «qué más pescados tienes» conservando carrito.
5. Foco, TS y global con fuente congelada cuando cambie runtime. Después contraste real acotado; no confundir mocks con comprensión del modelo ni declarar estos casos resueltos sin evidencia.
