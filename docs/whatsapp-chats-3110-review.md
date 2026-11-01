# Revisión de intentos del 31/10/2026

Revisado el01/11/2026. Fuente: archivo proporcionado «chats 31-10.zip», SHA256 `05d5a5fa907ec87441e6e80ee0e86b08a2b5b99cf339128f74c36f5b08ad4f94`. Contiene chat.txt y chat.md; se revisó íntegramente chat.md:467 mensajes,12:21–20:51,28 recibos con números de orden distintos,7 instrucciones de reinicio y3 referencias a imágenes. Las imágenes no están adjuntas dentro del ZIP.

Es una exportación continua de un mismo hilo con muchos intentos y datos de contacto cambiantes. No equivale a467 conversaciones,28 clientes ni una tasa de conversión. Los recibos acreditan que el bot afirmó registrar órdenes; no verifican entrega, cobro ni persistencia externa. No hay trazas internas, versión desplegada o catálogo histórico completo: no se atribuye causalidad al modelo ni a una migración sin reproducirla. Se omiten nombres, teléfonos y domicilios reales de esta documentación.

## Diagnóstico

Hay fallos importantes del bot; no se explica por clientes que dejaron de responder. Varios pedidos cerraron después de correcciones manuales y uno conserva una bebida contraria a la solicitud inicial. La persona que hizo estos intentos insistió, reformuló y reinició. Eso puede ocultar problemas que un comprador normal no resolvería.

## Prioridad1 — integridad del pedido y confirmaciones

- **12:54–12:57, mensajes93–108: producto no solicitado.** Pedir arroz paisa y dar un destino hace aparecer también una bandeja de pollo. El reclamo «no pedí» no la retira; una orden explícita de quitar sí recupera el carrito antes del cierre. Riesgo de cobro/cocina incorrectos. Pendiente reproducir el origen; el texto por sí solo no prueba si fue historial, agente o concurrencia.
- **13:02–13:05,117–135: cantidad duplicada.** Un medio pollo pasa a dos al procesar mensajes de dirección/contacto. «Es solo un medio, en el carrito tengo dos» no resuelve directamente; el nombre exacto recupera una unidad antes del recibo. Prioridad: ráfagas, aplicación única de compras y alias de corrección.
- **16:03–16:07,269–286: ejecutivo, bebida y adicional.** Pide mondongo, limonada y una sopa adicional de menudencias. Se registra menudencias como sopa incluida, Colombiana como bebida y se omite inicialmente el adicional. Después «una sopa de menudencias» vuelve a cambiar la incluida. La aclaración explícita recupera las dos sopas, pero el recibo mantiene Colombiana: discrepancia no corregida con la limonada original. Prioridad: alcance de atributos frente a productos adicionales y no sustituir opciones silenciosamente.
- **16:20–16:23,315–330: mensajes fragmentados y cambio de preparación.** «Ejecutivo / pollo broaster / pierna pernil» produce un ejecutivo frito más un pollo completo. La corrección al ejecutivo broaster muestra valores por defecto y valores anteriores en notas contradictorias. Se reinicia sin cierre. Prioridad: continuidad entre burbujas, sustitución conservando atributos y un único valor efectivo.
- **17:31–17:33,396–409: reparto de dos unidades.** Pide uno frito y uno broaster, pero la selección1 agrega dos fritos; las reparaciones posteriores dejan elecciones pendientes y se termina reiniciando. La cantidad total inicial no debe aplicarse completa al primer elemento de un reparto.
- **12:23–12:24 y13:11,3–10/136–141: aceptación consumida como dirección.** Tras preguntar «¿te lo agrego?», «sí» reutiliza un domicilio anterior y deja el carrito vacío. Reproducido en staging con dos catálogos y agente simulado off/on:8 fallos/4 controles aprobados. Tanda326 corrige la prioridad de la oferta pendiente frente a reutilización de dirección. La prueba incluye luego aceptar la dirección y cerrar una única orden.
- **13:00,111–116: nombre y dirección mezclados.** La leyenda de una imagen incluye nombre nuevo; el bot conserva el nombre anterior y mete texto de compra/nombre dentro de la dirección. El recibo conserva la mezcla. Prioridad: campos separados y continuidad de identidad. Sin imagen original no se acredita reconocimiento visual del producto.

## Prioridad2 — bloqueos, consultas y ambigüedad

