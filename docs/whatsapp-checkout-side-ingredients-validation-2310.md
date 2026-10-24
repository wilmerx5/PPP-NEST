# Tanda157 — preguntas que el checkout rechazaba

## VIGENTE — tanda157: ingredientes consultados durante datos del checkout (23/10)

Base9e76e0b1, staging.60 recorridos nuevos: tres platos/acompañamientos×detalle conocido/desconocido×agente simulado on/off×nombre,dirección,teléfono,pago,confirmación. Baseline36 fallos/24 aprobados: tryHandleReferencedSideDetail excluía nombre/dirección/teléfono; pregunta se rechazaba o iba al fallback. Consulta de solo lectura ahora permitida en esos estados, responde carta o reconoce ingredientes no confirmados y añade recordatorio del paso pendiente. No amplía compra+pregunta a esos estados. Conserva sesión, carrito y contacto; cierre con DTO verificado.

Foco114/114,15,302s; TypeScript general/build OK, Node92/92. Global17.431/17.431,226suites,524hashes,596,08s; inventario exacto/fuente congelada. /tmp/ppp-157-global-summary.json. Cero API/Meta/órdenes externas. Deploy agrupado154–157 pendiente de verificar; Main intacta. Ver whatsapp-checkout-side-ingredients-validation-2310.md.

Próximo: «qué lleva esa salsa», «la ensalada de qué es», cambio de categoría mientras espera sabor, consulta+acción durante datos, después de confirmar. Esta tanda acredita «de qué es la/el … hoy» con referente existente y sin selección pendiente; no generalizar a todas las preguntas. Sigue pendiente contraste real acotado según whatsapp-api-validation-next-2310.md; no declarar vendible por conteos.

## Evidencia

Baseline /tmp/ppp-157-baseline.log:36 fallos reales en tres estados,24 casos ya verdes en pago/confirmación. Foco /tmp/ppp-157-focus.log:60 nuevos+24 side-detail/preparation+30 contenido/tiempo=114; no sumar reejecuciones. TS /tmp/ppp-157-tsc.log, Node /tmp/ppp-157-node.log. Global /tmp/ppp-157-global.py y resumen:80 ráfagas+17.351 resto;226suites exactas,524 hashes.

Se comprueba respuesta específica, ausencia de ingredientes inventados cuando faltan, recordatorio correcto del paso, sesión completa sin cambios y posterior nombre/teléfono corregidos, nota conservada y DTO de una unidad. Estados intermedios preparados explícitamente: prueba enrutamiento, no cada transición natural. Modelo/mapa/órdenes simulados. General por catálogo, sin excepciones PPP. No hay pruebas nuevas de cambio de categoría en esta tanda; queda como prioridad siguiente.
