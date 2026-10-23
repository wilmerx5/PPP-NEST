# Tanda 118 — opciones sobre unidades ya divididas

## VIGENTE — tanda 118: cambiar una unidad de una línea dividida (22/10)

Base cc4e71e5, staging. 36 regresiones nuevas: tres menús sintéticos, agente simulado on/off, compra/pago/confirmación y elección de línea explícita o mediante aclaración. Parten de cuatro combos con Uva y nota, cambian dos bebidas a Pepsi y solo una de las dos unidades restantes a Limonada. Verifican reparto final Uva×1/Pepsi×2/Limonada×1, opciones compatibles, notas, estado y 36 DTO completos sin crear órdenes antes de confirmar.

Baseline: 18 aprobados por aclaración y 18 fallidos con «cambia una de la línea N por Limonada». La regla de referencia explícita admite ahora «de la línea» además de «unidad de la línea»; no cambia selección por producto ni cantidades. Foco 600/600 en cinco suites; TS general/build OK, Node 92/92. Global 16.285/16.285, 192 suites, 490 hashes intactos, inventario exacto, 606,42 s, sin reintentos.

Código publicado en staging, pendiente de despliegue agrupado. Servidor conserva 6863b72c (tanda 117), acceso público activo; Main/producción preservados. Cero llamadas pagadas, WhatsApp u órdenes externas. Evidencia: [tanda 118](whatsapp-split-combo-unit-validation-2210.md).

Límite: cambios sobre combos ya añadidos y divididos, no selección inicial de varios sabores en una opción pendiente. Siguiente: reparto completo durante elección inicial de bebida y conservación de contacto/notas; contrastar cantidades que no suman y sabores no ofrecidos. No inferir calidad del modelo real a partir de mocks.

## Evidencia

- `/tmp/ppp-118-baseline.json`: 36 casos ejecutados; 18 fallos en referencia explícita y 18 aprobados mediante aclaración.
- `/tmp/ppp-118-targets.json`: 600 aprobados / cinco suites, incluyendo planificación por unidad, aclaraciones, notas/opciones y subconjuntos binarios.
- `/tmp/ppp-118-tsc.log`, `/tmp/ppp-118-build.log`: TypeScript general/build aprobado. `/tmp/ppp-118-node.log`: 92 controles aprobados.
- `/tmp/ppp-118-global-summary.json`: global completa en una ejecución, 16.285 pruebas, 192 suites, 490 hashes sin cambios, 606,42 s. Ráfagas aisladas y resto con cuatro workers.
- Los 36 recorridos parten de compra real por router, conversión a combo, cambio parcial y segundo cambio. No se siembra directamente el carrito dividido. La aclaración comprueba carrito inalterado antes de elegir fila.
- DTO de cuatro unidades, bebida por unidad, nota sin cebolla, mismo producto; el carrito conserva además opción original compatible (pollo/término/salsa). Estados de pago y confirmación se conservan al modificar.
- Regla general por referencia numérica a línea, sin IDs, nombres ni precios de PPP en producción. El número de línea se distingue de la cantidad a cambiar.
- Modelos, transporte y órdenes externos simulados. No acredita inferencia real, venta ni selección inicial de sabores repartidos.
- Sin despliegue esta tanda: agrupar con el siguiente bloque validado. No revertir WHATSAPP_STAGING_PUBLIC_CHAT=true ni abrir eventos de cocina.
