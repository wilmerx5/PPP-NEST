# Tanda 217 — elección antes de consulta y bebida explícita

Base `e5331c1b`, staging. Sin API pagada, Meta ni órdenes externas; modelos/Main intactos, sin despliegue.

## Corrección

Con lista de combos pendiente, «dame/quiero el ... , ¿qué trae/cuánto cuesta/qué sabores tiene?» resuelve la referencia de la pregunta desde la elección explícita, responde y aplica la elección. «Si elijo ... , ¿...?» solo consulta; no autoriza compra. Se limita al patrón separado por coma/punto y coma e interrogación final. Reutiliza la ruta de consultas sin inventar contenido y la ruta de compra existente.

La resolución de etiquetas de presentación se comparte entre consulta y selección. No deduce tamaño por precio ni por volumen. Referencias por nombre de presentación/código/volumen conservan la bebida inline al convertirse a fila. La bebida explícita prevalece sobre la inicialmente solicitada; si no es válida, no se cambia el carrito y se ofrecen opciones reales. No añade reglas por restaurante.

## Evidencia

Baseline36/36 rojos (`/tmp/ppp-217-baseline.json`); primera corrección36/36 verdes (`/tmp/ppp-217-after.json`). Ampliación66 conversaciones en tres menús×agente mock off/on×11 caminos: orden inverso de consulta, consulta delante, referencias por código/volumen con bebida, bebida no válida con/sin pregunta, condicional de precio/sabores y etiqueta condicional desconocida. Compara todas las respuestas del turno, carrito/estado pendiente y cierre simulado único con dos unidades, nota y bebida en DTO.

Foco312/312 en5 suites; TS general/build, Node92 yFalafel1 aprobados. Global final19.374/19.374 en283 suites,590 hashes sin cambios e inventario exacto,716,38s (`/tmp/ppp-217-final-global-summary.json`). Sin omisiones/duplicados y fuente congelada durante ambas particiones. Servicios externos y modelo simulados; no acredita inferencia real ni costo. No declarar vendible por conteos.

## Próximo bloque

Cambio de precio combinado con bebida explícita (preservarla después de aceptar recotización), negativas y más condicionales, consultas sin coma/puntuación y datos de contacto junto a selección. No extrapolar el patrón «si elijo» a toda condición. Mantener foco primero y global congelada al finalizar cambios compartidos; agrupar despliegues.
