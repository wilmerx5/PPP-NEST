# Tanda 286 — retirada referenciada de una unidad

Origen: continuación de los casos de varios platos con opciones distintas y del límite de retirada parcial documentado en 285. Son variantes sintéticas de patrones compartidos; no se incorporaron chats, PDFs ni audios nuevos.

## Comportamiento y alcance

«Quita uno de los de pechuga» retira una sola unidad de una línea identificada por la opción. Si varias líneas coinciden, pregunta cuál y conserva la cantidad solicitada al responder por número o característica. No borra toda la línea salvo que solo quede una unidad. Conserva precios, notas, opciones y otras líneas.

El campo opcional `pendingCartRemoval.quantity: 1` distingue esta aclaración de una retirada de línea completa. La firma del carrito evita aplicar selecciones antiguas. Cancelar elimina la selección; un pago u otra selección pendiente bloquean la modificación. Preguntar el total conserva la selección y responde con el carrito. Las preguntas sobre una opción no autorizan la retirada. Al retirar la última unidad, vuelve a compra con carrito vacío.

Alcance lingüístico acotado a «quita/quítame/retira/retírame/saca/sácame/elimina uno de los de…» y la forma femenina reconocida. No amplía cantidades arbitrarias, solicitudes compuestas ni correcciones por audio. La suite comprueba las tres formas quita/quítame/retira; las demás son alternativas del parser, no nuevos recorridos independientes.

## Evidencia

Baseline inicial: 384 casos, 102 aprobados y 282 fallidos. Tras el ajuste inicial pasaron 846 pruebas con suites vecinas. Se añadieron 36 casos de interrupción/carrito vacío: detectaron 12 fallos al preguntar el total. Después de corregir esa ruta, foco final de 882 pruebas aprobado.

420 pruebas nuevas: 216 retiradas directas, 72 aclaraciones, 96 guardas y 36 interrupciones o vaciado. Tres familias de catálogo, agente simulado activo/inactivo, compra/revisión, cantidades de 1/2/4 y distintas posiciones. Carrito y opciones previas preparados como fixtures; los mensajes pasan por el router. Se verifican carrito completo, estado, respuesta y ninguna orden externa. No acredita compra previa, inferencia real ni aprendizaje automático.

Sin SQL ni cambios de modelos. Producción y Kamppo no reciben esta tanda; permanece en staging. Pendientes: mayor variedad de expresiones, cantidades parciales distintas de uno y pedidos compuestos.
