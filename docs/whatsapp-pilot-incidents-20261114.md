# Incidentes del piloto del 14 de noviembre

La revisión usa los chats aportados y consultas de solo lectura al historial de producción. Las reproducciones aíslan modelo, Meta, mapas, persistencia y órdenes. Un resultado simulado acredita el recorrido probado. La tasa de cierre real requiere revisar el piloto después del despliegue.

## Contexto de pedidos distintos en una conversación

**Crítico.** Un carrito sin confirmar y sus selecciones pueden seguir activos cuando llega una petición distinta. En el primer incidente, el carrito anterior contenía un combo y medio pollo, y esperaba el pago. Una frase de otro mensaje anterior se había guardado como producto ausente. El nuevo ejecutivo y el ajiaco quedaron fuera del carrito. La reutilización del chat influyó en el fallo observado. El cliente debe poder continuar un pedido, corregirlo, cancelarlo y empezar otro dentro de la misma conversación.

La protección537 distingue un pedido confirmado de un borrador activo. Un saludo solo conserva el borrador. Una adición explícita continúa el pedido. Si una compra completa distinta durante checkout deja ambiguo el alcance, se conserva el borrador y se pregunta si se continúa o se empieza otro. La decisión debe conservarse, comprobar la versión del carrito y procesar la compra una sola vez. Los datos nuevos de dirección, nombre o pago quedan pendientes hasta resolver esa decisión.

## Texto conversacional convertido en producto ausente

**Crítico.** «Lo que quiero es» quedó guardado en `recentUnavailableOrder`. La coincidencia con «quiero» interceptaba peticiones y reclamaciones posteriores antes de llegar al agente. El carrito seguía con los productos anteriores aunque el cliente pedía otros. La tanda540 amplía la normalización a «Para hacer el pedido de…» y sus cortesías, conservando el significado de las reformulaciones. La corrección536 elimina ese encabezado antes de separar productos y exige coincidencia de los términos significativos del plato ausente. Los datos antiguos con frases conversacionales dejan de bloquear los turnos. Se reproducen petición y reclamación mediante el router completo.

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

## Cotización de pollo y bebida, aceptación y reiteración

**Alta.** Los chats de Mauricio y Alejandro mostraban una consulta de pollo con gaseosa tratada como un producto inexistente, ofertas que seguían pendientes y reiteraciones que añadían unidades. La revisión538 reproduce una causa que persistía en la cotización: la búsqueda de porciones de pollo devolvía el pollo antes de considerar los otros productos nombrados en la misma consulta. El catálogo reutiliza el resolver de pedidos múltiples y conserva todos los productos cuando la lista completa se identifica sin ambigüedad. La consulta conserva el carrito.

Otra reproducción mostraba «sí por favor» enviado al agente sin resolver la oferta guardada.538 da prioridad a una aceptación completa de esa oferta, también para «listo», «dale» y «OK», antes de tratarla como cortesía. Reutiliza la validación y el alta existentes. Los mensajes de cortesía posteriores conservan cantidades y opciones. La tanda cubre cotizaciones de uno o varios productos, cantidades, preguntas intermedias, repetición de la lista, rechazos, disponibilidad, cierre del negocio y límites del carrito. La promoción y los resultados completos se registran en whatsapp-batch-538-validation.json.

## Revisión adicional de los chats de hoy

El archivo aportado el14/11 contiene varios intentos distintos desde un mismo chat. Esto explica parte de la reutilización de nombre, teléfono o carrito, pero las consultas y las correcciones deben conservar su significado dentro de ese contexto. Hay recorridos confirmados con bebida, domicilio y teléfono corregidos, candidatos de lugares dentro de cobertura y complementos de dirección repetidos sin duplicarse.

Los pendientes observados tienen prioridad sobre ampliar variantes aisladas de vocabulario.

