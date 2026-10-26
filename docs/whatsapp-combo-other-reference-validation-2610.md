# Tanda 225 — «no ese, el otro» y alternativas inciertas

Base `7a420e39`, staging. Cambios generales de referencia a alternativas pendientes.

## Fallos reproducidos

Baseline30/30 rojas: «no ese, el otro», «la otra por favor» o «el otro» devolvían normalmente carrito sin resolver la referencia. Tras la primera corrección, ampliación42:30 verdes/12 rojas para alternativa agotada o eliminada; no se compraba, pero tampoco se explicaba por qué.

## Corrección

La referencia relativa requiere una presentación actual identificada en la lista y exactamente una alternativa distinta. Sin ese antecedente o con más alternativas, pide número y conserva carrito. No deduce el antecedente del precio ni del orden de la lista. La resolución vuelve al camino normal de elección, con opciones propias de la alternativa, cantidades/notas originales y recotización si cambió el precio.

Las elecciones numeradas resueltas también pasan por la validación de disponibilidad si falta el producto o está agotado: se informa el motivo sin modificar carrito. No se eliminan candidatos para hacer que una referencia originalmente ambigua parezca única.

## Pruebas

42 conversaciones: tres menús (arroz,bowl,pasta), agente simulado off/on y siete caminos: referencia única, cortesía, tres opciones ambiguas, ausencia de antecedente, precio cambiado, agotado y eliminado. Se comprueban respuesta, carrito intacto cuando corresponde, opciones, dos unidades, precio/notas y cierre DTO simulado.

Foco168/168 en cinco suites,38,634s. TypeScript general/build,92 controles Node y guardia Falafel verdes. Global completa: 19.644 pruebas en 291 suites, 598 hashes, 735,81s. Inventario exacto y fuente sin cambios durante la ejecución. Evidencias `/tmp/ppp-225-*`.

## Límites y continuación

La referencia actual procede de la presentación identificada durante la oferta/recotización; no acredita resolución libre de pronombres en cualquier conversación. Siguiente: «el otro con ...», correcciones que nombran explícitamente ambos productos, consulta junto a negativa y cambio de disponibilidad de varias alternativas. No ampliar a compra automática cuando falta un referente único.

Sin API pagada, Meta u órdenes externas. Main/modelos intactos; publicación staging sin despliegue. Sin ahorro real medido ni declaración de vendibilidad.
