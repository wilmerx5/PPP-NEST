# Tanda 202 — preferencias de ají y notas del combo

Base `356738c0`, staging, 26/10/2026 Bogotá. Inferencia, mapas, Meta y órdenes simulados; cero llamadas pagadas. Main preservada, sin despliegue.

## Reproducción

Seis diagnósticos201: dos aprobados (bowl), cuatro fallidos (arroz pierde nota; pasta mezcla ingredientes del título). Trazas `/tmp/ppp-202-trace2.log` y `/tmp/ppp-202-trace3.log`: arroz entra por resolución múltiple, que separa «con bastante ají» tras la coma y lo devuelve como no resuelto; pasta entra por namedMeal, que pasa una nota extraída sin conocimiento del producto y evita la extracción del handler basada en catálogo.

## Corrección

La preparación del texto une una preferencia final acotada de intensidad de ají al plato anterior. Reutiliza el reconocedor existente, tolera acentos/cortesía y respeta preguntas, cantidades, compras coordinadas y nombres exactos del catálogo. No generalizar esta regla a cualquier «con X»: puede ser otro producto.

La ruta namedMeal conserva su extractor de modificaciones, ahora con el producto elegido como contexto para enmascarar ingredientes del título. El enmascarado se comparte con orderKitchenNote. Así no anota ingredientes propios del título ni cambia la deduplicación de notas en ráfagas. No introduce nombres, IDs ni precios PPP.

Durante desarrollo, el ajuste de coma quedó inicialmente en otro método; la traza detectó que no afectaba el fallo y se movió a frameSpokenOrder antes de validar. No atribuir resultado a ese intento fallido. Seis originales finalmente6/6 hasta DTO: `/tmp/ppp-202-third.json`.

## Matriz

Promovido el diagnóstico sin copia duplicada: `whatsapp-combo-intensity-note.spec.ts`. 18 conversaciones: 3 menús × agente simulado off/on × bastante/poco/mucho ají. Verifican respuesta, cart, building_cart, cantidad2, bebida y DTO con dos unidades. Diez controles de preparación del texto: acento/cortesía, cantidades, pregunta, otro ingrediente, compra coordinada y nombre exacto del catálogo. Las pruebas de preparación no acreditan por sí solas el cierre completo de sus mensajes.

Foco final: 69/69 en cuatro suites, `/tmp/ppp-202-focus-final.json`. TypeScript general/build y Node92 aprobados. La primera matriz reportó seis fallos de oráculo: exigía «con poco ají» aunque guardaba correctamente «poco ají»; se ajustó sin cambiar runtime. Global final aprobada tras reparar las regresiones descritas abajo.

## Límites y siguientes pasos

Sin medición de modelo real ni ahorro. Siguen los ocho diagnósticos de composición197, otras familias pendientes y costos: observabilidad199 sin desplegar, sin audio/visión/legacy ni asociación a orden. La optimización de llamada de resumen198 sigue pendiente; conservar recuperaciones por acciones/pedidos incompletos. No declarar vendible por conteos.

## Regresión encontrada en la primera global

Primera global: burst80/80; resto18.674aprobadas/6fallidas. Falló la deduplicación de «sin azúcar/sin azucar» y «sin hielo» en tres menús con agente mock off/on (`whatsapp-pending-option-extras.spec.ts`). Delegar toda la nota a orderKitchenNote introducía la repetición. No se publicó ese resultado. Se conserva el extractor anterior y se le pasa opcionalmente el producto para retirar su título; se revalidan regresiones y nueva matriz juntas. Evidencia `/tmp/ppp-202-rest.json`, `/tmp/ppp-202-repair.json`.

## Cierre final

Reparación focal:123/123 (`/tmp/ppp-202-repair2.json`), incluye las seis regresiones y28casos de esta tanda. TypeScript general/build yNode92 aprobados de nuevo. Global final:18.760 pruebas/268suites,575hashes inalterados, inventario exacto,712,34s (`/tmp/ppp-202-final-global-summary.json`). No sumar las ejecuciones repetidas como nuevos casos.

Publicación solo staging, sin deploy. Diagnósticos201 de ají ya están todos verdes y promovidos a spec; no seguir listándolos como pendientes. No se ha demostrado ahorro real de API ni aptitud comercial global.
