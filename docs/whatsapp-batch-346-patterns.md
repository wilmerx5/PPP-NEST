# Tanda346 — conservación en cambios parciales

## Evidencia

Chat30/10: tres churrascos existentes; pedir nota para dos produjo dos compras adicionales. Chat28/10: cambio de un ejecutivo a broaster perdía la referencia al plato existente. Se prueban variaciones explícitas del reparto y cambio conservando opciones, sin afirmar que cubren toda formulación coloquial.

Baseline del router:8/16 fallan, todos de nota parcial. Sin agente se anotaban las tres unidades; con agente simulado se podían añadir unidades. Los ocho cambios de preparación ya conservaban opciones y notas.

## Cambio

Antes de interpretar compras, reconoce «de los tres churrascos, dos sin arroz más ensalada». Comprueba cantidad del grupo y producto único. Divide la línea en una unidad original y dos con nota; mantiene precio, atributos, notas previas y el resto del carrito. Admite cantidades numéricas y palabras hasta diez; conserva signos para rechazar negativos. Una repetición exacta no modifica cantidades.

Preguntas, condiciones, acciones mezcladas, cantidades inválidas, grupo diferente y versiones con notas distintas conservan el carrito y solicitan aclaración. No resuelve automáticamente versiones múltiples ni cambia un pago pendiente.

## Validación

40 pruebas nuevas:16 recorridos en dos catálogos, agente desactivado/simulado y carrito/confirmación;24 controles de números, repetición, notas previas y guardas.16 recorridos verifican DTO y recibo con servicios externos simulados. Foco y relacionadas:433/4 aprobadas. Primera fase global:33397 pruebas/412 suites aprobadas, pero cambios simultáneos ajenos en src invalidaron el control de fuentes congeladas. No se declara validación global completa. Repetición aislada completa:33413 pruebas/414 suites aprobadas,632 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados. Publicación y despliegue pendientes.

Sin llamadas pagadas, Meta u órdenes externas. Modelos y presupuesto sin cambios. Producción333 y Kamppo321 fuera del alcance.
