# Tanda 123 — retirada de reparto pendiente

## VIGENTE — tanda 123: cancelar un reparto pendiente y retomar el cierre (22/10)

Base 0ba5a9ce, staging. 36 regresiones nuevas: seis escenarios × tres menús sintéticos × agente simulado on/off. Después de iniciar el reemplazo de cuatro platos por combos y repartir solo dos con Uva/sin tomate: cancelar ese cambio, olvidarlo, cancelar la selección, cancelar y elegir de nuevo con Pepsi, reiniciar y comprar otra vez, o cancelar después de guardar un nombre. Todos llegan a DTO, sin orden antes de confirmar.

Los 36 casos pasan con el código existente. Cancelar selección conserva el carrito original y su nota sin cebolla; la nota sin tomate del reparto abandonado desaparece; al reintentar no sobreviven sabores parciales; reiniciar vacía y permite una compra nueva de una unidad. El nombre explícito guardado antes de cancelar se conserva en el cierre. No se modificaron reglas de producción.

Foco final 852/852 en cinco suites (84,349 s); TypeScript general/build OK y Node 92/92. Solo pruebas/documentación: no nueva global ni despliegue. La última global de código ejecutable sigue siendo tanda 121, 16.459/16.459 en 192 suites; no es un conteo global de esta tanda. Cero API pagada, WhatsApp u órdenes externas.

Publicar en staging. Servidor conserva 17bc27a7, imagen 2a57360d…, última verificación de despliegue 22/10 23:41 Bogotá. No se cambió Main/producción ni acceso público de staging/bloqueo de eventos de cocina. Evidencia: [tanda 123](whatsapp-cancel-partial-distribution-validation-2210.md).

Siguiente: corrección libre del grupo aún pendiente («los primeros mejor con…», «esos dos sin…») sin cancelar el producto; preservar el resto y preguntar si el grupo no es único. Sigue pendiente contrastar conversación básica completa con consulta, dirección y cierre fuera de la familia de combos. Esta tanda no acredita esas correcciones libres, cancelación de órdenes ya confirmadas, cambios de stock ni modelo real.

## Comportamientos y oráculos

Fixture en `src/whatsapp/whatsapp-related-combo-offer.spec.ts`, casos `withdraws a partially distributed replacement`:

- `cancela ese cambio`, `olvida ese cambio`, `cancela esa seleccion`: eliminan elección pendiente, conservan carrito original exacto y permiten cerrar cuatro platos originales.
- `retry`: después de cancelar, una elección nueva del combo con Pepsi produce cuatro combos; no conserva Uva ni sin tomate del grupo abandonado.
- `restart`: vacía el carrito/elección y permite comprar y cerrar una sola unidad del plato original.
- `cancelAfterName`: el nombre explícito capturado durante la selección se mantiene en el DTO, aunque se cancele el reemplazo del producto.

Se ejecutan en tres menús con preparación de pollo, término de hamburguesa y salsa de salchipapa, con agente simulado activo/inactivo. No se siembra carrito. Compra, oferta, opción, reparto parcial, cancelación y cierre pasan por el router. Se compara el carrito original exacto al cancelar y se verifican ID, cantidad, preparación, notas, nombre y DTO final; no creación anticipada y exactamente una orden simulada al confirmar.

## Resultados

- `/tmp/ppp-123-baseline.json`: 36/36 aprobados en código existente.
- `/tmp/ppp-123-targets.json`: 852/852 en cinco suites, 84,349 s; no sumar con baseline como pruebas independientes.
- `/tmp/ppp-123-tsc.log`, `/tmp/ppp-123-build.log`, `/tmp/ppp-123-node.log`: TypeScript general/build y 92 scripts aprobados.
- No nueva global: código ejecutable idéntico al despliegue 17bc27a7; solo tests y documentación cambian. No inferir rendimiento de producción de tiempos del runner local.

## Continuación

Para correcciones libres del grupo pendiente, reproducir primero con ambos modos simulados y varios catálogos, contrastando referencias ambiguas y cambio de cantidad. Si hay cambio de reglas, correr foco/TS y luego global congelada (ráfagas en serie, resto cuatro workers). No hacer llamadas pagadas ni WhatsApp desde estos tests. Preservar Main, staging público y aislamiento de eventos.
