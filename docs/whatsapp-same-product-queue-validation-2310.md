# Tanda164: filas del mismo producto con opciones y notas distintas

## VIGENTE — tanda164: mismo producto, líneas y orden de llegada (23/10)

Based51589ca, solo staging.24 recorridos nuevos: tres menús×agente simulado on/off×sabores diferentes/mismo sabor con notas diferentes×orden normal/invertido. Baseline12/12 pasó; al invertir el orden aparecieron2 fallos/22 aprobados: Chocolate de una nueva malteada se aplicaba como Cola de la gaseosa activa. Antes de absorber opciones se prioriza compra explícita de otro producto nombrado inequívocamente, sin pedidos múltiples. Se reutiliza helper de cola; no hardcodes de productos/IDs.

Foco84/84,38,345s; TypeScript general/build OK; Node92/92. Global17.593/17.593,233suites,531hashes,781s; inventario exacto/fuente congelada. Evidencia /tmp/ppp-164-fixed-focus3.log, tsc-approved.log, node-approved.log y global-summary.json (mismo prefijo). Cero API/Meta/órdenes externas. Publicación solo staging; runtime161,163–164 pendientes de deploy agrupado. Último servidor acreditadoe8cf6ffa(158–160). Main intacta.

Próximo: cancelar activa con sucesoras ya resueltas, mismo producto que la selección activa, compras por referencia («otras dos de esas»), agotamiento/cantidad tras encolar.164 acredita dos filas del mismo SKU distinto del activo, sabores explícitos, notas separadas y orden invertido. No extrapolar a estos pendientes. Modelo/mapa simulados y checkout inicial sembrado; contraste real pendiente. Ver whatsapp-same-product-queue-validation-2310.md. No declarar vendible por conteos.

## Reproducción

Suite whatsapp-pending-same-product-queue.spec.ts. Tres menús sintéticos bowl/gaseosa/malteada, pizza/jugo/café y arroz/refresco/batido. Con dos bebidas iniciales pendientes se solicitan dos unidades de otro producto Vainilla sin azúcar y tres Chocolate sin hielo; variante con Vainilla también en la segunda línea. Se invierte el orden de esas dos solicitudes.

Las12 pruebas originales pasaron. La ampliación tuvo primero un error de tipado del test (sendQueued puede retornar undefined); se corrigió el tipo sin alterar el oráculo. Después fallaron2 de24 pruebas: ambos modos de agente con Chocolate solicitado antes de Vainilla en el menú de gaseosa Cola. Respuesta y carrito mostraban gaseosa Cola agregada, ignorando malteada. Una primera guarda después de absorber la opción no resolvió el fallo. Se mueve la prioridad antes de absorbPendingOptionAnswer y modificaciones de carrito. La primera ubicación usaba una variable antes de declararla; compilación lo detectó, se adelantó el cálculo existente de multiDishUpFront. Las84 focalizadas finales y global validan el resultado corregido, no esos intentos fallidos.

## Contrato final

Cada solicitud explícita conserva la selección activa y encola su propia fila. Consulta de contenido responde ingredientes sin mutar el carrito. Al elegir el sabor inicial se drenan las filas resueltas y se vuelve a pago. La orden simulada contiene exactamente ocho unidades: plato inicial1, bebida inicial2 y otro producto5 distribuidas en2 sin azúcar y3 sin hielo. Sabores y notas se comprueban por unidad; ninguna línea hereda la nota de la otra, aunque compartan sabor. Una sola creación simulada, contacto/dirección conservados.

## Límites

La guarda usa nombre completo normalizado de un solo producto del catálogo y verbo explícito de compra; conserva camino de respuestas cortas y pedidos múltiples. No supone que toda coincidencia de sabor esté resuelta ni modifica globalmente su matcher. No prueba filas del mismo SKU activo, pronombres, agotamiento posterior, proveedor real ni WhatsApp. Siguiente tanda debe reproducir esos caminos antes de cambiar reglas. Sin despliegue en esta entrega.
