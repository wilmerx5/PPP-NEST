## VIGENTE — cambio, destinatario y urgencia como datos del pedido; «gracias» con pedido abierto (19/10)

Base 41e374a4, tanda 26. Auditoría del pendiente «tryConfirmOrder fuera de un turno»: no tiene llamadores fuera de handleIncoming (pago MP, asesor y devolver al bot no lo invocan; la firma se crea al inicio del turno y se borra en finally). Sonda de 38 mensajes del paso final (nombre, misma dirección, mismo/otro pago, montos de cambio, referencias, notas): ninguno crea la orden sin aprobación («listo» aprueba por política). Cambio y notas fuera de la firma quedan cubiertos porque esas rutas guardan con saveForSummaryRefresh (estado confirming). Sin cambio de runtime por este punto.

120 regresiones nuevas (whatsapp-order-level-aside.spec.ts): tres carritos estructuralmente distintos (una línea con opción, dos líneas con opciones distintas, producto sin opciones), agente simulado on/off, building_cart y awaiting_final_confirm. Baseline con router real: «traer vueltas de 100 mil» respondía «No tengo autorización para comprar…»; «tráeme cambio de 50 mil» se perdía; «traigan/necesito/llevar cambio de…» y «le pago con un billete de…» dejaban el verbo sobrante como nota del plato y del pedido; «es para regalo», «es para mi mamá», «son para mis hijos», «que llegue rápido» se descartaban sin aviso; «es un regalo» respondía «Ese plato no está en tu carrito»; «gracias» con pedido abierto respondía «Cuando quieras pedir…». Sin el arreglo fallan 108/120.

Arreglo general: tryHandleOrderLevelAside (grupo temprano). Cambio suelto → cashChangeFor «cambio de N»; con pago no efectivo explica y no cambia nada; en awaiting_payment, o «pago con un billete de N» sin método aún, cede a la ruta de pago. Destinatario/regalo/urgencia → customerNotes una sola vez; llevar, horarios, palabras de dirección y nombres del catálogo siguen por sus rutas. En el paso final re-muestra el resumen y pide «confirmar». «Gracias» con carrito → pedido sigue abierto + recordatorio del paso. applyInlineOrderNote ya no usa el texto completo como nota cuando solo había una frase de cambio.

Validación: 1.128 focalizados (14 suites). Un fallo focalizado legítimo («Pago con un billete de 100 mil» en awaiting_payment debe elegir efectivo) se corrigió cediendo a la ruta de pago. TypeScript, build TypeScript, 92 Node y diff --check. Global en dos fases: ráfagas 80/80 en 105,605s; resto 10.356/10.356 en 318,191s, 110 suites; unión exacta con inventario de 111, 406 hashes intactos, sin reintentos. Evidencia whatsapp-order-level-aside-validation-1910.json. Cero llamadas pagadas, WhatsApp u órdenes externas.

Desplegado solo staging: runtime 290615416827036ba3e8a603096d11a14303eae4, imagen 817accea…; health OK / DB connected / circuit CLOSED 2026-10-19T23:37:14Z, healthy sin reinicios. Rollback ppp-nest-staging:rollback-before-29061541 (imagen e19b1461…). Producción sigue c5e97ab1… antes y después; bin/ privado preservado. No reconstruir por documentación.

Siguiente: notas de manejo del plato sueltas («que traigan salsa aparte») siguen descartándose sin aviso; mensajes mixtos (nota de plato + cambio); concurrencia real de ráfagas durante una duda pendiente; huecos del adicional por línea (cantidad explícita, «al bao», adicional con opciones, retirarlo por la línea).

## VIGENTE — adicional cobrado nombrado sobre líneas del carrito (19/10)

Base d0b93923, tanda 25. 108 regresiones nuevas (whatsapp-line-scoped-addon.spec.ts): bao/salsa + «Queso Extra», pizza/masa + «Champiñones Extra», batido/base + «Adicional Proteína»; agente simulado on/off; building_cart y awaiting_final_confirm; carrito sembrado 3× opción A «sin X» + 2× opción B (no es compra desde cero).

Baseline con router real: «las de A con extra queso» y «a las de B agregale extra queso» guardaban nota gratis en la línea; «las de A con queso extra», «B con extra queso» y «con extra de queso» agregaban UN adicional para tres o dos platos con nota basura; «ponle queso extra a las de A» guardaba la frase literal y devolvía awaiting_final_confirm a building_cart; «échale queso extra a todas» respondía «no manejamos» ofreciendo ese mismo adicional. Sin el manejador fallan 84/108.

Arreglo general: tryHandleLineScopedPaidAddon (grupo temprano, tras tryHandlePartialUnitOptionChange). Alcance: filas que hoy tienen la opción nombrada, o todas las que no son el adicional con «todas/todos». La cola debe nombrar exactamente un producto del catálogo por conjunto de palabras (cualquier orden, sin de/con/artículos, adicional≡extra, plural final) y sin opciones configurables. Se agrega una unidad por plato referenciado con nota «para <línea>» (addProductToCart en modo set: repetir no duplica y responde «Ya tenía»). Adicional no disponible: se nombra y no cambia nada. Preguntas, dígitos, otras selecciones pendientes y colas que no nombran un producto siguen por sus rutas. En awaiting_final_confirm no crea orden; «confirmar» lleva el adicional al DTO.

Validación: 994 focalizados (15 suites vecinas), TypeScript, build TypeScript, 92 Node y diff --check. Global en dos fases: ráfagas 80/80 en 105,428s; resto 10.236/10.236 en 318,423s, 109 suites; unión exacta con el inventario de 110 archivos (la diferencia «suites/inventario» de tandas anteriores es la suite de ráfagas en su fase), 405 hashes intactos, sin reintentos. Duración total 423,9s: el pico de 661s de la tanda 24 no se repitió. Evidencia whatsapp-line-scoped-addon-validation-1910.json. Cero llamadas pagadas, WhatsApp u órdenes externas.

Desplegado solo staging: runtime 86d5a3d7ecabc68d23b47d555a7350fc9528c11b, imagen e19b1461…; health OK / DB connected / circuit CLOSED 2026-10-19T23:20:56Z, contenedor healthy sin reinicios. Rollback ppp-nest-staging:rollback-before-86d5a3d7 (imagen 8b14516b…). Producción sigue c5e97ab1… antes y después; bin/ privado preservado. No reconstruir por documentación.

Siguiente: llamadas a tryConfirmOrder fuera de un turno entrante; concurrencia real de ráfagas durante una duda pendiente. Huecos conocidos de esta ruta: cantidad explícita de adicional («con 2 quesos extra»), referencia por producto en singular («al bao»), adicionales con opciones configurables y retirar el adicional por la línea («las de A sin queso extra»).

## VIGENTE — línea nombrada por la opción que ya tiene (19/10)

Base 7363774e, tanda 24. 120 regresiones nuevas (whatsapp-option-reference-edit.spec.ts): bao/salsa, pizza/masa y batido/base, agente simulado on/off, carrito 3× opción A «sin X» + 2× opción B.

Baseline con router real (agente off): «las de A bien empacadas», «para las de A cubiertos» y «B bien empacado» no guardaban nada sin avisar; «la de B bien caliente» y «que las de A vengan separadas» respondían «no manejamos»; «cambia las de B a A» respondía «No tenemos esos productos»; «las de B mejor A» y «todas A» no cambiaban nada. La mutación de la línea equivocada vía applyNamedCartAttributes ya no se reproduce tras la tanda 23. Sin el manejador fallan 87/120.

Arreglo general: tryHandleOptionReferencedLineEdit (grupo temprano, tras la revisión de notas). Las filas son las que hoy tienen esa opción. Si la cola es otra opción del mismo atributo (verbo cambia/pasa, «mejor», o «todas <opción>») se cambia; cualquier otra cola corta se anota. Ambos pasan por prepareUnitOptionActions de forma atómica. Colas con con/sin/ponle/quítale…, palabras de aprobación, entrega/pago/dirección, productos u opciones del catálogo, otro plato, dígitos o preguntas siguen por sus rutas. Opción inexistente con verbo explícito: se nombra y no se cambia. En awaiting_final_confirm no crea la orden; «confirmar» después lleva notas/opciones al DTO.

Validación: 572 focalizados, TypeScript, build TypeScript, 92 Node y diff --check. Global en dos fases: ráfagas 80/80 en 141,033s; resto 10.128/10.128 en 519,847s, 108 suites (inventario 109), 404 hashes intactos, sin reintentos. Evidencia whatsapp-option-reference-validation-1910.json. Cero llamadas pagadas, WhatsApp u órdenes externas.

Desplegado solo staging: runtime ed5baea4f9161886a69c29015d76634d404b13ed, imagen 8b14516b…; health OK / DB connected / circuit CLOSED 2026-10-19T22:49:55Z, sin reinicios. Rollback ppp-nest-staging:rollback-before-ed5baea4 (imagen 825c589b…). Producción sigue c5e97ab1…. No reconstruir por documentación.

Siguiente: «las de A con extra queso» cuando «Queso Extra» es producto (orden invertido) sigue quedando como nota gratis por la ruta antigua; revisar llamadas a tryConfirmOrder fuera de un turno entrante; concurrencia real de ráfagas durante una duda pendiente.

## VIGENTE — inversiones de nota en formas sueltas y teléfono repetido en el paso final (19/10)

Base 4c37c61e, tanda 23. 144 regresiones nuevas (whatsapp-note-revision-phrasing.spec.ts): bao/salsa, pizza/masa y batido/base, agente simulado on/off, building_cart y awaiting_final_confirm, carrito de dos líneas (3× opción A «sin X», 2× opción B).

Baseline con router real: «ahora sí con X» y «mejor con X» anotaban en la línea equivocada; «las de A sí con X» y «quita el sin X de las de A» cambiaban la opción de la OTRA línea a A (applyNamedCartAttributes) y guardaban nota basura; «ya no sin X» añadía «sin X» a la otra línea; «échale X a todas», «sí ponle X», «al final sí quiero X», «que las de A sí lleven X», «ponle X a las de A» no hacían nada o guardaban la frase literal. Repetir el mismo teléfono en el paso final creaba la orden sin «confirmar».

Arreglo general: el analizador acepta muletillas iniciales, «mejor» final, «a todas», verbo primero con destino al final, lleven/van con/quiero y retiradas sin línea. Sin línea indicada solo actúa si exactamente una línea tiene la cláusula contraria; si hay varias, pregunta con pendingCartNoteEdit. «A todas» aplica a todas las que la tienen. Línea nombrada sin la cláusula ya no cae a rutas que editan otra línea: anota «con X» o dice que no encontró la nota, salvo que X nombre un producto u opción del catálogo (para no convertir adicionales cobrados en notas gratis). El teléfono del paso final re-entra por confirming. «Así está bien» sigue aprobando por política.

Validación: 234 focalizados, TypeScript, build TypeScript, 92 Node y diff --check. Global en dos fases: ráfagas 80/80 en 105,515s; resto 10.008/10.008 en 311,187s, 107 suites (inventario 108), 403 hashes intactos, sin reintentos. Evidencia whatsapp-note-reversal-phrasing-validation-1910.json. Cero llamadas pagadas, WhatsApp u órdenes externas.

Desplegado solo staging: runtime e8d77bbac8c6ad1c10d4cd586c4af9974f9580ab, imagen 825c589b…; health OK / DB connected / circuit CLOSED 2026-10-19T22:24:02Z. Rollback ppp-nest-staging:rollback-before-e8d77bba (imagen f22a5a76…). Producción sigue c5e97ab1…. No reconstruir por documentación.

Siguiente: guardar applyNamedCartAttributes para que «las de <opción existente>» usado como referencia no mute otra línea (queda expuesto cuando X es producto/opción del catálogo); revisar llamadas a tryConfirmOrder fuera de un turno entrante; concurrencia real de ráfagas durante una duda pendiente.

## VIGENTE — notas contradictorias, dos atributos y orden creada sin «confirmar» (19/10)

Base 71c7d3e0, tanda 22 desde auditoría PDF. 90 regresiones nuevas (whatsapp-note-replacement-block.spec.ts): bao/salsa, pizza/masa y batido/base con Tamaño Normal/Grande, agente simulado on/off, carrito sembrado de dos líneas en awaiting_final_confirm. 36 recorridos: reemplazar «sin X» por «con X» en una línea, retirar la nota, reemplazo parcial dividiendo unidades, dos atributos sobre las mismas unidades, opción retirada del catálogo durante la duda y retirada ambigua resuelta con «2». 54 contrastes: sin cláusula contradictoria, pregunta, duda pendiente con cancelar/confirmar/número inválido/carrito cambiado, segundo atributo inexistente, nota suelta y teléfono nuevo en el paso final.

HALLAZGO CRÍTICO: en awaiting_final_confirm, tryConfirmOrder crea la orden y varias rutas de edición lo llamaban para refrescar el resumen. «sin cebolla porfa», «sin hielo», un teléfono nuevo o «Quítale el sin cilantro a uno» creaban la orden sin «confirmar» (agente on/off). Arreglo general: firma del pedido (carrito consolidado, tipo, destino, pago, teléfono) al iniciar el turno; si cambió cuando se iba a crear, se re-muestra el resumen. Mercado Pago con skipFinalConfirm queda exento. La ruta de nota en línea además re-entra por confirming.

Baseline 36/36 fallaban. Nuevo pendingCartNoteEdit (firma de carrito, candidatos) dentro de CART_EDIT_SELECTION_KEYS: confirmar, «olvida ese cambio» y lista obsoleta usan la maquinaria existente. La revisión solo actúa si la línea tiene la cláusula contradicha; si no, cae a rutas anteriores. El cambio de opción por unidades acepta un segundo atributo configurado y aplica ambos con el plan atómico (directo o tras aclaración). Opción retirada del catálogo: se nombra y no se aplica. Sin nombres/IDs/precios de restaurantes en reglas.

Concurrencia: otro agente (Codex) empezó esta misma tanda en este checkout y dejó un manejador sin compilar que importaba un módulo inexistente. Tras 10 minutos sin actividad y por instrucción del usuario, se conservó y completó su manejador. No lanzar dos agentes sobre la misma fuente.

Validación: 208 focalizados, TypeScript, build TypeScript y 92 Node aprobados. Primera global: 80 + 9.818 aprobados y 46 fallidos por un Map sin encadenamiento opcional en specs que crean el servicio por prototipo; corregido y global repetida completa: ráfagas 80/80 en 104,998s; resto 9.864/9.864 en 307,640s, 107 suites, inventario exacto, 402 hashes intactos, sin reintentos. Evidencia whatsapp-note-revision-validation-1910.json.

Acumulado desde auditoría PDF: 574 nuevos y 12 fortalecidos; no todos los chats del PDF acreditados. Cero llamadas pagadas, WhatsApp u órdenes externas. Solo staging; Main intacto.

Desplegado solo staging: runtime 923c880b0fc93fb6f702ed6f2d01d3eb3749de48 (agrupa f0b5221b y 71c7d3e0), imagen f22a5a76b5406b1420535578b3eed2b42c3d13e1dfc9e8cb4c205e086277f69b, running sin reinicios; health OK / DB connected / circuit CLOSED 2026-10-19T21:05:02Z. Rollback ppp-nest-staging:rollback-before-923c880b (imagen cf59636b…). Producción sigue c5e97ab1…; bin/ privado preservado. No reconstruir por documentación.

Siguiente: revisar el resto de llamadas a tryConfirmOrder fuera de un turno entrante (la protección solo aplica dentro del turno), otras formulaciones de inversión de notas («ahora sí con X», «échale X a todas») y concurrencia real de ráfagas durante una duda pendiente.

## VIGENTE — aclaración corta de opciones por unidades (19/10)

Base bd9ee5a4, tanda 21 desde auditoría PDF. 60 regresiones nuevas: bao/salsa, pizza/masa y batido/base, agente simulado on/off. Carrito sembrado con dos líneas del mismo producto (3 y 2 unidades), opciones/notas diferentes. Diez caminos: número, ordinal, referencia por nota, consulta de precio, número inválido, cancelación, carrito reordenado por otro escritor, confirmar con duda pendiente, cambio de dirección y repetición posterior. 48 recorren hasta DTO de cinco unidades; 12 cancelación/índice obsoleto conservan carrito. No es interpretación de compra inicial ni inferencia real.

Baseline inicial 36/36 fallaban: la pregunta de línea no se persistía. Se reutiliza pendingCartAttributeEdit con opciones por unidades, cantidad y nota guardadas por candidato; la firma del carrito invalida índices antiguos. Resolver prepara opción+nota atómicamente y conserva estado de checkout. Una instrucción completa puede reemplazar la duda; cancelar solo retira el cambio. La repetición exacta de un cambio ya aplicado se reconoce únicamente con firma intacta. Revalidación de catálogo antes de aplicar. Sin nombres/IDs de restaurantes en reglas.

Validación: 288 focalizados (60 nuevos), TypeScript, build TypeScript y 92 Node aprobados. Global secuencial en dos fases: 80 ráfagas / 103,776s; resto 9.770 aprobados y cuatro fallidos / 322,210s. Total inicial 9.850 aprobados / cuatro fallidos, 106 suites, 400 hashes intactos e inventario exacto. Los cuatro fallos exigían sesión idéntica ante ambigüedad; se actualizaron para permitir SOLO el pendiente, mantener carrito/resto de sesión y resolver luego «1» comprobando unidades/variantes/estado. Archivo afectado completo: 813/813 en 98,536s. NO llamar a la global verde en un solo pase. Después de la global solo cambió ese spec, no runtime; los otros 399 hashes permanecieron iguales. TypeScript final repetido. Evidencia whatsapp-unit-clarification-validation-1910.json.

Acumulado desde auditoría PDF: 484 nuevos y 12 existentes fortalecidos; no todos los chats del PDF acreditados. Cero llamadas pagadas, WhatsApp u órdenes externas. Solo staging; Main intacto. Despliegue diferido para agrupar: último runtime acreditado 498124619b30f2294eba10a05f79407bd6914845 (servidor no consultado). Schedule eliminado.

Siguiente tanda: retirar/reemplazar notas contradictorias sobre unidades ya divididas y dos atributos sobre la misma selección. Añadir contraste con catálogo cambiado durante la duda y cambios concurrentes reales: esta tanda simula reordenación por otro escritor, no una ráfaga concurrente. Leer WHATSAPP-REPLACEMENT-AGENT-RUNBOOK.md y mantener focalizados durante desarrollo, una global al cierre.

## VIGENTE — relevo operativo y dos regresiones reportadas (19/10)

Base f0b5221b, vigésima tanda desde auditoría PDF. Leer primero [WHATSAPP-REPLACEMENT-AGENT-RUNBOOK.md](WHATSAPP-REPLACEMENT-AGENT-RUNBOOK.md): diseño de tandas, controles, fuente congelada, ejecución focalizada/global, límites de mocks y publicación frente a despliegue.

18 conversaciones nuevas con churrasco, bowl vegetal y pasta, agente simulado on/off. «un churrasco con poquito arroz y poquita ensalada» conserva un único producto y ambas notas, aunque existen porciones comprables en el catálogo. Tras completar una orden simulada, «cuanto tarda el pedido» y dos variantes responden sobre la orden registrada y el plazo configurado, sin reabrir carrito ni crear otra orden. Baseline 18/18 aprobado: estos casos ya estaban corregidos en la fuente actual; NO se cambió runtime en esta tanda. No acredita comportamiento del modelo real ni del bot desplegado.

TypeScript, build TypeScript y 92 Node aprobados. Global completa en dos fases secuenciales, sin reintentos: ráfagas aisladas 80/80 en 106,098s; resto con cuatro workers 9.714/9.714 en 331,929s. Total 105 suites / 9.794 tests, 438,027s (7m18s). Inventario de archivos exacto sin faltantes ni duplicados; 399 hashes intactos. No se cambiaron timeouts. Esta medición no mejora velocidad respecto a la última global; aisló satisfactoriamente las ráfagas en esta ejecución, no prueba ausencia futura de flakiness. Evidencia whatsapp-reduced-sides-postorder-validation-1910.json.

Acumulado desde auditoría PDF: 424 pruebas nuevas + ocho fortalecidas; no todos los chats del PDF están acreditados. Cero llamadas pagadas, WhatsApp u órdenes externas. Main intacto. Sin cambios productivos nuevos ni despliegue: último runtime acreditado 498124619b30f2294eba10a05f79407bd6914845; f0b5221b sigue pendiente de despliegue agrupado. Servidor no consultado en esta tanda. Schedule eliminado.

Siguiente bloque: respuesta numérica corta «2» tras aclaración entre líneas preexistentes, conservar cantidad/opción/nota y invalidar índices tras cambiar carrito. Después, dos atributos sobre las mismas unidades y sustitución/retirada de notas contradictorias. Mantener controles focalizados durante desarrollo y una global al cierre; no añadir parches para casos que ya pasan.

## VIGENTE — líneas preexistentes con variantes y notas distintas (19/10)

Base f2ace2a4 (runtime previo 49812461), decimonovena tanda desde auditoría PDF. 54 regresiones de router con tres menús sintéticos (bao/salsa, pizza/masa, batido/base), agente simulado on/off. Carrito inicial con dos líneas del mismo producto, cantidades 3 y 2, opciones/notas distintas. Nueve escenarios: selección por opción, por nota, por línea 2, petición ambigua seguida de instrucción completa con línea, cantidad excesiva, línea inexistente, cambio de dirección posterior, misma opción con notas distintas, nota compartida que no permite identificar una sola línea. 36 recorridos finalizan en DTO de cinco unidades; 18 controles inválidos conservan carrito y no crean orden.

Baseline inicial 24 fallos/18 verdes. La protección rechazaba todo producto repetido aun con referente inequívoco. Se conserva la condición de un único destino resuelto por catálogo/atributos/notas y se admite índice explícito del carrito; solo se rechaza si quedan varios candidatos o la cantidad excede la línea. Usa el plan atómico existente para opción+nota; conserva cantidades, precio y notas de líneas ajenas. La ambigüedad no ejecuta cambios. No excepciones por nombre/ID/restaurante.

Validación: 228 focalizados (54 nuevos + 174 anteriores), TypeScript, build TypeScript y 92 Node aprobados. Global: 103 suites aprobadas/una fallida, 9.775 tests aprobados y un timeout de 5s en desistimiento/ráfaga; 362,262s. Solo el caso fallido se repitió aislado: 1 aprobado/79 no seleccionados, 12,573s, mismo timeout y fuente. No llamar a la global completamente verde ni afirmar que se repitió todo el archivo. Los 398 hashes permanecieron intactos. Evidencia whatsapp-existing-variants-validation-1910.json. La sensibilidad temporal del test de ráfagas debe investigarse; no aumentar su timeout para ocultarla.

Acumulado desde auditoría PDF: 406 nuevos + ocho existentes fortalecidos; no significa que todos los chats estén reproducidos. Modelos/mapas/Meta/órdenes simulados; cero llamadas pagadas ni órdenes externas. Publicado en staging; despliegue diferido para agrupar próxima tanda. Último runtime acreditado 498124619b30f2294eba10a05f79407bd6914845, servidor no consultado en esta tanda. Main/producción intactos. Schedule eliminado, sin suites activas.

Próxima tanda: aclaración numérica corta («2») tras pregunta de línea, conservando cantidad/opción/nota original y comprobando que un cambio del carrito invalida índices viejos. Hoy se acredita responder con instrucción completa «Cambia la Salsa de una unidad de la línea 2…», no el número aislado. Añadir sustitución/retirada de notas contradictorias y dos atributos sobre una misma selección. Revisar el runner para aislar la familia temporal de ráfagas del paralelismo intensivo manteniendo todas sus aserciones y evidencia de ambas fases; no atribuir el timeout a un fallo funcional sin reproducción.

## VIGENTE — opción y nota sobre las mismas unidades (19/10)

Base 644b9812, decimoctava tanda desde auditoría PDF. 42 regresiones nuevas del router completo con tres menús sintéticos: bao/salsa, pizza/masa y batido/base; agente simulado on/off. Cambios sobre dos de cuatro o tres de cinco unidades. Siete recorridos: opción+nota, conservar nota anterior, repetir cambio, cambiar dirección/interior antes de confirmar, opción configurada que empieza con «sin», esa opción más otra nota y compra extra no resuelta que no debe ejecutarse parcialmente. Se verifica respuesta, carrito, estado, totales y DTO final (excepto caso rechazado: no crea orden).

Baseline inicial 30 fallos/6 verdes; ampliación «Sin gluten y sin aceitunas» produjo seis fallos adicionales antes de corregir. La opción se resuelve por catálogo (prioridad al valor completo o prefijo configurado más largo), la nota explícita se separa y ambas se preparan atómicamente usando prepareUnitOptionActions. No se pierde nota anterior ni se modifica el resto de unidades. No nombres/IDs/precios de restaurantes en reglas. Solicitudes con compra adicional no resuelta conservan carrito y piden aclaración; no afirmar que se ejecuta todo ese mensaje.

Validación final: 174 focalizados (42 nuevos + 132 del plan), TypeScript, build TypeScript y 92 Node aprobados. Global 103 suites / 9.722 tests aprobados en 396,165 s; 397 hashes intactos. La suite histórica de ráfagas pasó esta vez bajo cuatro workers y el timeout original; no hubo reintentos en esta global. Cero API pagada/WhatsApp/órdenes externas. Evidencia: whatsapp-unit-notes-options-validation-1910.json. Acumulado PDF: 352 tests nuevos + ocho anteriores fortalecidos; no equivale a todo el PDF ni a precisión del modelo real.

Publicado y desplegado solo staging: runtime 498124619b30f2294eba10a05f79407bd6914845, incluye 644b9812. Imagen cf59636b82ca1d3327d0c5b3a992569c86e7c396d825c7b3a279e1d9675530a2, running sin reinicios. Health OK / DB connected / circuit CLOSED a las 2026-10-19T19:41:28.712Z. Producción sigue c5e97ab1f09502b3a64a73fb332665395f9e6054349b7195bc3d58081bf4559e; Main intacto. bin/ privado preservado, sin tocar volúmenes ni contenedor huérfano. Rollback ppp-nest-staging:rollback-before-49812461. Schedule eliminado, no suites activas; no reconstruir por documentación.

Siguiente: selección explícita entre líneas YA separadas del mismo producto con atributos/notas distintos; corregir una de ellas sin editar las demás; combinaciones de dos atributos más nota y sustitución/retirada de nota contradictoria. Incorporar cambios de destino mientras hay opción pendiente. Esta tanda comienza con una sola variante agrupada, no acredita resolver todas esas selecciones preexistentes. Mantener pruebas focalizadas por bloque y global al cerrar; inferencia real sigue pendiente y separada de mocks.

## VIGENTE — aclaración de notas tras cambiar destino (19/10)

Base 9af96d8f, solo staging. Decimoséptima tanda desde la auditoría PDF: 36 conversaciones nuevas, dos menús sintéticos (pastas y platos vegetales), agente mock on/off. Nueve recorridos: selección por números/nombres; cancelar nota; dos unidades de una línea de tres; alcance inicialmente sin cantidad; selección inexistente; cantidad incompatible; confirmar con nota pendiente; segunda dirección antes de resolver. Todos consultan total y verifican respuesta, carrito, pendiente, estado y DTO final de tres unidades. No infiere una precisión real del modelo.

Baseline: 24/24 fallaban porque la aclaración no se persistía. Se conserva el pendiente por unidades; una línea puede dividirse conservando atributos/precio y el resto sin nota; varias líneas deben sumar la cantidad solicitada. Selección inválida no cambia carrito, cancelación no borra dirección/pago y confirmar no crea orden mientras falta aclaración. Recordatorio no se duplica si la respuesta retenida ya lo incluye. Sin excepciones por producto/restaurante.

Validación: 92 focalizados (36 nuevos + 56 existentes), TypeScript, build TypeScript y 92 tests Node aprobados. Global: 101 suites aprobadas / una fallida, 9.678 tests aprobados y dos timeouts de 5s en la suite histórica de desistimiento/ráfagas; duración 356,554s. Repetición aislada del archivo completo: 80/80 aprobados en 108,651s, sin cambiar fuente ni timeout. No llamar a la global completamente verde: los dos timeouts fueron no reproducidos en aislamiento, posible sensibilidad a carga pendiente de observar. Los 396 hashes de fuente quedaron intactos. Evidencia: whatsapp-destination-note-resolution-validation-1910.json.

Acumulado desde auditoría PDF: 310 tests nuevos + ocho anteriores fortalecidos. NO están acreditados todos los chats del PDF. Cero API pagada, WhatsApp u órdenes externas. Schedule eliminado. Cambios publicados en staging; despliegue diferido para agrupar con siguiente bloque. Último runtime acreditado sigue 4de330e41f4500492523af4661c1127c7d618ec6 (no se consultó el servidor en esta tanda); Main/producción intactos. No hay suites activas.

Siguiente bloque: notas que coinciden con atributos configurados; selección parcial sobre líneas del mismo producto con variantes diferentes; cambios de destino/torre/apto mientras hay una opción pendiente y su resolución posterior. Probar notas contradictorias y modificaciones del carrito mientras se espera una selección; no considerar esos recorridos cubiertos por los 36 actuales. Mantener focalizados durante el bloque y global al cierre, con observación de estabilidad de ráfagas bajo cuatro workers. Las ráfagas concurrentes y el reconocimiento real de audio/imágenes no se validaron en esta tanda.

## VIGENTE — suite repartida y bloque de destinos cerrados (19/10)

Base 9a53dc5f, solo staging. Suite histórica repartida en 12 archivos equilibrados por duración, simulador compartido whatsapp-accuracy.test-support.ts excluido del build productivo. Los 512 bloques mantienen contenido; global confirma exactamente los mismos 7.611 nombres/multiplicidades de tests históricos. No se eliminaron casos. Comandos y cadencia: WHATSAPP-TEST-RUNNING.md.

Global nueva: 101 suites / 9.644 tests aprobados en 391,298 s (6m31s), frente a 1.296,707 s (21m37s). Reducción 69,8 % en una medición local; incluye partición y cambio de dos a cuatro workers, no atribuir solo a archivos. 395 hashes intactos. TypeScript, build TypeScript y 92 Node aprobados. Sin suite activa. Manifiesto whatsapp-accuracy-partition-1910.json y evidencia whatsapp-destination-block-validation-1910.json.

Bloque de 56 tests nuevos: 32 conversaciones completas con cuatro nombres de platos de menús sintéticos + 24 contratos. Seis recorridos principales: calle/conjunto/torre/apto y corrección; nueva dirección con consulta y compra extra; retorno explícito al histórico; sabor pendiente mientras cambia destino; cobertura fallida y recuperación; destino+nota. Baseline válido ocho fallos/16 verdes. Primer intento incluyó cuatro fallos de fixture: Base aplicaba default y no dejaba selección pendiente, reemplazado por jugo con sabor obligatorio. No contarlos como fallos del bot.

Corregido: «mejor a la misma de antes» recupera dirección guardada en vez de geocodificar frase literal; sin histórico pide calle. Dirección+nota se procesa antes del editor de platos y separa destino de nota; cantidades incompatibles no aplican nota a todos y solicitan aclaración. Carrito, pago, atributos, unidades y DTO conservados; no órdenes antes de confirmar. 56 focalizados aprobados. Decimosexta tanda desde auditoría PDF: 274 tests nuevos acumulados, más ocho anteriores fortalecidos. No equivale a PDF completo ni precisión real del modelo.

Publicado y desplegado solo staging: runtime 4de330e41f4500492523af4661c1127c7d618ec6 (partición 7506920b), imagen 11c3c9362c9307742e51e06e65802da7b016912ee184bdbe38dc4ce7083044d9, running sin reinicios. Health OK/DB connected/circuit CLOSED 2026-10-19T19:13:26Z tras 502 transitorio de arranque. Producción c5e97ab1… intacta; bin/ privado preservado. No reconstruir por documentación. Main intacto, cero API pagada/WhatsApp/órdenes externas; schedule eliminado. Próximo bloque: resolver aclaración de nota para un subconjunto tras destino, notas que coinciden con atributo configurado y ráfagas de datos nuevos durante selección pendiente. Los turnos de esta tanda son seriales, no concurrencia real; mapas/modelos simulados. Mantener focalizados durante un bloque amplio y una global al cierre, no una por cada ocho tests.

## VIGENTE — nueva dirección sin arrastrar destino anterior (19/10)

Base e1572421, staging. Ocho conversaciones nuevas, ravioles/bowl y agente simulado on/off, desde dirección guardada o destino confirmado/pagado (incluye destino activo sin histórico). «A una nueva» invalida dirección, confirmación, unidad y ruta anteriores; conserva carrito, pago e histórico. No vuelve a ofrecer automáticamente el destino descartado después de agregar producto y cerrar; «sí» sin calle no lo reactiva. Torre/apto antes de calle se conserva en nueva dirección; DTO final tiene tres unidades y tarifa nueva.

Baseline cuatro fallos/ocho: dirección y ruta viejas seguían activas. Ampliación produjo ocho fallos por reofrecer dirección rechazada. 64 focalizados, TypeScript, 92 Node y global 88 suites / 9.588 tests aprobados; 379 hashes intactos. Archivo general tardó 1.263,811 segundos. Evidencia whatsapp-fresh-destination-validation-1910.json. Decimoquinta tanda desde auditoría PDF: 218 nuevos acumulados, además de ocho existentes fortalecidos. No todos los chats reproducidos; modelos/mapas/órdenes simulados, cero llamadas pagadas/WhatsApp. Main intacto. Publicado y desplegado solo staging: bb6e14d3809c91c806c18120669d878875d3b01e, imagen d110554fe0ae500c788f5af62a938834e55fb4f8fe611f18ee983f53772ba03b. Running sin reinicios; health OK/DB connected/circuit CLOSED 2026-10-19T18:53:49Z tras 502 transitorio de arranque. Producción c5e97ab1… intacta, bin/ privado preservado. Incluye tanda anterior de cobertura. No reconstruir por documentación. No hay suite activa; schedule eliminado.

Cambio de cadencia: agrupar familias con focalizados y correr global al cerrar bloque; no repetirla por cada ocho casos. Priorizar partición del archivo gigante (511 describe + un it suelto) con equivalencia verificable. Próximo bloque de seis recorridos en whatsapp-next-batches.md. Pendientes: vuelta explícita al destino guardado después de pedir otro, unidades en mensajes separados y selección de producto pendiente. No declarar esos recorridos acreditados por esta tanda.

### Próximo bloque coherente: cierre con destino fragmentado

1. Calle → conjunto → torre → apartamento en cuatro turnos, antes de pago y antes de confirmar; sustituir solo apartamento sin perder calle/torre.
2. «A una nueva» → consulta de precio → agregar producto → calle; no revivir destino descartado ni tarifa anterior.
3. «A una nueva» → «mejor a la misma de antes»: retorno explícito (pendiente, la protección actual bloquea reutilización automática); distinguirlo de «sí» sin dirección.
4. Elegir nueva dirección con variante de producto pendiente; resolver ambas sin perder cantidad ni atributos.
5. Destino fuera de cobertura → nuevo destino válido, con pago seleccionado; recalcular y revisar, nunca confirmar por cambiar datos.
6. Dirección y nota alimentaria en un turno; modificar solo el plato indicado, conservar todos los componentes logísticos y retomar cierre.

Usar menús con estructuras distintas (plato simple, combo con bebida y producto con varias variantes), cantidades no uniformes y datos de cliente ficticios. Afirmar respuesta, carrito, pendiente y DTO. Estas filas son plan, NO tests ejecutados. Correr focalizados por familia; global una vez para el bloque validado. La evaluación de modelos/mapas reales sigue separada.

### Ajuste de cadencia solicitado por el usuario (19/10)

Evitar global completa por cada grupo pequeño. Agrupar familias relacionadas, reproducir y correr focalizados durante desarrollo; una global congelada al cerrar el bloque, antes de publicación/despliegue. Esto mantiene AGENTS (reglas compartidas requieren global), cambia el tamaño del bloque. No inflar conteos con paráfrasis equivalentes. Reportar riesgos/recorridos cerrados y defectos abiertos.

Medición tomada de /tmp/ppp-unit-before-street-global.json: whatsapp-general-accuracy.spec.ts concentra 7.595 tests y 1.083,6 s; siguientes suites 32,7 y 31,0 s. maxWorkers=2 no distribuye los tests de un mismo archivo. Próximo trabajo de infraestructura: extraer harness compartido y separar familias en archivos conservando todos los nombres/oráculos/conteos; comparar mismos resultados y tiempo con recursos acotados. No editar durante la global activa. No atribuir toda la demora a conversaciones largas ni usar cantidad de tests como calidad. Inspección AST sin modificar fuente: 511 grupos describe y un it suelto, más imports/fixture/harness. La partición debe conservar ese test suelto, las rutas de fixtures relativas a __dirname y el aislamiento de mocks. No acreditar mejora de velocidad hasta medir.

