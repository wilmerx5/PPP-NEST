# Tanda 207 — plato compuesto y componente adicional

Base `ae7f6506`, staging, 26/10/2026. Sin llamadas pagadas, Meta, órdenes externas ni despliegue. Modelos/configuración sin cambios; los dos modos de agente son mocks.

## Causa reproducida

La matriz opt-in206 tenía12 casos:10correctos/2fallidos. El catálogo recibía «un medio pollo» al probarse directamente y resolvía los tres productos, pero el router aplica el glosario, que normaliza esa frase a «medio pollo». Una protección contra componentes duplicados reconocía «y un…» pero no «y medio…», descartando una compra independiente. Además, la asignación del fragmento de texto al producto no reconocía ese límite y podía mezclar el extra con el plato compuesto.

Se admiten medio/media/cuarto/cuarta como inicio de una compra independiente después de una coordinación. Al dividir se conserva la palabra de fracción, porque puede pertenecer al título del catálogo. No cambia el glosario ni añade nombres/IDs/precios de restaurantes en runtime.

La primera modificación aún daba10/12: consumía «medio» al separar y perdía el token distintivo. La versión corregida conserva ese token y da12/12. No confundir el análisis directo del catálogo con el recorrido completo del router.

## Cobertura aprobada focalizada

El diagnóstico206 se promueve y amplía a `whatsapp-compound-extra-component.spec.ts`, sin duplicado `.repro.ts`:

- 24 conversaciones: tres menús (arroz/medio pollo, bowl/tofu, pasta/champiñones), agente mock off/on, compuesto primero o extra primero, cantidades1/1 o2/3. Verifican respuesta, carrito, preparación, bebida, notas separadas, estado sin elección pendiente y cierre hasta DTO simulado. DTO contiene una entrada por unidad y conserva opciones/notas.
- 6 controles de fracciones sin artículo en otros menús: medio aguacate, media arepa y cuarto de torta, ambos modos. Verifican respuesta/carrito/estado; no se acredita cierre DTO para estos seis.

La matriz inicial30/30 pasó. Tras la regresión de medidas se añaden8 controles, para38 pruebas nuevas. Suite206de bebida aparte24/24; guardas de imágenes/combos685/685; continuación Falafel1/1 (696filtradas no cuentan). TS general/build yNode92 aprobados. Global FINAL aprobada: **18.854 pruebas / 272 suites**,579hashes sin cambios,719,42s e inventario exacto. Evidencia `/tmp/ppp-207-final-global-summary.json`. La primera global interrumpida no se usa como aprobación.

## Regresión detectada y reparación

La primera global se detuvo al detectar un fallo en `whatsapp-agent.language.spec.ts`: «1 Coca Cola de litro y medio Zero». No acredita una global aprobada. El nuevo límite fraccionario separaba una medida como otro producto. Se protege la unidad previa y se recompone la cola fraccionaria que el separador anterior ya podía cortar, salvo que nombre otro producto del catálogo. No sustituir ni omitir el test existente.

Se añadieron6 controles de medidas (incluye espacios múltiples, litros, kilos, libras) y2 de compra independiente después de un producto vendido por litro. Reparación:121/121 (36de esta matriz,24de206 y61de lenguaje), más los2controles nuevos aprobados por separado. Los38casos quedan aprobados también dentro de la global final. Solo24casos acreditan DTO; el resto son controles de router/catálogo.

## Límites y continuación

Los dos fallos adicionales206 quedan corregidos. Permanecen los doce fallos de oferta implícita del diagnóstico205 (última medición206:18/30). Esta tanda no cambia ni vuelve a acreditar esa oferta. No declarar que todas las combinaciones de extras, abreviaturas o menús estén cubiertas.

Siguiente bloque: oferta genérica por catálogo de una versión que incluya la bebida solicitada, sin convertir porción en plato completo ni comprar el combo antes de aceptación. Comprobar precio/contenido, aceptación y negativa, cantidades/notas, dos alternativas, agotado/precio cambiado y volumen diferente. Mantener preguntas sin compra y preservar carrito previo. Reutilizar el estado de propuesta/reemplazo existente; no abrir otra selección huérfana. La ruta `tryAnswerComboSwapOffer` exige `replacement.originalLine` presente en el carrito: no fabricar esa referencia sin conservar primero una compra explícita del plato base. La oferta de consulta actual corta el nombre antes de «con» para buscar familia; para una solicitud compuesta, priorizar identidad/contenido completo para no ofrecer costillas cuando se pidió medio pollo. Verificar evidencia de bebida en descripción/opciones sin afirmar que cualquier bebida sea gaseosa. Estas son observaciones de código para la siguiente tanda, no cambios implementados aquí.

## Evidencia

- `/tmp/ppp-207-baseline.json`:10/12; snapshots de interpretación y carrito.
- `/tmp/ppp-207-fixed.json`:10/12 (primer intento insuficiente).
- `/tmp/ppp-207-fixed2.json`:12/12.
- `/tmp/ppp-207-focus.json`:48/48 (matriz inicial24 y controles20624).
- `/tmp/ppp-207-expanded.json`:30/30.
- `/tmp/ppp-207-guards.json`:685/685.
- `/tmp/ppp-207-falafel.json`:1/1.
- `/tmp/ppp-207-approved-rest.log`: primera global interrumpida con regresión de medida; no usar como aprobación.
- `/tmp/ppp-207-repair.json`:117/121; cuatro medidas antes cortadas detectadas por nuevos controles.
- `/tmp/ppp-207-final-repair.json`:121/121.
- `/tmp/ppp-207-measurement-guards.json`: controles de producto independiente tras unidad.

Las cifras son pruebas con servicios simulados, no medición de calidad/costo en producción ni aceptación comercial. Main preservada.
