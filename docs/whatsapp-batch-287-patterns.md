# Tanda 287 — «yes» y cierre repetido en confirmación

Origen: chat reportado de Kamppo del 29/10: resumen de Baby beef, «yes», vuelta a «¿Algo más?», dos «no» y finalmente «confirmar». Se prioriza esta incidencia sobre las cantidades de retirada previstas; estas quedan pendientes.

## Hallazgo

PPP reproduce la falta de aprobación con «yes» y el bucle de cierre. La función `isFinalConfirmAffirmation` del checkout local de Kamppo tampoco incluía «yes»; la inspección de código no acredita su runtime ni un replay de su API. No se modificó Kamppo en esta tanda.

«yes» completo, con mayúsculas/puntuación/cortesía admitida, se reconoce en el paso final. Preguntas, condiciones y mensajes mixtos no autorizan por esta regla. Los cambios pendientes siguen bloqueando la confirmación. En confirmación final, «no», «no más» o «solo eso» conservan el resumen y piden confirmar o indicar la corrección; no son consentimiento y no vuelven a «¿Algo más?».

## Pruebas y límites

384 casos nuevos: 120 aprobaciones, 120 mensajes que no autorizan, 72 cierres repetidos seguidos de «confirmar», 72 cambios pendientes. Tres productos (incluido Baby beef), agente simulado activo/inactivo, efectivo/transferencia y domicilio/recogida. Se preservan atributos y notas en la orden simulada. Baseline: 192 aprobados y 192 fallidos. Foco final: 384 aprobados.

Los fixtures comienzan en confirmación final con datos completos: no acreditan la captura anterior de dirección/pago. No se usaron teléfonos ni dirección del cliente en los fixtures. Dependencias externas simuladas, cero órdenes externas e inferencia pagada. No se afirma soporte general de inglés ni que «no» confirme. No cubre todas las formas coloquiales ni mensajes mixtos arbitrarios. La retirada de cantidades y los pedidos compuestos siguen pendientes.

La primera revisión global detectó 12 regresiones por interceptar cierres con aprobación explícita («no veci, así está bien»). Se restringió la nueva respuesta a las formas breves no/no más/solo eso y se repitió toda la validación sobre las fuentes finales. No se alteraron las expectativas de esas regresiones.
