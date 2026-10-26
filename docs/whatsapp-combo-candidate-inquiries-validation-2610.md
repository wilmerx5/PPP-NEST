# Tanda 215 — consultas de candidatos y sabores vigentes

Base `a54b45f6`, staging. Sin cambios de modelo, API pagada, Meta ni órdenes externas; no despliegue ni cambios Main.

## Contrato

Preguntar precio, sabores o contenido de una presentación ofrecida, por código explícito o volumen, responde desde el catálogo vigente sin comprar ni perder alternativas. El código debe pertenecer a la lista pendiente; no es una cantidad. Contenido se limita a la descripción de la carta; si falta, lo explica. Opciones disponibles se revalidan después: si el sabor solicitado ya no existe, conserva el plato base y pide un sabor válido antes de sustituirlo. Las otras presentaciones conservan sus propias opciones.

La corrección amplía `tryAnswerPendingComboQuestion` con consultas por código y de contenido. No añade nombres, IDs ni precios PPP al runtime. Resolver referencia y responder no cambia carrito ni preferencia. La revalidación de sabores ya funcionaba y se acredita con nuevas conversaciones, no se atribuye a un cambio innecesario.

## Evidencia

Baseline36:12 aprobados/24 fallidos; fallaban consultas por código y contenido por volumen (`/tmp/ppp-215-baseline.json`). Primera corrección36/36 (`/tmp/ppp-215-after.json`). Ampliación60 casos: tres menús×agente mock off/on×10 caminos. Incluye códigos no ofrecidos, agotado, descripción ausente, precio, sabores y contenido; cambio de sabores entre oferta y elección. Todas las conversaciones deben terminar en una orden simulada única, con dos unidades, nota y bebida elegida en carrito y DTO.

Foco276/276 en6 suites; TS general/build, Node92 yFalafel1 aprobados. Global final19.248/19.248 en281 suites,588 hashes sin cambios e inventario exacto,722,89s (`/tmp/ppp-215-final-global-summary.json`). Fuente congelada durante ambas particiones; sin suites omitidas/duplicadas. Las pruebas simulan catálogo/modelo/servicios; no acreditan comprensión real de todas las formulaciones ni costo. No declarar vendible por conteos.

## Siguiente

Consultas con cambios en el mismo mensaje, referencias descriptivas «grande/familiar» y nombres abreviados. Probar primero diagnóstico focal y conservar rojos; no mezclar una consulta con autorización implícita para comprar. Mantener cantidades/notas y datos de cierre cuando se cambia de alternativa. Agrupar despliegues; medir costo real por separado.
