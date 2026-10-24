# Tanda167: retirar sabor durante selección activa

## VIGENTE — tanda167: sabor activo retirado y salida de la selección (24/10)

Base59dfc826, solo staging.24 recorridos nuevos: tres menús×agente simulado on/off×nombre/número de sabor retirado×elegir alternativa/cancelar bebida. Baseline12/12 pasó y ampliación24/24 pasó sin cambio runtime. Se cambia el catálogo después de ofrecer sabores: opción anterior ya no existe; bot avisa, muestra Naranja, conserva carrito y cola; consulta de contenido no consume pendiente. Alternativa o cancelación termina sucesoras completas conservando cantidades/notas y DTO exacto.

Foco60/60,24,568s; TypeScript general/build OK; Node92/92. /tmp/ppp-167-{baseline,focus,tsc,node}.log. No global redundante por tests/docs; última global166=17.629/235suites, no sumar focos a global. Cero API/Meta/órdenes externas. Publicación solo staging; no deploy. Runtime166 sigue pendiente de deploy agrupado; servidorb8a6567a(161–165). Main intacta.

Próximo: cambio de cantidad mientras elige sabor, opción retirada de una compra posterior ya encolada, reordenamiento de números, mismo SKU activo y referencias «otras dos de esas».167 acredita retiro de opción de selección activa, no estos pendientes. Modelo/mapa simulados, inicio de checkout sembrado; contraste real pendiente. Ver whatsapp-withdrawn-flavor-queue-validation-2410.md. No declarar vendible por conteos.

## Contrato

Suite whatsapp-pending-withdrawn-flavor-queue.spec.ts. Tres cartas: bowl/gaseosa/malteada, pizza/jugo/café y arroz/refresco/batido, más té. Carrito inicial contiene un plato y pago pendiente. Se solicitan dos bebidas sin hielo, dos del siguiente producto Vainilla sin azúcar y tres tés Durazno sin hielo.

Se actualiza catálogo para retirar primer sabor de bebida activa. Cliente responde con nombre retirado o número1 de la lista anterior. Respuesta debe informar retiro y mostrar alternativa disponible, sin comprar ni cambiar carrito. Cola conserva sus tres filas. Consulta «qué trae» responde agua filtrada y mantiene pendientes. Cliente elige Naranja o cancela bebida: finaliza demás compras y vuelve a pago.

DTO exacto de8 o6 unidades según conserva/cancela primera bebida, sin sabor retirado; notas, sabores de las otras compras, dirección, nombre y teléfono conservados. Una creación simulada solo al confirmar. La disponibilidad del producto permanece verdadera: se prueba retiro de opción, no de SKU.

## Límites

No hay cambios de lógica. No prueba opción retirada de filas posteriores, cantidades modificadas, sabores reordenados ni proveedor real. Se ejecutan focos relacionados y TypeScript/scripts; no otra global por cambios exclusivos de tests/documentación. Main y servidor intactos.
