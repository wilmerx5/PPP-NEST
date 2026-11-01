# Tanda334 — consulta de combo después de bebida

Fuente31/10 mensajes302–308. Tras resolver la bebida, «o hay combo con gaseosa?» reutilizaba el foco de la gaseosa y volvía a preguntar sabores.4/4 controles iniciales reprodujeron el fallo. Solo en esa consulta, si el foco es bebida, se prioriza el plato del carrito explícitamente nombrado o el único plato. Con varios platos o solo bebidas se pregunta por el plato, sin nueva selección de sabor.

La ampliación reprodujo otro fallo: «no gracias» ante la oferta al final del checkout podía vaciar el carrito. La lista de variantes no identificaba su único combo como destino ofrecido. Se liga preferredId solo si hay exactamente un combo; las rutas existentes de aceptación/rechazo conservan la línea original. Aceptar exige completar las opciones incluidas antes de reemplazar: se corrigió una aserción prematura del test que esperaba compra sin escoger bebida. Se informa que la bebida separada sigue aparte; consultar o elegir combo no autoriza eliminarla.

40 casos nuevos en dos catálogos × agente off/mock,58 pruebas/2 suites focales aprobadas. Carrito/pendientes/respuesta/estado, aceptación «en combo» y «sí», rechazo en confirmación, creación única, DTO y recibo. Global final aprobada: 32911 pruebas/401 suites, inventario exacto y 618 fuentes congeladas; TypeScript general/build y scripts aprobados. Cero inferencia, Meta y órdenes externas; no acredita modelo/canal real.

Alcance pedido: staging solamente. PPP producción permanece333 y Kamppo321. Siguiente: consultas sobre raciones/personas, total+demora y lenguaje informal que no debe comprar productos. Ambigüedad de varios combos y equivalencias no literales siguen por aclaración; no declarar cerrado todo el plan31/10.

Publicación y despliegue staging pendientes; verificar SHA y salud antes de acreditar despliegue.