## VIGENTE — cobertura consultiva durante cierre validada (19/10)

Base 911eb576, staging. Ocho conversaciones nuevas: ravioles/bowl, agente simulado on/off, pago/confirmación. Destino A con torre/apto y tarifa 2.000; consulta B con tarifa 6.000 y consulta C fuera de cobertura; consulta de total conserva 44.000; cambio explícito a B descarta interiores anteriores y cierra DTO con tarifa 6.000. No orden antes de confirmar, carrito y estado se conservan durante consultas.

Baseline ocho fallos de respuesta: cotizar B no mostraba que A seguía siendo el destino. Corrección exclusivamente de respuesta: indicar dirección conservada y retomar el paso pendiente también al consultar fuera de cobertura. No cambian detección, estado, persistencia ni cálculo de tarifa. 125 focalizados y TypeScript aprobados. No repetir global por este ajuste de plantilla; última global de lógica sigue 88 suites / 9.572 tests. Estas ocho nuevas se acreditan focalmente, no se suman al resultado de aquella global. Evidencia whatsapp-coverage-checkout-validation-1910.json.

Decimocuarta tanda cerrada desde auditoría PDF, 210 tests nuevos acumulados; no todos los chats cubiertos. Modelos/mapas/órdenes simulados, cero API pagada ni WhatsApp. Main intacto. Publicación en staging; despliegue diferido para agrupar próxima tanda. Último runtime desplegado acreditado b8606294 / imagen 13329f78…, servidor no revisado aquí. Schedule eliminado. No hay suites activas.

Siguiente: «a una nueva» sin calle desde pregunta de reutilización; conservar pendientes al rechazar la dirección anterior; interiores separados entre sí. La prueba actual usa cambio explícito completo, no acredita esas otras formulaciones. Evaluación reservada real pendiente.

## VIGENTE — interiores antes del destino validados (19/10)

Base 77b8cda0, staging. 24 conversaciones nuevas: dos menús, agente simulado on/off, building_cart/awaiting_address, destino posterior calle/pin/dirección completa con otra unidad. Baseline inicial ocho fallos: torre/apto solos avanzaban a pago. Ampliación: 16 fallos y ocho verdes, pérdida de complemento con pin y arrastre de unidad al recibir otra explícita. pendingDeliveryUnit conserva el fragmento sin geocodificarlo; calle fuerte lo consume una vez, unidad explícita nueva prevalece, pin conserva complemento y coordenadas. Recogida limpia pendiente; reset del servicio usa sesión nueva (sin nuevo replay de reset en esta tanda).

Final: 68 focalizados, TypeScript, 92 Node y global 88 suites / 9.572 tests aprobados, 379 hashes intactos. Evidencia whatsapp-unit-before-street-validation-1910.json. La prueba final usa modo ruta: exige no cotizar sin base, luego cotizar destino. Se corrigió el oráculo del pin: conserva coordenadas para logística, no exige inventar una calle; resumen muestra complemento sin coordenadas crudas. Cero llamadas pagadas/Meta/órdenes externas. Modelos y mapas simulados.

Decimotercera tanda cerrada desde auditoría PDF, 202 tests nuevos acumulados; no equivale a todos los chats cubiertos. Main intacto. Publicado y desplegado solo staging, incluyendo 77b8cda0: b860629431ac2dd95bfb973d119186ae01a160a2, imagen 13329f78fd343708b8e3beeab957e21e48d90c2682792fb6f28d8f5017feab8d. Running sin reinicios; health OK/DB connected/circuit CLOSED 2026-10-19T18:19:48Z tras 502 transitorio de arranque. Producción c5e97ab1… intacta; bin/ privado preservado. No reconstruir por documentación. No hay suites activas. Schedule eliminado.

Siguiente: cobertura sin modificar destino, «a una nueva», interiores separados entre sí y otras unidades. Esta tanda exige carrito existente y ausencia de dirección base; no acredita todas las formas de conversación. Evaluación reservada con modelo real sigue pendiente.

## VIGENTE — reemplazo de apartamento/interior validado (19/10)

Base d117377f, staging. 16 conversaciones nuevas, dos menús sintéticos, agente simulado on/off y pago/confirmación. «apartamento 402» / «el apartamento es 402» sustituye 304B; interior 21 → 2 evita coincidencia parcial. Repite corrección, consulta total, pago y confirma DTO. Baseline ocho fallos de apartamento: acumulación de unidades o pérdida de calle; ocho controles de interior añadidos después. Ruta temprana de unidad declarativa y reemplazo por componente/aliases conservan calle, torre, carrito, tarifa, contacto y paso pendiente; corregir datos no confirma la compra.

Primera global: 9.546 verdes y dos fallos de formato (torre 3, apto 607 frente a torre 3 apto 607). Se conserva el grupo de componentes juntos. Final: 46 focalizados, TypeScript, 92 Node y global repetida 88 suites / 9.548 tests aprobados. Los 379 hashes finales permanecieron intactos. Evidencia whatsapp-unit-replacement-validation-1910.json. Duodécima tanda cerrada desde auditoría PDF, 178 tests nuevos acumulados. No equivale a todos los chats cubiertos.

Solo rama staging; Main intacto. Cero API pagada/WhatsApp/órdenes externas. Despliegue diferido para agrupar con próxima tanda; último runtime desplegado acreditado sigue 327ae112 / imagen f8413466…, no se revisó servidor en esta tanda. No hay suites activas. Schedule eliminado, continuación manual.

Siguiente: complemento sin dirección base, pregunta de cobertura sin sustituir destino y rechazo «a una nueva». Reemplazos probados son apartamento/interior: no acreditar todas las demás unidades por compartir implementación. Formas interrogativas y «cambia X por Y» requieren recorrido propio. Mapas/modelos simulados, evaluación reservada pendiente.

## VIGENTE — referencias de acceso conservan el cierre (19/10)

Base 6f42b450, staging. Ocho regresiones nuevas: ravioles/bowl, agente simulado on/off, pago/confirmación; portón/timbre, repetición, total, pago y DTO final. Baseline ocho fallos: referencia como nota del plato, retorno a compras o aprobación prematura. Corrección general: priorizar referencia declarativa de entrega y retomar el paso pendiente sin aprobar. Conserva carrito, calle, torre/apto, tarifa y contacto; repetir no duplica ni crea orden.

28 focalizados, TypeScript, 92 Node y global 88 suites / 9.532 tests aprobados. Los 379 hashes permanecieron intactos. Evidencia whatsapp-access-reference-validation-1910.json. Undécima tanda cerrada desde auditoría PDF, 162 tests nuevos acumulados; no equivale a todos los chats cubiertos. Main intacto; cero llamadas pagadas, WhatsApp u órdenes externas. Publicado y desplegado solo en staging: 327ae11207390068d75a63ab134223308d22c99f, imagen f841346690ed791988782e20d45f2d400a88907317c2e02fce65521ae4c9f9c7, running sin reinicios. Health OK/DB connected/circuit CLOSED a las 2026-10-19T17:09:45Z tras 502 transitorio de arranque. Producción c5e97ab1… intacta. bin/ privado preservado. No reconstruir por este cierre documental. No hay suites activas.

Siguiente: cambiar solo apartamento sin conservar el anterior; complemento sin dirección base; rechazo de destino anterior y consulta de cobertura. Schedule eliminado, continuación manual. Mapas/modelos simulados, evaluación real reservada pendiente.

### Próxima tanda acotada: reemplazar un interior

Inspección de tryAppendUnitDetailsToAddress: hoy concatena un detalle distinto; no reemplaza un apartamento anterior. Es hipótesis pendiente de reproducción, no un fallo nuevo acreditado. Probar con dos catálogos y router completo:

- Dirección confirmada con torre B/apto 304B → «el apartamento es 402» durante pago y confirmación: conservar calle/torre, quitar solo el apartamento anterior, conservar carrito/tarifa/contacto/pago y pedir aprobación final.
- Repetir la corrección no duplica datos ni crea órdenes.
- Nueva calle elimina interiores del domicilio anterior; referencia visual no debe convertirse en apartamento.
- Unidad sin calle base permanece pendiente y pide calle o ubicación, sin inventar cobertura.
- Consulta «¿es el apartamento 402?» no cambia silenciosamente un destino confirmado.

Comprobar respuesta y DTO, además de sesión. Si se modifica regla compartida, focalizados + TypeScript + Node + global con fuente congelada. No afirmar cobertura de todas estas variantes por la tanda actual de portón/timbre.

## VIGENTE — destino fragmentado y complemento sin aprobación validados (19/10)

Base 2b9e4c9e, solo staging. 21 tests nuevos: ocho conversaciones de ravioles/bowl, agente simulado on/off, calle → conjunto → torre/apto → total → pago → confirmación, con/sin cambio tardío de calle y complementos repetidos. Trece contratos gramaticales positivos/negativos de torres alfanuméricas. Mapas, modelos, Meta y órdenes simulados.

Baseline: ocho fallos; Torre B apto 304B borraba la calle. Tras ampliar gramática, cuatro recorridos revelaron que añadir unidad en awaiting_final_confirm creaba orden antes de aprobar. Corrección: torre/bloque con identificadores alfanuméricos acotados; complemento en confirmación vuelve a revisión sin crear orden. Conserva carrito, pago, tarifa, contacto; cambiar calle descarta interiores anteriores. Repetir unidad no duplica ni confirma. No regla por restaurante.

41 focalizados finales, TypeScript, 92 Node y global 88 suites / 9.524 tests aprobados. Los 379 hashes de fuente permanecieron intactos. Evidencia whatsapp-fragmented-destination-validation-1910.json. Main intacto; cero API pagada/Meta/órdenes externas. Décima tanda cerrada desde auditoría PDF, 154 tests nuevos acumulados; no equivale a todos los chats cubiertos. Desplegado solo staging: 33411362eceb37b292bdda319c7d928e4815b1cd, imagen 62980a4fa000edbb44ce24670c7c4f901a45fc02259f10c76feaec6d59c0699a, running sin reinicios. Health público OK/DB connected/circuit CLOSED 2026-10-19T16:26:40Z tras 502 transitorio de arranque. Producción c5e97ab1… intacta; bin/ privado preservado. No reconstruir por documentación. No hay suites activas.

Pendiente D: «a una nueva» sin calle; complemento sin dirección base; cambiar solo apartamento descartando el anterior; consulta de cobertura sin cambiar destino; mapa real. Después E/F y evaluación reservada. Schedule eliminado; continuar manualmente.

Inspección para próxima tanda, todavía sin reproducción nueva: tryAppendDeliveryAccessReference guarda building_cart y pregunta por más productos incluso al venir de pago/confirmación. Probar «portón verde» durante cierre y conservar/reanudar revisión si corresponde; no afirmar corregido ni extender esta tanda durante la global.

## VIGENTE — datos completos y destinatario explícito validados (19/10)

Base c4bf7d7a, solo staging. Trece pruebas nuevas: ocho recorridos de ravioles/bowl, agente simulado on/off, datos juntos/secuenciales; cinco controles de destinatario explícito frente a nombre inferido. Los recorridos comprueban dos unidades, teléfono, calle/conjunto/torre/apartamento, consulta de carrito, pago, cambio tardío de calle y DTO simulado sin orden prematura.

Baseline: cuatro mensajes completos conservaron Wilmer en lugar de Cristina; secuenciales pasaron. Se reconoce «a nombre (de)», se permite reemplazar contacto guardado solo con nombre explícito válido, se limpian separadores residuales al separar dirección y se evita reintroducir datos de contacto como palabras del plato en mensajes sin dirección. La primera corrección expuso contaminación de dirección por separadores; los controles adicionales reprodujeron falsa indisponibilidad del plato con nombre/teléfono. Reglas generales, sin IDs/nombres de restaurante.

Primera global: 9.483 verdes / 20 regresiones (alergias, notas y correcciones), NO aprobada. Se limitó la limpieza a datos explícitos; «soy…» e inferencias de nombre no sustituyen la intención original. Reparación: 125 focalizados, TypeScript, 92 contratos Node y global 88 suites / 9.503 tests aprobados. Los 379 hashes de fuente permanecieron intactos durante la global. Evidencia whatsapp-delivery-contact-validation-1910.json. Cero llamadas pagadas/Meta/órdenes externas. Main intacto; schedule eliminado. Novena tanda cerrada desde la auditoría, 133 tests nuevos acumulados; no equivale a todos los chats del PDF cubiertos. Siguiente: destinos fragmentados hasta DTO, rechazo de dirección anterior y complemento sin calle; después variantes/postorden y evaluación reservada. Desplegado solo staging: f4916192716259a4402c71879b4ab9d231919854, imagen ef24e7f71d07fc0ffba308225a73fc65ed5cd615e29bd6d9b83a4469c8f6d157, running sin reinicios. Health público OK/DB connected/circuit CLOSED 2026-10-19T16:01:36Z tras 502 transitorio de arranque. Producción conserva c5e97ab1… running; bin/ privado sin seguimiento preservado. No reconstruir por esta documentación. No hay suites activas.

### Siguiente tanda D2 — destino fragmentado hasta orden simulada

1. Ampliar `Historical chat continuation: address components and late notes` mediante `sendQueued`, dos menús sintéticos y agente simulado on/off. Calle → conjunto → torre/apartamento → consulta total → pago → confirmación. Exigir respuesta útil, datos no duplicados y DTO íntegro.
2. Rechazo «a una nueva» → nueva calle → complemento. Nunca guardar «esta», «la nueva» ni la dirección anterior; no reutilizar torre/apartamento del destino reemplazado.
3. Complemento aislado («torre 2 apto 301») sin dirección base: conservar como pendiente, pedir calle/ubicación y no avanzar con una geocodificación inventada. Mapa simulado no acredita exactitud real.
4. Cambio tardío de apartamento durante confirmación: conservar calle, carrito y pago; actualizar revisión, sin crear orden antes de la aprobación.
5. Negativo: pregunta de cobertura con una calle no sustituye automáticamente destino confirmado. Mantener casos de consulta frente a instrucción explícita.

Cerrar una familia coherente, no sumar combinaciones cosméticas. Para cada fallo guardar baseline, respuesta/carrito/estado y DTO. No desplegar pruebas/documentación solas; agrupar runtime validado. Continúan pendientes variantes ambiguas (E), postorden (F) y evaluación reservada con modelo real antes del piloto.

## VIGENTE — sustitución de adicionales durante cierre verificada (19/10)

Base 5103211e. Dieciséis conversaciones nuevas: sushi/vegetal, pago/confirmación, agente simulado on/off y «cambia X por Y»/«no quiero X, quiero Y». Compra de combo con Manzana y dos unidades de adicional; reemplazo inexistente rechazado sin mutación; reemplazo válido conserva cantidad dos, combo/opción/nota preexistente; consulta total actualizado 48.000 y cierre hasta DTO de tres unidades. No orden antes de confirmar. Nota del combo sembrada como estado previo, no extracción probada. Datos externos/modelos simulados.

72 controles focalizados y TypeScript aprobados. No cambios de runtime; no repetir global ni reconstruir por tests. Última global runtime sigue 88 suites / 9.474 tests; estas 16 nuevas se validan focalmente y no se incluyen en ese conteo. Cero API pagada, Meta y órdenes externas. Main intacto, sin suites activas. Evidencia whatsapp-extra-replacement-validation-1910.json. Último runtime acreditado 1b5b0028 / imagen d28f968f…, no se comprobó servidor en esta tanda.

Ocho tandas cerradas desde auditoría PDF 18/10, 120 tests nuevos y ocho fortalecidos. No equivale a todo el PDF cubierto. Schedule eliminado; continuar manualmente con D: destinos/cierre, datos en ráfagas y en un mensaje, interiores separados de calle y corrección durante pago/confirmación. Después ampliar E y F; evaluación reservada con modelo real pendiente. No declarar piloto listo por conteos.

## VIGENTE — cierre tras faltante validado (19/10)

Base 964e1ee3. Ocho recorridos existentes fortalecidos: faltante presente/ausente, sushi/vegetal, agente simulado on/off. Exigen conservar awaiting_final_confirm, ausencia de «Algo más», combo/opción/nota intactos, sin duplicados ni orden prematura, y DTO exacto después de confirmar. Corrección general: la ruta de compra múltiple totalmente resuelta recuerda si venía de confirmación y reutiliza tryConfirmOrder desde building_cart para presentar revisión. No aplica con enlace de pago activo ni advertencias de ítems no resueltos.

Global anterior interrumpida sin evidencia recuperable: no acreditarla. Global repetida aprobada: 88 suites / 9.474 tests, 379 hashes intactos. Incluye las 16 pruebas añadidas en las dos tandas previas de solo tests. Esta tanda fortalece ocho existentes, no suma ocho nuevas. Cero API pagada, Meta y órdenes externas; Main intacto. Sin suites activas. Evidencia whatsapp-resume-final-review-validation-1910.json.

Schedule eliminado a petición del usuario; continuar manualmente. PDF 18/10 leído completo, no todos sus chats reproducidos/corregidos. Siete tandas cerradas desde auditoría, 104 tests nuevos en las seis primeras; ver estado de cobertura en whatsapp-pdf-1810-audit.md. Siguiente: sustitución atómica de adicional, matriz destinos/cierre y postorden; después casos reservados con modelo real antes de acreditar piloto. Desplegado solo staging: código 1b5b0028e2a17a179aa5d73caa7912de6ce7e00a, imagen d28f968f2261bcf70ec925b5a3b2b7e136c958124eea0cc625155e9454df15b1, running. Health público OK/DB connected/circuit CLOSED 2026-10-19T15:10:34Z. Producción conserva c5e97ab1… running. No reconstruir por documentación. No declarar vendible por conteos.

## VIGENTE — faltantes sin duplicación; fricción de cierre pendiente (19/10)

Base 1b2e05e6, staging. Ocho conversaciones nuevas de sushi/vegetal, agente simulado on/off y adicional inicialmente presente/ausente. «Falta la porción…» deja exactamente una unidad, conserva combo, bebida y nota sembrada, permite consultar carrito y terminar hasta DTO exacto. No cambió runtime. 16 focalizados y TypeScript aprobados; no repetir global por tests: referencia runtime sigue 88/9.458 y no incluye estas pruebas ni las ocho de la tanda anterior.

Hallazgo real de UX: durante awaiting_final_confirm, reclamar faltante reabre building_cart con «Algo más», incluso cuando ya estaba y no hay mutación. La primera prueba exigía crear orden tras un solo «confirmar» y falló ocho veces: traza muestra que ese confirmar presentaba el resumen actualizado, no bloqueo permanente. Las pruebas finales permiten retomar con «no más», revisan ausencia de creación prematura y luego confirman. No fijan como requisito el paso redundante. NO afirmar corregida esa fricción: próxima prioridad conservar/reanudar checkout y mostrar resumen actualizado directamente tras la recuperación, con prueba que exija estado awaiting_final_confirm y sin «Algo más». Luego sustitución atómica del adicional y destinos/cierre del PDF.

Evidencia whatsapp-missing-extra-validation-1910.json. Nota de preparación preexistente sembrada, no extracción probada. Modelos/Meta/órdenes simulados, cero llamadas pagadas y órdenes externas. Main intacto, sin suites activas. Solo tests/documentación publicados: no reconstruir staging; último runtime acreditado 156ef70f / imagen 05d13fdb…, sin nueva comprobación remota. No declarar piloto listo por conteos.

## VIGENTE — edición de adicionales durante pago verificada (19/10)

Base f8cde83b. Ocho conversaciones nuevas de sushi/bowl con agente simulado on/off: compra de combo con bebida y media porción adicional, cierre a pago, retirar adicional o dejar dos unidades, consultar carrito y confirmar. Comprueban respuesta sin falsa indisponibilidad, estado de pago, combo/opción/nota preexistente intactos, nombre/contacto y DTO expandido exacto. Nota «Salsa aparte» sembrada como estado previo: no mide extracción de esa nota. No se cambió runtime: todos pasan con la lógica actual.

20 controles focalizados y TypeScript aprobados. No repetir global por cambios solo de tests: última global del runtime f8cde83b sigue 88 suites / 9.458 pruebas, no incluye estos ocho casos nuevos. Modelos, Meta y creación de orden simulados. Cero llamadas pagadas y órdenes externas, Main intacto. Evidencia whatsapp-combo-extra-edit-validation-1910.json. Sin suites activas.

Desplegado solo staging junto a f8cde83b: HEAD 156ef70fe368fc16e3cc4d5346200c64ea6e89da, imagen 05d13fdb3a45d201ae5c2ccea90b3e29523d01e13a10a956d625e0c18807b43a, running. Health público OK/DB connected/circuit CLOSED 2026-10-19T11:50:17Z. Producción conserva c5e97ab1… running. No reconstruir por documentación posterior. Siguiente: corrección de faltante ya presente frente a nueva compra y sustitución de adicional; después destinos y cierre del PDF. No declarar todos los chats corregidos ni piloto listo por conteos.

## VIGENTE — combo y media presentación adicional validados (19/10)

Base 127384f3, staging. PDF: «Un combo de arroz paisa con colombiana y medio pollo broaster» omitía el medio pollo. Seis conversaciones nuevas con PPP, pizza y menú vegetal, agente simulado on/off, consulta de total y cierre hasta DTO exacto. Dos fallos baseline PPP; cuatro verdes iniciales con adicionales explícitos. Variantes finales prueban «y media…» sin exigir «una» ni «adicional».

Las rutas tempranas de plato único excluyen fracciones adicionales. El splitter conserva cláusulas completas antes de limpiar identidad combo; si una cláusula fraccionaria aún contiene conjunciones, mantiene el análisis general. Sin nombres/IDs de PPP en la regla. Se conserva empaque separado y compras distribuidas por variantes.

Primera global: 9.456 verdes / dos regresiones por aceptar enumeraciones incompletas. Reparadas antes de publicar. Final: 22 focalizados, TypeScript, 92 Node y global 88 suites / 9.458 pruebas aprobadas, 379 hashes intactos. No hay suites activas. Evidencia whatsapp-combo-half-validation-1910.json. Modelos/Meta/órdenes simulados; cero llamadas pagadas ni órdenes externas. No acreditar modelo real por estos tests.

Despliegue diferido para agrupar con próxima tanda; runtime anterior acreditado 695aae28, no se comprobó servidor en este cierre. Main intacto. Siguiente parte de tanda C: retirar/cambiar adicional, corrección de faltante sin duplicación y catálogos sushi/bowl; luego tanda D de destinos/cierre. No declarar todos los casos del PDF solucionados.

## VIGENTE — pedido con poquito/poquita durante dirección desplegado

Base 7d3bbdc5. Caso nuevo 21:41 Bogotá del 18/10: «quiero un churrasco 3/4, poquito arroz y poquita ensalada» era rechazado como dirección; tras reiniciar añadía ensalada como producto. Reproducción: 12 fallos en tres menús (churrasco, bowl, pasta), carrito vacío y awaiting_address, agente simulado on/off.

Separación de preferencias acotada: todas las cláusulas deben empezar por poco/poca/poquito/poquita; números, compras extra y datos de dirección no se consumen como nota. Solo para preferencias explícitas poco/poquito, el control de múltiples productos usa la parte de producto ya separada, sin volver a interpretar ingredientes de la nota como compras. La ruta de producto con nota existente resuelve la compra antes del campo dirección. No se añadió excepción por plato/ID/restaurante.

21 pruebas nuevas: 12 conversaciones hasta DTO con cantidad/notas exactas, ocho contratos gramaticales y un extra explícito. Conservan el carrito previo y no confirman dirección guardada sin consentimiento. Primera global: 9.450 aprobadas / dos regresiones de «una X y otra X» con variantes; se limitó el cambio de guard a poco/poquito y pasan 33 focalizados, TypeScript y 92 Node. Global de reparación aprobada: 88 suites / 9.452 pruebas, 379 hashes intactos. No hay suites activas. La primera global tuvo un intervalo de ~42 minutos sin logs; no atribuirlo a una causa no verificada. Evidencia whatsapp-small-accompaniments-validation-1810.json. Sin llamadas pagadas/Meta/órdenes externas. No mide transcripción ni garantiza cumplimiento de la nota en cocina.

Desplegado solo staging: código 695aae28, imagen 84d72c8d84a23c8226cf1b01e7901f38d14a3404c229ba08a7fd616ff6eae353, running. Probe compilado de gramática aprobado sin red. Health público OK/DB connected/circuit CLOSED 2026-10-19T04:04:27Z tras 502 transitorio de arranque. Producción c5e97ab1… intacta. No reconstruir por documentación. Main intacto. Después retomar tanda C del PDF: combo con bebida y medio producto adicional, empaque separado versus adicional, corrección sin duplicación. Entradas inferiores históricas.

## VIGENTE — consultas de datos de transferencia validadas y desplegadas

Base f151b35e. Tanda B del PDF 18/10: consultas sobre cuenta/Nequi/titular responden solo datos configurados del comercio, sin reemplazar contacto/nombre, elegir pago ni confirmar orden. Sin datos pide obtenerlos del local; transferencia deshabilitada no expone datos antiguos. Guarda compras/cambios/datos personales mezclados para el router normal, sin consumirlos desde este handler.

45 pruebas nuevas: 32 recorridos completos (dos menús, pago/confirmación, cuatro frases, agente simulado on/off), ocho límites (sin configuración, deshabilitada, contacto explícito, selección explícita) y cinco guardas del helper para mensajes mixtos. Baseline inicial 16 fallos. 67 focalizados, TypeScript y 92 Node verdes. Global aprobada: 88 suites / 9.431 pruebas, 379 hashes intactos. Sin suites activas. Evidencia whatsapp-merchant-details-validation-1810.json. Sin llamadas pagadas/Meta/órdenes externas. La respuesta no verifica cuenta ni transferencia.

Código f0231b77 desplegado junto a ETA f151b35e. Imagen 7f5d00c7125c9da34fa9b6761a10db6591c950762bba934bc22ad849701f779d, running; health OK/DB connected/circuit CLOSED 2026-10-19T02:42:03Z. Probe compilado sin red aprobado. Producción c5e97ab1… intacta. Primer SSH atascado antes de ejecución: inspección confirmó HEAD viejo y ningún deploy activo; reintento con keepalive completó. Main intacto. No reconstruir por este cierre documental. Siguiente: tanda C del PDF, combo con bebida y medio producto adicional; variantes sintéticas, notas de empaque frente a adicionales, corrección sin duplicación y consultas intercaladas. Fotos/direcciones siguen desplegadas en 9c9a5487. Entradas inferiores históricas.

## VIGENTE — PDF 18/10 completo auditado; ETA coloquial validada

Fuente: chats 18_10.pdf, 60 páginas. Auditoría completa y próximas seis tandas en `docs/whatsapp-pdf-1810-audit.md`. Mezcla bot/atención humana/duplicados; no afirmar que todo son fallos del bot ni que todos están resueltos. Fixtures sin datos personales. Primera tanda: 16 recorridos con dos menús sintéticos, pago y confirmación; 12 fallos iniciales por «se demoran»/«demorará mucho». Corrección general de plural/futuro de demorar. 38 focalizados, TypeScript y 92 Node verdes. Global aprobada: 88 suites / 9.386 pruebas, 379 hashes intactos. No hay suites activas. Publicar solo staging; despliegue de ETA diferido para agrupar con la siguiente tanda. Evidencia `whatsapp-pdf-1810-eta-validation.json`.

Siguiente tanda: distinguir cuenta/Nequi del comercio y titular del pago frente a contacto/nombre del cliente. Luego integridad de combo+adicional, dirección/cierre, fracciones/opciones/notas y soporte posterior. No gastar API ni enviar WhatsApp en heartbeat. No cambiar Main.

Fotos de direcciones 9c9a5487 ya desplegadas en staging: imagen 4fcdbeeecd23b53ca4f754f6d27252dffc9e1a57ff1655cfd5810e3adb9e164a, running; health OK/DB connected/circuit CLOSED 2026-10-19T02:11:44Z. Probe compilado aprobado con HTTP/routing/Meta simulados; primeros intentos del probe fallaron por mocks incompletos, sin cambios al runtime. Producción sigue c5e97ab1… running. No reconstruir por documentación. Entradas inferiores históricas.

## VIGENTE — fotos de direcciones validadas; despliegue agrupado pendiente

Base 8dec6309. Visión distingue address de order/payment_proof; prompts principal y reintento conservan calle, conjunto e interiores y no inventan coordenadas. Router aplica dirección reconocida por el flujo de cambio de destino sin matching de productos. Una dirección incierta o múltiple pide precisión y conserva destino/carrito. Pie de dirección evita falso comprobante; comprobante explícito conserva su flujo. Foto caducada pide dirección/ubicación. Pedido cerrado no se modifica. Carrito vacío vuelve a pedir productos, no confirmar vacío.

23 pruebas nuevas; baseline 14 fallos, más fallo de cierre vacío detectado. 59 focalizados, TypeScript, 92 Node y global 88/9.370 en 617.423 s con 379 hashes intactos. Respuesta, carrito, estado y DTO por unidad con notas/dirección/fee comprobados en tres menús. OCR, mapas, Meta y órdenes simulados: no acreditar precisión real de fotos. Cero llamadas pagadas y órdenes externas. Main intacto. Evidencia whatsapp-image-address-validation-1810.json.

Publicar y agrupar deploy con contacto combinado 8dec6309; estado de deploy se actualizará tras verificación. No hay suites activas. Nueva solicitud manual: analizar COMPLETO /home/levi/Downloads/chats 18_10.pdf (60 páginas) y generar pruebas de sus patrones. Lectura en curso; contiene conversaciones humanas y reproducción con bot, duplicados y medios omitidos. No atribuir todo a fallos del bot ni copiar datos privados a fixtures. Tras el análisis seleccionar tandas de integridad, dirección/cierre y consultas interrumpidas; fotos reales pendientes de muestra para medir OCR.

## VIGENTE — contacto combinado validado; fotos de direcciones son la siguiente prioridad

Base 7036af5d. Corregido el descarte de nombre al recibir nombre, teléfono y pago juntos: el handler acepta cláusulas de contacto explícitas y persiste los tres datos antes de retomar checkout. Sin pago conserva la pregunta pendiente. No consume cláusulas ajenas ni dos teléfonos contradictorios. Regla general sin productos/IDs del restaurante.

22 pruebas nuevas: 12 recorridos completos con tres menús y agente simulado on/off, seis actualizaciones de nombre/teléfono sin pago y cuatro contratos de rechazo de cláusulas no consumidas. Baseline 12 fallos reales por conservar Wilmer. 40 focalizados, TypeScript, 92 Node; global 88 suites / 9.347 pruebas en 597.966 s, 379 hashes intactos. DTO exacto por unidad, nota, dirección, teléfono y nombre; no orden antes de confirmación. Evidencia whatsapp-contact-together-validation-1810.json. Sin suites activas. Cero API pagada/Meta/mapas reales/órdenes externas.

Publicar solo staging, despliegue diferido para agrupar con siguiente tanda. Runtime acreditado anterior eeeaeb54 / imagen b46b2c70…; esta corrección aún no está desplegada. Main intacto.

Nueva prioridad del usuario: fotos de direcciones. Contrato visual actual carece de kind address y fallback solo pide plato/código; contexto de transferencia puede capturar imagen other/unclear como comprobante. Diagnóstico de código, no prueba de OCR real. Plan detallado al inicio/siguiente sección de whatsapp-next-batches.md: contrato+prompts+router, dirección antes de catálogo, conservación de interiores, respuesta inmediata, ambigüedad y no confundir comprobante. Hace falta una foto real para medir lectura; mocks solo prueban flujo. Luego retomar calle posterior a interior y teléfonos inválidos. Comprobante vacío histórico y validación reservada real siguen pendientes; no declarar todos los chats resueltos ni piloto listo por conteos.

## Solicitud nueva — fotos de direcciones (diagnóstico, pendiente de implementación)

El usuario reporta buena lectura de platos pero fotos de direcciones no reconocidas. Inspección del 18/10: WhatsappImageAnalysis solo admite order/payment_proof/other/unclear; el prompt centra OCR en productos y el fallback pide plato/código. resolveImageMessage puede interpretar una imagen other/unclear como comprobante según estado. Esto acredita un hueco de contrato, no el resultado OCR de las fotos concretas (no adjuntadas).

Siguiente tanda prioritaria tras cerrar contacto combinado:
1. Incorporar dirección como intención de imagen en contrato, parser y ambos prompts, sin modificar modelo.
2. Conducir texto de destino al flujo normal de dirección antes de matching de productos, conservando calle, conjunto y unidades. No tratar números de calle como códigos/cantidades.
3. Evitar que contexto de transferencia convierta una dirección reconocida en comprobante; preservar reconocimiento explícito de comprobantes.
4. Probar foto sola durante carrito, dirección, pago y confirmación; carrito vacío no debe crear productos ni órdenes. Cambio de destino conserva notas/contacto y recalcula cotización simulada.
5. Foto ilegible o múltiples direcciones: aclaración específica, sin inventar coordenadas, calle ni selección del destino. Un mapa sin dirección legible debe pedir ubicación de WhatsApp/calle y número.
6. Respuesta inmediata sin texto posterior; sin escalamiento automático a humano. Pruebas de contrato HTTP y router con varios menús, respuesta/carrito/estado/DTO.
7. Las pruebas gratuitas de OCR simulado no acreditan precisión visual. Solicitar una foto real de ejemplo para evaluación separada con presupuesto controlado; no hacer llamadas pagadas en heartbeat.

La suite global de contacto cerró verde (88/9.347); esta nota no acredita implementación de fotos de direcciones.

## VIGENTE — interiores y controles de checkout incierto publicados/desplegados juntos

Código eeeaeb541a9b527594ae0a45a7e551d68e2cce87, imagen sha256:b46b2c7035ce7da843b773886af2a0025eb2405fa609a9dacbd3e4edc802b713. Running/healthy a las 00:54:23 UTC del 19/10 (19:54 Bogotá del 18/10); /api/health OK/DB connected/circuit CLOSED 00:54:29 UTC. Nueve aserciones del helper compilado aprobadas. Rollback ppp-nest-staging:rollback-before-eeeaeb54. Main/producción intactos, imagen productiva c5e97ab1… running. No reconstruir por este cierre documental.

Doce conversaciones nuevas ya pasan sin corregir lógica: inspección del carrito, consulta de total, retiro por índice/nombre durante aclaración de mapa y recuperación con calle hasta DTO exacto de dos unidades/notas. Tres menús, agente simulado on/off. 30 focalizados y TypeScript. No repetir global por solo tests: última global sigue 88/9.313 (d322fb8f), no incluye estas 12 pruebas. Baseline inicial falló por oráculo de DTO (expandido por unidad), no defecto. Despliegue agrupa corrección de interiores d322fb8f previamente validada. Evidencias whatsapp-uncertain-checkout-validation-1810.json y whatsapp-map-units-validation-1810.json.

No hay suites activas. Cero llamadas pagadas/Meta/mapas reales/órdenes externas. Siguiente: dirección con calle posterior al interior y teléfono inválido/datos simultáneos. Cotización y modelos siguen simulados; no acreditar geocodificación real. Los chats están inventariados pero no todos sus fallos resueltos; comprobante vacío histórico y validación reservada real pendientes. Entradas inferiores históricas.

## VIGENTE — interiores alfanuméricos validados; despliegue agrupado pendiente

Base e8bf89d1. Global verde: 88 suites / 9.313 pruebas en 590.42 s; 379 hashes intactos. Después únicamente se quitó una línea vacía extra al final del archivo de tests. 24 pruebas nuevas: 12 parser, seis conversaciones con tres menús y seis rechazos de resultado de mapa distinto/parcial. Baseline 10 fallos/7 verdes; pasan 31 focalizados, 108 contratos afectados, TypeScript y 92 Node. Evidencia whatsapp-map-units-validation-1810.json. No hay suites activas.

Se separan unidades B, B-2, 2A, 304B de consulta al mapa y se conservan en respuesta/DTO. Protección de Casa Blanca/Torre del Sol, destino incompleto y calle posterior a interior. El antiguo contrato que dejaba bloque B pegado al edificio cambia deliberadamente. Conversaciones con router/routing reales pero HTTP, distancia y órdenes simulados; no acreditar Maps ni modelo real.

