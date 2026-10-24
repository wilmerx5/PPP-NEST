# Tanda 171 — reclamo, contacto y consulta en el mismo turno

Base: `8b1617da`, rama `staging`. Main intacta. Sin llamadas pagadas, Meta ni órdenes externas.

## Fallo reproducido

54 recorridos iniciales fallaron: «No me entendiste, mi nombre es Ana Torres; ¿cuánto cuesta [producto]?» y equivalentes de teléfono/dirección respondían precio pero no conservaban el dato. No se trata de calidad de transcripción: entrada textual y dependencias simuladas.

La separación existente de consulta y edición de contacto estaba limitada a pago/confirmación, contenido/tiempo y ciertas etiquetas. El preámbulo de reclamo se procesaba después de esa separación. Ahora se normaliza antes, se admiten etiquetas explícitas de contacto y precio, y se reutilizan los manejadores de contacto en pasos anteriores y selección pendiente. El separador no escribe datos por su cuenta. No hay nombres/IDs/precios de restaurante en runtime.

## Matriz y oráculos

162 recorridos nuevos: tres menús sintéticos (bowl, pizza, ramen) × agente simulado activo/inactivo × nombre/pago/sabor pendiente × nombre/teléfono/dirección × precio después/contenido después/precio antes del dato. Datos de cliente sintéticos. Carrito inicial sembrado con dos unidades y nota; selección de bebida abierta mediante mensaje real al router.

Cada recorrido verifica respuesta factual, ausencia de rechazo de nombre, carrito intacto, selección pendiente intacta, contacto actualizado y ausencia de creación prematura. Luego completa sabor/nombre si falta, pago y confirmación. Comprueba DTO simulado con dos unidades originales, notas conservadas, dos bebidas con sabor/nota si correspondían, nombre, teléfono y dirección exactos. No basta con una respuesta que diga «actualizado».

Baseline: /tmp/ppp-171-baseline.log, 54 fallos. Primera corrección: /tmp/ppp-171-focus.log,126/126. Ampliación: /tmp/ppp-171-focus-final.log,342/342 en29,145s (162 nuevos +72 tanda170 +108 tanda169).

## Límites y siguientes pasos

El proveedor responde con mock genérico sin acciones; no acredita precisión real del modelo. Mapa, disponibilidad y creación de orden simulados. No acredita geocodificación real de conjuntos. Preguntas explícitas con puntuación y producto identificado; no lenguaje libre arbitrario, referencias ambiguas, múltiples consultas ni dato mezclado sin separadores. Hay un producto en carrito y otra bebida pendiente, no múltiples líneas del mismo SKU.

Siguiente: dato de contacto con varias preguntas, dato sin separador, reclamo de tarifa con cambio de dirección y conservación de referencias internas; recuperar una pregunta histórica identificable sin inventar respuesta. Revalidar con inferencia focalizada antes de atribuir resultados al modelo. No declarar vendible por conteos.

## Cierre verificado

TypeScript general y build OK (`/tmp/ppp-171-tsc.log`); Node92/92 (`/tmp/ppp-171-node.log`). Global18.049/18.049,240suites,538hashes,734,75s: inventario exacto y fuente congelada (`/tmp/ppp-171-global-summary.json`; burst80/rest17.969). Una sola ejecución global, dividida en ráfagas seriales y resto con cuatro trabajadores.

Publicación solo staging. Sin despliegue en esta tanda:170–171 pendientes de despliegue agrupado. Último servidor acreditado098250c8 (hasta169), healthy. Main/producción intactas. Cero gasto API. No declarar listo para venta únicamente por estos conteos.
