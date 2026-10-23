# Tanda 114 — cantidad, fila y bebida

Base 2887c476, staging. 48 regresiones nuevas en tres catálogos y agente simulado on/off: «dos del combo 2 con Uva», «uno de la opción 1 con Uva», «dame 3 del combo 2 porfa»; aumento/reducción, notas/opciones compatibles, bebida pendiente y 18 DTO simulados. Contrastes de cantidad cero, negativa, superior al límite de lectura 30, fila no ofrecida y cantidad conservada después de cotizar precio nuevo. Baseline 42 fallidos/168 aprobados; suite final 216/216. Foco 558/558 en seis suites; TypeScript general/build OK; Node 92/92. Global 80 + 16.069 = 16.149, 192 suites; inventario exacto y 490 hashes intactos; 805,77 s, sin reintentos.

Se separa cantidad explícita de referencia a fila y bebida. Reemplazar usa la cantidad solicitada, manteniendo el original intacto mientras faltan opciones. La cotización nueva conserva la cantidad en la selección pendiente. Cero/negativos/fuera de rango y filas no ofrecidas no reemplazan por el combo preferido. Se conservan límites de carrito existentes además del límite de lectura. No hay excepciones de productos PPP.

Límites: oferta de reemplazo por combo con preferredId, cantidad explícita antes de «del/de la/de el», bebida validada por la tanda 113. No acredita reparto entre varias líneas/sabores ni contacto/dirección en el mismo mensaje. Router y dependencias simuladas; cero llamadas pagadas, WhatsApp u órdenes externas. Main y su despliegue permanecen sin cambios. Agrupar despliegue de tandas 113/114 en staging y verificar registro final. Evidencia: [tanda 114](whatsapp-counted-combo-selection-validation-2210.md).

Siguiente: contacto/dirección mientras se elige combo y bebida, respuesta con varios datos y conservación del paso pendiente; luego distribución entre varias opciones. Mantener controles de precio, disponibilidad, notas y DTO.

## Hallazgos

La frase de cantidad no era reconocida como referencia a la fila ofrecida; una coincidencia de sabor podía activar el combo preferido, ignorando cantidad y número. Además, la oferta conservaba siempre la cantidad original incluso cuando había una cantidad explícita distinta. Se reconoce la cantidad antes del enlace «del/de la/de el» y se entrega el resto al lector de fila existente. El reemplazo usa esa cantidad, o la cantidad pendiente de una nueva cotización, antes de recurrir a la original.

Los controles simulan un plato previo y comprueban aumento de una a dos/tres unidades y reducción de tres a una, sin acumularlas. Cuando falta bebida el carrito original se conserva hasta responder; después el DTO contiene exactamente las unidades elegidas. El caso de precio cambia la segunda opción, exige aceptar de nuevo y no pierde la cantidad aunque la segunda respuesta solo diga «el combo 2 con Uva».

## Verificación reproducible

- Foco: whatsapp-related-combo-offer.spec.ts, whatsapp-list-row-count-cancel.spec.ts, whatsapp-several-list-rows.spec.ts, whatsapp-combo-requote-contact.spec.ts, whatsapp-combo-price-acceptance.spec.ts y whatsapp-combo-live-menu.spec.ts. Jest --maxWorkers=4 --silent: 558 pruebas.
- TypeScript general y build con --noEmit, más node --test scripts/*.test.cjs: OK, OK, 92 aprobadas.
- Global en dos fases no simultáneas: whatsapp-general-accuracy.spec.ts --runInBand y resto --maxWorkers=4. No cambios durante ejecución; inventario listTests exacto y hashes iguales antes/después.
- Evidencia local auxiliar: /tmp/ppp-114-baseline.json, /tmp/ppp-114-focus.json, /tmp/ppp-114-targets.json, /tmp/ppp-114-burst.json, /tmp/ppp-114-rest.json, /tmp/ppp-114-global-summary.json.

El harness usa servicios y reply simulados; no valida Meta ni el modelo real. Son regresiones de reglas y flujo, no un indicador suficiente de preparación comercial. No se modificaron modelos ni datos de negocio. Preservar Main y continuar sobre staging.
