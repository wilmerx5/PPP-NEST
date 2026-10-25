# Tanda 177 — salir del domicilio pendiente

Base5a7f5c92, solo staging.36 recorridos nuevos:3menús×agente simulado on/off×recogida/cancelación/reinicio×mapa ambiguo/fuera de cobertura. Baseline36/36 pasa (13,842s); no son36 fallos corregidos. Sin cambios runtime.

Carrito sembrado con2unidades y nota. Se envía conjunto+interiores y se simula fallo del mapa. El cambio de intención debe responder sin insistir en ubicación: recogida conserva carrito/notas, no cobra domicilio; cancelar/reiniciar vacía el carrito y luego permite comprar una unidad nueva para recoger. Todos completan pago y confirmación simulados; se verifica única creación, DTO con unidades correctas, recogida sin tarifa ni dirección anterior. No se cancelan pedidos reales ya enviados: findTodayOrdersByPhone devuelve vacío en estos fixtures.

Foco114/114,4suites,26,41s; TypeScript general/build y Node92/92 OK. Logs /tmp/ppp-177-{baseline,focus,tsc,node}.log. Comparados543hashes de /tmp/ppp-176-hashes.json sin diferencias; global vigente18.181/245suites, no repetir global ni sumar36 como global ejecutada. Fuente adicional solo nueva suite177. Modelos/mapas simulados, sin API/Meta/órdenes externas.

Próximos: preguntas múltiples con correcciones de contacto; direcciones con referencias y pin rotulado calle+nombre; separar cancelación de carrito pendiente de consulta sobre orden ya enviada sin confundir ambos estados. No declarar vendible por conteos.