Publicar solo staging y agrupar despliegue con la siguiente tanda. Runtime previo sigue eef62660 / imagen 20aa1570…, sin nueva comprobación. Main intacto, cero llamadas pagadas, Meta/mapas reales/órdenes externas. Próximo lote: mezcla de interior antes de calle; respuesta de mapa incierta que permita consulta/cambio de carrito y luego aclarar destino sin reiniciar. Después teléfono inválido y actualización conjunta de datos. Los chats están inventariados, no todos sus fallos están resueltos; mantener pendiente la investigación del comprobante vacío y validación reservada real. Entradas inferiores históricas.

## VIGENTE — destino completo y combo con extra desplegados juntos en staging

Código eef626606cbd25e88df93c1ffc390991728e26a4; imagen sha256:20aa157079bc985d7a3745d490a7e6e849f7faded00500aa84d1174e46d07234. Running/healthy a las 00:09:16 UTC del 19/10 (19:09 Bogotá del 18/10); health público OK/DB connected/circuit CLOSED a las 00:09:22 UTC. Probes del compilado: nueve aserciones de destino y seis de combo/extra/dirección, sin red ni órdenes. Rollback ppp-nest-staging:rollback-before-eef62660. Main/producción intactos (imagen c5e97ab1… running). No reconstruir por documentación posterior.

Global 88 suites / 9.289 pruebas en 595.223 s, 379 hashes intactos; 50 focalizados, 90 contratos afectados, TypeScript y 92 Node. Doce conversaciones nuevas, tres menús, seis fallos reales de nombre de conjunto anterior a calle corregidos. Respuesta/carrito/estado/DTO e interrupciones de consulta/contacto/pago comprobados. También incluye c06cc4f5, antes pendiente de despliegue. Evidencias whatsapp-lettered-checkout-validation-1810.json y whatsapp-elliptical-extra-validation-1810.json. Sin suites activas. Cero llamadas pagadas, Meta, mapas reales y órdenes externas.

Límite: se conserva «torre B apartamento 304B» en pedido/DTO pero NO se acredita separar todo interior alfabético de la consulta al mapa; la cotización de conversaciones es simulada. Siguiente lote: separar unidades alfabéticas inequívocas sin mutilar nombres («Casa Blanca», «Torre del Sol»), preservar calle y lugar; probar mapa ambiguo/número distinto, aclaración y edición del carrito durante esa espera. Luego teléfonos inválidos, datos simultáneos y validación reservada con modelo real. El comprobante vacío histórico sigue sin causa atribuida. No declarar piloto listo por conteos. Entradas inferiores históricas.

## VIGENTE — combo, extra abreviado y dirección validados; despliegue agrupado pendiente

Base 7833239c. Global verde: 88 suites / 9.277 pruebas en 598.411 s; 379 hashes intactos. 22 nuevas: 12 conversaciones PPP/sandwich/bowl, agente simulado on/off, con/sin dirección y DTO; diez controles de hash de calle frente a número de orden. Pasan 105 contratos afectados, TypeScript y 92 Node. Evidencia whatsapp-elliptical-extra-validation-1810.json. No hay suites activas.

Corregido: «producto en combo» se normaliza contra un SKU combo único del catálogo; la dirección final delimitada por punto y coma/nueva línea sale del texto de productos; # de calle no activa búsqueda de orden. El extra abreviado y la bebida incluida permanecen. Primer baseline tuvo ID esperado del extra incorrecto y mock de órdenes incompleto; no atribuir esos errores del harness a producción. Los fallos de matching y separación sí fueron reproducidos.

Publicar solo staging; despliegue diferido para agrupar con siguiente tanda. Runtime acreditado sigue 0d69b9c8 / imagen 6c869302… del cierre anterior; no hubo nueva comprobación del servidor. Probe preparado /tmp/ppp-elliptical-extra-compiled-1810.cjs, pendiente ejecutar al desplegar. Main y producción intactos; cero llamadas pagadas, Meta, mapas reales y órdenes externas. Las geocotizaciones/modelos están simulados.

Siguiente tanda: (1) unidades internas con letras: torre B, interior 2A, apartamento 304B; (2) nombre del conjunto antes/después de calle sin recortarlo al barrio; (3) respuesta de mapa con número distinto debe pedir precisión sin sobrescribir el destino; (4) teléfono/nombre junto con pago debe reconocer ambos cambios y retomar cierre. Verificar respuesta/carrito/estado/DTO y no ocultar productos pendientes. Los incidentes del adjunto fueron auditados, no todos reproducidos/corregidos; queda comprobante vacío histórico sin causa acreditada y validación reservada con modelo real. Entradas inferiores históricas.

## VIGENTE — dos preparaciones y opciones desplegadas en staging, 18 de octubre

Global aprobada: 88 suites / 9.255 pruebas en 593.781 s; 379 hashes de fuente intactos. Cuatro fallos iniciales reproducidos y corregidos. 28 pruebas nuevas: cuatro PPP, 16 recorridos de ramen/bowls con DTO simulado exacto y ocho límites de opción/cantidad/nota. Pasan 36 focalizados, TypeScript y 92 contratos Node. Evidencia whatsapp-paired-meals-validation-1810.json. No hay suites activas. Código 0d69b9c8b44caaebfc263eb28bf3b632516ac7b1 desplegado solo staging: imagen sha256:6c869302e592cc4049afb6fa66389186a1b9b4b5ad1e408e98bb33d47abf9e75, running/healthy a las 23:38:43 UTC; /api/health OK, DB connected, circuito CLOSED a las 23:38:49 UTC. Seis aserciones del helper compilado aprobadas; no equivalen a un recorrido completo con modelo real. Rollback ppp-nest-staging:rollback-before-0d69b9c8. Producción sigue con imagen c5e97ab1… running. No reconstruir por este cierre documental.

Regla por catálogo: reconocer uno/otro antes de la agrupación genérica, conservar opciones compartidas y aplicar la siguiente lista etiquetada a dos líneas unitarias. Opciones desconocidas o cantidades ambiguas conservan el carrito y solicitan precisión. No acredita modelo real ni concurrencia; cero llamadas pagadas/Meta/órdenes externas. Main preservada.

Siguiente: reproducir el extra elíptico «porción de francesa» junto a combo/bebida/dirección, con varios menús y respuesta/carrito/estado/DTO; después dirección estructurada y cierre/contacto del plan comercial. La conversión parcial real sigue pendiente. Entradas inferiores históricas.

## VIGENTE — negaciones multilínea corregidas y desplegadas solo staging

Código `9f29f10a680431af4a834e84bb5cd3b3a80256b8`, imagen `sha256:4b30294fa9cce5341db79979f236cf1ff5aab4c0a6f1841d74b8afa0cd25bc88`, running/healthy a las 23:10:50 UTC del 18/10. Health público /api/health OK, DB connected, circuito CLOSED a las 23:10:37 UTC. Cinco controles del catálogo compilado aprobados. Rollback ppp-nest-staging:rollback-before-9f29f10a. Main y producción preservadas (imagen productiva c5e97ab1… running). No reconstruir por documentación posterior.

Global 88 suites / 9.227 pruebas, 607.927 s, 379 hashes intactos. 23 pruebas nuevas: 12 recorridos negativos, seis límites de carrito vacío y cinco controles de segmentación. Pasan 23 focalizados, 123 contratos afectados, TypeScript y 92 contratos Node. Baseline: dos fallos de negación corregidos; cuatro de ejecutivos distribuidos siguen pendientes. No afirmar que modelos reales se probaron ni que el comprobante vacío histórico quedó explicado. Evidencia whatsapp-exclusion-integrity-validation-1810.json. Cero llamadas pagadas/Meta/órdenes externas. No hay suites activas.

Próximo trabajo: corregir reparto de dos ejecutivos (preparación y sopa), luego extra elíptico «porción de francesa» junto con combo/bebida/dirección. Ambos están reproducidos o registrados como pendientes, NO cubiertos por el verde anterior. Conservar respuesta/carrito/estado/DTO en tres menús. Continuar después dirección estructurada y cierre/contacto según plan comercial. Unir/separar mensajes en mocks no acredita concurrencia del transporte real: añadir prueba de intercalado antes de declarar resueltas las ráfagas.

## VALIDADO — negaciones multilínea, 18 de octubre

Global verde: 88 suites / 9.227 pruebas en 607.927 s, 379 hashes intactos. 23 focalizados, 123 contratos afectados, TypeScript y 92 contratos Node. No hay suites activas. Corregido: línea «sin ensalada/salsa» unida a compra no se convierte en producto; 12 conversaciones en tres menús, mensajes unidos/separados, con agente simulado on/off, respuesta, carrito y DTO con notas. Seis controles de carrito vacío y cinco de segmentación. Publicación/despliegue solo staging en curso.

El baseline también reprodujo cuatro fallos de ejecutivos distribuidos; siguen SIN corregir. No incluirlos en métricas verdes. Ejemplo: «dos ejecutivos pierna pernil uno Broaster y otro frito, con limonadas» seguido de «Sopas. 1ajiaco y otra mondongo», unido o separado, produce cantidades/entidades erróneas. Siguiente corrección prioritaria, con catálogo sintético y recorrido completo. La validación de carrito vacío no explica el origen del comprobante #123; requiere traza real de solo lectura.

Nuevo caso aportado durante la global: combo frito con Coca-Cola + «una porción de francesa» + calle/referencia omite extra; corrección explícita posterior sí lo añade manteniendo pago y dirección. Añadir fixture de abreviatura y contabilización de cada cláusula. Resumen/comprobante tienen teléfono distinto pero el fragmento omite mensajes intermedios: no inferir creación sin confirmar ni cambio indebido sin logs. No se editó fuente durante la global. Cero llamadas pagadas/Meta/órdenes externas, Main intacta.

## GLOBAL ACTIVA — exclusiones multilínea e integridad, 18 de octubre

Base 20c9028b; sin otro proceso al comenzar. Baseline de 12 recorridos: seis fallaron (dos por exclusión multilínea, cuatro por ejecutivos). Se corrige solo exclusión: unir la línea «sin …» con el pedido anterior antes de segmentar. Los cuatro fallos de ejecutivos siguen pendientes; reproducción guardada en /tmp/ppp-executive-replay-pending-1810.txt, texto del chat en plan vigente. No convertir esto en una afirmación de que se arreglaron los ejecutivos.

12 recorridos negativos (tres menús, unidos/separados, agente simulado on/off) verifican carrito/respuesta/DTO con nota. Seis controles de carrito vacío en estados carrito/pago/confirmación; cinco de segmentación con compras adicionales positivas. Pasan 23 focalizados + 123 contratos afectados, TypeScript y 92 contratos Node. Primera selección de suites demasiado amplia fue cancelada, no cuenta como validación.

Fuente congelada en /tmp/ppp-exclusion-source-1810.json. Global /tmp/ppp-exclusion-global-1810.{log,json}. No editar fuente ni iniciar suite/despliegue paralelo hasta terminar. Cero llamadas pagadas/Meta/órdenes externas. Main intacta. Siguiente: ejecutivos distribuidos y ráfagas; dirección y cierre según plan comercial vigente.

## PRIORIDAD ACTUALIZADA — auditoría de chats reales del 18 de octubre

Leer primero la sección «Revisión vigente de conversaciones del 18 de octubre» en WHATSAPP-COMMERCIAL-READINESS-PLAN.md: 27 episodios, aciertos, fallos y siete lotes con criterios de salida. Es análisis, sin correcciones ni pruebas nuevas. No marcar los incidentes resueltos por los tests anteriores. Se revisó fd7c4321; el archivo no identifica el commit de los chats.

Se reordena la cola: integridad/orden vacía y negaciones, ráfagas con atributos y datos, dirección estructurada, cierre/contacto, catálogo/contexto, medios y validación reservada. La conversión parcial automática sigue pendiente pero queda detrás de estos fallos de pedido confirmado. Preservar Main; ejecución en staging. Revisar estado/origin y exclusión de otros procesos antes de retomar. No hay suite ni deploy iniciados por esta auditoría.

## VIGENTE — controles de límites parciales ampliados, 18/10/2026 22:47 UTC

Base a71c537c, staging limpio/sin procesos de validación y sincronizado con origin al comenzar. Se añadieron 32 conversaciones gratuitas en menús de arepas y burritos: cero unidades, más unidades de las disponibles, total declarado incompatible y varias líneas candidatas. Se probaron carrito y espera de pago, con agente simulado encendido/apagado. Todas conservan cantidades, notas individuales de plato/bebida y estado; permiten consultar total y cerrar con DTO simulado exacto sin crear orden antes de confirmar.

Pasaron 60 pruebas focalizadas (32 nuevas + 28 controles previos) en 7.957 s y TypeScript. Solo cambian tests y documentación: no hay reglas de ejecución nuevas, no se repitió global ni se reconstruyó/desplegó. Última global acreditada sigue 87 suites / 9.172 casos del código 0a1b7585; NO atribuirle las 32 pruebas nuevas. Último runtime verificado sigue 0a1b7585 / imagen 4c3fc474… a las 22:03:14 UTC; no hubo health nuevo en este despertar. Main preservada, cero API pagada/Meta/mapas/órdenes externas. Presupuesto intacto.

Siguiente objetivo pendiente: implementar conversión parcial real, hoy solo protegida con aclaración. Dividir una línea de cuatro en dos originales y dos combos, absorber exactamente dos botellas compatibles, conservar otras dos con sus notas/sabores, comprobar respuesta/estado/DTO. Añadir caso de alcance igual al total que permita conversión completa; bebidas incompatibles, notas distintas y ambigüedad deben conservarse. Luego unidades internas con letras y formularios etiquetados. Evidencia whatsapp-partial-boundaries-expanded-validation-1810.json. No hay suites activas. Entradas inferiores históricas.

## VIGENTE — protección parcial y aviso de bebidas desplegados en staging, 18/10/2026

Código `0a1b75850e760dab3b5697bf5175658f0e192998`, imagen `sha256:4c3fc474fc3d2a0cd4f3aac79f646f3a32cde4f6e55743524c938603c6631e5e`, running/healthy y /api/health OK, DB connected, circuito CLOSED a las 22:03:14 UTC. Rollback `ppp-nest-staging:rollback-before-0a1b7585`. Probes del compilado de alcance parcial y aviso de bebidas aprobados. Main/producción preservadas (imagen productiva c5e97ab1… running). No reconstruir por este cierre documental.

Global 87 suites / 9.172 pruebas, 573.47 s, 378 hashes intactos; 56 focalizados, TypeScript y 92 contratos Node. Ocho fallos de baseline protegidos. 16 conversaciones nuevas y 12 controles del parser. Cero llamadas pagadas, Meta, mapas reales y órdenes externas; presupuesto intacto. Evidencia: whatsapp-partial-combo-boundary-validation-1810.json y aviso anterior actualizado.

Límite importante: NO convierte automáticamente dos de cuatro a otro SKU combo. Conserva todo y explica la limitación, permitiendo mantener el pedido o convertir explícitamente la línea completa. El siguiente lote debe implementar la división real y conservar cantidades, sabores y notas; antes añadir controles de cero/exceso, total declarado incompatible y varias líneas candidatas. También falta validar formatos de alcance fuera de las dos formas ensayadas; no acreditar comprensión del modelo por mocks. Después unidades internas con letras y formularios etiquetados. No hay suites activas. Entradas inferiores históricas.

## VALIDADO — límite de conversión parcial a combo, 18/10/2026

Global verde: 87 suites / 9.172 pruebas en 573.47 s, 378 hashes intactos. Pasan 56 focalizados, TypeScript y 92 contratos Node. Ocho fallos iniciales de conversión de toda la línea protegidos. 16 conversaciones en dos menús verifican respuesta, carrito, estado, consulta y DTO simulado; 12 controles del parser separan alcance de unidades y cantidades de bebidas.

La conversión automática parcial NO está implementada: se conserva el pedido y se explica que el cambio parcial no pudo aplicarse. El cliente puede mantenerlo o solicitar explícitamente el cambio de toda la línea. Siguiente objetivo: conversión parcial real preservando el resto de platos, bebidas y notas; ampliar controles de cero/exceso y líneas ambiguas.

Publicación/despliegue agrupado con aviso de bebidas aparte en curso, solo staging. Cero llamadas pagadas, Meta, mapas reales y órdenes externas. Main preservada. No declarar mejora de precisión del modelo por estos mocks.

## GLOBAL ACTIVA — protección de conversión parcial a combo, 18/10/2026

Base 9465dbc0. Ocho fallos de baseline reproducidos: una petición limitada podía cambiar toda la línea. Se protege el carrito con aclaración explícita; NO implementa conversión parcial automática. 16 conversaciones completas con dos menús, agente simulado encendido/apagado y estado carrito/pago; 12 controles del parser. Pasan 56 focalizados, TypeScript y 92 contratos Node. Fuente congelada en /tmp/ppp-partial-combo-source-1810.json; no editar ni desplegar durante global /tmp/ppp-partial-combo-global-1810.{log,json}.

Sin API pagada, Meta, mapas reales ni órdenes externas. Main preservada. Aviso anterior de bebidas aparte sigue pendiente de despliegue agrupado. Siguiente: implementar conversión parcial con conservación exacta de unidades/bebidas; esta protección solo evita corrupción.

## VALIDADO — aviso de bebidas aparte; desplegar con la siguiente tanda, 18/10/2026

Código `6c5de4248cad4a4b963c83394902d13a58c8f5f1` publicado en origin/staging. Despliegue pendiente para agrupar con la siguiente tanda; no reconstruir solo por este cierre documental.

Global final de 86 suites / 9.144 pruebas en 570.533 segundos, con 376 hashes intactos. Pasan 58 controles focalizados, TypeScript y 92 contratos Node. No hay suites activas. Se corrigieron 16 fallos de respuesta sin alterar reglas de cálculo ni de conservación del carrito: la conversión a combo enumera las bebidas que siguen aparte con cantidad y sabor. La retirada explícita posterior elimina la bebida suelta y conserva la incluida en el combo.

22 pruebas nuevas: 16 conversaciones completas con dos menús y seis controles del aviso; las conversaciones anteriores de sabores también exigen ausencia del aviso cuando no queda botella aparte. Se verifican respuesta, estado, carrito, consulta de total, corrección, checkout y DTO simulado. Evidencia: `whatsapp-retained-drink-notice-validation-1810.json`. Los servicios/modelos son mocks; no son pruebas reales del modelo.

Despliegue diferido para agrupar esta mejora de respuesta con la siguiente tanda. El último runtime verificado sigue siendo `5693c57b`, imagen `d8d72cc1…`, comprobado a las 20:05:51 UTC; no afirmar que este aviso ya está activo. Queda preparado el probe `/tmp/ppp-retained-drink-notice-compiled-1810.cjs` para ejecutar al desplegar. Main, configuración privada, modelos, bases y volúmenes no se tocaron. Cero llamadas pagadas, Meta y órdenes externas; presupuesto 188/187/1 intacto.

Siguiente: cuatro unidades del plato más cuatro botellas; convertir exactamente dos a combo, conservar dos platos solos y dos botellas. Comprobar cantidades/variantes/DTO, no solo total: el precio podría coincidir incluso con un reparto incorrecto. Si no soporta conversión parcial, aclarar sin convertir las cuatro unidades. La división de atributos del mismo SKU no acredita por sí sola un cambio parcial a otro SKU combo. Después retomar unidades internas con letras y formularios etiquetados. Un solo lote cerrado en este despertar. Entradas inferiores históricas.

## GLOBAL ACTIVA — bebidas que quedan aparte al convertir a combo, 18/10/2026

Base `c617c825`, staging limpio y origin sincronizado al comenzar; no había otra validación/despliegue activo. Se midieron 16 fallos de respuesta: el carrito conservaba correctamente botellas, pero la conversión no las mostraba. La respuesta ahora enumera las bebidas que siguen aparte con cantidad y sabor, sin retirarlas ni abrir una selección que bloquee el checkout. La retirada explícita posterior conserva la bebida incluida en el combo.

22 regresiones nuevas: 16 conversaciones completas en dos menús y seis controles sin mutación. Pasan 58 focalizados, TypeScript y 92 contratos Node. Fuente congelada con 376 hashes en `/tmp/ppp-retained-drink-notice-source-1810.json`. Global `/tmp/ppp-retained-drink-notice-global-1810.{log,json}`. NO editar fuente ni iniciar otra suite/despliegue mientras esté activa. Evidencia `whatsapp-retained-drink-notice-validation-1810.json`. Un primer intento de baseline falló por tipado del test; solo baseline-final mide los 16 fallos reales.

Runtime de staging sigue `5693c57b`; Main `14d9dd84` intacta. Cero llamadas pagadas, Meta u órdenes externas. Después de global verde y hashes iguales: publicar solo staging, agrupar deploy con siguiente tanda si no requiere actualización inmediata. Siguiente: conversión de dos de cuatro unidades y sus bebidas; unidades internas con letras y formularios etiquetados. Entradas inferiores históricas.

## VIGENTE — 18/10/2026, 15:05 Bogotá: sabor al convertir a combo, desplegado solo en staging

Código `5693c57bbe1eaf7e5e4623ca781231fd5b96c791` publicado y desplegado. Imagen activa y candidate: `sha256:d8d72cc159a217a14d03d78b62be9a0bb6c40478bf7c1f07d86dc58bf38b2245`. Contenedor running/healthy; health OK, DB connected, circuito CLOSED a las 20:05:51 UTC. Rollback: `ppp-nest-staging:rollback-before-5693c57b`. Probe compilado de 12 combinaciones de volumen/sabor y probe previo aprobados. Evidencia: `whatsapp-combo-flavour-validation-1810.json`. No reconstruir por documentación posterior.

Ocho fallos iniciales reprodujeron que «Coca Cola 1.5L Zero» se comparaba como la bebida base. Se conserva la validación de tamaño y se omite el volumen únicamente al comparar el sabor seleccionado con la bebida del combo. Una botella distinta no se retira por error; una compatible se incorpora sin duplicarla. Las notas, cantidades adicionales y líneas ambiguas siguen protegidas por los controles previos.

20 regresiones nuevas: ocho conversaciones completas con dos menús y agente configurado encendido/apagado, más doce controles de formatos 1.5L/1,5 litros/1500ml y sabores Original/Ligero. Se comprueban respuesta, carrito, consulta de total sin mutación, checkout y DTO de orden simulada. Pasan 36 focalizados, TypeScript, 92 contratos Node y global de 86 suites / 9.122 pruebas en 580.25 segundos, con 376 hashes intactos. No hay suites activas. Los modelos y servicios externos están simulados: no acredita nueva precisión lingüística ni disponibilidad para venta por conteos.

Main local y producción siguen en `14d9dd84`, imagen productiva `c5e97ab1…` running. Configuración privada, modelos, bases, volúmenes, bin/ y orphan preservados. Cero llamadas pagadas, Meta y órdenes externas; presupuesto 188/187/1 intacto. Este despertar cierra una sola tanda.

Siguiente:
1. Hacer visible una botella retenida por sabor incompatible en la respuesta de conversión y aclarar intención cuando sea ambigua; actualmente el total, carrito final y confirmación protegen esa conservación.
2. Convertir solo dos de cuatro unidades y asignar exactamente sus bebidas, conservando el resto.
3. Retomar unidades internas con letras/cambio de unidad, formularios etiquetados y notas/opciones sobre subconjuntos.
4. Validación reservada del modelo, costo/latencia y mapa real solo en ejecución activa con presupuesto; los despertares programados siguen gratuitos, sin Meta ni órdenes externas.

Las mejoras de dirección, contacto y cierre del lote anterior siguen incluidas. La cobertura real de Villa Galante no queda acreditada por HTTP simulado. Mercado Pago productivo continúa habilitado y staging deshabilitado; el piloto acordado sigue con efectivo y transferencia. Entradas inferiores históricas.

## VALIDADO — sabor de botella al convertir a combo, 18/10/2026

Global final: 86 suites / 9.122 pruebas en 580.25 segundos, 376 hashes intactos. Pasan 36 focalizados, TypeScript, 92 contratos Node y probe local de 12 combinaciones. Ocho fallos iniciales quedaron corregidos. No hay suites activas. Falta publicar/desplegar solo staging y comprobar compilado/health. Runtime aún `3a5a204b`; Main `14d9dd84` intacta. Evidencia `whatsapp-combo-flavour-validation-1810.json`. Cero llamadas pagadas, Meta u órdenes externas; presupuesto 188/187/1 intacto.

Después: explicitar en la respuesta una botella retenida por sabor incompatible y aclarar intención si hace falta; conversión de un subconjunto de unidades; unidades internas con letras, formularios etiquetados y notas por subconjunto. No atribuir nueva precisión al modelo por los mocks. Entradas inferiores históricas.

## GLOBAL ACTIVA — sabor de botella al convertir a combo, 18/10/2026

Base `9e505494`, staging limpio al comenzar y sincronizado con origin. Ocho fallos reprodujeron que el tamaño entre marca y sabor impedía reconocer Zero/Sin Azúcar: se conservaba una botella que debía incluirse o se retiraba otra distinta. Se retira el tamaño solo de la frase usada para comparar sabor, después de validar volumen como antes. No cambia cantidades ni notas.

20 regresiones nuevas: ocho conversaciones completas en dos menús y doce guards de formato de volumen/sabor. Pasan 36 focalizados, TypeScript y 92 contratos Node. Fuente congelada con 376 hashes en `/tmp/ppp-combo-flavour-source-1810.json`. Global `/tmp/ppp-combo-flavour-global-1810.{log,json}`. NO editar fuente ni iniciar otra suite/despliegue mientras esté activa. Evidencia `whatsapp-combo-flavour-validation-1810.json`.

Runtime de staging sigue `3a5a204b`; este cambio aún no está desplegado. Main `14d9dd84` preservada. Cero llamadas pagadas, Meta y órdenes externas; presupuesto 188/187/1 intacto. Tras global verde y hashes iguales: publicar solo staging; agrupar despliegue si la verificación lo permite, con rollback, compilado y health. Después: unidades con letras y cambios de unidad, formularios etiquetados y notas sobre subconjuntos. Entradas inferiores históricas.

## VIGENTE — 18/10/2026, 14:49 Bogotá: lote desplegado solo en staging

Código `3a5a204badc1e24fb438c845d2cf13a6cb65f872` publicado y desplegado. Imagen activa y candidate iguales: `sha256:6890143f77da7d69f5c245c97010804d02b17643275ad726df644c358d5d970f`. Contenedor running/healthy; health OK, DB connected y circuito CLOSED a las 19:49:22 UTC. Rollback: `ppp-nest-staging:rollback-before-3a5a204b`. Los commits posteriores de documentación no requieren reconstrucción.

Validación final: 86 suites / 9.102 pruebas en 566.854 segundos, con 376 hashes de fuente intactos; TypeScript y 50 controles de la última ampliación aprobados. El lote anterior aportó 516 controles focalizados, 21 de reparación y 92 contratos Node. El checkpoint `29da6788` aprobó su global de 9.074 pruebas antes de añadir las abreviaturas. Las dos globales fallidas de cierre se corrigieron antes de publicar y no cuentan como aprobación. Pasaron los probes del compilado actual y los controles previos de herramientas y notas. El router completo se verifica en TypeScript con servicios simulados; estos resultados no acreditan inferencia, geocodificación ni entrega de WhatsApp reales.

Cambios acreditados:
- Actualizar teléfono reconoce el cambio antes de retomar el pago; nombre y pago pueden llegar juntos.
- Un formulario completo conserva compra, destinatario, teléfono, dirección y pago explícito. El formato admitido sigue siendo acotado.
- Una bebida explícita junto a un plato sin bebida incluida se conserva. La conversión explícita a combo puede absorber una única botella compatible, de cantidad y tamaño documentados; las ambiguas o adicionales se conservan.
- El mapa busca el destino separado de entrada, torre y apartamento numéricos. Los detalles siguen en la orden simulada. Repetir un lugar rechazado no lo convierte en una unidad interna ni evita validar cobertura.
- `Tv` sin punto ya pasaba en staging. Se corrigieron `Tv.` y `Kr`, y se probaron cuatro formas de dirección con dos menús, ráfagas del coalescer, mensajes separados, dirección guardada antigua y DTO final simulado. No se crea orden al elegir pago sin confirmación final.

Main local y producción siguen en `14d9dd84`; imagen productiva `c5e97ab1…` running. Este lote no se promovió. Configuración privada, modelos, bases, volúmenes, bin/ y orphan preservados. Cero llamadas pagadas, Meta y órdenes externas; presupuesto 188/187/1 intacto. La auditoría de contacto productivo encontró una respuesta no vacía con ID de Meta a los dos segundos; no acredita su renderizado en el dispositivo. El último fragmento humano omite mensajes de pago y confirmación: no inferir una orden indebida solo de ese recorte.

Siguiente tanda:
1. Original/Zero al convertir a combo; botellas con notas, cantidades distintas o selección ambigua.
2. Unidades con letras, bloque B, cambio de unidad y detalles antes del conjunto.
3. Formularios con etiquetas Teléfono/Nombre y distinto orden de campos, conservando cláusulas desconocidas.
4. Opciones y notas sobre subconjuntos; retirar una cláusula sin borrar las demás.
5. Conversaciones completas reservadas con modelo real, costo y latencia; mapa real bajo presupuesto de ejecución activa. Los despertares programados siguen gratuitos, sin Meta ni órdenes externas.

No acreditar cobertura real de Villa Galante por HTTP simulado ni preparación comercial por conteos. Mercado Pago productivo sigue habilitado y staging deshabilitado: auditoría de lectura, sin cambio de configuración. El piloto acordado sigue con efectivo y transferencia. Evidencias: `whatsapp-sales-closure-validation-1810.json` y `whatsapp-fresh-street-validation-1810.json`. Las entradas inferiores son históricas.

## VALIDADO — listo para publicar y desplegar SOLO staging, 18/10/2026

Global final86suites/9102tests en566.854s,376hashes intactos;50controles de abreviaturas/rutas yTypeScript,92Node previos y probes locales actuales aprobados. Incluye checkpoint29da6788 con cierre/datos/bebidas/unidades. No hay suites activas. Falta publicar/desplegar y verificar compilado/health. Staging vivo aúnbd23e68d;Main14d9dd84 preservada. Ver whatsapp-fresh-street-validation-1810.json y whatsapp-sales-closure-validation-1810.json. SSH tuvo timeout transitorio y se recuperó;health público responde. No afirmar ya desplegado hasta cierre. CeroAPIpagada/Meta/órdenes externas. Entradas inferiores históricas.

## GLOBAL ACTIVA — direcciones abreviadas en ráfagas, 18/10/2026

Checkpoint anterior29da6788 validado global86suites/9074tests,NO desplegado aún. Nuevo chatTv:forma sin punto ya pasaba;8fallos conTv./Kr frente a8verdes iniciales. Normalización acotada a dirección numerada completa,28tests nuevos,50focalizados yTypeScript verdes. Fuente congelada 376hashes /tmp/ppp-fresh-street-source-1810.json. Global /tmp/ppp-fresh-street-global-1810.{log,json}. NO editar fuente ni lanzar otra suite/deploy hasta cierre. Ver whatsapp-fresh-street-validation-1810.json. Tras verde+hashes publicar ambos commits/desplegar SOLO staging y verificar compilado/health/rollback. Runtime siguebd23e68d,Main14d9dd84 preservada. CeroAPIpagada/Meta/órdenes externas. Entradas inferiores históricas.

## LOTE VALIDADO LOCAL — cierre, bebidas y unidades, 18/10/2026

Global final86suites/9074tests en575.345s aprobada,376hashes intactos;516focalizados,21controles finales,TypeScript,92Node y probe local verdes. Dos globales fallidas previas documentadas;solo repaired-global es aceptación. No desplegado aún;staging vivo bd23e68d,Main14d9dd84 preservada. Evidencia whatsapp-sales-closure-validation-1810.json. Se guarda checkpoint antes de reproducir nuevo chat humano de ráfaga conTv78C#6D-48. No hay global activa al escribir esta entrada. Agrupar deploy SOLO staging al cerrar esa reproducción. Auditoría productiva de contacto:respuesta121caracteres conidMeta a2s;no acredita renderizado en dispositivo. CeroAPIpagada/Meta/órdenes externas. Entradas inferiores históricas.

## GLOBAL ACTIVA FINAL — fuente reparada, 18/10/2026

21controles finales (incluyen los dos pedidos largos que fallaron) yTypeScript verdes,además de516focalizados/92Node previos. Fuente congelada 376hashes /tmp/ppp-sales-location-repaired-source-1810.json. Global /tmp/ppp-sales-location-repaired-global-1810.{log,json}. NO editar fuente ni lanzar otra suite/deploy hasta terminar. Dos globales de cierre fallidas documentadas,NO son aceptación. Staging activo bd23e68d,Main14d9dd84 intacta. Tras global verde/hashes iguales:probe local,publicar/desplegar SOLO staging,probe compilado/health/rollback y cierre documental. Ver whatsapp-sales-closure-validation-1810.json. CeroAPIpagada/Meta/órdenes externas. Entradas inferiores históricas.

## GLOBAL TERMINADA CON 2 FALLOS — alcance del pedido largo, 18/10/2026

Segunda global86suites/9074tests:9072verdes y2fallos en pedido largo con arroz con pollo;no publicar/desplegar. El separador de bebida aceptaba bebida enterrada después de otro plato/nota. Se exige prefijo de bebida resuelta y cláusula derecha sin punto y coma/salto de línea. Se conservan tests existentes;validar focalizados y repetir global con nueva fuente congelada. No hay global activa al escribir esta entrada. Main/staging vivo intactos. Evidencia whatsapp-sales-closure-validation-1810.json. Entradas inferiores históricas.

## GLOBAL ACTIVA — cierre, bebidas y unidades de dirección, 18/10/2026

516focalizados/7suites,TypeScript y92Node aprobados. Fuente congelada 376hashes /tmp/ppp-sales-location-frozen-source-1810.json. Global /tmp/ppp-sales-location-accepted-global-1810.{log,json}. NO editar fuente ni lanzar otra suite/deploy hasta terminar. Primera global de cierre falló87tests (contacto absorbía direcciones/códigos); corregido,484regresiones previas pasan. Esta nueva global debe aprobar completa. Staging vivo bd23e68d,Main14d9dd84 preservada;no publicado/desplegado. Ver whatsapp-sales-closure-validation-1810.json. Incluye bebida explícita+extras,conversión combo sin duplicar botella compatible,contacto reconocido y lugar separado de entrada/apto para mapa/DTO. Silencio productivo del último chat no tiene causa confirmada sin trazas. CeroAPIpagada/Meta/órdenes externas. Tras verde+hashes:publicar/desplegar SOLO staging con rollback,probe compilado y health. Entradas inferiores históricas.

## GLOBAL FALLIDA — corrección de contacto en revisión, 18/10/2026

Global terminada:84suites,83verdes/1fallida;8950verdes/87fallos. NO publicar/desplegar. Se detectó detección temprana de contacto demasiado amplia: absorbía direcciones con múltiples números y texto de imagen con códigos. Se acota a mensaje text y forma completa numérica/con etiqueta de contacto. Fuente descongelada para corregir; repetir afectados y global antes de aceptación. Registro whatsapp-sales-closure-validation-1810.json. Staging vivo bd23e68d,Main intacta. Nuevo chat humano: revisar bebida explícita junto a pollo/extras y teléfono durante pago;no atribuir el silencio observado a una causa sin trazas.

## GLOBAL ACTIVA — cierre de venta agrupado, 18/10/2026

125 focalizados, TypeScript y92Node aprobados. Fuente congelada con373hashes en /tmp/ppp-sales-closure-source-1810.json. Global /tmp/ppp-sales-closure-global-1810.{log,json}. NO editar fuente ni lanzar otra suite/despliegue hasta terminar; verificar proceso y resultado real. Dos globales previas interrumpidas NO son aprobación. Evidencia whatsapp-sales-closure-validation-1810.json. No publicado/desplegado aún; staging vivo bd23e68d, Main14d9dd84 intacta. Cero API pagada/Meta/órdenes externas. Después de verde y hashes iguales: publicar/desplegar SOLO staging con rollback y probe compilado/health.

## EN CURSO — cierre de venta y datos compuestos, 18/10/2026

Fuente local no publicada sobre c894687e. Se agrupan opción canónica y cierre de venta: contacto, nombre+pago, formulario multilinea de productos/destinatario/dirección/teléfono, nota de empaque y dirección numerada con referencia. Las dos globales de opción canónica se interrumpieron con exit130 ANTES de editar; no son aceptación. No hay global activa al escribir esta entrada. Antes de publicar ejecutar controles finales, TypeScript, Node y UNA global con hashes congelados. No desplegar esta fuente hasta aprobarla.

