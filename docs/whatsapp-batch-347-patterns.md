# Tanda347 — nota después de cambiar una unidad de preparación

## Reproducción

A partir de chats28/10 y30/10, recorrido derivado: carrito con3 unidades de una opción y1 de otra, notas y bebidas distintas. «Cambia uno de los de pechuga a pollo broaster» conserva los datos; «El broaster sin arroz» abría el catálogo y no aplicaba la nota. Baseline16/16 fallan en dos catálogos, agente desactivado/simulado, carrito/confirmación y orden invertido de líneas.

## Corrección

Una nota declarativa con preparación reconocida se resuelve contra el carrito antes de consultar catálogo. Solo actualiza una línea inequívoca y conserva cantidades, atributos, notas anteriores y paso actual del checkout. Varias líneas o ausencia de la preparación requieren aclaración. Condiciones, pagos o selecciones pendientes y contradicciones conservan el pedido. Preguntas y compras explícitas quedan fuera de esta ruta.

## Validación

40 controles nuevos:16 recorridos completos verifican carrito, respuesta, estado, DTO y recibo;24 casos cubren versiones ambiguas, productos distintos, preparación ausente, conflicto, condición, pago, selecciones pendientes, nota extensa, pregunta, compra y repetición. Foco y relacionadas569/5 aprobadas. Global aislada33453/415 aprobada,633 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados. Checkout aislado preserva trabajo ajeno de Bold/autenticación. Publicación y despliegue pendientes. Sin llamadas pagadas, Meta u órdenes externas.

No afirma solución para todas las referencias por preparación ni todos los repartos. Siguiente: aclaración y continuación de notas entre múltiples variantes, conservando el objetivo original. Producción333 y Kamppo321 fuera de esta tanda.
