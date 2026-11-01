# Plan de corrección — incidentes31/10

Actualizado01/11/2026. Fuente y análisis: whatsapp-chats-3110-review.md. Trabajo en staging; producción y Kamppo permanecen sin promoción hasta solicitud. La tanda326 está desplegada solo en staging. No confundir pruebas simuladas con aceptación del modelo/canal real.

## A. Aceptación de ofertas — prioridad inmediata

Estado: fallo «sí» consumido como dirección corregido en326 (`e1352ee2`), global32671/393 y staging verificados. Producción y Kamppo pendientes de promoción.

Cobertura actual: cotización de un producto, carrito vacío, dirección previa, si/sí/no, dirección aceptada después y creación única. Ampliación pendiente: oferta de varios productos, opciones pendientes, contacto intermedio y aceptación repetida. No se declara arreglada la cotización de combo con extras indebidos.

## B. Ninguna compra al dar datos — tanda327, avance parcial

Casos12:54 y13:02: bandeja inesperada y medio pollo duplicado. Probar mensajes separados, ráfaga real por handleIncoming, repetición de contacto y propuestas simuladas del agente que intentan agregar productos anteriores/ajenos. El carrito debe permanecer idéntico en cada mensaje de contacto; el DTO debe contener solo lo comprado.

Resultado327: no se reprodujeron productos duplicados en estos recorridos. Sí se reprodujeron8 fallos de datos:4 pérdidas de teléfono en ráfaga y4 pérdidas de apartamento al repetir calle. Corregidos; foco116/4 y global32691/394 aprobados, TypeScript general/build y scripts aprobados. Desplegado y verificado en staging (`6ef524b5`), evidencia whatsapp-batch-327-staging-deployment.json.20 controles nuevos incluyen dos catálogos, agente simulado con propuestas no solicitadas y cambios legítimos de domicilio/unidad. El incidente original de compra inesperada sigue abierto.

Si no se reproduce: conservar controles y mantener incidente abierto; obtener trazas de turnos, messageId, coalescencia, propuesta del modelo y sesión persistida. No corregir por intuición ni afirmar resuelto con un mock que nunca ejerció el fallo. Revisar además lugar ambiguo, historial de pedido anterior y reintento de webhook con el mismo ID.

## C. Ejecutivo, variantes y adicionales — tanda328, avance parcial

328 reproduce y corrige la confusión entre sopa adicional e incluida, junto con la bebida perdida en mensaje conjunto.8 fallos iniciales,20 controles nuevos completos en dos catálogos, foco120/3 y global32711/395 aprobados. Staging328 desplegado y verificado: código `e9a5dd45`, healthy, cero reinicios, API local/pública operativas y configuración/modelos preservados. Workflow41315663950; evidencia `whatsapp-batch-328-staging-deployment.json`. Controles compilados previos aprobados; cobertura específica328 local. Pendientes: reproducir el pedido fragmentado y la sustitución de preparación del incidente16:20; no se dan por resueltos por las suites previas. Evidencia whatsapp-batch-328-patterns.md.

Casos16:03/16:20: mondongo+limonada y sopa adicional; pedido fragmentado; cambiar frito por broaster. Reproducir con catálogo sintético de ejecutivo y otro restaurante. Comprobar que bebida explícita prevalezca sobre predeterminada, sopa adicional no reemplace incluida y sustitución conserve opciones compatibles sin copiar valores contradictorios a notas. Mensajes juntos y separados. DTO y recibo deben coincidir; si falta una opción, preguntar sin inventarla.

329: reproducidos y corregidos ejecutivo por mensajes separados/ráfaga y cambio de preparación;28 controles, foco243/5, global32739/396 aprobados. Desplegado junto con330 en staging1528b08c; workflow41321467542 verificado. Evidencia whatsapp-batch-329-patterns.md. No declarar cerrado todo el espacio de variantes del grupoC.

## D. Reparto y sustitución de combos

