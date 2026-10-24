# Tanda163: sabores explícitos y notas en compras en cola

## VIGENTE — tanda163: opciones explícitas al avanzar la cola (23/10)

Base4d6973c4, solo staging.12 recorridos nuevos: tres menús×agente simulado on/off×segunda compra con sabor explícito/segunda y tercera con sabor explícito. Baseline12/12 falló: la segunda compra perdía sin azúcar. La rama de avance añadía una sola fila completa sin nota y retornaba; ahora drena filas completas conservando orderKitchenNote y cantidades, acumula sus confirmaciones y se detiene ante la siguiente opción faltante. No nombres/IDs de PPP en runtime.

Foco60/60,33,394s; TypeScript general/build OK; Node92/92. Global17.569/17.569,232suites,530hashes,747,35s; inventario exacto y fuente congelada. Evidencia /tmp/ppp-163-{baseline,focus,tsc,node}.log y global-summary.json. Cero API/Meta/órdenes externas. Publicación solo staging;163 y runtime161 pendientes de deploy agrupado. Último servidor acreditadoe8cf6ffa(158–160). Main intacta.

Próximo: mismo SKU en varias filas con sabores/notas diferentes; cancelación de primera con siguientes ya completas; agotamiento/cambio de cantidad posterior al encolado. No acreditar esos caminos con163. Inicio de checkout sembrado, proveedor y mapa simulados; contraste real pendiente. Ver whatsapp-explicit-queue-validation-2310.md. No declarar piloto/vendible por conteos.

## Reproducción y cambio

Suite whatsapp-pending-explicit-queue.spec.ts. Sobre un plato ya presente en pago pendiente, se solicitan dos bebidas sin hielo, luego dos bebidas de otro producto con Vainilla sin azúcar, y tres tés sin hielo. El té llega sin sabor o con Durazno explícito. Una consulta de contenido no debe cambiar el carrito. Resolver el primer sabor debe añadir lo ya resuelto y preguntar únicamente por el té si aún falta su sabor.

La primera ejecución falla en los12 casos porque el segundo producto tiene note undefined. La inspección también identifica retorno prematuro tras añadirlo: no procesa la tercera fila. Se sustituye el avance de una fila por un bucle que consume las filas completas, reutiliza la extracción de nota del producto y conserva la fila parcial como pendingAttribute. Las respuestas acumulan los productos efectivamente añadidos. El bucle avanza únicamente después de añadir y retirar la fila actual; no reintenta adiciones bloqueadas.

Pruebas finales verifican respuesta, cola vacía al completar, vuelta a pago, conservación del plato inicial y DTO de ocho unidades: una del plato, dos de cada primera/segunda bebida y tres tés. Cada unidad retiene sabor y nota. Cierre con contraentrega y confirmar llama una sola vez al mock de órdenes; contacto/dirección conservados.

## Validación y límites

Foco incluye las24 pruebas de dos productos y las24 de tres productos de tandas161–162, incluidas cancelaciones. La global usa el bloque de ráfagas aislado y el resto con cuatro workers, sin otra suite simultánea; comprueba inventario exacto y hashes de fuente. Logs privados en /tmp/ppp-163-*.

No prueba proveedor real, WhatsApp, visión/audio ni mapa. No acredita comportamiento de mismos IDs en varias filas, productos agotados después de encolarlos ni cancelación de activa con sucesoras completas. Mantener esos casos como siguiente bloque, sin extrapolar del resultado verde. Sin despliegue en esta entrega.
