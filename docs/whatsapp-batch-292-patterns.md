# Tanda292 — chats reportados del21/10 y29/10: entrega, opciones y aclaración

Prioridad indicada por el usuario: corregir estos incidentes y similares, verificar staging, desplegar Main y después continuar otras tandas. No es autorización para migrar Kamppo. Entradas sanitizadas derivadas de los textos compartidos; no se accedió al audio original ni se atribuye el fallo a transcripción.

## Hallazgos y cambios

- Crítico: `, número…` se recortaba como contacto y perdía la placa de la casa. Normalización acotada de dirección dictada antes de extracción, preservando ciudad; número de teléfono explícito separado de nomenclatura. Una calle sin placa, incluso con tarifa guardada, no puede cerrar el pedido; se solicita dirección completa/ubicación. Se conservan las verificaciones existentes contra geocodificación parcial o distinta.
- Crítico: dirección/unidad inmediatamente después de confirmar podía reabrir compra. Ahora conserva la orden/sesión y explica que no modificó dirección ni tarifa; indica coordinación con el restaurante. Es contención segura y derivación explícita, no edición automática de una orden en cocina ni notificación al operador. La infraestructura actual orienta el handoff a teléfono.
- Medio: bebida y arepas del único plato se aclaran juntas y se aplican atómicamente. Dos dueños/unidades, desconocidos, pregunta, pago u otra selección no provocan cambio parcial.
- Medio: `booster/boster` en petición acotada de pollo sugiere broaster del catálogo y pide elegir; conserva entero/medio/cuarto y cantidad. No agrega ni sustituye sin elección. No cambia un producto legítimo llamado Booster.
- Medio: con agente simulado, porción+dirección podía guardar dirección sin añadir la porción. Ruta acotada para porción explícita del catálogo + dirección conserva ambos y evita notas vacías de compra. Catálogos adicionales de yuca/arroz.
- Menor: nota residual `Con una porcion de` no pasa como instrucción de cocina; despedida histórica de excelente día se neutraliza. El saludo sin invitación a llamar y unidades de ETA ya estaban corregidos; se añaden controles y se aclara que el plazo es estimación general, no tiempo restante confirmado.

## Evidencia y límites

Baseline inicial32:2 aprobados/30 fallidos. Se corrigió el nombre del campo DTO del fixture a `address` durante la reparación; no se cambió la expectativa comercial. Suite final74 casos; foco218/6 suites. Ocho variantes adicionales de cambio/rechazo de dirección sin destino fallaban antes de ampliar la protección y ahora pasan. Carrito, estado, respuesta, dirección en DTO y ausencia de órdenes en fallos comprobados. Dependencias externas simuladas; pruebas de geocodificación usan respuestas de proveedor simuladas, sin red.

Gramáticas acotadas: no garantía de comprensión de toda dirección oral ni de reconocimiento del audio original. No hay cambio automático de dirección de pedidos registrados: el cliente debe coordinarlo con el restaurante, sin falsa confirmación. La ruta de porción+dirección requiere identidad única disponible sin opciones faltantes. No aprendizaje autónomo ni evaluación estadística de conversaciones nuevas. Cero inferencia pagada/Meta/órdenes externas; modelos y presupuesto preservados.

Global, hashes, commits y despliegues se registran en los JSON de validación y release. La promoción aMain incluye283–292, acumuladas en staging; Kamppo permanece282 hasta migración separada.
