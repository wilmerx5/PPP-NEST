# Tanda 221 — consultas y contactos durante una cotización pendiente

Base `7100b10b`, staging. Solo cobertura: no se modifica código de producción.

## Qué se prueba

30 conversaciones del router completo: tres menús sintéticos (arroz, bowl, pasta), agente simulado off/on y cinco recorridos. Después de elegir una presentación grande con Agua y recibir un precio actualizado, el cliente pregunta precio, pregunta contenido, envía teléfono, envía nombre o encadena nombre/teléfono/contenido/precio antes de aceptar.

Cada consulta verifica las salidas de ese turno, sin apoyarse en respuestas anteriores. Antes de aceptar se exige carrito original y cotización pendiente. Después se comprueban dos unidades del combo, precio actualizado, Agua, notas, estado y cierre con un único DTO simulado. Nombre y teléfono se verifican también en DTO; la preparación del cierre no los sobreescribe. No hay órdenes externas.

## Resultados

Baseline24/24 verdes sin corrección. Primera ampliación/foco:120 verdes y18 fallos de aserción de estado. La prueba esperaba building_cart incluso tras datos de contacto, pero el fixture ya era de recogida y el bot avanzaba correctamente a awaiting_payment con la pregunta de pago. Se corrigió el oráculo para exigir ese estado y mensaje, sin cambiar runtime ni relajar carrito/DTO. Foco final:138/138 en cuatro suites,21,147s; TypeScript general aprobado. No ejecutar otra global por pruebas/documentación únicamente; la última global completa es tanda220 (19.470/286 suites), no un run nuevo de esta tanda.

## Límites y siguiente tanda

Estas consultas tienen referente explícito «el grande». No acreditan toda pregunta libre ni múltiples intenciones dentro del mismo mensaje. Siguiente: preguntas + elección/cambio de bebida en un solo mensaje; negativas y correcciones después de contactos; no duplicar un producto al responder. La inferencia está simulada y no mide costos ni comprensión real del modelo.

Sin API pagada, Meta, despliegues o cambios a Main/modelos. Evidencia privada `/tmp/ppp-221-*`.
