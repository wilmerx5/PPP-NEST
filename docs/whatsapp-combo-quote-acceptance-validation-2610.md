# Tanda 220 — aceptar recotización por fila, código o presentación

Base `50e1fefd`, staging. Sin API pagada, Meta ni órdenes externas.

## Fallo reproducido

Tras solicitar Agua y recibir un nuevo precio, aceptar con «2», «el código 99304» o «el grande» reconstruía las opciones desde la oferta inicial con Pepsi. Si Agua seguía vigente, se perdía; si se había retirado, se sustituía silenciosamente por Pepsi. «Sí» ya conservaba la selección, cubierto en tandas218–219.

Baseline: 36/36 fallidas, tres menús sintéticos (arroz, bowl, pasta), agente simulado off/on, tres formas de aceptación y bebida vigente/retirada.

## Corrección

Al resolver una referencia a la misma presentación recotizada se conserva offeredChoices de esa cotización. Si el cliente elige otra presentación se usan las opciones propias de esa alternativa. La selección continúa validándose contra el catálogo actual antes de modificar el carrito. Sin excepciones por restaurante, nombre, ID o precio.

## Comprobaciones

36 conversaciones nuevas verifican respuesta, carrito, precio, dos unidades, notas, estados y DTO simulado. Una opción retirada exige nueva selección y conserva el original hasta entonces. Una opción vigente pasa al combo con Agua. El cierre solo crea una orden simulada después de confirmar.

Foco:198/198 en cinco suites,39,029s. TypeScript general/build,92 controles Node y guardia Falafel aprobados. Global completa:19.470/286 suites,593 hashes,722,64s; inventario exacto y fuente congelada verificados. Evidencia `/tmp/ppp-220-*`.

## Límites y continuación

«El grande» es una etiqueta explícita de presentación, no cualquier nombre libre. Pendientes: aceptación con nueva bebida en el mismo mensaje, consulta/contacto entre cotización y aceptación, referencias ambiguas a nombres duplicados. Los modelos están simulados: no atribuir mejoras de precisión real ni ahorro medido. Main/modelos intactos; publicación staging sin despliegue.
