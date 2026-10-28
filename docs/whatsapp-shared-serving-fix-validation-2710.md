# Tanda 239 — reparto estructurado de dos unidades

Base `323f6143`, staging. Continúa el diagnóstico238 (6/32 correctos).

## Cambio

`twoUnitServingPlan` separa total, sujeto, nota común, dos notas individuales y una porción adicional explícita. El orquestador resuelve el producto contra el catálogo y prepara todas las líneas en una copia de la sesión; guarda una sola vez si el reparto completo es válido. Las notas no vuelven a pasar por el separador de productos.

La nota común (temperatura o preparación reconocida) se une a cada nota individual. El acompañamiento de una unidad no se cobra como producto independiente por compartir palabras con el catálogo. La compra «una porción adicional de…» sí queda separada. Un total distinto de dos, extra no disponible o pendiente incompatible pide aclaración sin guardar líneas parciales. Se conserva el paso de checkout actual.

No hay nombres/IDs/precios PPP en producción. El parser se limita a esta construcción de dos unidades; productos con atributos siguen en sus rutas anteriores. No cubre reparto arbitrario, consultas combinadas ni varias compras extra. Temperatura/acompañamiento son solicitudes, no garantías de cocina.

## Evidencia focal

- Los32casos238 pasan; promovidos sin duplicar a `whatsapp-shared-serving-distribution.spec.ts`.
-12controles adicionales de total incoherente o extra agotado, tres menús y agente simulado off/on: carrito previo y estado de pago intactos.
-9controles de parser: separación de campos y límites ante consultas, dirección, confirmación y múltiples extras.
-30conversaciones sintéticas llegan hasta DTO; los2casos originales comprueban respuesta/carrito/notas. No extrapolar DTO de los sintéticos a esos2replays.
-Suite principal44/44. Compatibilidad:208pruebas existentes de variantes, notas/opciones y acompañamientos; parser final9/9. Total focal261sin duplicados.
-Primer intento de la suite ampliada falló al compilar un fixture sin `code`; corregido el fixture, sin cambiar expectativas ni runtime.
-TypeScript general/build y Node92 aprobados. Sin inferencia real, Meta, mapas ni órdenes externas.

## Global

Evidencia durable: `docs/whatsapp-batch-239-validation.json`, con resultados disjuntos y hashes de la fuente239.

Terminó con la fuente congelada: los snapshots `/tmp/ppp-239-source-before.json` y `/tmp/ppp-239-source-after.json` coinciden. El inventario registra 308 suites. En los dos grupos disjuntos, el resto a cuatro workers obtuvo 20.008/20.009 pruebas y 306/307 suites aprobadas (`/tmp/ppp-239-rest.json`); `whatsapp-general-accuracy.spec.ts` aislada aprobó 80/80 (`/tmp/ppp-239-burst.json`). **No fue una global verde**: la prueba de encolado de burbujas en `whatsapp-webhook.controller.spec.ts` excedió su timeout de 5 s bajo carga. Reejecutada la suite del webhook aislada con timeout sin modificar: 7/7 pruebas aprobadas, ~10,7 s. No se elevó el timeout ni se atribuye aún la causa del fallo bajo carga. Resultado combinado: 20.088/20.089; no declarar 20.089 aprobadas en una única global.

## Siguiente

Interrupciones de consulta de precio/contenido mientras se reparte, cambios posteriores sobre una sola unidad y combinación con opciones de catálogo. Mantener controles de extras explícitos, totales inconsistentes y disponibilidad. No alterar Main; servidor staging sigue231 hasta un despliegue agrupado posterior.
