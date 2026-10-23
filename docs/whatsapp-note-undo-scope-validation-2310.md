## VIGENTE — tanda 129: retirar una nota conservando instrucciones posteriores (23/10)

Base f7df399a, staging. 18 conversaciones nuevas en tres menús sintéticos (bao/salsa, pizza/masa, batido/base), agente simulado on/off. Carrito preparado con dos líneas de dos unidades, opciones y notas diferentes. Se añade sin ajo y después salsa aparte a la primera; se retira solo sin ajo, se repite la retirada o se solicita primero un producto con dos líneas (debe aclarar), se consulta total y se cierra hasta DTO de cuatro unidades.

Baseline: 18 fallos. La regla general de empaque interceptaba «a la primera ponle como nota salsa aparte» y guardaba la instrucción completa. Ahora las notas explícitamente dirigidas a una línea se dejan al editor de notas existente. Sin excepciones por producto. Se conserva sin cebolla y salsa aparte, la otra línea y sus opciones, cantidades y precio. No hay orden antes de confirmar.

Foco 129/129 en tres suites, TypeScript general/build OK, Node 92/92. Global final 16.698/16.698, 196 suites, inventario exacto y 494 hashes intactos, 619,37 s. Incluye las 30 pruebas de tanda 128 y las 18 de esta, además de la global anterior; no sumar ejecuciones focales solapadas. Cero API pagada, WhatsApp u órdenes externas.

Publicación solo en staging; despliegue agrupado pendiente. Servidor conserva 3d5ef289, imagen a6f987f7…; última verificación 23/10 09:20:16 Bogotá de tanda 128, no verificado nuevamente aquí. Main/producción intactos. Mantener publicChat=true y orderEvents=false.

Límites: retirar una nota explícita/ordinal no equivale a deshacer cualquier modificación. Referencias «esos dos», «de esos tres deja dos como estaban» o «deshaz eso» siguen pendientes; requieren identificar un grupo y el cambio realmente guardado, sin reconstruirlo desde respuestas narrativas. Los fixtures parten de carrito preparado; no acreditan audio/modelo real ni checkout interrumpido por estas notas en todos sus estados. Siguiente: referencias libres con selección inequívoca y aclaración cuando haya varias; comprobar respuesta, carrito, estado y DTO. No declarar vendible por conteos.

Detalle: [tanda 129](whatsapp-note-undo-scope-validation-2310.md).

Evidencia local: /tmp/ppp-129-baseline.log (18 fallos), /tmp/ppp-129-focus.log (18 aprobadas), /tmp/ppp-129-final-focus.log (129 aprobadas), /tmp/ppp-129-node.log (92), /tmp/ppp-129-global-summary.json y reportes burst/rest. Hashes en /tmp/ppp-129-hashes.json. Código: guard de parseScopedCartNote en tryHandleDishHandlingAside; pruebas en whatsapp-note-undo-scope.spec.ts. Servicios externos y modelo simulados.
