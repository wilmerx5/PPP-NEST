# Tanda162: tres compras configurables pendientes

## VIGENTE — tanda162: tres selecciones con consultas y cancelación (23/10)

Base0e4bc78b, solo staging.24 recorridos nuevos: tres menús×agente simulado on/off×completar todo/cancelar primera/cancelar segunda/cancelar tercera. Compra pendiente de dos bebidas, otra compra de dos y tercera de tres; preguntas de contenido antes de cada elección. Verifica cola, carrito previo, respuesta de catálogo, cantidades, sabores, notas y DTO final exacto. Baseline inicial12/12 pasó; ampliación final24/24 pasó sin cambio runtime.

Foco72/72,23,143s; TypeScript general/build OK; Node92/92. Evidencia /tmp/ppp-162-{baseline,focus,tsc,node}.log. No global redundante por tests/docs: última global161=17.533/230suites; no sumar focos a global. Cero API/Meta/órdenes externas. Main intacta. Publicación solo staging; no deploy en162. Runtime161 sigue pendiente de deploy agrupado; último servidor acreditadoe8cf6ffa(158–160).

Próximo: segunda compra con sabor ya explícito (y nota), tercera compra después de una fila ya resuelta, mismo SKU en varias filas, agotamiento posterior al encolado. Estos caminos NO están acreditados por162: aquí los tres productos distintos requieren elegir su sabor posteriormente. Inicio de checkout sembrado, proveedor y mapa simulados; contraste real pendiente. Ver whatsapp-three-product-queue-validation-2310.md. No declarar piloto/vendible por conteos.

## Contrato comprobado

Suite `src/whatsapp/whatsapp-pending-three-product-queue.spec.ts`. Menús sintéticos bowl/gaseosa/malteada, pizza/jugo/café y arroz/refresco/batido; tercer producto té con sabor obligatorio. Cada recorrido comienza con un plato ya presente y pago pendiente. El router recibe las tres compras por turnos, conserva la selección activa y responde consultas de ingredientes antes de continuar.

Se completa todo o se cancela una de las tres selecciones. La orden simulada debe contener exactamente una unidad del plato inicial, dos unidades de cada primera/segunda bebida retenida y tres del té retenido. Se cotejan los sabores y notas sin hielo/sin azúcar por unidad, además de dirección, teléfono y nombre. Ninguna consulta crea la orden. Solo efectivo y confirmación final llaman una vez al mock de creación.

## Límites y siguiente reproducción

No acredita precisión del modelo real, audio, imágenes, mapas ni ráfagas concurrentes. No acredita filas del mismo SKU ni selección ya explícita al encolar. Inspeccionar en la siguiente tanda la rama `ready.status === complete` al avanzar pendingMultiOrder: verificar preservación de nota y apertura de una tercera selección. La inspección indica un riesgo, no un fallo reproducido en162. Reproducir antes de modificar y ejecutar global congelada si cambia runtime.
