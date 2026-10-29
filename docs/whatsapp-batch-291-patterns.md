# Tanda291 — retirada contada y adición atómica

Origen: siguiente paso del plan de operaciones heterogéneas tras286–290; variantes sintéticas inspiradas en referencias de opciones de los chats compartidos. No es nueva revisión de chats/PDF/audio ni muestra independiente.

## Contrato

«Quita uno de los de pechuga y agrega dos Agua Mineral» identifica una línea original y un producto disponible por nombre completo. Valida ambas cantidades, referencia, identidad, disponibilidad y opciones antes de preparar el resultado en una copia de sesión. Descuenta solo las unidades indicadas, añade con precio del catálogo y acumula en una línea compatible si existe. Comprueba los límites sobre el carrito resultante, no sobre un estado intermedio. Solo guarda al completar ambas acciones.

No copia notas ni atributos del plato retirado al nuevo producto; conserva íntegros los de las unidades restantes y las demás líneas. Una cantidad inválida, línea ambigua/desconocida, insuficiencia, producto desconocido/ambiguo/agotado, opciones faltantes, límite excedido, pregunta, condición, tercera acción o selección/pago pendiente conserva todo el pedido. Se pide aclarar la petición completa, sin iniciar una compra parcial.

## Cobertura

420 casos nuevos:192 operaciones completas (dos verbos de adición, dos pares de cantidades, eliminación completa/saldo y nueva línea/acumulación),216 guardas,12 recuperaciones tras producto desconocido. Tres catálogos sintéticos, agente simulado on/off, compra/revisión. Carrito inicial preparado como fixture. Se verifica carrito completo, estado, respuesta y ausencia de órdenes externas. La eliminación completa también prueba un límite de líneas que solo permite el resultado final.

Baseline inicial396:192 aprobados/204 fallidos; después se añadieron24 guardas de condiciones/terceras acciones. Foco y global registrados tras verificarlos. No contar el intento inicial de compilación del fixture (campos de configuración) como reproducción funcional.

Límites: retirada con «N de los/las de X», seguida de «agrega/ponme N Nombre Completo». Producto añadido sin opciones requeridas; no infiere elecciones por defecto en esta operación. No cubre tres acciones, orden inverso, productos por alias, aclaración persistente de esta mezcla ni modificación de preparación. Sin SQL, campos de sesión o cambio de modelos. Cero inferencia pagada, Meta u órdenes externas. ProducciónPPP y Kamppo no migrados.
