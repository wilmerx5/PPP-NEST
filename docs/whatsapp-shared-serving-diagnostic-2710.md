# Tanda 238 — distribución con notas compartidas y acompañamientos

Base `9e9e5868`, staging. Diagnóstico gratuito con router real y dependencias externas simuladas. Sin cambios al runtime, modelos, Main o despliegue.

## Resultado

32 casos nuevos opt-in:30 recorridos en tres menús (sopa de lentejas, bowl de vegetales, pasta primavera) × agente simulado off/on × cinco situaciones, más dos reproducciones del chat de sopas. **6 pasan y26 fallan**. Los seis verdes completan pago y confirmación hasta DTO; los fallidos se detienen en la primera aserción incumplida, por lo que no acreditan cierre.

- Notas distintas sin nota compartida:6/6, cantidades1+1, propiedad de notas, respuesta y DTO correctos.
- Nota compartida antes del reparto:0/6; «bien caliente»/«bien empacado» desaparece aunque las dos notas individuales se conserven.
- Segundo acompañamiento elíptico («la otra arepa»):0/6; no quedan dos líneas con sus notas propias.
- Reparto más una porción adicional explícita:0/6; se pierde la nota común y en algunos menús también la nota de la segunda unidad. No basta con comprobar que se cobró el extra.
- Pedido nuevo durante pago con carrito previo:0/6 por pérdida de nota compartida; todavía no afirmar fallo de la guía de pago ni del DTO, porque la aserción anterior detiene esos recorridos.
- Chat original «dos sopas grandes de menudencias bien caliente una con porción de arroz y la otra arepita»:0/2. Observado:dos sopas agrupadas sin la nota compartida, un arroz independiente cobrado y rechazo de arepita.

Evidencia durable anonimizada: `whatsapp-shared-serving-diagnostic-2710.json`, con respuestas/carrito y primera aserción fallida por caso. No cuenta dentro de la suite aprobada. Ejecutar:

```sh
npx jest --runInBand --testRegex 'whatsapp-shared-serving-distribution.repro.ts$' --silent
```

TypeScript general aprobado. No se repite global por añadir únicamente diagnóstico/docs. Última validación consolidada237:20.036/306, con límites y timeouts históricos documentados.

## Causa localizada y siguiente implementación

`expandSpokenSameSkuNotes` en `whatsapp-distributed-variants.ts` reconoce solo ciertas formas «con harto/sin…» y reescribe cada unidad usando nombre del producto más la nota local; no transporta la nota compartida del sujeto. `resolveMultiProductOrderCore` vuelve a segmentar ese texto. El mensaje con extra muestra que no basta con extender una regex o pegar la nota al final del texto reescrito.

Implementar un plan estructurado para distribución explícita: producto, total declarado, unidades, nota compartida, notas/opciones particulares y compras adicionales. Conservar el alcance hasta las líneas del carrito; la suma del reparto debe coincidir con el total antes de guardar. No convertir un acompañamiento en producto cobrado por coincidir con el catálogo; tampoco descartar «porción adicional» explícita.

Resolver candidatos por catálogo, no por vocabulario de PPP. Si una cláusula puede ser otro producto o falta una unidad, aclarar sin guardar un reparto parcial. Temperatura y preparación son solicitudes a cocina, no promesas de disponibilidad. Mantener los controles existentes de atributos y variantes.

Después de la corrección: promover únicamente casos realmente verdes a spec, completar DTO para los30recorridos y ampliar con consultas de precio, cambios durante dirección, nota posterior para una sola unidad, totales inconsistentes, opciones incompatibles y productos agotados. Reejecutar el chat original y los controles de extras, luego TS/Node y global con fuente congelada. Conservar los fallos de partida; no cambiar expectativas solo para lograr verde.
