# Tanda 237 — reparaciones de pedido hablado del chat 25/10

Base `e132dd91`, staging. Dependencias externas simuladas; sin API pagada, Meta, mapas ni órdenes externas. Main y modelos intactos.

## Diagnóstico de partida

Reejecución de los tres diagnósticos históricos en `e132dd91`: 10/28 verdes. `whatsapp-order-transfer-diagnostic.repro.ts` ya estaba 8/8 (corregido por tandas anteriores); `whatsapp-chat-2510-audit.repro.ts` 0/12 y `whatsapp-evening-chats-2510.repro.ts` 2/8.

## Cambios (por estructura de frase y catálogo, sin nombres/IDs/precios de PPP)

- Cortesía final «si es tan amable», «si me hace el favor» ya no forma parte del nombre del plato. «por favor» final se conserva como antes (su retiro alteraba rutas de rechazo existentes).
- «porción adicional/extra/aparte de X» se lee como «porción de X», que el catálogo vende como porción.
- «bandeja/plato/caja de <plato nombrado completo>» compra ese plato, salvo que el catálogo venda productos «bandeja de …».
- «no quiero las/los/el/la N <producto>» retira (o reduce si N es menor) esa línea del carrito; «no, quiero N» sigue corrigiendo cantidad. Errores frecuentes de «quiero» (quieor, qiero, quiro…) y acentos/tildes graves sueltos dentro de palabras («p`ronto») se normalizan.
- «dos <plato con …> en lugar de A B»: el nombre del plato con «con» se protege del reescritor de cambios de acompañamiento, y la frase se convierte en nota «sin A y con B». Si «A B» aparece junta en la descripción del plato, se trata como un solo acompañamiento («sin papa criolla»). Sin reemplazo queda «sin A».
- «necesito/quisiera/deseo + cantidad» cuenta como pedido por cantidad para conservar notas de acompañamiento.

## Pruebas

30 regresiones nuevas (`whatsapp-spoken-order-repairs.spec.ts`): tres menús sintéticos (arroz, pasta, quinua; con bandejas variantes, porción, combos con la palabra base y sopa) × agente simulado off/on × cinco comportamientos: cortesía final, porción adicional, bandeja contenedora, cambio de acompañamiento hablado con/sin descripción y retiro/reducción con errores de escritura más control «no, quiero 3». Baseline en `e132dd91`: 26 rojas/4 verdes; tras el cambio 30/30.

Durante la validación se detectaron y corrigieron dos regresiones propias: retirar «por favor» final cambiaba la ruta de rechazo de productos inexistentes (4 casos) y ampliar «quiero» en el conteo hacía que el router agregara un combo rechazado por el agente durante el pago (3 casos). Ambas suites vuelven a pasar.

Diagnósticos históricos tras la tanda: 20/28 (auditoría 10/12, chats de la tarde 2/8, transferencia 8/8). Siguen rojos: cambio de preparación de un ejecutivo existente sin agregar unidad, «7 up» como sabor, saludo con domicilio como destino y reparto de dos sopas.

TypeScript general y de build, Node 92/92. Cierre independiente: 12 recorridos nuevos hasta DTO (tres menús × agente simulado off/on × extra independiente/cambio de acompañamiento). Verifican contenido de respuesta, ausencia de orden antes de confirmar, cantidad exacta y notas en DTO. La suite queda en 42/42.

## Validación final consolidada

La primera global tuvo 20.021 aprobadas y tres timeouts en 306 suites (20.024 pruebas); no fue una ejecución verde. La repetición parcial también tuvo cuatro timeouts. La familia completa pasó en diagnóstico con mayor margen, sin cambios de aserciones; finalmente **toda la suite de ráfagas pasó 80/80 con el timeout normal de cinco segundos**, en solitario. No se alteraron temporizadores ni timeout del repositorio. Un perfil CPU aislado muestra costo de catálogo, pero no demuestra una causa única ni una mejora de rendimiento.

Solo se amplió el spec de esta tanda después de la global; el código de producción quedó intacto. Consolidación por nombre de suite, reemplazando las dos suites revalidadas sin duplicarlas: **20.036 pruebas en 306 suites**, todas aprobadas en sus ejecuciones registradas. Esto no se presenta como una nueva global verde única. Snapshot src/scripts intacto durante verificaciones finales. TypeScript general/build y Node92 nuevamente aprobados. Evidencia durable: `docs/whatsapp-batch-237-consolidated-validation.json`.

## Límites

No acredita «quiero + cantidad + plato + sin A y con B» con acompañamiento desconocido en catálogos sin ese acompañamiento (sigue cayendo a la pregunta genérica; queda pendiente sin alterar la precedencia del rechazo del agente durante el pago). La reescritura «en lugar de A B» requiere que el plato con «con» preceda a la frase. Sin inferencia real.

Publicación solo staging; sin despliegue en esta tanda (staging verificado en 231 `1f0a2f8c`; 232–237 pendientes agrupados). No declarar vendible por conteos.
