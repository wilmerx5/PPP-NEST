# Tanda133 — conversaciones completas de compra y cambio parcial

## VIGENTE — tanda 133: compra desde cero, cambio parcial y cierre (23/10)

Base bd3f5e5e, staging. Doce conversaciones nuevas con carrito vacío en tres menús (bao/salsa, pizza/masa, batido/base), agente simulado on/off, conservar o deshacer el cambio. Compran dos unidades con opción A; cambian una a B con nota propia del menú; cierran para recoger; consultan total y cambian nombre durante pago; opcionalmente deshacen; pagan, confirman y envían gracias. Se verifican respuesta, cantidad total, notas/opciones por unidad, estado pendiente y DTO de dos unidades, sin duplicación por cortesía final.

Sin cambio de producción en esta tanda. Foco final 168/168 en tres suites, 30,199 s. Primer run de doce casos pasó con una nota común; al usar notas por menú hubo cuatro fallos de oráculo por azúcar/azucar, corregidos normalizando tildes únicamente en la comparación semántica. No se relajaron cantidades, atributos ni aislamiento de notas. TypeScript general/build OK; contratos Node92/92. No repetir global por tests/documentación: última global ejecutable132 es 16.812/16.812,197suites; no sumar focos solapados.

Staging ya ejecuta131+132: bd3f5e5e, imagen7db0a13f…, healthy/DBconnected/circuitCLOSED, cero reinicios, verificado23/10 10:59:49 Bogotá. publicChat=true/orderEvents=false. Main/producción intactas. Esta tanda solo añade tests/documentación, no requiere rebuild. Cero API pagada, WhatsApp u órdenes externas.

Límites: nombre inicial conocido, recogida en local, catálogo con un producto/atributo por caso y turnos seriales; no acredita envío real, precisión del modelo, dirección o teléfono nuevos, ni todas las familias del plan. Siguiente: comenzar sin nombre, consulta mientras lo solicita y dirección con interior conservada; después teléfono en pago y producto con bebida incluida + extra. Plan: [conversaciones completas](whatsapp-complete-conversations-next-2310.md). Detalle: [tanda133](whatsapp-empty-cart-options-close-validation-2310.md).


Evidencia: src/whatsapp/whatsapp-empty-cart-options-close.spec.ts; /tmp/ppp-133-focus.log (12/12 inicial), /tmp/ppp-133-accent-oracle.log (4/168 fallos de comparación), /tmp/ppp-133-final-focus.log (168/168), /tmp/ppp-133-tsc.log y /tmp/ppp-133-node.log. Fixtures sin persistencia, Meta ni modelos externos. No declarar vendible por conteos.
