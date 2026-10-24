# Tanda170 — comentario seguido de corrección o consulta (24/10)

Basea36352a7, solo staging. Objetivo: que «no me entendiste, deja solo una…» ejecute la corrección explícita, en lugar de rechazar un nombre o añadir otra unidad; conservar consultas que ya se respondían.

## Reproducción y cambio

Baseline72 casos:36 fallaron,36 pasaron. Las dos formas de corrección precedidas por comentario fallaron en nombre/pago/sabor; preguntas de descripción y precio ya pasaban. Las respuestas a la corrección podían pedir un nombre real o añadir una línea mientras conservaban las dos unidades originales.

Se elimina del texto operativo un preámbulo de incomprensión/pregunta omitida solo cuando está seguido de coma, dos puntos, punto y coma o salto de línea y comienza una instrucción o pregunta explícita. No se cambia el mensaje original almacenado. La cláusula resultante recorre los manejadores existentes de cantidad/consulta; no se introduce otro editor de carrito. Sin nombres/IDs/catálogos de PPP codificados.

Las frases aisladas mantienen el comportamiento de169. Se conserva la pregunta o instrucción completa después del preámbulo. No se elimina una negación del contenido posterior ni se interpreta la queja por sí sola como autorización para cambiar el pedido. La extracción solo reconoce las formas especificadas; no acredita expresiones arbitrarias o separadores ausentes.

## Cobertura

72 recorridos nuevos: tres menús sintéticos×agente simulado on/off×nombre/pago/sabor×dos correcciones y dos consultas. Carrito inicial con dos unidades y nota sin cebolla; selección adicional con dos bebidas sin hielo cuando aplica. Correcciones dejan una unidad exacta; consultas conservan ambas. Verifican respuesta, estado, nombre/dirección, selección pendiente y orden simulada final con cantidad total exacta, opciones y notas.

Checkout inicial sembrado; modelo responde sin acciones, servicios externos simulados. No prueba reconocimiento real de audio ni inteligencia del modelo. No prueba «deja solo uno» sin producto, alcance entre varias líneas del mismo SKU, cambio de dirección ni recuperación de preguntas de turnos anteriores.

## Validación

Foco180/180, dos suites (72 nuevos+108 de169),28,587s. Evidencia /tmp/ppp-170-{baseline,focus}.log.

TypeScript general/build OK; scripts Node92/92. Global17.887/17.887,239suites,537hashes,766,52s; inventario exacto y fuente congelada. Evidencia /tmp/ppp-170-{tsc,node}.log y global-summary.json, reportes burst/rest. Cero llamadas pagadas, WhatsApp externo u órdenes reales. Publicación solo staging;170 pendiente de deploy agrupado. Servidor último acreditado098250c8 (hasta169), Main intacta.

## Siguiente tanda

- Comentarios con nombre/teléfono/dirección explícitos durante el cierre, conservando la pregunta del mismo turno.
- Referencia corta «deja solo uno» y varias líneas del mismo producto: aclarar alcance cuando no sea único y completar la aclaración hasta DTO.
- Pregunta omitida recuperable del historial: contestar la pregunta correcta sin inventar detalles ni reabrir compras.

Mantener separación entre prueba local, publicación y despliegue. No acreditar piloto/vendible por conteos.
