# Tanda 176 — contacto y pregunta durante recuperación por pin

Base38798737, solo staging.24 casos nuevos:3menús×agente simulado on/off×antes/después del pin×nombre/teléfono. Mensaje compuesto con contacto explícito y una pregunta de precio con producto identificado. Primer baseline24/24 pasó con verificaciones de datos/DTO. Al exigir además recordatorio del paso pendiente,6/24 fallaron: nombre+precio antes del pin terminaba en «¿Algo más?» con dirección ambigua. No atribuir24 fallos corregidos. La regla compartida de recordatorio ahora pide ubicación/calle cuando el carrito tiene destino no resuelto, sin tarifa ni coordenadas y sin fuera de cobertura; conserva prioridad de elecciones/nombre/teléfono.

Carrito sembrado con2unidades y nota. Se envía conjunto+torre/apto, mapa simula ambigüedad, ubicación nativa permite resolver. El cliente corrige nombre o teléfono y pregunta precio en el mismo mensaje, antes/después del pin. Se verifica precio respondido, recordatorio del paso pendiente, carrito intacto, interiores, dato corregido y DTO final con2entradas, nota y tarifa. Todos los casos completan pago y confirmación simulados, sin creación prematura.

Límites: una consulta explícita separada con puntuación, no varias preguntas ni pronombres ambiguos. Modelos/mapas simulados; no acredita captura del pin por Meta ni precisión del proveedor real. El carrito y nombre inicial están sembrados. No se hace inferencia pagada, WhatsApp ni orden externa.

Foco corregido234/234,4suites,30,27s; TypeScript general/build y Node92/92 OK. Global18.181/18.181,245suites,543hashes,678,96s; inventario exacto y fuente congelada. /tmp/ppp-176-global-summary.json. Publicado solo en rama staging; sin despliegue, servidor hasta174 (175–176 pendientes de despliegue agrupado). Main/producción intactas. Logs /tmp/ppp-176-{focus-fixed,tsc-fixed,node-fixed}.log. Primer foco /tmp/ppp-176-focus.log:6fallos/228pasaron.

Siguiente: dos preguntas junto a corrección de contacto; teléfono/nombre sin etiqueta o con referencia histórica; pin rotulado con nombre y calle del mismo destino conservando interiores sin mezclar otro lugar.
