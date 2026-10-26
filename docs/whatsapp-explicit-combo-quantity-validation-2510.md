# Tanda 200 — cantidad plural con nombre completo de combo

Base6294bffa, staging. Cambia únicamente la selección de producto en la ruta de cantidad>=2. Si un nombre completo identifica un único combo activo del catálogo, no abrir una familia más amplia antes de respetar esa elección. Se conservan las rutas existentes para opciones, cantidades, notas y checkout. No hay nombres/IDs/precios de restaurante en el cambio.

## Reproducción y límites del arreglo

Matriz198 de24recorridos en3menús, singular/plural, sabores numéricos unidos/separados y agente mock off/on: baseline20verdes/4rojos; después24/24. Los4rojos eran plural de bowl. Promovida de `.repro.ts` a `whatsapp-composed-combo-expanded.spec.ts`, sin duplicar la prueba. Cada recorrido valida carrito, respuesta, estado por cierre y DTO (una entrada por unidad).

Nuevo selector `explicitlyNamedCombo`: coincidencia del título completo como frase normalizada; admite pluralcombos. Un título largo elimina su prefijo corto de candidatos, pero dos títulos no relacionados o duplicados no se seleccionan. Título exacto agotado no se convierte automáticamente en uno más corto disponible. No resuelve typos, abreviaturas, opciones ni todos los plurales. Si no resuelve, conserva comportamiento anterior; sus controles unitarios no acreditan toda la recuperación conversacional de ambigüedades.

13controles adicionales en `whatsapp-explicit-combo-quantity.spec.ts`:9contratos de selección y4recorridos con notas/bebidas en bowl y pasta hastaDTO. Foco37/37,28cierresDTO. 24casos promovidos ya existían como diagnóstico; no llamarlos24casos completamente nuevos. El inventario global aumenta37 (24promovidos+13nuevos).

## Fallos que permanecen visibles

- Diagnóstico197PPP:4verdes/8rojos, sin mejora adicional. Persisten composición sin «combo» y otras rutas de plural con pollo/bebida. `/tmp/ppp-200-real.json`.
- Dos nuevos diagnósticos de nota en combo de arroz: cantidad y bebida correctas, pero se pierde«sin cebolla». `whatsapp-combo-note-loss.repro.ts` fuera del inventario verde. Al contrastar con orquestador6294bffa, ambos fallan igual (/tmp/ppp-200-note-before.json). Se restauró exactamente el código candidato antes de la global. No es regresión atribuible a esta corrección y NO está solucionado. Los15controles iniciales dieron13verdes/2rojos; los2rojos se conservan como diagnóstico, no se eliminan.

## Validación

Foco37/37 (/tmp/ppp-200-focus.json). TypeScript general/build y Node92aprobados antes de la global; TypeScript general final incluye el archivo diagnóstico separado. Global18.714/266suites,574hashes,706,66s; inventario exacto y fuente congelada. Evidencia /tmp/ppp-200-global-summary.json.

HTTP, agente, mapas y persistencia simulados; cero llamadas pagadas/WhatsApp/órdenes externas. Modelos mock no miden comprensión real. Sin cambio de Main ni despliegue. No declarar listo para vender por conteos.

## Siguiente tanda

Trazar el segmento que pierde la nota en combo de arroz y comparar con ruta genérica de bowl/pasta; corregir conservación de notas sin copiar ingredientes del nombre ni cobrar acompañamientos. Reproducir originalPPP con composición de arroz/medio pollo/gaseosa y plural en esos mismos caminos; mantener pendientes191/192/183/184/186. La telemetría199está en rama, no desplegada: aún falta activar observación y medir otras rutas antes de acreditar ahorro. Las llamadas de resumen siguen existiendo.
