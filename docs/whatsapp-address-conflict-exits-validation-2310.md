# Tanda153 — recogida, reinicio y pin durante aclaración

## VIGENTE — tanda153: salida del conflicto de domicilio (23/10)

Base952632de, solo staging.18 recorridos nuevos: tres cartas×agente simulado on/off×recogida/reinicio/GPS seguido de dirección corregida. Se reproduce bloqueo al cambiar a recogida: applyPickupIntent conservaba pendingAddressConflict y tryConfirmOrder exigía apartamento. Se limpia ese pendiente junto con los demás componentes de entrega al elegir recogida. Reinicio ya limpiaba. Pin válido conserva la duda del apartamento hasta aclaración; no autoriza confirmar por sí solo. Carrito, respuesta, estado y DTO de una unidad verificados.

Foco30/30, TypeScript general/build OK, Node92/92. Global17.293/17.293,221suites,519hashes,609,52s; inventario exacto/fuente congelada. /tmp/ppp-153-global-summary.json. Cero API/Meta/órdenes externas. Deploy agrupado152–153 verificado2026-10-24T01:53:03Z: staging82b77757fe644b703f744afe841f07e132540fae, imagen sha256:affbbf5719ad2f1c4ae7683ea9450c45a13040e24b8c79bbd924dbbc0ed19efb, running/healthy,0reinicios; health OK,DBconnected,circuitCLOSED. publicChat=true/orderEvents=false. Producción conserva ef426c93… y0reinicios. Rollback ppp-nest-staging:rollback-before-82b77757. Evidencia /tmp/ppp-153-{before-deploy,deploy,verified}.log. Bases,volúmenes,privados y mariadb_local preservados. Commit posterior solo documental no requiere reconstrucción. Main intacta. Ver whatsapp-address-conflict-exits-validation-2310.md.

Próximo: elecciones de producto y dirección simultáneas; GPS seguido de respuesta corta preservando coordenadas y referencias; primera compra con dirección contradictoria. No acreditar esos caminos con estos tests. Sigue pendiente contraste acotado con modelo/mapa real según whatsapp-api-validation-next-2310.md. No declarar vendible por conteos.

## Evidencia

Baseline /tmp/ppp-153-baseline.log:12 fallos/6 aprobados; solo6 son defecto de recogida. Los otros6 eran oráculo equivocado: se comprobaba deliveryFeeCalculated después de confirmar, cuando la sesión se limpia. Se verifica costo cero antes de confirmar y DTO sin apartamento descartado. El mock GPS se reforzó para aceptar customerCoords y asegurar latitud guardada; baseline original del pin no acredita cotización válida.

Foco /tmp/ppp-153-focus.log:30/30,13,597s (18 nuevos+12 regresiones152). TS /tmp/ppp-153-tsc.log; Node /tmp/ppp-153-node.log. Global /tmp/ppp-153-global.py, /tmp/ppp-153-global-summary.json y hashes. Burst80+resto17.213=17.293. No sumar foco/reintentos como casos nuevos.

Mapas y modelo simulados, no WhatsApp externo ni órdenes reales. No cambia catálogo ni modelos. Reglas por estado de entrega, sin nombres/productos hardcodeados.