El teléfono del último chat sí persistía: la corrección del usuario aclara que faltó responder una consulta. La consulta exacta NO está en el fragmento y NO se declara reproducida; se comprueba una consulta de total durante pago con carrito/estado conservados y DTO simulado. No hay llamadas pagadas, Meta ni órdenes externas. Producción/Main preservadas; staging activo sigue bd23e68d. Auditoría de configuración: MP productivo habilitado y staging deshabilitado; no se modificó configuración. Efectivo/transferencia siguen alcance del piloto. Ver próximo registro whatsapp-sales-closure-validation-1810.json. Entradas inferiores históricas.

## Global vigente — opción canónica y prefijos, 18/10/2026

La primera global se detuvo (exit130, sin editar durante ejecución) para reproducir un fallo adicional: opción corta ganaba a una más larga del mismo prefijo. Ahora 11 tests nuevos y 127 focalizados verdes; prioridad a opción completa más larga sin mutar catálogo. TypeScript verde. Global vigente /tmp/ppp-canonical-degree-final-global-1810.{log,json}, manifest final-source con370hashes congelados. No editar fuente ni lanzar otra suite/deploy. Runtime continúa bd23e68d; Main intacta. Cierre previsto: publicar validado solo staging, agrupar deploy con siguiente tanda. No atribuir éxito a la global interrumpida. Evidencia whatsapp-canonical-degree-validation-1810.json.

## EN CURSO — 18/10/2026: opción canónica en frase completa

Base c894687e. Seis fallos reprodujeron que «Quiero dos… con Estilo No Tan Picante/Dulce/Salado» elegía Natural en vez de la opción literal. La prioridad literal ahora admite la frase explícita con+atributo+opción y conserva rechazo/preferencia suelta. Diez pruebas nuevas: seis conversaciones router→precio→DTO en tres menús y cuatro controles de catálogo. 126 focalizados, TypeScript y 92 Node aprobados. Global EN CURSO /tmp/ppp-canonical-degree-global-1810.{log,json}, 370 hashes congelados: NO editar fuente ni iniciar otra suite/deploy hasta cierre. Evidencia whatsapp-canonical-degree-validation-1810.json. Main/producción/modelos/presupuesto intactos; cero API pagada/Meta/órdenes externas.

Después: «menos dulce»/«sin tanto azúcar», cambios sobre subconjuntos y retirada de una cláusula de nota. No afirmar cubiertos por estas compras iniciales; no garantizar preparación ni comprensión universal. Publicar solo staging tras global verde; agrupar despliegue si no hay otro cambio urgente. Entradas inferiores históricas.

## VIGENTE — 18/10/2026, 13:04 Bogotá: opciones e intensidad desplegadas en staging

Código `bd23e68d5641820bb3d5624b16c3e563c1c1241d` publicado y desplegado solo en staging. Imagen activa = candidate `sha256:506ac358710a356e6312f065e6c52cbd2c86b7e0d1646fc86c7138cd1561368e`; contenedor running/healthy y health OK, DB connected, circuito CLOSED a las 18:03:52 UTC. La primera inspección dio starting; únicamente la comprobación posterior acredita healthy. Rollback `ppp-nest-staging:rollback-before-bd23e68d`. Probe compilado aprobado: seis propuestas deliberadamente contradictorias del modelo se corrigen desde la fuente y conservan nota, además de los controles previos. Evidencia `whatsapp-intensity-options-validation-1810.json`.

29 regresiones nuevas: 12 conversaciones router → consulta de precio → DTO simulado en tres menús, 11 controles catálogo/helper y seis herramientas reales sin nota propuesta por modelo. 111 focalizados, TypeScript, 92 Node y global final de 82 suites / 8.963 pruebas en 1585.882 s; 370 hashes intactos. La global válida es `accepted-global`; la anterior fue interrumpida con exit 130 antes de editar y no cuenta como aprobación. No es inferencia real ni acredita precisión ASR o cumplimiento en cocina. Cero API pagada, Meta y órdenes externas; presupuesto 188/187/1 sin cambios.

Main y producción sí recibieron la mejora ANTERIOR de intensidad por petición del usuario: HEAD `14d9dd84`, imagen productiva `c5e97ab1…`, running; comprobados de nuevo al cerrar. Esta tanda nueva no se promovió. Modelos, configuración privada, bases, volúmenes, bin/ y orphan preservados. No reconstruir por documentación.

SIGUIENTE: reproducir frases completas con opción canónica «No Tan Picante» (el control actual solo prueba la respuesta literal sola); luego «menos dulce»/«sin tanto azúcar», preferencias sobre subconjuntos existentes y retirada de una cláusula conservando otras. Reanudar con menús variados, respuesta/carrito/estado/DTO y controles de consultas durante checkout. Las compras iniciales actuales no acreditan esos recorridos. Mantener staging permanente y no promover nuevas tandas a Main sin solicitud. Reservadas reales, costo/latencia y supervisión siguen pendientes para decidir piloto. Entradas inferiores históricas.

## Tanda validada — 18/10/2026: opciones y preferencias, solo staging

29regresiones nuevas,111focalizados,TypeScript,92Node y global82suites/8963tests en1585.882s aprobados.370hashes intactos. Global válida es accepted-global;la anterior interrumpida exit130 NO es aceptación. Probe de herramientas reales/catálogo/adaptador contra TS local también pasó,con6propuestas deliberadamente contradictorias y nota omitida por modelo. Falta deploy/compiled/health de esta fuente;no asumir activo hasta cierre. Evidencia whatsapp-intensity-options-validation-1810.json.

Publicar/desplegar una vez SOLO staging. Main quedó14d9dd84 y producción ejecuta la mejora anterior e8cdfc2b,c5e97ab1…por autorización del usuario. CeroAPIpagada/Meta/órdenes externas,presupuesto188/187/1 intacto. Después:frases completas con opción canónica «No Tan Picante» (control actual solo respuesta literal sola),menos dulce/sin tanto azúcar,subconjuntos ya existentes y retiro de una cláusula conservando otras. No atribuir a estos mocks nueva precisión del modelo ni cumplimiento de cocina. Entradas inferiores históricas.

## Global reiniciada — 18/10/2026: nota de intensidad en herramienta real

La primera global se detuvo conSIGINT/exit130 antes de editar:lectura del tool mostró recuperación de nota incompleta tras opción explícita.6pruebas directas nuevas reprodujeron2fallos;arreglado con recuperación acotada de la cláusula de intensidad,sin rehacer otras notas. Ahora29regresiones nuevas y111focalizados aprobados,TypeScript verde. Global vigente /tmp/ppp-intensity-options-accepted-global-1810.{log,json},manifest accepted-source,370hashes congelados. NO editar fuente/otra suite/deploy hasta terminar. La global anterior interrumpida NO acredita aprobación. Main/producción preservados;solo esta fuente nueva continúa en staging. Presupuesto188/187/1 intacto.

## EN CURSO — 18/10/2026: preferencia frente a opción configurable

Base14d9dd84. La mejora anterior de intensidad YA está en Main/producción por solicitud del usuario;ver entrada siguiente. Nueva tanda SOLO staging:10fallos/2verdes iniciales reprodujeron elección accidental de Picante/Dulce o pérdida de nota después de una elección explícita. Separador acotado retira solo la preferencia de intensidad del texto usado para elegir opciones y conserva la nota original. Opción explícita anterior permanece;nombre literal completo de opción sigue válido.

23regresiones nuevas:12router→consulta→DTO en3menús y11helper/catálogo.105focalizados,TypeScript y92Node pasan;una coma residual se corrigió antes del run final. Global EN CURSO /tmp/ppp-intensity-options-global-1810.{log,json},370hashes congelados. NO editar fuente ni iniciar otra suite/deploy. Evidencia whatsapp-intensity-options-validation-1810.json. No promover esta tanda a Main automáticamente. CeroAPIpagada/Meta/órdenes externas;188/187/1 intacto.

Después:menos dulce/sin tanto azúcar,preferencias de unidades ya existentes,retirada de una cláusula conservando otras y referencias/consultas en checkout. Las12conversaciones actuales son compras iniciales,no acreditan esos casos. No garantizar cumplimiento en cocina ni comprensión universal. Entradas inferiores históricas.

## VIGENTE — 18/10/2026,12:22 Bogotá: intensidad promovida a producción

Por solicitud explícita del usuario,Main actualizado a e8cdfc2b y backend productivo desplegado. Código validado07a2416a;imagen productiva c5e97ab1f09502b3a64a73fb332665395f9e6054349b7195bc3d58081bf4559e,running,health OK/DB connected/circuit CLOSED a17:21:51UTC. Probe compilado de intensidad/herramientas/catálogo/adapter aprobado;sin inferencia ni pedidos externos. Rollback ppp-nest-api:rollback-before-e8cdfc2b. Configuración privada/compose/artefactos locales preservados,sin cambio de modelos. Evidencia whatsapp-intensity-validation-1810.json. Staging mantiene runtime07a2416a,healthy139d8378…;no reconstruir por docs.

CONTINUAR SOLO EN STAGING:preferencia negativa frente a opciones configurables,menos dulce/sin tanto azúcar,subconjuntos y retiro de una cláusula. Global previa82suites/8934tests con370hashes intactos. No acreditar comprensión real por mocks ni promover nuevas tandas a Main sin nueva solicitud. Presupuesto188/187/1 sin cambios. Entradas inferiores históricas.

## VIGENTE — 18/10/2026,12:14 Bogotá: intensidad desplegada SOLO en staging

Código07a2416a99db0e16d25b57c6ef4b3bc3556fe305 publicado y desplegado en staging. Contenedor running/healthy,imagen activa=candidate sha256:139d8378e76d26da0348361001a2ae6881635222ed464c4248e90da8bcee725f. Health OK/DB connected/circuit CLOSED a17:13:51UTC. Rollback ppp-nest-staging:rollback-before-07a2416a. Compilado acredita extracción y herramientas reales en6menús,además del adaptador/guards previos;router completo probado en TS con dependencias simuladas. Evidencia whatsapp-intensity-validation-1810.json. No reconstruir por este cierre documental.

12fallos iniciales→45regresiones nuevas:12conversaciones de intensidad con precio intermedio/DTO final,10SKU con adjetivos en nombre,23helper.82focalizados,TypeScript,92Node y global82suites/8934tests en943.587s aprobados,370hashes intactos. Gramática acotada dulce/picante/salado/ácido/grasoso con nota literal;sin excepciones por restaurante. No es nueva precisión de modelo/ASR ni garantía de preparación. CeroAPIpagada/Meta/órdenes externas;188/187/1 intacto. Main queda76a412b2,código productivoe46996fa;modelos/configuración privada/bases/volúmenes/bin/orphan preservados.

PRÓXIMA TANDA:preferencias negativas frente a atributos seleccionables (ej.Salsa Picante/Suave),«menos dulce»/«sin tanto azúcar»,retirada de una cláusula y conservación de las restantes. Después subconjuntos con variantes/nota y consultas durante checkout,menús variados. No asumir cubiertos por los6menús actuales sin atributos. Inferencia real reservada,costo/latencia y conversaciones completas siguen pendientes antes de acreditar piloto. Automatización gratuita y solo staging;no promover Main sin nueva solicitud. Entradas inferiores históricas.

## Tanda validada — 18/10/2026: intensidad pendiente de deploy solo staging

45regresiones nuevas;82focalizados,TypeScript,92Node y global82suites/8934tests en943.587s aprobados.370hashes idénticos antes/después. Probe de herramientas/catálogo/adaptador pasó contra TS local; falta ejecutarlo compilado tras deploy. Evidencia whatsapp-intensity-validation-1810.json. Base76a412b2;Main/producción intactos. Publicar/desplegar una vez únicamente staging con rollback/health/compiled, cerrar con SHA e imagen. CeroAPIpagada/Meta/órdenes externas;188/187/1 intacto.

Siguiente tanda:preferencias de intensidad negativas frente a atributos seleccionables (evitar convertir «no tan picante» en elección de Picante), «menos dulce»/«sin tanto azúcar», y retirada de una cláusula de nota conservando las otras. Añadir variantes/correcciones por subconjunto y consultas durante checkout,con menús variados. La mejora actual conserva notas literales en seis menús sin atributos;no prometer cobertura universal ni cumplimiento en cocina. Entradas inferiores históricas.

## EN CURSO — 18/10/2026: intensidad entre restaurantes, solo staging

Base76a412b2.12fallos reproducidos con flan/café/ramen/curry/limonada/tostada: «no tan dulce», «que no esté tan salado», etc., tratados como nombre de plato o rechazados por tool. Gramática acotada ahora reconoce intensidad dulce/picante/salado/ácido/grasoso conservando nota literal.45regresiones nuevas:12router→consulta precio→DTO,10SKU completos,23helper.82focalizados,TypeScript y92Node verdes. Global EN CURSO,370hashes congelados,/tmp/ppp-intensity-global-1810.{log,json}. NO editar fuente ni iniciar otra suite/deploy hasta cierre. Evidencia whatsapp-intensity-validation-1810.json.

Main/producción intactos en código e46996fa;no volver a promover esta tanda automáticamente. Agrupar staging cuando esté validado. CeroAPIpagada/Meta/órdenes externas;188/187/1 intacto. Tests con menú sin atributos no acreditan interacción entre preferencia negativa y opción seleccionable (ej. Salsa Picante/Suave), ni menos dulce/sin tanto azúcar;son próximas prioridades. No prometer cumplimiento de notas ni seguridad alimentaria. Entradas inferiores históricas.

## VIGENTE — 18/10/2026, 11:52 Bogotá: Main y staging desplegados

El usuario autorizó promoción y deploy productivo. Código e46996fae72639d8a924298b8b448a16f05d0f29 publicado en Main/staging y desplegado en ambos. Producción ppp_nest_api running, health OK/DB connected/circuit CLOSED (16:51:01UTC); imagen6e71bc54… Staging running/healthy, imagen activa=candidate cc1c4ce3… y health OK (16:51:56UTC). Evidencia exacta en whatsapp-main-promotion-1810.json. Los cuatro módulos compilados comprobados coinciden; no se comparó binariamente todo el backend.

Se alinearon los cuatro modelos en .env privado productivo con staging: agente gpt-6.1-sol, visión/assist gpt-6-luna, audio gpt-transcribe. Backup privado .env.before-model-parity-e46996fa; compose productivo intacto. Rollbacks ppp-nest-api:rollback-before-e46996fa y ppp-nest-staging:rollback-before-e46996fa. Preservados454artefactos modificados y18no versionados de Main local, archivos privados/bases/volúmenes/orphan. No frontend para subir a Hostinger.

Global final82suites/8889tests en947.954s,370hashes intactos;TypeScript,72Node,controles focalizados y probes compilados aprobados. Primer global falló en3notas ají+sin arepa: reparado antes de promoción. No son llamadas reales del modelo ni evidencia universal de venta. CeroAPIpagada/Meta/órdenes externas;presupuesto188/187/1 intacto.

CONTINUAR SOLO EN STAGING, rama permanente conservada. No reconstruir por esta documentación. Próxima tanda: matriz de dulzor/picante/sal/grasa/temperatura/textura entre restaurantes, preferencias por subconjunto y retiro de una cláusula de nota; conversaciones completas reservadas/costo/latencia antes de acreditar piloto. Ver whatsapp-next-batches.md. La lista es plan de pruebas, no soporte ya acreditado. Entradas inferiores históricas.

## Global cerrada — 18/10/2026: preparada promoción Main autorizada

82 suites / 8.889 pruebas aprobadas en 947.954s; 370 hashes de fuente intactos. TypeScript, 72 contratos Node y controles focalizados acreditados en whatsapp-kitchen-description-validation-1810.json. La primera global detectó 3 pérdidas de ají: corregidas y verificadas antes de esta aceptación. Cero API pagada/Meta/órdenes externas. Ahora publicar staging, avanzar Main sin alterar artefactos locales, desplegar ambos backends con rollback/modelos iguales y verificar. Estado EN CURSO: no asumir desplegado hasta cierre con SHA e imagen. Después continuar matriz de preferencias variadas. Entradas inferiores históricas.

## Promoción solicitada por el usuario — 18/10/2026

El usuario autorizó integrar todo en Main y desplegar producción, conservando staging. Global final en curso: no editar fuente ni lanzar otra suite. La primera global de notas detectó tres pérdidas de ají con sin arepa; se corrigió combinando la nota completa del mensaje con la descripción extraída. Los 37 controles router afectados pasan, TypeScript pasa. Fuente congelada de 370 archivos; esta global usa dos workers. Publicar/promover/desplegar solo si queda verde. Conservar dist local de Main, compose productivo modificado, archivos privados y volúmenes.

## Plan posterior: preferencias reutilizables entre restaurantes

La lista es una matriz de comportamientos y fixtures, no un diccionario de excepciones por plato. Implementar y medir por familias, con menús ficticios y casos reservados que no se usen para ajustar reglas.

1. Intensidad: menos dulce/sin tanto azúcar, suave/no tan picante, poca sal/no tan salado, menos ácido, poca grasa/no tan grasoso. Menús de café, jugos, postres, mexicano, asiático y parrilla. Distinguir opción válida, nota y pregunta sobre preparación; no prometer que cocina pueda cumplirla.
2. Textura, corte y temperatura: dorado/crujiente/no seco, delgado/no tan grueso, bien caliente, poco hielo. Proteger nombres completos de catálogo que contienen estos adjetivos y no absorber bebidas u otros adicionales.
3. Alcance por unidades: cuatro productos, dos con una preferencia y dos con otra; una nota compartida y otra exclusiva; cambiar solo un grupo; retirar una cláusula conservando el resto. Verificar cantidades, precio, atributos y notas en cada unidad del DTO simulado.
4. Contexto: nota inicial, después de elegir variante, tras consulta informativa, durante nombre/dirección/pago/confirmación. Responder consultas sin bloquear el paso pendiente ni convertirlas en datos del cliente.
5. Corrección y límites: «normal», «mejor no», referencia ambigua, opción inexistente, adicional pagado frente a preferencia, negación y compras nuevas en la misma frase. Las alergias/restricciones no se convierten en garantías de ausencia o seguridad.
6. Conversaciones completas: saludo/carta → compra → variantes/notas → corrección → dirección → pago → confirmación simulada. Rotar panadería, hamburguesería, vegetariano, parrilla, cocina asiática, cafetería y postres; probar tanto reglas como herramientas del agente con respuestas simuladas.

Cada tanda requiere reproducir antes de corregir, oráculos sobre respuesta/carrito/estado/DTO y controles contra compras indebidas. Los mocks no miden comprensión del modelo ni ASR real. Después de contratos verdes, evaluar un conjunto reservado pequeño con límite de gasto, costo por conversación y latencia. El piloto supervisado necesita recuperación clara, ausencia de mutaciones silenciosas y trazabilidad; los conteos de tests no acreditan venta universal.

## Global en curso — 18/10/2026: notas de grosor/presentación/cocción

Base local de1479d1 (compra+precio ya validada, no desplegada).28fallos reprodujeron notas tratadas como productos o perdidas tras elegir.56regresiones nuevas:24router→DTO,4familias ambiguas→elección→DTO,6nombres de catálogo y22unitarios.322focalizados,TypeScript y72Node pasan. Global EN CURSO con370hashes congelados;no editar/lanzar otra suite. No confundir con global8833 de la base anterior. Runtime sigue190c6c86;desplegar agrupado solo después del cierre final.

Reglas generales: descripción acotada con ancla de catálogo, nota literal sin promesa de cumplimiento; no absorber otros productos/direcciones/preguntas; conservar la nota original durante una elección de presentación. Un nombre completo de catálogo tiene prioridad sobre un hermano genérico. El helper tolera una errata solo para clasificar adjetivos;no reescribe palabras del usuario.

Audio original de pollos revisado por Kinocut/Whisper tiny local sin API pagada. El resultado recoge cantidad2 e insistencia en cocción, pero tiene errores y NO es ground truth humano ni prueba del GPT Transcribe desplegado. Evidencia whatsapp-kitchen-description-validation-1810.json. Archivo original privado, sin commit ni envío externo WhatsApp.

Siguiente tras cierre: preparaciones combinadas con compras adicionales independientes (no solo controles unitarios de no absorción), notas de varias unidades y elección después de una consulta; orden inverso de compra+precio y detalles no documentados. Reservadas reales/costo/latencia pendientes del piloto. Main y presupuesto intactos; no declarar vendible por conteos.

## Tanda validada, pendiente de despliegue agrupado — 18/10/2026: compra distribuida seguida de consulta de precio

Base c649368d.18recorridos reprodujeron question_not_order. Contrato interno verifiedDistributedProductId solo sale del reparto fuente validado, no de argumentos del modelo; tool exige compra afirmativa literal, anfitrión de catálogo y consulta de precio posterior. El adaptador conserva validación de grupos completa y atomicidad. No relaja preguntas puras, permisos, negaciones ni condiciones. Prompt explica compra+consulta.

45regresiones nuevas:18recorridos router→DTO en3menús/3estados/2preguntas,24rechazos de herramientas y3bucles runTurn con HTTP íntegramente simulado.198focalizados,TypeScript y72Node pasan;global aprobada:81suites/8833tests en1044.429s,368hashes intactos. La fuente puede cambiar ahora para la tanda de notas;no reconstruir aún. Evidencia whatsapp-mixed-price-validation-1810.json. Runtime todavía190c6c86;no asumir desplegado. Los6rechazos previos ahora se llaman Untrusted mixed... y omiten la capacidad deliberadamente;no representan fallo del camino autorizado.

CASO NUEVO DEL USUARIO, prioridad tras cerrar la global actual: audio reconstruido «quiero una sobrebarriga dorada, bien bonita que no esté tan gorda» (usuario también escribió dorda/torda). El bot separó «que no esté tan gorda» como producto no disponible y conservó solo dorada. Reproducir con router/tool y varios catálogos: preferencias de grosor/presentación como nota del plato, sin garantizar cumplimiento ni ocultar una compra adicional. No hay audio original en este mensaje: la nueva prueba será textual/transcripción reconstruida, no precisión ASR.

SIGUIENTE: orden inverso de cláusulas (pregunta antes de compra), variación de cortesía/verbos y compras mixtas no distribuidas;no ampliar la excepción sin contrato completo. Luego retirada de una cláusula de nota,productos sin atributos y preguntas sobre detalles no documentados. Conversaciones reservadas reales/costo/latencia siguen pendientes;esta tanda gratuita no los acredita. Main/modelos/presupuesto intactos.

## Cierre vigente — 18/10/2026, 08:19 Bogotá

Staging 190c6c86 desplegado/verificado, running/healthy, imagen activa=candidate826391cb…, health ok/DB connected/circuit CLOSED. Incluye b1529b5f y consultas contadas.84regresiones nuevas;153focalizados,TypeScript,72Node y global81suites/8788tests en592.772s,368hashes intactos. Evidencia whatsapp-group-inquiries-validation-1810.json. Main/modelos/bases/volúmenes/archivos privados preservados; ceroAPIpagada/Meta/órdenes externas. No repetir esta tanda ni reconstruir por docs.

PRÓXIMA TANDA: compra explícita + pregunta precio en la misma frase. Fallo confirmado: add_item devuelve question_not_order;6controles actuales esperan rechazo seguro, NO éxito. Diseñar propiedad de intención por cláusula, host de catálogo y reparto verificado; preservar precio puro como read-only, negaciones y atomicidad. Probar variación de menús, orden de cláusulas y checkout, con respuesta/carrito/estado/DTO. No convertir cualquier pregunta que menciona un producto en autorización de compra. Después: retirada de una cláusula de nota, productos sin atributos y detalles de catálogo desconocidos en consultas contadas. Reservadas reales/costo/latencia pendientes del piloto; esta automatización no hace llamadas pagadas. Fuente limpia y una tanda por despertar, según AGENTS.

## Tanda validada, pendiente de despliegue agrupado — 18/10/2026: consultas con variantes contadas

Base b1529b5f. Baseline54fallos: consultas de precio/contenido/disponibilidad entraban al contrato de compra. Se responde desde catálogo, sin agente ni mutaciones, y se conserva paso/selección pendiente. Cotización muestra precio unitario y estimado por cantidad, sin domicilio; no es promesa de inventario para esa cantidad. Se reconoce producto no disponible solo para consultar, conservando su estado real. Otros tres controles fallaron antes de corregir ese caso.

84regresiones nuevas:54consultas en3menús/6estados,6conversaciones consulta→compra→DTO,9selecciones pendientes,6prefijos de cortesía,3productos no disponibles y6rechazos seguros de compra mezclada con pregunta de precio.153focalizados,TypeScript y72Node pasan;global aprobada:81suites/8788tests,592.772s,368hashes intactos. No repetir global por documentación. Evidencia whatsapp-group-inquiries-validation-1810.json. No desplegado;runtime aún d043cc54. Publicar/desplegar agrupado con b1529b5f;verificar runtime/health y cerrar documentación.

HUECO REPRODUCIDO pendiente:«Quiero cuatro…,2conA/2conB;y dime cuánto cuestan» no se compra:el add_item rechaza question_not_order. Los6controles exigen aclaración y carrito intacto;NO son6compras exitosas. Siguiente tanda:resolver ownership consulta/compra mixta sin relajar protección contra compras ante preguntas puras. Después notas que retiran una cláusula/productos sin atributos y conversaciones reservadas reales. Esta continuación ceroAPIpagada/Meta/órdenes externas,Main y presupuesto intactos.

## Tanda cerrada, pendiente de despliegue agrupado — 18/10/2026: compras distribuidas durante checkout

Base f52d2ca3. Se reprodujeron seis bloqueos: add_item preparaba variantes válidas pero placedOrderOnly descartaba la compra. El adaptador ahora acepta solo un reparto fuente completo, con evidencia de herramientas aceptadas y guard sin cambios; conserva el estado pendiente y responde desde el carrito. No autoriza confirmación ni operaciones mezcladas. Metadatos nuevos junto a esta compra se aclaran sin mutación; no se aplican parcialmente.

69 regresiones nuevas: 45 recorridos (tres menús, cinco pasos pendientes y tres repartos) con carrito previo, consultas intermedias y DTO final simulado; 24 rechazos por reparto incompleto/error/metadata mezclada/falta de evidencia. Focalizados 99, TypeScript y 72 Node pasan. Global aprobada:81suites/8704tests,597.816s,368hashes intactos. Ver evidencia whatsapp-checkout-variants-validation-1810.json. No desplegada:agrupar con la siguiente familia;runtime aún d043cc54. No repetir global por documentos.

SIGUIENTE: consultas puramente informativas que contienen grupos contados («cuánto cuestan cuatro..., dos con A y dos con B»). Reproducir antes de corregir: el detector temprano aún puede exigir una compra aunque la intención sea consultar. Después: notas que retiran una sola cláusula, productos sin atributos y conversaciones reservadas completas. Esta tanda no mide interpretación real del modelo ni latencia/costo; cero llamadas pagadas/Meta/órdenes externas. Main intacta. Mantener despliegues agrupados.

## Cierre vigente — 18/10/2026,06:54 Bogotá

Notas por unidades YA desplegadas en stagingd043cc54.47tests nuevos;81suites/8635tests,235controles de preparación/tool/origen,TypeScript y72Node;compilado/health verificados. CeroAPIpagada/Meta/órdenes externas,Main intacta. Evidencia whatsapp-note-modes-validation-1810.json. No repetir esta tanda.

Siguiente:compra distribuida durante nombre/teléfono/dirección/pago/confirmación y consultas puras de precio que mencionan grupos. Para notas:retirar solo una cláusula,preservación de otras instrucciones,referencias ambiguas y productos sin atributos. NoteMode actual es append/replace FINAL COMPLETO/clear TODA la nota del subconjunto;no prometer comprensión universal. Inferencia reservada de elección de modo solo fuera del despertar gratuito,bajo presupuesto previo. Leer relevo vigente y mantener Main;las secciones inferiores sobre validación en curso son históricas.

## Tanda de notas — 18/10/2026,validación en curso

Cambio local noteMode append/replace/clear permite corregir o borrar toda la nota de un subconjunto sin concatenar instrucciones opuestas ni tocar el resto. Baseline18fallos;47tests nuevos y235controles de herramientas/preparación/origen pasan. Global en curso:consultar primero WHATSAPP-LOCAL-NEXT-AGENT.md y no editar la fuente durante la suite. No asumir desplegado hasta cierre.

Siguiente tanda:compras distribuidas durante nombre/teléfono/dirección/pago/confirmación,con consulta de carrito e interrupciones. Probar también consultas puras que mencionan grupos para evitar que el guard de compra sustituya una respuesta informativa por una aclaración de cantidades. Para notas:quitar solo una cláusula conservando las otras,alusiones ambiguas y productos sin atributos declarados;el nuevo contrato no acredita todos esos casos. Real-model reservado de elección append/replace/clear solo en ejecución activa con autorización/budget;no pagado en el despertar programado. Mantener Main intacta y una tanda por despertar.

## Cierre automático vigente — 18/10/2026,01:53 Bogotá

Reparto incompleto YA reproducido,corregido,validado y desplegado en staging71114d9d.21tests nuevos;81suites/8588tests,TypeScript y72Node;rechazos comprobados en compilado. CeroAPIpagada/Meta/órdenes externas,Main intacta. Evidencia whatsapp-distribution-atomic-validation-1810.json. No repetir esta tanda.

Siguiente despertar:nota contradictoria/reemplazo/borrado;compras distribuidas durante checkout. Añadir consultas puras con grupos,permutación de grupos y aliases con conservación de intención/DTO. Leer primero el relevo vigente;las anotaciones inferiores sobre la tanda en curso y el riesgo aún no reproducido son históricas. No desplegar ni repetir global por este cierre documental.

## Despertar automático — 18/10/2026: conservación del reparto

Tanda actual sobre1bfc7fd0 reprodujo12compras parciales con3catálogos.21regresiones nuevas y55focalizados pasan;global en curso,ver estado vigente en WHATSAPP-LOCAL-NEXT-AGENT.md antes de trabajar. Contrato previo a acciones contrasta total y grupos por cantidad/opciones uno-a-uno y rechaza error del agente/mezclas incompatibles. Prueba fuente inválida antes de inferencia. Sin API pagada/Meta/órdenes externas.

Al cerrar esta tanda,no repetirla. Seguir con notas contradictorias/reemplazo/borrado y checkout distribuido. Añadir también consultas puras con repartos(«cuánto cuestan4,dosAydosB»),grupos reordenados por el modelo,aliases y totales expresados con más variantes;comprobar que una consulta no se trate como compra ni un rechazo de compra impida responder preguntas. Son hipótesis para reproducir antes de cambiar reglas,no fallos acreditados por los mocks actuales. Mantener fuente congelada durante global y preservar Main.

## Continuación autónoma y siguiente matriz — 18/10/2026

Automatización horaria activa en este hilo: continuar-pruebas-de-ppp-en-staging. Una tanda gratuita por despertar;no inferencia pagada/Meta/órdenes externas;no editar si hay una validación o trabajo en curso. Mantener staging/Main según AGENTS. Notificar cierre verificado,fallo importante o dependencia humana;silencio si no hay cambio accionable. Autorizada por usuario ocupado y permiso explícito para continuar siguientes tandas. No requiere un nuevo «continúa» por cada tanda.

Tanda actual en validación:57regresiones nuevas de opciones+nota para el mismo subconjunto,proyección y compras distribuidas por variantes. Un turno reservado de Bowl Andino con Sol6.1 real pasó(3requests);su traza quedó capturada y reproducida gratis. Ver estado en WHATSAPP-LOCAL-NEXT-AGENT.md y whatsapp-joint-subset-validation-1810.json;no asumir despliegue hasta su cierre.

Siguientes tandas, en este orden:
0. Primero reproducir propuestas parciales del modelo en un reparto:pedir4en2+2pero el modelo solo llamaadd_itempara2,omiteungrupo,falla la API después del primer grupo o propone3+2. La propiedad a demostrar es suma y alcance iguales al reparto completo,o carrito intacto con aclaración. Es un hueco propuesto por revisión del contrato,no un fallo reproducido todavía. Usar metadatos purchaseAttempts reales,errores de agente y varios menús. No confundir mocks que ya entregan la respuesta correcta con precisión lingüística. Cantidades0,11,99,fraccionarias no deben ajustarse silenciosamente. Si se demuestra pérdida parcial,priorizar su arreglo antes de más variaciones de lenguaje.
1. Corrección/borrado de notas:«sin sal→normal»,«quita la nota de dos»,«la cebolla sí,la sal no»,confirmaciones ambiguas. Definir contrato explícito de añadir/reemplazar/borrar antes de ampliar;no concatenar instrucciones opuestas. Menús de pizzas,desayunos,platos,panes y bebidas. Comprobar resto y DTO.
2. Compra por variantes durante nombre/teléfono/dirección/pago/confirmación. El cambio parcial existente ya tiene recorridos;la compra nueva distribuida aún requiere matriz de aceptación en esos pasos. Evitar que «placedOrderOnly» convierta una compra clara en repetición de pago o parsers independientes.
3. Cantidades distribuidas inconsistentes:total4con grupos2+3,grupoomitido,«uno igual»,cantidad0,negación de una variante. Contrastar suma y alcance,clarificar sin partes si no concuerda. Separar evidencia de interpretación real del modelo y controles con propuesta simulada.
4. Referencias a filas después de separar:ordinales,nota única,«los otros»,rectificación de rectificación,repetición en otro turno,opciónyaelegida. No seleccionar restante automáticamente.
5. Conversaciones reservadas completas con menús nuevos y lenguaje libre;medir errores,costo y latencia. La automatización usa pruebas gratuitas;inferenciapagadacontrolada corresponde a una ejecución activa bajo presupuesto registrado. No declarar piloto/venta por conteos.

## Próxima matriz después del origen de variantes — 18/10/2026

Tanda local actual: no-op conserva intención; repetición tras partición no altera el resto por defecto; una fuente ambigua invalida todos los grupos. Ver whatsapp-unit-option-followup-validation-1810.json y estado vigente en WHATSAPP-LOCAL-NEXT-AGENT.md. No asumir desplegado hasta cierre allí.

1. Opciones + nota sobre el mismo subconjunto: cuatro hamburguesas, dos sin cebolla y con otra bebida; tres bentos, uno sin salsa y con arroz distinto; dos menús, uno con nota de alergia. Verificar unión del grupo, resto intacto, precio, respuesta y DTO final. Aclarar si el alcance no está definido; no ampliar automáticamente la nota a todos.
2. Compra nueva distribuida: “cuatro, dos A y dos B”, con atributos compartidos y luego específicos. Variar catálogos de jugos, menús, sushi y panes. Cantidad de paquete dentro del nombre no equivale a multiplicador del carrito.
3. Referencias después de separar: “de las dos originales cambia una”, ordinales de fila, dos referencias simultáneas, negaciones, “las otras”, repetición literal, corrección de la corrección. Los casos que hoy piden aclaración deben permanecer sin mutación hasta una fuente verificable.
4. Reanudar pasos pendientes: nombre/teléfono/dirección/pago, con consulta de precio, carrito, horario o ingredientes antes de responder el dato. Jamás registrar una pregunta como nombre ni duplicar productos.
5. Reservar conversaciones nuevas sin usarlas para ajustar reglas; comparar respuesta, carrito y estado, no solo clasificación. Inferencia moderada con presupuesto registrado antes de red. No WhatsApp externo ni órdenes reales sin verificar aislamiento.

Entrada al piloto supervisado: global reproducible sobre fuente congelada, prueba reservada de modelo real, revisión de costo por conversación y latencia, correcciones sin pérdida de carrito, configuración efectiva auditada y acompañamiento humano disponible. Los conteos de regresión por sí solos no acreditan preparación comercial. Continuar efectivo/transferencia, Main solo con instrucción explícita.

## VIGENTE: cf6ded72 desplegado y verificado — 17/10/2026, 23:25 Bogotá

Runtime de staging cf6ded721eb26a2f59e64d9fa10fa0969a4fa69d, running/healthy. Imagen activa=candidate sha256:b318ba027fff3a61f37337619a3bd471251cff0b6797f65c177a99a349de590e. Verificación18/10 04:25:13UTC;health OK/DB connected/circuit CLOSED. Guard/herramienta/proyección/plan y colisión de precios comprobados en compilado, además de los guards previos. Rollback ppp-nest-staging:rollback-before-cf6ded72. bin/ remoto y mariadb_local preservados. Main intacta.

Nuevo contrato de opciones sobre parte de las unidades: set_unit_attributes/updateUnitOptions agrupa atributos del mismo subconjunto, conserva resto/notas/precios, rechaza planes incompatibles y muestra las variantes del carrito. Una partición no autoriza a reutilizar IDs proyectados para otra mutación. Las compras/retiros/confirmación mezclados se aclaran y las adiciones pendientes deben crearse por variante. Consolidación conserva precios distintos hasta la revisión explícita de precio del checkout.

