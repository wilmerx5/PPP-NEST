# Tanda 227 — consulta junto a negativa de combo

Base `c0b5e629`, staging. Reglas por catálogo sin excepciones de restaurante.

## Fallo y corrección

Baseline36:12 verdes/24 rojas. Consulta y rechazo juntos («¿Qué trae el grande? No gracias», «Sin combo, ¿qué sabores tiene el pequeño?») no respondían la pregunta y mantenían la elección pendiente. El control de pregunta + elección explícita de otra presentación ya funcionaba.

Se separan consulta reconocida y negativa explícita dentro de una oferta múltiple pendiente. Primero se responde sobre la oferta; después el manejador normal de negativa conserva el carrito original, limpia la elección y devuelve la continuación. No se convierte la consulta en compra ni se descarta el pedido.

## Verificación

36 conversaciones nuevas: tres menús sintéticos, agente simulado off/on, cuatro caminos de rechazo antes/después de preguntas de contenido/precio/sabores y dos controles de cambio explícito a otra presentación. Se verifican respuesta a la pregunta, continuación, carrito, cantidad/notas/precio/opciones, estado, ausencia de elección residual y DTO final de dos unidades. Solo se crea la orden simulada después de confirmar.

Foco150/150 en cuatro suites. TypeScript general/build,92 controles Node y guardia Falafel aprobados. Global completa19.728/293 suites,600 hashes,798,39s; inventario exacto y fuente sin cambios. Evidencia `/tmp/ppp-227-*`.

## Límites y continuación

La separación actual exige pregunta delimitada y negativas explícitas no/no gracias/sin combo; no acredita frases libres sin puntuación ni «no ese» como rechazo de todos los combos. Siguiente: negativa + pregunta sin signos y referencias incompletas, sin perder la consulta ni inventar una compra. También sigue pendiente inferencia real, no acreditada por mocks.

Sin API pagada, Meta ni órdenes externas. Modelos/Main intactos; publicación staging sin despliegue. Runtime210–227 pendiente de despliegue agrupado. Sin ahorro real medido ni declaración de vendibilidad por conteos.
