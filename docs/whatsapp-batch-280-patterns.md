# Tanda 280: matriz amplia de conversación y conservación del pedido

## Procedencia

- PDF `chats 18_10.pdf`: extracción local de 60 páginas; selección de consultas «Veci cuánto sería» (p. 7), «Cuánto sería» (p. 8–10) y exclusiones «sin ensalada» (p. 4). PDF `chats 11_10.pdf`: 30 páginas, consultas de total (p. 3,18,25) y exclusiones (p. 1,6,10). Se revisaron fragmentos de texto; no se afirma replay integral ni validación visual de esos documentos. Los archivos originales permanecen privados y fuera de Git.
- Chats aportados en esta conversación: «Natalia» → «Voy», «Dime?», «no más, cuánto es», «de todo lo que pedí», selección de platos diferentes y «limonada bajita de azúcar».
- Corpus anonimizado existente: `scripts/fixtures/whatsapp-real-chat-patterns.json`; investigación ya documentada: `whatsapp-regional-patterns-2810.md`. Se reutilizan sus límites: los ejemplos no representan una región entera ni demuestran frecuencia estadística.
- «Espera un momento», «déjame revisar», «no entendí bien», «cuánto queda todo» y combinaciones de notas son variantes sintéticas derivadas. No son nuevas transcripciones reales ni aprendizaje automático en producción.

## Matriz ejecutable: 352 pruebas nuevas

- 80 esperas × estados con riesgo de capturar nombre/dirección/teléfono/pago/confirmación: cuatro frases, cinco estados, dos cartas y agente simulado off/on.
- 80 solicitudes de repetir: mismos estados y catálogos, verificando contenido del carrito, notas y siguiente pregunta además de la conservación de datos.
- 80 preguntas de total: cantidades distintas, notas, recargo conocido o pendiente y conservación del paso del pedido. «Veci cuánto sería» viene del PDF; las otras son variantes derivadas.
- 80 traslados de notas: 20 pares de indicaciones contradictorias o compatibles, dos cartas y agente simulado off/on. 72 arrancan comprando dos platos y pidiendo una nota; ocho casos compuestos inyectan la selección pendiente, por lo que NO acreditan comprensión inicial de «uno sin cebolla y sin tomate».
- 12 continuaciones desde revisión final hasta una orden simulada explícita: espera/repetición/total nunca confirman; «confirmar» crea exactamente una orden conservando cantidad, notas y nombre.
- 20 controles puros de límites: frases compuestas no son absorbidas por espera/total; palabras completas y polaridad de notas. No confundir estos controles con conversaciones completas.

## Hallazgos y corrección

Baseline de contexto: 240 casos, 160 fallos y 80 aprobados. Algunos fallos afectan solo a la respuesta; otros almacenaban «espera un momento», «déjame revisar» o «no entendí bien» como nombre. Las frases nuevas se reconocen completas antes de capturar campos; no se absorben mensajes con datos adicionales. «Cuánto queda todo» devuelve el carrito y el siguiente paso sin confirmar.

Baseline inicial de notas: 48 fallos/32 aprobados. De esos 48, 32 reproducían traslados con instrucciones incompatibles. Los otros 16 eran problemas del contrato inicial del test: ocho diferencias de tildes normalizadas y ocho casos compuestos sin selección pendiente reconocida. Se corrigió el oráculo de tildes y se explicitó el punto de inicio de los compuestos; no se contabilizan esos 16 como correcciones del motor. El helper de contradicciones compara ingredientes completos y distingue «sin» de «con/poco/menos/extra/bajito de/aparte». Se aplica únicamente al traslado inmediato de notas de tanda279, no a toda edición de cocina.

Las pruebas nuevas y las suites vecinas se ejecutan antes de una sola global sobre las fuentes finales congeladas. Resultados y despliegue se registran en archivos JSON separados. Cero llamadas pagadas, Meta u órdenes externas; los agentes de los tests son dobles, no los modelos reales.

## Límites y pendientes concretos

No es una muestra reservada independiente ni evalúa conversión, audio, concurrencia real o precisión geográfica. Se conserva la restricción del traslado: dos líneas de una unidad, nota recién seleccionada, vigencia y firma del carrito correctas. Siguen pendientes comprensión inicial de notas compuestas con alcance ambiguo y destino explícito entre tres o más platos; no se habilitó una inferencia insegura para resolverlos. El detector no cubre todas las contradicciones culinarias ni sustituye la aclaración de alergias.

Producción y Kamppo no forman parte del despliegue de esta tanda. Para migrar, trasladar código, fixtures y contratos y ejecutar la integración propia de Kamppo.

## Dependencias para el traslado posterior a Kamppo

No copiar únicamente las expresiones de esta tanda. La espera utiliza la prioridad de checkout introducida en277; repetir depende del recordatorio de273; total conserva el cierre/revisión de275–276; el traslado requiere la memoria, invalidación y guardas de279. Portar el delta pendiente266–280 junto con su estado de sesión y adaptadores. Ejecutar las tres suites nuevas contra el router de destino y verificar creación de órdenes/DTO del destino; sus unidades no necesariamente se serializan igual que en PPP. Aquí el DTO expande una línea de cantidad2 en dos unidades de cocina, y los tests de continuación comprueban esa representación.
