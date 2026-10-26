# Tanda 224 — preguntas y elección sin puntuación

Base `697b5c09`, staging. Corrección general del router de alternativas pendientes.

## Fallo

Los recorridos de tanda222 con signos de pregunta funcionaban, pero quitar la puntuación causó36/36 fallos: no se separaba la consulta de la elección. Ejemplos: «que trae el grande dame el grande con Pepsi», «dame el grande con Pepsi que trae», «si elijo el grande cuanto cuesta».

## Corrección

Se permite separar una orden explícita (dame/quiero el/la...) de preguntas acotadas de contenido, precio y sabores sin depender de signos. La separación funciona antes o después de la pregunta. Solo se aplica dentro de alternativas pendientes; conserva la resolución de catálogo y las validaciones existentes. «Si elijo» mantiene carácter condicional: responde sin modificar el carrito. Sin nombres/IDs/precios especiales de restaurantes.

## Pruebas

36 conversaciones en tres menús sintéticos (arroz,bowl,pasta), agente simulado off/on y seis caminos: contenido antes/después de elección, precio antes, sabores después, condición y bebida inválida. Se comprueban todas las respuestas del turno, preservación cuando corresponde, dos unidades, precio vigente, bebida, notas, estado y DTO simulado sin duplicados.

Baseline36/36 rojas→foco138/138 en3 suites,31,934s. TypeScript general/build,92 controles Node y guardia Falafel aprobados. Global completa19.602/290 suites,597 hashes,740,64s; inventario exacto y fuente congelada verificados. Evidencia `/tmp/ppp-224-*`.

## Límites y siguiente bloque

Este patrón exige pregunta reconocible y orden explícita; no acredita cualquier conjunción libre. Referencias «no ese, el otro», múltiples candidatos indistinguibles y negativas complejas quedan para la siguiente tanda, sin afirmar que se corrigieron aquí. Evitar ampliar expresiones hasta aceptar instrucciones ambiguas como compra.

Sin API pagada/Meta/órdenes externas. Modelos/Main intactos; publicación staging, sin despliegue ni ahorro real medido.