331: reparto inicial entre preparaciones corregido;16 controles nuevos, foco118/3 y global completa aprobados. Intención de compra no se guarda como destino y reafirmación exacta no duplica. Publicación y despliegue staging pendientes; no acreditar deploy hasta verificar SHA y salud. Reparar reparto ya incorrecto y convertir ambos a combo siguen pendientes. Evidencia whatsapp-batch-331-patterns.md.

330 corregido en presentación y desplegado con329 en staging1528b08c: chat31/10 18:54, «Para un pollo y medio», dos listas con numeración repetida mientras se acepta una elección por turno. Ahora se muestra solo la lista activa y se indica lo pendiente.12 recorridos completos nuevos;180/5 y TypeScript general/build aprobados. Números/nombres y recuperación de elección inválida conservan cantidades, total y confirmación.

Casos17:31/16:19/13:10: «dos, uno frito y uno broaster», cambio de ambos a combo, retirar pollo+bebida y añadir combo, bebida/arepa incluidas frente a extras. Probar selección numérica después de aclaración, errores de escritura, cancelación y pregunta de precio/demora intermedia. Mantener total de unidades; resolver cambios completos o pedir aclaración sin cambios parciales.

## E. Consultar no es comprar

Casos12:29/17:38/12:34/20:48: gracias como producto, para dos personas como dos unidades, «le queda», total+demora, inicio de domicilio tratado como seguimiento. Consultas no mutan carrito; contestar las partes de la pregunta y retomar paso. Quejas no autorizan una nueva compra. Aclarar número de porciones cuando no se conoce rendimiento del plato.

## F. Coherencia de catálogo y pendientes

Casos14:00/12:47/13:20: mondongo ofrecido/rechazado, selección de papas que reaparece y sabor `**`. Probar disponible/no disponible, fecha y cambio de stock entre oferta y aceptación; limpiar elección resuelta sin comprar dos veces. Continuidad de sabor al escoger tamaño y validación de opciones del catálogo. No forzar venta cuando stock real la impide. Revisar exposición de Mercado Pago frente al alcance del piloto.

## G. Datos del destinatario y recuperación de direcciones

Caso13:00 y direcciones bloqueadas: nombre nuevo dentro de leyenda de imagen, compra y pago anexados a dirección, N/número, Bis, Sur, AK y referencias en burbujas. Separar campos y conservar torre/apartamento. Si mapa difiere, pedir ubicación/aclaración útil sin aceptar coordenada ajena. No certificar imágenes con un ZIP que solo contiene texto; añadir medios aislados cuando existan.

## H. Notas y solicitudes a cocina

Casos17:25/16:24/17:23/18:55: sin gaseosa frente a atributo Colombiana, intercambio condicional por papa, fragmentos de compra en notas y miel en varios platos. Distinguir solicitud de sustitución de opción autorizada; una única instrucción coherente por atributo. Preguntar alcance ambiguo; quitar notas basura sin borrar instrucciones reales.

## Criterio de cierre y publicación

Por grupo: reproducir antes de editar, añadir controles en al menos dos catálogos y recorridos completos, verificar respuesta/carrito/estado/DTO. Ejecutar suites afectadas y TypeScript; si cambia motor compartido, global con inventario exacto y fuente congelada. Desplegar staging y verificar SHA, salud y configuración. Registrar límites y pendientes.

La promoción a Main y migración Kamppo son pasos separados, no suceden por publicar staging. Mantener un inventario explícito del delta; actualmente producción/Kamppo321 y staging331 (despliegue pendiente); consultar el relevo para nuevos avances.

Aceptación final pendiente: ensayo aislado con Luna/Sol reales, mensajes fragmentados, catálogo vigente y trazas; luego canal controlado sin órdenes a cocina. Presupuesto operativo267/256/11 a fecha de este plan; ninguna llamada sin contador previo, límite y parada al primer fallo. No certificar venta ni todas las incidencias por sumar pruebas. Idiomas y variantes cosméticas quedan al final.
