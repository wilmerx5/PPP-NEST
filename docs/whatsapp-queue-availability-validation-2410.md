# Tanda166: productos agotados o retirados durante una selección

## VIGENTE — tanda166: disponibilidad cambia en la cola (24/10)

Base90444258, solo staging.24 recorridos nuevos: tres menús×agente simulado on/off×producto agotado/retirado después de encolar×resolver/cancelar selección activa. Baseline corregido24/24 falló. Ahora cada avance verifica catálogo actual, informa y retira solo la fila no disponible, conserva posteriores y continúa. Al volver al pago se conserva aviso mediante contexto efímero del turno: antes el resumen sobrescribía la explicación aunque el carrito ya fuera correcto.

Foco72/72,36,097s; TypeScript general/build OK; Node92/92. Global17.629/17.629,235suites,533hashes,816,07s; inventario exacto/fuente congelada. /tmp/ppp-166-baseline-corrected.log, focus-approved.log, tsc.log, node.log y global-summary.json (mismo prefijo). Cero API/Meta/órdenes externas. Main intacta. Publicación solo staging;166 pendiente de deploy agrupado. Último servidor verificadob8a6567a(161–165), healthy.

Próximo: sabor retirado de un producto aún disponible, cantidades cambiadas después de encolar, cancelación de fila posterior por nombre y referencias «otras dos de esas».166 acredita compra posterior completa retirada/agotada, no estos caminos. Inicio de checkout sembrado, modelo/mapa simulados y DTO final exacto. Ver whatsapp-queue-availability-validation-2410.md. No declarar vendible por conteos.

## Reproducción y solución

Suite whatsapp-pending-queue-availability.spec.ts. Tres catálogos sintéticos; plato inicial en pago pendiente, dos bebidas esperando sabor, dos de otro producto Vainilla sin azúcar y tres tés Durazno sin hielo. Se reemplaza el catálogo simulado después de encolar: segunda compra pasa a availableNow=false o desaparece. Cliente elige sabor inicial o cancela esa selección. Se exige aviso con nombre del producto ausente, ninguna unidad de él en carrito/DTO, conservación del resto y retorno a pago.

Primer ajuste conservó carrito pero12 casos seguían sin aviso. Se comprobó que el retorno a checkout vacía el buffer de salidas y reemplaza por carrito/resumen; no era solo que sendQueued devuelve la última respuesta. Se amplió el oráculo a todas las salidas del turno y se repitió baseline contra HEAD:24/24 falló. Nueva propiedad efímera queuedPurchaseNotices preserva esos avisos al regenerar el resumen, sin persistirlos como nota ni estado del cliente. Cancelación ya conserva su propia respuesta. Ambas ramas consumen una fila por vez y continúan con siguientes productos.

## Verificación

DTO exacto: plato1, primera bebida2 o0 según cancelación, producto ausente0, té3; total6 o4 unidades. Sabores/notas del resto, contacto/dirección/nombre conservados; una sola creación simulada al confirmar. Foco incluye colas de dos productos, opciones explícitas y cancelación de activa con posteriores resueltas. Global aisló ráfagas y ejecutó resto con cuatro workers, inventario exacto y hashes idénticos.

No acredita proveedor/Meta/mapa real, cambios de opciones individuales, límites del carrito ni productos que regresan al catálogo. No hay despliegue de166: staging continúa enb8a6567a. Siguiente tanda debe reproducir sabor retirado y consulta durante su aclaración, manteniendo cantidad y nota originales.
