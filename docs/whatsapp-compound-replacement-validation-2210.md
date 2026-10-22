# Tanda 107 — quitar y pedir un reemplazo como una sola operación

Base d297c651, staging. El patrón real «quita el de costilla y dame el combo con medio broaster y up» mezclaba una eliminación con una compra y podía dejar dos combos o perder opciones.

## Reproducción y alcance

Baseline: 24/24 fallidos con nombres completos en tres menús sintéticos (arroz, hamburguesas y pizzas), agente on/off. Casos: carrito en construcción, pago pendiente, opción nueva explícita y reemplazo inexistente. Se observó carrito vacío o productos duplicados; la orden de quitar no quedaba ligada al éxito de añadir.

Corrección general: parseCartItemReplacement reconoce «quita/retira/elimina X y dame/ponme/agrega Y». En construcción y checkout pasa por el reemplazo validado antes de modificar el carrito. Se heredan únicamente opciones presentes en el catálogo del destino; una opción nueva explícita tiene prioridad. Los productos adicionales explícitos siguen siendo compras adicionales. El paso de pago se conserva y en construcción vuelve a «algo más».

38 regresiones nuevas: 24 originales, 6 compras adicionales, 6 recorridos hasta DTO de orden simulada, 2 de frase abreviada real con agente on/off. En los últimos dos se exige conservación y aclaración, no resolución automática. El alias incompleto «medio broaster y up» todavía no está resuelto: no afirmar que la sustitución exacta del chat ya se completa sin aclaración.

Foco: 289/289 en cuatro suites. DTO: una sola línea nueva, sin producto anterior, opción esperada y una sola creación de orden simulada. Sin llamadas pagadas, WhatsApp, Google real ni órdenes externas.

## Próximos pasos

1. Resolver la referencia abreviada mediante la familia del producto del carrito y sus opciones de catálogo. Probar destinos ambiguos, fuera de carta y bebidas no compatibles. No fijar “up” como alias global sin validación contra opciones disponibles.
2. Probar cambios de varias líneas: precisar cuál sustituir y conservar cantidad, notas y opciones diferentes sin borrar otras líneas.
3. Afirmaciones del modelo sobre dirección confirmada tras geocodificación fallida: contrastar respuesta con estado y bloquear confirmación ficticia.

Main y producción quedan intactos. Agrupar despliegue de staging después de validación; publicar Git no equivale a desplegar.

## Validación final

TypeScript general y build OK; Node 92/92; diff --check OK. Global 80/80 + 15.735/15.735 = 15.815; 190 suites, unión exacta del inventario, 488 hashes iguales. Duraciones 64,390 s + 458,297 s, sin reintentos. Evidencia local /tmp/ppp-t107-{bursts,rest}.json y /tmp/ppp-t107-targets.log.