Aceptación final210focalizados,TypeScript,72contratos Node y global80suites/8473tests en1473.182s;363hashes intactos en /tmp/ppp-unit-option-final-source-1710.json.83controles nuevos de integración, además de85 de preparación previa. Primera global interrumpida para corregir el subtotal;dos reproducciones fallaron antes del arreglo. Esa primera global NO es aceptación. Informe whatsapp-unit-option-integration-validation-1710.json y log /tmp/ppp-unit-option-final-global-1710.log.

Un turno reservado con menú Shawarma y modelo Sol6.1 real aprobado:3solicitudes,US$0.0221102 estimados;get_cart y set_unit_attributes. Se midió antes del ajuste de consolidación por precio;su traza se reprodujo gratis sobre el candidato final. No afirmar reinferencia del candidato final ni una conversación completa por este turno. Evidencia whatsapp-unit-option-real-probe-1710.json y scripts/fixtures/whatsapp-unit-option-captured-trace-1710.json. No hubo mensajes Meta ni órdenes externas. Presupuesto operativo185/usadas184/restante1;la extensión numérica la eligió el agente bajo autorización continua del usuario.

Configuración efectiva de staging auditada sin mutaciones:bot y agente V1 habilitados;Sol6.1,visión/assist Luna yGPT Transcribe. No implica una nueva auditoría de Main. No repetir global ni reconstruir por este cierre documental.

SIGUIENTE: matriz «Siguiente matriz después de integrar opciones por unidades» en whatsapp-next-batches.md:compra nueva por variantes,origen ambiguo entre variantes existentes,repetición en otro turno,no-op del modelo sin vuelta a compra,atributos+nota del mismo subconjunto e interrupciones en nombre/teléfono/dirección. El contrato actual NO ejecuta una transacción compuesta de compra+edición+aprobación. Añadir familias y casos reservados antes de ampliar esa semántica. Mantener staging permanente;no promover Main ni declarar vendible por conteos. Las entradas inferiores son historial.

## Integración validada para publicar — 17/10/2026, opciones por unidades

Contrato conectado: `set_unit_attributes` → `AiOrderAction.updateUnitOptions` → guard con instantánea → preparación atómica → carrito y respuesta derivada. Agrupa varias opciones para las mismas unidades; conserva resto/notas/precio. `get_cart` proyecta la división con IDs estables; bloquea mutaciones posteriores que reutilicen la proyección. Una segunda partición incompatible rechaza toda la tanda; una llamada idéntica no duplica la primera. Compras/retiros/confirmación mezclados y adiciones pendientes se aclaran, no se ejecutan como operación compuesta.

Se reprodujo además una pérdida de subtotal en consolidación: dos controles fallaron antes del arreglo. Ahora solo se fusionan líneas de igual precio, producto, opciones y nota. Incluye precios de origen tanto menores como mayores, y tres recorridos hasta revisar el precio actualizado y aprobar expresamente la orden.

Aceptación final:210focalizados,TypeScript,72contratos Node y global80suites/8473tests en1473.182s;363hashes sin cambios. Log `/tmp/ppp-unit-option-final-global-1710.log`, manifiesto `/tmp/ppp-unit-option-final-source-1710.json`. Primera global interrumpida por la nueva regresión de precios; no usarla como aceptación. Informe `whatsapp-unit-option-integration-validation-1710.json`.

Un turno reservado con otro menú ficticio y modelo real Sol6.1 pasó:3solicitudes,US$0.0221102 estimados, get_cart→set_unit_attributes. Se midió antes del ajuste de identidad por precio y se reprodujo gratis su traza sobre el candidato final; no afirmar reinferencia del candidato final. Evidencia `whatsapp-unit-option-real-probe-1710.json` y fixture capturado. Presupuesto operativo185,usadas184,restante1; extensión numérica elegida por el agente bajo autorización continua del usuario. Bot/agente V1 efectivos de staging verificados habilitados;modelos intactos.

Todavía NO desplegado en este punto: runtime anterior f61cecff. Publicar staging y desplegar una vez con los scripts /tmp/ppp-unit-option-deploy-1710.sh y /tmp/ppp-unit-option-deploy-verify-1710.py;verificar imagen/health/compilado y cerrar documentación. Main intacta. Después seguir la matriz «Siguiente matriz después de integrar opciones por unidades» en whatsapp-next-batches.md;no declarar vendible por conteos. Las entradas inferiores son historial.

## Preparación local publicada: contrato de opciones por unidades — 17/10/2026

Se añadió `whatsapp-unit-option-plan.ts`, una función de preparación todavía **sin conectar a herramientas, AiOrderAction, guard ni router**. Recibe una línea de la instantánea original, cantidad afectada y una lista agrupada de atributos. Valida todo antes de producir un carrito nuevo; conserva cantidad restante, precio original, notas y otras opciones. Dos atributos de un mismo grupo afectan las mismas unidades. Rechaza cantidades inválidas, atributos ausentes, opción inexistente, dos grupos superpuestos y filas ajenas. No muta entrada y devuelve procedencia de cada partición.

85 controles nuevos con tres menús ficticios;127 controles focalizados (incluye42 existentes de edición),2 suites,11.492s y TypeScript verdes. Informe `whatsapp-unit-option-plan-validation-1710.json`. Cero inferencia, Meta u órdenes externas. No cambió la ejecución del agente, no se reconstruyó staging y no se actualizó Main. La global8305 anterior acredita f61cecff, no esta futura integración. No repetirla por un módulo aún sin consumidores de producción.

Siguiente trabajo: exponer una herramienta agrupada y acción dedicada; guard con rechazo completo; vista get_cart coherente tras partición; impedir índices obsoletos en edición/quitar/reemplazar; preparación antes de mutación y respuesta con las dos variantes. Probar conversación completa hasta payload final simulado, unidades pendientes de añadir, repetición y compra+edición+aprobación. Solo después congelar fuente, ejecutar global y activar/desplegar agrupado. No considerar solucionado todavía el alcance por unidades del modelo en todos los caminos.

## VIGENTE: desplegado y verificado f61cecff — 17/10/2026, 22:20 Bogotá

Staging running/healthy; imagen activa=candidate sha256:29a96d2069a5120209f29f344ef274498d843bd4dd168aa39e6a49b02e6a65c0. Verificación18/10 03:20:10UTC, health OK/DB connected/circuit CLOSED. Modelos Sol6.1/Luna/Luna/GPT Transcribe intactos. Compilado de ambas tandas y guards previos comprobados. Rollback ppp-nest-staging:rollback-before-f61cecff. bin/ remoto y mariadb_local preservados. Main sin cambios.

Incluye ubicación5014f250:45casos nuevos,545focalizadas,TypeScript,72contratos y global79suites/8265tests verdes. Etiqueta humana en respuesta/resumen/recibo; conserva pin raw para logística. Sin nombre usa «Ubicación compartida»;no geocodificación inversa. Google Maps q/query exacto se interpreta localmente y se rechazan pines inválidos.

Incluye compra ausente f61cecff:40casos nuevos,18recorridos completos con órdenes simuladas,190focalizadas definitivas,TypeScript y72contratos Node verdes. Global FINAL79suites/8305tests en1241.223s;358hashes iguales a /tmp/ppp-unavailable-active-cart-final-source-1710.json. Primera global falló14pruebas por distribución cada:nunca se publicó;se corrigió frontera y revalidó. Informes whatsapp-readable-location-validation-1710.json y whatsapp-unavailable-active-cart-validation-1710.json. No repetir global ni reconstruir por este cierre documental.

La solicitud contada de plato ausente de familia configurada se responde antes del bloqueo de carrito/pago;ofrece solo catálogo disponible y conserva cantidad al elegir. No agrega sustituto automáticamente. Pendientes anteriores conservan dueño;oferta nueva informativa usa bullets. Sin alternativas lo indica.0/99no se convierten a1/30. Familias reales de staging auditadas por SELECT de configuración:8predeterminadas,carne habilitada. Ninguna mutación en esa auditoría.

Cero llamadas pagadas,Meta u órdenes externas en ambas tandas;181/183,intacto. Son pruebas de router/modelo simulado,no conversaciones independientes de inferencia. No declarar vendible por conteos. Límites:gramática contada/familia conocida,no universal;pedidos ausentes con preparación adicional,mensajes mixtos,dirección o familia no configurada requieren ampliar evidencia.

SIGUIENTE: contrato general del modelo para opciones sobre algunas unidades y validación de compra+edición+aprobación antes de crear orden. Ver propuesta en whatsapp-next-batches.md. Añadir controles de elección numérica en alternativas,cambios de cantidad/rechazo y notas sobre el producto alternativo. La regla temprana de edición parcial no equivale todavía a alcance por unidades en todas las acciones del modelo. Entradas inferiores de «en curso/no publicar» son historia;este encabezado prevalece.

## Validado para deploy agrupado — 17/10/2026

Compra no disponible:40casos nuevos,18recorridos completos con orden simulada;190focalizadas,TypeScript y72contratos Node verdes. Global DEFINITIVA79suites/8305tests en1241.223s,/tmp/ppp-unavailable-active-cart-final-global-1710.log;358hashes iguales a /tmp/ppp-unavailable-active-cart-final-source-1710.json. Primera global fallida14/8305 fue desarrollo,nunca publicada;se conservó historial en JSON. Corregida frontera entre distribución cada y plato ausente.

Publicar solo staging y desplegar agrupado con ubicación5014f250. Runtime previo a3b462a3;Main intacta. Informes whatsapp-unavailable-active-cart-validation-1710.json y whatsapp-readable-location-validation-1710.json. Config real de staging leída sin mutaciones:8familias predeterminadas,carne habilitada. Cero API/Meta/órdenes externas;181/183. No repetir global tras cierre documental.

Próximo:contrato de acciones del modelo para afectar solo algunas unidades y aprobación del plan completo antes de crear orden. La regla actual de ausencia es contada y de familia reconocida/configurada,no universal. No acreditar transcripción real o aislamiento multitenant con mocks.

## REVALIDACIÓN GLOBAL FINAL — 17/10/2026

No publicar todavía. Primera global de compra ausente /tmp/ppp-unavailable-active-cart-global-1710.log falló14tests/8291verdes,78suitesverdes/1fallida,1096.684s;358hashes intactos. Causa:«Quiero3sopas,una de cada una» se capturaba como compra ausente;las notas de subconjunto posteriores tampoco podían arrancar. Se delega gramática distributiva cada antes del fallback. No atribuir esa primera global a aceptación.

190focalizadas definitivas y TypeScript verdes /tmp/ppp-unavailable-active-cart-distribution-accepted-targets-1710.log y /tmp/ppp-unavailable-active-cart-distribution-tsc-1710.log. Ahora congeladas358fuentes en /tmp/ppp-unavailable-active-cart-final-source-1710.json. Global definitiva EN CURSO /tmp/ppp-unavailable-active-cart-final-global-1710.log. Esperar footer,comparar mapa exacto,registrar y solo entonces publicar/deploy agrupado con ubicación5014f250. Informe whatsapp-unavailable-active-cart-validation-1710.json conserva primera global fallida.

40casos nuevos,18recorridos completos con orden simulada. Main sin cambios. Cero API/Meta/órdenes externas;181/183. Último runtime a3b462a3,checkout remoto69a0df72. Verificador /tmp/ppp-unavailable-active-cart-deploy-verify-1710.py comprueba modelo/health/imagen/guards de ambas tandas sin crear orden. No editar fuente durante esta global. Tras deploy,cierre solo documental no reconstruir. Próximo contrato de edición parcial por unidades del modelo.

## Global final en ejecución: compra no disponible — 17/10/2026

Fuente congelada358archivos /tmp/ppp-unavailable-active-cart-source-1710.json. Global /tmp/ppp-unavailable-active-cart-global-1710.log;NO editar fuente hasta footer y hashes.40nuevos:18recorridos completos de orden simulada PPP/sopas×carrito/pago/confirmación×3modos de agente,22controles.150focalizadas finales en2suites22.366s y TypeScript aprobados: /tmp/ppp-unavailable-active-cart-accepted-full-journeys-1710.log y /tmp/ppp-unavailable-active-cart-final-tsc-1710.log. VerJSON. Una corrección temprana declaraba hamburguesa sin cebolla ausente;guard de base/preferencia ya lo evita. Genérico conocido puede pedir presentación;no exigir compra automática cuando hay ambigüedad legítima.

Ubicación5014f250ya publicada/validada79suites8265tests;NO desplegada todavía. Agrupar deploy al cerrar esta global. Runtime a3b462a3,checkout remoto69a0df72,bin/ preservado. Verificador /tmp/ppp-readable-location-deploy-verify-1710.py para imagen/health/modelos/guards previos;añadir guard de compra ausente antes de usarlo. Main intacta. Cero API/Meta/órdenes externas;181/183.

Límites:gramática contada de familia configurada;mensajes mixtos/domicilio/unfamilia sin configurar conservan rutas existentes,no acreditar universalidad. Oferta conserva cantidad;si hay otro pendiente,alternativas informativas con bullets y reminder del dueño. Sin disponibles,respuesta explícita sin inventar productos. Próximo:contrato de edición parcial por unidades y autorización de plan completo,según plan de whatsapp-next-batches.md.

## En validación: compra no disponible con carrito activo — 17/10/2026

Base5014f250.34tests nuevos:12solicitudes PPP/catálogo sopa(cart/pago×reglas/agente vago/agente que devuelve carrito),6controles selección existente/platos conocidos,5cantidades/repetición,7propiedad/disponibilidad/rangos,4sin alternativas/familia configurada. Baseline9fallidos/3verdes. Primera corrección12verdes. Regresión detectada y corregida:«3hamburguesas sin cebolla» se declaraba ausente;no confundir preferencia con plato nuevo ni saltar prioridad de porciones normales. Otros fallos intermedios fueron fixtures/assertions,verJSON. Última selección51verdes(34nuevos+17porciones existentes);ampliación final en /tmp/ppp-unavailable-active-cart-accepted-final-targets-1710.log,TypeScript /tmp/ppp-unavailable-active-cart-tsc-1710.log. Todavía no publicado/desplegado.

Regla general por catálogo y conceptos configurables:pedido contado no resuelto a SKU,pero familia reconocida,se responde antes de carrito/pago. Ofrece solo productos disponibles;guarda cantidad en pendingMatch para elección posterior. No añade alternativa sin elegirla. Un pendiente anterior no se sustituye:oferta informativa con bullets y recordatorio de dueño. Sin alternativas lo indica y conserva sesión. Cantidad0/>30 no se convierte a1/30. Gramática acotada;no afirmar comprensión universal ni inferencia real.

Ubicación ya validada/publicada5014f250,NO desplegada:agrupar ambas familias después de global final. Runtime últimoa3b462a3. Main intacta. Cero API/Meta/órdenes externas;181/183. Siguiente estructural:contrato de opciones por unidades del modelo y compra+edición+aprobación atómica.

## Ubicación validada,pendiente deploy agrupado — 17/10/2026

Base69a0df72.45nuevas;545focalizadas,TypeScript,72contratos Node aprobados. Global79suites/8265pruebas1050.018s;358hashes idénticos a /tmp/ppp-readable-location-source-1710.json. Informe whatsapp-readable-location-validation-1710.json. Ya se puede publicar fuente solo staging. No repetir global por documentación. NO desplegado aún:agrupar con la nueva familia solicitada de pedido inexistente con carrito activo. Runtime actual a3b462a3;Main intacta. Cero API/Meta/órdenes externas;181/183.

Etiqueta legible en respuesta,resumen y recibo conserva rawaddress y pin en payload;URLs Google q/query exactas se interpretan localmente;pin inválido no cotiza ni muta. No geocodificación inversa. Nueva prioridad«quiero3carnes a la plancha»→solo carrito:aún pendiente reproducción/corrección;tests preparados en /tmp/ppp-unavailable-active-cart-tests.txt,integrar solo tras commit de esta fuente validada. Ver contrato general de opciones parciales en whatsapp-next-batches.md como siguiente después de ese fallo.

## Nueva prioridad del usuario: pedido no disponible con carrito activo — 17/10/2026

Chat observado: ejecutivo con pollo frito/sopa mondongo en carrito;«quiero3carnes a la plancha» devuelve solo carrito+¿Algo más?. Debe reconocer la compra solicitada,indicar ausencia y ofrecer alternativas verificadas,conservar ejecutivo y cantidad3como intención pendiente sin agregar sustituto automáticamente. Cubrir vacío/carrito/pago,agente simulado on/off,respuestas del modelo sin acciones y pérdida de petición con fallback,menús ficticios y alimentos inexistentes con alternativas o sin ellas. No hardcodear carne a la plancha como excepción. Nueva familia pendiente de reproducción;no afirmar corregida.

Esperar cierre de global de ubicación antes de editar fuente. Publicar ubicación validada primero;agrupar despliegue con esta nueva familia si se completa,según preferencia de no reconstruir por cada regla. Después retomar contrato de alcance por unidades del modelo. Main intacta.

## En curso: presentación de ubicación — 17/10/2026

Base69a0df72.45tests nuevos:24recorridos completos(2cartas×agente simulado on/off×pago/confirmación×pin/pin con nombre/enlaceMaps),4pines inválidos,17contratos puros. Baseline28fallidos/0verdes. Primera corrección28verdes;545focalizadas y TypeScript verdes. Ampliar aserción hasta recibo mostró24fallidos/4verdes: tras reset el recibo usaba snapshot con coordenadas. Se corrige presentación en resumen/carrito/recibo además de reply. Aceptación final en curso /tmp/ppp-readable-location-accepted-targets-1710.log. No confundir primera aceptación con fuente final.

Se conservan dirección raw, enlace y coordenadas para logística/payload. Solo salida al cliente usa nombre/dirección suministrada o «Ubicación compartida». No geocodificación inversa nueva, no LLM/red para nombrar ubicación. URL Google q/query con coordenadas exactas se convierte localmente a pin; otros hosts/URLmezclada/lugares/shortlinks no. Pin nuevo no confirma orden; se conserva mecanismo de reconstruir checkout antes de pedir confirmación. No cambiar a guardar awaiting_final_confirm antes de tryConfirmOrder: esa rutina puede crear una orden desde ese estado.

Cero API/Meta/órdenes externas;181/183. Main intacta. Todavía no publicar/desplegar sin cerrar TypeScript y global congelada. Informe whatsapp-readable-location-validation-1710.json. Runtime último a3b462a3.

## Desplegado y verificado: a3b462a3 — 17/10/2026,21:00 Bogotá

Staging running/healthy;imagen activa=candidate sha256:c410377a0155417cebf160adb2c979b4d201d70f8260e050c69a8d92166b1933;health OK/DB connected/circuit CLOSED. Verificado18/10 02:00:08UTC. Incluye aprobación compuesta b062d801 y opciones parciales/porciones a3b462a3. Compilado conserva guards previos/nuevas rutas;modelos Sol6.1/Luna/Luna/GPT Transcribe iguales. Rollback ppp-nest-staging:rollback-before-a3b462a3. bin/ remoto y mariadb_local preservados. Main intacta. No reconstruir ni repetir global por este cierre documental.

Global definitiva78suites/8220tests,745focalizadas,TypeScript y72contratos Node aprobados;356fuentes congeladas iguales.76pruebas nuevas en esta tanda y98en aprobación anterior. Informes whatsapp-partial-options-portions-validation-1710.json y whatsapp-compound-approval-validation-1710.json. Cero llamadas pagadas/Meta/órdenes externas en estas dos tandas;181/183 intacto. Estos son mocks de dependencias/modelo, no8220 conversaciones independientes ni validación de transcripción de audio real.

SIGUIENTE: ubicación legible sin exponer coordenadas, preservando destino exacto. No se implementó todavía;ver lista reservada y plan comercial. Luego alcance por unidades en contrato de acciones del modelo y composición de compra+edición+aprobación. Repetición de cambio parcial tras dividir y varias líneas del mismo SKU piden aclarar, no trasladan el resto automáticamente. No declarar producto vendible solo por suite verde. Las entradas de «en curso/pendiente» inferiores son historial, este encabezado prevalece.

## Validado: cambios de opciones por unidades y porciones normales — 17/10/2026

Base b062d801.76 casos nuevos;745 focalizadas en2suites,TypeScript y72contratos Node aprobados. Global78suites/8220pruebas,759.648s;356 hashes idénticos a /tmp/ppp-options-portions-source-1710.json. Log /tmp/ppp-options-portions-global-1710.log. Informe whatsapp-partial-options-portions-validation-1710.json. Publicar únicamente staging; despliegue agrupado pendiente con aprobación b062d801. Main intacta. No repetir suite por cierre documental. Cero API/Meta/órdenes externas;181/183.

Cambio contado de2entre4 divide línea y conserva otras opciones, notas, precio, unidades y paso de checkout. Carrito muestra2de cada opción; payload final comprueba4unidades. Incluye Coca Cola→Colmbiana del catálogo PPP y salsas/masas ficticias. Varias líneas del mismo SKU, repetición tras división, cantidad inválida, opción desconocida o selección pendiente piden aclaración sin mutación. Porciones explícitas con preferencia grande y una única presentación sin atributos se añaden aclarando tamaño habitual. Aceptación «Sí,dame las3ensaladas normales» ya no repregunta cantidad. No prometer tamaños aumentados.

Límites: texto reconstruido, no audio original; gramática acotada anterior al matcher por línea, todavía no hay alcance por unidades en todas las acciones generadas por modelo. Nueva solicitud de mapa queda como próxima tanda: etiquetas humanas conservando pin, fallback y geocodificación inversa opcional. Ver plan comercial y lista reservada inferior. Después: compra+edición+aprobación atómica y evaluación independiente del modelo. No declarar vendible por conteos.

## Próxima tanda reservada: etiqueta de ubicación — pendiente

No implementada ni acreditada por la suite actual. Primero separar destino de presentación: usar nombre/dirección del pin si existe; si solo hay lat/lng, mostrar «Ubicación compartida», conservar pin y enlace para logística. El usuario pide legibilidad, no es necesario añadir un LLM ni bloquear el pedido por geocodificación inversa. Si se añade lookup postal, cachear y medir latencia/costo; fallo o dirección ambigua conserva el pin, no confirma número de casa inventado. Revisar la transición actual que guarda el pin con state=building_cart: una corrección de ubicación durante pago/confirmación debe conservar productos y pago y retomar checkout.

Casos previstos: pin con nombre; pin con dirección; pin solo coordenadas; URL q lat/lng codificada (%2C); dos pines sucesivos; sustitución de dirección textual por pin; pin durante pago; pin durante confirmación; etiqueta inversa cercana sin puerta; calle lejana/incoherente; timeout; falta de clave; fuera de cobertura; invalid lat/lng. Comprobar salida legible, coordenadas/ruta preservadas, ningún cambio de productos ni compra/confirmación implícita. Esta lista es planificación, no tests ejecutados.

## En validación: opciones de algunas unidades y porciones normales — 17/10/2026

Base b062d801.76 casos nuevos:48 edición parcial+límites,4 conservación de otros atributos/productos,9 compra con preferencia de tamaño,8 aceptación de porciones normales,7 fronteras de catálogo. Baseline:48/48 edición parcial fallaban;9/9 preferencia y8/8 continuación normales fallaban. Primera corrección36/48 verdes;12 expectativas de carrito asumían que una dirección ya confirmada no avanzaba automáticamente, corregidas para conducta vigente. Focalizadas48 edición y65 familias iniciales verdes; validación ampliada en /tmp/ppp-options-portions-final-targets-1710.log. Todavía no desplegado. Main intacta. Sin llamadas pagadas ni Meta/órdenes externas;181/183.

Se divide una línea por cantidad explícita, se conservan resto/opciones/notas/precio y se muestra cada grupo. Repetir tras división pregunta sin mutar las unidades restantes. Porciones con «bien grandes» y sin otro tamaño configurable se añaden con aclaración de tamaño habitual. «Sí, dame las 3 ensaladas normales» no vuelve a pedir cantidad. Gramática acotada: no afirmar comprensión universal, transcripción validada ni aislamiento multitenant.

Nueva petición de ubicación: el cálculo actual con coordenadas omite geocodificación inversa, por eso no devuelve etiqueta postal. Próxima tanda: presentación «Ubicación compartida»/nombre recibido y, si procede, geocodificación inversa con caché y fallback, conservando pin exacto y sin presentar dirección aproximada como exacta. Aún no implementada. Siguiente también: aprobación+edición/compra en un turno.

## Cierre aprobación compuesta — 17/10/2026

Global aprobada:78 suites/8144 pruebas,632.76s.356 hashes idénticos;937 focalizadas,TypeScript y72 contratos Node verdes. Validado, todavía no desplegado. Main intacta. Próximo: cambios de atributos de solo algunas unidades; luego tamaños no configurados expresados como preferencia, sin doble respuesta contradictoria.

## En validación17/10: contrato compartido de aprobación

98 nuevos (72recorridos completos con orden simulada+26contratos puros),937focalizadas, TypeScript y72contratos Node verdes. Global EN CURSO /tmp/ppp-compound-approval-global-1710.log;356fuentes congeladas en /tmp/ppp-compound-approval-source-1710.json. Ver whatsapp-compound-approval-validation-1710.json. No editar fuente hasta cierre y hashes.

No despliegue por esta tanda; agrupar con siguiente. Runtime último verificado a9693ea1. Main intacta. Cero API/Meta/órdenes externas;181/183 intacto. No repetir global tras cambios solo documentales.

Siguiente bloque prioritario: aprobación+edición/compra en el mismo mensaje. Una cláusula «lo confirmo» no acredita que se hayan aplicado las otras acciones; no enviar el carrito viejo. Probar cambios antes/después de aprobación, consulta intercalada, mismo SKU nuevo frente al existente y varias variantes. Después reemplazo de notas contradictorias. Mantener casos nuevos reservados del modelo/medios separados del desarrollo; no declarar piloto por conteo.

## Saludos, carta y confirmación — validado y desplegado17/10

78casos nuevos.839focalizadas, TypeScript,72contratos Node y global77suites/8046tests aprobados en616.486s;354hashes intactos. Informe whatsapp-basic-greeting-confirmation-validation-1710.json. Primera global interrumpida antes de ampliar ETA, no acreditada. «Me puedes pasar la carta»/«menú completo» son consulta; «Confirmo?» no aprueba; «si confirmo…cuánto tarda» no crea orden; «lo confirmo, cuánto tarda» sí aprueba y responde ETA. Main local no tiene manejador de carta, se conserva sin promoción.

Plan vigente al principio de WHATSAPP-COMMERCIAL-READINESS-PLAN.md. Deploy agrupado a9693ea1 verificado healthy17/10 20:07 Bogotá, incluye parcial eec87f78; imagen y guards/modelos compilados verificados. Rollback before-a9693ea1. No reconstruir por cierres documentales ni repetir global sin cambio. Después: preguntas compuestas/citas de autorización (nueva familia pendiente), edición+compra nueva y notas contradictorias, muestra nueva del modelo/medios, piloto supervisado por puertas. Cero API/Meta/órdenes externas;181/183 intacto.

## Tanda17/10: subconjuntos de unidades durante checkout

56 nuevos casos;191 focalizadas, TypeScript y72 contratos Node verdes. Global77 suites/7968tests aprobado en1115.764s,354 hashes intactos; /tmp/ppp-partial-checkout-global-1710.log, ver docs/whatsapp-partial-checkout-validation-1710.json. Esta tanda NO está desplegada; agrupar con siguientes reglas. Main intacta.

Próximo bloque concreto, después de validar/publicar:
- Carrito contiene1plato: «el que tengo sin salsa y agrega otro normal» →2unidades, solo la anterior con nota. Probar en2catálogos con opciones, durante carrito y pago.
- Mismo mensaje menciona un plato existente y otro fuera de carrito: conservar ambos significados; si no se puede separar con seguridad, pedir aclaración sin ejecutar compra parcial.
- Dos variantes del mismo SKU: no elegir la primera. Pedir sabor/variante o referencia de línea, luego modificar solo las unidades indicadas.
- Retirar/reemplazar preparación previa: «mejor con arroz» después de «sin arroz» no debe dejar instrucciones contradictorias en la misma línea.
- Conversación completa nueva: compra, consulta interrumpida, cambio, dirección, pago y confirmación; aserciones sobre respuesta y payload final, no solo cantidad de tests.

Mantener fixtures de menús sintéticos y modelos simulados separados de contraste real. Con2requests operativas disponibles no lanzar runner que necesite más herramientas de las que permite el saldo. No borrar contadores ni atribuir resultados de mocks a precisión de audio/visión/modelo real. Priorizar un contraste acotado al cerrar varias reglas.

## Tanda validada17/10: enumeraciones y preparación compartida

100 casos nuevos aprobados de forma focalizada; global77 suites/7912 tests aprobado,354 hashes intactos; ver docs/whatsapp-enumeration-notes-validation-1710.json. Validación cerrada y hashes idénticos; código1e2d09d7 desplegado en staging, healthy. No repetir global ni rebuild por el cierre documental. El cambio de preparación de dos platos ya presentes no debe crear nuevas unidades ni cobrar porción de acompañamiento. Lo que no identifica destinatarios debe aclararse antes de confirmar. Se conserva el tercer plato y su nota.

Siguientes tandas:
1. Varias unidades en una línea: «dos de los tres sin arroz» requiere partición de unidades sin cambiar total; probar también dos variantes/notas del mismo SKU para impedir selección silenciosa.
2. Mezcla de edición y nueva compra: «el que tengo sin salsa y otro normal» debe conservar lo anterior y añadir exactamente uno. Cubrir un producto mencionado fuera del carrito; no editar parcialmente ni perder el nuevo.
3. Retiro/corrección de preparación: cambiar una nota anterior sin conservar instrucciones contradictorias; distinguir quitar una nota, retirar una selección y cancelar todo el pedido.
4. Mensajes separados y ráfagas: platos, nota y dirección en entradas distintas; persistencia y respuesta de cada turno sin mutaciones duplicadas. Mock del transporte primero; no órdenes reales.
5. Contraste acotado del modelo real con el saldo registrado (2requests operativas disponibles): seleccionar un caso nuevo y registrar intento antes de red. Detener al fallar, reproducir gratis y no gastar en fallos artificiales.

No considerar el conteo de tests una medida de porcentaje vendible. Para piloto: cerrar regresiones críticas conocidas, verificar versión desplegada y ejecutar conversaciones completas nuevas con carrito/respuesta coherentes. No ampliar a pagos/cocina mientras la prioridad del usuario sea comprensión.

## Prioridad nueva: enumeración y uno-de-cada — 17/10/2026

Usuario aporta chat18:20: tres sopas una de cada, dos sin arroz papa salada; repite, lista «un ajiaco, menudencia y un mondongo», se agrupan dos como alternativas; «1 y2» no añade ambos. Reproducir en código actual, pues el chat es previo al deploy95cba2c7 verificado18:23. Añadir otras categorías/cartas: enumeraciones con cantidades omitidas, uno-de-cada solo si conjunto inequívoco, selección plural desde lista, notas para dos de tres sin inventar cuáles. Primero no perder productos ni cantidades; pedir aclaración concreta cuando falte dueño de nota.

Lote anterior ya desplegado95cba2c7 y saludable; ver docs/whatsapp-pending-owner-validation-1710.json. No reconstruir por documentación. Presupuesto181/183 intacto.

## Propiedad de selección pendiente — validado; deploy agrupado en preparación — 17/10/2026

Ver docs/whatsapp-pending-owner-validation-1710.json:74 casos nuevos,68 recorridos completos con orden simulada;246 focalizadas +51 controles de catálogo/agente; global77 suites/7812 Jest, TypeScript y72 contratos Node verdes. Sin inferencia181/183. No atribuirlo al runtime hasta verificar el deploy del lote acumulado.

Siguiente por riesgo:
1. Cart-edit junto a pendingAddOffer/pendingSideSwap/multi; varias compras pendientes a la vez. Referencia vaga no elige dueño; no ofrecer una orden de retirada que no tenga ruta para esa estructura. Empezar por contrato y reproducción gratuita.
2. pendingMatch informativo no es una compra; comprobar que consultar y retirar un cambio no elimine información ajena ni compre por accidente.
3. Completar otras ediciones (cantidad/opción/reemplazo) con selecciones independientes. Solo eliminación quedó acreditada por los nuevos chats completos.
4. Después del deploy, contraste real acotado por contador operativo antes de red; quedan dos. No lanzar full histórico ni confirmar/cancelar órdenes externas.

## Mensajes mixtos de cancelación y acción independiente — 17/10/2026

Validado SIN desplegar. docs/whatsapp-mixed-cancel-validation-1710.json:70 casos nuevos (56 recorridos hasta orden simulada,10 de alcance/eliminación, cuatro cantidades por catálogo en pago);145 focalizadas,77 suites/7738 Jest, TypeScript y72 contratos Node verdes. Global inicial interrumpida para ampliar pruebas; solo final acredita aceptación. Cero inferencia;181/183 intacto. Último runtime verificado1c4d98a9; agrupar cambios antes del siguiente deploy.

Próximas prioridades:
1. Edición cart-edit + compra/opciones pendientes: referencia vaga debe aclarar dueño; retirar explícitamente una sola intención y resolver la restante sin perder carrito/checkout.
2. Composición fuera de cancelación: consulta informativa +cambio/opción/compra, incluida condición desconocida. Asegurar respuesta y mutación independiente sin depender de puntuación.
3. Contrato de consulta +nueva compra después de orden registrada. La ruta mixta actual excluye completed/closed; no acreditarlo por los tests de preguntas puras posteriores a registro.
4. Desplegar el lote acumulado con rollback/imagen/health y luego contraste real limitado al saldo operativo, reservado antes de red. Nunca confirmar/cancelar órdenes externas sin aislamiento.

## Cancelación del pedido completo — validado, pendiente de despliegue — 17/10/2026

Ver docs/whatsapp-whole-cancel-validation-1710.json:68 casos nuevos;83 focalizadas,77 suites/7668 Jest, TypeScript y72 contratos Node verdes. Código nuevo en staging; runtime todavía1c4d98a9. No reconstruir por rutina: agrupar siguiente ajuste. Cero inferencia;181/183 intacto.

Siguiente por riesgo:
1. Consulta o condición de cancelación + compra/cambio independiente en el mismo turno. No basta preservar todo si pierde la acción positiva; definir salida y estado antes de implementar.
2. Una edición cart-edit junto a compra/sustitución pendiente: referencia vaga no elige dueño por orden de campos. Resolver explícitamente y retomar flujo.
3. Continuaciones naturales de cantidad/opciones/reemplazo; no confundir matriz sembrada con chat completo.
4. Contraste modelo/canal limitado al saldo operativo restante, contabilizado antes de red. No confirmar ni cancelar órdenes externas.

## Lenguaje de cancelación que no es una orden — 17/10/2026

Tanda validada y desplegada como 1c4d98a9: docs/whatsapp-cancel-language-validation-1710.json. 88 casos nuevos (72 de nueve formas no operativas y16 controles afirmativos, dos cartas, pago/confirmación y agente simulado on/off);356 focalizadas pasan; global final 77 suites/7600 pruebas, TypeScript y72 contratos Node aprobados, despliegue y salud verificados. Baseline48 fallos:44 respuestas que ignoraban la intención y cuatro pérdidas de estado final; el carrito y la edición estaban conservados antes de esas aserciones. No acreditar que el bot hubiera cancelado todo ni que72 casos fueran rojos inicialmente.

Siguiente por riesgo:
0. Revisar cobertura de preguntas sobre cancelar el pedido completo (antes/después de registrar): preguntar «¿puedo cancelar el pedido?» no debe ejecutar cancelación. La búsqueda textual inicial no encontró recorridos con esa frase; auditar las suites antes de afirmar ausencia total. Probar con órdenes y efectos externos simulados, sin cancelar pedidos reales.
1. Una edición de carrito y otra compra/sustitución pendientes: «ese cambio» debe pedir dueño, no cancelar la primera estructura encontrada. Resolver luego una instrucción explícita y retomar checkout sin perder el resto.
2. Retención y consultas de cancelación para cantidad, opciones y reemplazo con sus continuaciones naturales; la matriz nueva se centra en eliminación. Variar los textos con nuevas muestras, no solo cambiar nombres de producto.
3. Pregunta o condición más una acción independiente afirmativa: contestar la consulta sin perder la compra/edición explícita ni ejecutar la condición. El helper actual es deliberadamente estrecho y no acredita esa composición.
4. Contraste nuevo del modelo y canal con límites antes de red. Dos solicitudes restantes en el tope vigente181/183; no ejecutar el histórico completo sin acotar inferencia. No confirmar órdenes externas.

