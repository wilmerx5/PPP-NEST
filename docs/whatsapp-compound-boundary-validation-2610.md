# Tanda 206 — identidad del plato compuesto junto a una bebida aparte

Base `f69eebb7`, staging, 26/10/2026. Validación gratuita con dependencias simuladas; sin API pagada, Meta, órdenes externas ni despliegue. Main preservada.

## Reproducción y causa

Matriz nueva: arroz especial con medio pollo, bowl de quinoa con tofu y pasta con champiñones; agente mock activo/inactivo, dos unidades, con/sin preparación, separador `y` o salto de línea, y plato sin bebida como control. Antes: 18 correctos / 6 fallidos. En los seis fallos el arroz compuesto se sustituía por medio pollo independiente, conservando la bebida. Los segmentos aún contenían el título completo; también fallaba sin preparación, cuando la heurística de separación de arroz devolvía false. Por tanto no bastaba modificar el splitter.

Se prioriza un título completo y único del catálogo en la lista de candidatos y en la resolución final por segmento. El alcance está acotado a una bebida con volumen explícito pedida aparte/adicional/extra. No se usan nombres, precios o IDs de restaurantes en la regla. Un componente vendido también por separado no debe sustituir al plato completo. No acredita títulos abreviados, bebidas sin volumen ni oferta implícita de combo.

## Pruebas y límites

`whatsapp-compound-boundary.spec.ts`: 24 recorridos con respuesta, carrito, cantidades, preparación, estado sin elección pendiente y cierre hasta DTO simulado. Los DTO comprueban unidades por producto y sabor de bebida. 24/24 aprobados. Foco final de 64 pruebas (matriz, imágenes y continuación Falafel) aprobado; 702 casos filtrados no cuentan como ejecutados. Un foco exploratorio anterior de 685 pruebas pasó, pero hubo una edición posterior: la global final será la evidencia de esa fuente.

Diagnóstico205 repetido: **18 correctos / 12 fallidos**, antes16/14. Los dos fallos de bebida aparte quedan corregidos; las doce ofertas implícitas siguen pendientes. No afirmar que su aceptación/cierre esté validada.

Controles adicionales de comprar explícitamente plato compuesto + componente independiente + bebida: **10 correctos / 2 fallidos**. Permanecen opt-in en `whatsapp-compound-extra-component.repro.ts`. Los dos fallos (arroz, compuesto primero) se comprobaron también contra HEAD anterior: antes faltaba el compuesto, ahora falta el componente extra. No son casos aprobados ni se ocultan cambiando la expectativa. Corregir la conservación de ambas compras en la siguiente tanda, en ambos órdenes de mención.

TS general/build y Node92 aprobados. Global final aprobada: **18.816 pruebas / 271 suites**, 579 archivos con hash sin cambios, inventario exacto, 753,90 segundos. Evidencia `/tmp/ppp-206-approved-global-summary.json`. Los 12 fallos de ofertas y 2 de compra triple quedan fuera del inventario aprobado y documentados arriba.

## Evidencia reproducible

- Baseline24: `/tmp/ppp-206-boundary.json` (18/6).
- Primera corrección de candidatos insuficiente: `/tmp/ppp-206-fixed.json` (18/6).
- Resolución por segmento: `/tmp/ppp-206-fixed2.json` (24/0).
- Ampliación36: `/tmp/ppp-206-promoted.json` (34/2; incluye24cierres y12controles adicionales).
- Baseline de los dos controles adicionales: `/tmp/ppp-206-independent-baseline.json` (0/2).
- Foco final: `/tmp/ppp-206-final-focus.json` (64/0).
- Ofertas205: `/tmp/ppp-206-offers.json` (18/12).

Los diagnósticos `.repro.ts` se ejecutan opt-in con `npx jest --runInBand --testRegex='<nombre>.repro.ts$'`; no forman parte del inventario aprobado. Los snapshots son sintéticos. No inferir ahorro de API ni preparación comercial a partir de los conteos.
