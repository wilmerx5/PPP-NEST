# Tanda154 — elecciones simultáneas

## VIGENTE — tanda154: número ambiguo entre producto y apartamento (23/10)

Base0ed2d7ca, solo staging.24 recorridos nuevos en tres menús (Bowl/Hamburguesa/Sandwich), agente simulado on/off, respuesta1/2 y resolución producto primero/dirección primero. Baseline12/12 falló: número elegía apartamento y cotizaba aunque también podía elegir producto. Con ambos pendientes, respuesta corta sin etiqueta pide indicar apartamento o nombre del producto/opción y no muta sesión. Se verifica consulta intermedia de precio, conservación de pendientes/carrito, selección explícita en ambos órdenes y DTO final con dos líneas, opciones/notas y apartamento2.

Foco54/54, TypeScript general/build OK, Node92/92. Global17.317/17.317,222suites,520hashes,584,79s; inventario exacto/fuente congelada. /tmp/ppp-154-global-summary.json. Cero API/Meta/órdenes externas. Publicada solo staging; despliegue pendiente para agrupar. Servidor último verificado82b77757 (152–153); Main/producción intactas. Ver whatsapp-address-product-collision-validation-2310.md.

Próximo: atributo/sabor pendiente con conflicto de interior, caducidad/cancelación de una elección, código explícito frente a número desnudo, GPS+respuesta corta conservando pin y referencias. Los24 casos acreditan pendingMatch; no extrapolar a todos los tipos de pendiente aunque la guarda también los detecte. Sigue pendiente contraste real acotado según whatsapp-api-validation-next-2310.md; no declarar vendible por conteos.

## Evidencia

- Baseline: /tmp/ppp-154-baseline.log,12 fallos; dirección se guardaba/cotizaba con1/2 pese a producto ambiguo.
- Foco final: /tmp/ppp-154-focus.log,54/54,16,003s.24 nuevos +12 de152 +18 de153. No sumar repeticiones.
- TS general/build: /tmp/ppp-154-tsc.log. Node92/92: /tmp/ppp-154-node.log.
- Global: /tmp/ppp-154-global.py y /tmp/ppp-154-global-summary.json. Burst80 +resto17.237.520 hashes en /tmp/ppp-154-hashes.json;222suites exactas.

## Contrato

Con pendingAddressConflict y otra selección activa, número sin etiqueta pide aclarar referente antes de mutar. «El apartamento2» continúa dirección; nombre completo de plato continúa selección. Consulta de precio no compra ni resuelve dirección. Ambos órdenes de resolución cierran con exactamente dos productos y opciones/notas distintas conservadas. Cero cotización u orden prematura al recibir número ambiguo.

Alcance de pruebas: catálogo y modelo simulados, turnos de texto seriales y pendingMatch generado desde compra real del router; no estados sembrados como sustituto de conversación. Sin llamadas pagadas ni órdenes externas. Siguiente validar pendingAttribute, retiro/cancelación/caducidad y números que solo pertenecen a una lista antes de optimizar esa aclaración. No excepciones PPP.
