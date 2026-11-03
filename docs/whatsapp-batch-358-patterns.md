# Tanda358 — reemplazos durante aclaración de nota

Origen: continuidad de355 y chats compartidos sobre cambio de preparación de una línea existente. Casos derivados, no nuevos chats reales. Una nota por preparación («el broaster sin arroz») deja una selección entre dos líneas; el cliente interrumpe para cambiar el plato o preparación.

Baseline28/46 fallan:24 cambios inequívocos bloqueados y4 controles de caducidad/carrito cambiado interceptados antes de resolver la nota. Reutiliza manejadores existentes de reemplazo atómico y cambio de preparación; aplaza el manejador temprano cuando hay una aclaración de nota para validar primero firma/caducidad. Exige origen único y destino disponible con opciones compatibles completas. Reemplazos por nombre completo se tratan como títulos de catálogo para evitar convertir partes del título en nota.

Si cambia el carrito, descarta la nota pendiente y explica cómo volver a pedirla. Si el cambio no procede, conserva la nota y el carrito. No convierte un número de la vieja lista en una nota aplicada al nuevo producto. Conserva cantidades, variantes, notas anteriores y estado de checkout; usa precio actual del destino.

62 controles nuevos:32 recorridos completos (dos catálogos × agente off/mock × carrito/confirmación × cambio de línea completa, preparación de una unidad, cambio parcial y contraste «ya no sea… sino…»);30 guardas (15 escenarios × dos modos de agente). Incluye cierre DTO/recibo simulado, total, nota y elección numérica antigua. Foco564/4 aprobado:62 nuevos y502 relacionados. Código14919485.

Global34126/426 aprobada, sin omisiones; inventario exacto y644 fuentes sin cambios. TypeScript general/build y scripts aprobados. Despliegue pendiente. Cero inferencia pagada, Meta u órdenes externas. No acredita modelo/canal real. Reemplazos con opciones nuevas incompletas o indicaciones extra requieren terminar/retirar primero la nota pendiente; no se inicia una segunda lista numérica sobre ella. No cubre reemplazos arbitrarios de varios productos a la vez.

Próximo: recuperación guiada cuando el nuevo producto requiere opciones adicionales, manteniendo el original hasta completar la elección; después revisar consultas intercaladas con ofertas pendientes y claridad de la pregunta que se retoma.
