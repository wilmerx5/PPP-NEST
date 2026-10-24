# Tanda149 — abreviaturas con opciones y nuevo interior al completar dirección

Base95089843, solo staging.30 casos nuevos, tres cartas por familia y agente simulado on/off.

## Reproducción y corrección

Dirección: completar un conjunto pendiente con calle + torre/apto nuevos perdía el conjunto. Baseline6 fallos/6 correctos: el reemplazo explícito ya funcionaba. Se conserva el nombre del conjunto anterior cuando una calle completa esa ubicación, usando los detalles nuevos. Una nueva dirección que trae otro conjunto no hereda el anterior; el cambio explícito sigue reemplazando.

Compra abreviada: «Agrega un bowl frito sin arroz» podía modificar la unidad anterior y combinar notas. Baseline12 fallos: las rutas variaban por familia; hamburguesa era enviada a alternativas de producto no encontrado. Se expande la cabeza abreviada solo si corresponde a un único producto disponible y el sufijo empieza por una opción configurada. Se hace antes de los detectores de producto no encontrado/cambio. Se conservan notas y opciones del texto; no hay excepciones por productos PPP.

12 recorridos dirección +12 abreviatura/corrección exclusiva +6 controles de cambio explícito. Router completo, compra desde vacío, respuesta y carrito, checkout y DTO final; no órdenes prematuras. Controles confirman que «Cambia el… a frito» sigue cambiando una unidad existente, sin agregar otra.

## Verificación

Foco54/54 (30 nuevos+24 de148),17,181s. TypeScript general/build OK, Node92/92. Global17.182/17.182,212suites,510hashes,654,12s; inventario exacto/fuente congelada. /tmp/ppp-149-global-summary.json. Baselines /tmp/ppp-149-baseline.log, /tmp/ppp-149-alias-baseline.log. Foco final /tmp/ppp-149-final-focus.log. No sumar reintentos como cobertura independiente.

## Límites y continuación

Cero API pagada, Meta u órdenes externas. Modelos y geocodificador simulados. No mide búsqueda Google real ni transcripción de audio. Dirección nueva trae torre y apartamento juntos; cambiar solo uno y conservar el otro pendiente requiere tanda específica. Abreviatura verificada con cabeza única y opción explícita; no acredita cabezas compartidas por varios productos ni descriptores no configurados. Siguiente: esos controles negativos y cambio parcial de interior; luego contraste acotado real del plan whatsapp-api-validation-next-2310.md con presupuesto antes de red. No declarar vendible por conteos.

Main y producción intactas. Se agrupará despliegue148–149 únicamente después de global aprobada.
