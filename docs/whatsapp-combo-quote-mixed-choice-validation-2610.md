# Tanda 222 — consulta y elección en un mismo mensaje

Base `7bea95fb`, staging. Cobertura adicional sin cambios de runtime.

## Recorridos

36 conversaciones: tres menús sintéticos (arroz, bowl y pasta), agente simulado off/on y seis mensajes mixtos después de recotizar una presentación con Agua:

- Pregunta de contenido seguida de elección explícita con Pepsi.
- Elección con Pepsi seguida de pregunta de contenido.
- Pregunta de precio seguida de elección con Pepsi.
- Elección con Pepsi seguida de pregunta de sabores.
- Condicional «si elijo el grande, ¿cuánto cuesta?»: responde sin comprar; la aceptación posterior mantiene Agua.
- Elección con Mango inexistente y pregunta de contenido: responde contenido, indica que no resolvió la bebida y conserva la cotización con Agua. Una selección posterior completa el pedido.

Se leen todas las respuestas de cada turno. Se verifica carrito intacto para condición/bebida inválida, selección explícita sobre la bebida anterior, precio34000, dos unidades, notas, estados y DTO de orden simulada sin duplicados. Los IDs y precios son fixtures, no reglas de producción.

## Evidencia

Baseline36/36 verdes sin corrección. Foco168/168 en cuatro suites,25,151s; TypeScript general aprobado. No repetir global por pruebas/documentación únicamente. Última global completa220:19.470 pruebas/286 suites; no presentarla como un run de222. Snapshots privados `/tmp/ppp-222-*`.

## Límites y siguiente bloque

Se cubren signos de interrogación, separación de frases y referencias explícitas a presentación. No acredita entradas sin puntuación ni toda conjunción de lenguaje libre. Próximo: negativas/correcciones después de contactos, consultas sin puntuación y referencias ambiguas; verificar que no se ignore la consulta ni se invente una elección.

Cero API pagada/Meta/órdenes externas; modelos/Main intactos. Publicación staging, sin despliegue ni ahorro real medido.
