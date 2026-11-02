# Tanda344 — un plato compuesto sin gaseosa

Origen: chat01/11 20:49 y aclaración del usuario. La intención era un arroz chino con costillas sin gaseosa, no dos productos. No incorporar datos personales del chat a las regresiones.

Baseline6/8 falló en dos catálogos con agente off/mock y coma/con. Reescribir únicamente petición completa contada, componente separado por coma/con y exclusión de gaseosa/bebida/refresco, cuando el catálogo contiene un único plato compuesto cuyo nombre cubre la referencia. Conserva cantidad y nota. No elige el combo de bebida, no calcula descuentos.

La ampliación al receptor coalescido detectó que pedido+pago podía separarse o ser consumido por el pago. Se normalizan las líneas del pedido; si hay exactamente una línea independiente de método de pago reconocido, se guarda ese dato y se procesa la compra. No se confirma una orden por indicar el método.

31 controles:16 cierres (dos catálogos × agente off/mock × coma/con × separado/coalescido),13 guardas y2 pedidos explícitos separados. Carrito de una unidad, nota sin gaseosa, respuesta, pago y DTO/recibo verificados. Guardas de cantidades por componente, aparte/separados, pregunta, negación, condición, combo explícito, sin exclusión, cero, prefijos ambiguos y producto ausente.

Foco60/3 aprobado. Global33335/412, TypeScript general/build y scripts aprobados; despliegue pendiente. Cero llamadas pagadas, Meta u órdenes externas. No acredita canal/modelo/persistencia reales. No declara corregido «En combo» sobre un carrito ya dividido ni «Cancelar.»; siguen pendientes prioritarios. Precios de fixtures no afirman precio vigente de producción.
