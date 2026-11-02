# Tanda342 — ráfagas parciales y reentregas

24 escenarios nuevos aprobados: dos catálogos × agente off/mock × seis comportamientos. Se usa el receptor real con temporizadores simulados y un claim que reproduce el contrato de persistencia (ID ya reclamado devuelve null). Los servicios externos siguen aislados.

Se verifican dos ráfagas parciales, duplicado no adyacente dentro de un lote, reentrega completa silenciosa, mezcla de mensajes nuevos/repetidos, cortesía aislada sin mutación y una compra adicional explícita. Cada caso cierra una orden simulada y contrasta unidades del DTO con carrito y total del recibo. «Otro» suma; una reentrega no.

No apareció una regresión nueva de cantidades. No se modifica el motor ni se necesita redesplegar el runtime341. La duplicación histórica del bagre sigue sin reproducirse. El control de cortesía no certifica calidad conversacional: con respuesta de modelo simulada puede responder «¿Cuál prefieres?», sin mutar el pedido.

Pendiente: persistencia/canal reales en entorno aislado, caída entre claim y aplicación, concurrencia entre instancias y contacto intercalado. Mantener U2 abierto; seguir con correcciones/eliminaciones de productos duplicados del chat sin confundir una intención nueva con una reentrega.
