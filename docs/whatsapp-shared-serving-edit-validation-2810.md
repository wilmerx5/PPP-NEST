# Tanda 240 — edición de una unidad tras reparto (28/10)

Base publicada `323f6143`, rama `staging`; continúa la corrección local239, conservada. La referencia remota se trajo antes de editar: HEAD y origin/staging sin divergencia.

## Fallo reproducido y cambio

El diagnóstico original tiene18casos:12verdes y6rojos. «A la primera [plato] quítale el [acompañamiento]» no retiraba la nota de esa unidad. Las consultas de precio/contenido ya conservaban el carrito.

El router reconoce la retirada de una nota positiva ya guardada cuando coinciden el ordinal absoluto de la fila, el nombre completo normalizado del plato y una sola unidad. Retira únicamente la cláusula completa «con [cantidad/intensidad] [acompañamiento]». Conserva la nota común, la otra fila, cantidades, atributos, datos y paso de checkout. La respuesta identifica que se retiró una nota; no promete cambiar una receta ni disponibilidad de cocina.

Ante nombre/posición discordantes, varias unidades en la fila, selección pendiente, enlace de pago o cláusula ausente/compuesta, aclara sin mutar. Repetir la retirada no borra otras notas. Consultas no entran a esta mutación. Las exclusiones «sin…» y los ingredientes no expresados en una nota positiva quedan fuera de este manejador.

## Verificación focal

-90casos aprobados:18originales promovidos sin cambiar sus expectativas,12recorridos de primera/segunda unidad con repetición y DTO,12de dirección/confirmación final y48controles negativos; tres menús sintéticos×agente simulado off/on.
-580pruebas aprobadas en10suites vecinas, incluidas44del reparto239 y9del parser. Son conjuntos disjuntos respecto de los90nuevos; no sumar ejecuciones repetidas.
-La primera ampliación de las pruebas tenía un campo de fixture incorrecto (deliveryAddress). Se corrigió a address, conforme al contrato;90/90en la ejecución final. Runtime sin cambios por ese ajuste.
-TypeScript general y tipado de build finales aprobados. Los contratos Node del entorno reanudado aprueban7/7 pruebas (siete archivos); no se atribuye aquí el conteo histórico92.

## Validación global final

La global iniciada antes de la interrupción no dejó un cierre recuperable en el entorno reanudado; se excluye del resultado. Se repitió con fuente congelada:20.099/20.099 pruebas en308suites con dos workers y, después,80/80 en la suite aislada de ráfagas. Total20.179/20.179 en309suites, sin fallos, omisiones ni duplicados respecto de Jest --listTests. No es una única invocación Jest: son dos fases disjuntas, sin solapamiento ni reintentos.

Duración de Jest:1096,497s+128,385s. Se comprobaron hashes de src/, scripts/, workflows, package.json y ambos tsconfig; fuente intacta. Evidencia durable: `docs/whatsapp-batch-240-validation.json`. Esta validación incluye las correcciones locales239–240; no reescribe la global histórica239 fallida por timeout.

Publicación pendiente: el fetch reanudado falló por DNS de GitHub. HEAD y la última referencia local origin/staging coinciden, sin acreditar estado remoto nuevo. No se desplegó.

## Límites y continuidad

La referencia usa la posición absoluta del carrito y el nombre completo, no ordinales relativos a un subconjunto ni anáforas. Se admite una sola unidad por fila. No cubre todas las formas de editar recetas, opciones o notas compuestas. La corrección239 sigue limitada a dos unidades y a su gramática documentada; productos con atributos conservan sus resolutores anteriores.

Siguiente: reparto con opciones de catálogo y consultas combinadas, más los pendientes históricos (cambio de preparación sin añadir, 7 up y saludo/destino). No afirmar que todos los chats o PDF estén corregidos ni que los conteos acrediten preparación comercial.

Sin inferencia real, Meta, mapas, órdenes externas o despliegue. Estado del servidor tomado del relevo: staging231; producción235. No se consultó servidor en esta tanda.
