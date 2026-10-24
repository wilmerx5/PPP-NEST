# Tanda160: compra adicional durante sabor

## VIGENTE — tanda160: compra adicional mientras elige sabor (23/10)

Base10bbfd60, solo staging.24 recorridos nuevos: tres menús×agente simulado on/off×añadir uno/añadir dos/añadir con nota/selección numérica de sabor tras consultar categoría. Baseline inicial12:3 fallos/9 aprobados; solo agente activado desviaba compra explícita antes del helper existente. Se reconoce también la forma normalizada «quiero», se ejecuta compra adicional inequívoca antes de deferir al agente, sin consumir respuestas de atributo ni pedidos múltiples. Helper de adición preserva cantidad y nota (antes fijaba una unidad sin nota). Carrito, pendiente, respuesta, estado y DTO verificados.

Foco84/84,14,363s; TypeScript general/build OK, Node92/92. Global17.509/17.509,229suites,527hashes,616,79s; inventario exacto/fuente congelada. Evidencia /tmp/ppp-160-{baseline,focus,tsc,node}.log y global-summary.json. Cero API/Meta/órdenes externas. Main intacta. Publicación staging y deploy agrupado158–160 a verificar; último servidor acreditado0a3e2ae4.

Próximo: segundo producto también exige opciones; dos selecciones con consultas/cancelación intermedia, agotados y compra con sabor ya explícito. Esta tanda acredita producto adicional sin atributos y respuesta1 que elige sabor (no producto del listado informativo). No acredita cola de dos productos configurables. Ver whatsapp-pending-category-purchase-validation-2310.md. Contraste real pendiente; no declarar vendible por conteos.

## Detalle

Se siembra un plato en pago, se piden dos bebidas sin hielo y el router abre sabor. Consulta sopas/postres/entradas, añade un producto de esa categoría (una unidad, dos o una con nota) y termina sabor. Cuarto camino responde1 directamente tras consultar, comprobando que selecciona sabor y no compra el producto de la categoría. Cierre contra mock de órdenes, verificando cantidades, notas, atributos, contacto y destino.

El baseline inicial incluyó12 casos (uno y selección numérica). Tras ampliar a24 se verificaron plural/notas. No afirmar baseline24. El primer intento de corrección no cubría «quiero», que resulta de normalizar «agrega». También hubo un error TypeScript durante desarrollo por invertir parámetros note/attributes; corregido antes del foco/global finales. No se usaron respuestas reales del modelo como evidencia.

## Validación

Foco Jest runInBand: whatsapp-pending-category-purchase.spec.ts, whatsapp-pending-flavor-category.spec.ts y whatsapp-pending-drink-questions.spec.ts bajo src/whatsapp. TypeScript general/build y node --test scripts/*.test.cjs. Global /tmp/ppp-160-global.py, ráfagas aisladas y resto4workers, inventario exacto y hashes iguales; sin edición durante global.

## Límites y siguiente

El producto adicional no tiene atributos. Segundo producto configurable actualmente requiere terminar el primero; probar ese flujo, cancelaciones y disponibilidad sin atribuir cobertura a esta tanda. Mantener pruebas gratis y fuente congelada; no globals paralelas. Agrupar deploy158–160 solo a staging y verificar HEAD/imagen/health antes de decir desplegado.
