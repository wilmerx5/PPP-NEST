# Tanda158: ingredientes e interrupciones

## VIGENTE — tanda158: otras formas de preguntar por ingredientes (23/10)

Base9a8eead4, solo staging.36 recorridos nuevos: tres menús×detalle conocido/desconocido×agente simulado on/off×nombre,pago,confirmación. Preguntas «la ensalada de qué es», «qué lleva esa salsa», «qué ingredientes tiene la guarnición». Baseline36/36 falló: respuesta incompleta o sin recordatorio del pendiente. Se normalizan consultas para reutilizar la respuesta del acompañamiento del plato enfocado, sin ampliar compras ni inventar ingredientes. Sesión completa, nombre, carrito y estado conservados; cierre con DTO y datos corregidos verificados.

Foco162/162,16,895s; TypeScript general/build OK, Node92/92. Global17.467/17.467,227suites,525hashes,588,18s; inventario exacto/fuente congelada. Evidencia /tmp/ppp-158-baseline.log, focus.log, tsc.log, node.log (mismo prefijo) y /tmp/ppp-158-global-summary.json. Cero API/Meta/órdenes externas. Publicación solo staging; despliegue pendiente para agrupar. Último servidor verificado0a3e2ae4 (154–157). Main/producción intactas.

Próximo: cambio de categoría durante sabor pendiente, ingredientes de otro plato mientras elige bebida, consultas+acción y después de confirmar. No acreditar esos caminos con158: mantiene guardas de selección pendiente. Contraste real pendiente según whatsapp-api-validation-next-2310.md. Ver whatsapp-side-paraphrases-validation-2310.md. No declarar vendible por conteos.

## Alcance

Router completo con IA y servicios externos simulados. Se compra un plato con nota, luego se establece explícitamente el estado de checkout para aislar la interrupción; no acredita entrada natural a cada estado. Pregunta precio, ingredientes y carrito; completa dato faltante, corrige nombre/teléfono y confirma contra el mock de órdenes. Verifica una unidad, nota y datos de contacto/dirección en DTO.

Descripción conocida: tomate y cebolla; desconocida: solo acompañamiento. La respuesta debe documentar o admitir desconocimiento. La lógica usa catálogo y no nombres/IDs de fixtures.

## Corrección y límites

tryHandleReferencedSideDetail normaliza orden invertido y «qué lleva/qué ingredientes tiene». Conserva la exigencia de acompañamiento en descripción del producto enfocado y excluye el propio nombre del producto. No cambia guardas de selección pendiente ni compra+pregunta.

## Verificación

Foco: whatsapp-side-ingredient-paraphrases, whatsapp-checkout-side-ingredients, whatsapp-side-detail-and-preparation, whatsapp-pending-drink-questions (archivos .spec.ts bajo src/whatsapp), Jest runInBand. TypeScript general/build, node --test scripts/*.test.cjs. Global /tmp/ppp-158-global.py: ráfagas aisladas y resto cuatro workers, inventario exacto/hashes. Fuente congelada. No repetir global por documentación.

## Próximo bloque

Consultar sopas/postres/entradas durante sabor pendiente, categoría agotada/inexistente y acompañamiento de otro plato. Conservar cantidades/notas, responder catálogo, retomar sabor explícito y comprobar DTO sin compras accidentales. Baseline primero, una suite Jest a la vez; global si cambia runtime compartido.
