# Tanda 186 — compra seguida de consulta de total y transferencia

Base: c28fe0eb, staging. No modifica Main ni producción. No desplegada.

## Cambio comprobado

Una compra seguida de «Cuánto sería para pagar por Nequi / Me envía el número gracias» se separa de la consulta antes de resolver el catálogo. El router conserva el texto de compra, calcula la respuesta desde el carrito resultante y responde con los datos de transferencia configurados. Consultar cómo pagar no selecciona un método ni confirma una orden.

El reconocimiento cubre una consulta final separada por salto de línea o punto y coma, con Nequi, Daviplata o transferencia. No pretende cubrir todas las paráfrasis de pago. Las cotizaciones explícitas e hipótesis no se convierten en compras por esta regla. Los datos de cuenta ausentes se declaran desconocidos; no se inventa un número. La respuesta de transferencia se conserva al finalizar el turno, incluso si checkout sustituye la respuesta intermedia.

## Evidencia

- Baseline inicial: 12/12 fallaron, carrito vacío.
- Regresión final: 28/28. Pizza, bowl y ramen; compra con verbo o cantidad directa; agente simulado activo/inactivo; datos bancarios presentes/ausentes; cotización como control; elección de sabor pendiente en té. Los 24 recorridos de compra cierran con DTO simulado de exactamente dos unidades. Se verifica respuesta, carrito, ausencia de selección de pago y ausencia de creación prematura.
- Foco previo: 137/137 en tres suites. Después se amplió la matriz y se corrigió el reconocimiento de cantidad sin verbo; usar la global final como evidencia definitiva.
- Diagnóstico183 repetido: 4/8 pasan y 4/8 fallan. Antes: 2/8 pasaban. La formulación explícita de sopa independiente + ejecutivo con pregunta de pago ya pasa con agente simulado activo/inactivo. **El mensaje largo real aún falla**, igual que su versión sin pregunta de pago. No declarar resuelto todo ese chat.
- TypeScript general y build finales sin errores. Node: 92/92.
- La primera global se interrumpió al descubrir el fallo de cantidad sin verbo; no cuenta como validación. Global final: **18.401/18.401 pruebas, 254 suites, 554 hashes**, 694,26 s. Inventario exacto y fuente sin cambios.
- Artefactos: `/tmp/ppp-186-baseline.log`, `/tmp/ppp-186-focus.json`, `/tmp/ppp-186-final-recheck.json`, `/tmp/ppp-186-tsc-final.log`, `/tmp/ppp-186-tsc-build-final.log`, `/tmp/ppp-186-node.log`, `/tmp/ppp-186-global-summary.json`.

## Límites y siguiente trabajo

Modelos, persistencia, mapas y órdenes simulados. Cero API pagada, Meta y órdenes externas. El diagnóstico advierte que classifyMessage no existe en un mock: no extrapolar estos resultados a inferencia real.

Siguiente causa: separar la sopa independiente de la sopa como opción del ejecutivo en el mensaje largo. Conservar bebida y presa; tratar «en vez de ensalada más papa o yuca» como sustitución por aclarar, no como varias compras. Después comprobar Villa Galante, apartamento y entrada, total con domicilio y cancelación. Mantener los cuatro diagnósticos rojos visibles fuera de la suite verde; no debilitarlos para aumentar conteos.

Pistas de lectura para la próxima tanda (hipótesis, no causas acreditadas): `dropOptionsSoldAsSeparateProducts` reconoce «y una …»/«aparte …» al conservar productos que también son opciones del ejecutivo; verificar el caso inverso donde la sopa independiente aparece antes del ejecutivo. Revisar también `segmentContinuesMenuDish` y el alcance del atributo al segmentar saltos de línea. No corregir estas funciones durante una global en curso.
