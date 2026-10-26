# Tanda 191 — ingredientes del nombre frente a notas de cocina

Base: b9bf7639, rama staging. Corrección local del 25/10/2026. Validación completa aprobada; ver cierre al final.

## Fallo reproducido y cambio

«Me das un pollo frito y 2 plátanos con queso y bocadillo por favor» añadía las cantidades correctas, pero dejaba la nota espuria «con queso y bocadillo por». Baseline: 2 fallos (agente simulado off/on). Las seis compras individuales de tres catálogos ya pasaban; no atribuirles una mejora nueva.

El camino que agrega varios platos extraía modificaciones sin considerar el producto elegido. Ahora reutiliza `orderKitchenNote` en ese punto, que distingue ingredientes del nombre de instrucciones de cocina. Se mantienen los extractores complementarios de cocción, intensidad y cambios existentes. No se agregan excepciones por producto, ID o restaurante.

## Pruebas y límites

`whatsapp-catalog-name-notes.spec.ts`: 20 casos, incluidos plátanos, bowls y sándwiches. Compra individual, compra mixta real, compra mixta sintética con/sin nota «sin cebolla», agente simulado off/on. La matriz comprueba cantidades, nota de cada producto, respuesta sin falsa aclaración, estado y 12 cierres con DTO de tres unidades. Foco junto a recapitulaciones190: 65/65, 34,898 s. Evidencia `/tmp/ppp-191-focus.json`.

La prueba usa modelo, persistencia y creación de órdenes simulados. Cero inferencia pagada, Meta u órdenes externas. No acredita procesamiento real de audio ni calidad del modelo real.

## Conversación larga que sigue abierta

`whatsapp-accompaniment-recovery.repro.ts` es un diagnóstico opt-in, intencionalmente fuera del inventario verde. Reproduce desde saludo las consultas previas de plátano, pollo y gaseosa, la compra «si tienes yuca mejor para que uno venga con papas y el otro con yuca», la corrección y la recapitulación. Ambos recorridos fallan: no llegan al carrito esperado de pollo frito ×1, broaster ×1 y plátanos ×2.

Sin agente, la compra larga se desvía a exploración del catálogo y la siguiente corrección deja solo broaster. Con el agente simulado, la corrección posterior deja ambos pollos, pero faltan los plátanos. La conversación completa no reprodujo la nota residual porque nunca añadió esos plátanos; esa nota sí se reprodujo en la compra mixta focal anterior. No confundir ambas evidencias ni atribuir al mock el comportamiento exacto del modelo productivo.

Comando diagnóstico: `npx jest --testRegex='whatsapp-accompaniment-recovery\.repro\.ts$' --runInBand`. Evidencia `/tmp/ppp-191-baseline.json` y `/tmp/ppp-191-replay-{false,true}.json`. Primer intento tuvo un error TypeScript en el diagnóstico y no cuenta como baseline; el segundo ejecutó los dos recorridos y falló funcionalmente.

## Próximo trabajo

1. Separar intención de compra de condicionales sobre acompañamientos sin convertir «tienes» en navegación ni comprar los acompañamientos aparte.
2. Conservar los productos inequívocos y pedir únicamente la asignación pendiente de papas/yuca cuando no se sepa cuál plato lleva cada una. No prometer una sustitución no soportada.
3. Recuperar compra parcial sin duplicar lo ya añadido; repetir y corregir cantidades manteniendo notas/opciones por unidad.
4. Probar esas decisiones en varios catálogos y todos los pasos del checkout hasta DTO. Mantener abiertos los diagnósticos183/184/186 y efectivo/cambio50.

No desplegar ni afirmar resuelto el chat largo por esta corrección de notas. Main/producción no se modifican.

## Cierre de validación

TypeScript general y build aprobados; Node92/92. Global final18.524 pruebas/259 suites,560 hashes,749,4 segundos. Inventario exacto y fuente congelada verificados por el runner. Evidencia `/tmp/ppp-191-global-summary.json`; bloque ráfagas80/80 y resto18.444/18.444. No se modificaron fuentes durante la global. El diagnóstico abierto `.repro.ts` no pertenece a ese inventario aprobado.

Publicación en rama staging, sin despliegue. Main y producción sin cambios. La siguiente tanda debe atacar el replay fallido, no repetir el inventario como sustituto de corregirlo.
