# Tanda181: consultas y cambio de dirección

Base e2356390. No cambios de producción ni de código de funcionamiento.

## Cobertura

24 recorridos: Bowl Vegetal, Pizza De Hongos y Ramen De Miso; agente simulado on/off; dos preguntas antes/después de dirección explícita; mapa que localiza o devuelve ambigüedad. Parten de carrito con dos unidades/notas, nombre y dirección previos, esperando pago. El usuario pregunta precio y contenido, y cambia calle, torre y apartamento.

Se exige respuesta a ambas consultas, dirección nueva sin la calle anterior, conservación del carrito/nombre, tarifa nueva5000 o null cuando no se localiza. En los12casos ambiguos, se exige petición de ubicación sin afirmar dirección lista/confirmada; un pin simulado permite continuar. Todos terminan contraentrega/confirmar y validan creación única de DTO con2unidades, notas, nombre, interior y tarifa5000. No se crean órdenes externas.

## Evidencia

- Baseline24/24 aprobado en10,378s. /tmp/ppp-181-baseline.log.
- Foco final72/72,3suites,13,294s: nueva suite, pin/contacto y respuesta parcial/contacto. /tmp/ppp-181-focus.log.
- TypeScript general/build y Node92/92 aprobados. /tmp/ppp-181-{tsc,node}.log.
-547hashes de global180 sin cambios; no se repite global por pruebas/documentación únicamente. Última global ejecutada18.289/249suites. No confundir suma de casos con global ejecutada.

## Límites y continuación

Mapas y modelo simulados. No demuestra reconocimiento real de conjuntos ni cambios de dirección acompañados por preguntas sin respuesta determinista. Solo se prueban consultas explícitas delimitadas y dirección etiquetada. Siguiente: cambios de opinión/interrupciones mientras se aclara precio; múltiples dudas sin resolver y dirección con respuesta parcial. Cambios de reglas compartidas requieren global congelada.

Publicación en staging; sin desplegar. Main/producción permanecen hasta180, servidor staging hasta177. Cero API pagada, Meta u órdenes externas.