## Tras retirar una edición pendiente — 17/10/2026

Tanda validada y desplegada como 22042562: docs/whatsapp-withdraw-edit-validation-1710.json, 84 nuevos casos: 72 continuaciones naturales desde checkout ya sembrado y 12 controles con varias ediciones sembradas. Baseline56 fallos/16 verdes;268 focalizadas pasan después del ajuste. Global final: 77 suites/7512 pruebas aprobadas; despliegue y salud verificados. Solo se cancela la intención pendiente, conservando el carrito; no hay historial de deshacer cambios ya aplicados.

Siguiente:
1. Condiciones y negaciones alrededor de la renuncia: no cancelar por una pregunta, frase citada o «no canceles ese cambio». Comprobar datos y respuesta, no solo estado.
2. Una edición de carrito junto con otra selección de compra/sustitución pendiente: referencia vaga debe pedir dueño; una instrucción explícita debe retirar solo su alcance. No asumir cubierto por dos claves cart-edit.
3. Distinguir «déjalo como estaba» antes de aplicar frente a después de aplicar. Sin evidencia de versión anterior, no inventar rollback ni decir que se revirtió. Diseñar contrato antes de implementar undo.
4. Contraste de conversación nueva con modelo real y límite de solicitudes antes de red; canal firmado acotado después, sin confirmar órdenes externas. Presupuesto vigente181/183: no lanzar un runner amplio con dos restantes.

## Continuación tras aclaraciones de edición — 17/10/2026

Tanda validada y desplegada como7cdbc597: `whatsapp-pending-edits-validation-1710.json`: 48 continuaciones desde checkout sembrado con dos líneas del mismo SKU, notas distintas y un adicional ajeno; total, carta, afirmación sin seleccionar, elección por número/nota y una sola orden simulada. Otros16 casos prueban directamente la frontera central de confirmación para cuatro tipos de edición, firma válida/vieja y agente simulado on/off. No equivalen a16 chats completos.

Se detectó en baseline: ocho recorridos durante pago daban otro prompt de pago en lugar de pedir la línea; ocho durante confirmación final creaban la orden al responder Si sin elegir línea. La protección ahora debe impedir confirmar cualquier edición pendiente y mostrar su selección. Global final77 suites/7428 pruebas aprobadas; despliegue y salud verificados. La global anterior de16 fallos de respuesta al cancelar reemplazo está conservada como fallida y corregida; no confundir con la final verde.

Siguiente por prioridad:
- Contrato para renuncia explícita con una edición pendiente: guardar el mismo carrito, retirar solo esa edición, conservar pago/dirección/nombre y volver a mostrar el paso de checkout sin crear orden. Tras consultar el total, una confirmación nueva debe poder finalizar una vez. Si hay varias ediciones, pedir cuál cancelar; no borrar todas por una referencia vaga. Distinguir renunciar a la eliminación de cancelar el pedido entero.
- Renunciar al cambio: «no quites nada», «déjalo como estaba», «olvida ese cambio» debe cancelar la edición pendiente sin cancelar el pedido ni impedir confirmarlo después. Probar con consulta de precio entre la renuncia y la confirmación.
- Ediciones de cantidad/atributo/reemplazo con la misma secuencia natural completa que eliminación; las pruebas de frontera central actuales solo acreditan no crear orden con metadatos pendientes.
- Varias listas abiertas o firma antigua: no ejecutar índice sobre otra lista; instrucción explícita nueva debe permitir salir del pendiente y continuar.
- Contraste nuevo con modelo real tras cerrar lo determinista, con contador antes de red y límite explícito; después canal real acotado sin confirmar órdenes externas.

## Siguiente puerta tras ráfagas completas — 17/10/2026

Tanda validada y desplegada como77b2bf9f: 12 recorridos completos por la cola pública (dos cartas ficticias, agente simulado on/off, confirmación con pausas 0/400/3400ms); 24 cruces de consulta de total + eliminación de fila en ambos órdenes; 16 controles de alcance de vaciado. Evidencia vigente `whatsapp-complete-burst-validation-1710.json`. La primera reproducción de ocho cruces vació todo el carrito: no era problema del modelo sino alcance de reglas. Global77 suites/7364 pruebas aprobadas; despliegue y salud verificados en el informe.

Próximas tandas por riesgo, sin multiplicar combinaciones que no cambien comportamiento:
1. Consulta + edición ambigua en ráfaga: dos líneas del mismo SKU con notas distintas, eliminar por nombre; debe pedir dueño y conservar ambas hasta aclarar. Probar selección posterior y consulta de precio entre medias.
2. Operaciones de alcance distinto: eliminar una unidad frente a una línea completa; cantidad repartida por atributo; conservar productos ajenos. Preservar el total correcto durante pago/confirmación.
3. Cambios de decisión: no eliminar, no cancelar, cambiar de dirección y luego corregirla; no ejecutar verbos citados en una pregunta. Separar instrucciones afirmativas de hipótesis/condiciones.
4. Contraste vivo nuevo con catálogo ficticio y proveedor, contador de solicitudes antes de red, parada al primer fallo. Techo operativo restante2 no basta automáticamente para una conversación con bucles de herramientas: presupuestar explícitamente sin reiniciar contadores. No llamar al proveedor para fallos que ya son deterministas.
5. Canal: ráfaga firmada de varios IDs, persistencia exactamente una vez y respuesta Meta entregada, conservando protección de actividad humana. La prueba menu-only entregada no acredita una conversación de pedido ni ráfagas. No ejecutar full histórico sin acotar inferencia; no confirmar órdenes externas.

Criterio de avance: carrito, estado, respuesta y DTO de orden coherentes en cada turno; no basta verificar el carrito final. Mantener prueba básica recurrente y modelos efectivos iguales entre entornos cuando se promocione explícitamente. Main no se modifica por estas tandas.

## Control recurrente de conversaciones básicas — 17/10/2026

Petición vigente del usuario: repasar chats completos sencillos durante el desarrollo, además de las familias complejas. Repetir este control cuando cambie la lógica de intenciones, direcciones o checkout. No ejecutar una global por cambios exclusivamente documentales.

```bash
npx jest --runInBand --silent --testPathPattern=whatsapp-general-accuracy --testNamePattern='basic complete ordering journeys revisited|concrete delivery setup after a basic order|Cobertura con carrito|Después de cobertura|post-order courtesy preserves terminal state'
```

El bloque básico contiene ocho conversaciones completas en dos cartas ficticias, recogida/domicilio y ambos modos de agente simulado. Cada una pasa por saludo, compra con nota, precio, cambio de opción incluida con adicional, eliminación de una línea, destino, consulta mientras espera pago, pago, confirmación y cortesía. Comprobar también el DTO de la orden, estado terminal y creación única. Otras ocho pruebas varían el prefijo de domicilio.

Antes de un candidato de piloto: añadir una conversación completa nueva y recuperar un chat real antiguo que falló; alternar carta y redacción. Conservar los controles negativos: preguntar cobertura no elige dirección, preguntar precio no compra, una cortesía no abre otro carrito y una compra explícita nueva sí puede abrirlo. Si un repaso encuentra un fallo, clasificar la capa y reproducirlo gratis antes de pagar inferencia. Los mocks no acreditan calidad del modelo ni del canal real.

# Próximas tandas de comprensión de WhatsApp

Fecha: 2026-10-11. Rama permanente: staging. Usar AGENTS.md y el relevo. Este plan describe pruebas, no acredita que el producto sea vendible.

## Detección de medios y diferencia Main/staging

Base `1e1e0268`, rama staging. Auditoría de los dos módulos compilados de WhatsApp de producción: recompilar Main a6890c4a en `/tmp/ppp-main-media-verify` con TypeScript/dependencias vigentes produjo exactamente los hashes activos en ppp_nest_api. AI `eceac7c6eb5f3455714fc5ca4cb2acd78d48a95a76f557e7f343208015b8a34c`; orquestador `90228fd9b79e5506a04ad3f68d7ed9cb801fd79dc9b5434be04c77816d48b9bc`. Es evidencia para esos dos módulos, no comparación binaria de todo el backend. Producción ejecuta Main del piloto; las tandas posteriores siguen solo en staging. En producción no está normalizeSpokenOrderCourtesy ni humanPhoneHint. No se cambió Main ni configuración productiva.

32 regresiones nuevas gratuitas: nueve de extracción de imagen, ocho de transcripción, tres de descarga, cuatro de carta/pie de foto y ocho de código/cantidad en PPP y catálogo ficticio. HTTP, modelos y Meta simulados. No acreditar mejor precisión del reconocimiento real a partir de estos mocks. Audio conserva texto español y modelo whisper-1; FLAC ahora tiene extensión FLAC. Archivos vacíos no se envían a OpenAI. Descarga de Meta comparte deadline de 30 segundos entre metadatos/binario; cada llamada de visión/transcripción tiene 45 segundos. No es un SLA total: hay cola y puede haber un segundo OCR.

Imágenes: se conserva textForBot completo, antes truncado a 500 caracteres. finish_reason=length no ejecuta un pedido parcial aunque el JSON sea válido. GPT-5 original/mini/nano y sus snapshots usan reasoning_effort=minimal para extracción; el límite sigue en 700, sin aumento ni cambio de modelo. No enviar minimal a 5.1/otras familias automáticamente. Fuentes oficiales consultadas: [parámetros GPT-5](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_new_params_and_tools) y [transcripción/formato de archivo](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create). La documentación respalda compatibilidad, no acredita causa de la foto concreta.

Carta ambigua sin selección no compra el primer producto por OCR; un pie explícito de producto o código se procesa como texto conservando cantidades aunque visión sea incierta. Un código no equivale a su número de unidades; conservar prefijo explícito o x3. Se encontró que calcular cantidad a partir de original + copia procesada convertía el código de una copia en cantidad de la otra; se usa el original una vez y se excluyen identificadores en el extractor general. No se añaden excepciones por IDs/nombres/precios.

Baselines: contrato HTTP de visión/audio 10 fallidos / 11 verdes (`/tmp/ppp-media-detection-baseline.log`); carta sin selección y cantidad del pie 2 fallidos (`/tmp/ppp-media-menu-selection-baseline.log`); selección por código 1 fallido (`/tmp/ppp-media-caption-code-baseline.log`); cantidad/código y pie explícito 7 fallidos / 2 verdes (`/tmp/ppp-media-code-quantity-baseline.log`); descarga 2 fallidos / 1 verde (`/tmp/ppp-media-download-baseline.log`). Son runs de desarrollo con solapamientos; no sumarlos como casos independientes. Intento directo con ts-node sin tsconfig-paths falló al resolver imports; repetir con tsconfig-paths confirmó el problema de copias duplicadas. No es defecto de producción.

Verificación focalizada final: 73 controles aprobados (32 nuevos y 41 existentes), cinco suites; TypeScript final sin errores. `/tmp/ppp-media-detection-targets-final.log`, `/tmp/ppp-media-detection-tsc-final.log`. Cero API pagada: presupuesto compartido sigue 11/20 usado, nueve restantes. No se modifica esquema/persistencia; no repetir matriz MariaDB.

Suite completa final: 65 suites / 1.733 pruebas aprobadas en un único run, 196,254 segundos (`/tmp/ppp-media-detection-full.log`). No se interrumpió este run ni se editó código/tests durante él.

Código `f03cc522` publicado y desplegado en staging, verificado 2026-10-11 15:40 Bogotá: running/healthy, imagen activa y candidate iguales (`sha256:2bef785e68d1e119c13bb2ca310c208e961a60f6f61d4a1f494f519e77e714af`), health OK, DB connected y circuito CLOSED. Evidencia `/tmp/ppp-media-detection-deploy.log` y `/tmp/ppp-media-detection-deploy-verified.log`. Commit posterior de documentación no requiere reconstrucción. Main y ppp_nest_api no se alteraron.

Siguiente: foto/audio originales con reproducción aislada y presupuesto; carta mal clasificada como order sin textForBot; entradas MIME desconocidas; aislamiento multitenant y ráfagas concurrentes. No atribuir a GPT-5 una mala calidad general por el fallo concreto ni afirmar que minimal lo resolvió sin inferencia real.

## Seguimiento de imagen no reconocida — aclaración específica

Base `b4ca1edd`, rama staging. El usuario indicó la respuesta de producción «Vi tu foto, escribe el plato o código; no entendí bien tu mensaje…». Corresponde al fallback de lectura de imagen con pie vago: la plantilla añadía humanHelpHint, que devuelve el aviso genérico completo. No atribuir esto al contexto de comprobante. Consulta privada de producción encontró un candidato en las últimas 24 h: una entrada image y una única salida image_clarification en la ventana de 20 s. No se exportaron cuerpos, teléfonos ni raw_payload; evidencia privada `/tmp/ppp-image-fallback-trace.log`. La estructura no acredita dos mensajes duplicados de Meta.

Se añade un texto de contacto telefónico sin el aviso genérico para errores de foto/audio y recepción de comprobantes. El resto de los fallbacks genéricos conserva su contrato. Seis nuevas regresiones con el router y dependencias externas simuladas: dos pies vagos, descarga de foto fallida, audio ilegible, comprobante explícito y comprobante que no abre. Todas comprueban una salida, conservación/no compra, instrucción específica y ausencia de la segunda aclaración. Baseline: 6/6 fallaron antes de corregir. Focalizadas: 29 controles aprobados (6 nuevos y 23 existentes); TypeScript aprobado. Logs `/tmp/ppp-media-clarification-baseline-final.log`, `/tmp/ppp-media-clarification-targets.log`, `/tmp/ppp-media-clarification-tsc.log`.

Suite completa aprobada: 63 suites / 1.701 pruebas, un único run de 192,054 segundos (`/tmp/ppp-media-clarification-full.log`). Después solo se ajustó puntuación/salto de línea del aviso de comprobante que no abre («aquí. Si prefieres…»); no cambió lógica. Esa redacción final se verifica con seis casos nuevos más dos controles de comprobante y TypeScript, sin repetir toda la suite por puntuación. Evidencia final `/tmp/ppp-media-clarification-copy-final.log` y `/tmp/ppp-media-clarification-tsc-final.log`.

Código `c48ec171` publicado y desplegado en staging; verificado 2026-10-11 15:19 Bogotá. Running/healthy, imagen activa y candidate iguales (`sha256:7367d7ccbd72d7cbd112895ec7a48649357bc4d3712588159e5677945727ff20`), health OK, DB connected y circuito CLOSED. Logs `/tmp/ppp-media-clarification-deploy.log`, `/tmp/ppp-media-clarification-deploy-verified.log`. Commit posterior de documentación no requiere reconstrucción.

El fallo de reconocimiento concreto sigue sin atribución confirmada: producción tiene un modelo diferente; no hay imagen original disponible para comparación controlada y no se registraba finish_reason de respuestas vacías en ese despliegue. No afirmar que cambiar el modelo lo corrige. Cero llamadas pagadas; presupuesto sigue 11/20 usado, nueve restantes. No cambiar Main ni configuración de producción por esta aclaración. No modifica esquema ni persistencia; no repetir MariaDB.

## Cuarta tanda PDF y fotos — contexto y contrato de pruebas

Base `6490ab41`, rama staging. Veintiuna regresiones nuevas: diecisiete de orquestador y cuatro del contrato HTTP de visión. Patrón PDF sanitizado «el mismo pasa en 10 mn por el pedido» probado con PPP y menú ficticio; negación y recogida del mensajero conservan domicilio. Estados completed/closed y contexto Nequi no convierten un resultado explícito de comida en comprobante. Menú sin selección pide elegir; foto ilegible conserva carrito; reintento OCR conserva cantidad; comprobante explícito requiere verificación manual aunque contenga un nombre de plato.

Baseline de quince casos: nueve verdes, seis fallidos. Dos controles posteriores reprodujeron falsos positivos con tercero negado y domiciliario; la regla nueva excluye ambos. La búsqueda de órdenes se simula vacía en esos controles para acreditar conservación, no estado real. La recogida declarada era absorbida por consulta de estado antes de actualizar logística; no confundir este fallo con el servicio de órdenes que faltaba en el mock tras añadir el primer detector. Se prioriza recogida declarativa con carrito, se admite tercero + tiempo «mn» y se conserva ese tiempo como nota, sin garantizar preparación. Contexto de pago/cierre deja de sobreescribir reconocimiento positivo de comida. Si el pie pide comida, una clasificación incierta no se da por comprobante. La clasificación explícita payment_proof sigue siendo comprobante y nunca acredita pago automáticamente.

Diagnóstico de la imagen reportada: lectura del servidor a las 14:50 Bogotá aproximadamente. Módulo compilado de visión idéntico en producción y staging (`eceac7c6eb5f3455714fc5ca4cb2acd78d48a95a76f557e7f343208015b8a34c`); orquestadores distintos. Configuración almacenada: producción gpt-5-mini, staging gpt-4.1-2025-04-14. No se encontraron errores Vision/Image resolve en las tres horas previas. Eso NO identifica la causa de la imagen concreta: faltan hora, respuesta exacta y reproducción con la misma imagen/contexto. No se cambió modelo ni configuración productiva. Lectura de ajustes limitada a modelo/enabled, sin credenciales; evidencia privada `/tmp/ppp-vision-config-check.log`.

El límite de visión permanece en 700 tokens: no aumentarlo ni atribuir el fallo a ese límite sin evidencia. Una respuesta vacía ahora registra modelo y finish_reason, sin OCR, imagen ni credenciales; el test reproduce una respuesta vacía con finish=length, NO acredita que haya ocurrido en producción. Nuevo `docs/whatsapp-test-contract.md` estandariza fuente, semilla, oráculo, conservación, respuesta, efectos prohibidos y separación entre regresión, reservado e inferencia real.

Cero llamadas pagadas; presupuesto compartido permanece 11/20 usado, nueve restantes. Meta/modelo/persistencia externos simulados. Pruebas de fotos recorren el límite resolveImageMessage, no acreditan visión real ni todo el checkout posterior al cierre. No se modifican esquema/transacciones; no repetir MariaDB. Main permanece sin cambios.

El primer run completo se interrumpió al añadir estos dos controles: `/tmp/ppp-pdf-fourth-full-interrupted.log` no acredita aprobación.

Verificación final: 36 controles focalizados (21 nuevos, 15 existentes), TypeScript sin errores, 63 suites / 1.695 pruebas aprobadas en un único run, 190,794 segundos. Logs `/tmp/ppp-pdf-fourth-targets-final.log`, `/tmp/ppp-pdf-fourth-tsc.log` y `/tmp/ppp-pdf-fourth-full.log`. Baselines `/tmp/ppp-pdf-fourth-baseline-final.log` y `/tmp/ppp-pdf-fourth-negation-baseline.log`.

Publicado y desplegado código `61320dd7`, verificado 2026-10-11 15:03 Bogotá: running/healthy, imagen activa y candidate iguales (`sha256:f46fb1a8caa38569ccd02d86c5062914da4fe7bc4d5071aba7f156af9edb5df9`), health OK, DB connected y circuito CLOSED. Primer SSH falló por timeout sin ejecutar deploy; el reintento terminó. Evidencia `/tmp/ppp-pdf-fourth-deploy-retry.log` y `/tmp/ppp-pdf-fourth-deploy-verified-final.log`. La primera comprobación del nuevo contenedor indicó starting, no se acredita como healthy; la final sí. Commit posterior solo de documentación no requiere reconstrucción. Main local continúa `a6890c4a`; archivos dist ajenos preservados.

Siguiente: comparación de foto original solo cuando se tenga fuente/contexto; reparto entre dos productos padre, líneas repetidas con notas y ráfagas concurrentes. No dar por cubiertos estos últimos por los tests de turnos seriales.

## Tercera tanda PDF — citas, recogida y repartos

Base `31e84085`, rama `staging`. Diecisiete casos nuevos gratuitos: citas nativas ausentes, ajenas o referidas a platos retirados; cantidad histórica que no restaura diez unidades; recogida por tercero frente al repartidor; pedido/dirección/apartamento/barrio en turnos consecutivos; reparto de un producto entre combinaciones de dos atributos, conservando notas. Controles de cantidades incompatibles, opción desconocida y conjuntos de atributos inconsistentes conservan el carrito.

Correcciones generales: la recogida explícita evita que la palabra persona active asesor; domiciliario/repartidor/mensajero y la negación explícita no activan esa nueva regla. El reparto separa por cantidad + con, conservando la conjunción entre atributos; exige el mismo conjunto de atributos en cada combinación y aplica todos sin guardar cambios parciales. No se añaden excepciones por nombre, ID ni precio de PPP.

Límites: transporte, modelo y servicios externos simulados; estas citas prueban el contexto nativo reproducido, no Meta real. Las ráfagas son turnos seriales, no concurrencia ni deduplicación. El reparto probado es de un mismo producto padre en un menú sintético: dos ejecutivos diferentes con varias opciones siguen pendientes. Recogida con nombre propio y tercera persona sin verbo recoge necesita otra tanda. Los casos ya usados son regresiones de desarrollo, no evaluación independiente. Cero llamadas pagadas; presupuesto permanece 11/20 usado, nueve restantes. Producción Main no se modifica.

Verificación: 20 controles focalizados aprobados (17 nuevos y tres de reparto existentes), TypeScript sin errores y 62 suites / 1.674 pruebas aprobadas en un único run, 190,955 segundos. Evidencia: `/tmp/ppp-pdf-third-targets.log`, `/tmp/ppp-pdf-third-tsc.log`, `/tmp/ppp-pdf-third-full.log`. Baseline inicial: diez casos, seis aprobados y cuatro fallidos antes de corregir. No se modifica esquema ni persistencia de órdenes; no repetir matriz MariaDB.

Desplegado y verificado el 2026-10-11 a las 14:41 Bogotá: código `4f009555`, contenedor running/healthy, imagen activa y candidate iguales (`sha256:632714d4b8fddf4c890241f81b2c6dc4e3eb086860b706335e38f05e39d9e0d1`), health OK, DB connected, circuito CLOSED. Evidencia `/tmp/ppp-pdf-third-deploy.log` y `/tmp/ppp-pdf-third-deploy-verified.log`. Commit posterior solo de documentación no requiere reconstruir.

Siguiente tanda: reparto entre dos productos padre, referencias a líneas repetidas con distintas notas, recogida por tercero con nombre y hora, cita antigua durante una selección nueva y concurrencia controlada de mensajes. Añadir un conjunto reservado antes de corregir, revisar respuesta y estado, y mantener oráculos derivados del catálogo.

## Tanda actual: evaluación reservada, modelo real y checkout breve

Base `53e4d1c1`, rama `staging`. Se añaden 28 regresiones gratuitas: ocho patrones reservados promovidos a regresiones tras su primera ejecución, seis recuperaciones de comparación/retiro parcial, tres comparaciones por hechos de catálogo, siete recorridos de producto+dirección y cuatro controles de álbum. El paquete de tres arepas es un SKU sintético añadido al fixture; no se presume que exista en PPP real.

Primera evaluación reservada: 6/8 aprobadas; preguntar cuál sopa era la más pequeña compraba una unidad y pedir dos paquetes producía uno. Después también se reprodujo que quitar un paquete no reducía la cantidad. Se conserva la selección pendiente al comparar y se distingue el contenido de un paquete de sus unidades. Quitar una unidad conserva notas y otras líneas; varias líneas o quitar/conservar la misma requieren aclaración. Los ocho casos pasan después de corregir; ya no son un holdout independiente. Nuevo conjunto de ocho patrones en `scripts/fixtures/whatsapp-reserved-next-patterns.json`: NO ejecutado ni conectado automáticamente todavía.

Inferencia real aislada con configuración de staging, modelo `gpt-4.1-2025-04-14`: dos conversaciones, tres intentos/respuestas exitosas, 30.520 tokens de entrada (19.968 cacheados) y 93 de salida. Los oráculos automáticos aprobaron ambas, pero revisión manual rechazó la afirmación «trucha más suave», ausente del catálogo. Solo una se acredita completa en revisión manual: tres churrascos, uno sin ensalada y dos normales. Se añade comparación determinista basada en nombre, precio, descripción y opciones; la corrección posterior se verifica gratis, NO se acredita una repetición pagada. Sin estimación de dólares: el contador de precios existente no cubre este modelo. El archivo privado temporal se eliminó. Informe aislado en `tmp/whatsapp-live-router-report.json`; copia entregable anotada en outputs del chat.

Presupuesto compartido: 11/20 intentos usados, nueve restantes. `whatsapp-live-router-rehearsal.ts` persiste cada intento ANTES de fetch, valida saldo y detecta cambios de ronda/contador. Control gratuito con límite 999 rechaza antes de red y conserva presupuesto (`/tmp/ppp-live-budget-guard.log`). No lanzar inferencia por defecto, gastar artificialmente para obtener un exit code verde ni reiniciar este contador.

Caso nuevo del usuario: productos y dirección en el mismo mensaje pasan al siguiente paso necesario del checkout al terminar el turno, solo si hay carrito modificado, dirección activa confirmada y ninguna selección pendiente. Se reemplaza la respuesta de compra retenida por el prompt de pago/confirmación; consultas no compran y una sopa ambigua conserva sus unidades hasta elegir. La confirmación final sigue explícita: no se crea una orden por mandar dirección/pago. El pie de pago no publica instrucciones que mencionan métodos deshabilitados.

Álbum: se registra el lote recibido antes de su procesamiento serial. Un sobre `other` seguido de una foto real dentro de la ventana de ráfaga omite el aviso genérico «No entendí». Foto ilegible, comprobante y mensaje no soportado aislado siguen visibles. La reproducción simula interpretación de fotos y usa router/retención de respuestas: NO acredita visión real ni confirma el payload concreto de la captura del usuario. Fotos que lleguen después de esa ventana necesitan otra comprobación; no extender el silencio indefinidamente.

Verificaciones parciales: 17 controles de reservados/recuperación/comparaciones aprobados (`/tmp/ppp-reserved-targets-final.log`), un primer run completo de 62 suites/1.563 pruebas aprobado antes de los últimos casos del usuario (`/tmp/ppp-reserved-full.log`), y 17 controles de checkout/fotos aprobados (`/tmp/ppp-checkout-photo-final.log`). TypeScript final aprobado (`/tmp/ppp-checkout-photo-tsc.log`). Primer run completo después del checkout: 61 suites aprobadas y una fallida; 1.573 pruebas verdes y un fallo del montaje de envío simulado que interceptaba la prueba de ID de Meta (`/tmp/ppp-reserved-checkout-full.log`). Esa prueba vuelve a usar el envío real con Meta simulado. Tras registrar también lotes en el webhook, pasan 21 controles focalizados y TypeScript final (`/tmp/ppp-checkout-photo-batch-final.log`, `/tmp/ppp-checkout-photo-tsc-final.log`). Repetición completa final: 62 suites y 1.574 pruebas aprobadas en un único run (`/tmp/ppp-reserved-checkout-full-final.log`), 233 segundos. TypeScript final sin errores. Código `562c283c` publicado y desplegado en staging. Verificado 2026-10-11 11:08 Bogotá: contenedor running/healthy, imagen activa y candidate iguales (`sha256:ce41ac5e9e687c16079affa499f14a20b176fba0a22c5e3634a315d3a93b627d`), health OK, DB connected y circuito CLOSED. Evidencia `/tmp/ppp-reserved-checkout-deploy.log` y `/tmp/ppp-reserved-checkout-deploy-verified.log`. El commit posterior solo de documentación no requiere reconstruir. Modelos, Meta, persistencia de órdenes y pagos simulados salvo las tres inferencias indicadas. No repetir DB: no se modifica esquema/transacciones/persistencia de órdenes.

Siguiente: nuevos reservados con catálogo y expectativas explícitas, compra referida con fecha/hora compuesta, intención informativa mezclada con compra independiente, fotografías parcialmente fallidas y correcciones de cantidades durante pago. Mantener diversidad de catálogo y revisar la respuesta completa, no solo el carrito. No declarar vendible por verde unitario o dos conversaciones pagadas.

## Tanda portable: horarios, repartos y condiciones del catálogo

Base `1e694852`, rama `staging`. Se añaden 27 casos gratuitos con el router real y dependencias externas simuladas, sobre PPP y un catálogo alternativo:
- Fechas relativas, días distintos y DD/MM; horas de 24 horas y am/pm. Cambiar solo fecha conserva hora y viceversa. Conserva carrito, dirección, pago y notas ajenas. Horas ambiguas/ inválidas, fechas imposibles y notas demasiado largas requieren aclaración sin modificar la sesión.
- Reparto por un atributo de un producto con varios atributos: conserva la otra opción y notas en ambas líneas. Opción desconocida no aplica parcialmente el reparto ni cae en una compra distinta. Cambiar varios atributos simultáneamente en cada parte todavía requiere aclaración.
- Rendimiento: comunica la frase completa de la descripción, conservando negaciones y rangos; no extrae «alcanza para tres» de «no alcanza para tres».

Reproducción inicial: 21 de 22 casos fallaban (`/tmp/ppp-portable-baseline.log`). Tras corregir y añadir tres controles de conservación/límite de notas, pasan 46 controles focalizados, incluidos los 25 nuevos (`/tmp/ppp-portable-targets.log`). TypeScript sin errores (`/tmp/ppp-portable-tsc.log`). Primer run completo: 61 suites verdes, una fallida; 1.540 aprobadas y cuatro regresiones de cocción: «3/4» se confundía con fecha (`/tmp/ppp-portable-full.log`). Se distingue la fracción de cocción de una fecha con señal explícita y se añaden dos controles de fecha 3/4. TypeScript final aprobado (`/tmp/ppp-portable-tsc-final.log`). Repetición completa aprobada: 62 suites y 1.546 pruebas en un único run (`/tmp/ppp-portable-full-final.log`). Código `b904663b` publicado y desplegado en staging. Verificado 2026-10-11 09:43 Bogotá: running/healthy, imagen activa y candidate coinciden (`sha256:0ddc6b6b62cb5d2b9429db3b9a6277ff66a8da4052436bedd5d29f8c467fe552`), API OK, DB connected, circuito CLOSED. Evidencia `/tmp/ppp-portable-deploy.log` y `/tmp/ppp-portable-deploy-verified.log`. El siguiente commit solo de documentación no requiere reconstrucción. Cero llamadas pagadas; presupuesto compartido sigue 8/20 usadas, 12 restantes.

Límites pendientes: solicitudes de horario son notas, no reservas. No se resuelven fechas relativas a calendario/zona horaria ni se valida operación futura del local. Compra referida con fecha/hora compuesta, fechas escritas con nombre de mes, citas antiguas y otras intenciones nativas requieren más casos. No acreditar todo el lenguaje ni pedidos programados operativos.

## Reutilización futura en Kamppo

Reutilizar contratos de comportamiento y componentes generales; adaptar catálogo, sesión y transporte a Kamppo. Ejecutar los mismos comportamientos con fixtures por tenant, conservando las regresiones concretas de PPP. No copiar IDs, nombres o precios de PPP como reglas de producción. Añadir una suite específica de aislamiento entre tenants para catálogo, carrito, políticas, mensajes y referencias. Puntos, pagos, horarios y condiciones comerciales deben provenir de configuración del negocio; las reglas históricas de puntos siguen pendientes de parametrización. No se ha migrado ni inspeccionado Kamppo en esta tanda.

## Tanda de pedido grande, fecha y abono — 11 de octubre

Once casos originales adicionales, dos catálogos, dependencias externas simuladas. Consultar rendimiento no compra ni inventa cuántas personas comen; solamente usa datos numéricos escritos en descripción. Abono/anticipo se coordina con el local y no modifica pago/cart. Compra explícita referida de diez cajas conserva un único producto previo; si hay carrito u otro pendiente pide aclaración. Fechas y comensales no son direcciones. Recorrido con arroz, miércoles, abono, mediodía nativo y reparto 5/5 aprobado en la revisión focalizada. Copia de respuesta más horario solo se separa con fuente Bot reciente verificable; fuente no encontrada pide aclaración sin comprar su contenido.

Verificación: 62 suites y 1.519 pruebas aprobadas en dos grupos (43 WhatsApp/1.421 + 19 restantes/98), TypeScript sin errores. Código `46a4f1bf` desplegado y verificado healthy el 2026-10-11; evidencia en el relevo. Sigue pendiente fechas/horas adicionales, negación/intervalos de rendimiento, opciones desconocidas/múltiples atributos en reparto y otras intenciones nativas. No se incorpora reserva o abono automático ni se cambia política del piloto. Cero llamadas pagadas.

## Histórico: respuestas nativas y reparto — 11 de octubre

Nueva cobertura: referencias a mensajes salientes por ID de Meta, límites por conversación/línea, referencias no recuperables o ambiguas y ausencia de compra por cantidades en la cita. Textos bot nuevos guardan ID; mensajes históricos sin ID y medios/humanos no quedan acreditados. Cambios por opción citada solamente cuando el carrito ya existe y no hay selección pendiente.

Reparto de diez unidades por atributo: 5/5 del mismo producto, tanto preparación pendiente PPP como base de bowl en otro catálogo; conservar notas, cantidades, otro plato y estado. Suma incorrecta o varios referentes requieren aclaración. Preguntar rendimiento para veinte personas no implica comprar veinte unidades.

La tanda no acredita todavía el recorrido completo con rendimiento, abono, fecha y texto copiado. Los próximos casos deben medir todo el recorrido y respuesta, no solo el carrito final. Verificación local: 62/62 suites, 1.508/1.508 pruebas y TypeScript sin errores. Cero llamadas pagadas. Publicado y desplegado `91cd9a67` en staging, API healthy y DB connected.

## Fuentes públicas revisadas

