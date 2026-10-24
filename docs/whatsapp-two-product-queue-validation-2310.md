# Tanda161: dos productos configurables

## VIGENTE — tanda161: dos productos configurables y cancelación (23/10)

Base9702fbcd, solo staging.24 recorridos nuevos: tres menús×agente simulado on/off×completar ambas bebidas/cancelar primera/cancelar segunda/segunda agotada. Baseline inicial18/18 falló: segunda solicitud no quedaba almacenada. Se reutiliza pendingMultiOrder con fila activa y siguiente, guardando segmento/cantidad/notas; al resolver o cancelar activa pasa a la siguiente. «Cancela esa bebida» entra en cancelación de selección, conserva carrito y resto de cola. Adición explícita de SKU agotado informa ausencia y conserva pendiente. No se añade producto por consultar.

Foco66/66,11,134s; TypeScript general/build OK, Node92/92. Primera global interrumpida tras detectar regresión en combo→«de broster»: la cola interpretaba una respuesta corta como adición. Se restringe creación de cola a compra explícita (agrega/añade/quiero/dame). Regresión histórica pasó aislada; global FINAL17.533/17.533,230suites,528hashes,780,10s; inventario exacto/fuente congelada. /tmp/ppp-161-global-summary.json. Cero API/Meta/órdenes externas. Publicación solo staging;161 pendiente de deploy agrupado. Último servidor acreditadoe8cf6ffa (158–160). Main intacta.

Próximo: segundo producto con sabor ya explícito, más de dos productos configurables, mismas referencias/IDs, cambio de cantidad o agotamiento después de encolarlo. No acreditar estos caminos con161. Esta tanda prueba dos bebidas distintas, consultas de contenido intermedias, cancelaciones y DTO final exacto. Modelo/mapa simulados; contraste real pendiente. Ver whatsapp-two-product-queue-validation-2310.md. No declarar vendible por conteos.

## Recorridos

Carrito de un plato sembrado en pago. El router abre selección de dos bebidas sin hielo; luego se piden dos bebidas de otra familia sin azúcar. Se comprueba fila activa intacta y cola con ambos productos, consulta de contenido, resolución o cancelación de primera, consulta de contenido de segunda y resolución o cancelación. Regresa a pago y se confirma únicamente contra mock de órdenes. DTO acredita cantidades, atributos y notas de las bebidas conservadas; no incluye las canceladas. Contacto, dirección y plato original preservados.

Se añadieron seis controles con segundo producto agotado: no encola, responde disponibilidad y permite terminar primero. El baseline inicial fue18, no24. Todos son gratis y con modelo/servicios simulados; estado inicial sembrado no acredita entrada natural al checkout.

## Corrección y regresión

El helper de compra durante atributo antes respondía «después te ayudo» sin guardar segundo producto. Ahora encola solo ante compra explícita; mantiene el comportamiento de aclaración para respuesta corta. Reutiliza la cola existente, sin schema nuevo. Disponibilidad se verifica antes de guardar un producto configurable; la solicitud explícita con nombre completo de un SKU agotado se contesta antes de que la consuman rutas de selección. No hardcodea restaurantes/productos.

Primer global encontró regresión en whatsapp-general-accuracy-part-09.spec.ts («combo, broster, coca cola y arepas fritas»): guardaba pollo suelto a partir de respuesta de variante. Run detenido al confirmar fallo, evidencia /tmp/ppp-161-first-rest.log y first-global.log. Se exigió compra explícita antes de encolar; caso histórico pasó aislado (/tmp/ppp-161-regression.log), luego foco y global nuevos. No se alteró ese test histórico para acomodar la implementación.

## Validación

Foco: whatsapp-pending-two-product-queue.spec.ts, whatsapp-pending-category-purchase.spec.ts, whatsapp-pending-flavor-category.spec.ts bajo src/whatsapp, Jest runInBand. TypeScript general/build y node --test scripts/*.test.cjs. Global /tmp/ppp-161-global.py con ráfagas aisladas y resto4workers; inventario completo, hashes iguales. Logs /tmp/ppp-161-{baseline,focus,tsc,node,global}.log y JSON de resumen. Documentación posterior no requiere otra global.

## Límites

No acredita tres productos, cola con mismo SKU, selección anticipada explícita del segundo, cambio de opciones/disponibilidad después de guardarlo, persistencia SQL ni inferencia real. Próxima tanda debe empezar por esos caminos, conservar el test histórico del combo y no ejecutar globals concurrentes. No desplegar a Main sin solicitud; agrupar siguiente deploy de staging.
