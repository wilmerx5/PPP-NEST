# Tanda 192 — compra con condición sobre acompañamientos

Base `63c15b5b`, staging. Investigación gratuita; no corrección de ejecución ni despliegue en esta tanda.

## Matriz reproducida

18 casos nuevos: hamburguesas, tacos y ramen; agente simulado apagado/encendido; compra simple, compra con «si tienes yuca mejor» y compra con «para que uno venga con papas y el otro con yuca». Cada catálogo incluye porciones reales de papa/yuca, de modo que una compra accidental de acompañamientos sería observable. Productos y datos ficticios.

La expectativa de compra independiente es dos platos distintos ×1 y un tercer producto ×2, sin porciones cobradas por la condición. Una condición indispensable de compra requerirá otro contrato: no ejecutar lo condicionado sin resolverlo. No generalizar esta expectativa a «solo lo compro si...» ni eliminar todas las condiciones del texto.

Resultados:

- Los seis controles sin condición pasan: carrito de cuatro unidades, respuesta correcta y estado building_cart.
- Los seis casos con condición simple fallan. Sin agente, se pierde el segundo plato y se agregan primero y tercero. Con agente simulado, se invoca una vez y devuelve cero acciones; el carrito queda vacío con aviso de que no pudo completar la condición.
- Los seis casos con reparto fallan. Sin agente, hamburguesas/ramen muestran candidatos sin añadir; tacos deja solamente el segundo plato. Con agente simulado responde «¿Cuál prefieres?» y no añade.
- Los dos replays completos de191 siguen fallando. Run combinado: 14 fallidos y 6 aprobados, 37,664 segundos.

La repetición instrumentada de la matriz confirma 12 fallidos/6 aprobados. No son 38 casos únicos: son 18 nuevos + 2 existentes, ejecutados con repetición para obtener trazas. Evidencia `/tmp/ppp-192-baseline.json`, `/tmp/ppp-192-trace.json` y `/tmp/ppp-192-{menu}-{agent}-{control|conditional|split}.json`.

## Qué está demostrado y qué no

En los 18 casos sintéticos `isAvailabilityInquiry` devuelve false y `extractCookingStyleBrowseIntent` devuelve null. `conditionalPurchaseText` reconoce el prefijo de compra en los 12 condicionados. Por tanto, NO atribuir todos los fallos a disponibilidad o búsqueda por preparación.

En el caso PPP original existe otro riesgo: `extractCookingStyleBrowseIntent` admite palabras como «tienes» dentro de una frase que también pide platos con preparación; el replay sin agente mostró catálogo broaster. La revisión del código identifica este camino candidato, pero no demuestra que sea la causa de todos los escenarios.

Con agente encendido se observa una llamada al simulador por caso condicionado. Su respuesta fija no contiene acciones. Esto demuestra el comportamiento local ante una interpretación sin acciones; NO mide capacidad, precisión o tasa de error del modelo real. Los seis errores sin agente sí reproducen pérdida de compra en el camino determinista sin depender de una respuesta semántica real.

Las aserciones detienen el caso al primer fallo: no afirmar comprobados respuesta/estado/DTO de los casos rojos. Estos diagnósticos no crean órdenes. Los seis controles verifican respuesta/carrito/estado; no cierre DTO. La siguiente corrección deberá completar ese cierre.

## Plan de corrección

1. Instrumentar el segmentado del mensaje completo, no solo el prefijo anterior a «si». Identificar por separado platos, condición, alcance y productos posteriores.
2. Evitar ejecución parcial silenciosa cuando la condición deja un plato fuera; responder explícitamente qué falta aclarar. Conservar compras independientes inequívocas sin comprar acompañamientos como porciones.
3. Para dos platos y dos acompañamientos, conservar cantidades y preguntar a cuál corresponde cada uno si la referencia es ambigua; no asignar por orden visual ni aplicar ambos a todos.
4. Probar interpretación semántica válida con acciones simuladas, interpretación sin acciones y error del proveedor como contratos distintos. No declarar roto el modelo usando solo el simulador vacío.
5. Controles negativos: condición indispensable, producto/acompañamiento agotado, alternativa inexistente, consultas puras y cancelación. Conversaciones con selección previa, corrección/repetición, checkout y DTO final.
6. Después de una corrección general, foco + TS + global congelada. Mantener abiertos183/184/186 y efectivo50. No desplegar solo para publicar diagnósticos.

Ejecutar opt-in:

    npx jest --testRegex='whatsapp-(conditional-accompaniments|accompaniment-recovery)\.repro\.ts$' --runInBand

El archivo `.repro.ts` permanece fuera de la suite verde hasta corregir los comportamientos. No contar sus controles como nuevas regresiones aprobadas. Runtime sin cambios; última global válida191:18.524/259. Cero API/Meta/órdenes externas; Main/producción intactas.

Cierre: TypeScript general y build aprobados. Los560 archivos de la global191 conservan sus hashes; solo se añade el diagnóstico nuevo y documentación. No se repite global sin cambio de ejecución. Publicado únicamente en rama staging.
