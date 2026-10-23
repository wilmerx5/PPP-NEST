# Tanda142 — sabores de bebidas y estado del plan

Base: 510ef1a1, rama staging. No se modifica Main ni producción.

## Fallo y corrección

La tanda141 dejó reproducido un sabor aplicado sin elección en una malteada. Se amplió la misma conversación a malteada, batido y smoothie:18 fallos/18 aprobados antes de corregir. Tras elegir Base2, la primera opción de Sabor se aplicaba automáticamente porque el producto no se reconocía como bebida.

La corrección final amplía únicamente requiresExplicitAttributeChoice por categoría y por inicio del nombre a esas familias. isLikelyDrinkProduct conserva su comportamiento previo. Una comida «con malteada/batido/smoothie» no se convierte en bebida por esa mención. Para nombres comerciales desconocidos se mantiene la vía de metadatos de categoría: no se pretende inferir cualquier producto por su nombre ni se agregan IDs/precios de PPP.

## Cobertura

18 recorridos nuevos de dos atributos, con agente simulado on/off e interrupción de precio/nombre/número inválido, conservan pendiente hasta elegir sabor y terminan en una unidad y DTO exactos. Se añaden seis controles: tres categorías con nombre comercial genérico y tres platos con bebida mencionada. Los18 recorridos de141 se mantienen. Foco conjunto102/102,13,42s; TypeScript general/build OK; scripts Node92/92. Evidencia /tmp/ppp-142-baseline.log, /tmp/ppp-142-focus.log, /tmp/ppp-142-tsc.log, /tmp/ppp-142-node.log. Primera global interrumpida al detectar regresión en cancelación: ampliar isLikelyDrinkProduct hacía que un sabor enviado tras cancelar añadiera una bebida en la familia Tarta De Espinaca. Evidencia /tmp/ppp-142-rest.log; no se acredita esa ejecución como aprobada. Se redujo el alcance a requiresExplicitAttributeChoice. Foco adicional90/90 seleccionados (497 omitidos por filtro explícito), /tmp/ppp-142-scoped.log,16,718s; TypeScript final OK en /tmp/ppp-142-final-tsc.log. Segunda global terminó:205suites,17.026 aprobados y2 fallos de expectativa antigua en whatsapp-bare-quantity-after-quote.spec.ts. Esa prueba suponía malteada con sabor por defecto. Se actualizó solo el test para exigir cantidad2 pendiente y elección explícita, verificando las dos unidades después. Revalidación completa de esa suite60/60,7,324s. Inventario exacto, runtime sin cambios; solo cambió el test indicado entre global y revalidación. Cobertura final17.028 sin sumar ejecuciones repetidas. /tmp/ppp-142-validation-summary.json; no afirmar una única global verde. No desplegado; publicar staging y agrupar rebuild con siguiente tanda.

## Dónde vamos

Las tandas138–142 han cubierto consulta de precio con opción pendiente, datos anticipados, elección y consulta en un turno, condiciones de costo, recuperación de número inválido y dos atributos sucesivos. Son regresiones del router con dependencias simuladas; no una tasa comercial de comprensión.

Siguiente bloque: condición más acción independiente, con conservación de la acción condicionada. Después revisar reparto y corrección de unidades ya divididas, catálogo cambiado durante selección y datos/elección en lenguaje natural, evitando repetir matrices solo con nombres distintos.

La validación con modelo real es un pendiente separado y prioritario: seis conversaciones nuevas, presupuesto registrado, servicios externos simulados, detener ante fallo crítico, medir costo y latencia. Seguir whatsapp-api-validation-next-2310.md; no convertir casos usados para corregir en muestra reservada. No hay gasto de API en142.

Para piloto supervisado siguen siendo necesarios recorridos nuevos sin pérdida de cantidades/datos ni confirmaciones falsas, evidencia de audio/visión y direcciones con servicios reales, y revisión de configuración desplegada. No se puede asignar un porcentaje fiable ni declarar vendible por volumen de pruebas.
