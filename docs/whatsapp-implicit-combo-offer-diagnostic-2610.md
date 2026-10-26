# Tanda 205 — diagnóstico de ofertas de combos implícitos

Base `88385bbc`, staging, 26/10/2026. Sin cambio de runtime, configuración ni despliegue. Cero API pagada, Meta u órdenes externas.

## Contrato que se está midiendo

El usuario pidió buscar una variante que incluya bebida y ofrecerla antes de tratar la bebida como producto aparte. La matriz histórica 197 exigía compra automática del combo: sus cuatro rojos restantes NO son por sí solos el criterio de aceptación correcto. Se conserva ese archivo como evidencia histórica, con advertencia; la nueva matriz distingue oferta y compra explícita.

Para una solicitud implícita con título completo de plato compuesto, preparación, bebida y nota: mencionar la combinación disponible y pedir elección; no comprar el combo sin aceptación ni añadir por separado un componente incluido en el título. Puede conservar el plato base ya solicitado, pero no la bebida independiente mientras ofrece el combo. Tras «sí, el combo»: una línea correcta, cantidad y opciones conservadas; cerrar hasta DTO simulado. Ese tramo posterior aún no queda acreditado cuando falla la oferta inicial.

## Matriz y resultado final

`src/whatsapp/whatsapp-implicit-combo-offer.repro.ts`: 30 casos opt-in, tres menús sintéticos (arroz con medio pollo, bowl con tofu, pasta con champiñones), agente mock activo/inactivo.

- Ofrecer primero, cantidades 1/2: 12 fallos. En arroz se separa el medio pollo; en bowl/pasta se añade el plato base pero se omite la bebida/oferta. No se llegó a validar aceptación ni cierre en estos casos porque falla la primera aserción relevante.
- Combo explícito: 6 correctos, con seis cierres DTO simulados de dos unidades cada uno. Conservan bebida y nota en carrito; DTO verifica identidad y bebida.
- Bebida expresamente aparte: 4 correctos (bowl/pasta), 2 fallos (arroz: agrega medio pollo y gaseosa, pierde el plato compuesto).
- Combo no disponible: 6 correctos, con `ignoreBusinessHours=false`. Solo acredita no añadir/no dejar como candidato ese combo, no toda la respuesta o compra alternativa.

Total final: **16 correctos / 14 fallidos**, 30 únicos. No sumar intentos previos ni presentar la matriz como aprobada. Evidencia `/tmp/ppp-205-final.json`; snapshots sintéticos `/tmp/ppp-205-{rice,bowl,pasta}-{false,true}-*.json`. Las trazas incluyen carrito, respuesta, estado y selecciones pendientes, no datos de clientes.

## Error del ensayo corregido

La primera ejecución dio 12 correctos / 18 fallidos. Cuatro aparentes compras de agotados eran un error del fixture: el harness activa `ignoreBusinessHours=true`, y el router convierte `availableNow` a true con ese ajuste. Una traza de `handleProductWithVariants` mostró el producto ya disponible. No demuestra que producción venda un agotado.

Se probó un filtro en `hostedMenuDrink`, sin mejora; fue retirado. La configuración de disponibilidad del fixture fue corregida y se repitieron los 30 casos. No quedó parche experimental de runtime.

## Rutas a revisar y plan concreto

1. **Identidad compuesta antes de separar.** `resolveMultiProductOrder` y sus extractores deben reconocer el título completo del plato base antes de convertir «medio pollo» en otra compra. Mantener preguntas, negaciones y extras explícitos fuera de una compra automática. Reproducir primero los dos rojos de bebida aparte: no dependen de política de ofertas.
2. **Oferta genérica por catálogo.** La ruta `tryPreferChickenComboForFoodDrink` es específica de pollo/estilo y excluye medio/cuarto; no generalizarla borrando esas barreras, pues podría convertir medio pollo suelto en un combo entero. Resolver plato base, candidatos que realmente lo incluyan y bebida compatible; precios y contenidos del catálogo.
3. **Reutilizar estado existente con cuidado.** La oferta de `tryAnswerComboSwapOffer` y la consulta de bebida ya conservan `replacement.originalLine`, cantidad/notas y un `preferredId`. Cubrir propuesta desde carrito vacío sin fingir que ya hubo una compra o crear una línea huérfana.
4. **Contrato de continuación.** «Sí» conserva preparación/bebida/nota; «no, aparte» compra plato base + bebida una sola vez; consulta de precio no modifica; dos alternativas exigen elección; agotado/cambio de precio tras oferta se revalida; volumen distinto no se absorbe sin explicación.
5. **Foco temprano obligatorio para este cambio de prioridad:** nuevos diagnósticos, `whatsapp-related-combo-offer.spec.ts`, `whatsapp-combo-drink-absorption.spec.ts`, `whatsapp-image-caption-order.spec.ts`, recorrido Falafel en general-accuracy-part-04 y matriz explícita204. Luego TS general/build, Node y global congelada si se modifica runtime.

No mover los 14 rojos al inventario normal hasta corregirlos. Promover cada familia sin duplicar repro/spec cuando pase. TypeScript general final aprobado. La última global runtime vigente sigue siendo la tanda204: 18.792/270, no se repite por este diagnóstico sin cambios ejecutables. Main intacta, sin despliegue. Continúan pendientes de costo por modalidad/orden y los históricos; no declarar vendible por conteos.
