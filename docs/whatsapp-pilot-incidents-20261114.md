# Incidentes del piloto del 14 de noviembre

La revisión usa los chats aportados y consultas de solo lectura al historial de producción. Las reproducciones aíslan modelo, Meta, mapas, persistencia y órdenes. Un resultado simulado acredita el recorrido probado. La tasa de cierre real requiere revisar el piloto después del despliegue.

## Contexto de pedidos distintos en una conversación

**Crítico.** Un carrito sin confirmar y sus selecciones pueden seguir activos cuando llega una petición distinta. En el primer incidente, el carrito anterior contenía un combo y medio pollo, y esperaba el pago. Una frase de otro mensaje anterior se había guardado como producto ausente. El nuevo ejecutivo y el ajiaco quedaron fuera del carrito. La reutilización del chat influyó en el fallo observado. El cliente debe poder continuar un pedido, corregirlo, cancelarlo y empezar otro dentro de la misma conversación.

La protección537 distingue un pedido confirmado de un borrador activo. Un saludo solo conserva el borrador. Una adición explícita continúa el pedido. Si una compra completa distinta durante checkout deja ambiguo el alcance, se conserva el borrador y se pregunta si se continúa o se empieza otro. La decisión debe conservarse, comprobar la versión del carrito y procesar la compra una sola vez. Los datos nuevos de dirección, nombre o pago quedan pendientes hasta resolver esa decisión.

## Texto conversacional convertido en producto ausente

**Crítico.** «Lo que quiero es» quedó guardado en `recentUnavailableOrder`. La coincidencia con «quiero» interceptaba peticiones y reclamaciones posteriores antes de llegar al agente. El carrito seguía con los productos anteriores aunque el cliente pedía otros. La corrección536 elimina ese encabezado antes de separar productos y exige coincidencia de los términos significativos del plato ausente. Los datos antiguos con frases conversacionales dejan de bloquear los turnos. Se reproducen petición y reclamación mediante el router completo.

## Varios platos nuevos durante checkout

**Crítico.** Después de quitar el bloqueo anterior, el camino de checkout podía conservar solo un producto de una compra con varios platos. La corrección536 dirige una compra explícita y completa de varios platos al procesamiento de lotes existente. Las verificaciones incluyen ejecutivo más ajiaco con catálogo sintético y catálogo público actual, y la adaptación nativa de Kamppo con UUID, opciones y precios propios.

## Selección de filas mezclada con nuevas compras

**Crítico.** «1 y 2 una porción … y una gaseosa …» perdió los medios pollos seleccionados y convirtió el número de fila en cantidad de papas. La corrección537 separa referencias a la lista de las compras adicionales y comprueba que cada producto seleccionado conserve su cantidad. También cubre cantidades numéricas de bebidas, opciones pendientes, notas, límites y productos adicionales ya pendientes. Cuando el alcance no puede resolverse con seguridad, conserva la selección y el carrito y pide aclaración.

## Lista completa de corrección interpretada como consulta

**Crítico.** «-es medio broster … -una porción … -una gaseosa … colombiana» entró como una pregunta sobre las papas. Las cantidades y el sabor siguieron incorrectos, y las reiteraciones posteriores añadieron productos repetidos. La corrección537 reconoce un encabezado explícito de corrección y verifica toda la lista antes de guardar. Las cantidades son totales finales. Las opciones explícitas sustituyen las anteriores y se conservan notas y opciones compatibles. Si algún producto u opción queda sin identificar, conserva el carrito completo y solicita una lista corregida. Esta primera recuperación exige reenviar la lista completa cuando hay una cláusula desconocida.

## Preparaciones y etiquetas confusas

**Alta.** El bot mostró dos medios pollos diferentes con la misma etiqueta «Con medio pollo» bajo el título de Broaster. La consulta mencionaba asado, que no aparece como SKU disponible en el catálogo revisado. La corrección537 muestra los nombres completos y explica la preparación ausente con alternativas reales. La elección de una alternativa debe venir del cliente. Un restaurante que sí ofrece esa preparación conserva su opción disponible. El usuario confirmó el14/11 que en PPP asado y frito son preparaciones distintas: PPP no ofrece asado y debe presentar frito y broaster como alternativas, sin configurar un alias entre ellas.

## Cancelación y reclamación posterior

**Media.** Tras anunciar una cancelación y dejar el carrito vacío, el bot afirmó que no debía haber dicho que canceló. Esa explicación contradice el resultado registrado. La corrección537 responde a una crítica aislada consultando el carrito real. Las reclamaciones con instrucciones de compra o corrección mantienen sus rutas correspondientes.

## Comprobante sin cierre del pedido

**Crítico operativo.** En el chat del ajiaco, el bot recibió el comprobante y omitió recordar que faltaba confirmar. La atención humana continuó, pero el fragmento no acredita una orden creada. La corrección535 ya desplegada retoma el paso de checkout y mantiene el pago pendiente de verificación del equipo. Por solicitud del usuario,537 cambia el acuse por «Recibí el comprobante. El equipo lo validará y te enviaremos el pedido lo más pronto posible», elimina la invitación a llamar y conserva el recordatorio del paso pendiente.

## Criterio de cierre de esta revisión

Cada incidente necesita reproducción con carrito, estado y respuesta, verificación de entradas similares y trazabilidad de código, pruebas y despliegue. Se comprueban sesiones nuevas, borradores con historial y órdenes ya confirmadas según corresponda. Las pruebas incluyen catálogos alternativos y la adaptación nativa de Kamppo. Los fallos anteriores se consideran cerrados únicamente cuando la evidencia identifica la versión desplegada. Los detalles por tanda se registran en los archivos `whatsapp-batch-536-validation.json` y de la tanda537.

536 está desplegada en staging y producción de PPP y Kamppo. La global de PPP aprobó51.755 pruebas en615 suites y los1.060 controles compilados pasaron en la imagen activa. Se conservaron los registros del primer intento revertido por reinicios simultáneos y de los reintentos secuenciales verificados.537 tiene una global aprobada de51.903 pruebas en619 suites mediante ejecución completa congelada y reejecución de154 controles de tres fixtures ajustados. Los15 fallos de expectativas previas quedan conservados. El código de ejecución coincide entre ambas pasadas. Los1.208 controles compilados pasan en staging. Incluye cancelación, reinicio, caducidad y audio. 537 ya está desplegada en PPP con 2b6d92a79018a88cd50a4de61c8d951f357a5fd9 e imagen sha256:49907e5adcfba144e3fc1485214c4b107d283fcf4601fdbb4d91cca2fea8a06e, y en Kamppo con 4cda5429a6cded7abb5d8a78308d7f75577dea42 e imagen sha256:75151b2d05da57929b9afeefe8eb871d1ff61bb2208ec88e33d5d53e6874bc97. API y DB saludables, cero reinicios. Kamppo pasa803 pruebas de API y18 contratos nativos compilados. La revisión del piloto real sigue pendiente para comprobar el efecto comercial. La revisión actual tiene prioridad sobre nuevas tandas exploratorias.
