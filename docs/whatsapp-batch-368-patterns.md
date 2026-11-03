# Tanda368: cancelar el plato activo frente a todo el pedido

## Evidencia

Derivada de los fallos de continuidad de pedidos múltiples y del seguimiento367. «Cancela ese producto» retiraba la selección activa y conservaba la cola; «cancela ese plato» no usaba esa misma ruta y perdía continuidad. Se añade «ese plato» al reconocimiento existente, sin ampliar a preguntas, condiciones o productos arbitrarios. Se reutilizan cancelación, normalización de cortesía/typo y avance de cola existentes.

## Validación

48 controles nuevos: dos catálogos × agente off/mock × antes/después de agregar la primera compra × seis frases. Incluyen «no quiero ese producto», «cancela ese producto», «cancela ese plato», «cansela ese plato porfa», «no quiero ese plato» y «cancela el pedido». La cancelación individual conserva carrito previo y completa el resto; la total vacía y una respuesta tardía no resucita el pedido.40 cierres DTO simulados. Baseline16/48 fallan,32 controles ya pasaban; foco176/3 aprobado. No se atribuye esta matriz a48 chats nuevos ni a48 fallos distintos de producción.

Global34738/436 aprobada, sin fallos ni omitidas;654 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados; despliegue368 pendiente. Cero inferencia pagada/Meta/órdenes externas; presupuesto267/256/11 intacto. Producción349 y motor Kamppo321 sin cambios. No acredita modelo/canal real.

## Prioridad siguiente

Retomar recorridos completos y críticos de los chats, con mapa incidente→reproducción→corrección→validación. Priorizar reparación de carritos incorrectos y reemplazos compuestos que conserven cantidades, bebida y notas. Las compras inesperadas históricas no reproducidas siguen abiertas: requieren trazas de turnos/messageId/propuesta/sesión antes de atribuir causa. Ofertas antiguas y consultas largas siguen como pendientes secundarios.
