## VIGENTE — tanda139: consulta de precio y elección en un turno (23/10)

Base e7f54766, staging.36 conversaciones nuevas en tres cartas sintéticas (arepa,wrap,ravioles), agente simulado on/off, consulta antes/después de elección, opción por nombre/punto y coma o número/salto de línea, y cambio posterior de bebida. Parten de carrito vacío, abren selector, preguntan precio y eligen en un turno, cierran para recoger, pagan y confirman. Respuesta incluye precio y opción; carrito/DTO una sola unidad con última bebida; no crea orden antes de confirmar.

Fallos: baseline12/12 omitían precio aunque elegían correctamente. Ampliación falló24/36: elección numérica mezclada no se aplicaba, y «Mejor cambia la bebida a…» se procesaba como productos inexistentes. Correcciones generales: reconocer dos cláusulas con consulta referencial y opción ofrecida, conservar marca de consulta de precio y enviar solo elección a la ruta normal; al mutar el carrito se reutiliza resumen con precios. «Mejor cambia…» se normaliza como comando de cambio solo con carrito existente y sin interrogación. Sin excepciones PPP.

Foco final186/186,10,784s, TS general/build OK, Node92/92. Global16.962/16.962,203suites,501hashes,573,83s; inventario exacto y fuente congelada. Evidencia /tmp/ppp-139-baseline.log, /tmp/ppp-139-focus.log (ampliación fallida), /tmp/ppp-139-change.log, /tmp/ppp-139-expanded.log, /tmp/ppp-139-final-focus.log, /tmp/ppp-139-tsc.log, /tmp/ppp-139-node.log, /tmp/ppp-139-global-summary.json. Son36 casos nuevos; no sumar ejecuciones repetidas.

Publicado en staging; despliegue139 agrupado pendiente. Último servidor verificado sigue638d0d85, imagen5e97df19…, healthy en tanda138 a23/10 13:53:41 Bogotá; sin nueva comprobación remota en139. Main/producción intactas. Cero API pagada, WhatsApp u órdenes externas.

Límites: texto serial, mocks, consulta referencial explícita separada por punto y coma o salto de línea; selección única y sin sustitución pendiente. No acredita paráfrasis libres, audio, condiciones ni modelo real. Siguiente: «si no cuesta más» frente a elección firme, conjunciones naturales y número fuera de opciones sin compra implícita. Después contraste con inferencia real según whatsapp-api-validation-next-2310.md. No declarar vendible por conteos.

