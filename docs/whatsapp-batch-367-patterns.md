# Tanda367: cancelaciones y disponibilidad durante opciones

## Fallos y solución

Seguimiento de366 con router completo y servicios externos simulados. Los16 controles iniciales de cancelación del pedido y agotamiento de una fila posterior ya pasaban. Al probar el producto activo aparecieron dos fallos: una fila marcada agotada podía agregarse al responder su sabor; una fila retirada del catálogo limpiaba la pregunta pero no retomaba la siguiente compra.

Ahora la respuesta a opciones consulta la disponibilidad del producto activo. Si está agotado o retirado, no lo agrega, avisa y lo elimina de la cola solo si estaba presente. Recorre los siguientes pendientes, omite los no disponibles con aviso y retoma la selección del siguiente válido. Las compras con opciones completas usan el flujo existente de agregado; las incompletas conservan su segmento/cantidad. Se preserva lo ya agregado.

## Evidencia

48 pruebas nuevas en dos catálogos × agente off/mock.8 de agotamiento/retirada de la siguiente fila;8 de cancelación total y respuesta tardía;8 de indisponibilidad del activo;24 de segunda fila, todos los productos o todos los restantes indisponibles, distinguiendo agotado y retirado. Comprueban respuesta, estado, cola, carrito, cantidades, atributos y32 cierres DTO simulados sin IDs indisponibles. Los casos de cola vacía prueban una compra nueva y los de cancelación evitan resucitar el pedido al responder después.

Baseline final sobre366:32 fallos y16 controles aprobados. Con la corrección:48/48 nuevos y892/3 relacionados aprobados. La global usa fuentes congeladas e inventario exacto.

## Límites y siguiente tanda

No cambia la semántica de una carga de catálogo completamente vacía: se mantiene el fallback previo, pues puede representar un fallo de carga. Para probar retirada total se conserva un producto ajeno disponible. Se respeta ignoreBusinessHours; las pruebas de disponibilidad lo desactivan. No valida modelo real, Meta ni pedidos externos.

Global34690/435 aprobada, sin fallos ni omitidas;653 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados; despliegue367 pendiente. Producción349 y motor Kamppo321 sin cambios; presupuesto267/256/11 intacto. Cero inferencia pagada.

Próximo: cancelación solo del plato activo frente a cancelación total durante cotización, con opciones parciales y respuestas tardías; luego ofertas antiguas/consultas largas.
