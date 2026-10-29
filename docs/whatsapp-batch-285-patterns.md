# Tanda 285 — cambiar la preparación de una unidad

Origen: los chats compartidos sobre ejecutivos con preparaciones distintas y el límite documentado de la tanda 284. Son variantes sintéticas de esos patrones; no se incorporaron nuevos chats, PDFs ni audios.

## Comportamiento

Con una línea de varias unidades, «cambia uno de los de pechuga a pollo broaster» cambia una sola unidad si la referencia identifica una única línea y existe una presentación equivalente disponible. Conserva las opciones compatibles, las notas y las unidades restantes. El precio de la unidad cambiada procede del catálogo. No añade un pollo entero ni cambia todos los ejecutivos.

La operación se prepara en memoria y valida el carrito completo antes de guardarlo. Una referencia ambigua, opciones incompatibles, selección o pago pendiente, destino duplicado/no disponible, producto original ausente o límites excedidos conservan el carrito original. Las preguntas no ejecutan el cambio. Las peticiones compuestas no se ejecutan parcialmente.

## Evidencia y límites

Baseline inicial: 312 casos, 84 aprobados y 228 fallidos. Foco inicial tras el ajuste: 410 aprobados contando las regresiones vecinas. Se añadieron 48 controles de límites y estados; foco final: 458 aprobados.

La nueva suite contiene 360 casos: 216 cambios y 144 guardas. Cubre tres familias de catálogo, agente simulado activo/inactivo, compra/revisión, cantidades de 2/3/4, posiciones distintas en el carrito y tres formas de escribir el verbo. Los carritos y opciones previos son fixtures: no acredita la compra previa ni la transcripción de audio. Las solicitudes pasan por el router completo; se verifican carrito, estado, respuesta y ausencia de órdenes externas.

Alcance acotado: «cambia/cámbiame uno de los de [opción] a [preparación]» y sus formas reconocidas por el parser. No incorpora selección conversacional nueva entre líneas ambiguas, reparto de varias unidades, cambios simultáneos de bebida/preparación ni retirada parcial ambigua. Esos casos siguen pendientes. Los modelos y servicios externos están simulados; no se afirma aprendizaje automático ni validación real de WhatsApp.
