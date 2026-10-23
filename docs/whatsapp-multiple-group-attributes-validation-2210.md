# Tanda 122 — varios atributos por grupo

## VIGENTE — tanda 122: varios atributos por grupo y recuperación (22/10)

Base 245c5c7a, staging. 42 regresiones nuevas: tres menús sintéticos (arroz con preparación de pollo, hamburguesa con término y salchipapa con salsa), agente simulado on/off. Cada grupo lleva bebida y preparación distintas, nota propia sin tomate/con ají y nota común sin cebolla. Reparto completo o entre turnos, cambio de opinión mediante nuevo reparto 1+3, nombre y consulta de sabores intercalados, exceso de cantidad y selección incompleta seguida de recuperación válida. Todos terminan en DTO de cuatro unidades, sin crear orden antes de confirmar.

No se encontró fallo en esta familia: los primeros 24 y la extensión de 18 pasaron con el código existente. Se añadieron tests, no reglas de producción. Foco final 816/816 en cinco suites (44,38 s); TypeScript general/build y Node 92/92 aprobados. No se repite global ni build de servidor porque no cambió código ejecutable: la última global de esa fuente sigue siendo 16.459/16.459, 192 suites, tanda 121. No presentar ese conteo como global nueva ni sumar ejecuciones solapadas.

Solo pruebas/documentación publicadas en staging; no requiere despliegue. Servidor sigue ejecutando 17bc27a7 (120/121), imagen 2a57360d…, verificado en la tanda anterior 22/10 23:41 Bogotá. Main/producción intactos; acceso público de staging y bloqueo de eventos de cocina deben conservarse. Cero API pagada, WhatsApp u órdenes externas. Evidencia: [tanda 122](whatsapp-multiple-group-attributes-validation-2210.md).

Límites: dependencias/modelos simulados, grupos explícitos y cambio de opinión mediante reparto completo. No acredita correcciones libres del grupo pendiente («los primeros mejor…»), cambio de producto/agotado entre turnos ni contacto múltiple en la misma respuesta. Siguiente: correcciones de un grupo aún pendiente, cancelar/reemplazar esa selección y retomar checkout; contrastar además conversación básica completa para evitar concentrar toda la cobertura en repartos. Sin cambios de fuente, focalizar; global solo cuando cambien reglas compartidas.

## Casos y oráculos

Siete escenarios × tres menús × dos modos del agente simulado: complete, turns, revise, nameInterruption, wrongTotal, incompleteOptions y question. La compra y el reemplazo por combo pasan por el router completo. Ninguna línea se siembra directamente en el carrito.

Se comprueban: carrito original intacto al recibir el primer grupo; selección pendiente y reparto conservados tras una consulta o nombre; respuesta de aclaración y ausencia de mutaciones frente a cantidades/opciones inválidas; recuperación posterior; dos líneas finales con bebidas y preparación correctas; notas propias sin contaminación y nota común conservada; cuatro unidades totales; nombre en DTO; no creación antes de confirmar y exactamente una creación al confirmar.

La instantánea de DTO se obtiene tras comprobar explícitamente cantidades, identidad, opciones y notas del carrito. No es una aserción circular sin oráculo semántico.

## Validación

- `/tmp/ppp-122-baseline.json`: 24 casos iniciales aprobados en fuente existente.
- `/tmp/ppp-122-targets.json`: 816/816 en cinco suites; incluye los 42 nuevos, 44,38 segundos.
- `/tmp/ppp-122-tsc-final.log`: TypeScript general después de la última extensión.
- `/tmp/ppp-122-build.log`, `/tmp/ppp-122-node.log`: build TypeScript y 92 pruebas de scripts aprobados.
- No nueva global: solo se modificó `src/whatsapp/whatsapp-related-combo-offer.spec.ts` y documentación. La última global de producción sin cambios fue la tanda 121: 16.459 aprobadas. No reconstruir/desplegar por estos fixtures.

## Continuación eficiente

Próximo agente: leer primero la entrada vigente del relevo; comprobar Git/origin y otros procesos antes de editar. Para la siguiente familia, añadir pruebas focalizadas, reproducir antes de cambiar reglas, validar estado/respuesta/carrito/DTO. Si hay corrección compartida, TS y suites afectadas, después global con fuente congelada: ráfagas runInBand y resto cuatro workers excluyendo esa suite. No llamadas pagadas ni runners de inferencia por defecto. Preservar Main, staging público y bloqueo de eventos externos.
