# Tanda 111 — compra inicial con pregunta de acompañamiento

Base cf510ed2, rama staging. 22 regresiones nuevas: compra de una/dos unidades más pregunta de contenido, respuesta afirmativa/negativa, aceptar/rechazar, 12 recorridos hasta DTO simulado y cuatro reproducciones del pollo frito/papa francesa. Tres menús sintéticos y fixture PPP, agente simulado on/off. Las doce compras hasta DTO y los cuatro casos literales restauran reply real; transporte/modelos/persistencia externos simulados.

Se responde primero sobre el contenido y se conserva una oferta con cantidad, sin añadir el acompañamiento consultado. Solo se resuelve un nombre de catálogo inequívoco con carrito vacío; nombres con prefijo «1» pueden coincidir con la compra de «un…». La aceptación de una oferta limpia su estado antes del flujo de atributos, evitando conservar una oferta ya aceptada. Baseline: 18 fallidos/84 aprobados; tras corregir y ampliar: 106/106 en la suite. Foco 214/214, TypeScript general/build OK, Node 92/92. Global 15.999/15.999, 192 suites, inventario exacto, 490 hashes intactos, 997,5 s, sin reintentos. No inferir mejora del rendimiento: esta global tardó más que la anterior.

Límites: pregunta con signos, hasta 120 caracteres y acompañamiento corto; nombre explícito único, no alias ambiguos. No incluye búsqueda automática de combo alternativo para esa pregunta inicial ni preguntas de bebida, que conservan su ruta. No acredita precisión de modelos/Maps reales. Evidencia: [tanda 111](whatsapp-initial-side-question-validation-2210.md). Cero llamadas pagadas, WhatsApp u órdenes externas. Main y su despliegue se preservan (hasta tanda 109). Esta tanda queda publicada en la rama staging, sin reconstruir el servidor; el despliegue de staging sigue en tanda 110 (4b2e84d5). Agrupar el siguiente despliegue validado.

Siguiente: selección con texto («el combo 2 porfa»), contraste número de opción/cantidad, respuestas mientras elige bebida y conservación del DTO. Después ampliar nombres/acompañamientos y oferta de variantes sin asumir compra de adicionales.

## Evidencia reproducible

- `npx jest --runTestsByPath src/whatsapp/whatsapp-cart-side-inclusion.spec.ts src/whatsapp/whatsapp-related-combo-offer.spec.ts src/whatsapp/whatsapp-checkout-full-journey.spec.ts --maxWorkers=2 --silent`: 214 pruebas.
- `npx tsc --noEmit` y `npx tsc --noEmit -p tsconfig.build.json`: sin errores.
- `node --test scripts/*.test.cjs`: 92 controles.
- Global: primero whatsapp-general-accuracy.spec.ts en serie (80); después las otras 191 suites con maxWorkers=4 (15.919). No se ejecutaron simultáneamente. Inventario obtenido con listTests; unión exacta, sin duplicados.
- Logs locales: /tmp/ppp-111-baseline.json, /tmp/ppp-111-focus2.json, /tmp/ppp-111-targets.json, /tmp/ppp-111-burst.json, /tmp/ppp-111-rest.json, /tmp/ppp-111-global-summary.json. Son evidencia local auxiliar; este documento conserva resultados y alcance.

## Fallos y corrección

La ruta de combos consumía la pregunta inicial antes de la respuesta de acompañamiento. El manejador existente solo conocía platos en carrito o con opciones pendientes. Se admite una compra explícita de nombre único y cantidad, antes de seleccionar combo, conservando las verificaciones de descripción del catálogo. La pregunta se contesta y se ofrece el plato; «sí» añade solo ese plato y su cantidad, con el flujo normal de opciones. «No gracias» elimina la oferta sin compra.

La prueba del paso siguiente detectó una oferta persistente tras añadir un producto con atributos: se persistía desde otra lectura de sesión. Ahora se guarda la limpieza antes de delegar al flujo de variantes. No se cambia la política de compra ante una consulta sin intención explícita.

## Oráculos

Respuesta sobre contenido respaldada por descripción; carrito vacío antes de aceptar; cantidad preservada; acompañamiento nunca añadido por preguntarlo; oferta eliminada tras aceptación/rechazo; opciones pendientes completadas antes de seguir; cero llamadas a create antes de confirmar y DTO con exclusivamente las unidades del plato. Casos previos contrastan carrito vacío sin referencia, dos platos ambiguos, descripción incompleta, bebidas y checkout interrumpido.

No se afirma que todas las consultas compuestas estén resueltas. No se hizo inferencia real ni se desplegó esta tanda. El siguiente agente debe seguir desde staging, conservar Main y agrupar la publicación al servidor después de la siguiente validación.
