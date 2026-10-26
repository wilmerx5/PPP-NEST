# Tanda190 — recapitulación de cantidades y nombre «Es»

Base e82b792a, staging. Sin llamadas pagadas, Meta ni órdenes externas. Sin cambios en Main ni despliegue.

## Reproducción y causa

Cinco pruebas iniciales fallaron:
-«Es un pollo frito y uno a la broster», desde nombre vacío, persiste «Es» en agente simulado off/on. El parser de nombre al inicio + pedido extrae esa palabra y el validador la acepta. Esta reproducción demuestra un camino local capaz de generar el error observado; no sustituye una traza del turno productivo.
-«Ósea1y1ylos2plátanos», desde carrito con1frito/1broaster/2plátanos, produce «no manejamos Ósea1» en off/on. En esta semilla las cantidades ya se conservaban. No atribuir una duplicación a este diagnóstico ni afirmar cubierta toda la secuencia original de compra parcialmente fallida.
-El validador acepta«Es» como nombre guardado.

Evidencia: /tmp/ppp-190-baseline.{json,log},5/5fallidos.

## Corrección general

El validador descarta el fragmento declarativo aislado «Es» sin cambiar la longitud mínima de nombres. Conserva nombres cortos y nombres que empiezan por esas letras. La validación existente de checkout exige corregir un destinatario inválido guardado antes de crear la orden.

Un resumen explícito con«o sea»,«es decir»o«me refiero a» y varias cantidades no compra productos ni convierte números en códigos. Solo confirma coincidencia cuando los productos nombrados se asocian de forma única al carrito y las cantidades sin nombre corresponden inequívocamente a las líneas restantes. No depende de IDs/restaurante/productos particulares.

Si cantidades o referencias no cuadran, muestra el carrito y pide producto+cantidad sin mutarlo. No interpreta el orden de cantidades diferentes como orden de líneas. Preserva opciones, notas y paso de checkout. No interfiere con elecciones de producto/atributos pendientes. Una petición explícita adicional sigue el flujo de compra normal.

## Pruebas

whatsapp-order-restatement.spec.ts:45nuevos casos:
-2compras desde nombre vacío comprueban que ambos pollos quedan1+1y el destinatario no es«Es».
-2recapitulaciones del chat conservan carrito y evitan aviso de producto inexistente.
-1validación de fragmento inválido.
-24recorridos en3menús×agente mock off/on×compra/pago×«o sea»/«es decir». Repiten recapitulación, conservan estado/notas/cantidades y cierran DTO de4unidades.
-6recapitulaciones ambiguas/inválidas/desconocidas piden precisión sin cambios.
-6controles de nombres legítimos:Li,Al,Ana,Esmeralda,Esteban,José.
-2compras adicionales auténticas tras recapitulación suman una unidad solo al producto solicitado.
-2recorridos con nombre previo«Es» bloquean creación, piden nombre y cierran DTO conAnaRuiz.

Baseline5rojos; corrección inicial5verdes; ampliación41/41; foco final138/138en3suites (incluye45nuevos). TypeScript general/build yNode92/92aprobados. Global final: 18.504 pruebas en 258 suites, 558 hashes, 787,98 segundos; inventario exacto y fuente congelada. Evidencia: /tmp/ppp-190-global-summary.json y /tmp/ppp-190-{burst,rest}.json.

## Límites y siguiente tanda

No se arreglaron aún acompañamientos repartidos entre dos pollos, nota residual del nombre del plátano ni«Efectivo50». No se modifica automáticamente un carrito distinto al resumido: ante falta de correspondencia pide precisión. No declara corregida una duplicación de la secuencia larga que no se ha reproducido aquí. La compra inicial parcialmente fallida y recuperación completa siguen pendientes, junto con183/184/186.

Agente, catálogo de prueba, persistencia, mapas y órdenes simulados. No acredita inferencia real ni geocodificación. Mantener las pruebas de respuesta además de carrito/DTO: el fallo de recapitulación en esta base era visible en la respuesta aunque el carrito permanecía igual.
