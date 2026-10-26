# Tanda 204 — identidad del combo antes de separar componentes

Base `2543a55d`, staging, 26/10/2026.

## Reproducción y causa

El diagnóstico 197 conservaba 12 casos: 4 correctos y 8 fallidos. El pedido «Quiero dos combos arroz chino con medio pollo frito y gaseosa 7 up» terminaba con arroz y medio pollo separados, sin bebida. La normalización numérica ya evitaba siete unidades, pero no resolvía la identidad compuesta.

La prueba inicial confirma 4/12 correctos (`/tmp/ppp-204-before.json`). Un intento de admitir plural solamente en `compoundVocabulary` no cambió el resultado (4/12); se retiró. La corrección aprovecha el selector existente `explicitlyNamedCombo` antes del separador múltiple, dentro de la ruta de plato compuesto, exclusivamente con carrito vacío y la presentación plural «combos». Su identidad requiere un título completo, único y disponible; no se añaden nombres ni IDs del restaurante al runtime.

Se conservan las barreras de preguntas, selecciones pendientes, división por unidades y compras adicionales explícitas. Los tamaños explícitos de bebida siguen por la ruta anterior que verifica volumen; el nuevo selector temprano solo opera sin tamaño explícito.

## Resultado y cobertura

El diagnóstico original pasa a 8/12: se corrigen los cuatro plurales explícitos (dos formas de escribir 7up × agente mock activo/inactivo). Persisten los cuatro casos sin la palabra combo; no se acreditan como corregidos.

Nueva suite: 16 casos. Doce conversaciones con tres menús (arroz/pollo, bowl/tofu, pasta/champiñones), cantidades 1/2 y agente mock activo/inactivo. Verifican respuesta, estado, carrito, opciones y cierre DTO simulado con una entrada por unidad. Cuatro reproducciones PPP verifican combo plural, preparación Frito y bebida 7up sin extras. Los casos explícitos se retiran del repro; este conserva únicamente los cuatro diagnósticos implícitos pendientes, fuera del inventario aprobado.

Foco: 705/705 en seis suites. Incluye ofertas de combo, notas, cantidad explícita, bebidas separadas y cierre con extras. TypeScript general/build y Node 92/92 aprobados. Evidencia `/tmp/ppp-204-focus.json` y `/tmp/ppp-204-node.log`.

Primera global interrumpida al detectar una regresión: «Deja solo un Combo De Falafel, el hummus queda igual» añadía otra línea. Se restringió el selector temprano a carrito vacío; las correcciones y compras con carrito existente conservan su ruta anterior. Esta primera ejecución no acredita aprobación global. La segunda global completó con seis fallos en contratos de validación de acompañamientos de combos singulares (texto/foto). Se limitó la nueva prioridad al plural «combos», conservando la ruta singular anterior. Validación final: 18.792/18.792 pruebas en 270 suites, 576 hashes, 694,86 segundos, inventario exacto y fuente congelada. Evidencia `/tmp/ppp-204-approved-global-summary.json`. Ninguna de las dos ejecuciones previas se considera aprobada. Foco de reparación final: 61/61 (incluidas imágenes y matriz nueva); TS general/build repetidos y aprobados.

## Límites y siguiente tanda

El agente está simulado: no prueba precisión del modelo real. No hay llamadas pagadas, Meta ni órdenes externas. No cambia costo/modelo/configuración ni se despliega. Main intacta.

La próxima tanda debe definir y verificar la oferta contextual cuando se pide «arroz con medio pollo y bebida» sin nombrar combo: no asumir automáticamente que cualquier combinación corresponde al combo más caro. Probar alternativas únicas/múltiples, negativa a la oferta, componentes aparte, tamaños de bebida distintos y conservación de cantidad/notas hasta DTO. Mantener los otros pendientes históricos y la medición de costo por orden/modalidad.

No declarar piloto o venta por el número de pruebas aprobadas.

## Evitar repetir cuellos de validación

Para cambios de prioridad en el router, incluir desde el foco inicial `whatsapp-image-caption-order.spec.ts` y el recorrido Falafel de `whatsapp-general-accuracy-part-04.spec.ts`, además de matrices de compra: una regla de identidad puede adelantar una compra sobre una corrección o validación existente. Ejecutar primero estos límites, luego la global con fuente congelada; no reemplazar la global por un conteo grande de variantes del caso feliz.
