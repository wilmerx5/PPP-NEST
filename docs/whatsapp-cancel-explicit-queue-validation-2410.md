# Tanda165: cancelación ante compras con opciones resueltas

## VIGENTE — tanda165: cancelar activa y continuar compras resueltas (24/10)

Base19eb7e03, solo staging.12 recorridos nuevos: tres menús×agente simulado on/off×segunda compra resuelta/segunda y tercera resueltas. Baseline12/12 falló: cancelar la activa abría de nuevo opciones ya indicadas de la siguiente. Ahora retira solo fila activa, añade sucesoras completas con cantidad/nota y continúa hasta la primera incompleta; respuesta informa las adiciones reales. No hardcodes de productos/IDs.

Foco84/84,41,655s; TypeScript general/build OK; Node92/92. Global17.605/17.605,234suites,532hashes,825,61s; inventario exacto/fuente congelada. /tmp/ppp-165-{baseline,focus,tsc,node}.log y global-summary.json. Cero API/Meta/órdenes externas. Main intacta. Deploy agrupado161–165 pendiente de verificación; servidor previoe8cf6ffa(158–160).

Próximo: cancelar una fila posterior por nombre, producto agotado tras encolar, mismo SKU activo y referencias «otras dos de esas».165 prueba cancelar activa cuando sucesoras distintas ya tienen opciones completas; no acredita estos pendientes. Modelo/mapa simulados, checkout inicial sembrado y DTO final verificado. Ver whatsapp-cancel-explicit-queue-validation-2410.md. No declarar vendible por conteos.

## Contrato y límites

Suite whatsapp-pending-cancel-explicit-queue.spec.ts: menú bowl/gaseosa/malteada, pizza/jugo/café y arroz/refresco/batido; tercer producto té. Se inicia con plato en pago pendiente, se solicitan dos bebidas sin sabor, dos del siguiente producto Vainilla sin azúcar y tres tés sin hielo, estos últimos con/sin Durazno explícito. Una consulta de contenido conserva carrito. «Cancela esa bebida» descarta las dos primeras unidades, añade las dos de Vainilla y pregunta solo por el té si falta sabor. Si ya se indicó Durazno completa todo y retoma pago.

DTO exacto: plato1, primera bebida0, segunda2 con Vainilla/sin azúcar, té3 con Durazno/sin hielo; total6unidades. Una creación simulada al confirmar; nombre, dirección y teléfono conservados. Se mantiene control de ambigüedad para «esa bebida» como atributo de un combo. Bucle consume fila solo tras adición exitosa; selección incompleta conserva su segmento y cantidad.

No acredita agotamiento posterior, productos retirados, límites de carrito ni selección posterior por nombre; son pendientes expresos. No proveedor real/Meta/órdenes externas. La global incluye cancelaciones históricas y pruebas de opciones explícitas/mismo producto. No afirmar preparación comercial a partir del conteo.
