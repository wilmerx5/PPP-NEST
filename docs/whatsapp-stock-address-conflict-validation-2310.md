# Tanda151 — disponibilidad al elegir y direcciones contradictorias

Baseb420c1cb, solo staging.42 casos nuevos:24 selección después de cambio de disponibilidad,12 direcciones con etiquetas repetidas/contradictorias,6 contratos de detección de conflictos.

## Resultados y corrección

Disponibilidad: no se cambió runtime. El primer intento12/12 fallido usaba ignoreBusinessHours=true del harness, que fuerza availableNow=true. Fue un defecto del fixture, no evidencia de un fallo productivo. Se corrigió ignoreBusinessHours=false, conservando negocio simulado abierto. Con ese entorno la protección existente rechaza opción no disponible o retirada del menú, mantiene carrito y permite elegir la alternativa disponible con preparación/nota originales. Los recorridos parten de compra o pago, tres cartas y agente simulado on/off; verifican DTO exacto con las dos unidades de opciones/notas diferentes. No extrapolar a stock físico: se simula bandera de disponibilidad y eliminación del catálogo.

Dirección: baseline6 fallos/6 aprobados. Dos apartamentos distintos dentro de una calle se guardaban; repetición del mismo número ya podía continuar. Se detectan componentes etiquetados con valores diferentes antes de combinar dirección/geocodificar. Se muestran ambos números y se pide dirección corregida. Sin cambiar sesión, carrito ni llamar al mapa hasta aclarar; respuesta posterior con dirección completa válida continúa a pago/confirmación y DTO.

Contratos cubren apartamento/apto, torre, interior/int y valores repetidos equivalentes (incluido # y mayúsculas). No confundir número de torre con número de apartamento.

## Verificación

Foco66/66 (42 nuevos +24 anteriores),17,481s. TypeScript general/build OK, Node92/92. Global17.255/17.255,218suites,516hashes,642,89s, inventario exacto/fuente congelada. /tmp/ppp-151-global-summary.json. Evidencia /tmp/ppp-151-expanded.log, /tmp/ppp-151-address-baseline.log y /tmp/ppp-151-stock-baseline.log. Este último representa fixture incorrecto y no debe contarse como defecto del bot. No sumar reintentos.

## Límites y siguiente paso

Cero API pagada/Meta/órdenes externas. Servicios/modelos simulados. Guardia de conflicto cubre dirección numerada con carrito existente; solicita reenviar dirección corregida completa, no acepta por sí sola la respuesta aislada «708». No cubre primer mensaje de compra+dirección contradictoria desde carrito vacío ni ubicación sin calle con dos referencias. Próximo: resolver aclaración corta sin perder calle/conjunto, conflicto en primer mensaje, opciones disponibles en una sola candidata y cambios de opinión. Contraste real acotado sigue pendiente en whatsapp-api-validation-next-2310.md, con presupuesto antes de red. No declarar vendible por conteos.

Despliegue150–151 verificado2026-10-24T00:50:53Z: staging2f7f9d86b81f0a8fed2608e3d091f1865e2cbefb, imagen sha256:f9a7b5ed00976b80f7abc63136623434f8d883fd0bf3076b974c0be860d49ea6, running/healthy,0reinicios. /api/health OK,DBconnected,circuitCLOSED. publicChat=true/orderEvents=false. Producción conserva ef426c93… y0reinicios. Rollback ppp-nest-staging:rollback-before-2f7f9d86. Evidencia /tmp/ppp-151-deploy.log y /tmp/ppp-151-verified.log. Bases/volúmenes/privados preservados. Commit posterior solo documental no requiere reconstrucción.
