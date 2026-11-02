# Tanda343 — contacto intercalado y corrección compuesta

Origen:01/11 mensajes217–242, grupoB31/10 y U2/U3. La secuencia incluye dos unidades del primer plato, una del segundo, teléfono y una sopa; después retira una unidad del primero y añade otra del segundo.

Se reprodujeron8 bloqueos de «quita un [plato] y añade una [plato]»: el parser exigía «de los de». La retirada directa admite ahora nombre completo de línea, conservando guardas y aplicación atómica. Si varias líneas comparten nombre, pregunta cuál antes de retirar.

Durante la comprobación apareció otra omisión: teléfono separado lleva a awaiting_payment y «Y un Crema De Tomate» se descarta como dirección genérica. Ahora la ruta de compra durante pago consulta el catálogo antes de aplicar ese descarte; las direcciones estructuradas conservan su exclusión.

30 controles nuevos:16 cierres completos en dos catálogos, agente off/mock y separado/coalescido, más14 guardas. Teléfono, cantidades, estado/tipo, respuesta, DTO y recibo43000/44000 comprobados. Foco y relacionadas470/3 aprobadas. Global33304/411, TypeScript general/build y scripts aprobados; Staging343 desplegado y verificado: código `6e890644`, healthy, cero reinicios, API local/pública ok y modelos/configuración privada preservados. Workflow41375523907; evidencia `whatsapp-batch-343-staging-deployment.json`. Controles compilados previos aprobados; cobertura343 local. Primera global interrumpida para incorporar el caso recibido a las20:32.

La primera ejecución tuvo10 fallos:8 bloqueos reales y2 aserciones erróneas que rechazaban «Recoge en el local», un destino válido de pickup. Corregida esa aserción, se observaron2 omisiones reales de la sopa en pago. No presentar todos los fallos iniciales como errores de producción.

No acredita canal/modelo/persistencia reales ni causa de la duplicación histórica. Cero llamadas pagadas y cero órdenes externas. Próximo: continuar U3/U4 con variantes, notas y bebidas conservadas durante modificaciones.

## Cotización de plato compuesto incorporada durante la tanda

Usuario: «Me confirmas por fa el valor del arroz chino con costillas». Baseline4/4 reproduce separación incorrecta en dos catálogos. En PPP cotiza componentes; en el alternativo cotiza pasta compuesta más setas. No es solo redacción: la oferta pendiente podría agregar dos productos tras «sí».

Resolver primero un nombre «X con Y» que cubre todo el texto depurado y es prefijo literal de un único producto disponible. Sin IDs/precios/productos fijos. Consultas con «y», «más» u otro producto conservan su ruta. No se amplía la elección automática ante varias coincidencias.

12 pruebas adicionales, dos catálogos y agente off/mock; consulta sin mutación, aceptación añade un único ID y4 cierres DTO/recibo. Controles «arroz chino y costillas de cerdo» mantienen dos productos. Foco final114/4 aprobado (incluye42 nuevos); foco previo470/3. Son ejecuciones solapadas, no sumar sus conteos como pruebas únicas. El fixture PPP usa48000 para el plato compuesto; no afirma precio vigente del servidor.

## Nuevo chat recibido durante la global: continuación pendiente

01/11 20:49–20:56, sin guardar datos personales: «un arroz chino, costillas de cerdo y sin gaseosa», pago Nequi y dirección en varios turnos; «En combo» apunta solo a costillas; «Cancelar.» conserva carrito; intervención humana aclara el plato combinado.

No afirmar que343 resuelve este recorrido: la coma admite dos productos, mientras «en combo» debe considerar el contexto y aclarar el combo/plato sin gaseosa. La regla corta isCancelIntent no admite puntuación final, aunque frases completas de cancelación tienen otra ruta. Reproducir con router y probar carrito vacío, respuesta, estado y ausencia de orden. Se conservan como pendientes prioritarios cancelación con puntuación, elección contextual de combo y limpieza cosmética de // en dirección. El teléfono y la dirección reales no se incorporan al corpus.
