# Tanda 234 — compras independientes en mensajes multilínea

Base e746eb69, rama staging. Trabajo gratuito con dependencias simuladas; sin llamadas a OpenAI, Meta, mapas u órdenes externas. Modelos y Main intactos.

## Problema y cambios

El pedido real de una sopa independiente más un ejecutivo con sopa perdía la compra independiente. La normalización convertía saltos en punto y coma y el atajo de plato compuesto consumía todo como un único ejecutivo. La dirección «Para villa …» perdía la palabra villa. Además «menundecias» no resolvía la opción Menudencias y quedaba el valor predeterminado.

Se preservan líneas de compra explícitas, distinguiéndolas de cortesía y logística, y los atajos de plato único ceden ante varias líneas. Se conserva el prefijo genérico villa en el destino. La aproximación de opciones admite dos ediciones únicamente en palabras largas después de la etiqueta del atributo, con candidato único y respetando negaciones y coincidencias exactas. Una regla que descartaba pedidos como logística sin comida ahora consulta el catálogo antes de descartarlos.

## Cobertura y límites

17 pruebas nuevas: 12 conversaciones en tres menús (ejecutivo, pizza, bowl), con agente simulado activado/desactivado y consulta de pago presente/ausente; cinco controles de opciones aproximadas, ambigüedad, etiqueta ausente y negación. Verifican respuesta, dos compras, opción, destino y DTO de orden simulada tras confirmación. No son mediciones de inferencia real.

La primera ejecución de la familia expuso pérdidas de productos y dos expectativas incorrectas de aproximación: una coincidencia exacta debe prevalecer, y un candidato a una edición no es ambiguo frente a uno a dos. Se corrigieron esos oráculos sin debilitar la conservación de las compras. Tras proteger los atajos, cuatro casos del bowl seguían fallando por el filtro de logística; la consulta al catálogo resolvió esa diferencia.

Foco final: 81/81 en tres suites. TypeScript general/build aprobados. Node 92/92 y guardia Falafel 1/1 aprobados. Global completa: 19.924 pruebas / 303 suites, 611 hashes, 966,72 segundos; inventario exacto y fuente sin cambios. Evidencia local /tmp/ppp-234-final-global-summary.json y reportes burst/rest.

El diagnóstico histórico inicial de sopa+ejecutivo pasó 8/8 también en la reejecución final (/tmp/ppp-234-historical.json), pero solo acredita compras y opciones iniciales. El chat completo NO está cerrado: «en vez de ensalada más papa o yuca» todavía pierde la petición/ambigüedad. La próxima tanda debe conservar esa intención y resolver la alternativa sin añadir guarniciones cobradas ni elegir arbitrariamente; luego probar cancelación y cierre completos. Los otros diagnósticos históricos no se consideran corregidos por esta tanda.

Sin despliegue. No declarar vendibilidad por conteos. Continuar con fallos reales abiertos antes de ampliar familias nuevas.