- **12:29–12:33,21–24: cortesía como producto y personas como unidades.** «Qué opciones tienen. Gracias» provoca «productos de gracias». Al reclamar, agrega dos arroces aunque «para dos personas» no asegura dos porciones. Debe distinguir consulta, raciones y cantidad de productos; la queja no autoriza una nueva compra.
- **14:00–14:08,226–235: mondongo contradictorio.** Afirma no manejar mondongo y simultáneamente lista dos presentaciones; luego rechaza hasta el nombre exacto. El31/10 es sábado y ya había vendido mondongo a13:40, pero pudo cambiar disponibilidad: revisar calendario/stock y mantener coherencia entre oferta y aceptación. No asumir disponibilidad actual desde este export.
- **12:47–12:48,67–76: elección pendiente reaparece.** Confirma la porción de papas tras elegir1, pero al dar dirección vuelve a exigir escogerla. No terminó duplicada en el recibo; evidencia de estado pendiente obsoleto que añade pasos.
- **13:26–13:29,184–191: geocodificación sin salida útil.** La persona repite la dirección y reinicia. Rechazar un punto con numeración distinta es correcto; el problema es recuperar el flujo. Probar normalización de N/número, letras, Bis, Sur y AK. Nunca resolverlo aceptando a ciegas la coordenada aproximada.
- **13:10–13:13,136–151: combo convertido en extras durante cotización.** Bebida y arepa del combo aparecen como productos adicionales y se estima71500; al pedirlo por separado se recupera combo+ajiaco por65000 antes de domicilio. Preguntar demora tampoco debe convertir un pedido en cotización ni perder el destino.
- **16:19–16:20,305–314: consulta de combo y sustitución compuesta.** Preguntar si hay combo reabre sabores de la bebida. Quitar pollo/bebida y pedir combo no resuelve la sustitución; reinicia. Validar cambios completos sin compras o borrados parciales.
- **17:25–17:29,378–393: sustitución de acompañamiento.** «En vez de gaseosa, si se puede más papa» inicialmente se trata como producto inexistente. Luego quedan Bebida:Colombiana y nota sin gaseosa simultáneamente. No prometer sustitución autorizada si la política no la permite; distinguir solicitud a cocina de opción confirmada.
- **17:38,412–413: consulta de disponibilidad compra automáticamente.** «Le queda menudencia?» agrega sopa. Después el usuario sigue el pedido, pero no vuelve correcta la mutación inicial. Consulta debe informar y pedir aceptación.
- **12:34,33–34: doble pregunta incompleta.** Contesta demora pero omite precio y termina con «¿algo más?» mientras falta resolver domicilio. Responder ambas preguntas y retomar el paso pendiente.

## Prioridad3 — claridad y datos de salida

- **13:20,158–163:** «Coca familiar» acaba resuelta como1.5L, pero vuelve a pedir sabor ya dicho y muestra una opción `**`. Revisar continuidad de sabor y calidad del catálogo; no asumir que familiar significa siempre un tamaño fijo.
- **14:43,250–254:** entiende pollo completo pero anuncia que no maneja «completo» como opción; respuesta innecesaria y contradictoria con la compra correcta.
- **16:24–16:25 y17:23–17:24,342–351/370–377:** notas basura «con medio pollo Broaster» y «con un arroz con» llegan al recibo. No son instrucciones de cocina.
- **18:54–18:56,423–438:** pollo y medio correctamente desglosado, pero «con mucha miel» se aplica solo al medio. Alcance ambiguo: preguntar o usar nota general según política explícita, no afirmar que se cumplió para todo.
- **20:48,454–459:** solicitud de domicilio recibe respuesta de tiempo/seguimiento de orden anterior. Luego se recupera. Revisar inicio de pedido tras completado.
- Se ofrece Mercado Pago reiteradamente aunque el alcance documentado del piloto es efectivo/transferencia. Es indicio para comprobar configuración del entorno de origen, no evidencia de que falló ese medio de pago.

## Qué salió bien

- Se ven28 recibos y múltiples recorridos sencillos completados: productos, domicilio, teléfono, efectivo y transferencia.
- Selección por precio «el de38» funciona; «broster», «broster/a la broster», «confirm» y el «yes» final tienen recuperaciones correctas en estos ejemplos.
- Los contactos nuevos se actualizan en numerosos pedidos sin contaminar productos ni dirección. Torre/apartamento/casa llegan separados y se conservan en varios casos.
- «Con platos y cubiertos» llega al recibo. Los dos jugos en leche conservan sabores diferentes y total correcto.
- Dos combos conservan Coca Zero en ambos. «Pollo frito / en combo porfa» se agrupa correctamente en un caso, aunque otro flujo fragmentado de ejecutivo falla.
- Sin método de pago, «confirmar» vuelve a pedirlo y no emite recibo prematuro.
- Las discrepancias con el mapa se bloquean en lugar de aceptar una coordenada arbitraria; debe mejorarse la recuperación sin perder ese control.

## Continuación de las tandas

326: reproducir/corregir aceptación de cotización con dirección guardada y ejecutar regresión completa por cambio del router. Siguientes: compra duplicada por mensajes de contacto; ejecutivo+adicional/bebida y conservación de variantes; reparto uno y uno; cortesía/consulta/personas; coherencia de stock; recuperación de direcciones. Cada grupo requiere reproducir sobre estado inicial y comprobar carrito, respuesta y DTO. Quedan pendientes las demás incidencias; no se declaran corregidas por pasar las pruebas de326.

No se publican los chats crudos ni datos personales en Git. Las pruebas usan identidades y direcciones sintéticas. Este análisis es diagnóstico de desarrollo, no certificación comercial ni medición de abandono de clientes independientes.

## Cierre de la tanda326

Corrección desplegada y verificada solo en staging (`e1352ee2`).12 pruebas nuevas; foco144/4 y global32671/393 aprobados, TypeScript general/build y scripts aprobados. Las incidencias restantes de esta revisión siguen pendientes. No se realizaron llamadas pagadas ni órdenes externas.
