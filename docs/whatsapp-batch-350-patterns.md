# Tanda350 — consultar el total durante una aclaración de nota

## Origen y reproducción

Seguimiento de tandas348–349 y del patrón real «no más, cuánto es / de todo lo que pedí» compartido por el usuario. Escenario sintético derivado: dos líneas con igual preparación, distintas opciones/notas y cantidades2 y1; el bot pregunta a cuál aplicar «sin arroz» y el cliente consulta el total antes de elegir. No se atribuye este recorrido completo a un chat observado.

Baseline:50 fallos y14 aprobados en64 controles. La consulta repetía las opciones sin mostrar el precio. Los48 recorridos de consulta/selección/cierre y2 controles de repetición reproducían el defecto.

## Corrección y alcance

El resolvedor de notas por preparación responde consultas de cuenta reconocidas usando el resumen del carrito y vuelve a mostrar los candidatos. No modifica productos, cantidades, notas, estado, fecha de expiración ni selección pendiente. Comprueba firma/caducidad y otras selecciones/pagos antes de responder. No usa «todo» aislado como referencia de precio, para evitar confundirlo con una selección de líneas.

68 controles nuevos:48 recorridos en dos catálogos × agente desactivado/simulado × carrito/confirmación ×6 expresiones;16 guardas de vencimiento, cambio de carrito, repetición, cancelación, confirmación prematura, consulta condicional, precio de producto y mensaje mixto;4 controles de domicilio pendiente/cotizado. Los48 recorridos verifican creación simulada, DTO y recibo:3 unidades, nota nueva solo en una, opciones y notas anteriores preservadas. Sin pedidos externos.

Foco inicial265/4 aprobado; foco final68/1 aprobado tras añadir domicilio. Global33633/418 aprobada,636 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. El despliegue se registra aparte tras verificarlo.

## Límites y siguiente paso

Cero inferencia pagada, Meta o DB externa. Agente off/mock, no modelo/canal real. No amplía a otras aclaraciones ni resuelve consultas condicionales de precio. Próximo: interrupción por tiempo de entrega durante aclaración; responder y retomar sin elegir ni confirmar. Producción349 y Kamppo321 quedan fuera del cambio.