- Una pregunta sobre si el arroz incluye gaseosa reabre la elección del pollo. Responder1 añade otro arroz. Es crítico por duplicación y cobro adicional.
- «Como bienes el pollo broastes» abre una lista de compra. Después una dirección añade una bandeja que nadie pidió. Es crítico por modificación del carrito durante consultas y datos de entrega.
- El pedido de arroz sin ensalada con sustitución por yuca y un pollo frito solo conserva el arroz. Es crítico por pérdida de un producto explícito.
- El combo con arepas fritas, porción de papa y Ginger se convierte en porción de arepas y pierde el combo. Es crítico por confundir opciones incluidas con productos independientes.
- La distribución de dos ejecutivos se interpreta como nuevas bandejas, y las aclaraciones posteriores quedan encerradas en esa lista. Es crítico por tipo de producto, duplicación y bloqueo de recuperación.
- «Gaseosa de cual tienes» añade una presentación sin que el cliente la elija. Cambiarla a Coca-Cola y combinar quitar una línea con una compra nueva no se resuelve. Es crítico por consulta convertida en compra y corrección incompleta.
- «Solo quiero las dos sopas, el pollo no» ofrece pollo en vez de retirar las líneas ajenas. Eliminar varios índices tampoco funciona. Es crítico por mantener un total que el cliente rechazó.
- «Pollo y medio broster en combo» pierde la media unidad y reformular el pedido añade otro combo. Es crítico por cantidad y contexto de corrección.
- Se pierden casa11 y referencias de entrega al seleccionar un lugar, mientras palabras de cortesía o fragmentos de producto aparecen en notas/dirección. Requiere conservar puerta, torre y apartamento al confirmar candidatos y separar instrucciones de cocina.
- Las preguntas por combos broaster muestran productos ajenos a esa presentación, y la dirección con paréntesis solo se reconoce al reescribirla. Son fricciones de selección y normalización.

El fragmento conversacional «lo que quiero es» ya tiene la corrección536 y regresiones. La tanda538 validada en staging cubre aceptación de cotizaciones y listas de precios que antes omitían productos. Los demás casos de esta lista necesitan reproducciones completas para distinguir qué persiste en la versión actual.

La tanda539 implementa las dos solicitudes nuevas. Las notas posteriores a la confirmación se vinculan a una confirmación saliente guardada en el chat y a la orden WhatsApp que la originó. La actualización transaccional añade notas a los ítems y emite la actualización del panel después de guardar, con repetición idempotente y comprobación de estado. Los suministros generales se anotan en los productos de la orden y las instrucciones que nombran un plato se aplican a ese plato cuando se identifica sin ambigüedad.

Después de cuatro horas sin mensajes del cliente, el siguiente turno crea un contexto nuevo. La sesión conserva un límite de historial por ID de mensaje BIGINT en forma de texto, por lo que el modelo y las referencias a respuestas anteriores excluyen la conversación antigua. Dentro de las cuatro horas se mantiene el comportamiento de continuación. La atención humana y un pago Mercado Pago en curso conservan sus rutas propias. 539 está desplegada y verificada en staging con1.370 controles compilados,66 regresiones nuevas y ocho contratos de MariaDB desechable. La global aprobada incluye52.065 pruebas en623 suites y conserva los22 fallos originales de expectativas de mensaje junto a los168 controles reejecutados de dos fixtures. La evidencia y el alcance de las simulaciones se registran en whatsapp-batch-539-validation.json. Los demás incidentes de esta revisión siguen pendientes de reproducción y corrección en la versión actual.

## Revisión540 de consultas y frases introductorias

La pregunta de tamaño de la mojarra conserva el carrito en el router actual. Se amplía también la clasificación compartida del catálogo para que esa cláusula no se convierta en un plato pendiente. Con el catálogo público capturado se conserva el dato real de 600 gramos. Cuando la descripción no indica tamaño o peso, los controles sintéticos exigen responder que falta ese dato.

Se reprodujo «Como bienes el pollo broastes» abriendo otras presentaciones aunque el pollo ya estaba en el carrito. La referencia exacta al plato existente ahora precede a la expansión de familia. Al ampliar los estados se detectó además que una consulta de composición durante pago añadía otra unidad. La corrección conserva cantidades, estado y opciones pendientes. «Con qué viene el pollo» ya no se consume como una repetición de cantidades. La consulta de gaseosa tras el arroz y la respuesta 1 conservaron una sola unidad en el catálogo capturado; ese fragmento de duplicación no se reprodujo en la candidata actual.