- [MultiWOZ 2.2](https://github.com/budzianowski/multiwoz/blob/fe0c8e65cfcd8462bd33c86e35f21addc84ca82b/data/MultiWOZ_2.2/README.md). Revisión fe0c8e65cfcd8462bd33c86e35f21addc84ca82b; licencia MIT. Se inspeccionó dev/dialogues_001.json: 512 diálogos, 220 con servicio de restaurante; IDs de referencia PMUL0698.json y MUL0242.json. Útil para consultas sucesivas, restricciones y cambios de objetivo. Son conversaciones de un benchmark de tareas, no pedidos reales de PPP.
- [Schema-Guided Dialogue](https://github.com/google-research-datasets/dstc8-schema-guided-dialogue/tree/e852981ae34990f4358979625854259302feaa78). Revisión e852981ae34990f4358979625854259302feaa78; licencia CC BY-SA 4.0. Se inspeccionó dev/dialogues_001.json: 128 diálogos, 29 con restaurante; IDs de referencia 1_00000 y 1_00001. Útil para intención, datos de varias entidades y contexto. Su restaurante es de búsqueda/reservas; no habilitar reservas en PPP por copiar el dominio.
- [BaristaDatasets](https://github.com/birfan/BaristaDatasets/tree/02a83940e7a5d8f4435551cf94649a9f1ec3271e). Revisión 02a83940e7a5d8f4435551cf94649a9f1ec3271e. README describe conjuntos generados con plantillas y cambios de preferencias. La licencia del dataset es CC BY-NC-SA 4.0: no se incorporan sus transcripciones ni traducciones al producto comercial.

- [FoodOrdering](https://github.com/amazon-science/food-ordering-semantic-parsing-dataset/tree/82df0797d254637a06153aae13470ac14a88bf77) y [PIZZA](https://github.com/amazon-science/pizza-semantic-parsing-dataset/tree/814d6d0f0e26e9ba5c45be281fd432dc4d069b05), de Amazon Science. README y licencias inspeccionados: CC BY-NC 4.0 en ambos. FoodOrdering distingue peticiones humanas obtenidas para menús de varias categorías y datos sintéticos. Son solicitudes de pedido con anotaciones, no necesariamente conversaciones completas. Útiles para estudiar cantidades, restricciones y atributos por producto; no se incorporan ni traducen sus ejemplos al producto comercial.

Las cantidades anteriores corresponden únicamente a los archivos inspeccionados. No se descargaron datasets completos ni se ejecutó código remoto. Los casos de PPP se escriben desde cero, con datos ficticios y patrones generales; no son chats reales descargados ni traducciones de los ejemplos. No copiar datos de personas ni respuestas históricas como oráculos.

## Secuencia y resultados que debe exigir cada tanda

1. **Consulta frente a acción y canjes**. Capacidad, negación, condición, procedimiento y petición explícita; voucher suelto con carrito vacío; registro de factura explícito; código desconocido/usado/vencido/de otra cuenta. Verificar que preguntar no gaste puntos, que no se registre un voucher como factura y que no se cambien platos.
2. **Cambios de preferencias y productos**. Correcciones antes/después de resolver una variante; cambios de bebida, cocción, acompañamiento y cantidad; conservar otra línea. Menú PPP y al menos otro catálogo. No aprobar solo porque aparece una nota: revisar alcance y contradicciones.
3. **Consultas intercaladas y referencias**. Precio, tamaño, disponibilidad y total entre elecciones; «esa», «el segundo», «el de antes», «igual» con cero/una/varias opciones. Aclarar cuando falte un referente; no agregar al consultar. Incluir atributos que comparten nombre con productos.
4. **Turnos compuestos y recuperaciones**. Compra + nota + dirección + pago; aclaración posterior; no/reinicio/espera; mensajes cortados y typos. Guardar cada intención independiente, conservar cantidades y evitar inventar sustituciones, ingredientes o productos.
5. **Medios, errores y duplicados**. Álbum de varias fotos, una ilegible, reenvío del mismo ID, texto entre fotos, comprobante que no es compra. Confirmar que no se duplique ni silencie un fallo. Interpretación simulada primero; visión real requiere imágenes originales y presupuesto explícito.
6. **Casos reservados y estabilidad**. Ejecutar el archivo de casos reservados después de cerrar una tanda de desarrollo, sin incluirlo en prompts. Repetir en otro catálogo. Inferencia real: una repetición, detener ante fallo y límite dentro de nueve llamadas restantes, compartido con el resto de esta sesión. No gastar llamadas para repetir caminos resueltos gratis.

Cada tanda debe incluir casos positivos, negativos y recuperación después de una aclaración. Variar productos por estructura de catálogo; nombres, IDs y precios específicos solo en fixtures. Los cambios de producción deben ser reglas generales. Si un caso falla, convertirlo en regresión de desarrollo y reponer el conjunto reservado; no seguir llamándolo reservado.

## Forma de ejecutar sin desperdiciar

Router real, catálogo real y guard real; modelo, Meta y sistemas externos simulados. Comparar carrito, atributos, notas, estado y respuesta después de cada turno. Para canjes comparar también saldo y llamadas de mutación. No usar cuentas reales ni crear pedidos externos.

Primero suite focalizada; corregir antes de ampliar. TypeScript y suite unitaria completa al finalizar cambios compartidos. DB solo si se cambió persistencia/transacciones, con base local descartable y guard existente. En este PC ejecutar Jest completo y Jest DB en secuencia: hubo un timeout cuando ambos compitieron, cuya causa exacta no se perfiló. Conservar el fallo en el registro y repetir solo la suite afectada; no aumentar timeouts para ocultarlo.

Registrar commit, casos ejecutados, fallos, recuperaciones, tipo de modelo y gasto. Publicar/deploy staging solo con verificaciones necesarias aprobadas. Ninguna cantidad de mocks acredita por sí sola comprensión del modelo real ni producto listo para venta.

## Tanda ejecutada el 11 de octubre

30 regresiones nuevas: nueve consultas de capacidad/condición/negación, nueve peticiones explícitas de canje, dos registros de factura, un voucher válido suelto y tres vouchers usados/vencidos/de otra cuenta; seis pedidos compuestos en PPP y catálogo sintético. Inicialmente fallaron doce casos de consultas/códigos y dos compuestos. Se corrigieron las causas y las 30 regresiones pasan.

Resultado completo: 62/62 suites, 1.463/1.463 pruebas y TypeScript sin errores. Modelo y servicios externos simulados, cero solicitudes pagadas; quedan doce del límite compartido. Los ocho casos reservados siguen sin ejecutarse. Los resultados de DB anteriores están documentados en el relevo, no se atribuyen a esta tanda.

Código `adb8d582` publicado y desplegado en staging: contenedor healthy, health OK y DB connected. Verificación del 2026-10-11; documentación posterior no cambia la imagen de código.

## Tanda de correcciones y cercanía, 11 de octubre

23 regresiones nuevas: diez de referencias/correcciones/consultas con otro producto presente, cuatro en catálogo alternativo, cuatro pedidos con cercanía en PPP y otro menú, dos controles de consulta/negación y tres respuestas de horario. Se reprodujeron cuatro fallos iniciales de variantes/cocción; el catálogo alternativo añadió defectos de plurales/cantidad/cocción y un problema de compra por nombre de color. Los 23 controles focalizados finales pasan, incluidos pasta/lentejas en otro menú y consultas/negaciones. La consulta fue clasificada como descripción en vez de disponibilidad; la ruta de cercanía ahora separa todas las consultas de compras y no permite que una consulta sin resolver caiga en agregar producto. Primera regresión completa: 62/62 suites, 1.482 pruebas (antes de cuatro controles nuevos). Segunda regresión: 61 suites pasaron y una falló; 1.485 pruebas pasaron y la consulta «Tienen sopa… aquí para la vuelta» agregó un producto. Se corrige su prioridad de disponibilidad y se repiten controles y suite completa antes de publicar.

Pendientes explícitos en `scripts/fixtures/whatsapp-development-pending.json` (registro de desarrollo, no runner automático): compra de «Bowl Verde con arroz» por nombre sigue fallando; los tests de edición lo seleccionan por código. El flujo completo de diez cajas de arroz, reparto 5/5, rendimiento por personas, pedido futuro y abono está reportado por usuario, aún no reproducido completo. Horario aislado ya se comprueba; no declarar ese recorrido aprobado. El enlace nativo de respuesta de WhatsApp (`raw.context.id`) no se resuelve hoy: las pruebas históricas de texto citado no acreditan esa función.

Próxima tanda prioritaria: enlace nativo de respuesta dentro de la misma conversación (incluidos ID ausente/ajeno/viejo), producto con nombre de color, y compra para grupos preservando producto/cantidad/variantes durante consultas y horarios. Rendimiento y políticas de programación/abono deben venir de configuración, no del modelo. Cero llamadas pagadas; saldo compartido doce.

Verificación final de esta tanda: 62/62 suites y 1.486/1.486 pruebas; TypeScript sin errores. Los 23 casos focalizados pasan. Logs `/tmp/ppp-references-approved-full.log`, `/tmp/ppp-references-approved-tsc.log`, `/tmp/ppp-references-targets-approved.log`. Cero API pagada; no se repitió DB porque no se cambió persistencia. No atribuir estos resultados a los tres pendientes de desarrollo.

Publicado y desplegado `3a5e7f42` en staging, API healthy y DB connected. Imagen activa/candidate `sha256:52255c901a457e53520753345e2fd235e2521d5a149f2696915bd6662d736dd7`.

## Tanda de recuperación compuesta — 11 de octubre de 2026

Base c39cdf39, rama staging. Main se promovió al piloto en a6890c4a y el usuario informa que ya la publicó; esta tanda no modifica Main. Se ejecutaron ocho patrones anteriormente reservados con router real, catálogo/guard reales y modelo/Meta/persistencia externa simulados: primer run 4/8 aprobados, cuatro defectos. Añadidos siete controles de portabilidad y límites: 15 regresiones nuevas en total. Los ocho patrones se marcan como desarrollo, no holdout.

Correcciones generales: comparación por hechos del catálogo seguida de compra explícita separada por interrogación; conserva consulta y compra independiente. Pedidos con nota/dirección/pago separan una coma residual después de retirar el pago, evitando usar los números de la dirección como cantidad; la nota de cocina se extrae del texto del producto. Verbos agrega/agrégame/añade permiten cantidades por vocabulario del catálogo alternativo. Perdón/disculpa + cantidad + producto corrige la línea existente, conserva dirección y retoma checkout. Compra referida usa el parser común para fecha y hora; fechas/horas inválidas requieren aclaración sin comprar, no afirma reserva.

Pruebas nuevas: comparación con bebida en PPP y menú alternativo; retiro seguido de nota sobre restantes; compra con nota, domicilio y transferencia en dos menús; precio mínimo seguido de elección de tres broaster; corrección durante pago; compra referida con fecha/hora en menú alternativo; retiro por preparación; foto válida seguida de ilegible; corrección con otra bebida presente; dos horarios/fechas inválidos; consultas negativas sin compra. La compra referida se prueba con Bowl Mediterraneo sin atributos: no se atribuye aprobación al recorrido completo de arroz/medio pollo con variantes. Fotos: interpretación simulada, no visión real. La transferencia usa el ID interno transfer (el primer oráculo esperaba incorrectamente transferencia; se corrigió el montaje).

Verificación final: TypeScript aprobado (/tmp/ppp-next-batch-tsc.log); 62 suites y 1589 pruebas aprobadas en un único run completo, 314.49 s (/tmp/ppp-next-batch-full.log). Evidencias intermedias conservadas: /tmp/ppp-next-batch-baseline.log, /tmp/ppp-next-batch-fixed.log, /tmp/ppp-next-batch-portable.log y /tmp/ppp-next-batch-final-targets.log. Cero llamadas pagadas; presupuesto compartido 11 usadas / 9 restantes. Sin cambios de persistencia/esquema: no se repitió DB.

Límites pendientes: comparación y compra independiente mientras otra selección está abierta; consultas/pedidos en varias líneas; variantes + nota + domicilio + pago; correcciones con varias preparaciones coincidentes; referencia con horario, nota y domicilio en un mismo turno; foto tardía con edición intermedia. Se escriben seis patrones originales sin ejecutar en scripts/fixtures/whatsapp-reserved-followup-patterns.json; requieren semillas y expectativas por turno antes de ejecutarse. No incorporarlos a prompts ni acreditarlos como verdes. Mantener diversidad de catálogo y revisar respuesta además del carrito.

## PDF 11/10 y lenguaje hablado — tanda actual

Fuente privada de 30 páginas leída y primeras páginas inspeccionadas visualmente. No se versiona el PDF ni su extracción con datos personales. El índice sanitizado `scripts/fixtures/whatsapp-pdf-1110-patterns.json` separa patrones ejercitados de nueve pendientes: distribución por varios atributos, sabores condicionales, citas antiguas, precios históricos, recogida por tercero, estado posterior, cancelación/pago, referencias ambiguas y ráfagas.

Los tres primeros chats se reproducen con router y catálogo reales, servicios externos/modelo simulados. Oráculos: receta de sopa explícita limita candidatos; almuerzo conserva sopa/presa, nota sin ensalada y domicilio sin comprar gaseosa adicional; elegir estilo del ejecutivo no compra un pollo entero y cambiar la bebida conserva ese almuerzo. Se añaden menús sintéticos, cantidades independientes, dirección por partes, cortesías, total, cubiertos, billete para cambio, bebida ambigua entre dos platos y audio con transcripción simulada. Las respuestas históricas del local no son oráculo comercial ni acreditan disponibilidad actual.

El audio reportado se prueba con su transcripción exacta y reconstrucciones con pausas. No se dispone del archivo original: no se acredita calidad de reconocimiento de voz, solo interpretación del texto y entrada de audio simulada. Sustituciones se guardan como solicitudes en nota; no acreditar autorización comercial, precio ni cumplimiento del cambio. Cero llamadas pagadas; presupuesto permanece 11/20 usadas, nueve restantes. Main permanece a6890c4a. Trabajar únicamente en staging.

Validación final: 36 regresiones nuevas. Focalizadas 36/36; TypeScript aprobado. Suite completa de WhatsApp: 43 suites, 1.527 pruebas aprobadas en 186,908 s (`/tmp/ppp-pdf-full.log`). Complemento: 19 suites, 98 pruebas aprobadas en 12,502 s (`/tmp/ppp-pdf-other-suites.log`). Total 62 suites y 1.625 pruebas, ejecutadas en dos comandos secuenciales; no afirmar un único run de las 62. Logs focalizados `/tmp/ppp-pdf-targets-final.log` y TypeScript `/tmp/ppp-pdf-tsc.log`. Un run anterior completo fue interrumpido para añadir el control de horario del negocio; no cuenta como aprobación. Código e40f0e36 publicado y desplegado en staging. Verificado 2026-10-11 14:04 Bogotá: HEAD e40f0e362ad08c144ee32e9b15209da81e6a0fc1, running/healthy, imagen activa y candidate iguales (`sha256:055fccb70dfecc6efb2def2a51dde1c80a2d59b35b16401d10f395ec55b87a3d`), health OK, DB connected, circuito CLOSED. Logs `/tmp/ppp-pdf-deploy.log` y `/tmp/ppp-pdf-deploy-verified.log`. El commit posterior solo de documentación no requiere reconstrucción. La tanda anterior dbef6ed4 también se verificó sana antes de esta actualización; conservar su evidencia histórica en `/tmp/ppp-next-batch-deploy-verified.log`.

## Segunda tanda PDF — dinero, referencias y catálogo alternativo

Base 83e6e89b, staging. Treinta y dos casos nuevos derivados de patrones del PDF y controles sintéticos: precio histórico frente a precio vigente, cancelación frente a “cancelo con 100mil”, consultas de disponibilidad, referencias de cantidad sin producto, demora durante compra y después del pedido, preferencia de bebida condicional, dirección y plato juntos en tres menús sintéticos. Comprueba respuesta además de conservación del carrito. Presupuesto sin cambios: cero llamadas pagadas, 11 usadas / 9 restantes.

Correcciones generales: el destino explícito después de para + calle/carrera se separa antes de aceptar el mensaje completo como dirección; los productos de catálogos alternativos no quedan dentro de la dirección. “Cancelo con” + monto se interpreta como pago/cambio, sin ampliar cancelación. Preferencia condicional compara primero opción principal y después alternativa con opciones de catálogo; no inventa bebida y pregunta el plato si hay más de uno compatible y conserva el cambio elegido por candidato para retomarlo al responder, sin duplicar el plato. Una comida con solo atributo Bebida también admite elección aunque no se llame combo. Opciones de dos letras requieren contexto explícito del atributo y límites de palabra. Consulta temporal de precio usa catálogo vigente, conserva precio del carrito y aclara cuando no hay producto identificado. Referencia de cantidad con varios platos no se atribuye automáticamente al último.

Montaje y límites: el primer run tuvo errores de montaje (servicio de órdenes no simulado, monto esperado como número aunque el contrato es texto, demora genérica sin contexto configurado); no son fallos de producción. Los oráculos se corrigieron y luego se confirmaron defectos de cambio en “cancelo con”, dirección compuesta portable, preferencia principal de dos letras y precio histórico. El control inicial de sabor usaba la opción deseada por defecto: se invirtió el orden de opciones para exigir una modificación efectiva. El ETA genérico se prueba con contexto configurado y el reclamo posterior con búsqueda de órdenes simulada vacía. No acredita consulta de estado real ni cancela órdenes externas.

Pendientes del PDF: reparto simultáneo por varios atributos, citas antiguas, recogida por tercero y ráfagas concurrentes. Los casos ejercitados pasan a desarrollo, no son un holdout. Preferencia condicional cubre la estructura “si tienes con …, si no con …”; no acreditar todos los giros condicionales. Sustituciones comerciales, reconocimiento real de audio y aislamiento multitenant operativo siguen sin acreditarse.

Verificación final: 32/32 focalizadas aprobadas (/tmp/ppp-pdf-second-final-targets.log), TypeScript aprobado (/tmp/ppp-pdf-second-tsc.log). Un único run completo aprobó 62 suites y 1.657 pruebas en 188,72 s (/tmp/ppp-pdf-second-full.log). El run anterior se interrumpió para completar el recorrido de aclaración y no cuenta como aprobación. No se modifican esquema/transacciones de órdenes; se añade un campo opcional al contexto de edición de sesión, compatible con candidatos antiguos. No se repite DB. Código 842d6876 publicado y desplegado en staging. Verificación 2026-10-11 14:24 Bogotá: HEAD 842d687600d9035ea5844c8833e6fe4014299a50, running/healthy, imagen activa y candidate coinciden (sha256:598bb61ea79e689e336d7715ff1c27791d053acbcf33542470f8ce2e2dc48ac8), health OK, DB connected, circuito CLOSED. Evidencia /tmp/ppp-pdf-second-deploy.log y /tmp/ppp-pdf-second-deploy-verified.log. Commit posterior solo de documentación sin reconstrucción necesaria. Main permanece a6890c4a.


## Tanda de OCR incierto y recuperación de audio — 2026-10-11

Base 23ccdb05, rama staging. Ocho regresiones nuevas con PPP y menú ficticio: foto incierta con un único producto visible, sin pie o con «Esto», no selecciona; selección escrita explícita se conserva; audio fallido seguido de pedido por texto recupera cantidad sin repetir error. Cuatro fallos iniciales reproducidos en /tmp/ppp-media-uncertain-baseline.log. Se evita convertir OCR incierto sin pedido propuesto en compra, incluso cuando visión no devuelve reply. Dieciocho controles focalizados aprobados (/tmp/ppp-media-uncertain-targets.log) y TypeScript aprobado (/tmp/ppp-media-uncertain-tsc.log). Suite completa aprobada: 65 suites y 1.741 pruebas, 196,519 s (/tmp/ppp-media-uncertain-full.log). Cero llamadas pagadas, presupuesto permanece 11/20 usadas y nueve restantes. Percepción simulada; no acredita el archivo original. Main no cambia.

Código 781710ad publicado y desplegado; verificado 2026-10-11 16:04 Bogotá: running/healthy, imagen activa y candidate iguales sha256:6bbfe133237a9a71081133dd38b85ad245093c09572fe552fe82a274e5781cc9, health OK, DB connected y circuito CLOSED. Evidencia /tmp/ppp-media-uncertain-deploy-verified.log. Próxima tanda: ráfagas de fotos con edición intermedia y consultas explícitas junto a imagen, simuladas primero; originales pendientes para acreditar percepción real.


## Comparación efectiva de modelos — 2026-10-11

Lectura directa de settings dentro de contenedores: producción ppp_nest_api usa gpt-5-mini; staging ppp-staging-api-1 usa gpt-4.1-2025-04-14. Ambos usan whisper-1 para transcripción (confirmado también en módulo compilado de producción); el texto transcrito pasa al router y modelo conversacional del entorno. Visión comparte openaiModel con conversación, no tiene modelo independiente. Producción mantiene límite de visión 700 sin reasoning_effort; staging incorpora minimal para familia GPT-5 original, aunque hoy corre GPT-4.1 y no envía ese parámetro. El límite max_completion_tokens incluye razonamiento y salida visible según https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create . Esto es hipótesis de fallo, no causalidad probada ni comparación de calidad. No se encontraron líneas Vision empty/incomplete response con patrón esperado en logs de producción de últimas 48 horas; ausencia de ese log no descarta truncamiento en código antiguo.

No se cambiaron modelos ni configuración de producción/staging; cero inferencia pagada, saldo 11/20 usadas. Para comparación válida usar mismo código, catálogo, prompt y archivo original con ambos modelos; medir extracción, cantidad, atributos, finalización, latencia y uso. Comparar solamente dos WhatsApps actuales confunde modelo con versiones distintas. Audio: comparar primero transcripción original, luego interpretación; cambiar modelo conversacional no cambia whisper-1. Documentación oficial consultada: https://developers.openai.com/api/docs/models/gpt-5-mini y https://developers.openai.com/api/docs/models/gpt-4.1 .


## Modelos alineados y formatos de audio — 2026-10-11

Por solicitud del usuario se actualizó SOLO el setting de staging a gpt-5-mini, igual que producción, y se reinició únicamente ppp-staging-api-1. Health OK/healthy y DB connected después. Audio sigue whisper-1 en ambos; versiones de código distintas, por lo que mismo modelo no garantiza igual comportamiento. Lecturas previas gpt-4.1 corresponden a tandas históricas, no al runtime actual. No se modificó Main ni producción.

Siete controles nuevos de audio: WAV/M4A/MPGA y cuatro respuestas inválidas del proveedor. Un fallo inicial: MPGA se nombraba OGG; corregido en audioExtension. Validación: 3 suites y 31 pruebas aprobadas (/tmp/ppp-aligned-model-audio-tests.log), TypeScript aprobado (/tmp/ppp-aligned-model-tsc.log). Baseline /tmp/ppp-aligned-model-audio-baseline.log. Cambio limitado al mapeo de formato de audio; no se repitió suite completa ni se atribuyen 1.748 aprobaciones. Cero llamadas pagadas; 11 usadas, nueve restantes.

Para mejorar reconocimiento comparar originales con whisper-1 y gpt-4o-mini-transcribe, mismos archivos y oráculos de cantidades/productos/notas/dirección. Documentación oficial https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe describe mejoras frente a Whisper, no acredita mejora local. Solicitar 3–5 audios originales con transcripción esperada, incluidos ruido, pausas y correcciones. Hay patrones del PDF pendientes; no requiere nuevos chats para seguir simulaciones. Próxima tanda: ráfagas, edición intermedia y consultas con fotos. No migrar audio en ambos entornos sin medir antes.

## Corrección de alineación por solicitud humana — 2026-10-11

El usuario indicó conservar el modelo observado funcionando en staging: se cambió el setting de producción y staging a gpt-4.1-2025-04-14 y se reiniciaron exclusivamente ppp_nest_api y ppp-staging-api-1. Relectura de ambas DB confirma el mismo modelo. Audio sigue whisper-1. Se reemplaza la alineación temporal anterior a gpt-5-mini; no modificarla en próximas tandas por rutina. No se cambiaron ramas/código ni se fusionó staging a Main. Staging running/healthy, health OK y DB connected. Producción running (sin healthcheck Docker); comprobar endpoint de health. Cero inferencia pagada. Modelos iguales no eliminan diferencias de versión de código.


## Medios secuenciales y corrección de cantidad — 2026-10-11

Diez regresiones nuevas: foto selecciona dos platos, corrección textual o audio transcrito cambia a tres sin sumar; foto ilegible posterior conserva edición; consulta de precio junto a foto incierta no compra. PPP y Bowl Mediterraneo sintético. Dos controles negativos evitan convertir «tres más» o pedido compuesto en cantidad absoluta. Cuatro fallos iniciales en /tmp/ppp-media-sequential-baseline.log; la regla de cortesía aceptaba «Perdón tres» pero no «Perdón quiero tres». Se admite quiero opcional después de disculpa explícita, conservando límites.

Diez focalizadas aprobadas (/tmp/ppp-media-sequential-tests.log); TypeScript aprobado (/tmp/ppp-media-sequential-tsc.log); suite completa 65 suites y 1.758 pruebas, 197,074 s (/tmp/ppp-media-sequential-full.log). Servicios/modelo simulados, cero API pagada, saldo nueve. No acredita concurrencia de ráfagas, reconocimiento de archivos originales ni prueba de modelo real. GPT-4.1-2025-04-14 sigue configurado en ambos entornos; producción no recibe este cambio de código. Próxima tanda: referencias con varias líneas y pedidos distribuidos entre variantes, con consulta intercalada.

Desplegado ad7f019e en staging, verificado 2026-10-11 16:40 Bogotá: running/healthy, candidate y contenedor coinciden sha256:f6cfbc3eeeb03a55bf5283660327c955f7394095904226b52cabbcfc18d300bd, health OK, DB connected, CLOSED. Evidencia /tmp/ppp-media-sequential-deploy-verified.log.

## Promoción autorizada a Main — 2026-10-11

Staging 663808ce fusionada en Main conservando cambio de puntos 0cd81307. Main local/remota publicada en 5525e502. Validación de combinación: 65 suites, 1.758 pruebas, 208,422 s (/tmp/ppp-main-promotion-full.log), TypeScript aprobado (/tmp/ppp-main-promotion-tsc.log). Ambas configuraciones efectivas reconsultadas: gpt-4.1-2025-04-14; audio whisper-1. No se reconstruyó/desplegó producción en esta promoción: publicación Git no equivale a deploy. Staging se conserva para próximas tandas. Cero inferencia pagada.


## Cambios nuevos, foto por código y ejecutivo en mensajes — 2026-10-11

Revisados y preservados cambios locales de catálogo, parser compuesto, menú nombrado, pagos y webhook. Direcciones pegadas, notas dentro de menú, reparto de dos ejecutivos y encolado de lote antes de esperar. Foto reconocida como código único se resuelve a nombre de catálogo para usar defaults; PPP y catálogo alternativo con hasAttributes explícito. El montaje alternativo inicial omitía hasAttributes y no acredita defecto de producto por sí solo.

Primera regresión completa falló: 14 casos, 3 suites (/tmp/ppp-new-changes-full.log). Corregidos límites: repetición de cantidad solo misma cantidad/referencia breve; monto temprano exige afirmación de pago, no pregunta ni opción numérica; continuación de menú solo multilínea; destino comercial seguido de dirección no queda como producto. Recuperación 256 pruebas /3 suites (/tmp/ppp-new-changes-recovery.log). TypeScript aprobado /tmp/ppp-new-changes-tsc-final.log. Run completo posterior 65 suites y 1.787 pruebas aprobado, 205,563 s (/tmp/ppp-new-changes-full-final.log).

Después de ese run se agregaron dos regresiones exactas del usuario: ejecutivo, mondongo/pollo frito/pierna pernil/papa salada, limonada en tres turnos separados y texto agrupado. Ambas pasan (/tmp/ppp-executive-three-turns.log): un ejecutivo id22, qty1, opciones correctas y nota papa salada. No afirmar 1.789 pruebas en único run ni lote auténtico de Meta: esos dos tests son router con agente deshabilitado y servicios simulados. El webhook tiene prueba separada de encolado; falta ejercicio end-to-end con eventos reales. Cero inferencia pagada; nueve solicitudes disponibles. Modelos GPT-4.1-2025-04-14 alineados; audio whisper-1. Main no recibe automáticamente esta tanda.

Tanda 1f1b2dfa desplegada y verificada 2026-10-11 19:31 Bogotá: running/healthy, candidate y activa iguales sha256:71da375cd5a34dfb14c72082041f142e7d8fd848f262598900f68705c6c609ec, health OK/DB connected/CLOSED. Evidencia /tmp/ppp-new-changes-deploy-verified.log. Primera comprobación durante build mostraba imagen antigua y no cuenta como deploy terminado.


## Ráfagas concurrentes y menús con cantidad — 2026-10-11

Ocho regresiones nuevas pasan por handleIncoming concurrente y reloj simulado: tres burbujas completan un ejecutivo PPP o menú vegetariano ficticio; cantidades uno/dos; reintento de una burbuja con mismo ID. Comprueban una sola respuesta, una línea, cantidad/atributos/nota exactos. Dos fallos iniciales: dos menú vegetariano no reconocido; se amplía marcador de cantidad en isNamedMenuDishOrderPhrase. Baseline /tmp/ppp-complex-burst-baseline.log. Focalizadas 27 pruebas/3 suites (/tmp/ppp-complex-burst-tests.log), TypeScript aprobado (/tmp/ppp-complex-burst-tsc.log), full único 65 suites y 1.797 pruebas, 206,344 s (/tmp/ppp-complex-burst-full.log). Incluye los dos casos exactos añadidos después del run previo.

Meta/modelo simulados; no son mensajes reales enviados ni acredita latencia/entrega de Meta. El usuario autoriza ráfagas WhatsApp al número de pruebas cuando se necesiten; conservar guard de destinatario, aislamiento y límite de API compartido. Esta tanda usa cero llamadas pagadas, saldo nueve. No modifica Main ni modelos. Próxima tanda: ráfagas con pausa larga, cambio de intención y mezcla foto/audio/texto; no asumir que todo mensaje siguiente pertenece al mismo plato.

Desplegado c32574dc, verificado 2026-10-11 19:45 Bogotá: running/healthy, imagen activa y candidate iguales sha256:2c488d5c82c8f0d394b8f0bc675f70692c8e7e1a4080a8a653cfb29732262460, health OK, DB connected, CLOSED. Evidencia /tmp/ppp-complex-burst-deploy-verified.log.

## Tanda en desarrollo: extras dentro de ráfaga

Ocho regresiones nuevas en general-accuracy: PPP y menú vegetariano, cantidades 1/2, mensajes separados o ráfaga concurrente, bebida incluida + sopa adicional aparte. Resultado inicial seis fallos y dos verdes (PPP separados), /tmp/ppp-burst-extras-tests.log. Estado NO publicable: pruebas locales rojas conservadas, sin cambio de producción ni deploy. En PPP ráfaga la sopa del adicional sustituye la sopa incluida y se replica nota; en sintético pierde cantidad/opciones incluso separado. Registro sanitizado scripts/fixtures/whatsapp-burst-extras-development.json. Resolver alcance por línea y prioridad de selección pendiente antes de aceptar sopa como SKU independiente. No marcar estos casos aprobados ni saltarlos. Cero API pagada, nueve restantes. Última release saludable c32574dc; documentos publicados posteriores 2d300b3e.


## Cierre de extras dentro de ráfaga — 2026-10-11

Los ocho casos pendientes ahora pasan. Se delimita texto del menú antes de una línea de compra adicional explícita, se conserva texto propio del extra y no se heredan notas globales. Opciones con nota se procesan sin retirar elecciones del catálogo; «de tomar» no bloquea opción de bebida. Lectura de cantidad de catálogo acepta «quiero pedir dos…». No usar originalText con dirección al agregar menú: produjo cantidad 7 por calle 7 y se revirtió ese intento.

Recuperación inicial 6/8 y luego 7/8; full intermedio tuvo 15 regresiones de ediciones, corregidas con protección de nombres/opciones. Suite general intermedia 486/487, último fallo dirección corregido. Evidencias /tmp/ppp-burst-extras-recovery.log, recovery2.log, general-final.log y full.log; no acreditan aprobación final. Validación final 12 focalizadas aprobadas (/tmp/ppp-burst-extras-approved-targets.log), TypeScript aprobado (/tmp/ppp-burst-extras-tsc-final.log), 65 suites y 1.805 pruebas en único run completo, 206,618 s (/tmp/ppp-burst-extras-full-final.log). Registro JSON actualizado a development_regressions_passed. No se cambiaron oráculos para aprobar. Meta/modelo simulados, cero llamadas pagadas, nueve restantes. Main no recibe esta tanda.

Desplegado b37179cc, verificado 2026-10-11 20:05 Bogotá: running/healthy, activa/candidate iguales sha256:3b0181c6d55435a3ea6a5036246effe958faa7de966c2b51fe1ee05852cb46af, health OK/DB connected/CLOSED. Evidencia /tmp/ppp-burst-extras-deploy-verified.log.


## Pausas y correcciones después de extra — 2026-10-11

Seis regresiones nuevas en general-accuracy, sin cambio de código de producción: PPP y Menu Vegetariano ficticio, 5/60 segundos entre mensajes vía handleIncoming con fake timers, dos almuerzos con sus opciones y una sopa extra sin notas ajenas. Consulta de precio intercalada no muta carrito; «Perdón quiero tres [menú]» cambia cantidad del menú sin tocar sopa adicional. Seis pasan de entrada (/tmp/ppp-pauses-tests.log); controles relacionados 33 pruebas/2 suites aprobadas (/tmp/ppp-pauses-related-tests.log), TypeScript aprobado (/tmp/ppp-pauses-tsc.log). No se repite suite completa porque no hay implementación nueva; no atribuir 1.811 a full. Último full sigue 1.805. Cero llamadas pagadas y no se enviaron WhatsApps reales; clock/Meta/modelo simulados. Tanda solo pruebas/documentos: no requiere rebuild. Última imagen saludable b37179cc. Main intacta. Próxima tanda: dos platos compatibles con una opción, referencia «el segundo» y foto/audio entre las burbujas; crear baseline antes de modificar.


## Elección posicional dentro de cambio ambiguo — 2026-10-11

Ocho nuevas regresiones en PPP/otro catálogo: el primero/el segundo/2 eligen una línea para cambiar opción y agregar nota, conservando cantidad y otra línea; el tercero fuera de lista conserva carrito y pendingCartAttributeEdit. Baseline seis fallos y dos verdes /tmp/ppp-ordinal-edit-baseline.log. Se admite referencia posicional solo con pendingCartAttributeEdit y firma de carrito vigente; se muestra lista numerada en orden de carrito. Debug detectó orden inverso de candidatos; ahora ordena índices antes de mostrar/persistir. No alterar referencias de listas antiguas: selección se aplica según candidatos almacenados. Los mocks de debug eliminados antes de validar.

14 focalizadas aprobadas /tmp/ppp-ordinal-edit-targets-final.log; TypeScript /tmp/ppp-ordinal-edit-tsc.log aprobado; full único 65 suites/1.819 pruebas, 213,674 s /tmp/ppp-ordinal-edit-full.log. Incluye seis controles de pausas publicados en tanda previa. Cero API, nueve restantes. Modelo/Meta simulados. Main no recibe la tanda. Próximo: invalidación por cambio de carrito durante aclaración y retorno desde foto/audio al referente; no interpretar ordinal sin elección pendiente.

Desplegado 3a0914cc, verificado 2026-10-11 20:19 Bogotá: running/healthy, candidata/activa iguales sha256:d984e9fb117ab30c7da612562e72727cabb27e791becfa346cf5496806c7cafa, health OK, DB connected, CLOSED. Evidencia /tmp/ppp-ordinal-edit-deploy-verified.log.


## Preparación de ensayo real WhatsApp — 2026-10-11

Usuario solicita WhatsApp real y mejora de audio. Runner human-rehearsal actualizado de rama histórica a staging; solo workflow_dispatch, sin autoenvíos por push. Cinco pruebas node offline aprobadas (/tmp/ppp-live-preflight-offline.log), commit4e7390de publicado; cambio de runner/workflow sin rebuild API. GitHub CLI no autenticada local/servidor, pero credencial Git existente permitió dispatch sin imprimir claves. Preflight real terminado éxito: https://github.com/wilmerx5/PPP-NEST/actions/runs/38191659364 . Informe privado /tmp/ppp-real-preflight-report: ok=true, authorized_context/health_database/staging_admin_login/effective_staging_target/catalog_and_empty_chat/logout verdes; webhookPosts=0 y steps vacíos. NO acreditar mensajes WhatsApp enviados ni modelo real por este preflight.

Próximo: añadir y verificar límite de intentos de inferencia efectiva para ensayo real antes de execute=true; runner actual tiene 11 pasos y no impone tope al modelo del backend. Saldo compartido nueve; no gastar sin límite ni activar workflow de 11 pasos asumiendo que todos serán deterministas. Mantener un único destinatario, no confirmar pedidos y detener con actividad concurrente. Audio permanece whisper-1, gpt-4o-mini-transcribe es candidato documentado, no migrado. Faltan archivos originales y transcripción esperada para comparar calidad; no contar transcripciones simuladas como reconocimiento real. Cero API pagada esta tanda. Main intacta.


## API real y revisión de cobertura PDF — 2026-10-11

Runner full-router ejecutado con key/config privada de staging; modelo gpt-4.1-2025-04-14, Meta/órdenes/persistencia aislados. Primer intento max3 paró por límite antes de respuesta final, consulta y carrito correctos pero agent_error de presupuesto: NO es rechazo de comprensión. Informe /tmp/ppp-api-capped-report.json, log /tmp/ppp-current-model-api.log. Repetición focalizada del mismo recorrido max4: context-question-then-other-purchase aprobada con cuatro respuestas exitosas, consulta mojarra no compra, elección posterior añade una trucha asada. Log /tmp/ppp-current-model-api-completion.log y tmp/whatsapp-live-router-report.json ignorado. Los otros dos casos seleccionados inicialmente NO se ejecutaron por stop-on-failure; no acreditarlos. Siete intentos nuevos, total18/20 y DOS restantes. Local ledger previo8/12 estaba desactualizado; sincronizado desde registro autoritativo. Temporal privado de credenciales eliminado.

Índice PDF:24 patrones de desarrollo ejercitados y2 pending_not_executed. Distribución completa de varios atributos/papa por línea y ráfaga pedido/dirección/barrio aún requieren cierre; los tests recientes cubren partes, no sirven para marcar todo patrón aprobado. Audio sigue whisper-1; faltan originales para comparación de percepción. Esta ronda no envió WhatsApps reales ni confirma órdenes; API real no equivale a Meta real. No fijar coste USD: proveedor reporta tokens, informe no tiene tarifa calculada. Mantener saldo2 como límite compartido, no reutilizar cifras históricas de nueve/doce. Main intacta.


## Autorización adicional y API real — 2026-10-11

El usuario autorizó 20 llamadas adicionales, sumadas a dos restantes: límite acumulado40, saldo inicial22; no se reinicia usado18. Tanda max10 intentos, una repetición y stop-on-failure: cinco conversaciones aprobadas con full-router/modelo/config de staging. Dos usan API (arroz con harto ají + consulta de jugos, ejecutivo con sus opciones + sopa adicional); tres deterministas (sopa/cantidad tras consulta de bebidas, pollo/cantidad tras precio, aclaración de arepas+nota). No acreditar esas tres como inferencia real. Siete respuestas API exitosas, sin errores; total25/40, QUINCE disponibles. Modelo gpt-4.1-2025-04-14. Log /tmp/ppp-api-additional-round.log; reporte ignorado tmp/whatsapp-live-router-report.json; resumen sanitizado outputs/PPP-api-ronda-adicional.json en chat. Ledger primario/local y AGENTS actualizados.

Nuevo escenario versionado pdf-executive-options-extra-after-interruption: dos ejecutivos, mondongo/frito/pierna pernil/papa salada, limonada y sopa adicional independiente. Runner real aprobó cantidades/atributos/notas/respuesta. Los nombres son fixtures y oráculos del catálogo de ensayo, no excepción productiva. Meta/órdenes/persistencia aisladas, no se enviaron mensajes reales. No se hicieron cambios de implementación ni se reconstruyó API; no repetir full gratuito por rutina. Temporal de credenciales eliminado. Main no cambió. Audio sigue pendiente de originales. No atribuir cobertura al PDF completo ni presupuestos históricos como vigentes.


## Cierre de patrones PDF en backend — 2026-10-11

Cinco nuevas regresiones: reparto de ejecutivo con presa/sopa y notas papa salada/sin ensalada por unidad; otro catálogo con base/sopa/notas diferentes; rechazo atómico de suma incompatible; pedido/dirección/barrio en handleIncoming concurrente con una respuesta en PPP/otro menú. Un fallo inicial: nota papa salada perdida (/tmp/ppp-pdf-pending-baseline.log). Se extrae nota por cada parte del reparto, filtra texto ya representado por atributos y conserva nota compartida previa. No autoriza sustituciones comerciales: son solicitudes de cocina.

Seis focalizadas (cinco nuevas+control) aprobadas /tmp/ppp-pdf-distribution-targets.log; TS /tmp/ppp-pdf-distribution-tsc.log aprobado; full65suites/1.824pruebas,210,518s /tmp/ppp-pdf-distribution-full.log. Índice PDF ahora26patrones ejercitados y0 sin ejecución de backend, con verification_pending separado para Meta/percepción/inferencia. No acredita todos los chats del PDF ni todas variaciones. Simulado primero, cero API; quedan15 de40 autorizadas. Main intacta.

Desplegado f35636c1, verificado 2026-10-11 20:48 Bogotá: running/healthy, candidata/activa iguales sha256:9108be6d066641d51e9d539a79a894053891996f840b302e9e0ca1ac42fdd5a9, health OK/DB connected/CLOSED. Evidencia /tmp/ppp-pdf-distribution-deploy-verified.log.


## Revisión de cambios locales y pedidos largos — 2026-10-12

Base eb58f33b. Revisados/preservados cambios locales en catálogo, glosario, clasificación, notas, menús nombrados y numerosas regresiones de ejecutivos. Incluye cinco casos reservados preparados previamente pero no publicados y cinco nuevos pedidos completos largos: PPP tres productos/notas/cocción/dirección/pago con ;, saltos o y; menú ficticio tres productos, seis unidades, base y notas independientes. Baseline de largos cinco fallos, /tmp/ppp-long-orders-baseline.log. Correcciones: separadores explícitos conservan cantidad/texto, no cortan por decimal; cantidades por vocabulario de catálogo; cocción y nota coexisten; no absorber extra en atributos ni fusionar dos menús; límites de palabras de pago aceptan puntuación; seleccionar candidato de bebida válido antes de priorizarlo.

Full intermedio detectó12regresiones (5suites) /tmp/ppp-long-orders-full.log. Corregidas con casos originales intactos; intento full-final durante cambios no acredita aprobación. Debug comparó catálogo HEAD/current con transpile-only por conflicto nominal TS, luego se eliminó fuente temporal y typecheck aprobado. Validación final estable: TypeScript /tmp/ppp-long-orders-tsc-approved.log aprobado;65suites/1.888pruebas,126,04s /tmp/ppp-long-orders-full-approved.log. Focalizadas de pago/largos43 y últimas de marca/largos10 aprobadas. No repetir matrices DB: no hubo cambios de persistencia.

Runner con configuración real y agente habilitado para long-complete-order-three-products aceptó carrito/notas/dirección/pago/respuesta,0solicitudes de OpenAI; exit1 porque exige successfulResponses>0. No es fallo comercial ni inferencia real. /tmp/ppp-long-orders-api.log. Saldo25usadas/15restantes de40, no sumar acceptedConversations de API. Credenciales temporales eliminadas. Meta/persistencia simulados, sin WhatsApps enviados. Índice de reservados actualizado: dos consumidos en desarrollo, una comprobación parcial de foto con carrito sembrado, tres patrones aún reservados. No afirmar recorrido original de foto aprobado ni todos los casos PDF/holdout.

Diferencia entre asistente y bot: interpretar texto y ejecutar una mutación exacta son responsabilidades distintas. Esta tanda mostró fallos en la capa de segmentación/alcance/persistencia del pedido aunque algunos productos se reconocían. No atribuirlos automáticamente a modelo inferior ni prometer comprensión perfecta. Main no recibe la tanda.


## Caso exacto ejecutivo Plazuela — 2026-10-12

Regresión con el texto original del usuario (eejcutivo, enslada, ala pechuga, mondongo, papa salada y dirección). Aprobada: una sola línea de ejecutivo frito, cantidad1, Presa Ala, pechuga, Sopa Mondongo, notas sin ensalada/papa salada y dirección conservada. Prueba focalizada1 aprobada /tmp/ppp-exact-executive-plazuela.log, añadida después del full estable1.888; no afirmar full1.889. Backend simulado, cero llamadas pagadas, sin Meta. Implementación ya incluida en8c61b17c.

Despliegue staging verificado 2026-10-12 11:31 Bogotá: checkout3f2862e, API running/healthy, candidata/activa iguales sha256:b19ad6786cf37dac2a8a3b4435aa62c6c149beafd0de58c963568b1b75ddd2f5, endpoint health ok/DB connected/CLOSED. Evidencia /tmp/ppp-long-orders-deploy-verified.log. Main/producción sin cambios.


## Generalización entre restaurantes — tanda 2026-10-12

Base55836de3. Se añadieron15 regresiones en tres catálogos aislados (vegetariano, marino, oriental), sin productos PPP: opción y sopa incluidas + dirección; sopa adicional explícita; consulta de precio sin compra; corrección posterior que conserva cantidad/sopa/nota; opción compartida por dos líneas requiere aclaración sin mutación. IDs/nombres/opciones son fixtures, no reglas de producción. Once de doce casos iniciales pasaron; "Mejor con Ternera" falló mientras preparación/base funcionaban. Se acepta "mejor" como marcador general de corrección en resolveCartAttributeOnlyUpdate; únicamente opciones presentes y objetivo inequívoco. No añadir excepción para Ternera ni para Menu Oriental. Focalizadas23 aprobadas (15 nuevas +8 controles existentes) /tmp/ppp-catalog-generalization-final.log; TypeScript aprobado /tmp/ppp-catalog-generalization-tsc.log. Full final estable:65 suites/1.904 pruebas aprobadas en126,524s, /tmp/ppp-catalog-generalization-full.log. Cero API/Meta, presupuesto25/40,15 restantes.

Límite de evidencia: esta tanda acredita menús con atributos del catálogo, no cualquier restaurante. La protección de componentes todavía utiliza la identificación de menú nombrado (menuDishHost, tokens de menú/ejecutivo/bandeja); algunos helpers de estilos y porciones tienen vocabulario gastronómico específico. No confundir ausencia de IDs PPP con generalización universal. Próxima tanda: productos compuestos sin esos tokens (hamburguesas, pizzas, bowls), colisiones entre opción incluida y producto vendible, opciones inexistentes y atributos con precio/cambio no permitido; definir expectativas desde datos del catálogo antes de cambiar reglas. Si el catálogo no representa inclusión/precio/permisos, aclarar o ampliar contrato, no inventar equivalencias comerciales. Las consultas de precio y ambigüedades cubiertas en esta tanda no prueban todas las consultas posibles.

Desplegado staging f9ed5de4, verificado2026-10-12 11:39 Bogotá: API running/healthy, imagen candidata=activa sha256:f1b267688b1480e1eececce5a241176c8aa4446a66abc7535de5e877e079023e, health ok/DB connected/CLOSED. Primer chequeo durante arranque retornó starting/curl56; segundo sano. Evidencia /tmp/ppp-catalog-generalization-deploy-verified.log. Producción intacta.


## Compuestos sin menú nombrado — 2026-10-12

Baseb95853ac. Veintiuna regresiones nuevas en hamburguesa artesanal, pizza campestre y bowl tropical, con opciones de queso/masa/base y SKU independiente que colisiona con la opción. Comprueban componentes incluidos, extra explícito, pedidos completos con tres separadores/dirección/transferencia, corrección seguida de precio sin mutación y aclaración seguida de elección del segundo. Dieciocho casos iniciales aprobados; tres aclaraciones fallaron. Identidades anidadas (producto y producto Premium) seguían ambiguas después de elegir. Se prioriza identidad explícita más larga solo si las otras identidades coincidentes están contenidas en ella; nombres diferentes o iguales siguen ambiguos. Se elimina nota exacta "con <opción>" si el atributo ya la representa, conservando notas mixtas/cantidad/otros platos. Nada de IDs/nombres/precios ficticios en reglas.

Focalizadas44 aprobadas /tmp/ppp-compound-catalog-approved.log; TypeScript aprobado /tmp/ppp-compound-catalog-tsc.log; full65suites/1.925pruebas126,661s /tmp/ppp-compound-catalog-full.log aprobado. Cero OpenAI/Meta/órdenes externas; saldo25usadas/15restantes. No afirmar universalidad, permisos de sustitución ni extras tarifados que el contrato no modele. Siguiente tanda: opciones fuera del catálogo, preguntas condicionales sin compra, precio de cambios, cambios durante checkout y alcance cuando se nombran varios platos explícitamente.

Control adicional antes del cierre: tres casos con ambos nombres explícitos (producto y producto Premium) detectaron compra adicional incorrecta, /tmp/ppp-compound-multiple-identity.log. Prioridad al nombre más específico solo si, después de quitarlo del mensaje, no queda otra identidad explícita. Los24 casos nuevos +23controles pasan (47focalizadas) /tmp/ppp-compound-catalog-final-approved.log. Se repite full/TS por cambio nuevo; el full anterior1.925 no acredita el estado final. El primer deploy2af2dd8b terminó antes del control; preparar nueva versión tras aprobación final.

Full final intermedio detectó2regresiones (64suites/1.926pruebasaprobadas): identidades con prefijo numérico "1 Pollo Frito" no se eliminaban al leer "pollo frito". Corregido quitando prefijos de cantidad de identidad, de forma general.49focalizadas aprobadas /tmp/ppp-compound-catalog-recovery.log; volver a acreditar con full estable y TS. No usar /tmp/ppp-compound-catalog-full-final.log como aprobación.

Aprobación final estable:65suites/1.928pruebas126,195s /tmp/ppp-compound-catalog-full-stable.log; TypeScript aprobado /tmp/ppp-compound-catalog-tsc-stable.log.24 nuevas en esta tanda. Cero llamadas pagadas, presupuesto intacto.

Despliegue final staging a46e3cb8 verificado2026-10-12 11:54 Bogotá: running/healthy, activa=candidata sha256:5ddcff93a43832a4c7e0b44ded8c3ab6c0130cf1edaeacb4858155dcbd904b2e; health ok/DB connected/CLOSED. /tmp/ppp-compound-catalog-deploy-verified.log. Main/producción intactas; sin cambios de modelo/presupuesto.


## Puerta previa al piloto — consultas opciones y cierre (2026-10-12)

Base251c1182.30casos nuevos en hamburguesa/pizza/bowl: preguntas de posibilidad, precio de cambio, opción inexistente con opciones válidas en respuesta, cantidades1–3 con dirección numérica, consulta condicional en confirmación, cambio de opción/dirección/cantidad durante cierre. Baseline18casos tuvo9fallos: consultas modificaban atributos; quantity source incorporaba dirección y terminabaqty10. Corrección: preguntas de posibilidad y recargo se responden antes de mutaciones; cantidades de add se calculan sobre productText sin dirección/pago. Ampliación exigió opciones útiles ante inexistente y detectó3respuestas genéricas incorrectas: se muestran opciones del atributo nombrado, sin mutar pedido. No se añaden excepciones por nombre/ID.

Focalizadas76 aprobadas /tmp/ppp-pilot-gate-approved.log. Full65suites/1.958pruebas125,785s aprobado /tmp/ppp-pilot-gate-full.log; TypeScript aprobado /tmp/ppp-pilot-gate-tsc.log. Meta/modelo/persistencia aislados; cero solicitudes pagadas;25usadas/15restantes. Contrato actual de atributos no representa recargos ni permisos de sustitución: esta tanda cubre abstención/derivación, no cobro de extras ni confirma gratuidad. Pregunta pura "se puede con X" deja pedido igual; solicitud explícita de cambio sigue actualizando. No crear una oferta de confirmación "sí" si el flujo no guarda esa oferta; se pide indicar plato/opción para aplicar.

Despliegue staging50556d2d verificado2026-10-12 12:09 Bogotá: running/healthy, activa=candidata sha256:9c81496578d13de04a2dd9ecd606aeef145101f7ad95c684b7a46db273f71857; health ok/DB connected/CLOSED. Evidencia /tmp/ppp-pilot-gate-deploy-verified.log. Main intacta. Próximo paso: inferencia real/canal con límite efectivo; no reiniciar saldo15.


## Nueva evidencia crítica — chat Banderas12/10

Leer docs/WHATSAPP-BANDERAS-DIAGNOSIS.md. Cinco escenarios de diagnóstico fallaron en staging actual: cortesía separada como producto, consulta de medio pollo crea compra pendiente, reclamo de precio duplica cuarto, corrección capturada como nombre, referencia de dirección no se actualiza. Segundo diagnóstico comprueba carrito inicialid6qty1 y usa fixture15.000 (no confirma precio productivo). /tmp/ppp-banderas-diagnosis-correct-seed.log. Suite temporal eliminada; no se cambió código ni se ejecutó full, Meta o API. Saldo15 intacto. Reabrir puerta previa al piloto: estas fallas no están resueltas por las1.958pruebas anteriores. Siguiente tanda: regresiones con recorrido completo y catálogos sintéticos, luego fixes generales/full/TS.


## Chat de Main y caminos encadenados — 12/10

El usuario confirmó origen Main del transcript Banderas. Se prueban sus patrones en staging, no se afirma paridad entre entornos.31regresiones (PPP/bowl/pizza y conversación completa). Ver docs/WHATSAPP-BANDERAS-DIAGNOSIS.md. Baseline22fallos/28; focalizadas finales31 aprobadas. La secuencia completa detectó oferta vieja aceptada como compra tras comparar barato, fragmento de preparación que agregaba pollo entero y referencia que no cambiaba tras salir de la aclaración. Correcciones por catálogo/intención/estado. No fijar precios13/16ni ubicación privada. Full/TS pendientes al escribir; log /tmp/ppp-banderas-full.log. Cero llamadas pagadas, saldo15. Staging únicamente; mantener Main intacta.

Control del full intermedio:3 regresiones en consulta condicional de recargo (65suites,1.986aprobadas/3fallidas); se separó precio de modificación de precio/disputa del producto.61focalizadas finales pasan /tmp/ppp-banderas-targets-final.log. No cambiar expectativas para ocultar errores; /tmp/ppp-banderas-full.log no es aprobación final. Full estable en ejecución /tmp/ppp-banderas-full-approved.log.


## Integración local, voz y pedidos grandes — 12/10

Baseac27ae4e, staging publicado anterior50556d2d. Se preservó una tanda local amplia de catálogo, jugos, tamaños, reparto por unidad, notas/negaciones y corpus PDF, que aún no estaba confirmada en Git. El full histórico1.989 no acreditaba esos cambios posteriores. Se auditaron y corrigieron riesgos: aviso de cobertura ahora por waId con consumo/limpieza; confirmación de acompañamiento valida firma del carrito, precio/disponibilidad actuales, conserva notas y utiliza tryAddProductToCart/límites/atributos (si faltan no muta). Evita ignorar una porción existente y agrega una nueva unidad confirmada.

Nueva evidencia del usuario: chat Main solo guardó gaseosa1.5L/Pepsi y dirección al pedir combo alitas. No hay audio original; no atribuir el fallo a transcriptor vs parser sin datos. Se añadieron seis recorridos texto/audio simulado de alitas, dos de aislamiento, cuatro de acompañamiento, seis de pedido grande con cinco platos/quince unidades/tres separadores/cambio posterior, un recorrido descarga-transcripción-pedido y dos de presentación por catálogo. API de audio añade cinco pruebas de vocabulario/modelo/tamaño. Baselines detectaron pérdida de notas, confirmaciones viejas, extra inválido/ignorado, bebida incluida cobrada aparte y ají perdido en pedido grande. Focalizadas28aprobadas /tmp/ppp-audio-round-targets.log y recorridovoz aprobado; caso doble presentación muestra lista (no compra), se valida esa lista y ambos nombres en vez de exigir redacción específica.

Se eliminó nueva equivalencia global arroz chino con pollo→medio: selección solo si la carta deja un compuesto único; con varias presentaciones requiere elección. Audio conserva whisper-1 por defecto. WHATSAPP_AUDIO_MODEL permite candidato explícito, sin fallback/reintento silencioso. Prompt de ortografía desde nombres/opciones del catálogo, prioridad plato en foco, máximo200bytesUTF8; no precios, teléfono, historial ni cantidades predeterminadas. RespuestaJSON y límite25MB. Modelos/API reales no ejecutados, saldo25usadas/15restantes. Fuente oficial: https://developers.openai.com/api/docs/guides/speech-to-text (prompts limitados224tokens de Whisper y evaluación contra originales). No afirmar calidad acústica aprobada. Full/TS en ejecución /tmp/ppp-staging-audio-bulk-full.log y /tmp/ppp-staging-audio-bulk-tsc.log. Snapshot de fuentes /tmp/ppp-audio-validation-source.json; comprobar que no cambiaron durante el full antes de acreditar.

Recuperación del full inicial (7suites/57fallos;2.057aprobadas): mayoría de fallos eran harness Object.create sin inicializar nuevo Map de cobertura; se inicializó en cuatro fixtures, sin cambiar expectativas ni código productivo para ocultar fallos. Fallos comerciales: preparación elegida automáticamente; adición de1unidad ignorada por sourceText vacío considerado restatement; entero eliminado por comparación con medio; alternativas de bebida demasiado filtradas. Se exigen elecciones de preparación, sourceText no vacío para restatement, porciones distintas no se absorben y alternativas ordenadas conservan otros tamaños.173focalizadas aprobadas /tmp/ppp-audio-round-regression-recovery.log. Full estable final/TS en ejecución /tmp/ppp-staging-audio-bulk-full-final.log y /tmp/ppp-staging-audio-bulk-tsc-final.log; snapshot renovado, no modificar fuente durante validación.

Validación estable final12/10:66suites/2120pruebas aprobadas en378.783s /tmp/ppp-landmark-full-final.log; TypeScript aprobado /tmp/ppp-landmark-tsc-final.log. Incluye las mejoras locales previas preservadas, tandas de pedidos largos/audio, Banderas y geocodificación incierta. Cero solicitudes de modelo;4consultas Maps de diagnóstico. No atribuir mejora acústica medida sin audios originales.

Desplegado y verificado staging59064dc3 el12/10/2026 21:16 Bogotá:running/healthy, imagen activa=candidata sha256:bd2640ddfc5baa85eca5b81953d5c97ee26ceef31cc0dc026770bb122437366a; healthok,DBconnected,circuitCLOSED. /tmp/ppp-landmark-deploy-verified.log. Main/producción no modificadas. Próximo: repro real de conversación con ubicación dudosa, corrección a calle/número o pin y mantenimiento del carrito; evaluar audio original antes de medir calidad acústica.


## Continuidad de platos en varios mensajes — verificación 12/10
Base29421277; runtime desplegado59064dc3. Chat exacto ejecutivo→mondongo/frito/pierna-pernil/papa-salada→limonada aprobado con mensajes separados y agrupados. Resultado: una línea Ejecutivo Con Pollo Frito qty1, Sopa Mondongo, Presa Pierna Pernil, Bebida Limonada, nota papa salada. No pollo entero ni bebida independiente. Otros controles cubren dos menús, adicionales explícitos, consultas/correcciones y pausas5/60segundos.
Ocho pruebas nuevas: PPP y menú vegetariano ficticio × pausas0/900/4000/60000ms antes de opciones, luego reenvío tardío de ID ya procesado. Verifican carrito, atributos, notas y ausencia de nueva salida ante replay. Primer intento falló8/8 solo en replay porque el harness genérico siempre reclamaba IDs; la fixture local ahora reproduce el contrato UNIQUE de persistencia (no se alteró runtime ni se relajaron expectativas). Esto no acredita entrega real de Meta ni persistencia de varias instancias.
Focalizadas35/35 aprobadas (8nuevas,27existentes), /tmp/ppp-executive-bursts-approved.log; cero llamadas externas ni pagadas. Full anterior66suites/2120 sigue siendo evidencia del runtime, no contar los8nuevos como full ejecutado. Solo tests/docs modificados: no se requiere reconstrucción del servidor.

Siguientes tandas, con criterios de aceptación:
- Corrección antes de completar: «dos ejecutivos»→«fritos con mondongo»→«mejor uno broaster»→bebidas. Dos unidades totales; atributos asociados por línea; preguntar si el reparto no es inequívoco.
- Incluido frente a adicional: «la limonada del menú» frente a «otra limonada aparte» y «dos limonadas para los dos menús». Cantidad correcta sin convertir atributos en compras adicionales.
- Cancelación y cambio de intención: «olvida ese ejecutivo»→otro plato; «solo quería saber qué trae». Cancelar únicamente la compra pendiente; una consulta nunca añade productos.
- Contexto con interrupciones: precio/horario entre presa y bebida, cambio de dirección durante elección. Responder la consulta sin perder cantidad/opciones pendientes ni capturar respuestas como nombre/dirección.
- Referencias ambiguas con varias líneas: «el otro sin ensalada», «los dos con esa sopa», «ese no». Resolver cuando el antecedente es único; de otro modo aclarar sin modificar carrito.
- Ráfagas mixtas: audio→texto corrigiendo transcripción→dirección, o foto→«son dos»→nota. Preservar plato principal y modificaciones; separar calidad acústica/visual de interpretación del texto.
- Repetición de texto con distinto ID: distinguir recordatorio de «otro igual»; deduplicación de webhook no equivale a suprimir nuevas compras legítimas.
Cada tanda se ejecutará con catálogos PPP y sintéticos, comparando carrito/estado/respuesta tras cada mensaje. Inferencia real solo focalizada sobre fallos sin explicar, con saldo15 y registro de cada intento.


## Tanda de básicos y extras — 12/10, basef1a4498e
16pruebas nuevas: ocho recorridos de menú completado (PPP y vegetariano ficticio: precio sin mutación, bebida adicional independiente, cantidad del menú sin alterar extra, reinicio de carrito/pendientes) y ocho plurales con variantes gramaticales y agente simulado activo/inactivo. Baseline4fallos detectó «dos almuerzos ejecutivos» convertido en broaster/ajiaco por falta de normalización plural. Ampliación detectó2fallos adicionales con «Porfa dos…», que compraba preparación por defecto. Corrección general de frase plural y cortesía inicial en glosario; no IDs ni precios codificados. Los16casos nuevos y16controles existentes pasan:32/32 /tmp/ppp-meal-basics-extra-final.log. Full yTypeScript en ejecución /tmp/ppp-basic-extras-full.log y/tmp/ppp-basic-extras-tsc.log. Cero llamadas pagadas/Meta/Maps; saldo modelos15 intacto. No publicar hasta full aprobado.

Plan por riesgo para las próximas rondas (las familias existentes no equivalen a todas las variantes):
1. Repartos:3menús,2con una sopa y1con otra;2presas diferentes; bebida común; corregir solo uno. Verificar suma de cantidades y atributos por unidad, no únicamente número de líneas.
2. Extras/reemplazos:incluido,adicional,sin bebida,cambiar por producto de otro precio,extra agotado y rechazo del recargo. Sin precio/permisos confirmados se deriva o aclara; no inventar sustitución gratuita.
3. Negación/desistimiento:«ese no»,«solo preguntaba»,cancelar antes/después de aclaración,reiniciar y después «lo mismo». No recuperar una compra cancelada del historial ni crear pedido confirmado.
4. Interrupciones básicas:precio,qué incluye,horarios,disponibilidad; luego retomar atributo pendiente. Consulta no muta carrito y no se captura como nombre/dirección/pago.
5. Correcciones en cierre:cantidad/producto/nota/dirección durante selección de pago; pregunta de precio no añade;«no» no obliga a un bucle de pago. Preservar correcciones y volver a presentar total válido.
6. Entrada mixta:nota antes del producto,mensaje largo,ráfaga con pausas,typos,emoji,códigos con direcciones numéricas,voz→corrección por texto,foto→cantidad. Calidad de reconocimiento exige originales; transcripciones simuladas prueban interpretación.
7. Robustez semántica:producto inexistente,opción inexistente,varias referencias posibles,promesas de rendimiento/abono sin información,catálogo vacío/cambio de disponibilidad. Aclaración útil y sin productos/precios inventados.
8. Generalización:repetir casos principales con menús sin pollo/ejecutivo,catálogos cambiados e IDs diferentes. Portar fixtures/contratos para Kamppo; aislamiento multitenant requiere verificación propia.
Puerta de piloto:ningún defecto crítico conocido del alcance, prueba focalizada con modelo/canal real, atención humana comprobada y catálogo vigente. No perseguir infinitas variantes gratuitas como sustituto de medir conversaciones reales. Mantener límite de15solicitudes restantes, seleccionar recorridos representativos y detener ante fallo para diagnosticar gratis.

Full inicial de básicos/extras:65/66suites y2143/2144pruebas; una regresión en menú ficticio «Por favor me condes…» /tmp/ppp-basic-extras-full.log. Se acotó retirada de cortesía a frases que empiezan directamente por cantidad; no quitarla indiscriminadamente antes de verbos.34focalizadas aprobadas (16nuevas,18controles) /tmp/ppp-basic-extras-controls-final.log. Full final/TypeScript en ejecución /tmp/ppp-basic-extras-full-final.log /tmp/ppp-basic-extras-tsc-final.log. Mantener código sin editar durante run.

Aprobación estable final:66suites/2144pruebas en172.88s /tmp/ppp-basic-extras-full-final.log; TypeScript aprobado /tmp/ppp-basic-extras-tsc-final.log.16casos nuevos de básicos/plurales; también acredita8nuevos de ráfagas de la tanda anterior. Cero API/Meta/Maps, presupuesto modelos25/40 intacto. Publicar únicamente staging.

Despliegue de esta tanda verificado12/10/2026 21:39 Bogotá:staging1433958e running/healthy; imagen activa=candidata sha256:8a6a10ebb57ec00d87e85999c9af6e93cf2ebe926db7f794fc8ac0166ecbc7e1; healthok,DBconnected,circuitCLOSED. /tmp/ppp-basic-extras-deploy-verified.log. Main intacta. Siguiente bloque prioritario:reparto de opciones por unidad y cancelación/consulta durante aclaraciones; luego inferencia real focalizada sin reiniciar saldo15.


## Ampliación de cortesía y abandono + interrupciones — 12/10, basefaebdb9e
44casos nuevos:36de cortesía/chat equivocado (16recorridos de abandono PPP+otra carta,12saludos con compra inexistente en ambas cartas,8negativos de corrección/consulta/dirección);8de precio/composición/horario y cancelación antes de compra nueva PPP+menú oriental ficticio. Primer baseline20/43fallaron:6formas de abandono por carta,2saludos por carta y4falsos positivos de «pensé que era…»/destino Otro Chat. Corrección: señales explícitas de destinatario equivocado; «pensé/creí» solo no implica chat equivocado;normalización de cortesía con verbo y typo de saludo.43focalizadas aprobaron.
Segunda tanda baseline6fallos:2reales pérdida de pendingMatch tras composición/horario,4por fixture vegetariano que ya completaba atributos por defecto (no era selección pendiente). Se reemplazó la fixture por menú oriental con elección real Pollo/Horno/Plancha, manteniendo el oráculo. Se responde composición antes de abandonar selección y se reconoce consulta «a qué hora cierran/abren/atienden».51/51focalizadas aprobadas /tmp/ppp-courtesy-interruptions-recovery.log. Full/TS en ejecución /tmp/ppp-courtesy-interruptions-full.log /tmp/ppp-courtesy-interruptions-tsc.log; no mutar código durante run.
Se agregan3recorridos versionados para runner aislado con modelo real:compra tras chat equivocado,ejecutivo con consulta de composición y reclamo de precio tipo«pensaba que era más barato». No ejecutados todavía; evitar atribuirles aprobación por definición. Presupuesto antes de esta ronda25usadas/15restantes.


## Revisión de nuevos cambios locales — 13/10
Basefaebdb9e. Además de la familia de cortesía/interrupciones, aparecieron cambios locales no publicados en catálogo, orquestador, variantes distribuidas y pruebas:recogida de tercero,cierre/precio/combos,referencias y fotos,recargo histórico,reparto de bebidas,paraNpersonas,textura del plato,corrección de precio/horario/pago,corrección de una línea,preguntas de servicio,citas del bot,básicos de cartas diferentes y seguimiento después de registrar. Se preservaron y revisaron sin atribuirlos todos a esta tanda.
Full conjunto inicial:65/66suites,2327/2328pruebas; único fallo recogida dejaba building_cart donde el flujo previo avanzaba a pago. /tmp/ppp-new-local-combined-full.log. Corrección de integración:opción de recogida reanuda checkout sin crear orden, conserva selecciones auténticamente pendientes y distingue una lista retenida después de alta exitosa (pendingMatch.selectionAdded, JSON sin migraciónSQL). Link activo no cambia entrega ni reemite pago; MP elegido sin link exige confirmación.3regresiones nuevas de límites transaccionales.121focalizadas aprobadas /tmp/ppp-pickup-integration-approved.log.
Ampliación previa de cortesía:corrección genérica respeta saltos de línea; agregó2negativos de corrección de teléfono. Interrupciones pasan con agente simulado activo/inactivo; opciones del catálogo que progresan una selección única se procesan antes de delegar una oración al modelo. No generalizar a mensajes multidish o direcciones.
Full/TS final en ejecución /tmp/ppp-new-local-combined-full-final.log /tmp/ppp-new-local-combined-tsc-final.log. Hashes /tmp/ppp-new-local-combined-snapshot-final.json; verificar que no cambiaron antes de acreditar. Rehearsal real limitado a6solicitudes, stop-on-failure, configuración privada de staging en memoria; Meta/persistencia/órdenes aisladas. Registroautoridad docs/whatsapp-model-budget.json; no usar saldo15histórico después de ejecutar. No desplegar antes de resultados finales.


Aprobación completa estable13/10:66suites/2331pruebas en433.264s /tmp/ppp-new-local-combined-full-final.log; fuentes sin cambios frente a snapshot final. Tras corregir únicamente propuesta vacía,64focalizadas aprobadas /tmp/ppp-unknown-proposal-targets-final.log y nuevo full66suites/2335pruebas en419.217s /tmp/ppp-current-stage-all-final.log; TypeScript aprobado /tmp/ppp-current-stage-tsc-final.log. Comparado con última versión publicada2144,191pruebas adicionales integradas; incluye cambios locales ajenos preservados y las tandas de esta sesión.
Verificación modelo real gpt-4.1-2025-04-14:4recorridos únicos aceptados (2con inferencia,2deterministas),10solicitudes API exitosas en total. Primera ronda max6 dejó una conversación incompleta por presupuesto aunque carrito/respuesta eran correctos; repetición focalizada max4 la completó, sin repetir recorrido ya aceptado. /tmp/ppp-courtesy-real-capped-report.json y/tmp/ppp-courtesy-model-completion-report.json. Meta/persistencia/órdenes aisladas. Prueba de modelo precede al ajuste de texto de propuesta vacía; no repetir llamadas por cambio de presentación.35usadas/5restantes, registro docs/whatsapp-model-budget.json yAGENTS actualizados; credenciales solo en memoria, scripts privados temporales eliminados.
Propuesta sin coincidencias ya no afirma varios platos ni pide confirmar «el resto» vacío; conserva confirmación útil cuando sí hay parte reconocida y conserva carrito preexistente.

## Próximo contrato general: opciones sobre parte de una línea — propuesta, no implementada

Auditoría17/10: AiOrderAction.updateAttributes (types/whatsapp-session.types.ts) solo transporta producto,índice y atributo/valor;set_attribute (whatsapp-agent.service.ts) y el guard (whatsapp-action-guard.service.ts) construyen esa misma forma;applyCartLineEdits edita todos los atributos de la línea. La gramática temprana actual cubre algunas frases contadas, no corrige esa falta de expresividad del contrato del modelo.

Diseño recomendado a validar:una acción agrupada por línea con cantidad afectada y lista de opciones permite preparar una sola partición y evita que dos llamadas de atributo asignen implícitamente los cambios a unidades distintas. Mantener compatibilidad de la edición total existente;requerir cantidad entera1..cantidad actual,SKU/línea únicos y atributos válidos. No reutilizar quantity de update_item:ahí significa cantidad absoluta final, no unidades afectadas. Resolver contra instantánea original y validar antes de mutar;preservar resto/notas/precio. Actualizar vista provisional de get_cart de forma coherente;no aceptar índices recalculados tras partición como si fueran índices originales. Si una segunda selección parcial es ambigua,preguntar sin aplicar al resto.

Pruebas propuestas:2de4,1de3,total4de4,0,5de4,decimal,opción inválida,2atributos en el mismo subconjunto,2subconjuntos distintos,2SKUcon la misma opción,otras líneas,adición pendiente,quitar/reemplazar después de editar,rollback de edición rechazada,petición repetida y pago/confirmación. Comprobar herramienta→guard→plan→carrito→respuesta→payload final. Aprobar con consulta de precio/dirección/nueva compra debe revisar el plan completo antes de crear orden. Un guard de frase confirmatoria no acredita esto.

Después de cerrar controles gratis,contrastar una muestra reservada del modelo real con gasto acotado y contador antes de red. No iniciar una ronda amplia con las2peticiones operativas restantes ni presentar pruebas simuladas como inferencia real.


## Siguiente matriz después de integrar opciones por unidades — 17/10

No ampliar frases por producto. Reservar conversaciones completas con productos y atributos distintos, y validar respuesta, carrito, estado y orden simulada:

1. **Compra nueva frente a edición:** carrito vacío; cuatro cajas, dos con una opción y dos con otra. Crear variantes mediante add_item; no intentar partición de una adición pendiente. Controlar que las unidades sumen cuatro y no aparezcan bebidas/platos extra.
2. **Origen ambiguo después de dividir:** ya existen dos variantes del mismo SKU. «Cambia una por X» sin identificar origen debe aclarar; «de las que tienen Y, cambia una por X» puede editar la línea indicada. El índice elegido por el modelo no acredita por sí mismo que el humano haya identificado el origen.
3. **Repetición:** llamada idéntica de herramienta ya cubierta; falta ampliar repetición del mensaje del cliente en un turno posterior, reentrega del mismo ID y petición explícita de cambiar otra unidad restante. No mover dos veces las mismas unidades ni confundir una repetición con «otra más». Probar también un no-op del modelo (opción ya elegida): debe responder con claridad y conservar el carrito, sin caer al parser de compra por no tener acciones productivas.
4. **Atributos y nota en el mismo grupo:** dos de cuatro con otra bebida y sin cebolla. El contrato actual agrupa atributos; no expresa una nota nueva del mismo subconjunto ni mutaciones mixtas. Antes de extenderlo, decidir y probar la unidad de atomicidad: opciones/notas del mismo grupo deben prepararse juntas; compras independientes ya reconocidas tienen otra política y no deben duplicarse.
5. **Interrupciones:** repetir ediciones agrupadas esperando nombre, teléfono y dirección; resolver consulta de precio/tiempo sin guardar esa consulta como dato. El cierre actual se midió en carrito, pago y confirmación; no extrapolarlo a todos los pendientes.
6. **Precios:** conservar precios de origen mientras se edita; fusionar solo precios iguales. Si el menú cambió, mostrar el nuevo total y solicitar aprobación antes de crear la orden. Añadir premios/descuentos en otra tanda sin suponer que precio0 equivale a cupón válido.

Puerta posterior: ampliar evidencia reservada del modelo real con un límite explícito, una repetición y parada al fallar; hoy un solo turno real aprobado no equivale a un benchmark amplio. No iniciar inferencia por defecto ni agotar el saldo operativo en casos ya resueltos por reglas. Mantener Main intacta y desplegar únicamente después de aceptación de la fuente congelada.
