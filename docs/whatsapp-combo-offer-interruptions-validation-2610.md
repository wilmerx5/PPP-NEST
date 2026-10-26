# Tanda 210 — rechazar el combo y comprar bebida aparte

Base: `3644d578`, rama `staging`. Main y producción permanecen en el código validado de la tanda209; esta continuación no solicita otra promoción.

## Fallo reproducido y corrección

Con dos platos base, preparación y nota guardadas, el bot propone convertirlos a combo. «No, mejor una gaseosa 400ml Pepsi aparte» aceptaba el combo porque el volumen y el sabor coincidían con sus opciones. El rechazo explícito con bebida aparte ahora elimina la propuesta y continúa por el router de compras. La continuación «sin combo, ...» excluye ese prefijo contextual para que no vuelva a interpretarse como compra de combo. Reglas generales, sin IDs, nombres ni precios de restaurante en runtime.

Nueva suite `src/whatsapp/whatsapp-combo-offer-separate-drink.spec.ts`:18 conversaciones en tres menús (arroz compuesto, bowl y pasta), agente simulado apagado/encendido y tres formas de rechazo. Comprueba respuesta, carrito, estado building_cart, conservación exacta del plato original (dos unidades, preparación y nota), bebida independiente de una unidad y18 cierres DTO simulados con tres unidades y sabor conservado. No crea órdenes externas.

El primer foco registró771 aprobadas/6 fallidas: la nueva variante «sin combo» aún recompraba el combo; no se ocultó ese fallo. Tras ajustar la continuación, las18 regresiones nuevas pasan (`/tmp/ppp-210-new-final.json`). Los759 controles existentes del foco inicial pasaron; su revisión sobre la fuente final se realiza en la global. Falafel1/1, TypeScript general/build final y scripts Node92/92 aprobados. Global final aprobada:18.962 pruebas/275 suites,582 hashes,715,19 segundos; inventario exacto y fuente congelada (`/tmp/ppp-210-final-global-summary.json`). Incluye todas las guardas sobre el código final.

## Diagnóstico abierto, separado de regresiones aprobadas

`src/whatsapp/whatsapp-combo-offer-interruptions.repro.ts` es opt-in y contiene36 casos. Baseline inicial30:12 aprobados/18 fallidos. Tras corregir la negativa y añadir seis casos ambiguos:18 aprobados/18 fallidos (`/tmp/ppp-210-diagnostic-final.json`). No equivale a aprobación de toda la familia.

Pendientes, seis fallos por grupo (tres menús × dos modos simulados):

- «¿Cuánto cuesta el combo?» responde el precio del plato base. Debe consultar el candidato ofrecido vigente y conservar compra/propuesta sin aceptarla.
- «¿Qué sabores de bebida tiene el combo?» lista variantes de plato. Debe responder opciones del combo ofrecido y mantener la selección pendiente.
- Dos combos con igual título y bebidas de400ml/1.5L: debe presentar alternativas identificables por descripción y conservar cantidad/preparación/nota sin decidir una compra por el usuario. La traza de arroz compra directamente dos combos y no muestra la nota «sin cebolla», sin ofrecer las dos presentaciones. No atribuir aún una causa interna sin revisar esa ruta.

Los seis casos de contenido y seis de opción retirada pasan con cierre DTO. Los seis de negativa también pasan; sus variantes se ampliaron en la suite aprobada. No afirmar que preguntas sin puntuación, nombres abreviados, todas las bebidas ni ambigüedades estén cubiertas por esta tanda.

## Siguiente bloque

Resolver las consultas de precio/sabores sobre la propuesta pendiente antes de ampliar compras ambiguas. Reutilizar catálogo vigente; probar precio cambiado, candidato retirado y aceptación posterior, además de preguntas sin signos y con cortesía. Verificar no duplicación, respuesta coherente, pendingMatch y DTO al cerrar. Mantener los casos rojos opt-in hasta corregirlos, sin suavizar oráculos.

Cero llamadas pagadas, Meta y órdenes externas. No cambios de modelos ni afirmaciones de ahorro basadas en mocks. El uso real instrumentado sigue pendiente de medir. No declarar listo para venta por conteos de pruebas.