540 está desplegada y verificada en staging. La global completa pasa 52.140 pruebas en 624 suites, con 75 regresiones nuevas, 238 focalizadas y 1.571 controles compilados en el contenedor activo. El código de ejecución está en ad16afaa5a30a4c8a78d0c2a5cb5641611a12d7e. La primera global parcial se conserva como interrumpida; los resultados aprobados pertenecen a la pasada completa final. Los proveedores y la creación externa de órdenes se simulan. Ver whatsapp-batch-540-validation.json. Siguen pendientes las retiradas de varias líneas, las correcciones/compras mezcladas y los otros incidentes de la lista. Una combinación de plato disponible sin artículo con otro desconocido en el catálogo sintético también requiere reproducción focalizada, porque puede responder con una alternativa general sin procesar parcialmente el plato disponible.

## Protección541 para el mensaje completo

Staging incorpora una interpretación completa antes de buscar productos o modificar pedidos activos. Los fragmentos literales y los SKUs referenciados delimitan las operaciones permitidas. Se comprueba que el plan atienda todas sus cláusulas y productos requeridos. Ante un fallo o alcance pendiente se conserva el pedido y se solicita una aclaración. El cambio deja de depender de enumerar introducciones conversacionales específicas.

La tanda prueba consultas durante checkout, mensajes con compras y retiradas, negaciones completas, propuestas parciales, opciones diferidas con cantidades propias, listas informativas, reemplazos y conflictos de persistencia. Ocho contratos SQL aíslan concurrencia, rollback y rechazo de una fotografía obsoleta. Tres casos finales con el modelo real y la repetición gratuita del caso mixto sobre el build final complementan los controles simulados. La cobertura real del modelo sigue limitada a esos casos. El resto de incidentes de esta revisión conserva su prioridad hasta reproducirse y contrastarse en el piloto. Evidencia completa y límites en whatsapp-batch-541-validation.json.

## Criterio de cierre de esta revisión

Cada incidente necesita reproducción con carrito, estado y respuesta, verificación de entradas similares y trazabilidad de código, pruebas y despliegue. Se comprueban sesiones nuevas, borradores con historial y órdenes ya confirmadas según corresponda. Las pruebas incluyen catálogos alternativos y la adaptación nativa de Kamppo. Los fallos anteriores se consideran cerrados únicamente cuando la evidencia identifica la versión desplegada. Los detalles por tanda se registran en los archivos `whatsapp-batch-536-validation.json` y de la tanda537.

536 está desplegada en staging y producción de PPP y Kamppo. La global de PPP aprobó51.755 pruebas en615 suites y los1.060 controles compilados pasaron en la imagen activa. Se conservaron los registros del primer intento revertido por reinicios simultáneos y de los reintentos secuenciales verificados.537 tiene una global aprobada de51.903 pruebas en619 suites mediante ejecución completa congelada y reejecución de154 controles de tres fixtures ajustados. Los15 fallos de expectativas previas quedan conservados. El código de ejecución coincide entre ambas pasadas. Los1.208 controles compilados pasan en staging. Incluye cancelación, reinicio, caducidad y audio. 537 ya está desplegada en PPP con 2b6d92a79018a88cd50a4de61c8d951f357a5fd9 e imagen sha256:49907e5adcfba144e3fc1485214c4b107d283fcf4601fdbb4d91cca2fea8a06e, y en Kamppo con 4cda5429a6cded7abb5d8a78308d7f75577dea42 e imagen sha256:75151b2d05da57929b9afeefe8eb871d1ff61bb2208ec88e33d5d53e6874bc97. API y DB saludables, cero reinicios. Kamppo pasa803 pruebas de API y18 contratos nativos compilados. La revisión del piloto real sigue pendiente para comprobar el efecto comercial. La revisión actual tiene prioridad sobre nuevas tandas exploratorias.
