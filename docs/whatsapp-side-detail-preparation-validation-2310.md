# Tanda 146 — consultas de acompañamiento, preparación y corrección exclusiva

Base cdd54a1a, staging. Validación y despliegue cerrados; ver evidencia al final.

## Evidencia y fallos

Conversación del usuario: arroz con pollo y composición de la ensalada; trucha con preparación no disponible seguida de «una asada»; bagre en salsa con consulta de acompañamiento, consulta repetida que se convierte en compra y nota, y «solo quiero un bagre y que lleve las papas sudadas» que elimina trucha pero conserva dos bagres.

Reproducción histórica 145: 12 fallos en etapas iniciales, no doce causas independientes. Nueva ampliación 146: seis recorridos fallan primero porque «salsa pero con qué viene» se toma como preparación; tras separar compra/consulta, seis fallan en corrección de cantidad+nota. Registros /tmp/ppp-146-bagre-baseline.log y /tmp/ppp-146-bagre-after.log. No confundir esos reintentos con nuevos casos.

## Cambios y oráculos

- Detalle de un acompañamiento del producto enfocado: responder con descripción disponible o reconocer que no hay ingredientes confirmados; no abrir selección residual. Compra explícita más pregunta conserva una sola unidad.
- Preparación no ofrecida: guardar selección real del producto y sus opciones para que «una asada» resuelva el referente. No prometer salsa no catalogada.
- Compra singular explícita seguida de «pero con qué viene»: separar la cláusula informativa antes de resolver atributos. Preguntas de acompañamiento con producto explícito no modifican carrito, notas ni estado de checkout.
- «Solo quiero [cantidad/producto] y que lleve [nota]»: si las líneas coinciden en producto y opciones, conservar una línea con cantidad absoluta y la petición de cocina. Quitar notas que eran consultas y los otros productos porque el cliente dijo solo. No acreditar aprobación comercial de la petición.

24 conversaciones nuevas, agente simulado on/off, cartas arroz/pasta/bowl y pescado/tofu/berenjena. Incluyen ingredientes conocidos/desconocidos, consultas repetidas, recuperación de carrito histórico con dos líneas y una nota errónea, interrupción de nombre, pago y DTO final exacto. El carrito histórico corrupto se inyecta explícitamente: no se afirma que el código corregido lo haya producido.

Foco final 166/166 en tres suites, 36,752 s; TypeScript general/build OK; Node 92/92. Evidencia /tmp/ppp-146-final-{expanded,tsc,node}.log. La primera global /tmp/ppp-146-global.log fue interrumpida al llegar la continuación del usuario; no acredita aprobación. La segunda global /tmp/ppp-146-complete-global.py detectó dos regresiones en part-07 (bagre en salsa con harto limón) y se interrumpió. Se excluyeron cláusulas con con/sin del detector de salsa no ofrecida; revalidación846/846 en part-07 y nueva suite. Global final agrupada146–147: /tmp/ppp-147-global.py, fuente congelada, inventario y hashes.

## Límites y siguiente paso

Son reglas de catálogo sin excepciones por nombres/IDs/precios PPP. Los fixtures contienen productos concretos y ficticios. Servicios externos y agente simulados: cero gasto API, Meta u órdenes externas; no mide reconocimiento de audio ni entendimiento libre del modelo real. Cobertura deliberadamente acotada a formas explícitas, producto único y ausencia de otra selección pendiente; no extrapolar a varias compras o variantes incompatibles en una sola cláusula.

Después de cerrar la global: publicar solo staging, documentar SHA; agrupar despliegue. Main/producción intactas. El siguiente contraste útil sigue siendo la ronda real acotada de docs/whatsapp-api-validation-next-2310.md, con presupuesto registrado antes de llamadas; no seguir sustituyéndola por conteos de mocks. Añadir posteriormente controles de «solo» con variantes incompatibles y notas distintas sin elegir arbitrariamente la línea.

## Cierre global agrupado

17.128/17.128 pruebas,208 suites,506 hashes,621,17s; inventario exacto y fuente congelada. Evidencia /tmp/ppp-147-global-summary.json. Despliegue verificado; Main intacta.

## Despliegue verificado

Desplegadas146–147 solo staging: eef121c13c6888d5732eb91a67c272db3e35eb0c, imagen sha256:20007c4f98b5ba8cfd0040adeedab800829729096ad8b9e8e00a8df116844fa6. Verificación independiente2026-10-23T23:25:25Z: running/healthy,0 reinicios, /api/health OK,DBconnected,circuitCLOSED. publicChat=true/orderEvents=false conservados. Producción mantiene ef426c93… y0reinicios. Rollback ppp-nest-staging:rollback-before-eef121c1. Evidencia /tmp/ppp-147-deploy.log y /tmp/ppp-147-verified.log. La conexión SSH original quedó sin finalizar aunque el contenedor arrancó22:23:42Z; se comprobó que no había compose remoto activo y se cerró solo el cliente SSH local. No confundir salida truncada de transporte con fallo del contenedor. Privados/bin/,bases y volúmenes preservados. Commit posterior solo documental no requiere reconstrucción.
