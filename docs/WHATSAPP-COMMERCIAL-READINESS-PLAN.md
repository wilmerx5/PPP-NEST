# Plan operativo de calidad — 29/10/2026

Esta sección es la hoja de ruta vigente. Los registros de tandas que siguen son evidencia histórica, no una lista acumulativa de tareas abiertas. Responsable de implementación y pruebas: agente en PPP staging; validación del servicio y decisiones comerciales: operador del restaurante con evidencia del agente.

## Punto de partida y alcance

- Última evidencia: PPP staging tanda308, código `93ae3647`; producción tanda292, código `df8e16c3`; motor Kamppo hasta282. Delta para producción:294–295 y299–302/304/306/308 (293/296–298/303/305/307 solo pruebas); para Kamppo:283–308. Esto describe las verificaciones registradas, no una comprobación nueva del servidor en esta planificación.
- 30.336 pruebas /375 suites aprobadas en308, con dependencias simuladas. No equivalen a30.336 conversaciones reales ni a una tasa de éxito comercial.
- Hay patrones de chats y PDF, investigación regional documentada y algunos ensayos reales históricos. No está acreditada una revisión exhaustiva de todos los archivos ni una muestra representativa actual con modelo, medios y canal reales.
- Objetivo inicial: pedidos de texto fiables, con efectivo/transferencia, intervención humana disponible y catálogo configurable. Audio/fotos se habilitan como alcance acreditado por separado. Mercado Pago y autonomía general quedan fuera de la primera puerta comercial.
- El bot no aprende solo de producción: observar → anonimizar → clasificar → reproducir → corregir → evaluar → desplegar → verificar.

## Orden de trabajo y entregables

### 0. Igualar versiones y contener incidentes críticos

Preparar el paquete283–292 con código, fixtures, contratos y límites. Priorizar el cierre287 si siguen apareciendo pedidos bloqueados. Verificar paridad en el adaptador de Kamppo, no copiar únicamente el motor ni asumir que un fallo del canal existe en ambos productos. Registrar por ambiente commit, modelo/configuración, imagen y resultados. Revalidar aislamiento entre restaurantes, precios de opciones y persistencia propios de Kamppo.

Salida: el mismo caso reportado pasa en PPP y en la integración Kamppo; una prueba controlada confirma la versión realmente activa. PromociónMain283–292 verificada el29/10 por autorización explícita; la migración aKamppo sigue pendiente. Mantener versión anterior y procedimiento de reversión. Una migración pendiente se muestra como pendiente, nunca como fallo nuevo de una corrección supuestamente activa.

### 1. Inventario trazable de chats, PDF, audio e investigación

Auditar `scripts/fixtures/whatsapp-real-chat-patterns.json`, `whatsapp-pdf-1110-patterns.json`, los archivos originales disponibles y `docs/whatsapp-regional-patterns-2810.md`. Para cada fuente: identificador anónimo, modalidad, turnos, patrón, resultado esperado, test asociado, último resultado, evidencia y pendiente. Separar conversación real, transcripción, ejemplo sintético y variante generada. No etiquetar región por suposición ni tratar la investigación lingüística como chats reales de restaurantes.

Clasificar pedidos no cerrados: fallo demostrado del bot, cliente deja de responder con siguiente paso claro, problema operativo/cobertura, desistimiento explícito o causa desconocida. No atribuir todo abandono al bot. Reacciones y mensajes de espera no deben crear datos falsos ni insistencias inútiles.

Salida: cada fuente disponible está inventariada con estado revisado/pendiente/no disponible y cada incidencia importante tiene un caso trazable. Un fixture llamado «reserved» no garantiza independencia: auditar si ya se ejecutó o se usó para corregir antes de reservarlo.

### 2. Completar correcciones y consolidar reglas comunes

Tanda288 implementada y validada localmente: retirar cantidades explícitas («quita dos de los de pechuga»), conservar la cantidad al aclarar, impedir retirar más de lo existente, cancelar y recuperarse de una selección antigua. Alcance acotado a referencias «de los/las de»; no acredita todas las redacciones. Véase evidencia288 y despliegue separado.

Después, por familias:
- Cambios compuestos: «quita dos, cambia uno a broaster y deja las bebidas»; planificar todas las operaciones contra el mismo carrito. Aclarar antes de ejecutar una parte ambigua; no afirmar éxito total cuando solo se aplicó una parte.
- Repartos: varios productos/unidades con bebidas, preparaciones y notas diferentes; «el otro», «los demás», «menos uno» y segunda corrección. Conservar precio, cantidades, opciones y destinatario de cada nota.
- Contradicciones: retirar/reemplazar una nota explícitamente, distinguir exclusión de un extra cobrado y no añadir ambas instrucciones incompatibles. Catálogo y política del local definen extras y sustituciones.
- Catálogo: nombres similares, categorías sin contaminación, productos agotados, bebida incluida frente a adicional, consulta frente a compra; nunca inventar disponibilidad o equivalencias regionales.

Consolidación incremental: normalizar lenguaje → identificar intención/alcance → resolver líneas → validar → preparar resultado → aplicar → responder. Evaluar el contrato de acciones del modelo para cantidad afectada, referencia, reemplazo y lista de operaciones; no atribuir capacidad general al contrato por un parser acotado. Extraer reglas compartidas protegidas por tests, evitando una reescritura masiva y nuevas excepciones por plato. Probar invariantes (cantidad conservada salvo orden explícita, consulta sin mutación, precios del catálogo, cambios completos o aclaración) además de frases.

Salida: cada familia tiene positivos, negativos, ambigüedad, recuperación, contexto y payload final; funciona en al menos tres catálogos. No resolver una ambigüedad inventando la intención.

### 3. Conversación completa y recuperación

Cubrir desde saludo hasta recibo, incluyendo ráfagas («Natalia» / «voy»), preguntas intercaladas, nombre/barrio/dirección, pin+apartamento, dirección nueva, pago, total, espera, corrección en revisión, confirmación y pedido nuevo. El bot contesta la consulta y retoma el dato pendiente; la respuesta debe coincidir con el estado real. Una selección numérica pertenece a la última lista válida, no a una lista antigua.

Después de registrar: seguimiento del pedido reciente, salsas/notas, cambio de dirección y cancelación. Comprobar lo que realmente permite el estado operativo; si requiere humano, entregar contexto y no prometer un cambio no aplicado. Probar errores de BD/transporte con mensaje comprensible, recuperación sin pedido duplicado y sin errores técnicos expuestos al cliente.

Salida: recorridos completos verifican carrito, respuesta, estado, DTO/orden y recibo; ningún bucle conocido de «¿Algo más?», captura de conversación como dirección o confirmación no autorizada dentro del alcance.

### 4. Evaluación independiente con el modelo real

Crear una muestra nueva separada del desarrollo, con resultado esperado fijado antes de ejecutar. Propuesta inicial:50 conversaciones completas de texto, estratificadas por compra simple, consulta, edición, ráfaga, checkout y desistimiento; es un objetivo de evaluación, no evidencia existente ni garantía estadística. Variar catálogos y expresiones sin convertir cientos de combinaciones idénticas en supuestas conversaciones independientes.

Ejecutar primero todos los casos gratuitos. Luego un subconjunto real priorizado con presupuesto explícito, una ejecución inicial y parada ante fallo crítico; capturar modelo/configuración, herramientas, salida, resultado comercial, latencia y costo por conversación. Saldo operativo registrado:11 solicitudes restantes (267/256/11); no alcanza por sí solo para prometer50 conversaciones con herramientas. Estimar solicitudes y costo antes de ampliar, respetar autorización/presupuesto y no gastar una cuota parcial presentándola como evaluación completa.

Si una conversación se usa para corregir, pasa a desarrollo y se sustituye en la muestra independiente. Comparar el modelo actual con otra alternativa solo si la evidencia lo justifica; no aumentar modelo como sustituto de corregir estado, catálogo o persistencia.

Salida: informe separado de muestra independiente y reensayos de desarrollo, con fallos por familia/gravedad y denominadores. Ningún defecto crítico conocido sin resolver o contención comprobada para el alcance del piloto.

### 5. Audios, fotos, documentos y canal WhatsApp

Medios: usar originales autorizados y resultado esperado. Separar fallo de transcripción/percepción del fallo de interpretación. Audio con ruido, pausas, negaciones, cantidades, acentos y correcciones; fotos de pedidos, comprobantes y contenido no pertinente. Un comprobante o «ya pagué» no acredita pago liquidado. PDF usado como fuente de ejemplos y PDF/recibo generado son trabajos distintos: auditar extracción de casos y correspondencia del recibo con la orden por separado.

Canal: mensajes fragmentados, duplicados, retrasados, reacciones, evento no soportado, audio seguido de texto, reinicio/expiración, reintentos y concurrencia de un mismo cliente. Comprobar idempotencia en la creación real, aislamiento entre clientes/restaurantes y recuperación de caída del proveedor. No asumir que harness o health verde acreditan WhatsApp.

Salida: muestra inicial de medios con cada familia cubierta y limitaciones explícitas, más recorrido controlado extremo a extremo con aislamiento verificado y sin avisos a clientes/cocina ajenos. Si una modalidad no pasa, mantenerla asistida; no bloquear un piloto limitado a texto por exigir cobertura universal de medios.

### 6. Piloto medido y decisión comercial

Propuesta: primera revisión tras100 conversaciones elegibles, reportando también duración del periodo y volumen por familia. Separar conversaciones observadas, intentos de compra, abandonos y pedidos registrados. No contar consultas sin intención de compra como pedidos fallidos.

Medir: exactitud del pedido auditado, resolución de correcciones, repreguntas/bucles, cierres, intervención humana, abandono atribuible con evidencia, duplicados, p50/p95 de latencia, costo por conversación y pedido, errores de proveedor y problemas operativos. Línea base primero; fijar después objetivos económicos/latencia con el negocio. El antiguo p95≤15s es objetivo provisional, no medición actual.

Puerta inicial propuesta:100% de casos críticos de regresión aprobados; cero incidentes críticos observados en la muestra independiente/piloto; ≥95% de recorridos de texto dentro de alcance correctos o aclarados correctamente, sin ocultar los fallos bajo derivaciones humanas. Reportar aparte éxito automático e intervención. Son criterios propuestos, no resultados ya alcanzados ni prueba de ausencia de fallos raros.

Un error de pedido/precio, orden duplicada, confirmación indebida o mezcla entre restaurantes detiene la familia afectada y exige contención/corrección. Handoff debe llevar carrito, datos y duda al operador y permitir recuperación; no basta con mostrar un teléfono. Tras cumplir las puertas, ampliar restaurantes/modalidades gradualmente con seguimiento y reversión.

## Cómo ejecutar las tandas sin desperdiciar recursos

- Trabajar por familia de comportamiento. Usar300–500 variantes cuando aporten dimensiones distintas; no imponer un número ni generar1000 repeticiones de la misma regex.
- Por cambio: reproducción roja, ajuste mínimo o consolidación, foco de vecinos, TypeScript y global si afecta reglas compartidas. Congelar fuentes durante la global; cambios posteriores invalidan esa evidencia. Documentación sola no requiere repetir24.785 tests.
- Agrupar cambios coherentes antes de una global final; no volver a correrla por cada variante de fixture sin necesidad, ni saltarla al cerrar cambios compartidos. Reservar inferencia para diferencias que los mocks no pueden revelar.
- Publicar evidencia y actualizar una sola hoja de ruta vigente. Migrar a Kamppo paquetes cerrados con contratos de integración; mantener un registro de desfase y priorizar incidentes críticos, sin acumular indefinidamente mejoras solo en staging.
- Revisar chats nuevos con supervisión; nunca autoaprender ni cambiar producción a partir de una conversación sin evaluación. No crear seguimiento programado sin solicitud del usuario.

## Próximas acciones concretas

1. Preparar la matriz de pendientes reales de chats/PDF y el paquete de paridad283–292, con prioridad al bloqueo de confirmación287.
2. Cantidades referenciadas288, retiradas compuestas289, aclaración290 y retirada+adición acotada291; siguiente: opciones/aclaración de operaciones mixtas y auditoría de fuentes.
3. Seleccionar conversaciones independientes nuevas y presupuestar un ensayo real completo, sin consumirlas antes para desarrollo.
4. Verificar canal y recuperación operativa; iniciar piloto de texto supervisado solo al cumplir las puertas anteriores.

Este plan no certifica que el sistema esté listo para venta ni promete cubrir «todo» el lenguaje. Define qué evidencia falta y qué resultado permite avanzar. Fuentes: reportes283–287; `docs/whatsapp-regional-patterns-2810.md`; índices de chats/PDF mencionados; historial técnico conservado debajo.

---

## VIGENTE — tanda308: resto explícito en repartos pendientes (29/10)

Tanda308 desplegada en staging: código `93ae3647`, imagen `sha256:43190997ffd18fafecd8f3815f9954790481466f9596a13654af2d780a7466b1`, healthy, cero reinicios, API local/pública operativas y modelos/configuración preservados. Controles compilados previos aprobados; cobertura específica308 en pruebas locales. Evidencia `whatsapp-batch-308-staging-deployment.json`. Producción292 y Kamppo282 permanecen sin promoción.

Base `e61c159c`. «Uno de fresa en vaso y el resto de mango en botella» calcula el último grupo con la cantidad pendiente de añadir, nunca con las unidades del carrito previo. Acepta el resto/los demás/los restantes y formas femeninas; una sola cláusula final, cantidades previas explícitas y residuo positivo. Resuelve tanto un atributo como varios; después valida todas las opciones por catálogo y usa la aplicación atómica existente. Cero/sobrantes negativos, dos restos, resto al principio, opción faltante/desconocida, preguntas y condiciones no cambian el carrito.

342 pruebas nuevas:288 recorridos (3 catálogos ×agente simulado off/on ×origen único/ambiguo ×atributo previo compartido ×destino nuevo/existente ×uno/varios atributos ×3 frases),20 rechazos con recuperación,22 controles y12 casos de totales2/4/7, formas femeninas y varios grupos previos. Baseline308 fallidos/22 aprobados; foco994/3. Dos negativos antiguos sobre restos completos pasan a cobertura positiva nueva; los negativos conservan restos con opciones faltantes. Global final 30336 pruebas/375 suites, inventario exacto y fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-308-validation.json`.

Staging308 desplegado y verificado: código `93ae3647`. Evidencia `whatsapp-batch-308-staging-deployment.json`. Producción292 y Kamppo282 sin promoción. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Idiomas aplazados. Sin revisión nueva de medios originales. Pendientes: notas diferentes por grupo, opciones implícitas y planificación general de mensajes con varias operaciones.


## VIGENTE — tanda307: recuperación de repartos por grupo hasta cierre (29/10)

Base `19abecd4`.384 recorridos sintéticos:3 catálogos ×agente simulado off/on ×origen único/ambiguo ×atributo previo compartido ×destino nuevo/existente ×efectivo/transferencia ×4 interrupciones (total, suma insuficiente, presentación faltante, condición). Conserva carrito y selección pendiente; el total no incluye productos sin resolver. La corrección completa «dos en botella de mango y uno en vaso de fresa» retira la cantidad exacta y conserva cada combinación. Verifica respuesta, cantidades, atributos, notas, checkout, ausencia de orden anticipada, una creación al confirmar, DTO por grupo y recibo con total/notas.

384 nuevos +720 relacionados =1104 pruebas/3 suites aprobadas; TypeScript general/build aprobados. Sin fallo nuevo del motor en estos escenarios. Solo pruebas; último global del runtime29610/373 en306, no reejecutado ni atribuido al inventario ampliado307. Evidencia `whatsapp-batch-307-validation.json`.

Sin despliegue nuevo: última verificación PPP staging306 (`fc2c64bb`), producción292 y Kamppo282. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. No revisión nueva de chats/PDF/audio. Pendientes: restos implícitos, notas diferentes por grupo y planificación general de mensajes con varias operaciones. Idiomas aplazados.


## VIGENTE — tanda306: reparto de varios atributos por grupo (29/10)

Tanda306 desplegada en staging: código `fc2c64bb`, imagen `sha256:86ca122a89695fa2b6656d1648a77dd5752aa29ef4d6c6434911db2768e31a8b`, healthy, cero reinicios, API local/pública operativas y modelos/configuración preservados. Controles compilados previos aprobados; cobertura específica306 en pruebas locales. Evidencia `whatsapp-batch-306-staging-deployment.json`. Producción292 y Kamppo282 permanecen sin promoción.

Base `095cfe9b`. «Uno de fresa en vaso y dos de mango en botella» completa opciones pendientes de una retirada/adición mixta. Resuelve por valores exactos normalizados del catálogo, permite orden inverso y nombres de varias palabras, conserva atributos previos compartidos y agrupa combinaciones repetidas. Exige cantidades explícitas positivas cuya suma coincide con el total. Entre2–4 atributos restantes, hasta8 cláusulas y búsqueda acotada. Ambigüedad, opciones faltantes, condiciones, preguntas o límites no aplican una parte del cambio. Reutiliza la adición atómica y sus controles, incluidos límites que fallan al añadir el segundo grupo.

336 pruebas nuevas:288 recorridos (3 catálogos ×agente simulado off/on ×origen único/ambiguo ×atributo previo compartido ×destino nuevo/existente ×6 frases),20 rechazos con recuperación,22 controles y6 casos de opciones compuestas con2/3/4 atributos. Baseline308 fallidos/22 aprobados; foco inicial984/3; suite nueva final336 aprobada tras endurecer nombres que empiezan por conectores. Primer global interrumpido por ese ajuste; global final reiniciado: 29610 pruebas/373 suites, inventario exacto y fuentes congeladas. TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-306-validation.json`.

Staging306 desplegado y verificado: código `fc2c64bb`. Evidencia `whatsapp-batch-306-staging-deployment.json`. Producción292 y Kamppo282 sin promoción. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Idiomas aplazados. Sin revisión nueva de medios originales. Pendientes: restos implícitos, notas diferentes por grupo y planificación general de mensajes con varias operaciones; no se infieren.


## VIGENTE — tanda305: interrupciones de opciones conjuntas hasta cierre (29/10)

Base `069205b4`.384 recorridos sintéticos:3 catálogos ×agente simulado off/on ×origen único/ambiguo ×destino nuevo/existente ×con/sin atributo previo compartido ×efectivo/transferencia ×4 interrupciones (total, opción inexistente, condición y pregunta). Conserva carrito y selección pendiente antes de resolver «Presentacion: Vaso; Sabor: Fresa». La consulta de total no cuenta adiciones pendientes. Verifica respuesta, retirada exacta, fusión del destino, atributos previos, estados de checkout, ninguna orden anticipada, una creación al confirmar, unidades/atributos/notas por línea en el DTO y total/notas del recibo.

384 nuevos +710 relacionados =1094 pruebas/3 suites aprobadas; TypeScript general/build aprobados. Sin fallo nuevo del motor en estos escenarios. Solo pruebas; último global del runtime28890/371 en304, no reejecutado ni atribuido al inventario ampliado305. Evidencia `whatsapp-batch-305-validation.json`.

Sin despliegue nuevo: última verificación PPP staging304 (`f07b733f`), producción292 y Kamppo282. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. No revisión nueva de chats/PDF/audio. Pendientes: varias opciones diferentes por unidad y opciones conjuntas sin separadores explícitos. Idiomas aplazados.


## VIGENTE — tanda304: opciones conjuntas en cambios mixtos (29/10)

Tanda304 desplegada en staging: código `f07b733f`, imagen `sha256:b1b8e4e5c5ea5cda97cd90b242867fe1d88646c6fb6fa8d4d8580b6bb28f6c71`, healthy, cero reinicios, API local/pública operativas y modelos/configuración preservados. Controles compilados previos aprobados; cobertura específica304 en pruebas locales. Evidencia `whatsapp-batch-304-staging-deployment.json`. Producción292 y Kamppo282 permanecen sin promoción.

Base `08b17ed2`. Resuelve «fresa y vaso», orden inverso, coma/punto y coma, etiquetas «Sabor: Fresa; Presentacion: Vaso», con/en y cortesía final. Usa valores exactos normalizados del catálogo, exige todas las opciones restantes, una asignación inequívoca por atributo y conserva los atributos previamente elegidos. Todas las unidades añadidas comparten esa elección. Retirada y adición siguen siendo atómicas; reutiliza controles de catálogo, carrito, precio, pago y límites. No interpreta combinaciones distintas por unidad ni lenguaje libre general.

326 pruebas nuevas:288 recorridos (3 catálogos ×agente simulado off/on ×origen único/ambiguo ×destino nuevo/existente ×cantidad1/3 ×6 frases),16 rechazos con recuperación,20 controles y2 casos tras atributo previo. Baseline304/304 fallidos; foco inicial940/3 aprobado. Los22 controles finales incluidos en global: 28890 pruebas/371 suites, inventario exacto y fuentes congeladas. TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-304-validation.json`.

Staging304 desplegado y verificado: código `f07b733f`. Evidencia `whatsapp-batch-304-staging-deployment.json`. Producción292 y Kamppo282 sin promoción. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Idiomas aplazados. Pendiente: reparto de varios atributos por unidad y opciones sin separadores explícitos. Sin revisión nueva de medios originales.


## VIGENTE — tanda303: recuperación de repartos hasta cierre (29/10)

Base `1501a8fd`.384 recorridos sintéticos:3 catálogos ×agente simulado off/on ×origen único/ambiguo ×con/sin atributo previo compartido ×destino nuevo/existente ×4 repartos con sabor repetido ×consulta de total/reparto excesivo previo. «Uno de mango y uno de fresa y uno de mango» acumula cantidades de la misma opción. Comprueba carrito y elección intactos durante la interrupción, total sin productos pendientes, recuperación válida, respuesta con ambos sabores, cantidades/opciones/notas conservadas, checkout efectivo/transferencia, DTO y recibo. Repetir confirmar no crea otra orden; no acredita conservar estado completed en esa repetición.

384 nuevos +364 relacionados =748 pruebas/3 suites aprobadas. TypeScript general/build aprobados. Primer pase falló en la comprobación final por mock local sin reopenForNewOrder; completado el contrato del fixture y repetido todo el foco. No se identificó defecto nuevo del motor en esta tanda. Solo pruebas; último global de runtime28180/369 en302, sin atribuirlo al inventario ampliado303. Evidencia `whatsapp-batch-303-validation.json`.

Sin despliegue nuevo: última verificación PPP staging302 (`6ab7fa1e`), producción292 y Kamppo282. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. No revisión nueva de chats/PDF/audio ni validación con modelo real. Pendientes: varias opciones libres juntas y reparto por unidad de varios atributos. Idiomas aplazados.


## VIGENTE — tanda288: cantidades de retirada referenciada (29/10)

Tanda288 desplegada en staging: código `3db03dde`, imagen `sha256:cab26a51896df63ec95518802e36105bb6322c6e95122db17d304afb30987c29`, healthy,0reinicios, API local/pública operativas y controles compilados previos de «ni», conflicto y recuperación aprobados; la cobertura específica288 consta en la validación local. Modelos y configuración privada preservados. Evidencia `whatsapp-batch-288-staging-deployment.json`. PPP producción y Kamppo conservan282.

Base `ce2449aa`. «Quita dos de los de pechuga» conserva cantidad al aclarar por número/nota. Rechaza cantidades inválidas o superiores a las de la línea, sin repartir la retirada entre otras líneas; permite elegir otra tras insuficiencia. Conserva total intercalado, cancelación, firma del carrito, pagos/otras selecciones. Campo opcional `pendingCartRemoval.quantity` ahora numérico validado; sin SQL/modelos nuevos.

360 pruebas nuevas (144retiradas,144guardas,72recuperaciones), tres catálogos, compra/revisión y agente simulado off/on. Baseline26aprobadas/334fallidas; foco882/3. Global25145/355, inventario exacto y567fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-288-validation.json` y `whatsapp-batch-288-patterns.md`.

Cero inferencia pagada/Meta/órdenes externas; ledger267/256/11 intacto. Carritos previos preparados como fixtures, no conversaciones nuevas ni audio. Cantidades nuevas principales2/3 y límites inválidos; gramática acotada, no reparto entre líneas ni cambios compuestos. Siguiente: operaciones compuestas y auditoría trazable de fuentes/paridad. Producción PPP y Kamppo mantienen282;283–288 son trabajo de staging. Despliegue se registra aparte.

## VIGENTE — tanda289: retiradas compuestas con cantidades (29/10)

Tanda289 desplegada en staging: código `688f7f85`, imagen `sha256:ce3613aee13e03b1d02c708e704a4654081df5d00ad9cf491143f7dd4a7c52d4`, healthy,0reinicios, API local/pública operativas y controles compilados previos de «ni», conflicto y recuperación aprobados; la cobertura específica289 consta en la validación local. Modelos y configuración privada preservados. Evidencia `whatsapp-batch-289-staging-deployment.json`. PPP producción y Kamppo conservan282.

Base `2b12373a`. «Quita dos de los de pechuga y uno de los de cubos» resuelve todas las referencias y valida cantidades antes de guardar. Conserva notas, opciones, precio y saldo de unidades. Ambigüedad, referencias repetidas/desconocidas, cantidades inválidas o insuficientes, preguntas, condiciones, acciones mezcladas y pagos/selecciones pendientes conservan el pedido completo. Se solicita repetir la instrucción completa; no hay aclaración compuesta por número ni aplicación parcial.

396 pruebas nuevas (216 retiradas,168 guardas,12 recuperaciones), tres catálogos, compra/revisión y agente simulado off/on. Baseline168 aprobadas/228 fallidas; foco1176/3. Global25541/356, inventario exacto y568 fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-289-validation.json` y `whatsapp-batch-289-patterns.md`.

Sin SQL, campos de sesión o modelos nuevos. Cero inferencia pagada/Meta/órdenes externas; ledger267/256/11 intacto. Fixtures sintéticos derivados del plan; no son nueva revisión de chats/PDF/audio. Pruebas de dos cláusulas; parser acotado a2–5. No cubre añadir+cambiar+retirar ni distribución entre líneas. Siguiente: aclaración compuesta y matriz trazable de fuentes/paridad. PPP producción y Kamppo mantienen282;283–289 son trabajo de staging. Despliegue registrado aparte.

## VIGENTE — tanda290: aclaración de retiradas compuestas (29/10)

Tanda290 desplegada en staging: código `d7babf8a`, imagen `sha256:6978a43d7b1502593df22a43e2f052dd53586bc577bf174caed3b0137e94fe42`, healthy,0reinicios, API local/pública operativas y controles compilados previos de «ni», conflicto y recuperación aprobados; la cobertura específica290 consta en la validación local. Modelos y configuración privada preservados. Evidencia `whatsapp-batch-290-staging-deployment.json`. PPP producción y Kamppo conservan282.

Base `ee127315`. Aclara cada referencia ambigua conservando todas las cantidades; selección por número/nota, ninguna mutación hasta resolver todo. Reutiliza el flujo múltiple con `pendingCartRemoval.batchQuantities` opcional; retirar líneas completas conserva su contrato. Total intercalado, cancelación tras la primera selección, firma antigua, cantidades insuficientes, referencias superpuestas y selecciones/pagos pendientes protegidos. Recordatorios muestran cantidad; desconocidos/cantidades inválidas posteriores impiden crear la aclaración.

276 pruebas nuevas (96 aclaraciones,120 guardas,48 recuperaciones,12 superposiciones), tres catálogos, compra/revisión y agente simulado off/on. Baseline inicial264:36 aprobadas/228 fallidas;12 casos añadidos después. Foco1260/7. Global25817/357, inventario exacto y569 fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-290-validation.json` y `whatsapp-batch-290-patterns.md`.

Sin SQL o modelos nuevos. Cero inferencia pagada/Meta/órdenes externas; ledger267/256/11 intacto. Fixtures sintéticos derivados del plan; no nueva revisión de chats/PDF/audio. Pruebas de dos cláusulas, gramática de289; no añadir+cambiar+retirar ni reparto entre líneas. Para sustituir una petición contada pendiente: cancelar y repetir. Siguiente: matriz trazable de fuentes/paridad y operaciones heterogéneas. PPP producción y Kamppo mantienen282;283–290 son staging. Despliegue registrado aparte.

## VIGENTE — tanda291: retirada contada y adición atómica (29/10)

Tanda291 desplegada en staging: código `97d628ba`, imagen `sha256:b0ad3228effa5bd53c8c4d588b0029a80f4784a04acc4ed772c94006463f9e4c`, healthy,0reinicios, API local/pública operativas y controles compilados previos de «ni», conflicto y recuperación aprobados; la cobertura específica291 consta en la validación local. Modelos y configuración privada preservados. Evidencia `whatsapp-batch-291-staging-deployment.json`. PPP producción y Kamppo conservan282.

Base `e147c34b`. «Quita uno de los de pechuga y agrega dos Agua Mineral» valida una retirada y una adición antes de guardar. Prepara resultado en copia de sesión, reutiliza adición/límites existentes y conserva notas/opciones/precios de las demás unidades. Acumula en línea compatible; límites sobre resultado final. Cantidad inválida, referencia desconocida/ambigua/insuficiente, destino desconocido/ambiguo/agotado/con opciones, límites, pregunta/condición/tercera acción y selecciones/pagos pendientes conservan todo.

420 pruebas nuevas (192 operaciones,216 guardas,12 recuperaciones), tres catálogos, compra/revisión y agente simulado off/on. Baseline inicial396:192 aprobadas/204 fallidas;24 guardas añadidas después. Foco1130/4. Global26237/358, inventario exacto y570 fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-291-validation.json` y `whatsapp-batch-291-patterns.md`.

Sin SQL, campos de sesión ni modelos nuevos. Cero inferencia pagada/Meta/órdenes externas; ledger267/256/11 intacto. Fixtures sintéticos; no nueva revisión de chats/PDF/audio. Gramática acotada, destino por nombre completo sin opciones requeridas. No orden inverso, alias, tres acciones, preparación ni aclaración persistente de esta mezcla. Siguiente: opciones/aclaración de operaciones mixtas y matriz trazable de fuentes/paridad. PPP producción y Kamppo mantienen282;283–291 son staging. Despliegue registrado aparte.

## VIGENTE — tanda292: incidentes de dirección y pedidos reportados (29/10)

Tanda292 desplegada en producción/Main: código `df8e16c3`, imagen `sha256:8bb006a013aab47e811e3ce223ac9e5af12bd06195efe344d75394db84e8d29b`, contenedor activo, cero reinicios y API local/pública saludables (este compose no configura healthcheck Docker). Configuración/modelos preservados. Promoción283–292 autorizada por usuario, validada primero en staging. Evidencia `whatsapp-batch-292-production-deployment.json`. Kamppo sigue282.

Tanda292 desplegada en staging: código `df8e16c3`, imagen `sha256:e8184267f4387291c03be4bce11e4f7af82f88efd67dc268911c851f6f1b6352`, healthy,0reinicios, API local/pública operativas y controles compilados previos de «ni», conflicto y recuperación aprobados; cuatro controles compilados292 de dirección aprobados y cobertura de router292 acreditada localmente. Modelos y configuración privada preservados. Evidencia `whatsapp-batch-292-staging-deployment.json`. Después se verificó producción292; Kamppo conserva282.

Base `0cb3ef0f`. Prioridad del usuario: incidentes reportados, similares, staging y luego Main. Conserva nomenclatura dictada frente a «número» confundido con teléfono, bloquea cierre de calle sin placa aunque haya tarifa, contiene corrección posterior sin reabrir compra ni prometer edición de orden registrada. Esta última requiere coordinación telefónica con restaurante. Opciones bebida/arepas juntas, sugerencia confirmable de broaster ante booster/boster, porción+dirección con agente activo, nota residual y despedida corregidas. Saludo sin llamada y minutos ya existentes revalidados; ETA general no se presenta como tiempo restante.

74 casos nuevos derivados de textos sanitizados y variantes; baseline inicial32:2 aprobados/30 fallidos, con corrección del campo DTO del fixture durante reparación. Foco218/6; global26311/359, inventario exacto y571 fuentes congeladas, TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-292-validation.json` y `whatsapp-batch-292-patterns.md`.

Cero inferencia pagada/Meta/órdenes externas; ledger267/256/11 intacto. Sin SQL/campos/modelos nuevos. No prueba del audio original ni edición automática de órdenes ya enviadas. Usuario autorizó promoverMain después de validar; registrar evidencia de cada despliegue por separado. Kamppo permanece282, sin migración en esta tarea. Después de la promoción, retomar otras tandas.

## VIGENTE — tanda294: total intercalado y recuperación de opciones (29/10)

Tanda294 desplegada en staging: código `de3e16be`, imagen `sha256:999bc03177539e9150ee810e58c334834626db362f5c15d9f90cae5eb3e0319d`, healthy, cero reinicios, API local/pública operativas y modelos/configuración preservados. Controles compilados previos aprobados; cobertura específica294 en pruebas locales. Evidencia `whatsapp-batch-294-staging-deployment.json`. Producción292 y Kamppo282 permanecen sin promoción.

Base `b4c1df2d`. «Cuánto va todo», «en cuánto va todo» y «cuánto va el pedido hasta ahora» leen el total del carrito sin acudir al modelo ni consumir la elección de sabor pendiente. Regla acotada y anclada; excluye producto específico, condiciones, adiciones, tiempo de entrega y futuras hipótesis. No suma productos pendientes de elección.

80 pruebas nuevas:72 recorridos de petición mixta rechazada por opciones faltantes, adición separada, selección por número/nombre o recuperación tras sabor inexistente y retirada explícita posterior; ocho límites de intención. Tres catálogos, agente simulado off/on, cantidades1/2 y total intercalado. Verifica que no se retire a medias ni se ejecute una operación antigua implícitamente. La aclaración atómica persistente de la mezcla sigue pendiente; estas pruebas acreditan recuperación mediante instrucciones separadas.

Baseline tras corregir fixtures:36/72 pasan y36 fallan. Foco631/5; global26427/361, inventario exacto y573 fuentes congeladas; TypeScript general/build y Node aprobados. Un timeout inicial de5s con seis workers se revalidó ejecutando toda la suite afectada en serie, sin cambiar código ni timeout; las demás suites se ejecutaron con cuatro workers. Evidencia `whatsapp-batch-294-validation.json`. Cero inferencia/Meta/órdenes externas, ledger267/256/11 intacto. Modelos preservados; sin SQL ni campos nuevos. Datos sintéticos, no nuevos chats/audio/PDF revisados. Producción292 y Kamppo282; publicación/despliegue staging se registra aparte.

## VIGENTE — tanda295: producto frente a ocasión de consumo (29/10)

Tanda295 desplegada en staging: código `d4533407`, imagen `sha256:763875a6257c241fe50552f4e4579fbf1049a0c22382b90fc768f95cd2a61fb3`, healthy, cero reinicios, API local/pública operativas y modelos/configuración preservados. Controles compilados previos aprobados; cobertura específica295 en pruebas locales. Evidencia `whatsapp-batch-295-staging-deployment.json`. Producción292 y Kamppo282 permanecen sin promoción.

Base `0bb16f76`. Reporte Kamppo «hamburguers for lunch»; usuario aplazó expresamente idiomas. Se reproduce solo la familia española: «tienen hamburguesas para almorzar», cena/desayuno, saludo/veci/porfa y verbo «tines». Consulta explícita acotada separa producto y ocasión; respeta calificadores, título literal de catálogo, selección pendiente y estados de checkout. Presentaciones por palabras del catálogo, no IDs de PPP. Una sola mini hamburguesa también es oferta válida; agotados no se listan y ausencia real no se cambia por ejecutivos. Sin compra implícita ni promesa de horario futuro.

87 pruebas nuevas:60 recorridos con tres familias, carrito vacío/existente y agente simulado off/on;16 controles de presentación única, agotado, inexistente y todas agotadas;11 límites/calificadores. Baseline36:8 aprobados/28 fallidos. Foco304/5; global26514/362, inventario exacto y575 fuentes congeladas. TypeScript general/build y Node aprobados. Global no-timers con timeout20s como CI; timers seriales. Evidencia `whatsapp-batch-295-validation.json` y `whatsapp-batch-295-patterns.md`.

Cero inferencia/Meta/órdenes externas, ledger267/256/11 intacto. Sin SQL/modelos nuevos. Revisión de patrones seleccionados ya versionados y chats del hilo, no recenso de todos los chats originales ni nueva revisión de audio/PDF. Prioridad siguiente: referencias/cambios, cierre informal, datos fragmentados y postventa. Producción292 y Kamppo282; deploy staging se registra aparte. Mezcla de idiomas aplazada.

## VIGENTE — tanda296: «el otro» hasta orden y recibo (29/10)

Base `9099e57a`.48 recorridos nuevos sobre tres catálogos sintéticos, agente simulado off/on y efectivo/transferencia. Nota «sin cebolla» aplicada a una línea; «no, el otro» con destino único, aclaración entre varias líneas, destino con nota incompatible y cancelación de la redirección. Conserva el carrito mientras aclara; la resolución mueve solo la nota reciente y mantiene las notas anteriores, bebidas, presentaciones, cantidades y precios. Continúa por recogida, pago, revisión y confirmación; DTO y recibo contienen la nota en el plato correcto. No crea orden antes de confirmar.

Baseline48/48; foco480/3; TypeScript general/build aprobados. Solo pruebas, sin cambios del motor ni despliegue nuevo. Último global de runtime:26514/362 en295; no atribuirlo al inventario ampliado296. Evidencia `whatsapp-batch-296-validation.json` y `whatsapp-batch-296-patterns.md`.

PPP staging295, producción292, Kamppo282. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Carritos preparados de una unidad por línea, no reproducción íntegra de chats nuevos ni prueba de audio. Esta tanda acredita notas; no generaliza «el otro» a cambios de SKU/preparación. Idiomas siguen aplazados. Próximo: referencias de preparación/variante hasta checkout y aclaración persistente de operaciones mixtas.

## VIGENTE — tanda297: preparación parcial hasta confirmación (29/10)

Base `250febb5`.72 recorridos nuevos: tres catálogos sintéticos, agente simulado off/on, grupos de2/3/4 unidades, posición de línea alternada y efectivo/transferencia. «Cámbiame uno de los de pechuga a pollo broaster» y referencias equivalentes de tofu/pescado. Separa exactamente una unidad, conserva notas y atributos compatibles, mantiene la otra línea con bebida/opciones distintas y aplica el precio del destino. Verifica carrito exacto, respuesta, estados de recogida/pago/confirmación, ausencia de creación anticipada, una sola creación, unidades del DTO con notas/atributos y recibo con total correcto.

Baseline72/72; foco466/3; TypeScript general/build aprobados. Sin fallos nuevos ni cambios del motor; publicación de pruebas, sin despliegue. Último global de runtime:26514/362 en295, no reejecutado ni atribuido al inventario ampliado297. Evidencia `whatsapp-batch-297-validation.json` y `whatsapp-batch-297-patterns.md`.

PPP staging295, producción292, Kamppo282 según última verificación registrada. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. No implica validación con modelo real. Idiomas aplazados. Próximo: recuperación de operaciones mixtas ambiguas y continuidad tras aclaraciones, conservando el pedido hasta resolver destino y cantidad.

## VIGENTE — tanda298: matriz de recuperación de operaciones mixtas (29/10)

Base `bacddb3d`.384 recorridos sintéticos:8 rechazos (destino inexistente, retirada excesiva/negativa, adición decimal/cero, referencia inexistente, condición, tercera acción) ×3 catálogos ×agente simulado off/on ×efectivo/transferencia ×retirada parcial/completa ×destino nuevo/existente. Primero exige carrito intacto y respuesta explícita; después repite la instrucción completa corregida. Comprueba retirada y adición juntas, fusión de cantidades, notas/atributos del plato restante, ausencia de notas heredadas en el producto añadido, estados de checkout, creación única solo al confirmar, unidades exactas del DTO y total/nota en recibo.

384 nuevos aprobados +456 regresiones relacionadas =840 pruebas en3 suites; TypeScript general/build aprobados. Sin fallos nuevos ni cambio de motor. Publicación de pruebas, sin despliegue nuevo. Último global de runtime26514/362 en295; no reejecutado ni atribuido al inventario ampliado298. Evidencia `whatsapp-batch-298-validation.json` y `whatsapp-batch-298-patterns.md`.

Última verificación registrada: PPP staging295, producción292, Kamppo282. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Idiomas aplazados. Límite pendiente: aclaraciones cortas y persistentes de operaciones mixtas («el segundo»); esta tanda acredita recuperación repitiendo la petición completa, no soluciona ese límite.

## VIGENTE — tanda299: aclaración corta de retirada y adición (29/10)

Tanda299 desplegada en staging: código `6046e45b`, imagen `sha256:d03c77b89bbc0c4ca66f9e7a56e34555d7cb12e095a27420942e65a355096b5a`, healthy, cero reinicios, API local/pública operativas y modelos/configuración preservados. Controles compilados previos aprobados; cobertura específica299 en pruebas locales. Evidencia `whatsapp-batch-299-staging-deployment.json`. Producción292 y Kamppo282 permanecen sin promoción.

Base `bd836a14`. Si «quita dos de los de pechuga y agrega tres Agua Mineral» tiene varias líneas de origen pero un destino exacto disponible sin opciones requeridas, conserva ambas acciones pendientes. Resuelve con número, «el segundo» o nota distintiva; aplica retirada y adición juntas después de volver a validar catálogo, cantidad y límites. Preguntar total conserva la elección. Precio/nombre/disponibilidad/opciones cambiados, carrito modificado o elección vencida no aplican media operación. Caducidad30min. Cancelar el cambio conserva el carrito; reiniciar sigue vaciándolo por el flujo existente. Confirmar/no más/pregunta no resuelven la elección por accidente.

202 pruebas nuevas:144 recorridos (3 catálogos ×2 agentes simulados ×2 cantidades ×destino nuevo/existente ×6 formas de resolver/interrumpir);16 controles de cambio de catálogo/carrito, pago, límites, cantidad insuficiente y caducidad;42 controles en construcción/pago/confirmación. Baseline160 fallidos; corrección160 aprobados; ampliación detectó6 bloqueos de reinicio, corregidos. Foco1042/4; global27220/366, inventario exacto y579 fuentes congeladas. TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-299-validation.json`.

Staging299 desplegado y verificado: código `6046e45b`; evidencia `whatsapp-batch-299-staging-deployment.json`. Producción292 y Kamppo282 sin promoción. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Idiomas aplazados. El destino ambiguo o con atributos sigue solicitando petición completa/elección; esta mejora no acredita un planificador general de operaciones combinadas.

## VIGENTE — tanda300: opciones del producto añadido sin retirada parcial (29/10)

Tanda300 desplegada en staging: código `f7fc7ab3`, imagen `sha256:64d37b7a7b587ced77e8f1e04b16abd3b2506ff416a0732029320b3c3be2db52`, healthy, cero reinicios, API local/pública operativas y modelos/configuración preservados. Controles compilados previos aprobados; cobertura específica300 en pruebas locales. Evidencia `whatsapp-batch-300-staging-deployment.json`. Producción292 y Kamppo282 permanecen sin promoción.

Base `8d0eb406`. La operación combinada conserva retirada y adición cuando el destino exacto requiere atributos. Resuelve primero la línea de origen si hay ambigüedad y después cada opción del destino por número o nombre exacto. El carrito no cambia hasta completar todas las opciones. Revalida firma del carrito, catálogo/opciones, precio, disponibilidad, cantidad y límites; utiliza la adición habitual con atributos completos. Una nueva instrucción completa de agregar el mismo producto sustituye el cambio pendiente y pasa al flujo habitual sin retirar nada. Consulta de total mantiene la elección; cancelar conserva el carrito y reiniciar usa el flujo existente. Las listas consecutivas no confunden el número de línea con el sabor o presentación.

308 pruebas nuevas:288 recorridos (3 catálogos ×2 agentes simulados ×origen único/ambiguo ×uno/dos atributos ×destino nuevo/existente ×6 formas de selección/interrupción);20 controles de cambio de precio/stock/opciones/carrito, pago, límites, confirmación/pregunta, caducidad y reinicio tras primera opción. Baseline164 fallidos. Primer global interrumpido al detectar incompatibilidad con72 recorridos anteriores de compra independiente; corregida y validada junto a los8 límites de aquella suite. Global completo reiniciado después del ajuste; foco1394/5 aprobado. Global27528/367, inventario exacto y580 fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-300-validation.json`.

Staging300 desplegado y verificado: código `f7fc7ab3`; evidencia `whatsapp-batch-300-staging-deployment.json`. Producción292 y Kamppo282 sin promoción. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Idiomas aplazados. Pendiente: destino ambiguo, selección libre de varias opciones en un mensaje y reparto de sabores entre unidades. No es un planificador general de operaciones mixtas.

## VIGENTE — tanda301: elección de producto en retirada y adición (29/10)

Tanda301 desplegada en staging: código `f4956230`, imagen `sha256:262ad4c7634bf117526c09110808e79e9c3c6f8179773bf0b984068b102579c6`, healthy, cero reinicios, API local/pública operativas y modelos/configuración preservados. Controles compilados previos aprobados; cobertura específica301 en pruebas locales. Evidencia `whatsapp-batch-301-staging-deployment.json`. Producción292 y Kamppo282 permanecen sin promoción.

Base `2002bd3f`. Cuando el destino no tiene coincidencia exacta pero coincide con el inicio literal de2–8 nombres disponibles distintos, conserva ambas acciones y pregunta qué producto agregar. No usa coincidencia aproximada ni subcadenas dentro de palabras. El título exacto mantiene prioridad. Orden de listas: producto, línea a retirar si hace falta, atributos. Resuelve producto por número, nombre completo u ordinal; revalida precio/disponibilidad/opciones antes de continuar. Total, cancelación, reinicio y nueva compra independiente preservan su semántica; ninguna retirada aislada. Nombres duplicados indistinguibles, condiciones y listas excesivas permanecen bloqueados.

324 pruebas nuevas:288 recorridos (3 catálogos ×2 agentes simulados ×origen único/ambiguo ×con/sin atributo ×cantidad1/3 ×6 formas de selección/interrupción);20 controles de cambio de precio/stock/opciones/carrito, pago, límites, pregunta/confirmación, selección inválida y caducidad;12 límites de catálogo;4 cambios a compra independiente. Baseline308 fallidos; primera corrección detectó96 rechazos por palabra corta «té» en «té frío», ajustados sin abrir coincidencias parciales. Foco1334/5 aprobado. Global27852/368, inventario exacto y581 fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-301-validation.json`.

Staging301 desplegado y verificado: código `f4956230`; evidencia `whatsapp-batch-301-staging-deployment.json`. Producción292 y Kamppo282 sin promoción. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Idiomas aplazados. Pendiente: opciones expresadas libremente juntas y reparto de sabores entre unidades. Selección por prefijo literal acotado, no resolución universal de categorías ni planificador general.

## VIGENTE — tanda302: reparto de opciones con retirada atómica (29/10)

Tanda302 desplegada en staging: código `6ab7fa1e`, imagen `sha256:eba385cb364999ecf06b38bac71e3dc7b61d53bc83bfd4815c87c898a32b2be8`, healthy, cero reinicios, API local/pública operativas y modelos/configuración preservados. Controles compilados previos aprobados; cobertura específica302 en pruebas locales. Evidencia `whatsapp-batch-302-staging-deployment.json`. Producción292 y Kamppo282 permanecen sin promoción.

Base `36ad6aa4`. «Dos de mango y uno de fresa» resuelve la última opción pendiente de una adición combinada de3 unidades. Cantidades explícitas enteras positivas, nombres exactos de opciones y suma total obligatoria; acepta números/palabras, de/con, coma/punto y coma/y y cortesía final. Los atributos anteriores seleccionados se comparten entre grupos. Prepara retirada y todos los grupos en una sesión separada, aplica límites de cada adición y guarda solo el resultado completo. Si el segundo grupo excede líneas o importe, no persiste el primero ni la retirada. No adivina restos ni repartos entre varios atributos.

328 pruebas nuevas:288 recorridos (3 catálogos ×2 agentes simulados ×origen único/ambiguo ×con/sin atributo compartido ×destino nuevo/existente ×6 formas de reparto),20 rechazos con recuperación,20 controles de límites tardíos/importe/stock/precio/opciones/carrito/pago/caducidad/cancelación/reinicio. Baseline308 fallidos/20 aprobados; foco1662/6 aprobado. Global28180/369, inventario exacto y583 fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-302-validation.json`.

Staging302 desplegado y verificado: código `6ab7fa1e`; evidencia `whatsapp-batch-302-staging-deployment.json`. Producción292 y Kamppo282 sin promoción. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Idiomas aplazados. Pendiente: varias opciones libres en un mensaje y reparto por unidad de varios atributos; esta tanda solo reparte la última opción con cantidades completas.

## Historial de validaciones y planes anteriores

Las etiquetas «VIGENTE» de las entradas antiguas describían su fecha. Para prioridades y estado actual, usar la hoja de ruta superior y la última evidencia de despliegue.



## VIGENTE — tanda287: «yes» y cierre en confirmación (29/10)

Tanda287 desplegada en staging: código `588552e7`, imagen `sha256:e23b0ece1dca61a3cf94cefb63f3fdcb8f7626b850722196e59246f7ad3a9638`, healthy,0reinicios, API local/pública operativas y controles compilados previos de «ni», conflicto y recuperación aprobados; la cobertura específica287 consta en la validación local. Modelos y configuración privada preservados. Evidencia `whatsapp-batch-287-staging-deployment.json`. PPP producción y Kamppo conservan282.

Base `42f7cdc6`. Se priorizó el chat reportado de Kamppo: «yes» → «¿Algo más?» → «no» repetido. PPP también reproduce el fallo. Ahora «yes» completo reconoce aprobación final, respetando preguntas, mensajes mixtos y cambios pendientes. «No», «no más» y «solo eso» en ese paso conservan el resumen y piden confirmar o corregir; nunca crean la orden por negación.

384 pruebas nuevas en tres productos, dos modos simulados, efectivo/transferencia y domicilio/recogida: 120 aprobaciones, 120 no autorizaciones, 72 cierres repetidos y 72 cambios pendientes. Baseline 192 aprobados / 192 fallidos; foco 384/1. Global 24785/354, inventario exacto y 566 fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-287-validation.json` y `whatsapp-batch-287-patterns.md`.

Sin SQL, campos ni modelos nuevos. Cero inferencia pagada/órdenes externas; ledger 267/256/11 intacto. Fixtures parten de confirmación completa; no son replay del canal real. Kamppo inspeccionado solo en lectura: su función local también omitía «yes», pero no se validó runtime ni se migró. PPP producción y Kamppo mantienen 282; 283–287 son staging. Quedan pendientes cantidades de retirada y pedidos compuestos, desplazados por esta incidencia.


## VIGENTE — tanda286: retirada referenciada de una unidad (29/10)

Tanda286 desplegada en staging: código `80b98eeb`, imagen `sha256:1f293aaff9f29b5704496bad6fd82f5ad98534f02cd40b143664bc407366b571`, healthy,0reinicios, API local/pública operativas y controles compilados previos de «ni», conflicto y recuperación aprobados; la cobertura específica286 consta en la validación local. Modelos y configuración privada preservados. Evidencia `whatsapp-batch-286-staging-deployment.json`. PPP producción y Kamppo conservan282.

Base `b4fcef74`. «Quita uno de los de pechuga» retira una unidad; si varias líneas coinciden, pregunta y conserva esa cantidad al seleccionar por número o característica. El campo opcional `pendingCartRemoval.quantity: 1` distingue esta intención. Firma del carrito, cancelación, pago/otras selecciones y preguntas protegen la operación. Consultar el total no consume la selección. La última unidad deja carrito vacío en compra.

420 pruebas nuevas: 216 retiradas, 72 aclaraciones, 96 guardas y 36 interrupciones/vaciado. Baseline inicial 384 casos: 102 aprobados / 282 fallidos; las interrupciones detectaron 12 fallos adicionales del total, corregidos. Foco final 882/3. Global 24401/353, inventario exacto y 565 fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-286-validation.json` y `whatsapp-batch-286-patterns.md`.

Sin SQL ni cambios de modelos. Cero inferencia pagada, Meta u órdenes externas; ledger 267/256/11 intacto. Fixtures de carrito previo, no replay de compra/audio. Quedan pendientes cantidades parciales distintas de uno y pedidos compuestos. PPP producción y Kamppo mantienen 282; 283–286 son trabajo de staging. Despliegue registrado por separado.


## VIGENTE — tanda285: preparación de una sola unidad (29/10)

Tanda285 desplegada en staging: código `dd48c78e`, imagen `sha256:362043f7f0c3411f36f7e5239c20c009d5d1ce46a9c7b0e297f30b86f5c88bba`, healthy,0reinicios, API local/pública operativas y controles compilados previos de «ni», conflicto y recuperación aprobados; la cobertura específica285 consta en la validación local. Modelos y configuración privada preservados. Evidencia `whatsapp-batch-285-staging-deployment.json`. PPP producción y Kamppo conservan282.

Base `57c93413`. «Cambia uno de los de pechuga a pollo broaster» separa una unidad de la línea identificada y conserva las demás, sus opciones y notas. Reutiliza el catálogo para encontrar la presentación equivalente; valida el resultado completo antes de guardar. Ambigüedad, incompatibilidad, pagos/selecciones pendientes y límites conservan el carrito.

360 pruebas nuevas: 216 cambios y 144 guardas en tres familias, dos modos de agente y compra/revisión. Baseline inicial de 312 casos: 84 aprobados / 228 fallidos; después se añadieron 48 guardas. Foco final 458/2. Global 23981/352, inventario exacto y 564 fuentes congeladas; TypeScript general/build y scripts Node aprobados. Evidencia `whatsapp-batch-285-validation.json` y `whatsapp-batch-285-patterns.md`.

Sin campos de sesión nuevos, SQL ni modelos nuevos. Cero inferencia pagada, Meta u órdenes externas; ledger 267/256/11 intacto. Fixtures de carrito previo, no replay de compra/audio. Quedan pendientes referencias ambiguas con aclaración, cambios compuestos y retirada parcial. PPP producción y Kamppo mantienen 282; 283–285 son trabajo de staging. Despliegue registrado por separado.


## VIGENTE — tanda284: conflictos antes de dividir unidades o anotar todo el carrito (29/10)

Tanda284 desplegada en staging: código `52fb3894`, imagen `sha256:4720b8d1ed5c5a99545ce0a7c01f9a17cf50f67fdf30a1c77df37b78b165e9c9`, healthy,0reinicios, API local/pública operativas y controles compilados previos de «ni», conflicto y recuperación aprobados; la cobertura específica284 consta en la validación local. Modelos y configuración privada preservados. Evidencia `whatsapp-batch-284-staging-deployment.json`. PPP producción y Kamppo conservan282.

Base `843f2585`. Dos rutas no comprobaban las notas anteriores: división parcial con producto/cantidades explícitos y nota para todas las unidades del carrito. Ahora se valida todo el destino antes de mutar. Si existe«con tomate» frente a«sin tomate», muestra el plato y la nota incompatible y conserva todas las unidades. Un nuevo cambio compatible funciona sin dejar un bloqueo pendiente.

320 pruebas nuevas:192divisiones explícitas y128aplicaciones a todo el carrito, en2catálogos, compra/revisión y agente simulado activo/inactivo. Baseline160aprobadas/160fallidas; foco1036/4. Global23621/351, inventario exacto y563fuentes congeladas; TypeScript general/build y scripts Node aprobados. Evidencia `whatsapp-batch-284-validation.json` y `whatsapp-batch-284-patterns.md`.

Sin campos nuevos, SQL ni cambios de modelos. Cero inferencia pagada/Meta/órdenes externas; ledger267/256/11 intacto. No se amplía el traslado inferido entre varias unidades ni el cambio de variante o retirada ambigua: siguen como siguiente tramo. La respuesta no promete haber resuelto la contradicción; el carrito original se conserva. Producción PPP y Kamppo mantienen282;283/284 son trabajo de staging.


## VIGENTE — tanda283: exclusiones con «ni» (29/10)

Tanda283 desplegada en staging: código `161edad7`, imagen `sha256:9da197eecdeb00f2cddb9ba7a70a897bc4fb0639f313214ed2585f40905368b1`, healthy,0reinicios, API local/pública operativas y comprobaciones compiladas de«ni»/conflicto/recuperación aprobadas. Modelos y configuración privada preservados. Evidencia `whatsapp-batch-283-staging-deployment.json`. PPP producción y Kamppo conservan282.

Base `981f290d`. «Uno sin cebolla ni tomate» y otras exclusiones de2/3ingredientes conservan una sola nota y piden destino entre varios platos; una unidad se puede separar sin afectar las demás. La detección de conflictos reconoce también el ingrediente que sigue a«ni», en ambos sentidos, y permite seleccionar otro plato o cancelar la indicación pendiente.

348 pruebas nuevas (312 recorridos y36límites), baseline155aprobadas/193fallidas, foco756aprobadas. Global23301/350, inventario exacto y562fuentes congeladas; TypeScript general/build y scripts Node aprobados. Ver `whatsapp-batch-283-validation.json` y `whatsapp-batch-283-patterns.md`.

Sin catálogo fijo, SQL ni cambio de modelos. Cero inferencia pagada/Meta/órdenes externas; ledger267/256/11 intacto. Límites: no expresiones arbitrarias con condiciones o más de3exclusiones, ni todas las correcciones de varias unidades. Las pruebas negativas puras acreditan el parser, no todos los fallbacks del modelo. Esta tanda permanece en staging;282 fue promovida aMain y portado aKamppo. Evidencia de activación se registra aparte.


## VIGENTE — tanda282: traslado de notas entre tres o más platos (29/10)

**Actualización de promoción:** PPP producción verificada en `981f290d` (código282), imagen `sha256:1a4e6b996b9a40ce7ba99103e73c95d63ce548ad19139d97ce89e0367a2dcb39`; API local/pública operativas,0reinicios, controles compilados y configuración preservada. Se usó el workflow manual de Kamppo porque el SSH local agotaba tiempo. Kamppo también ejecuta266–282: `d482cbc3628d`, imagen `sha256:5728183a360ae02938ac8809ff834585af740bd4bcf342436e00f13122d19df8`, workflow de deploy aprobado. Ver `whatsapp-main-promotion-282-2910.json`. El bloqueo descrito debajo es histórico; staging aún requiere su siguiente actualización.

**Despliegue pendiente por conexión:** código `a4718b58` publicado en `origin/staging`. Tres conexiones SSH agotaron el tiempo antes de ejecutar el deploy; la API pública también agotó15s desde esta sesión. No se verificó runtime nuevo ni salud actual. Último runtime verificado:281 (`0a7e746e`). Reanudar despliegue y controles compilados al recuperar acceso. Evidencia `whatsapp-batch-282-staging-deployment.json`.

Base `68dbb4a9`. Amplía la corrección inmediata de una nota ya seleccionada: «perdón, al tercero», «no, al [nombre completo]» y «mejor al 2» mueven solo esa indicación y conservan las previas. «No, el otro» entre varios destinos pregunta; permite responder por número/nombre, elegir otro destino tras un conflicto o dejar la nota donde estaba. Repetir una corrección reconocible sin contexto no añade productos.

360 pruebas nuevas:192 traslados,128 guardas y40 recuperaciones en dos catálogos sintéticos, carritos de3/4líneas y agente simulado activo/inactivo. Baseline192fallos/0aprobadas; foco512/3. Global22953/348, inventario exacto y560fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-282-validation.json` y `whatsapp-batch-282-patterns.md`.

Solo líneas de una unidad y selección reciente (10min, sin renovar al aclarar), carrito intacto, sin otro flujo pendiente. Nombres duplicados, conflictos y referencias desconocidas preguntan sin mutar. Campo opcional de sesión `awaitingDestination`, sin SQL ni modelos nuevos. Pendientes: reparto/traslado con varias unidades, correcciones compuestas, «sin X ni Y», muestra reservada e integración real de canal/modelo.

Cero llamadas pagadas, Meta u órdenes externas; ledger267/256/11 intacto. Casos derivados de patrones reales, no replay completo de PDFs ni aprendizaje automático. Producción PPP sigue265; delta266–282 pendiente de Kamppo. Despliegue registrado por separado.


## VIGENTE — tanda281: exclusiones compuestas y selección entre tres platos (29/10)

Tanda281 publicada y desplegada en staging: código `0a7e746e`, imagen `sha256:60fbf91fdfd8924947d206ab4ddaf479986a40505776f8dd7e23150b46d4efda`, healthy,0reinicios, APIlocal/pública200. Controles compilados de exclusiones compuestas, selección y recuperación y previos aprobados; modelos, env/compose y producción PPP265 preservados. Evidencia `whatsapp-batch-281-staging-deployment.json`. Sin cambios en Kamppo durante esta tanda; delta lingüístico266–281 pendiente.

Base `8d6c0e53`. Cierra el límite de280 para «uno sin cebolla y sin tomate»: los recorridos compran los productos y envían la frase completa, sin inyectar la selección. Antes la nota podía ir al último de tres platos o afectar todas las unidades. Ahora pregunta destino o divide solo la unidad solicitada; conserva notas y precios. Número, nombre y reparación ordinal resuelven la selección pendiente; preguntas de total/repetición no la consumen. Incompatibilidades del mismo ingrediente exigen aclarar; elegir otro plato o retirar la indicación funciona sin borrar productos.

328 pruebas nuevas:128selecciones,48divisiones,64conflictos,64interrupciones,8recuperaciones y16límites puros. Baseline304fallos/0aprobadas; foco328/2 nuevas y390/5 vecinas. Global22593/347, inventario exacto y559fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-281-validation.json`; origen y alcance en `whatsapp-batch-281-patterns.md`.

Regla acotada a dos/tres exclusiones «sin… y sin…» de una misma unidad; no interpreta toda frase compuesta. La selección entre tres platos es anterior a aplicar la nota: no amplía «no, el otro» después de aplicarla. Siguen pendientes «sin X ni Y», compuestos mixtos/condicionales, traslado posterior entre3+líneas, muestra reservada e integración real de canal/modelo. Sin campos nuevos, SQL ni modelos cambiados.

Cero llamadas pagadas, Meta u órdenes externas; ledger267/256/11 intacto. Variantes sintéticas de patrones compartidos, no replay integral de PDF ni aprendizaje automático. Producción PPP sigue265; delta266–281 pendiente de Kamppo. Despliegue registrado por separado.


## VIGENTE — tanda280: matriz amplia de conversación y notas (28–29/10)

Tanda280 publicada y desplegada en staging: código `86380c39`, imagen `sha256:4fefb616b52858f977a99a22963848d2325e3e8e33627143a38e56622bbac7b2`, healthy,0reinicios, APIlocal/pública200. Controles compilados de contexto, contradicciones y previos aprobados; modelos, env/compose y producción PPP265 preservados. Evidencia `whatsapp-batch-280-staging-deployment.json`. Sin cambios en Kamppo durante esta tanda; delta lingüístico266–280 pendiente.

Base `4657bd29`. Tanda ampliada solicitada por el usuario: 352 pruebas nuevas en cuatro familias, controles de límites y continuación hasta una orden simulada. Fuentes: fragmentos de los PDF11/10 y18/10, chats compartidos y variantes sintéticas de la investigación previa. Trazabilidad y límites en `whatsapp-batch-280-patterns.md`; no es cobertura completa del corpus.

Corrige esperas («espera un momento», «déjame revisar», «ya te confirmo»), repetición («no entendí bien», «qué me habías preguntado») y total («cuánto queda todo») sin capturar nombres/direcciones ni confirmar. En traslado inmediato de notas, «poca/menos/extra/bajito de/aparte» del mismo ingrediente frente a «sin» exige aclaración y conserva el carrito. No cambia modelos, SQL ni el alcance de dos líneas de una unidad de279.

352/3 nuevas y358/5 vecinas aprobadas. Una global final: 22265/345, inventario exacto y557fuentes congeladas, TypeScript general/build y Node aprobados. Baseline contexto160fallos/80aprobadas; notas32 fallos de comportamiento reproducidos. Otros16fallos iniciales de notas eran contrato del test (tildes/selección compuesta), no correcciones del motor. Evidencia `whatsapp-batch-280-validation.json`.

Cero llamadas pagadas, Meta u órdenes externas; ledger267/256/11 intacto. Ocho pruebas compuestas arrancan con selección pendiente preparada: comprensión inicial de notas compuestas ambiguas y destinos entre3+platos sigue pendiente. No muestra reservada, medios/canal ni conversión. Producción PPP sigue265; delta266–280 pendiente de Kamppo. Despliegue registrado por separado.


## VIGENTE — tanda279: traslado inmediato de una nota recién aplicada (28/10)

Tanda279 publicada y desplegada en staging: código `f0617753`, imagen `sha256:927016ab3cbed2a6b25978d14f1cf895f84f7df02e006b93260bdc5cc32be338`, healthy,0reinicios, APIlocal/pública200. Controles compilados de traslado de nota y previos aprobados; modelos, env/compose y producción PPP265 preservados. Evidencia `whatsapp-batch-279-staging-deployment.json`. Sin cambios en Kamppo durante esta tanda; delta lingüístico266–279 pendiente.

Base `0ce5fb31`. Secuencia: dos platos → «uno sin cebolla» → «1» → «no, el otro» / «perdón, el otro» / «mejor el otro». Antes la nota permanecía en el primero. Ahora se restaura la nota anterior de origen y se añade solo la indicación recién elegida al segundo, conservando precios, cantidades y demás notas.

Alcance deliberado: selección resuelta por `pendingSubsetKitchenNote.byUnits`, dos líneas elegibles de una unidad y un cambio efectivo. Nuevo campo JSON opcional `lastKitchenNoteSelection`: carrito anterior, firma posterior, índice, nota y fecha. Sin SQL. Se consume al siguiente texto procesado; enlaces de ubicación, medios y takeover lo invalidan (reacciones ignoradas no cuentan como nueva instrucción). Firma distinta, más de10min, fecha futura, selección/pago pendiente o estado cerrado impiden trasladar. Repetir no vuelve a alternar. Una nota previa «con cebolla» obliga a aclarar frente a «sin cebolla». No generalizar esta comprobación a toda contradicción posible de cocina. Próximas pruebas: poco/menos/frente a sin, notas compuestas y destino nombrado entre tres líneas.

72 regresiones nuevas; baseline12fallos/0aprobadas y60 controles adicionales. Foco218/3. Global21913/342 aprobada, inventario exacto y554fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-279-validation.json`.

Cero llamadas pagadas, Meta y órdenes externas; ledger267/256/11 intacto. No prueba de inferencia real ni medios/canal. No se trasladan automáticamente notas entre tres líneas, cantidades múltiples, notas preexistentes sin cambio o cualquier otra ruta de edición. El campo opcional puede ignorarse en rollback; no reutilizar un contexto antiguo tras restaurar sesiones. Producción PPP sigue265; delta266–279 pendiente de Kamppo. Despliegue registrado por separado.


## VIGENTE — tanda278: aclaración ordinal de una nota pendiente (28/10)

Tanda278 publicada y desplegada en staging: código `58d6edcf`, imagen `sha256:ec8d0526d0228fec4b24f2bc4fbf6ea7b41c2ec7596c6e9e0ad0aa14a0071729`, healthy,0reinicios, APIlocal/pública200. Controles compilados de aclaración ordinal y previos aprobados; modelos, env/compose y producción PPP265 preservados. Evidencia `whatsapp-batch-278-staging-deployment.json`. Sin cambios en Kamppo durante esta tanda; delta lingüístico266–278 pendiente.

Base `3b3652f0`. Secuencia sintética: comprar dos platos distintos → «uno sin cebolla» → «no, el segundo», «perdón, el segundo» o «mejor el segundo». Antes esas respuestas no resolvían la nota. Ahora se reconoce la reparación completa y se reutiliza el selector de la nota pendiente. Sin cambios globales a la negación ni nuevas persistencias. «No el segundo», pregunta, posición inexistente y «el otro» sin antecedente conservan la elección pendiente. Una línea de tres unidades recibe la nota solo en una; responder durante revisión final no confirma.

44 regresiones nuevas, dos cartas×agente simulado off/on. Baseline12fallos/12aprobadas; 20 controles posteriores. Foco182/3. Global21841/341 aprobada, inventario exacto y553fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-278-validation.json`.

Cero llamadas pagadas, Meta y órdenes externas; ledger267/256/11 intacto. No acredita inferencia real ni temporización del canal. No se implementa traslado automático de notas ya aplicadas ante «no, el otro»: sigue pendiente evaluar memoria de la corrección y su vigencia. Referencia de diseño existente: `tryUndoLastUnitOptionEdit` y `lastUnitOptionEdit` guardan carrito anterior y firma; no reutilizar esa marca entre tipos de edición sin pruebas de vigencia. Producción PPP continúa265; delta266–278 pendiente de Kamppo. Estado de despliegue registrado por separado.


## VIGENTE — tanda277: pagar frente a cancelar y espera conversacional (28/10)

Tanda277 publicada y desplegada en staging: código `69ce65ea`, imagen `sha256:77a205bdf007785c26107e590200b3f07bfa216c62cf7eba8687dba2e33d2acf`, healthy,0reinicios, APIlocal/pública200. Controles compilados de pago/espera y previos aprobados; modelos, env/compose y producción PPP265 preservados. Evidencia `whatsapp-batch-277-staging-deployment.json`. Sin cambios en Kamppo durante esta tanda; delta lingüístico266–277 pendiente.

Base `e71b053b`. Investigación pública de RAE/ASALE/DEM y corpus de WhatsApp, contrastada con los chats compartidos. Fuentes, límites y prioridades en `whatsapp-regional-patterns-2810.md`. Ejemplos nuevos sintéticos, no transcripciones regionales de clientes.

«Quiero cancelar con efectivo/por transferencia» borraba el carrito; ahora la frase completa usa los métodos configurados, conservando las preguntas como consultas. Complemento desconocido/compuesto pide aclarar pagar o anular antes de mutar. «Quiero cancelar el pedido» sigue cancelando. Esperas completas como «ahorita te digo» y «dame un ratito» conservan datos y estado durante checkout, sin capturarse como dirección ni confirmar. Sin SQL ni cambios de modelos.

59 regresiones nuevas; baseline32fallos/0aprobadas (algunos son solo respuesta), 27 controles posteriores. Foco219/3. Global21797/340 aprobada, inventario exacto y552fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-277-validation.json`.

Modelos/servicios simulados; cero llamadas pagadas, Meta y órdenes externas. Ledger267/256/11 intacto. No acredita precisión del modelo real, acentos, cobertura por país ni conversión. Producción PPP sigue265; delta266–277 pendiente de Kamppo. Próximas tandas: mensajes fragmentados y reparaciones, alias locales ambiguos, cantidades/distribución, pago/cambio y muestra reservada; medios/canal requieren evaluación aparte.


## VIGENTE — tanda276: variantes básicas de bebidas y total (28/10)

Tanda276 publicada y desplegada en staging: código `d6d038de`, imagen `sha256:7e5f622467a84cb733cf1ad5426107eb75f431459801d5477f615c592217ede8`, healthy,0reinicios, APIlocal/pública200. Controles compilados de total/bebidas y previos aprobados; modelos, env/compose y producción PPP265 preservados. Evidencia `whatsapp-batch-276-staging-deployment.json`. Kamppo solo recibió la corrección del identificador (runtime973a072, healthy); delta lingüístico266–276 pendiente.

Base59923820. Derivadas de los reportes275: «qué hay para tomar», «qué tienes de beber», «me regalas algo de tomar», «todo el pedido», «el total», «de todo» ante aclaración de precio y cierres «no más, cuánto te debo»/«solo eso veci, cuánto llevo». Separamos solicitudes completas del total y navegación genérica; reutilizamos cierre y resumen canónico. «Todo» suelto solo refiere al total cuando hay consulta de precio pendiente; producto concreto/modificador/cantidad conserva su ruta. Preguntas no confirman ni inventan dirección.

75 regresiones nuevas: router completo con dos cartas sintéticas, agente simulado off/on, estados de carrito/dirección, controles de precio individual, compra concreta y revisión final; guardas puras adicionales. Baseline26fallos/34aprobadas en dos ejecuciones separadas (52total y8bebidas); 15guardas posteriores. Foco100/2. Global21738/339 aprobada, inventario exacto y551fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-276-validation.json`.

Modelos y servicios simulados; cero llamadas pagadas/Meta/órdenes externas; ledger267/256/11 intacto. No prueba de comportamiento del modelo real ni de conversión. Publicación/despliegue se registran por separado. Producción PPP sigue265; delta266–276 pendiente de Kamppo. No se modifica Kamppo en esta tanda. Pendientes: más combinaciones naturales, arranque original de dos ejecutivos, muestra reservada y medios/canal.


## VIGENTE — tanda275: bebidas, categorías y cierre con total (28/10)

Tanda275 publicada y desplegada en staging: código `3dbcb6a4`, imagen `sha256:77f0b375d4b30b5bd7f9f0f4ef24984b333267d07fb11e920f7f0a333b7f32a0`, healthy,0reinicios, APIlocal/pública200. Controles compilados de categorías/cierre y previos aprobados; modelos, env/compose y producción PPP265 preservados. Evidencia `whatsapp-batch-275-staging-deployment.json`. Kamppo solo recibió la corrección del identificador (runtime973a072, healthy); delta lingüístico266–275 pendiente.

Reportes nuevos desde Kamppo: «Quiero algo de tomar», «No maa», «tienes carne?» con postres, «no mas, cuanto es?» y «de todo lo que pedi» capturado como dirección. Corrección PPP: navegación genérica de bebidas antes de partir producto/dirección; categorías por palabra completa (res no coincide con Postres); errata completa de cierre; total del carrito y avance con revisión final obligatoria; aclaración del total conserva dirección y carrito. Sin nombres/IDs/precios de PPP en reglas. Las mejoras lingüísticas permanecen aquí para migración posterior.

25 regresiones nuevas; foco25/1. Global21663/338 aprobada, inventario exacto y550fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-275-validation.json`. Incluye controles de no confirmar ante pregunta, preservar carrito/notas, no cerrar rechazos parciales y distinguir ambas rutas de conceptos. Modelos y servicios simulados; cero llamadas pagadas/Meta/órdenes externas; ledger267/256/11 intacto. No acredita experiencia del modelo real ni conversión.

Corrección separada Kamppo `973a072`: identificador completo SHA-256 cuando excede64, claves cortas preservadas; API441 aprobadas/15liveomitidas, build aprobado. No se portó motor PPP. El estado de despliegue se registra por separado. Producción PPP continúa265; delta266–275 pendiente de Kamppo.

## VIGENTE — tanda274: saludo sin invitación a llamar (28/10)

Solicitud explícita del usuario: fomentar que prueben el chat quitando «Si quieres, también puedes llamarnos al…» del saludo. El prefijo queda «Con gusto te atiendo.». Cambia valor por defecto y limpia esa frase de plantillas antiguas mediante la normalización exclusiva de bienvenida. Sin persistencia, SQL ni cambio de modelos.

Una regresión existente actualizada, sin aumentar el número de pruebas. Foco113/2. Global21638/337 aprobada, inventario exacto y548fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-274-validation.json`. La tanda273 de repetición contextual ya quedó desplegada antes de este ajuste.

Cero llamadas pagadas, Meta y órdenes externas; ledger267/256/11 intacto. Código `0d5cb438` publicado y desplegado en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED. Tres controles compilados nuevos y46previos aprobados con dependencias aisladas; routing/modelos y guard central aprobados. Env/compose preservados y producción265 verificada sin cambios. Evidencia `whatsapp-batch-274-staging-deployment.json`; cierre documental posterior sin reconstrucción. Producción continúa265. Delta266–274 pendiente de portar a Kamppo. Pendientes: arranque original de dos ejecutivos, muestra reservada, medios/canal y piloto.


## VIGENTE — tanda273: repetir la pregunta sin capturarla como nombre (28/10)

Base `29868c3b`. Derivadas de «Dime?» en el chat compartido: «No entendi» y «Como asi veci» podían convertirse en nombre. Ahora las solicitudes completas de repetir muestran carrito/notas y siguiente pregunta; conservan nombre, sesión y pendientes sin confirmar. Duda nombre/conjunto y opciones mantienen prioridad. Preguntas concretas siguen su ruta normal; handler excluye cerradas/completadas. Sin nueva persistencia ni SQL.

108 regresiones nuevas, tres cartas×agente simulado off/on; baseline78fallos/12aprobadas, no todos son corrupción de datos, y18guardas posteriores. Foco372/4. Global21638/337 aprobada, inventario exacto y548fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-273-validation.json` e informe `whatsapp-checkout-repeat-question-validation-2810.md`.

Carrito preparado, no replay original integral; controles de cierre verifican exclusión del nuevo handler. Modelos/servicios externos simulados; cero llamadas pagadas, Meta y órdenes externas; ledger267/256/11 intacto. No se atribuye causalidad al silencio ni mejora de conversión. Código `1bb62f25` publicado y desplegado en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED. Tres controles compilados nuevos y43previos aprobados con dependencias aisladas; routing/modelos y guard central aprobados. Env/compose preservados y producción265 verificada sin cambios. Evidencia `whatsapp-batch-273-staging-deployment.json`; cierre documental posterior sin reconstrucción. Producción continúa265. Delta266–273 pendiente de portar a Kamppo. Pendientes: arranque original de dos ejecutivos, muestra reservada, medios/canal y piloto.


## VIGENTE — tanda272: conservar pin al aclarar conjunto (28/10)

Base `a8cc67e4`. Conserva ubicación enviada durante la duda nombre/conjunto, tarifa y apartamento al responder «es el conjunto». No modifica la cobertura ni permite confirmar fuera de ella. Distingue pin nuevo de uno guardado; segundo pin y calle nueva prevalecen. Campo JSON opcional `pendingRecipientOrPlacePin`, sin SQL. Coincidencia de coordenadas y enlace protege contra marcador antiguo; recogida/nombre/resolución limpian la marca. Antes de rollback resolver/cancelar normalmente borradores afectados.

54 regresiones nuevas, tres cartas×agente simulado off/on; baseline válido18fallos/18aprobadas y18guardas posteriores. Foco258/4. Global21530/336 aprobada, inventario exacto y547fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-272-validation.json` e informe `whatsapp-role-pin-recovery-validation-2810.md`.

Variantes derivadas, no chats nuevos de producción. Modelos/routing/servicios externos simulados; cero llamadas pagadas, Meta y órdenes externas; ledger267/256/11 intacto. No evalúa precisión geográfica real ni conversión. Código `7e82b147` publicado y desplegado en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED. Tres controles compilados nuevos y40previos aprobados con dependencias aisladas; routing/modelos y guard central aprobados. Env/compose preservados y producción265 verificada sin cambios. Evidencia `whatsapp-batch-272-staging-deployment.json`; cierre documental posterior sin reconstrucción. Producción continúa265. Delta266–272 pendiente de portar a Kamppo. Pendientes: recuperación «Dime?», arranque original de dos ejecutivos, muestra reservada, medios/canal y piloto.


## VIGENTE — tanda271: consultas coloquiales en pedidos sin cierre (28/10)

Base `7fb20775`. Derivadas del chat compartido de Estefani: «me regalas el Nequi», «me pasas tu Nequi», «a qué número transfiero», con cortesía y posesivos. Responde datos configurados y retoma el campo pendiente sin elegir pago, mutar carrito ni confirmar. Solicitudes mixtas siguen el router normal; «mi Nequi es…» no pregunta por la cuenta del comercio. No inventa datos ausentes. Sin persistencia ni migración nueva.

72 regresiones nuevas, tres cartas×agente simulado off/on; baseline42fallos/30aprobadas. Foco318/4. Global21476/335 aprobada, inventario exacto y546fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-271-validation.json`; registro de fuente, hipótesis y siguientes casos en `whatsapp-unfinished-checkout-learning-2810.md`.

Mejora supervisada por regresiones, no aprendizaje automático ni acceso nuevo a producción. No se atribuye el silencio al bot sin evidencia ni se mide mejora de conversión. Modelos/servicios externos simulados; cero llamadas pagadas, Meta y órdenes externas; ledger267/256/11 intacto. Código `4f70698b` publicado y desplegado en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED. Nueve controles compilados nuevos y31previos aprobados con dependencias aisladas; routing/modelos y guard central aprobados. Env/compose preservados y producción265 verificada sin cambios. Evidencia `whatsapp-batch-271-staging-deployment.json`; cierre documental posterior sin reconstrucción. Producción continúa265. Delta266–271 pendiente de portar a Kamppo. Pendientes: recuperación «Dime?», ubicación durante duda de conjunto, arranque original de dos ejecutivos, muestra reservada, medios/canal y piloto.


## VIGENTE — tanda270: interrupciones de nombre y lugar (28/10)

Base `fb0e2c6d`. Conserva calle y apartamento enviados antes de «es el conjunto»; recogida limpia la duda pendiente. Añadir un producto de catálogo durante la pregunta de nombre vuelve al flujo de compra; el nombre explícito posterior resuelve la duda. Las preguntas no compran ni deciden el rol. Campo JSON opcional `pendingRecipientOrPlaceAddress`, sin SQL; solo recuerda una calle aceptada durante la duda, nunca la dirección anterior guardada. Pin nuevo invalida la calle recordada; aclarar después el conjunto todavía puede requerir aportar de nuevo el destino. Antes de rollback, resolver/cancelar normalmente los borradores afectados.

54 regresiones nuevas, tres cartas×agente simulado off/on. Baseline24fallos/12aprobadas,18guardas adicionales. Foco426/6. Global21404/334 aprobada, inventario exacto y545fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-270-validation.json` e informe `whatsapp-checkout-role-interruptions-validation-2810.md`.

Modelos/servicios externos simulados; cero llamadas pagadas, Meta y órdenes externas; ledger267/256/11 intacto. Código `164da9cc` publicado y desplegado en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED. Tres controles compilados nuevos y28previos aprobados con dependencias aisladas; routing/modelos y guard central aprobados. Env/compose preservados y producción265 verificada sin cambios. Evidencia `whatsapp-batch-270-staging-deployment.json`; cierre documental posterior sin reconstrucción. Producción continúa265. Delta266–270 pendiente de portar a Kamppo; no se modifica ese repositorio. Continúan pendientes arranque original de dos ejecutivos, muestra reservada, medios/canal y piloto.

## VIGENTE — tanda269: espera y recuperación de nombre/lugar (28/10)

Base `61977986`. Continúa268: «Voy»/«ya te digo» en otro turno recibe espera sin modificar datos. «Es el barrio/conjunto» recupera el rótulo ambiguo y lo adjunta a la dirección posterior; «es mi nombre» resuelve destinatario. Consultas, afirmaciones vagas y preguntas sobre el rol no deciden por el cliente. Campo JSON opcional `pendingRecipientOrPlace`, sin SQL; guard central bloquea confirmación hasta resolverlo, incluso skipFinalConfirm. Reinicio/nombre nuevo explícito limpian la duda. Antes de rollback, resolver/cancelar normalmente los borradores afectados; no borrar datos.

114 regresiones nuevas, tres cartas×agente simulado off/on, DTO en espera/lugar y controles de confirmación directa, reinicio, consulta de pago, recogida y nueva compra. Baseline66fallos (24de respuesta de espera, sin corrupción del carrito) y6guardas adicionales de pregunta. Foco372/5. Global21350/333 aprobada, inventario exacto y544fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-269-validation.json` e informe `whatsapp-checkout-context-recovery-validation-2810.md`.

Variantes de salsas/servilletas después de confirmar no abren carrito ni simulan aplicación del cambio; el aviso no afirma que existe una orden solo por tener chat cerrado. Sin edición automática ni notificación de llegada. Modelos/servicios externos simulados; cero llamadas pagadas, Meta y órdenes externas; ledger267/256/11 intacto. Código `c34abea0` publicado y desplegado en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED. Tres controles compilados nuevos y25previos aprobados con servicios aislados; routing/modelos y guard central aprobados. Env/compose preservados y producción265 verificada sin cambios. Evidencia `whatsapp-batch-269-staging-deployment.json`; cierre documental posterior sin reconstrucción. Producción continúa265. Delta266–269 pendiente de portar a Kamppo; no se modifica ese repositorio. Continúan pendientes arranque original de dos ejecutivos, muestra reservada, medios/canal y piloto.

## VIGENTE — tanda268: nombre, Nequi y seguimiento posterior (28/10)

Base `87e47432`. Chats reales: «Natalia»+«Voy», «Me indicas el Nequi», cierre+rótulo ambiguo, salsas/aviso después de confirmar y reacciones. Conserva límites entre nombre y espera, responde datos de pago sin elegir método, procesa nombre+consulta en ráfaga y aclara destinatario frente a lugar. Después de confirmar, la solicitud de cambio se reconoce como no aplicada y se deriva al contacto del comercio; el aviso de llegada no se promete. Seguimiento con errata «sr demora» y minutos explícitos. Reacciones registradas sin respuesta.

78 regresiones nuevas; foco258/4. Global21236/332 aprobada, inventario exacto y543fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-268-validation.json` e informe `whatsapp-reported-checkout-followups-validation-2810.md`. Modelos/servicios externos simulados; no evaluación real del canal ni inferencia. Sin persistencia nueva. Cero llamadas pagadas, Meta u órdenes externas; ledger267/256/11 intacto. Código `f9f7701d` publicado y desplegado en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED. Siete controles compilados nuevos y18previos aprobados con servicios aislados; routing/modelos y guard central aprobados. Env/compose preservados y producción265 verificada sin cambios. Evidencia `whatsapp-batch-268-staging-deployment.json`; cierre documental posterior sin reconstrucción. Producción continúa265. Delta268 pendiente de portar a Kamppo, junto con266–267.

No implementa edición automática de pedidos confirmados ni notificación de llegada. Rótulos ambiguos necesitan aclaración. Continúan pendientes muestra reservada, medios/canal y arranque de dos ejecutivos; no declarar vendible solo por esta batería.


## VIGENTE — tandas266–267: cambio de ejecutivo por presa y retirada negada (28/10)

Base `5225ccb3`, después de promover265 a producción. Reporte del28/10: «Cambiame El De pechuga con Pollo broaster» añadía un pollo entero; «No no quiero Un Pollo quitalo» abría carta; la explicación con «sink» listaba broaster.266 identifica la línea por opción/nota y busca otra preparación de la misma familia del catálogo. Conserva opciones compatibles, notas, cantidad y resto del carrito; no añade proteína suelta.267 interpreta rechazo+quítalo como retirada. «Quiero cambiar un ejecutivo» pide dueño y preparación sin comprar.

98regresiones nuevas, tres cartas sintéticas×agente simulado off/on y fixture PPP. Baseline corregido26/26rojo. Foco206/206 en cinco suites. Global21158/331 aprobada en cuatro bloques disjuntos, inventario exacto y542fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-266-267-validation.json` e informe `whatsapp-reported-executive-style-validation-2810.md`.

Inicio desde el carrito correcto mostrado por el usuario, sin certificar de nuevo la inferencia del saludo/«limo da» ni la selección inicial. Las dos pruebas exploratorias del arranque con modelo vacío se descartaron como evidencia de defecto productivo. Pendientes ambiguos, incompatibilidad de opciones, pago, cantidades, preguntas y catálogo no disponible conservan el pedido. Sin nueva persistencia/esquema. Cero inferencia pagada, Meta u órdenes externas; ledger267/256/11 y modelos intactos. Producción continúa265. Código `ac8c2cd5` publicado y desplegado solo en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED;18controles compilados nuevos/previos y guard central aprobados con servicios externos aislados. Env/compose/modelos intactos; producción265 verificada sin cambios. Evidencia `whatsapp-batch-266-267-staging-deployment.json`; commit posterior documental, sin reconstrucción. Delta266–267 pendiente de portar a Kamppo; no se modificó ese repositorio.

## DESPLIEGUE VIGENTE — Main/producción hasta tanda265 (28/10)

Solicitud explícita «despliega main». `origin/Main` promovido por fast-forward de `bc791e29` a `2eaa0d61` (runtime `f0ae0d00`), con las tandas245–265 validadas en staging. Producción ejecuta imagen `sha256:c50f5be01a0944c54a75980e1d9e231b50fbb447a735cfb89f0cdccd1ed6c6f3`, running,0reinicios; APIlocal/pública200, DBconnected/circuitCLOSED.16controles compilados y guard central aprobados con dependencias aisladas; hashes de los cinco módulos auditados coinciden con staging. Global previa21.060/330, TypeScript general/build y Node aprobados;541fuentes siguen iguales. No se repitió la global para promover código idéntico.

`.env`, compose privado, modelos y datos preservados; sin migración SQL, llamadas pagadas, Meta ni órdenes externas de prueba. Imagen previa etiquetada `ppp-nest-api:rollback-before-265`. Antes de rollback a244 resolver/cancelar normalmente borradores con nuevos planes pendientes; no borrar datos de clientes. Evidencia `whatsapp-main-promotion-265-2810.json`. El commit posterior solo registra documentación y no requiere reconstrucción.

Continuar las tandas en `staging`. Este despliegue no cierra todos los chats/PDF ni acredita evaluación independiente de modelos, medios, canal o piloto. Pendientes y límites de265 siguen vigentes. Las menciones históricas a producción244 más abajo quedan superadas por esta verificación.

## VIGENTE — tanda265: aclaración corta de retirada múltiple (28/10)

Base `4290ddd4`. CHAT2510-28 derivado: «el de costillas» resuelve la lista activa sin convertirse en compra. Se guarda la retirada múltiple como grupos de líneas y se aplica solo al aclararlos todos. Número, nombre distintivo y nota; firma de carrito, cancelación, pago/otras selecciones y confirmación central protegidos. Sin nombres/IDs PPP en runtime.

96regresiones nuevas en tres cartas sintéticas×agente simulado off/on; baseline12/12rojo. Foco360/360 en seis suites. Global21060/330 suites aprobada en cuatro bloques disjuntos, inventario exacto y541fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-265-validation.json`, informe `whatsapp-multiple-removal-followup-validation-2810.md`.

Límites: carrito preparado, no replay original completo, ni inferencia/canal/audio/PDF reales. Pendientes compuestos restantes y muestra reservada/modelos/medios/canal antes del piloto. Cero llamadas pagadas, Meta u órdenes reales; ledger267/256/11 y modelos intactos. Nuevo campo JSON opcional `pendingCartRemoval.batchGroups`, sin migración SQL; antes de volver a una imagen anterior, resolver/cancelar normalmente los borradores afectados: la imagen vieja ignora el grupo. Producción no modificada. Código `f0ae0d00` publicado y desplegado solo en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED;16controles compilados nuevos/previos y guard central aprobados, con servicios externos aislados. Env/compose/modelos intactos; producción244 verificada sin cambios. Evidencia `whatsapp-batch-265-staging-deployment.json`. Commit posterior documental, sin reconstrucción.

## VIGENTE — tanda264: retirada múltiple abreviada (28/10)

Base `49259ac5`. Tanda de cobertura, sin cambio de runtime: 24 recorridos nuevos derivados de CHAT2510-28 con tres cartas sintéticas y fixture PPP × agente simulado off/on × construcción/pago/confirmación. «El pollo y el combo de arroz» y el título incompleto conservan todo el carrito; repetir la instrucción completa con nombres exactos retira solo los dos productos. Se preservan productos similares, cantidades y notas hasta DTO/recibo; repetir la retirada no elimina los restantes.

Foco 264/264 en 5 suites y TypeScript general aprobados. No nueva global: solo suite nueva y documentación; última global vigente del runtime20.940/328 (262–263), sin sumar esta tanda como una global ejecutada. Evidencia `whatsapp-batch-264-validation.json` y `src/whatsapp/whatsapp-multiple-removal-clarification.spec.ts`.

Límite: carrito inicial preparado, sin atributos PPP; no recorrido original completo ni respuestas de aclaración con solo un nombre/número. Siguiente: aclaración incremental sin repetir toda la orden, compuestos pendientes y evaluación reservada/modelos/medios/canal antes del piloto. Cero llamadas pagadas, Meta u órdenes reales; ledger267/256/11 intacto. Sin despliegue nuevo: runtime staging sigue9036bfe3; producción no modificada.

## VIGENTE — tandas262–263: arranque del combo y recibo textual (28/10)

Base `9a8dfe94`. CHAT2510-08 alimentario desde «plato frito»/«en combo», Pepsi, consulta, yuca, ajíes y segunda corrección hasta DTO/recibo. Ráfaga controlada y turnos separados en tres cartas sintéticas×agente simulado off/on. El pendiente de bebida en conversión ya era correcto: no cambiarlo.262 reconoce seguimiento etiquetado de bebida para un dueño/una unidad;263 muestra notas por línea y generales en el recibo textual.

37casos nuevos, foco207/207; baseline corregido12/12rojo (6bebida ignorada,6recibo sin notas). Global20.940/328suites aprobada, cuatro bloques disjuntos, inventario exacto y539fuentes src sin cambios; TypeScript general/build y Node92/92 aprobados. Evidencia `whatsapp-batch-262-263-validation.json`. Evidencia `whatsapp-combo-burst-receipt-2810.json`, informe `whatsapp-combo-burst-receipt-validation-2810.md` con ajustes de oráculo explícitos. Notas distintas/consolidadas, totales, pagos pendientes y adicionales separados protegidos.

No prueba de Meta ni tiempos históricos exactos, PDF ni domicilio/contacto original. Pendientes28/referencias abreviadas y otros compuestos; después muestra reservada/modelos/medios/canal y piloto. Cero inferencia pagada, Meta u órdenes reales; ledger267/256/11, modelos y producción244 intactos. Sin nuevo esquema/persistencia. Código `9036bfe3` publicado y desplegado solo en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED; doce controles compilados nuevos/previos y guard central aprobados, servicios externos aislados. Env/compose/modelos intactos y producción244 sin cambios. Evidencia `whatsapp-batch-262-263-staging-deployment.json`; commit posterior documental, sin reconstrucción.

## VIGENTE — tandas260–261: ajíes y segunda corrección del combo (28/10)

Base `3dfdf543`. CHAT2510-08 desde compra canónica con Pepsi: consulta de composición, sustitución por yuca, petición de dos ajíes y segunda corrección.260 conserva el suministro contado como solicitud para cocina, sin borrar notas ni multiplicar cantidad; si se vende en carta aclara producto/precio.261 reconoce la segunda forma coloquial y aclara cantidad/línea/ingrediente ambiguos, conservando pendientes y notas.

80 pruebas nuevas, tres menús×agente simulado off/on, foco147/147. Baseline6/6ajies perdidos;18controles de segunda corrección detectaron respuestas genéricas sin mutación. Se fortaleció respuesta explícita además de carrito/DTO. Global20.903/327suites aprobada, cuatro bloques disjuntos, inventario exacto y538fuentes src sin cambios; TypeScript general/build y Node92/92 aprobados. Evidencia `whatsapp-batch-260-261-validation.json`. Evidencia `whatsapp-combo-condiment-2810.json` e informe `whatsapp-combo-condiment-validation-2810.md`.

No replay completo08: faltan arranque en ráfagas, primera elección bebida, domicilio/contacto y renderrecibo/PDF. Pendientes28/referencias abreviadas y otros compuestos, evaluación reservada/modelos/medios/canal y piloto. Sin inferencia pagada, Meta u órdenes externas; ledger267/256/11, modelos y producción244 intactos. Sin nueva persistencia/esquema. Código `c41b56d2` publicado y desplegado solo en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED; diez controles compilados nuevos/previos y guard central aprobados, servicios externos aislados. Env/compose/modelos intactos y producción244 sin cambios. Evidencia `whatsapp-batch-260-261-staging-deployment.json`; commit posterior documental, sin reconstrucción.

## VIGENTE — tandas258–259: lenguaje coloquial de combos (28/10)

Base `344ded5f`.258 normaliza «combito»/«de combo» dentro de compra explícita;259 distingue la opción final «y <atributo> <valor>» de otro plato solo por coincidencia exacta con el catálogo del combo. Conserva preguntas, cantidades separadas, bebida previa y adicional explícita. Sin nombres/IDs/precios PPP en runtime.

60 regresiones sintéticas nuevas derivadas de los reportes, tres menús × agente simulado off/on; foco180/180. Baseline36:26verdes/10rojas. Global20.823/326suites aprobada en cuatro bloques seriales disjuntos, inventario exacto y537fuentes de src congeladas; TypeScript general/build y pruebas Node aprobados. Evidencia `whatsapp-batch-258-259-validation.json`. Informe `whatsapp-colloquial-combos-validation-2810.md`, evidencia `whatsapp-colloquial-combos-2810.json`. No es muestra independiente ni nueva evaluación acústica/modelo. Ledger267/256/11 y espejo, modelos y producción244 intactos; cero inferencia pagada, Meta u órdenes reales. Sin nueva persistencia/esquema.

Estado del plan: seguimos cerrando recorridos reales y lenguaje natural; pendientes08/28 y otros compuestos/repartos no cubiertos, después muestra independiente/modelos/medios/canal y piloto supervisado. Código `90edb4ee` publicado y desplegado solo en staging: healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED; siete controles nuevos/previos compilados y guard central aprobados, servicios externos aislados. Env/compose/modelos intactos y producción244 sin cambios. Evidencia `whatsapp-batch-258-259-staging-deployment.json`; commit posterior documental, sin reconstruir.

## VIGENTE — tandas256–257: tres audios reales y sus opciones (28/10)

Base local255 `411fcafe`, sin desplegar255 por los nuevos reportes. Tres archivos aportados coinciden por SHA256 con webhooks/transcripciones guardadas de staging.256 conserva el reparto completo por unidad y pide preparación de la familia antes de comprar; selección y commit atómicos, bloqueo central de confirmación.257 procesa compra nueva de combo antes de correcciones del carrito y normaliza «de combo» en esa compra; no añade bebida suelta ni cambia ejecutivos previos. Conserva bebidas preexistentes.

Baseline12/12rojo sobre255.88 casos nuevos, foco354/354 en8suites, tres familias sintéticas × off/on y entrada texto/audio. Audio/transcripción/modelo/Meta/órdenes simulados en tests; usar la transcripción guardada NO es nueva evaluación acústica. Global final20.763/325suites aprobada, inventario exacto en cuatro bloques seriales disjuntos,640fuentes congeladas, TS general/build y Node92/92; evidencia aprobada en `whatsapp-batch-256-257-validation.json`. Trazabilidad `whatsapp-reported-audio-2810.json` e informe `whatsapp-reported-audio-validation-2810.md`.

Contrato: dos unidades, atributos completos, variante común elegida; no todos los repartos mixtos ni notas compuestas ni el histórico con colombina desconocida. Pendientes08/28 y muestra independiente/medios/canal/piloto. Nuevo campo opcional JSON `pendingMatch.unitAttributeGroups`, sin migración; imagen anterior no lo entiende: cancelar/reiniciar borradores de prueba afectados antes de rollback, sin borrar clientes. Presupuesto267/256/11, cero inferencia pagada; modelos/env/compose/Main/producción244 intactos. Código `dae4821e` publicado y desplegado en staging: running/healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED. Cinco controles nuevos compilados, guard central y rutas/modelos aprobados con servicios externos aislados. Env/compose/modelos intactos; imagen/rollback en `whatsapp-batch-256-257-staging-deployment.json`. Producción244 sin cambios. Commit posterior solo documental, sin reconstrucción.

## VIGENTE — tanda255: combo con bebida y auditoría del arroz (28/10)

Base `f606a423`, staging. Reporte «quiero un pollito frito en combo con gaseosa colombiana con las arepas fritas»: baseline2/2rojo, el atajo de sabores interceptaba la comida antes de inferencia. Se conserva el plato al diferir comida+bebida y adelantar la resolución existente de familia para compra explícita de combo único, con cantidad/opciones. Preguntas/múltiples/extras conservan sus rutas. Tres cartas con Pollo/Pescado/Tofu; sin excepciones PPP en runtime.

La traza de solo lectura del episodio está en staging: el1 SÍ añadió Arroz Con Pollo; después hubo consulta de bebidas y otra de jugos omitidas del fragmento pegado. No se confirma fallo de navegación ni se modifica esa lógica. No atribuir el fallo de combo al cambio a Luna: ocurre antes del modelo; sin comparación real nueva.

32 pruebas nuevas, foco136/136 en5suites. Global20.675/324suites aprobada en cuatro bloques seriales disjuntos,639fuentes congeladas, TS general/build y Node92/92; evidencia `whatsapp-reported-combo-2810.json`, `whatsapp-reported-combo-validation-2810.md` y al cierre `whatsapp-batch-255-validation.json`. Sin inferencia pagada, Meta ni órdenes externas; ledger267/256/11 y modelos intactos. Main/producción244; tanda255 incluida en despliegue conjunto255–257 verificado (`dae4821e`). Después retomar pendientes254: compuesto completo05, variantes ambiguas/notas diferentes, recorridos08/28 y muestra independiente/medios/canal/piloto.

## VIGENTE — tandas252–254: opciones comunes y variantes previas (28/10)

Base `fff31892`, staging.252 aplica «De <atributo> sería[n] los/las dos <opción>» por catálogo a dos unidades del mismo dueño, con plural simple único.253 reparte variantes ya separadas solo cuando notas/precio/atributos no modificados coinciden; si difieren pide aclaración sin mutación.254 verifica cláusula real extraída «los dos ajiacos» con sopa inicial Menudencias, dos presas, limonadas incluidas y adicional separado hasta DTO; checkout y aclaración añadidos, NO replay del compuesto original completo.

64 casos nuevos en tres menús y PPP, agente simulado off/on. Baseline12/12 rojas; foco final194/194 en5suites. Conserva notas/otros pendientes, repetición segura y DTO con opciones. Global aprobada20.643/323suites, inventario exacto,638hashes sin cambios, TS general/build y Node92/92. Un bloque exploratorio solapado se terminó y se excluye; los cuatro bloques aprobados cubren todo el inventario. Evidencia `whatsapp-shared-variants-2810.json`, `whatsapp-shared-variants-validation-2810.md` y `whatsapp-batch-252-254-validation.json` al cierre.

Pendientes: compuesto original con sopa común y presa desconocida; reparto ambiguo inicial con variantes ya separadas, notas diferentes con dueño explícito, recorridos08/28; después muestra independiente/modelos/medios/canal y piloto. Cero inferencia pagada, Meta, mapas u órdenes externas. Ledger267/256/11; modelos y Main/producción244 intactos. Código `4f825895` publicado y desplegado solo staging: running/healthy,0reinicios, APIlocal/pública200, DBconnected/circuitCLOSED;3controles nuevos compilados y guard central aprobados. Env/compose/modelos intactos; imagen/rollback en `whatsapp-batch-252-254-staging-deployment.json`. Commit posterior documental, sin reconstrucción. Sin cambio de esquema/env/compose.

## VIGENTE — tandas249–251: arranque y aclaración del reparto real (28/10)

Base `83142c21`. Fase del plan: recorridos reales y cierre seguro, antes de muestra independiente/modelo/canal y piloto supervisado. CHAT2510-05 se reproduce desde sus primeros cinco mensajes: dos ejecutivos, sopa/presas, limonada incluida y adicional. Se detectó que verificar solo cantidad dejaba pasar dos presas iguales y bebida errónea. Oráculo fuerte2/2rojo en base anterior; no atribuirlo a Luna.

249 conserva el reparto dudoso sin aplicar una opción a todas las unidades. Un pendiente tipado de sesión bloquea el cierre también en la función central de creación con skipFinalConfirm.250 resuelve el seguimiento corto de bebida incluida, conserva extra separado, mantiene preguntas sin mutación y reutiliza la aclaración/continuación de dueño y selecciones existentes. Peticiones corteses mantienen el handler anterior.251 completa una rama de aclaración con opciones reales y DTO: dos ejecutivos distintos, dos bebidas incluidas y un extra; protege otros pendientes y no divide una parte mientras el reparto completo sigue dudoso.

92regresiones nuevas (2fuente+48bebida+42pendientes), foco439/439en9suites. Global final20.579/322suites, bloques3.888+3.643+12.961+87, inventario exacto y637hashes congelados; TS general/build y Node92/92 aprobados. Se documentan3regresiones iniciales de etiqueta y2de petición cortés, corregidas sin cambiar expectativas; la global final recorre todo de nuevo. Evidencia `whatsapp-batch-249-251-validation.json` y `whatsapp-executive-initial-journey-2810.json`.

NO es el chat original completo ni evaluación independiente: se añade aclaración de presa y checkout sintético. No equiparar colombina con otra presa. Parte de una sola fila de cantidad dos; variantes ya divididas y opciones comunes no-default necesitan otra tanda. El fixture original ya trae Ajiaco por defecto. Siguiente: comunes no-default/reconciliación de variantes y replays restantes08/28 (combo/ajíes/segunda corrección y referencias abreviadas); después muestra real reservada, medios/canal y piloto. No volver a contar pruebas aisladas como porcentaje del corpus.

Sin inferencia pagada, Meta, mapas ni órdenes externas; ledger267/256/11 y espejo intactos. Modelos efectivos conservados. Main/producción siguen244. Publicado y desplegado código `ac11574c` en staging, verificado28/10: running/healthy,0reinicios, APIlocal/pública200, DBconnected y circuitoCLOSED. Guard central compilado bloqueó confirmación directa con dependencias simuladas. Env/compose/modelos intactos; imagen/rollback en `whatsapp-batch-249-251-staging-deployment.json`. Commit posterior solo documental, sin reconstrucción. Nuevo campo opcional JSON, sin cambio de esquema: una imagen anterior no entiende ese pendiente; antes de revertir staging, cancelar/reiniciar borradores de prueba afectados, sin borrar datos de clientes. Mantener grupos3–5 con foco y validación final en bloques cortos.

## VIGENTE — tandas245–248: huecos de tres chats reales (28/10)

Base `bc791e29`, staging.245 retira dos productos nombrados como una operación completa o aclara sin mutación parcial.246 conserva bebida/cantidad al pedir acompañamiento distinto para un plato ya comprado.247 corrige un error como «papa salda» solo con candidato único en la descripción del mismo plato.248 reconoce «un ejecutvo va conpierna pernil y con limonada» como cambio de una de dos unidades existentes, no como tercer ejecutivo; reutiliza el plan de opciones, repetición y DTO.

173regresiones nuevas:50retiro+54acompañamiento+13descripción+56opciones; incluye tres menús×agente simulado off/on, fragmentos PPP y controles puros. Foco455/455 en11suites. Validación final20.487/319suites, cuatro bloques seriales disjuntos (3.888+3.643+12.869+87), inventario exacto y634hashes intactos; TS general/build y Node92/92 aprobados. Un intento largo anterior terminó143 sin informe completo y NO se cuenta; los bloques finales recorrieron todo el inventario de nuevo. No aumentar timeouts ni volver a usar un proceso que exceda el límite de duración del entorno.

Fuente privada chat.txt con SHA original intacto; CHAT2510-05/08/28 tienen trazabilidad exacta de fragmentos, montaje y límites en `whatsapp-real-chat-followups-2810.json` y su informe `whatsapp-real-chat-followups-validation-2810.md`. NO se declaran los tres chats completos ni todo el corpus resuelto.05 aún requiere reparto inicial de sopa/presas/bebidas y extra;08 arranque pollo→combo, ajíes y segunda redacción;28 referencias abreviadas/ambiguas y flujo completo. Mantener el oráculo del catálogo: colombina no equivale a otra presa por suposición. No más paráfrasis de estas familias sin avanzar en esas secuencias.

Cero API pagada, Meta, mapas u órdenes externas; modelos simulados, sin medición nueva de Luna/Sol/medios. Ledger267/256/11 y espejo intactos. Main/producción permanecen en244; modelos efectivos no cambian. Publicado y desplegado código `47c9f407` en staging, running/healthy,0reinicios, APIlocal/pública200, DBconnected y circuitoCLOSED;3controles de modelo y2de descripción compilados aprobados. Env/compose/modelos intactos; imagen y rollback en `whatsapp-batch-245-248-staging-deployment.json`. Commit posterior solo documental, sin reconstrucción. Continuar trabajo en staging; mantener grupos3–5 con foco por tanda y una validación final de inventario completo.

## VIGENTE — tanda244: texto económico y coherencia del pedido (28/10)

Luna para texto habitual, Sol elegido antes de herramientas en condiciones/repartos explícitos, mediante WHATSAPP_AGENT_COMPLEX_MODEL opt-in. Luna sola tuvo max_iterations en un compuesto; no usarla como reemplazo universal ni repetir acciones aplicadas. Dos recorridos reales completos (8+13turnos), ambos con DTO, y controles Sol aprobados. Inferencia aislada, cero Meta/órdenes externas. Visión/apoyo Luna y audio GPT-Transcribe conservados.

Corregidos aviso de omisión explícita por catálogo y nota positiva de bebida vieja tras cambiar atributo.41regresiones nuevas, tres cartas. Foco157/157. Validación consolidada20.314/315suites: primera pasada18fallos en dos mocks antiguos, corregidos solo esos mocks y repetidas completas45pruebas; temporizadores87/87, TS general/build y Node92/92 aprobados. No una única global verde; inventario exacto y runtime congelado. Evidencia `whatsapp-batch-244-validation.json`.

Comparación conocida de desarrollo, no muestra independiente: mixto USD0.01391572 por dos recorridos frente a controles Sol USD0.17051610, cachés/rondas distintas; no ahorro de producción garantizado.69intentos totales incluidos fallos, USD0.19627041 estimados, ledger267/256/11 y espejo sincronizado. Ver `whatsapp-text-economy-evaluation-2810.md` y resultadosJSON. Sigue pendiente evaluación integral chat.txt/PDF y medios reales; no declarar todos corregidos ni vendible por conteos.

Publicado en staging y Main y desplegado en ambos: código `9f94ef70`, verificado28/10 a10:37Bogotá. Staging running/healthy; producción running sin healthcheck Docker,0reinicios, ambas API local/pública200, DBconnected y circuitoCLOSED. Modelos efectivos comprobados; cinco módulos compilados idénticos entre entornos. Evidencia/imágenes/rollback en `whatsapp-batch-244-deployment.json`. Commit posterior solo documental, sin reconstrucción. Preservar compose/env/backups/bases/volúmenes y archivos generados locales. Continuar nuevas tandas en staging con foco y una global por grupo de3–5, evitando repetir global por cambios solo documentales.

## VIGENTE — tandas 241–243: tres pendientes históricos corregidos (28/10)

Base '320c5785', staging. 241 distingue el arranque logístico «Para que porfa para 1 domicilio» de una dirección real; conserva destinos válidos. 242 un título completo con «el/la» cambia la preparación de la familia existente mediante el reemplazo atómico, conserva cantidades/opciones compatibles y no compra otra unidad; repetir es seguro y una pregunta no autoriza el cambio. 243 resuelve un único combo por su título completo de componentes más bebida configurada aunque no se diga «combo»; conserva preparación, cantidad y bebida numérica. Sin excepciones por productos/IDs/precios PPP.

94 pruebas nuevas (20+34+40); foco359/359 en10 suites. Históricos originales22/28→28/28 (14 formulaciones×agente simulado off/on), expectativas intactas. NO equivalen a los28 recorridos completos delimitados en chat.txt ni a todo el PDF: falta una evaluación integral del corpus.

Global única del grupo en dos fases disjuntas y seriales:20.273/20.273 en312 suites; resto20.186/310 a 4 workers y temporizadores87/2 aislados, sin reintentos ni aumentar timeouts. Inventario exacto,623 hashes intactos, TypeScript general/build y Node7/7 aprobados. Evidencia 'docs/whatsapp-batch-241-243-validation.json'; informe 'docs/whatsapp-historical-closures-validation-2810.md'. Cadencia autorizada por usuario: 3–5 tandas relacionadas con foco por tanda y una global al cierre.

Límites: título definido completo y familias de preparación reconocidas, no anáforas universales; combo implícito con componentes completos y bebida explícita, no toda combinación libre. Próximo: trazabilidad por conversación del archivo/PDF y replays completos no reproducidos; variantes/opciones de los repartos fuera del contrato 239–240. Sin inferencia real/Meta/mapas/órdenes externas ni deploy. Modelos/Main intactos. Publicación pendiente por DNS de GitHub; servidor staging 231/producción 235 según relevo, sin consulta nueva.

## VIGENTE — tanda 240: reparto y edición de una unidad validados (28/10)

Base publicada `323f6143`, rama `staging`. Se retoman y conservan las correcciones locales239–240: reparto de dos unidades con nota común y notas propias, extra explícito separado y retirada de una nota positiva solo cuando ordinal absoluto, nombre completo y unidad coinciden. No modifica la otra fila ni el paso de checkout.

Validación final:20.179/20.179 pruebas en309suites, dos fases disjuntas sin solaparse ni reintentos (resto20.099/308 y ráfagas80/1). Inventario exacto;620hashes intactos. TypeScript general y de build aprobados;7pruebas Node aprobadas. Evidencia durable `docs/whatsapp-batch-240-validation.json`; informe `docs/whatsapp-shared-serving-edit-validation-2810.md`. La global previa interrumpida no se cuenta.239 conserva su historial de un timeout bajo carga; esta ejecución final valida el conjunto actual.

Límites: dos unidades con gramática delimitada; retiro de nota existente por posición absoluta y nombre completo, una unidad por fila. No cubre todos los repartos, opciones, anáforas ni notas compuestas. Próximo: reparto con opciones de catálogo y consultas combinadas; siguen pendientes históricos de preparación sin añadir, 7 up y saludo/destino. No afirmar todos los chats/PDF corregidos ni vendibilidad por conteos.

Sin inferencia real/Meta/mapas/órdenes externas ni despliegue. Modelos/Main intactos. Servidor staging231 y producción235 según relevo, sin consulta nueva. Cierre local; publicación pendiente: GitHub no resuelve desde el entorno reanudado. HEAD coincide con la última referencia local origin/staging; no confundir con verificación remota nueva.

## VIGENTE — tanda 238: diagnóstico de reparto y notas compartidas (27/10)

Base `9e9e5868`, staging.32 casos nuevos opt-in:30 en tres menús×agente simulado off/on×notas/notas compartidas/elipsis/extra/pago, más2del chat real. Resultado6verdes/26rojos; los6verdes completan DTO. No se agregan al inventario aprobado ni se declara corregido el caso.

Localizado: expandSpokenSameSkuNotes descarta nota común al reescribir; elipsis de acompañamiento cae a compra/rechazo; con extras puede perder nota de una unidad. Próximo: plan estructurado total/unidades/notas/atributos/extras, sin resegmentar texto y sin mutación parcial. Informe y evidencia: `docs/whatsapp-shared-serving-diagnostic-2710.md` y `.json`.

TypeScript general aprobado; runtime intacto, no nueva global necesaria. Última validación consolidada237:20.036/306 con límites documentados. Sin API/Meta/mapas/órdenes externas. Main/producción235 y servidor staging231 intactos. No todos los chats/PDF corregidos.

## VIGENTE — tanda 237: pedidos hablados y cierre simulado (27/10)

Base `e132dd91`, staging. Conserva cortesía final fuera del nombre, porciones adicionales, bandeja como contenedor cuando el catálogo lo permite, negación con cantidades/typos y acompañamientos tras nombres con «con». Reglas por catálogo, sin IDs/precios/nombres PPP en producción. Informe: `docs/whatsapp-spoken-order-repairs-validation-2710.md`.

42 regresiones en tres menús × agente simulado off/on:30 de interpretación y12 hasta DTO. Históricos20/28 (antes10/28); quedan cambio de preparación de ejecutivo sin añadir, 7 up, saludo de domicilio como destino y reparto de dos sopas. NO todos los chats/PDF corregidos.

Validación consolidada20.036/306 suites: primera global20.021/20.024 con3timeouts, suite de ráfagas repetida completa80/80 con timeout normal; spec ampliado42/42. No una única global verde. Runtime sin cambios entre ejecuciones; snapshot final intacto. TS general/build y Node92 aprobados. Evidencia `docs/whatsapp-batch-237-consolidated-validation.json`. Sensibilidad temporal aún pendiente de causa definitiva; no elevar timeout por rutina.

Siguiente: reparto de dos unidades con nota compartida y notas distintas, controles de extras explícitos, interrupciones de pago/dirección y DTO; matriz en `docs/whatsapp-batch-237-independent-review-2710.md`. Sin API pagada/Meta/mapas/órdenes externas. Main/producción hasta235 sin cambios; staging servidor231,232–237 pendientes de despliegue agrupado. No declarar vendible por conteos.

## DESPLIEGUE VIGENTE — Main/producción hasta tanda235 (26/10,23:04 Bogotá)

Solicitud explícita del usuario. Main local y origin/Main promovidos por fast-forward de `a935f555` a `4323399237be485633083325269e799202f5e7c4`. Producción `/var/www/ppp-nest` ejecuta ese código; imagen activa `sha256:bc59fd2608d760f7d4fb62071a181cfba15d010e051ce2a0d34afa0366f6a09c`, running,0reinicios. Health local/público OK, DBconnected, circuitoCLOSED; lógica de sustitución compilada comprobada. Modelos iguales a staging. Validación235:19.952/304 suites.

Preservados compose/.env/backups privados, bases/volúmenes y472archivos generados locales. Rollback `ppp-nest-api:rollback-before-43233992`. Primer health durante arranque tuvo conexión reiniciada; segunda comprobación pasó. Evidencia `docs/whatsapp-main-promotion-2610.json` y /tmp/ppp-235-main-deploy.log.

Staging rama conservada, contenedor sin cambios en231 `1f0a2f8c`, por tanto232–235 pendientes de deploy únicamente en staging. Continuar trabajo en staging. Main desplegado no significa todos los chats corregidos; pendientes históricos y límites235 siguen vigentes. Sin API pagada/WhatsApp/órdenes externas de prueba.

## VIGENTE — tanda 236: sustitución pendiente frente a cambios del carrito (27/10)

Base `44bf3917`, staging. La elección pendiente de la tanda 235 sigue coherente si el carrito cambia antes de responder: quitar el plato dueño la descarta, quitar otro la conserva, cantidades y consultas no la consumen, un plato añadido con su sustitución a un carrito existente se compra sin comprar las alternativas, y con varias líneas del mismo plato pregunta en cuál y anota solo esa.

42 conversaciones nuevas: tres menús sintéticos×agente simulado off/on×siete caminos, con respuesta/carrito/pendiente/nota/DTO. Baseline: camino «añadido» rojo en 6/6. Foco70/70; TS general/build, Node92 aprobados. Global19.994/305 suites,691s, sin fallos; fuente congelada. Informe `docs/whatsapp-substitution-pending-edit-validation-2710.md`.

Alcance: una sustitución delimitada a la vez; no acredita paráfrasis fuera del patrón ni disponibilidad real/inferencia. Próximo: reparto2→3, adicionales omitidos, cantidades/negación con errores, reemplazos que agregan, cortesía/destino. Sin API pagada/Meta/órdenes externas. Publicación staging sin despliegue:232–236 pendientes agrupados; último servidor staging verificado231 `1f0a2f8c`. No declarar vendible por conteos.

## VIGENTE — tanda 235: alternativas de acompañamiento (26/10)

Base `0e2b4fc9`, staging. «En ves de ensalada más papa o yuca» queda como elección de preparación pendiente del ejecutivo. Pregunta alternativa, conserva compras/destino y anota solo en ese plato; no cobra extras ni promete disponibilidad de cocina. Retirar nota y cancelar pedido limpian pendientes. Confirmación prematura no crea orden.

28 casos nuevos:18 recorridos en tres menús×agente simulado off/on×primera/segunda alternativa/retirar nota,6 controles de parser y4 del mensaje original hasta cerrar/cancelar. Foco175/175; TS general/build, Node92, Falafel1 aprobados. Global19.952/304 suites,613hashes,775,93s; inventario exacto/fuente congelada. Informe `docs/whatsapp-substitution-choice-validation-2610.md`.

Alcance: carrito nuevo y una sustitución delimitada con dos alternativas ligada a un plato identificado. No acredita varias sustituciones simultáneas, cambios sobre líneas divididas ni disponibilidad real/inferencia. El chat concreto queda cubierto en simulación; los otros diagnósticos históricos233 NO quedan cerrados. Próximo: cambios/quitar plato durante preparación pendiente y continuar con reparto2→3/adicionales/negaciones de los chats abiertos.

Sin API pagada/Meta/órdenes externas. Main/modelos intactos. Publicación staging sin despliegue:232–235 pendientes agrupados; último servidor verificado231 `1f0a2f8c`. No declarar vendible por conteos.

## VIGENTE — tanda 234: compras independientes multilínea (26/10)

Base `e746eb69`, staging. Evita que el atajo de plato compuesto absorba una compra anterior; líneas explícitas conservan compras separadas, incluso en catálogos fuera del vocabulario fijo de comida. Conserva villa en destino y admite opción larga con dos errores solo tras etiqueta del atributo y candidato único. Sin excepciones por restaurante.

17 pruebas nuevas:12 conversaciones en tres menús×agente simulado off/on×consulta de pago presente/ausente y5 controles de aproximación. Respuesta/carrito/estado/destino/DTO. Foco81/81, TypeScript general/build, Node92 y Falafel1 aprobados. Global19.924/303 suites,611hashes,966,72s, inventario exacto/fuente congelada. Informe `docs/whatsapp-multiline-independent-validation-2610.md`.

**Chat original aún parcialmente abierto:** conservar sopa+ejecutivo/opciones no acredita resolver «en vez de ensalada más papa o yuca», que todavía pierde la petición. Siguiente tanda: conservar esa sustitución y aclarar alternativa sin extras cobrados, luego cancelación/cierre completos. Otros diagnósticos históricos233 siguen pendientes; no extrapolar esta mejora a todos los chats/PDF.

Sin API pagada/Meta/órdenes externas. Main/modelos intactos. Publicación staging sin despliegue:232–234 pendientes agrupados; último servidor verificado231 `1f0a2f8c`. No declarar vendible por conteos.

## VIGENTE — tanda 233: revisión final y pendientes reales reejecutados (26/10)

Base `e4e231be`, staging. Corregido cierre prematuro al cambiar destinatario junto con pago durante confirmación: el manejador de contacto exige resumen nuevo antes de crear orden.18conversaciones nuevas en tres menús×agente simulado off/on×nombre/nombre+pago/nombre+consulta, carrito/datos/estado/DTO. Baseline6verdes/12rojas:6fallos reales de cierre y6aserciones demasiado estrictas del mensaje final, ajustadas para reconocer acuse anterior. Foco125/125; TypeScript general/build, Node92, Falafel1 aprobados. Global19.907/302suites,610hashes,766,09s; inventario exacto/fuente congelada.

**NO todos los chats corregidos.** Reejecución posterior de3diagnósticos históricos:28casos,6verdes/22rojos (11formulaciones×off/on). Auditoría25/10:0/12; tarde:2/8; pedido+transferencia:4/8. Fuera del inventario verde. Persisten sopa independiente perdida, reparto2→3, adicional omitido, cortesía/destino, cantidades/negación con typo y reemplazo que añade. Siguiente prioridad cerrar esos pendientes antes de ampliar nuevas familias. Evidencia `docs/whatsapp-historical-recheck-2610.json` e informe `docs/whatsapp-profile-final-confirmation-validation-2610.md`.

Sin API pagada/Meta/órdenes externas. Main/modelos intactos. Publicación staging sin despliegue:232–233 pendientes agrupados, último servidor verificado231 `1f0a2f8c`. PDF18/10 y28recorridos dechat.txt auditados no equivalen a replays completos verdes. No declarar vendible por conteos.

## VIGENTE — tanda 232: nombre junto a dirección o consulta (26/10)

Base `08d14825`, staging. Baseline24:12 verdes/12 rojas. Dirección+nombre guardaba solo dirección; consulta de domicilio+nombre respondía solo tarifa. Se conserva nombre explícito en dos cláusulas de nombre/dirección y en contacto+consulta no resuelta, manteniendo el resto en sus manejadores. La tarifa resuelta recuerda el paso pendiente. Sin compra ni confirmación por corregir contactos.

36 conversaciones nuevas: tres menús×agente simulado off/on×pago/dirección/teléfono/consulta y órdenes inversos. Verifican respuesta/guía, carrito intacto, nombre, datos, tarifa, estado y DTO. Foco317/317 en6 suites; TS general/build, Node92, Falafel1 verdes. Global19.889/301 suites,609 hashes,1079,81s; inventario exacto/fuente congelada. Informe `docs/whatsapp-profile-mixed-correction-validation-2610.md`.

Sin API pagada/Meta/órdenes externas; Main/modelos intactos. Publicación staging sin despliegue:232 pendiente agrupado, servidor aún231 `1f0a2f8c` healthy verificado26/10. Siguiente: negativas a usar perfil y correcciones antes de confirmar; condiciones no deben convertirse en cambios afirmados. No acreditar lenguaje libre universal ni vendibilidad por conteos.

## VIGENTE — tanda 231: nombre del perfil para acortar checkout (26/10)

Base `b571a600`, staging. Parser vincula profile.name solo al wa_id remitente; nombres contradictorios no se usan. Validación conservadora2–6 palabras, sin emojis/cifras/placeholders/comercios comunes. Completa únicamente destinatario vacío tras reclamar mensaje y recargar conversación, fuera de takeover. No toca cuentas web ni reemplaza nombres guardados. Corrección explícita en el mensaje inicial o durante pago prevalece. Ráfagas conservan perfil consistente aunque llegue después.

45 pruebas nuevas, baseline inicial15 rojas/17 verdes y ráfagas2 rojas/2 verdes. Foco64/64 en5 suites; TS general/build, Node92, Falafel1 verdes. Global19.853/300 suites,608 hashes,748,56s; inventario exacto/fuente congelada. Informe `docs/whatsapp-profile-recipient-validation-2610.md`. Sin API pagada/Meta/órdenes externas; modelos/Main intactos.

Desplegado a staging código `1f0a2f8cc2b3736acbb8ccc19ab57ca50d053e50` el26/10/2026 (~20:18 Bogotá). Contenedor running/healthy, imagen activa=candidate `sha256:b68b22ddb9c49c3fba56f5607e18c6a6b8db08fe87713a06435f7540f578a575`; health local/público OK, DB connected, circuito CLOSED. Carpeta privada sin seguimiento bin/ conservada. Main intacto. Tandas acumuladas incluidas hasta231; no quedan210–231 pendientes de despliegue. Log `/tmp/ppp-231-staging-deploy.log`. Comprobación inicial starting no se contó como healthy; segunda comprobación confirmó healthy. Siguiente: probar en canal controlado el perfil nuevo y destinatario distinto, luego correcciones de nombre combinadas con consultas/dirección/pago. Perfil no verifica identidad; alias o nombres de una palabra aún requieren captura explícita. No declarar vendible por conteos.

## VIGENTE — tanda 230: caché de direcciones recuperadas (26/10)

Base `3ce34dca`, staging. Antes de repetir variantes fallidas se reutiliza cualquier acierto vigente del mismo destino y contexto. Clave con origen exacto, región y radio de aceptación; caducidad12h. No guarda fallos ni reutiliza ruta/tarifa. En tres escenarios simulados se eliminan2 consultas de geocodificación por repetición; sin ahorro real medido.

18 regresiones nuevas: tres vías×repetición/origen/radio/puerta/caducidad/recuperación tras fallo. Baseline estricto9 rojas/9 verdes; foco80/80 en5 suites con recorridos de tres menús/DTO. TS general/build, Node92 y Falafel1 verdes. Global19.808/298 suites,605 hashes,751,14s; inventario exacto/fuente congelada. Informe `docs/whatsapp-address-cache-recovery-validation-2610.md`.

Siguiente: nombre válido del perfil como destinatario editable; el informe detalla unión por wa_id, prioridad de destinatario explícito/cuenta y correcciones durante checkout. NO implementado aún. Sin llamadas externas pagadas/Meta/órdenes; Main/modelos intactos. Publicación staging sin despliegue. Runtime210–230 pendiente agrupado;219/221–223/229 solo cobertura. No declarar vendible por conteos.

## VIGENTE — tanda 229: límites de búsqueda y nombre guardado (26/10)

Base `68997eef`, staging; solo cobertura. 30 casos nuevos: seis direcciones de chats×cuatro respuestas simuladas del mapa y tres menús×agente simulado off/on para cierre con nombre guardado. Verifica salida temprana, tercer intento sin símbolos, rechazo de puerta distinta/parcial, límite10 consultas únicas y reutilización de acierto inicial. Router conserva nombre, pasa al pago y crea una única orden simulada solo tras confirmar.

Foco62/62 en4 suites,13,485s; TypeScript general aprobado. No nueva global por tests/docs únicamente; última228:19.760/295 suites. Informe `docs/whatsapp-address-retry-saved-name-validation-2610.md`. Sin API/Meta/órdenes externas. No acredita reconocimiento real de esos destinos ni ahorro medido.

Siguiente: caché tras varios fallos antes del acierto, aislamiento de restaurante/destino; luego perfil WhatsApp editable, aún no implementado. Main/modelos intactos, publicación staging sin despliegue. Runtime210–228 pendiente agrupado;229 solo cobertura.

## VIGENTE — tanda 228: recuperación de direcciones y cierre (26/10)

Base `fa3fb2b3`, staging. Normaliza separadores y ensaya formatos locales sin símbolos; acepta componentes exactos cuando el formato no es interpretable, sin aceptar calles contradictorias ni resultados parciales. Si el mapa devuelve otra calle, explica las alternativas y solicita precisión sin cambiar dirección/cobrar. Familia de combos ambigua conserva bebida/datos al elegir; no intercepta pedidos múltiples. Total sin domicilio resuelto marcado provisional.

32 casos nuevos:25 de geocodificación y7 de router con tres menús, agente simulado off/on y control de adicional. Foco253/253; TS general/build, Node92, Falafel1 verdes. Global19.760/295 suites,602 hashes,740,58s, inventario exacto/fuente congelada. Informe `docs/whatsapp-address-recovery-checkout-validation-2610.md`.

Dos consultas reales a Maps (potencialmente facturables) devolvieron79A BIS/79B para79A-61: no se acreditó resolución exacta. Sin OpenAI/Meta/órdenes externas. Siguiente: muestra de direcciones reales con costo/latencia de reintentos y captura de nombre de perfil válido, editable y sin sobrescribir destinatario explícito. Nombre de perfil todavía NO implementado; cuenta vinculada ya reutilizada. Caducidad sin cambios por hora final truncada.

Main/modelos intactos. Publicación staging sin despliegue; runtime210–228 pendiente agrupado (219/221–223 solo cobertura). Producción código209 `a935f555`. Sin declarar vendibilidad por conteos.

## VIGENTE — tanda 227: consulta y negativa de combo (26/10)

Base `c0b5e629`, staging. Consulta reconocida y negativa explícita se resuelven por separado: se responde sobre la oferta y luego se conserva el original y limpia la elección. «No gracias» no mantiene una oferta pendiente ni se transforma en compra. Los controles de pregunta + elección explícita de otra presentación siguen funcionando.

36 conversaciones nuevas, tres menús×agente simulado off/on×6 caminos, con respuesta/continuación/carrito/opciones/cantidad/notas/precio/estado y DTO. Baseline12 verdes/24 rojas; foco150/150 en4 suites. TS general/build, Node92, Falafel1 verdes. Global completa19.728/293 suites,600 hashes,798,39s, inventario exacto/fuente congelada. Informe `docs/whatsapp-combo-question-refusal-validation-2610.md`.

Siguiente: negativas con consulta sin signos y «no ese» junto a otra alternativa; no tratar rechazo de una presentación como rechazo de toda oferta. La cobertura227 exige pregunta delimitada y negativa explícita no/no gracias/sin combo; no acredita lenguaje libre ni inferencia real. Sin API pagada/Meta/órdenes externas; modelos/Main intactos. Publicación staging sin despliegue; runtime210–227 pendiente de despliegue agrupado (219/221–223 solo cobertura). Producción código209 `a935f555`. Sin ahorro real medido ni declaración de vendibilidad por conteos.

## VIGENTE — tanda 226: otra presentación con bebida (26/10)

Base `67f93cef`, staging. «El otro con Agua» conserva la bebida explícita al resolver la referencia; «1 con Agua» resuelve la fila durante la recuperación. Se usan las validaciones existentes de opciones/precio/disponibilidad. Ambigüedad o ausencia de antecedente no permite compra automática; sabor inválido conserva carrito hasta elección válida.

48 conversaciones nuevas en tres menús×agente simulado off/on×8 caminos, con respuesta/carrito/estado/precio/notas/opciones y DTO. Baseline48/48 rojas; primera corrección30 verdes/18 rojas detectó el hueco de fila+opción, corregido. Foco168/168 en4 suites y comprobación adicional48/48 de respuesta. TS general/build, Node92, Falafel1 verdes. Global completa19.692/292 suites,599 hashes,758,54s, inventario exacto/fuente congelada. Informe `docs/whatsapp-combo-other-beverage-validation-2610.md`.

Siguiente: consultas de contenido/precio junto a rechazo o cambio de alternativa, respondiendo sin compra implícita. No extrapolar el complemento de bebida a cualquier nota ni estas simulaciones a inferencia real. Sin API pagada/Meta/órdenes externas; modelos/Main intactos. Publicación staging sin despliegue; runtime210–226 pendiente de despliegue agrupado (219/221–223 solo cobertura). Producción código209 `a935f555`. Sin ahorro real medido ni declaración de vendibilidad por conteos.

## VIGENTE — tanda 225: «no ese, el otro» (26/10)

Base `7a420e39`, staging. La referencia relativa a una oferta exige una presentación actual identificada y exactamente otra alternativa. Si falta antecedente o hay varias, pide aclaración sin modificar carrito. Revalida disponibilidad/precio y usa opciones propias de la alternativa; cantidades y notas se conservan. Las opciones agotadas o retiradas generan explicación, sin compra silenciosa.

42 conversaciones nuevas en tres menús×agente simulado off/on×7 caminos, con respuesta/carrito/estado/opciones/precio/notas y DTO final. Baseline30/30 rojas; ampliación detectó12 fallos de respuesta ante stock/retirada, corregidos. Foco168/168 en5 suites; TS general/build, Node92, Falafel1 verdes. Global completa19.644/291 suites,598 hashes,735,81s, inventario exacto/fuente congelada. Informe `docs/whatsapp-combo-other-reference-validation-2610.md`.

Siguiente: «el otro con ...», correcciones con ambos productos explícitos, consultas junto a negativas y disponibilidad cambiante de varias alternativas. No extrapolar esta referencia acotada a lenguaje libre. Sin API pagada/Meta/órdenes externas; modelos/Main intactos. Publicación staging sin despliegue; runtime210–225 pendiente de despliegue agrupado (219/221–223 solo cobertura). Producción código209 `a935f555`. Sin ahorro real medido ni declaración de vendibilidad.

## VIGENTE — tanda 224: preguntas mixtas sin puntuación (26/10)

Base `697b5c09`, staging. Se separan preguntas acotadas de contenido/precio/sabores y órdenes explícitas dame/quiero sin depender de signos; funciona pregunta antes/después. «Si elijo» sigue siendo consulta sin compra. Conserva validaciones de catálogo/opciones/precio y no usa excepciones de restaurante.

36 conversaciones nuevas en tres menús×agente simulado off/on×6 caminos, con carrito/respuesta/estados/precio/cantidades/notas/bebida y DTO. Baseline36/36 rojas→foco138/138 en3 suites. TS general/build, Node92, Falafel1 verdes. Global completa19.602/290 suites,597 hashes,740,64s, inventario exacto/fuente congelada. Informe `docs/whatsapp-combo-unpunctuated-choice-validation-2610.md`.

Siguiente: «no ese, el otro», candidatos indistinguibles y negativas complejas; no están acreditados por224. El patrón actual exige pregunta reconocible y orden explícita; no extrapolar a todo lenguaje libre. Sin API pagada/Meta/órdenes externas, modelos/Main intactos. Publicación staging sin despliegue; runtime210–224 pendiente de despliegue agrupado (219/221–223 solo cobertura). Producción código209 `a935f555`. Sin ahorro real medido ni declaración de vendibilidad.

## VIGENTE — tanda 223: negativas y correcciones tras contactos (26/10)

Base `d1246b17`, staging. Solo cobertura: no/no gracias/sin combo después de nombre/teléfono mantienen original y continúan pago; corregir nombre/teléfono mantiene cotización y Agua.30 conversaciones nuevas, tres menús×agente simulado off/on×5 caminos, DTO simulado con dos unidades/notas/datos finales.

Primera ejecución12 verdes/18 fallos del oráculo que exigía una frase de conservación. La salida ya mostraba carrito original y pago; aserción corregida para exigir producto/ausencia de combo/importe/estado. Runtime intacto. Foco114/114 en4 suites,21,219s; TS general verde. Sin nueva global: última completa220,19.470/286 suites. Informe `docs/whatsapp-combo-quote-contact-correction-validation-2610.md`.

Siguiente: consultas/elecciones sin puntuación, negativas complejas y referentes incompletos; conservar opciones y responder sin inventar elección. Sin API pagada/Meta/órdenes externas, modelos/Main intactos. Publicación staging sin despliegue. Runtime210–220 pendiente de despliegue agrupado;219/221–223 solo cobertura. Producción código209 `a935f555`. Sin ahorro real medido ni vendibilidad por conteos.

## VIGENTE — tanda 222: consulta + cambio de bebida (26/10)

Base `7bea95fb`, staging. Solo cobertura: consulta de contenido/precio/sabores junto a elección explícita antes/después de la pregunta; condicional sin compra; bebida inexistente que conserva cotización.36 conversaciones nuevas, tres menús×agente simulado off/on×6 caminos, dos unidades/notas/bebida/precio/estados y DTO simulado.

Baseline36/36 verdes sin corrección; foco168/168 en4 suites,25,151s; TS general verde. No nueva global por test/docs únicamente; última completa220,19.470/286 suites. Informe `docs/whatsapp-combo-quote-mixed-choice-validation-2610.md`.

Siguiente: negativas/correcciones después de contactos, entradas sin puntuación y referentes ambiguos. La cobertura actual usa signos de interrogación y etiqueta explícita; no extrapolar a todo lenguaje libre. Sin API pagada/Meta/órdenes externas, modelos/Main intactos. Publicación staging sin despliegue. Runtime210–220 pendiente de despliegue agrupado;219/221/222 solo cobertura. Producción código209 `a935f555`. Sin ahorro real medido ni declaración de vendibilidad.

## VIGENTE — tanda 221: preguntas/contactos durante cotización (26/10)

Base `7100b10b`, staging. Solo pruebas/docs: precio, contenido, nombre, teléfono y secuencia de esas interrupciones antes de aceptar.30 conversaciones nuevas, tres menús×agente simulado off/on×5 recorridos, cierres DTO con dos unidades, Agua, notas y datos actualizados.

Baseline24/24 verdes; primera ampliación120 verdes/18 fallos del oráculo que esperaba volver al carrito tras contactos aunque el fixture de recogida permite pasar a pago. Corregido para exigir awaiting_payment + pregunta de pago en esos caminos. Foco final138/138 en4 suites,21,147s; TS general verde. No se cambió runtime ni se repitió global: última completa220,19.470/286 suites. Informe `docs/whatsapp-combo-quote-interruption-validation-2610.md`.

Siguiente: preguntas + elección/cambio de bebida en un mensaje, negativas/correcciones después de contactos, referentes ambiguos. No extrapolar referentes explícitos actuales a toda consulta libre. Sin API pagada/Meta/órdenes externas; Main/modelos intactos, publicación staging sin despliegue. Runtime210–220 pendiente de despliegue agrupado;219/221 solo cobertura. Producción código209 `a935f555`. Sin ahorro real medido ni vendibilidad por conteos.

## VIGENTE — tanda 220: aceptar cotización por referencia (26/10)

Base `50e1fefd`, staging. Reelección por fila/código/etiqueta de la misma presentación conserva opciones de su cotización; otra presentación usa sus propias opciones. Evita perder Agua o sustituirla por Pepsi silenciosamente si fue retirada. Corrección general sin excepciones de catálogo.

36 nuevas conversaciones, tres menús×agente simulado off/on×3 referencias×bebida vigente/retirada. Baseline36/36 rojas; foco198/198 en5 suites. TS general/build, Node92, Falafel1 verdes. Global completa19.470/286 suites,593 hashes,722,64s, inventario exacto/fuente congelada. Informe `docs/whatsapp-combo-quote-acceptance-validation-2610.md`.

Siguiente: nueva bebida junto a aceptación, consultas/contactos intercalados y nombres duplicados. «El grande» acredita etiqueta explícita, no cualquier nombre libre. Sin API pagada/Meta/órdenes externas; modelos/Main intactos. Publicación staging sin despliegue; runtime210–220 pendiente de despliegue agrupado (219 solo pruebas). Producción código209 `a935f555`. No hay ahorro real medido ni declaración de vendibilidad por conteos.

## VIGENTE — tanda 219: disponibilidad durante aceptación de precio (26/10)

Base `17199282`, staging. Cobertura nueva sin cambios de runtime: retirar bebida, agotar combo o eliminarlo entre recotización y «sí». Se conserva original hasta elegir una opción vigente; no se cambia Agua por Pepsi silenciosamente. Tres menús×agente simulado off/on×3 caminos=18 conversaciones con cierre DTO de dos unidades, notas, opciones, precio y estados.

Baseline18/18 verdes; foco162/162 en4 suites (24,699s), TypeScript general verde. Sin nueva global porque solo se añaden pruebas/docs; conservar evidencia combinada218 sin llamarla run219. Informe `docs/whatsapp-combo-quote-availability-validation-2610.md`.

Siguiente: aceptación por número/código/nombre, tanto con bebida vigente como retirada; después consultas/contactos durante la cotización. Sin API pagada, Meta ni órdenes externas. Main/modelos intactos, publicación solo staging, sin despliegue. Runtime210–218 pendiente de despliegue agrupado;219 solo cobertura. Producción continúa con código209 `a935f555`. No declarar vendibilidad por conteos.

## VIGENTE — tanda 218: conservar bebida al recotizar (26/10)

Base `28017854`, staging. Se validan y guardan opciones explícitas antes de recotizar: aceptar conserva la bebida; rechazar mantiene original y elegir otra presentación no hereda la bebida ajena. Catálogo general, sin IDs/nombres especiales.

42 conversaciones nuevas, tres menús×agente mock off/on×7 caminos, cierres DTO simulados. Baseline30:18 rojas/12 verdes. Foco168/168; TS general/build, Node92, Falafel1 verdes. Global inicial19.410 verdes/6 fallos del contrato antiguo que exigía repetir bebida; solo se actualizó esa expectativa y reejecutó78/78. Evidencia combinada19.416/284 suites, inventario exacto, runtime sin cambios. No presentar como una segunda global íntegra verde. Informe `docs/whatsapp-combo-reprice-drink-validation-2610.md`.

Siguiente: opciones retiradas entre cotización y aceptación, disponibilidad cambiante y consultas/contactos en ese paso. Sin API pagada/Meta/órdenes externas, modelos/Main intactos. Publicación staging, sin despliegue;210–218 pendientes de despliegue agrupado. Main/producción código209 `a935f555`. Sin ahorro real medido ni declaración de vendibilidad.

## VIGENTE — tanda 217: elección antes de consulta y bebida explícita (26/10)

Base `e5331c1b`, staging. «Dame/quiero el ... , ¿qué trae/cuánto cuesta/qué sabores tiene?» responde y aplica elección explícita; «si elijo ... , ¿...?» solo consulta y conserva carrito. Referencia de consulta comparte resolución de etiquetas con selección. Código/volumen/etiqueta con bebida inline conserva esa bebida al convertirse en fila; válida prevalece sobre inicial, inválida pide opciones sin cambiar carrito. No inferir tamaño por precio ni volumen.

66 conversaciones nuevas en tres menús×agente mock off/on×11 caminos,66 cierres DTO simulados con dos unidades/notas/bebida. Baseline36/36 rojos→36/36; ampliación/foco312/312 en5 suites. TS general/build, Node92 yFalafel1 aprobados. Global19.374/283 suites,590 hashes,716,38s, inventario exacto/fuente congelada. Informe `docs/whatsapp-combo-reverse-choice-validation-2610.md`.

Siguiente: precio cambiado con bebida explícita y aceptación de recotización, más negativas/condicionales, consulta sin puntuación y contactos junto a selección. El patrón «si elijo» no acredita toda condición; no extrapolar a lenguaje libre ni inferencia real. Mantener respuesta/carrito/estado/DTO, foco antes de global y fuente congelada.

Sin API pagada/Meta/órdenes externas; modelos/Main intactos. Publicación solo staging, sin despliegue217; tandas210–217 pendientes de despliegue agrupado. Main/producción mantienen código209 `a935f555`. Sin ahorro medido ni declaración de vendibilidad por conteos.

## VIGENTE — tanda 216: etiquetas de presentación y consulta con elección (26/10)

Base `49cca892`, staging. Referencias grande/pequeño/familiar/individual/mediano se resuelven solo con etiqueta explícita de nombre o presentación/tamaño/formato en descripción; no por precio/volumen. Ausente/ambigua conserva carrito. Consulta reconocida terminada en «?» seguida de «dame/quiero el/la ...» responde y procesa elección explícita, sin repetir pregunta ya resuelta. Dos respuestas del mismo turno: detalle y resultado. Revalida disponibilidad/precio.

60 nuevas conversaciones en tres menús×agente mock off/on,60 cierres DTO con cantidades/notas/bebida. Baseline30/30 rojos; primera corrección18/30 (12 aserciones solo leían última respuesta; oráculo corregido para leer todas las salidas del turno, documentado). Foco246/246 en4 suites; TS general/build, Node92 yFalafel1 aprobados. Global19.308/282 suites,589 hashes,730,08s, inventario exacto/fuente congelada. Informe `docs/whatsapp-combo-descriptive-choice-validation-2610.md`.

Siguiente: elección antes de consulta, conjunciones, abreviaciones y bebida junto a presentación; negativas y condiciones sin compra. No extrapolar el patrón explícito actual a todo lenguaje libre. Mantener respuesta/carrito/estado/DTO y foco antes de global, sin editar durante validación.

Sin API pagada/Meta/órdenes externas; modelos/Main intactos. Publicación solo staging, sin despliegue216; tandas210–216 pendientes de despliegue agrupado. Main/producción mantienen código209 `a935f555`. Sin ahorro medido ni declaración de vendibilidad por conteos.

## VIGENTE — tanda 215: consultas por código/contenido y sabores (26/10)

Base `a54b45f6`, staging. Consultas explícitas de precio/sabores/contenido por código ofrecido y contenido por volumen responden desde catálogo vigente sin comprar ni perder alternativas. Código ajeno pide aclarar; agotado avisa; descripción ausente no inventa acompañamientos. La revalidación de sabores ya funcionaba: si la bebida solicitada desapareció, mantiene base y pide opción válida; se amplía su evidencia hasta DTO.

60 conversaciones nuevas en tres menús×agente mock off/on×10 caminos, con60 cierres DTO simulados que verifican dos unidades, nota y bebida. Baseline36:12verdes/24rojos; corrección36/36; ampliación/foco276/276 en6 suites. TS general/build, Node92 yFalafel1 aprobados. Global19.248/281 suites,588 hashes,722,89s, inventario exacto/fuente congelada. Informe `docs/whatsapp-combo-candidate-inquiries-validation-2610.md`.

Siguiente: consultas con cambios en el mismo mensaje, referencias «grande/familiar» y nombres abreviados. No extrapolar las formulaciones explícitas actuales a todo lenguaje libre ni a inferencia real. Mantener respuesta/carrito/estado/DTO, foco antes de global y fuente congelada durante global.

Sin API pagada, Meta ni órdenes externas; modelos/Main intactos. Publicación solo staging, sin despliegue215; tandas210–215 pendientes de despliegue agrupado. Main/producción mantienen código209 `a935f555`. Sin ahorro medido ni declaración de vendibilidad por conteos.

## VIGENTE — tanda 214: rechazo y datos durante lista de combos (26/10)

Base `aaaa57af`, staging. Corregido rechazo compuesto con bebida aparte antes de seleccionar cualquier candidato: una coincidencia de sabor/volumen ya no acepta combo contra «no/sin combo». Conserva base/opciones/notas y añade solo la bebida explícita. Contactos juntos descubrieron otro fallo: «Ana Torres» se leía «torre S». Etiquetas de unidades exigen límite de palabra o dígito; conserva abreviaciones numéricas, detección/resolución de conflictos y apellidos al actualizar.

46 pruebas nuevas:36 conversaciones completas en tres menús×agente mock off/on y10 controles de límites de unidades. Baseline rechazo18/18 rojos; contacto12/18 verdes,6 rojos por apellido. Final foco285/285; TS general/build, Node92 yFalafel1 aprobados. Global19.188/280 suites,587 hashes,743,23s, inventario exacto y fuente congelada. Informe `docs/whatsapp-multiple-combo-interruptions-validation-2610.md`.36cierres DTO simulados, contactos comparan nombre/teléfono/dirección. No acredita geocodificación real ni inferencia real.

Siguiente: preguntas por código/contenido y candidatos con opciones distintas; mantener bebida solicitada o pedir alternativa válida sin sustitución silenciosa. Ampliar contactos sin etiqueta/incompletos y mensajes mixtos; no dar por cubiertas todas las formulaciones. Foco primero; global solo tras cerrar cambios compartidos, sin editar durante ella.

Sin llamadas pagadas, Meta ni órdenes externas; modelos/Main intactos. Publicación solo staging, sin despliegue214; tandas210–214 pendientes de despliegue agrupado. Main/producción mantienen código209 `a935f555`. Sin medición nueva de ahorro ni declaración de vendibilidad por conteos.

## VIGENTE — tanda 213: referencias y consultas de presentaciones (26/10)

Base `199ad1ec`, staging. Selección explícita por código ofrecido o volumen único vigente («400ml», «1,5 litros», «litro y medio») se resuelve como fila, nunca como cantidad. Conserva unidades/opciones/notas. Código agotado o referencia ambigua/ajena mantiene alternativas y explica la aclaración. Consultas de precio/sabores por volumen responden desde catálogo sin comprar y guían a seguir eligiendo.

78 regresiones nuevas en tres menús×agente mock off/on, con78 cierres DTO simulados. Baseline54:6verdes/48rojos; tras referencias42/54 y consultas54/54. Ampliación/foco318/324:6fallos por código agotado perdía lista; corregidos,78/78 finales. TS general/build, Node92 yFalafel1 aprobados. Global19.142/278 suites,585 hashes,708,90s, inventario exacto/fuente congelada. Informe `docs/whatsapp-combo-presentation-reference-validation-2610.md`. Bebida se verifica en carrito; no afirmar cobertura de todo importe del DTO.

Siguiente: negativa con bebida aparte y datos de contacto durante lista múltiple; luego consultas por código/contenido y candidatos con opciones diferentes. «El grande/familiar», nombres duplicados y mensajes mixtos libres no están acreditados por esta tanda. Mantener foco antes de global, no editar fuente durante ella, no lanzar global por cada variante.

Sin API pagada, Meta ni órdenes externas; modelos y Main intactos. Publicación solo staging, sin despliegue213; Main/producción conservan código209 `a935f555`. Tandas210–213 pendientes de despliegue agrupado. Sin nueva medición de ahorro ni declaración de vendibilidad por conteos.

## VIGENTE — tanda 212: elección entre presentaciones de combo (26/10)

Base `0f5cf0f1`. Oferta inicial con varias presentaciones conserva el plato base y lista código/precio/descripción, sin candidato favorito. Opciones solicitadas se guardan por candidato en campo opcional JSON `offeredAlternatives`; elegir fila conserva cantidad/preparación/bebida/nota. «Sí» solo pide aclarar; rechazo conserva base. Disponibilidad/opciones/precio se revalidan, incluida elección de otra alternativa tras recotizar.

48 regresiones nuevas en tres menús×agente mock off/on, todas con cierre DTO simulado. Foco246/246; diagnóstico210 finalmente36/36; TS general/build, Node92 yFalafel1 aprobados. Global19.064/277 suites,584 hashes,714,09s, inventario exacto/fuente congelada. Informe: `docs/whatsapp-combo-offer-presentations-validation-2610.md`; incluye las iteraciones fallidas, sin usarlas como aprobación.

Siguiente bloque: elegir por código o volumen/descripción, preguntar precio/contenido/sabores de cada alternativa, negativa con bebida aparte y datos de contacto mientras esta lista múltiple está pendiente. Probar opciones distintas entre presentaciones y mantener respuesta/carrito/estado/DTO. No extrapolar de la oferta única ni de la selección numérica actual. Nombres abreviados y combos con títulos diferentes siguen fuera de alcance de esta regla inicial.

Sin llamadas pagadas, Meta ni órdenes externas; sin cambios de modelos ni ahorro medido. Publicación solo staging, sin despliegue de esta tanda. Main/producción conservan código209. Agrupar despliegues; no declarar vendible por conteos.

## VIGENTE — tanda 211: consultas sobre combo pendiente (26/10)

Base `a71730d7`, staging. Preguntas explícitas de precio/sabores sobre una propuesta con candidato único ahora consultan ese combo vigente, sin comprar ni alterar el carrito. Se mantiene el paso siguiente. La ampliación descubrió pérdida de bebida al aceptar nueva cotización: esa aceptación reutiliza la ruta que conserva y revalida las opciones solicitadas.

54 regresiones nuevas en tres menús×agente mock off/on:36 consultas,6 precios cambiados,6 sabores cambiados y6 agotados;48 cierres DTO simulados. Baseline36/36 rojos→36verdes; ampliación42/48→48/48; foco final198/198. TS general/build, Node92 yFalafel1 aprobados. Global19.016/276 suites,583 hashes,709,91s, inventario exacto/fuente congelada. Informe: `docs/whatsapp-combo-offer-questions-validation-2610.md`.

Diagnóstico210 ahora30/36: quedan únicamente6 rojos de presentaciones ambiguas, conservados opt-in. Siguiente: ofertas de combos con mismo título y distinta presentación, lista diferenciada por descripción/volumen, preservación de cantidad/opciones/notas y aceptación explícita. Después ampliar referencias abreviadas y preguntas combinadas con cambios. No afirmar cobertura universal por estas formulaciones ni modificar oráculos para ocultar fallos.

Sin API pagada, Meta ni órdenes externas; sin cambio de modelos ni nueva medición de ahorro. Publicación solo staging, sin despliegue de esta tanda; Main/producción siguen en código209. Agrupar despliegues. No declarar vendible por conteos.

## VIGENTE — tanda 210: rechazo de combo con bebida aparte (26/10)

Base `3644d578`. Corregido el caso que aceptaba un combo al decir «no, mejor una gaseosa aparte»: sabor/volumen compatibles ya no prevalecen sobre esa negativa. «Sin combo, ...» continúa sin reinterpretar el prefijo como compra. Regla por catálogo; preserva plato base, cantidad, opciones y notas.

18 regresiones nuevas en tres menús×agente mock off/on×tres negativas, con18 cierres DTO; primera ampliación dejó6 rojos «sin combo», corregidos antes del cierre. Global final18.962/275 suites,582 hashes,715,19s, inventario exacto/fuente congelada. TS general/build, Node92 yFalafel1 aprobados. Evidencia: `docs/whatsapp-combo-offer-interruptions-validation-2610.md`.

Diagnóstico opt-in36:18 pasan/18 fallan. Siguiente:6 preguntas de precio responden plato base,6 de sabores muestran variantes,6 ofertas con dos presentaciones compran sin aclarar. Conservar esos rojos en `whatsapp-combo-offer-interruptions.repro.ts`; no darlos por resueltos ni promoverlos sin corregir. Priorizar consultas sobre candidato pendiente, luego presentaciones ambiguas, con carrito/estado/respuesta/DTO.

Sin API pagada/Meta/órdenes externas; sin cambios de modelos ni medición nueva de ahorro. Solo staging: Main/producción conservan el código209 `a935f555`. Esta tanda no se ha desplegado; agrupar con las próximas correcciones. No declarar vendible por conteos.

## DESPLIEGUE VERIFICADO — Main, tanda 209 (26/10)

Solicitud del usuario completada. Código `a935f555` integrado/publicado en Main y desplegado en producción. Verificado16:40UTC: API local/públicaOK,DBconnected,circuitCLOSED; contenedor running/0reinicios, imagenactiva=latest8a712979…. Tres módulos compilados (orchestrator/agente/catálogo) idénticos a la compilación validada. Compose privado/.env y472artefactos locales preservados. Rollback `ppp-nest-api:rollback-before-a935f555`. Bases/volúmenes intactos; imagen staging sin cambios. Evidencia y límites: `docs/whatsapp-implicit-combo-offer-validation-2610.md`.

Global vigente18.944/274. Sin API pagada, Meta ni órdenes externas de prueba. Staging se conserva para continuar; este cierre es solo documental, no otro despliegue. Siguiente: alternativas ambiguas/abreviadas, negativas con bebida aparte, preguntas durante propuesta y medición real del consumo ahora instrumentado. No declarar vendible por conteos.

## VIGENTE — tanda 209: oferta inicial de combo validada; promoción autorizada (26/10)

Base `bc36dde8`. Corregidos los doce pendientes205: nombre completo del plato + bebida, con carrito vacío y una única versión exacta compatible. Guarda el plato base explícitamente pedido y ofrece el combo sin comprarlo aún; al aceptar conserva cantidad, preparación, bebida y nota. Elección posterior de bebida prevalece. No fabrica originalLine; regla por catálogo, sin IDs/nombresPPP. Límites: nombres abreviados, varias variantes, títulos distintos, carrito existente y «no, bebida aparte» combinado siguen para ampliar; no declararlos resueltos.

Promovido repro205 a `whatsapp-implicit-combo-offer.spec.ts`:54/54, tres menús×agente mock off/on. 36cierresDTO; 12controles de agotados iniciales/posteriores y6bebidas aparte. Primer ajuste24/30 perdió cantidad en6casos; extractor corregido sin suavizar oráculo. Foco837/837+Falafel1/1; TS general/build yNode92. Global18.944/274suites,580hashes,707,75s, inventario exacto y fuente congelada (`/tmp/ppp-209-final-global-summary.json`).

El usuario solicitó integrar/desplegar en Main al terminar. Promoción en curso, no dar por desplegado hasta entrada de cierre. Prod inspeccionada en0f8c98da; compose privado/env y472artefactos locales Main se preservan. Sin API pagada/Meta/órdenes externas. Informe: `docs/whatsapp-implicit-combo-offer-validation-2610.md`.

Siguiente: alternativas ambiguas/abreviadas, negativa con compra aparte y consultas durante propuesta; notas y opciones tras cambios de catálogo. Medir consumo real tras desplegar telemetría199/reintento203; no prometer ahorro porcentual ni vendibilidad por conteos.

## VIGENTE — tanda 208: aceptación verbal de combo y cambio de precio (26/10)

Base `358e8c46`. Repetición del diagnóstico205:18/30, los doce fallos de oferta inicial siguen pendientes (`/tmp/ppp-208-baseline.json`). Se exploró la continuación por separado con compra real del plato base y consulta de bebida: 24casos iniciales,18verdes/6rojos. «Sí, el combo» avanzaba a atributos al precio nuevo sin advertir el cambio; la elección numérica ya tenía guarda.

Corregido en `tryAnswerComboSwapOffer`: una aceptación verbal válida reutiliza la nueva cotización antes de modificar el plato/recoger opciones. Sin excepciones de restaurante. Nueva suite `whatsapp-combo-offer-continuation.spec.ts`:36/36, tres menús×agente mock off/on; aceptación, rechazo, agotado y cambio de precio aceptado con «sí», «sí, el combo» o bebida. Treinta cierres DTO conservan producto/unidades/preparación/notas y bebida de combos; seis agotados solo validan respuesta/carrito/estado. No acredita todo campo monetario del DTO ni oferta inicial.

Guardas747/747 yFalafel1/1; TS general/build yNode92/92. Global18.890/273,580hashes,748,14s, inventario exacto/fuente congelada: `/tmp/ppp-208-final-global-summary.json`. Evidencia y plan: `docs/whatsapp-combo-offer-continuation-validation-2610.md`. Sin API/Meta/órdenes externas; sin deploy, Main intacta.

Siguiente: doce ofertas implícitas205 por título completo, bebida compatible y conservación de identidad. Reutilizar propuesta/reemplazo sin fabricar originalLine; cubrir aceptación con bebida ya solicitada, negativa/aparte, alternativas ambiguas y volumen. Mantener guardas de precio/imágenes/Falafel y pendientes de medición de costo. No declarar vendible por conteos.

## VIGENTE — tanda 207: componente adicional y fracciones (26/10)

Base `ae7f6506`. Los2rojos206 de compuesto primero + componente aparte quedan corregidos. Causa: glosario convierte «un medio pollo» a «medio pollo»; deduplicación no reconocía «y medio» y descartaba el extra. Se conservan palabras de fracción al separar y se reconoce ese límite para asignar cantidades/opciones/notas a cada producto. Cambio general, sin nombres/IDsPPP en runtime.

Se promueve el repro206 a `whatsapp-compound-extra-component.spec.ts`:38casos (24conversaciones/DTO en3menús×agente mock off/on×orden de mención×cantidades1/1 o2/3, más6controles de fracciones en otros menús y8controles de medidas/productos aparte). Controles20624/24, guardas685/685 yFalafel1/1; TS general/build yNode92 OK. Primera global interrumpida por regresión «litro y medio»; reparada sin eliminar test. Foco reparación121/121 más2guardas nuevas. Global FINAL18.854/272 aprobada,579hashes,719,42s, inventario exacto y fuente congelada: `/tmp/ppp-207-final-global-summary.json`.

Siguiente: doce ofertas implícitas pendientes205; última medición20618/30, no acreditadas de nuevo aquí. Reutilizar propuestas/reemplazo sin fabricar `originalLine` ni cambiar componentes del plato base; aceptación/negativa, cantidades/notas, precio/stock, alternativas ambiguas y volumen. Evidencia, límites y siguiente bloque: `docs/whatsapp-compound-extra-component-validation-2610.md`. Sin API/Meta/órdenes externas, sin deploy, Main intacta. No declarar vendible por conteos.

## VIGENTE — tanda 206: plato compuesto y bebida aparte (26/10)

Base `f69eebb7`. Corrección por título completo del catálogo para bebida con volumen explícito pedida aparte/adicional/extra. Conserva plato compuesto frente a su componente vendido por separado. Sin nombres/IDsPPP en runtime. Alcance deliberado: no acredita títulos abreviados ni oferta implícita de combos.

24 regresiones en tres menús con agente mock off/on, respuesta/carrito/estado y 24 cierres DTO simulados: baseline18/6 →24/0. Foco final64/64; TS general/build yNode92 aprobados. Global final18.816/271 aprobada,579hashes,753,90s, inventario exacto y fuente congelada: `/tmp/ppp-206-approved-global-summary.json`. Diagnóstico205 mejora16/14→18/12: dos bebidas aparte resueltas, doce ofertas implícitas pendientes.

Nuevo diagnóstico `whatsapp-compound-extra-component.repro.ts`:10/12; dos fallos al pedir compuesto primero + componente independiente + bebida. Baseline anterior también falla (perdía compuesto); ahora falta el extra. No promover esos dos ni suavizar expectativas. Siguiente: resolver esa compra triple en ambos órdenes y conservar opciones/notas/unidades; luego oferta implícita genérica y aceptación/negativa/revalidación. Evidencia y comandos: `docs/whatsapp-compound-boundary-validation-2610.md`. Sin API/Meta/órdenes externas, sin deploy; Main intacta. No declarar vendible por conteos.

## VIGENTE — tanda 205: contratos de combo implícito (26/10)

Base `88385bbc`. Diagnóstico gratuito de 30 casos en tres menús, sin cambios de runtime: **16 correctos / 14 fallidos**. Doce ofertas implícitas fallan (componente separado o bebida/oferta omitida); dos pedidos de arroz con bebida aparte pierden la identidad compuesta. Seis combos explícitos cierran DTO; cuatro bebidas aparte y seis controles de disponibilidad pasan. No acreditar aceptación/DTO de los casos que fallan en la oferta inicial.

El supuesto fallo de agotados del primer run era un error del fixture: `ignoreBusinessHours=true` vuelve disponibles los productos; corregido a false y repetida la matriz. Un filtro experimental fue retirado. TS general final aprobado. Diagnósticos opt-in en `whatsapp-implicit-combo-offer.repro.ts`; los 14 rojos quedan fuera del inventario aprobado. El repro197 exige compra automática y se marca histórico, no contrato vigente para ofertas.

Siguiente: primero resolver identidad compuesta en los dos casos de bebida aparte; después oferta genérica por catálogo, aceptación/negativa, cantidad/nota, alternativas ambiguas y stock/precio cambiado. No borrar simplemente exclusiones de medio/cuarto de la ruta específica de pollo. Plan y evidencia: `docs/whatsapp-implicit-combo-offer-diagnostic-2610.md`, `/tmp/ppp-205-final.json`. Incluir imagen/corrección de carrito en foco temprano. Global runtime vigente204:18.792/270. Solo staging, Main intacta, sin deploy ni API/Meta/órdenes externas. No declarar vendible por conteos.

## VIGENTE — tanda 204: combos plurales compuestos (26/10)

Base `2543a55d`. Con carrito vacío, título completo y único de «combos» se resuelve antes de separar componentes. Mantiene preparación y bebida del catálogo; los tamaños explícitos siguen por la ruta anterior. Alcance limitado a plural y carrito vacío, sin IDs/nombresPPP runtime. No acreditar compras posteriores ni combos implícitos.

Diagnóstico197:4/12→8/12; cuatro fallos plurales corregidos, cuatro implícitos siguen opt-in en `whatsapp-numeric-drink.repro.ts`. Suite nueva16:12recorridos/DTO en3menús×1/2unidades×agente mock off/on y4reproducciones PPP. Foco inicial705/705. La global encontró una regresión de corrección de cantidad (limitado a carrito vacío); la segunda encontró6contratos texto/foto de acompañamientos singulares (limitado a plural). Foco final61/61, TS general/build yNode92 aprobados. Global FINAL18.792/270suites,576hashes,694,86s, fuente congelada/inventario exacto: `/tmp/ppp-204-approved-global-summary.json`. No usar ejecuciones previas como aprobación. Evidencia `docs/whatsapp-explicit-combo-composition-validation-2610.md`.

Siguiente: oferta contextual de combos implícitos con componentes/bebida, alternativas ambiguas, negativa, compras aparte y tamaños distintos; conservar cantidades/notas hasta DTO. Añadir imagen/corrección al foco temprano de cualquier cambio de prioridad para evitar repetir global por regresiones de ruta. Costos199/203 aún sin deploy/medición productiva. Solo staging, sin deploy, Main intacta; cero API/Meta/órdenes externas. Mantener pendientes históricos, no declarar vendible por conteos.

## VIGENTE — tanda 203: eliminar reintento cosmético (26/10)

Base `845e90de`. El agente ya no pide otra inferencia solo porque una respuesta completa supera 420 caracteres. Conserva texto hasta el límite existente de 3500; permanecen recuperaciones de compras incompletas/sin acción, reintentos HTTP, modelos y herramientas. No cambia reglas de catálogo.

16 casos de costo en spec: 12 promovidos del diagnóstico198 + 4 controles de respuesta larga/acción/recuperación en Chat y Responses. Foco74/74, TS general/build y Node92 aprobados. Inventario completo18.776/269: primera global18.775 verdes/1 fallo por contrato antiguo que exigía resumen; actualizado solo ese spec y repetida su suite48/48. Auditoría575hashes confirma runtime intacto desde la global, único cambio posterior `whatsapp-agent.spec.ts`; inventario combinado exacto. No llamarlo segunda global congelada. Evidencia `docs/whatsapp-cosmetic-retry-validation-2610.md` y `/tmp/ppp-203-global-summary.json`.

Una llamada menos en los turnos afectados, no ahorro porcentual/dólares medido. Telemetría199 y cambio203 sin despliegue; faltan otras modalidades y asociación a orden. Siguiente: ocho diagnósticos de composición197 y medición integral. Mantener pendientes anteriores. Solo staging, Main intacta, sin deploy; cero API/Meta/órdenes externas. No declarar vendible por conteos.

## VIGENTE — tanda 202: notas de ají y deduplicación (26/10)

Base `356738c0`. Corregidos4diagnósticos201: preferencia final de ají tras coma se conserva como nota; ruta namedMeal extrae modificaciones con contexto del producto para no repetir ingredientes del título. Enmascarado compartido, sin nombres/IDsPPP. Alcance del ajuste de coma: intensidad de ají reconocida, no cualquier «con X».

28casos promovidos/ampliados:18conversaciones en3menús×agente mock off/on×bastante/poco/mucho hasta DTO,10controles de límites. Primera global detectó6regresiones de notas repetidas en ráfagas; reparadas conservando el extractor anterior con contexto opcional de producto. Foco reparación123/123. TS general/build yNode92OK. Global FINAL18.760/268suites,575hashes,712,34s, fuente congelada/inventario exacto. Evidencia `/tmp/ppp-202-final-global-summary.json` y `docs/whatsapp-combo-intensity-validation-2610.md`. No usar la primera global fallida como aprobación.

Los6diagnósticos201 ahora pasan y están en spec, sin duplicado repro. Siguen8composición197 y pendientes anteriores; próximo reducir llamada de resumen198 sin eliminar recuperaciones, además de composición. Costos199 aún sin deploy/otras modalidades/asociación a orden, sin ahorro medido. Solo staging; sin deploy, Main intacta; cero API/Meta/órdenes externas. No declarar vendible por conteos.

## VIGENTE — tanda 201: notas en combos plurales (26/10)

Base `27b49bf8`. Corregida pérdida de «sin cebolla/sin ensalada» al pedir combos plurales: el enmascarado del título del catálogo admite combo/combos. Traza confirma texto completo en handler y pérdida en extractor, no persistencia. Sin excepciones por restaurante.

18 casos en spec (promoción de los 2 diagnósticos200 + ampliación): 12 cierres DTO en 3 menús/off-on simulado, 6 controles de nombre sin nota. Foco55/55, TypeScript general/build yNode92OK. Global18.732/267suites,575hashes,694,13s; inventario exacto/fuente congelada. Evidencia `docs/whatsapp-plural-combo-notes-validation-2510.md` y `/tmp/ppp-201-global-summary.json`.

Ampliación «con bastante ají» todavía falla: 6 diagnósticos opt-in,2verdes/4rojos en `whatsapp-combo-intensity-note.repro.ts` (arroz pierde nota, pasta añade texto redundante). No incluidos en total aprobado. Siguiente trazar/corregir esos caminos; siguen8pendientes de composición197. Costos199 aún sin deploy, faltan otras rutas/asociación a orden; ahorro por resumen198 pendiente. Solo staging, Main intacta, sin deploy ni API/Meta/órdenes externas. No declarar vendible por conteos.

## VIGENTE — tanda200 validada: combo explícito en plural (25/10)

Base6294bffa. En ruta cantidad>=2, nombre completo de un único combo activo evita volver a preguntar familia. Selector conservador por frase del catálogo; duplicados, agotados, títulos incompletos o dos combos independientes no reciben override. Sin IDs/nombresPPP runtime.

Matriz19824:20/4antes→24/24después; promovida a spec sin duplicación.13controles adicionales (9selector+4notas/DTO); foco37/37,28cierresDTO. Global18.714/266suites,574hashes,706,66s; inventario exacto y fuente congelada. Evidencia /tmp/ppp-200-global-summary.json. TS general/build yNode92OK. Evidencia docs/whatsapp-explicit-combo-quantity-validation-2510.md.

NO cierre total: diagnóstico197PPP4verdes/8rojos sin cambio;2nuevos casos de arroz pierden«sin cebolla», reproducidos también contra orquestador anterior, conservados opt-in en whatsapp-combo-note-loss.repro.ts. Siguiente notas/composición en esos caminos; costos199aún sin deploy ni coberturaaudio/visión/legacy. Main intacta, cero API/Meta/órdenes externas. No declarar vendible por conteos.

## VIGENTE — tanda199 validada: medir inferencia por intento (25/10)

Baseb4d2397a. Runtime añade observación por intento HTTP del agente textual: tokensentrada/salida/cache/razonamiento cuando el proveedor los devuelve, unknown ante timeout/ausencia, requestId+attempt, conversationId+inferenceTurnId, modelo y motivo de ronda. Sin contenido de cliente/credenciales. No modifica decisiones ni ahorra llamadas todavía; no cubre visión/audio/legacy ni asociación orderId. Cero inferencia pagada.

29pruebas nuevas, foco90/90; TS general/build yNode92OK. Global18.677/264suites,572hashes,708,56s, inventario exacto y fuente congelada; /tmp/ppp-199-global-summary.json. Evidencia y límites en docs/whatsapp-inference-usage-validation-2510.md. Publicación solo staging. Main intacta, sin deploy.

Siguiente: terminar observabilidad por sesión/pedido y otras rutas, luego optimizar resumen sin perder información; retomar4pluralesbowl198y8composición197. Rama orderQty>=2ofrece familia antes de respetar coincidencia fuerte: hipótesis localizada, no corrección validada. Mantener pendientes anteriores, no declarar vendible por conteos.

## VIGENTE — diagnóstico198: combos plurales y costo (25/10)

Basee3bd166e.36casos nuevos opt-in:24combos en3menús (20cierresDTO verdes,4pluralesbowl fallan por selección innecesaria) y12contratos de costo (8verdes,4rojos:421caracteres provoca segunda inferencia para resumir en Chat y Responses). Total28/36; fallos fuera del inventario global. HTTP/modelo simulados; ninguna medición de ahorro real. Primer intento tenía oráculo DTO incorrecto, corregido antes del resultado final.

Sin runtime/config/deploy. TS generalOK; global19718.648/263 permanece vigente. Evidencia y plan: docs/whatsapp-combo-cost-diagnostic-2510.md. Próximo instrumentar solicitudes/tokens/cache/modelo por conversación, después eliminar resumen extra solo con respuesta completa y acciones verificadas; mantener recuperaciones de compras incompletas. Responses permite3000tokens aunque cuerpoChat indica900: límite no equivaleconsumo. Continuar plural de combo y pendientes197/191/192/183/184/186. Pilotar con métricas de cierres, errores críticos, costo y latencia; no declarar vendible por conteos. Solo staging, Main intacta, cero API/Meta/órdenes externas.

## VIGENTE — tanda197: opciones numéricas, notas y auditoría de consumo (25/10)

Base73e23ab2. Normalización basada en opciones del catálogo: «7 up» ya no aporta siete unidades; también cubierta con 3fresh/9cool sintéticos, cantidades reales, calles y volúmenes. Corrección PARCIAL: combo explícito singular correcto; mensaje sin combo y plural aún separan arroz/pollo. Diagnóstico12: antes2verdes/10rojos, después4verdes/8rojos. No esconder esos ocho pendientes del inventario verde.

21 regresiones nuevas, ocho cierres DTO con atributos; foco21/21, TS general/build y Node92 OK. Global18.648/263,567hashes,891,04s, inventario exacto/fuente congelada. Después, sin cambios runtime, 20/20 pruebas opt-in de notas redundantes (16DTO sintéticos+4PPP). Arroz real requiere selección adicional antes de comprobar nota: fricción pendiente. Evidencia: docs/whatsapp-numeric-option-validation-2510.md.

Auditoría productiva solo lectura solicitada: agotamiento de saldo25/10 15:11–15:22 Bogotá; después189entrantes en6conversaciones,19órdenesWhatsApp (no tres o cuatro), sin audio/imagen. Delta informado1,18USD/19≈0,062USD provisional; sin conciliación de factura ni distinción pruebas/clientes, no costo exacto. Logs45turnos no equivalen45HTTP. Próximo: instrumentar tokens/cache/modelo/llamadas y vincular conversación/orden para medir costo; continuar composición de combos y pendientes191/192/183/184/186. No cambiar modelo por estimaciones.

Solo staging, sin deploy ni Main, cero inferencia pagada/Meta/órdenes externas. No declarar piloto por conteos.

## VIGENTE — tanda196: negación múltiple corregida (25/10)

Basee9323d41. «No va/van A ni B» y «no quiero A ni B» resuelven nombres completos contra catálogo/carrito antes de la reformulación de compra; eliminación en una actualización, extras ausentes no se compran, atributos del combo no identifican productos independientes. Ambigüedad conserva carrito y pide nombre completo. Selección/pago pendiente bloquea la mutación con explicación; no acreditar recuperación completa de esos pendientes ni nombres abreviados/sustituciones mixtas.

Matriz19554/54verde (antes46rojos); promovida a whatsapp-multiple-negation.spec.ts, sin copia diagnóstica duplicada. Cuatro controles extra:58nuevos en inventario,48cierresDTO. Foco82/82; TS general/build yNode92OK. Global18.627/262,565hashes,685,71s, inventario exacto/fuente congelada. Evidencia docs/whatsapp-multiple-negation-validation-2510.md y /tmp/ppp-196-global-summary.json.

Diagnósticos reales194:2verdes/6rojos, ambas negaciones corregidas; siguen7up→7medios pollos, dirección de cortesía y reparto de sopas. Próximo7up con cantidades, combo padre y corrección posterior; conservar pendientes191/192y183/184/186. Publicación solo staging; SIN deploy ni Main; ceroAPI/Meta/órdenes externas. No declarar piloto por conteos.

## VIGENTE — diagnóstico195: negación múltiple (25/10)

Base73f84e26. Nueva matriz54casos:48negaciones (3menús×agente mock off/on×compra/pago×extras presentes/ausentes×no va/no quiero) y6compras positivas. Resultado46rojos/8verdes,28,193s; solo2negaciones con extras ausentes llegan al DTO, losotros6verdes son controles positivos. Snapshotprimerturno:29carritos incorrectos/19esperados; no confundir fallos de respuesta con duplicación. Repetición inmediata no acredita respuesta nueva por posible deduplicación.

Sin cambios runtime ni despliegue. Archivo opt-in `whatsapp-multiple-negation.repro.ts`, fuera del inventario verde. Diagnóstico, evidencia y próxima implementación en `docs/whatsapp-multiple-negation-diagnostic-2510.md`. Parser de eliminación solo admite verbo explícito+un producto; aún falta instrumentar rutas alternativas, interceptar negación múltiple inequívoca y aplicar eliminación atómica sin tocar combo por sus atributos. TypeScript general aprobado; última global19418.569/261 sigue vigente, no se repite por diagnóstico. Publicación solo staging, Main intacta; cero API/Meta/órdenes externas. Siguen abiertos nuevos chats194 y casos191/192.

## VIGENTE — tanda194: compra con preferencia opcional y chats nuevos (25/10)

Base4355f281. Compra inicial inequívoca con «si hay/tienes/tienen [acompañamiento] mejor» conserva platos posteriores y pregunta a cuáles aplica la nota; no cobra un adicional ni promete disponibilidad. Repetición exacta conserva carrito y pendiente; cancelación conserva productos. Alcance limitado a carrito vacío, al menos dos platos anteriores distintos, catálogo resoluble/defaults completos; condiciones obligatorias y reparto complejo siguen abiertos.

24 regresiones nuevas (18 recorridos hasta DTO en3menús×3formas×agente mock off/on,2cancelaciones,4límites del método). Foco final24/24; TS general/build y Node92OK. Global18.569/261,564hashes,696,38s, inventario exacto/fuente congelada. Diagnósticos191/192:12verdes/8rojos, mejora6; no afirmar todos resueltos. Evidencia `docs/whatsapp-optional-preference-validation-2510.md` y `/tmp/ppp-194-global-summary.json`.

Leídos los dos adjuntos nuevos (tres chats): ocho diagnósticos adicionales TODOS ROJOS en `whatsapp-evening-chats-2510.repro.ts`, fuera del inventario verde. «7 up» produce7medios pollos; «no va A ni B» añade arepas; cortesía de domicilio se guarda como dirección; sopas pierden notas/reparto y añaden arroz. Auditoría/plan: `docs/whatsapp-evening-chats-2510-audit.md`. Priorizar negación múltiple y marca numérica, luego destino/cortesía y reparto; probar conversación completa y DTO, no solo respuesta. Inferencia/mapas simulados; cero API/Meta/órdenes externas. Publicación solo staging, SIN deploy; Main intacta. No declarar piloto por conteos. Siguen pendientes largos191 y183/184/186.

## VIGENTE — tanda193: compra condicional no explora preparaciones (25/10)

Base5a7999eb. Corregida inconsistencia entre «me das/me regalas un plato si tienes...» y «quiero/dame»: prefijo explícito de compra con cantidad + condición de inventario no dispara browse por preparación. La condición se conserva completa para el manejador de pedidos. Sin IDs/restaurantes especiales.

21casos nuevos en3preparaciones,4fórmulas de compra,3consultas reales y6recorridos router on/off. Baseline9rojos/12verdes; final21/21, foco179/179. TS general/build yNode92OK. Global18.545/260,562hashes,698,86s, inventario exacto/fuente congelada. Evidencia `docs/whatsapp-conditional-style-routing-validation-2510.md` y `/tmp/ppp-193-global-summary.json`.

CORRECCIÓN PARCIAL: los20diagnósticos191/192 siguen14rojos/6verdes. ReplayPPP sin agente ya recupera ambos pollos tras aclaración (antes solo broaster), pero aún faltan plátanos y reparto. No atribuir éxito de pedido/DTO/modelo a esta tanda. Próximo: representación completa compra+condición+productos posteriores, conservación/recuperación sin duplicados y aclaración de asignación; acciones semánticas válidas/vacías/error por separado. Publicación solo staging, SIN deploy; Main intacta; ceroAPI/Meta/órdenes externas.

## VIGENTE — diagnóstico 192: condiciones y acompañamientos (25/10)

Base63c15b5b. Nueva matriz18casos en3menús×agente simulado off/on×sin condición/condición simple/reparto. Seis controles pasan;12condicionados FALLAN. Junto a2replays191:14rojos/6verdes,37,664s. Repetición instrumentada confirma12/6; no sumar repetición como nuevos casos. `whatsapp-conditional-accompaniments.repro.ts` es opt-in, fuera del inventario verde.

Hallazgo: en todos los sintéticos disponibilidad=false y browse preparación=null; por tanto no atribuir todos los fallos al browse broaster observado en PPP. Sin agente se pierde el segundo plato o se desvía a candidatos; con agente el mock recibe1llamada y devuelve0acciones, lo que NO mide al modelo real. No corrección runtime ni deploy. Última global19118.524/259 sigue vigente. Plan y límites: `docs/whatsapp-conditional-accompaniments-diagnostic-2510.md`. Próximo: segmentación de condición/alcance/productos posteriores, conservación de compras independientes y aclaración específica; probar acciones semánticas válidas, vacío y error por separado, luego DTO. Main intacta; ceroAPI/Meta/órdenes externas.

## VIGENTE — tanda 191: notas frente a ingredientes del nombre (25/10)

Base b9bf7639. Reproducida compra mixta con cantidades correctas pero nota espuria «con queso y bocadillo por» (2 rojos off/on). Se reutiliza `orderKitchenNote` al añadir varios platos para considerar el producto elegido. Las compras individuales ya pasaban: no atribuirles una mejora nueva. Sin excepciones por restaurante/ID.

20 casos nuevos: tres catálogos, agente simulado off/on, compra individual/mixta, notas reales y 12 cierres DTO. Foco65/65; TS general/build y Node92 OK. Global18.524/259 suites,560 hashes,749,4s, inventario exacto y fuente congelada. Evidencia `docs/whatsapp-catalog-name-notes-validation-2510.md` y `/tmp/ppp-191-global-summary.json`.

IMPORTANTE: `whatsapp-accompaniment-recovery.repro.ts` conserva DOS recorridos completos FALLIDOS fuera del inventario verde. Compra condicional con papas/yuca, consultas previas y correcciones no recupera todos los productos. No afirmar solucionado todo el chat ni diagnóstico del modelo real a partir del mock. Próximo: separar compra/condición, aclarar asignación de acompañamientos y recuperar parcial sin duplicar; siguen efectivo50 y pendientes183/184/186. Publicación solo staging, SIN despliegue; Main/producción intactas; ceroAPI/Meta/órdenes externas.

## VIGENTE — tanda 190: recapitulación y nombre «Es» (25/10)

Base e82b792a. Reproducido el origen local de nombre «Es» desde «Es un pollo frito y uno a la broster»: parser de nombre inicial + validador permisivo. Se rechaza ese fragmento sin bloquear nombres cortos válidos; checkout recupera destinatarios antiguos inválidos antes de crear orden. «O sea / es decir» con varias cantidades se valida contra el carrito como resumen, no compra; coincidencia inequívoca confirma sin añadir, discrepancia pide producto+cantidad sin mutar. No asigna cantidades distintas por orden visual ni interfiere con selecciones pendientes.

45 casos nuevos en whatsapp-order-restatement.spec.ts: 3 menús, agente simulado off/on, compra/pago, repetición, ambigüedad, nombres cortos, compra adicional real y recuperación de nombre inválido; 26 cierres DTO. Baseline 5/5 rojos; foco final 138/138. TS general/build y Node 92 OK. Global 18.504/258 suites, 558 hashes, 787,98 s, inventario exacto/fuente congelada. Evidencia docs/whatsapp-restatement-validation-2510.md y /tmp/ppp-190-global-summary.json.

Publicado solo en rama staging; SIN despliegue, Main/producción intactas, cero API/Meta/órdenes externas. La semilla de recapitulación ya conservaba cantidades en baseline: se corrige respuesta falsa, no atribuirle una duplicación no reproducida. Próximo: compra inicial parcialmente fallida con dos platos y acompañamientos repartidos, recuperación sin duplicar y nota residual del plátano; también Efectivo50 y pendientes183/184/186. No declarar todo el chat corregido ni piloto por conteos.

## VIGENTE — tanda189: referencia tras pin y dirección antes del nombre (25/10)

Base817395e7. Corregidos6diagnósticos rojos de188: solicitud/referencia nominal después del pin mantiene coordenadas/tarifa y retoma pago/confirmación; referencia repetida no duplica. Dirección ya capturada mientras espera nombre recibe reconocimiento y conserva lugar para calle posterior. Regla general, sin IDs/nombres específicos. Ocho diagnósticos pasan a whatsapp-new-chats-2510.spec.ts. Matriz nueva42casos en3menús×agente mock off/on: referencia directa/solicitada, pago/confirmación, interrupciones, cambio de calle, reinicio y portería antes de nombre;30cierresDTO conservan unidades/notas/destino. Foco52/52 inicial, matriz final42/42. TS general/build yNode92OK. Global18.459/257suites,557hashes,776,07s, inventario exacto/fuente congelada. /tmp/ppp-189-global-summary.json.

Solo publicación staging; sin despliegue ni Main/producción. Modelo/mapa/órdenes simulados, cero llamadas pagadas/Meta/órdenes externas. Detalle: docs/whatsapp-pinned-reference-validation-2510.md. No todos los chats resueltos: siguen reformulación «o sea1y1», acompañamientos repartidos, nota residual, origen del nombre«Es», efectivo50 y pendientes183/184/186. Inspección del validador acepta«Es», pero aún no prueba origen de extracción. Próxima tanda: reproducir cantidades/reformulación y destinatario desde conversación completa; no volver a contar188como6rojos vigentes, ahora están corregidos. Referencias largas o mezcladas con consultas/compra no están cubiertas por esta regla breve.

## VIGENTE — tanda187: pin legible para domiciliario y logs técnicos (25/10)

Base a0d19040. Directions.end_address se aprovecha como «Referencia de mapa» sin llamada extra; conserva nombre/dirección aportados, interiores y enlace al pin original. Elimina coordenadas sueltas, oculta URL técnica al cliente pero la mantiene en DTO para navegación. Sin dirección del proveedor usa «Ubicación compartida», no inventa calle. Se reconoce pin por enlace coincidente con coordenadas guardadas o formato legado, evitando recotizar al añadir conjunto/nombre. Ocho recorridos nuevos hasta DTO, HTTP/mapa/órdenes simulados; cero llamadas pagadas/Meta/órdenes externas.

Foco82/82; primera global44fallos (8expectativas del formato anterior y36regresiones de identificación del pin), corregidos y revalidados104/104 focales. Global FINAL18.409/255suites,555hashes,739,29s, inventario exacto/fuente congelada; TS general/build finales yNode92OK. Evidencia docs/whatsapp-location-and-errors-2510.md y /tmp/ppp-187-final-global-summary.json. Publicación solo rama staging, SIN despliegue. Main/producción sin modificar.

Logs de producción leídos para25/10 15:09–15:24Bogotá: cinco429 credit_balance_exhausted, cuatro coinciden con mensajes técnicos de15:11:41,15:12:07,15:16:24,15:22:28del chat. Causa acreditada para esos errores: saldo del proveedor agotado entonces, no evidencia del saldo actual. Log privado /tmp/ppp-187-prod-errors.log; no subir datos de clientes. Pendiente mejorar degradación/telemetría de errores; no se cambió esa respuesta ni facturación. Próximo funcional sigue sopa independiente + ejecutivo de186, sustitución papa/o/yuca y conjunto/interiores. Siguen diagnósticos rojos183/184 documentados. No declarar vendible por conteos.

## VIGENTE — tanda 186: compra + consulta de total/transferencia (25/10)

Base c28fe0eb. Corregido el desvío a cotización cuando una compra termina con «Cuánto sería para pagar por Nequi / Me envía el número gracias». Se conserva la compra, se muestra el carrito resultante y se responden datos bancarios configurados; sin seleccionar pago ni confirmar automáticamente. Regla por intención, sin IDs o productos específicos. 28 regresiones nuevas: tres menús, cantidad con/sin verbo, agente simulado off/on, datos bancarios presentes/ausentes, cotización y sabor pendiente; 24 cierres con DTO de dos unidades. Baseline inicial12/12rojos; final28/28. Diagnóstico183 mejora de2/8a4/8; **siguen fallando los cuatro recorridos del mensaje largo real** (con/sin pago, off/on). La sopa independiente se pierde y el ejecutivo queda con Ajiaco. No declarar ese chat resuelto.

TypeScript general/build y Node92OK. Global final18.401/254suites,554hashes,694,26s; fuente congelada/inventario exacto. Primera global interrumpida por fallo de cantidad sin verbo, no cuenta. Evidencia docs/whatsapp-purchase-transfer-validation-2510.md y /tmp/ppp-186-global-summary.json. Solo rama staging; sin despliegue, Main/producción intactas, ceroAPI/Meta/órdenes externas. Agente/mapa/persistencia simulados. Próximo: sopa independiente antes del ejecutivo vs opciones internas; sustitución «papa o yuca» por aclarar sin extras; conservar conjunto/interiores y comprobar total/cancelación. Siguen12diagnósticos rojos de184. Agrupar despliegues; no usar conteos como criterio de venta.

## VIGENTE — tanda185: destino explícito no compra números (25/10)

Base714c985e. Corregido CHAT2510-16 parcialmente: «El pedido es para jardines 4 la casa 4» se enruta como destino independiente, sin alias/SKU/restaurante especial. Conserva carrito/notas/pago y siguiente paso. Seis diagnósticos rojos de184 promovidos/ampliados a36regresiones en3menús×agente simulado off/on×pago/confirmación×3destinos; destino repetido y DTO con2unidades. Foco361/361; matriz final36/36 tras fortalecer pago previo. TypeScript general/build finales yNode92OK. Global18.373/253suites,553hashes,679,47s, inventario exacto/fuente congelada. Evidencia /tmp/ppp-185-global-summary.json y docs/whatsapp-explicit-destination-validation-2510.md.

Publicación solo rama staging, sin despliegue. Main/producción intactas; ceroAPI/Meta/órdenes externas. Mapa/tarifa/modelo simulados: no acredita geocodificación real ni ráfagas ni todos los mensajes mixtos. Retirado whatsapp-address-number-preservation.repro.ts, ahora whatsapp-explicit-destination.spec.ts. Siguen abiertos12diagnósticos de auditoría184 y6fallos de183; cantidades/negación del mismoCHAT16 no se arreglaron aquí. Próximo: compra+totalNequi y sopa independiente frente a atributo, luego reemplazo de ejecutivo sin unidad extra. No repetir inventario; reproducir y corregir causa general con cierreDTO. Agrupar despliegue staging de cambios pendientes, no tocarMain.

## VIGENTE — auditoría184: chat.txt completo; 18 diagnósticos rojos (25/10)

Base49cf15d4. Revisados2.875líneas/445mensajes,28recorridos y26comprobantes: no equivalen a26pedidos correctos. Informe por recorrido y plan priorizado en docs/whatsapp-chat-2510-audit.md/json. 12diagnósticos reales (cortesía/porción/envase/cantidad/negación/reemplazo) +6destinos numéricos en3menús FALLAN. 6controles nuevos de destino explícito pasan hastaDTO; foco48/48incluye42existentes. Diagnósticos opt-in.repro.ts fuera del inventario verde; no declarar corregidos. Destino «El pedido es para jardines4 la casa4» compra4unidades delcódigo4 conagente mock; sinagente conserva dirección vieja. Prioridad inmediata corregirlo, luego compra+Nequi183; no repetir inventario. TypeScript general/build yNode92OK. Runtime sin cambios,549hashes182iguales; Main/prod intactas, sin deploy/API/Meta/órdenes externas. Ver informe para pruebas, límites y logs. Pendientes técnicos Pepsi requieren trazas; recibos sinnotas no prueban pérdida encocina.

## VIGENTE — investigación183: pedido+Nequi sigue FALLANDO (25/10)

Baseae79f6d7. No corrección runtime ni tanda funcional cerrada. Matriz opt-in8recorridos: mensaje real, real sin pregunta de pago, formulación explícita y explícita+pregunta de pago; agente simulado on/off. Resultado6FALLIDOS/2aprobados,26,945s. Solo formulación explícita sin pago conserva sopa independiente+ejecutivo conMenudencias/PiernaPernil/Colombiana. Mensaje real sin pago pierde sopa, dejaAjiaco y truncaVillaGalante a«galante». ConsultaNequi reproduce cotización. Quitar pregunta no basta; no desplegar arreglo parcial como solución.

Repro: src/whatsapp/whatsapp-order-transfer-diagnostic.repro.ts; comando npx jest --testRegex='whatsapp-order-transfer-diagnostic\.repro\.ts$' --runInBand. Intencionalmente fuera del inventario verde por ser reproducción abierta, NO sumar8como regresiones aprobadas. Logs /tmp/ppp-183-diagnostic.{log,json}; TypeScript general/buildOK,549hashes previos iguales; global vigente182:18.331/251. No runtime/Main/deploy/API/Meta/órdenes externas. Próximo debe corregir, no repetir inventario: separar pregunta total/transferencia conservando ejecución de compra y respuesta; investigar segmentación sopa independiente frente a atributo del ejecutivo; conservarVilla/interiores; aclarar papa o yuca sin cargos adicionales. Validar todo el chat antes de considerarlo cerrado.

## VIGENTE — tanda182: contenido del combo + nuevos chats pendientes (25/10)

Base6da0597a. Se amplía referencia de composición existente a «el combo/plato/producto», «la opción» y «con qué viene acompañado», sin abrir reemplazo.18casos nuevos con3catálogos sintéticos×agente simulado on/off×3consultas; carrito inicial sembrado conPepsi. Baseline15fallos/3aprobados; corregidos18/18,10,488s; cierreDTO conserva una unidad yPepsi. TypeScript general/build yNode92OK. Global18.331/251suites,549hashes,689,59s; inventario exacto/fuente congelada. /tmp/ppp-182-global-summary.json. Publicado solo staging, sin despliegue; Main/producción180 intactas.

IMPORTANTE: no están resueltos todos los chats del25/10. docs/whatsapp-open-cases-2510.json conserva repro ejecutable fuente del pedido+totalNequi(2/2fallos), especificación de ejecutivos repartidos y acompañamientos/comprobante. Próximo prioritario: compra explícita+pregunta total/transferencia no debe convertir opciones enSKUs ni cotizar toda la frase; después2ejecutivos conatributos repartidos ycorrecciones sin crear terceraunidad. Contenido delcombo es el único fallo cerrado aquí. Consulta con saltos de línea simulada en un turno, no transporte real de ráfagas. No contar casos pendientes como pruebas verdes. Cero API/Meta/órdenes externas. Ver whatsapp-combo-content-validation-2510.md.

## VIGENTE — tanda181: dos consultas + cambio de dirección (25/10)

Basee2356390, solo staging.24 casos nuevos:3menús sintéticos×agente simulado on/off×posición de consultas×mapa localizado/ambiguo. Baseline24/24aprobado, sin cambios runtime. Precio/contenido respondidos; nueva calle+torre/apto conservados; dirección anterior descartada; tarifa nueva5000 o null si mapa ambiguo. Los12ambiguos piden ubicación y recuperan con pin. Todos cierran DTO simulado con2unidades/notas/nombre/interior/tarifa correcta, sin creación prematura. Foco72/72,3suites,13,294s; TypeScript general/build y Node92/92OK.547hashes anteriores iguales; última global ejecutada180:18.289/249, no sumar24 como global nueva.

Publicado rama staging; sin despliegue. Producción sigue180 verificada y staging servidor177. Cero API/Meta/órdenes externas. No acredita precisión real del mapa ni consultas ambiguas mezcladas con dirección. Ver whatsapp-address-multiple-inquiry-validation-2510.md. Próximo: interrupciones/cambio de opinión durante aclaración de precio, varias dudas pendientes; después dirección+pregunta no resuelta. No declarar vendible por conteos.

## VIGENTE — producción desplegada hasta180 (25/10)

Solicitud explícita «despliega en prod». Main local/remota integrada por fast-forward a0f8c98da; servidor /var/www/ppp-nest ejecuta ese commit. Verificado25/10 16:52UTC: imagene7c46300…,running/0reinicios; API públicaOK,DBconnected,circuitCLOSED; código compilado de respuesta parcial/contacto presente. Validación previa18.289/249suites,547hashes idénticos, TypeScript general/build y Node92. Compose privado y.env preservados por hash; bases/volúmenes intactos. Rollbackppp-nest-api:rollback-before-0f8c98da. Artefactos locales Main conservados(184archivos por hash).

Staging sigue activa: servidor hasta177, imagenc0c234f8…,healthy,0reinicios,API/DBOK; rama contiene180.178–180 aún pendientes del próximo despliegue agrupado de staging. Modelos efectivos iguales(Sol6.1/Luna/Luna/Transcribe). Registro docs/whatsapp-main-promotion-2510.json; /tmp/ppp-main-{deploy-2510.log,verified-2510.json}. Cero API pagada/WhatsApp/órdenes externas. Commit posterior solo documental no exige reconstrucción. Continuar próximo bloque180 en staging, preservando Main.

## VIGENTE — tanda180: respuesta parcial + contacto (25/10)

Base474f66bb. 24 casos nuevos, tres menús × agente simulado on/off × nombre/teléfono × orden de cláusulas durante pago. Baseline final24/24falló; foco corregido24/24,11,027s. Se guarda contacto explícito con servicios existentes, responde consulta conocida y confirma dato; única consulta sin resolver se devuelve al router habitual. Selección posterior consulta precio sin comprar ni elegir pago; cierre verifica DTO con tres unidades/notas/contacto. TypeScript general/build y Node92/92OK. Global18.289/18.289,249suites,547hashes,739,36s; inventario exacto y fuente congelada. /tmp/ppp-180-global-summary.json.

Publicado solo rama staging, sin despliegue; servidor hasta177, agrupar178–180. Main/producción intactas. Cero API/Meta/órdenes externas. No acredita dirección mezclada, múltiples dudas pendientes, preguntas sin delimitadores ni inferencia real. Ver whatsapp-partial-inquiry-validation-2510.md. Próximo: consultas+dirección conservando precisión de mapa y cambio de opinión durante aclaración. No declarar vendible por conteos.

## VIGENTE — tanda179: tres consultas + contacto (25/10)

Base e88b88a1. 24 casos nuevos: tres menús sintéticos × agente simulado on/off × nombre/teléfono × preguntas antes/después. Precio, contenido y tiempo estimado durante pago; verifican las tres respuestas, siguiente paso, contacto, carrito sin cambios y DTO simulado con dos unidades/notas. Baseline aprobado: sin cambios runtime. Foco 48/48 en dos suites, 12,002 s; TypeScript general/build y Node 92/92. Los 545 hashes previos de global178 permanecen iguales; no se repitió global ni se suman estos casos a una global ficticia. Última global ejecutada: 18.241/247 suites.

Publicado en rama staging; servidor sigue hasta177, tanda178 pendiente de despliegue agrupado. Main/producción intactas; cero API, Meta u órdenes externas. Siguiente prioridad: consulta resoluble + consulta ambigua + contacto; reproducir antes de modificar. No afirmar cubiertas preguntas sin delimitadores, pronombres o respuesta parcial. Ver whatsapp-three-inquiry-validation-2510.md.

## VIGENTE — tanda178: varias consultas + contacto (25/10)

Base2b2af519;24casos nuevos,3menús×agente mock on/off×nombre/teléfono×consultas antes/después durante pago. Baseline24/24falló. Se amplía separador existente a2–3 preguntas explícitas delimitadas, solo si todas tienen respuesta determinista. Reutiliza handlers de consulta/contacto. Foco210/210,3suites,29,318s; TypeScript general/build y Node92/92OK. Global18.241/18.241,247suites,545hashes,683,86s; inventario exacto y fuente congelada. /tmp/ppp-178-global-summary.json. Publicado solo rama staging; sin desplegar, servidor hasta177. Main/producción intactas.

Pruebas verifican dos respuestas, dato, recordatorio, carrito y DTO simulado con2unidades/notas. No acredita tres preguntas ni consultas desconocidas ni pronombres. Cero API/Meta/órdenes externas. Ver whatsapp-multiple-inquiry-validation-2510.md. Próximo: tres preguntas y respuesta parcial sin pérdida de contacto, luego dirección+consultas. No declarar vendible por conteos.

## VIGENTE — tanda177: cancelación/reinicio/recogida sin bloqueo (25/10)

Base5a7f5c92;36 casos nuevos,3menús×agente mock on/off×3salidas×ambigüedad/fuera cobertura. Baseline36/36 ya pasa: no cambios runtime. Foco114/114,4suites,26,41s; TypeScript general/build y Node92/92 OK. Recogida conserva2unidades/notas, cancelación/reinicio vacían y permiten compra nueva de1unidad. Todos cierran DTO simulado sin domicilio ni interior viejo y sin creación prematura. No hay orden previa enviada en fixtures.543hashes de global176 idénticos; global vigente18.181/245, no sumar36 como global ejecutada. Despliegue agrupado175–177 verificado25/10 15:47UTC enbcedadcb; imagenc0c234f8…,healthy/0reinicios, API OK/DBconnected/circuitCLOSED. Flags staging/public-chat/order-events=true/true/false; .env preservado por hash. Rollback ppp-nest-staging:rollback-before-bcedadcb. Producción43a0d14f… intacta. Logs /tmp/ppp-177-{deploy,verified}.log.

Ver whatsapp-destination-exits-validation-2510.md. Modelo/mapa simulados, cero API/Meta/órdenes externas. Próximo: varias preguntas con contacto; pin con nombre+calle; carrito pendiente frente a orden ya enviada. No declarar vendible por conteos.

## VIGENTE — tanda176: contacto+precio con dirección ambigua (25/10)

Base38798737,24 casos nuevos:3menús×agente mock on/off×antes/después del pin×nombre/teléfono. Primer baseline de datos/DTO24/24pasó; al verificar próximo paso se reprodujeron6fallos: nombre+precio antes del pin cerraba con ¿Algo más? en vez de solicitar ubicación pendiente. Regla compartida de recordatorio reconoce destino delivery sin tarifa ni coordenadas; preserva prioridades de opciones/nombre/teléfono y no cambia cobertura. Foco corregido234/234,4suites,30,27s; TypeScript general/build y Node92/92 OK. Global18.181/18.181,245suites,543hashes,678,96s; inventario exacto y fuente congelada. /tmp/ppp-176-global-summary.json. Publicado solo en rama staging; sin despliegue, servidor hasta174 (175–176 pendientes de despliegue agrupado). Main/producción intactas.

Cada recorrido verifica precio, recordatorio, carrito/notas/interiores, contacto corregido y DTO simulado de2unidades. Una pregunta explícita y puntuación, no múltiples consultas. Cero API/Meta/órdenes externas. Ver whatsapp-pin-contact-validation-2510.md. Próximo: varias preguntas con contacto, pin con nombre+calle del mismo destino, sin fusionar destinos dudosos. No declarar vendible por conteos.

## VIGENTE — tanda175: pin con mismo nombre de conjunto (25/10)

Base36617ddc;12 casos nuevos (3menús×agente mock on/off×cobertura). Baseline12/12 falla por pérdida de interiores con pin rotulado igual al conjunto previo. Regla permite conservar datos si locationName coincide normalizado con base previa y no hay locationAddress nueva; se mantienen guardas de destino no resuelto. Controles de174 conservan sustitución de destino nuevo. Foco107/107,4suites,25,802s; TypeScript general/build y Node92/92 OK. Global18.157/18.157,244suites,542hashes,683,33s; inventario exacto/fuente congelada. /tmp/ppp-175-global-summary.json. Publicado en rama staging, sin desplegar; servidor continúa hasta174. Main/producción intactas.

Respuesta ante mapa ambiguo verificada: «No pude identificar» más petición de ubicación, no dirección lista/confirmada. Anotar datos no equivale a localizar; no se cambia la copia en esta tanda. Ver whatsapp-named-pin-validation-2510.md. Sin API/Meta/órdenes externas. Modelo/mapa simulados, destinatario sembrado; no declarar vendible por conteos. Próximo: nombre/preguntas durante recuperación, pin con nombre+dirección explícita del mismo lugar y alias sin inferir equivalencia insegura.

## VIGENTE — tanda174: recuperación con pin (25/10)

Basec4ffc6f9;36 casos nuevos gratuitos con3menús, agente mock on/off, pin nativo/enlace/pin de destino nuevo y cobertura positiva/negativa. Baseline36/36 ya pasa: sin cambio runtime. Foco113/113,4suites,20,301s; TypeScript general/build y Node92/92 OK. Positivos cierran DTO con2unidades/notas/destinatario/interiores; negativos impiden creación fuera de cobertura. Destinatario sembrado y mapa/modelo simulado, no acredita extracción de nombre ni geocodificación real. Global vigente de173:18.109/242; no sumar36 como nueva global ejecutada. Despliegue agrupado173–174 verificado25/10 14:02UTC enbeb31e35; imagen5e20680b…, healthy/0reinicios, API OK/DBconnected/circuitCLOSED. Flags staging/public-chat/order-events=true/true/false; .env preservado por hash. Rollback ppp-nest-staging:rollback-before-beb31e35. Producción43a0d14f… intacta. Logs /tmp/ppp-174-{deploy,verified}.log. Main/producción intactas.

Ver whatsapp-pin-recovery-validation-2510.md. Próximo: pin rotulado con mismo conjunto frente a destino nuevo; nombre antes/después de ubicación y consultas múltiples durante cierre. Sin API/Meta/órdenes externas; no declarar vendible por conteos.

## VIGENTE — tanda173: recuperación de dirección ambigua (25/10)

Base00e7ec3d, solo staging.24 regresiones nuevas:18 recorridos completos (3menús×agente mock on/off×3formas de pago) y6 controles de cambio de calle/interiores. Baseline18/18 falló al borrar apartamento en repetición de la misma calle. Regla conserva interiores solo al repetir calle canónica sin nuevos detalles; cambios explícitos u otra calle no heredan interiores. Foco95/95; TypeScript general/build y Node92/92 OK. Global18.109/18.109,242suites,540hashes,790,01s; inventario exacto y fuente congelada. Evidencia /tmp/ppp-173-global-summary.json. Publicado solo en rama staging; no desplegado, agrupar próximo despliegue (servidor sigue13261a98 hasta172). Main/producción intactas.

Corrección del diagnóstico de172: el sufijo de pago en DTO.address es deliberado en composeWhatsappOrderAddress, no prueba de contaminación de sesión. Pago anticipado ya funcionaba; se retiró regla redundante. DTO.items representa unidades como entradas, no campo quantity. Ver whatsapp-address-recovery-validation-2510.md y /tmp/ppp-173-*.log. Mapas/modelos simulados, sin API/Meta/órdenes externas. Siguiente: mensaje de ubicación simulado después de conjunto+interiores y preguntas múltiples durante cierre. No declarar vendible por conteos.

## VIGENTE — tanda172: continuidad, condimentos y calle abreviada (25/10)

Base33aee94e,36 casos nuevos (35 de flujo +1 saludo). Chats del usuario: sobres de salsa no reconocidos y afirmaciones sin siguiente paso; Cr numerada tras conjunto+interior. Baseline15/15 falló. Correcciones generales: plural de preferencias ancladas, sobres como nota no dirección, Cr→Carrera; completar lugar no localizado con detalles internos preserva torre/apto sin prefijo conjunto obligatorio. setAddress del agente pasa por checkout/mapa; notas/ediciones sin pregunta incluyen pendiente real o ¿Algo más?. Se retira únicamente frase de aprendizaje/errores del saludo y copia antigua guardada, conservando atención/teléfono.

Foco52/52,15,08s; TypeScript general/build OK; Node92/92. Global18.085/18.085,241suites,539hashes,801,75s; inventario exacto/fuente congelada. /tmp/ppp-172-{baseline,focus-approved,tsc,node}.log y global-summary.json. Positivos verifican DTO con notas/unidades/interiores; negativos de mapa se detienen pidiendo ubicación. Tres menús y tres condimentos; dos contratos directos del handler agente acreditan guard/checkout pero no router entero. Cero API/Meta/órdenes externas. Main/producciónhasta171 intactas. Staging desplegado y verificado25/10 13:33UTC en13261a98, imagen71c74937…, healthy/0reinicios, API públicaOK/DBconnected/circuitCLOSED. Flags true/true/false (staging/public chat/order events). Rollback ppp-nest-staging:rollback-before-13261a98. Producción43a0d14f… intacta. Evidencia /tmp/ppp-172-verified.log.

Pendiente relevante encontrado al extender recuperación: tras mapa ambiguo, repetir calle sin interiores puede perder apto y anexar Contraentrega a dirección. /tmp/ppp-172-focus3.log. No acreditar ese cierre como resuelto: próximo bloque prioritario repetición misma calle/ubicación, conservación interiores, pago jamás tratado como dirección. También preguntas múltiples con contacto y referencia histórica. Detalles/errores de fixture y comando documentados en whatsapp-acknowledgement-continuity-2510.md. Mapa/modelo simulados: no acredita ubicación real del conjunto ni precisión de inferencia. No declarar vendible por conteos.

## VIGENTE — promoción Main/producción hasta171 (24/10)

Solicitud explícita: «despliega main». Main local/remoto actualizado por fast-forward a8d7aee28, misma fuente validada por18.049 pruebas/240suites, TypeScript general/build y Node92. Producción /var/www/ppp-nest reconstruida y verificada: imagen43a0d14f…, running,0reinicios; API públicaOK,DBconnected,circuitCLOSED; código compilado de171 comprobado. Compose privado y.env conservados por hash; bases/volúmenes intactos. Rollback ppp-nest-api:rollback-before-8d7aee28 conserva ef426c93…. Modelos prod/staging iguales: Sol6.1/Luna/Luna/Transcribe.

Staging permanece activa e intacta en servidor098250c8 (hasta169), imagencebba760…,healthy,0reinicios; su rama contiene171.170–171 ya están en producción, pero aún pendientes del próximo despliegue agrupado de staging. Main local conserva artefactos generados ajenos; no ejecutar restore/clean sobre ellos. Commit posterior solo documental no requiere reconstrucción. Registro: whatsapp-main-promotion-2410.json; /tmp/ppp-main-{deploy-2410.log,verified-2410.json}. Primera aserción de verificación buscaba comentario eliminado por compilador; reemplazada por patrones de código ejecutable, reensayo aprobado. Cero API pagada/WhatsApp/órdenes externas. No declarar vendible por conteos; continuar próximo bloque de171 solo en staging.

## VIGENTE — tanda171: reclamo + contacto + consulta (24/10)

Base8b1617da, solo staging.162 recorridos nuevos: tres menús×agente simulado on/off×nombre/pago/sabor pendiente×nombre/teléfono/dirección×precio después/contenido después/precio antes. Baseline54/54 falló: respondía precio pero perdía el contacto. Se adelanta normalización del preámbulo y se amplía separador existente de consulta/contacto a estos pasos, etiquetas explícitas y precio. Reutiliza manejadores existentes de datos; no hardcodes de restaurantes.

Foco342/342 en29,145s; TypeScript general/build OK; Node92/92. Global18.049/18.049,240suites,538hashes,734,75s; inventario completo/fuente congelada. /tmp/ppp-171-{baseline,focus-final,tsc,node}.log y global-summary.json. Cada recorrido comprueba respuesta, carrito, pendiente y DTO simulado completo con nombre/teléfono/dirección y cantidades/notas/opciones exactos. Cero API/Meta/órdenes externas. Publicación staging; sin deploy.170–171 pendientes de despliegue agrupado, servidor último acreditado098250c8(hasta169). Main intacta.

Próximo: contacto con varias preguntas o sin separadores; reclamo de tarifa + dirección corregida, preservando interiores; referencias cortas entre líneas del mismo SKU; recuperación de pregunta histórica identificable.171 cubre una consulta explícita con puntuación/producto identificado, no cualquier lenguaje libre. Checkout sembrado, modelo/mapa simulados; no acredita reconocimiento real ni geocodificación. Ver whatsapp-feedback-contact-validation-2410.md. No declarar vendible por conteos.

## VIGENTE — tanda170: comentario con corrección o pregunta explícita (24/10)

Basea36352a7, solo staging.72 recorridos nuevos: tres menús×agente simulado on/off×nombre/pago/sabor×dos correcciones precedidas por queja y dos consultas. Baseline36 fallaron/36 pasaron: preguntas ya se respondían, pero correcciones se rechazaban como nombre o añadían otra línea conservando las dos unidades originales. Ahora se separa un preámbulo de incomprensión/pregunta omitida si le sigue un separador y una instrucción/consulta explícita. Se reutilizan manejadores existentes; mensaje original permanece en historial. Sin excepciones por productos/restaurantes.

Foco180/180,28,587s; TypeScript general/build OK; Node92/92. Global17.887/17.887,239suites,537hashes,766,52s; inventario exacto/fuente congelada. /tmp/ppp-170-{baseline,focus,tsc,node}.log y global-summary.json.72 recorridos verifican respuesta, carrito, estado, pendiente, nombre/dirección y DTO exacto con notas/opciones conservadas. Cero API/Meta/órdenes externas. Publicación solo staging;170 pendiente de despliegue agrupado. Último servidor acreditado098250c8 (hasta169), healthy; Main intacta.

Próximo: comentarios con nombre/teléfono/dirección explícitos, referencias cortas «solo uno» con varias líneas y recuperación de pregunta histórica identificable.170 acredita instrucciones/consultas específicas en el mismo mensaje, con producto nombrado; no lenguaje libre arbitrario ni ambigüedad entre líneas del mismo SKU. Checkout sembrado, modelo/mapa simulados. Ver whatsapp-feedback-action-validation-2410.md. No declarar vendible por conteos.

## VIGENTE — tanda169: comentarios sin interrogación y continuidad (24/10)

Base4092e1c6, solo staging.108 recorridos nuevos: tres menús×agente simulado on/off×nombre/pago/sabor×seis paráfrasis de precio alto, incomprensión y pregunta omitida. Baseline funcional definitivo54/54 falló: rechazo de nombre, repetición de pago o selección inválida. Ahora el manejador de comentarios reconoce frases completas, responde al comentario y conserva recordatorio/estado/datos. No promete correcciones no realizadas ni inventa descuentos. Mensajes con instrucciones o consultas adicionales no son absorbidos por estas expresiones ancladas.

Foco162/162,34,12s; TypeScript general/build OK; Node92/92. Global17.815/17.815,238suites,536hashes,774,28s; inventario exacto/fuente congelada. /tmp/ppp-169-{baseline4,focus-final,tsc,node}.log y global-summary.json. Los intentos anteriores del fixture tuvieron errores de tipo/preparación, documentados; no contarlos como baseline funcional. Cero API/Meta/órdenes externas. Todos los108 recorridos completan DTO simulado con productos/opciones/notas/nombre/dirección conservados. Main intacta. Deploy agrupado166–169 verificado2026-10-24T15:36:39Z: HEAD098250c8467897152367df9eb2c111d0045d4eb3, imagen sha256:cebba760f2939f15c9ced590b7432bb1408771e75c6d5da1a393597b9f1e2961, running/healthy,0reinicios. Health públicoOK,DBconnected,circuitCLOSED. PPP_STAGING=true,publicChat=true,orderEvents=false. Producción conserva ef426c93966a809c007cfb0eb9bf0b83a3e2ef4b137498b23a632e8f61b7d613 y0reinicios. Rollback ppp-nest-staging:rollback-before-098250c8. Se preservan bin/ no versionado, bases, volúmenes y privados; no se usa --remove-orphans. Evidencia /tmp/ppp-169-{before-deploy,deploy,verified}.log. Commit posterior solo documental no requiere reconstrucción.

Próximo: comentarios durante teléfono/dirección, comentarios con corrección o pregunta concreta en el mismo mensaje, recuperación de pregunta histórica identificable y desacuerdo con tarifa + nueva dirección.169 acredita reconocimiento de comentarios aislados y retoma, no reparación automática de un carrito equivocado ni cualquier lenguaje libre. Checkout sembrado, modelo/mapa simulados; contraste real pendiente. Ver whatsapp-customer-comments-recovery-validation-2410.md. No declarar vendible por conteos.

## VIGENTE — tanda168: consultas y cantidades con compras en cola (24/10)

Base a353bdf4, solo staging. 54 casos nuevos: tres menús × agente simulado on/off × nueve escenarios. Baseline 18/30 pasó y 12 falló: consulta de contenido omitía recordar sabor; cantidad + precio respondía sin cambiar unidades. Ahora descripción añade recordatorio; corrección declarativa + precio actualiza cantidad pendiente y responde ambas intenciones. Exige nombre completo normalizado del producto activo; ambigüedad con otra línea o cantidad inválida informa precio y conserva cantidades. No hardcodes de restaurantes/productos.

42 recorridos completan DTO con cantidades, sabores y notas exactos; 12 negativos terminan en aclaración sin mutación ni orden. Foco 234/234, 113,303 s; TypeScript general/build OK; Node92/92. Global 17.707/17.707, 237 suites, 535 hashes, 1.099,85 s; inventario exacto/fuente congelada. /tmp/ppp-168-{baseline,focus,tsc-final,node}.log y global-summary.json. Primer intento de fix tuvo conflicto de variable clauses, corregido antes de ejecución; no confundir con baseline funcional. Cero API/Meta/órdenes externas. Main intacta; publicación staging, sin deploy. Runtime166 y168 pendientes de despliegue agrupado; servidor último acreditado b8a6567a (161–165).

Próximo: comentarios sin pregunta explícita, consulta + corrección de otra línea, resolución de ambigüedad de SKU repetido, opciones retiradas/reordenadas en filas posteriores. Esta tanda prueba comentarios CON pregunta de precio, nombre explícito y cláusulas separadas; no acredita lenguaje libre, inferencia real ni referencias abreviadas. Inicio de checkout sembrado y modelo/mapa simulados. Ver whatsapp-pending-queue-inquiries-validation-2410.md. No declarar vendible por conteos.

## VIGENTE — tanda167: sabor activo retirado y salida de la selección (24/10)

Base59dfc826, solo staging.24 recorridos nuevos: tres menús×agente simulado on/off×nombre/número de sabor retirado×elegir alternativa/cancelar bebida. Baseline12/12 pasó y ampliación24/24 pasó sin cambio runtime. Se cambia el catálogo después de ofrecer sabores: opción anterior ya no existe; bot avisa, muestra Naranja, conserva carrito y cola; consulta de contenido no consume pendiente. Alternativa o cancelación termina sucesoras completas conservando cantidades/notas y DTO exacto.

Foco60/60,24,568s; TypeScript general/build OK; Node92/92. /tmp/ppp-167-{baseline,focus,tsc,node}.log. No global redundante por tests/docs; última global166=17.629/235suites, no sumar focos a global. Cero API/Meta/órdenes externas. Publicación solo staging; no deploy. Runtime166 sigue pendiente de deploy agrupado; servidorb8a6567a(161–165). Main intacta.

Próximo: cambio de cantidad mientras elige sabor, opción retirada de una compra posterior ya encolada, reordenamiento de números, mismo SKU activo y referencias «otras dos de esas».167 acredita retiro de opción de selección activa, no estos pendientes. Modelo/mapa simulados, inicio de checkout sembrado; contraste real pendiente. Ver whatsapp-withdrawn-flavor-queue-validation-2410.md. No declarar vendible por conteos.

## VIGENTE — tanda166: disponibilidad cambia en la cola (24/10)

Base90444258, solo staging.24 recorridos nuevos: tres menús×agente simulado on/off×producto agotado/retirado después de encolar×resolver/cancelar selección activa. Baseline corregido24/24 falló. Ahora cada avance verifica catálogo actual, informa y retira solo la fila no disponible, conserva posteriores y continúa. Al volver al pago se conserva aviso mediante contexto efímero del turno: antes el resumen sobrescribía la explicación aunque el carrito ya fuera correcto.

Foco72/72,36,097s; TypeScript general/build OK; Node92/92. Global17.629/17.629,235suites,533hashes,816,07s; inventario exacto/fuente congelada. /tmp/ppp-166-baseline-corrected.log, focus-approved.log, tsc.log, node.log y global-summary.json (mismo prefijo). Cero API/Meta/órdenes externas. Main intacta. Publicación solo staging;166 pendiente de deploy agrupado. Último servidor verificadob8a6567a(161–165), healthy.

Próximo: sabor retirado de un producto aún disponible, cantidades cambiadas después de encolar, cancelación de fila posterior por nombre y referencias «otras dos de esas».166 acredita compra posterior completa retirada/agotada, no estos caminos. Inicio de checkout sembrado, modelo/mapa simulados y DTO final exacto. Ver whatsapp-queue-availability-validation-2410.md. No declarar vendible por conteos.

## VIGENTE — tanda165: cancelar activa y continuar compras resueltas (24/10)

Base19eb7e03, solo staging.12 recorridos nuevos: tres menús×agente simulado on/off×segunda compra resuelta/segunda y tercera resueltas. Baseline12/12 falló: cancelar la activa abría de nuevo opciones ya indicadas de la siguiente. Ahora retira solo fila activa, añade sucesoras completas con cantidad/nota y continúa hasta la primera incompleta; respuesta informa las adiciones reales. No hardcodes de productos/IDs.

Foco84/84,41,655s; TypeScript general/build OK; Node92/92. Global17.605/17.605,234suites,532hashes,825,61s; inventario exacto/fuente congelada. /tmp/ppp-165-{baseline,focus,tsc,node}.log y global-summary.json. Cero API/Meta/órdenes externas. Main intacta. Deploy agrupado161–165 verificado2026-10-24T05:06:00Z: HEAD b8a6567aa56459ef4546fdd9eb5cf4aa0fe2ca9e, imagen sha256:740661882e05d5a8e3e58287219ec008bc63233aff07029b58bb553636f501b5, running/healthy,0reinicios. Health OK,DBconnected,circuitCLOSED; publicChat=true/orderEvents=false. Producción conserva ef426c93… y0reinicios. Rollback ppp-nest-staging:rollback-before-b8a6567a. Evidencia /tmp/ppp-165-{before-deploy,deploy,verified}.log. Bases/volúmenes/privados preservados. Commit posterior solo documental no requiere reconstrucción.

Próximo: cancelar una fila posterior por nombre, producto agotado tras encolar, mismo SKU activo y referencias «otras dos de esas».165 prueba cancelar activa cuando sucesoras distintas ya tienen opciones completas; no acredita estos pendientes. Modelo/mapa simulados, checkout inicial sembrado y DTO final verificado. Ver whatsapp-cancel-explicit-queue-validation-2410.md. No declarar vendible por conteos.

## VIGENTE — tanda164: mismo producto, líneas y orden de llegada (23/10)

Based51589ca, solo staging.24 recorridos nuevos: tres menús×agente simulado on/off×sabores diferentes/mismo sabor con notas diferentes×orden normal/invertido. Baseline12/12 pasó; al invertir el orden aparecieron2 fallos/22 aprobados: Chocolate de una nueva malteada se aplicaba como Cola de la gaseosa activa. Antes de absorber opciones se prioriza compra explícita de otro producto nombrado inequívocamente, sin pedidos múltiples. Se reutiliza helper de cola; no hardcodes de productos/IDs.

Foco84/84,38,345s; TypeScript general/build OK; Node92/92. Global17.593/17.593,233suites,531hashes,781s; inventario exacto/fuente congelada. Evidencia /tmp/ppp-164-fixed-focus3.log, tsc-approved.log, node-approved.log y global-summary.json (mismo prefijo). Cero API/Meta/órdenes externas. Publicación solo staging; runtime161,163–164 pendientes de deploy agrupado. Último servidor acreditadoe8cf6ffa(158–160). Main intacta.

Próximo: cancelar activa con sucesoras ya resueltas, mismo producto que la selección activa, compras por referencia («otras dos de esas»), agotamiento/cantidad tras encolar.164 acredita dos filas del mismo SKU distinto del activo, sabores explícitos, notas separadas y orden invertido. No extrapolar a estos pendientes. Modelo/mapa simulados y checkout inicial sembrado; contraste real pendiente. Ver whatsapp-same-product-queue-validation-2310.md. No declarar vendible por conteos.

## VIGENTE — tanda163: opciones explícitas al avanzar la cola (23/10)

Base4d6973c4, solo staging.12 recorridos nuevos: tres menús×agente simulado on/off×segunda compra con sabor explícito/segunda y tercera con sabor explícito. Baseline12/12 falló: la segunda compra perdía sin azúcar. La rama de avance añadía una sola fila completa sin nota y retornaba; ahora drena filas completas conservando orderKitchenNote y cantidades, acumula sus confirmaciones y se detiene ante la siguiente opción faltante. No nombres/IDs de PPP en runtime.

Foco60/60,33,394s; TypeScript general/build OK; Node92/92. Global17.569/17.569,232suites,530hashes,747,35s; inventario exacto y fuente congelada. Evidencia /tmp/ppp-163-{baseline,focus,tsc,node}.log y global-summary.json. Cero API/Meta/órdenes externas. Publicación solo staging;163 y runtime161 pendientes de deploy agrupado. Último servidor acreditadoe8cf6ffa(158–160). Main intacta.

Próximo: mismo SKU en varias filas con sabores/notas diferentes; cancelación de primera con siguientes ya completas; agotamiento/cambio de cantidad posterior al encolado. No acreditar esos caminos con163. Inicio de checkout sembrado, proveedor y mapa simulados; contraste real pendiente. Ver whatsapp-explicit-queue-validation-2310.md. No declarar piloto/vendible por conteos.

## VIGENTE — tanda162: tres selecciones con consultas y cancelación (23/10)

Base0e4bc78b, solo staging.24 recorridos nuevos: tres menús×agente simulado on/off×completar todo/cancelar primera/cancelar segunda/cancelar tercera. Compra pendiente de dos bebidas, otra compra de dos y tercera de tres; preguntas de contenido antes de cada elección. Verifica cola, carrito previo, respuesta de catálogo, cantidades, sabores, notas y DTO final exacto. Baseline inicial12/12 pasó; ampliación final24/24 pasó sin cambio runtime.

Foco72/72,23,143s; TypeScript general/build OK; Node92/92. Evidencia /tmp/ppp-162-{baseline,focus,tsc,node}.log. No global redundante por tests/docs: última global161=17.533/230suites; no sumar focos a global. Cero API/Meta/órdenes externas. Main intacta. Publicación solo staging; no deploy en162. Runtime161 sigue pendiente de deploy agrupado; último servidor acreditadoe8cf6ffa(158–160).

Próximo: segunda compra con sabor ya explícito (y nota), tercera compra después de una fila ya resuelta, mismo SKU en varias filas, agotamiento posterior al encolado. Estos caminos NO están acreditados por162: aquí los tres productos distintos requieren elegir su sabor posteriormente. Inicio de checkout sembrado, proveedor y mapa simulados; contraste real pendiente. Ver whatsapp-three-product-queue-validation-2310.md. No declarar piloto/vendible por conteos.

## VIGENTE — tanda161: dos productos configurables y cancelación (23/10)

Base9702fbcd, solo staging.24 recorridos nuevos: tres menús×agente simulado on/off×completar ambas bebidas/cancelar primera/cancelar segunda/segunda agotada. Baseline inicial18/18 falló: segunda solicitud no quedaba almacenada. Se reutiliza pendingMultiOrder con fila activa y siguiente, guardando segmento/cantidad/notas; al resolver o cancelar activa pasa a la siguiente. «Cancela esa bebida» entra en cancelación de selección, conserva carrito y resto de cola. Adición explícita de SKU agotado informa ausencia y conserva pendiente. No se añade producto por consultar.

Foco66/66,11,134s; TypeScript general/build OK, Node92/92. Primera global interrumpida tras detectar regresión en combo→«de broster»: la cola interpretaba una respuesta corta como adición. Se restringe creación de cola a compra explícita (agrega/añade/quiero/dame). Regresión histórica pasó aislada; global FINAL17.533/17.533,230suites,528hashes,780,10s; inventario exacto/fuente congelada. /tmp/ppp-161-global-summary.json. Cero API/Meta/órdenes externas. Publicación solo staging;161 pendiente de deploy agrupado. Último servidor acreditadoe8cf6ffa (158–160). Main intacta.

Próximo: segundo producto con sabor ya explícito, más de dos productos configurables, mismas referencias/IDs, cambio de cantidad o agotamiento después de encolarlo. No acreditar estos caminos con161. Esta tanda prueba dos bebidas distintas, consultas de contenido intermedias, cancelaciones y DTO final exacto. Modelo/mapa simulados; contraste real pendiente. Ver whatsapp-two-product-queue-validation-2310.md. No declarar vendible por conteos.

## VIGENTE — tanda160: compra adicional mientras elige sabor (23/10)

Base10bbfd60, solo staging.24 recorridos nuevos: tres menús×agente simulado on/off×añadir uno/añadir dos/añadir con nota/selección numérica de sabor tras consultar categoría. Baseline inicial12:3 fallos/9 aprobados; solo agente activado desviaba compra explícita antes del helper existente. Se reconoce también la forma normalizada «quiero», se ejecuta compra adicional inequívoca antes de deferir al agente, sin consumir respuestas de atributo ni pedidos múltiples. Helper de adición preserva cantidad y nota (antes fijaba una unidad sin nota). Carrito, pendiente, respuesta, estado y DTO verificados.

Foco84/84,14,363s; TypeScript general/build OK, Node92/92. Global17.509/17.509,229suites,527hashes,616,79s; inventario exacto/fuente congelada. Evidencia /tmp/ppp-160-{baseline,focus,tsc,node}.log y global-summary.json. Cero API/Meta/órdenes externas. Main intacta. Deploy agrupado158–160 verificado2026-10-24T03:39:54Z: HEAD e8cf6ffa0db00754623acdbc37ce2a1a6590e214, imagen sha256:652b1c62bf6baa3f5ef504edfd7fbe4be46905fa706b8107b2a1a8f58d0825a5, running/healthy,0reinicios. Health OK,DBconnected,circuitCLOSED; publicChat=true/orderEvents=false. Producción conserva ef426c93… y0reinicios. Rollback ppp-nest-staging:rollback-before-e8cf6ffa. Evidencia /tmp/ppp-160-{before-deploy,deploy,verified}.log. Bases/volúmenes/privados preservados. Commit posterior solo documental no requiere reconstrucción.

Próximo: segundo producto también exige opciones; dos selecciones con consultas/cancelación intermedia, agotados y compra con sabor ya explícito. Esta tanda acredita producto adicional sin atributos y respuesta1 que elige sabor (no producto del listado informativo). No acredita cola de dos productos configurables. Ver whatsapp-pending-category-purchase-validation-2310.md. Contraste real pendiente; no declarar vendible por conteos.

## VIGENTE — tanda159: categorías durante sabor pendiente (23/10)

Based3239552, solo staging.18 conversaciones nuevas: tres menús (bowl/gaseosa+sopas, pizza/jugo+postres, arroz/refresco+entradas)×categoría disponible/agotada/ausente×agente simulado on/off. Baseline16 fallos/2 aprobados: categoría vacía borraba pendingAttribute o llegaba al filtro de preguntas ajenas al menú; repetía opción sin responder. Se adelanta consulta de catálogo ante compra pendiente, reconoce forma «qué [categoría] tienes» y responde ausencia sin limpiar selección. Excluye preguntas de sabor/opciones/tamaño/ingredientes del reconocimiento genérico. Listado informativo sin números, recordatorio de sabor, conservación de dos bebidas/notas y cierre con DTO exacto.

Foco96/96,9,626s; TypeScript general/build OK, Node92/92. Global17.485/17.485,228suites,526hashes,606,52s; inventario exacto/fuente congelada. /tmp/ppp-159-global-summary.json y /tmp/ppp-159-{baseline,focus,tsc,node}.log. Cero API/Meta/órdenes externas. Publicado solo staging; tandas158–159 pendientes de deploy agrupado. Último servidor verificado0a3e2ae4 (154–157); Main/producción intactas.

Próximo: consultar otra categoría y pedir uno de sus productos sin perder bebida pendiente; respuesta numérica tras listado informativo; ingredientes de otro plato mientras elige sabor; «qué tienes de…» y otras formulaciones. Esta tanda verifica consulta y regreso al sabor por nombre, no esas extensiones. Modelo/mapa simulados, contraste real aún pendiente; no declarar vendible por conteos. Ver whatsapp-pending-flavor-category-validation-2310.md.

## VIGENTE — tanda158: otras formas de preguntar por ingredientes (23/10)

Base9a8eead4, solo staging.36 recorridos nuevos: tres menús×detalle conocido/desconocido×agente simulado on/off×nombre,pago,confirmación. Preguntas «la ensalada de qué es», «qué lleva esa salsa», «qué ingredientes tiene la guarnición». Baseline36/36 falló: respuesta incompleta o sin recordatorio del pendiente. Se normalizan consultas para reutilizar la respuesta del acompañamiento del plato enfocado, sin ampliar compras ni inventar ingredientes. Sesión completa, nombre, carrito y estado conservados; cierre con DTO y datos corregidos verificados.

Foco162/162,16,895s; TypeScript general/build OK, Node92/92. Global17.467/17.467,227suites,525hashes,588,18s; inventario exacto/fuente congelada. Evidencia /tmp/ppp-158-baseline.log, focus.log, tsc.log, node.log (mismo prefijo) y /tmp/ppp-158-global-summary.json. Cero API/Meta/órdenes externas. Publicación solo staging; despliegue pendiente para agrupar. Último servidor verificado0a3e2ae4 (154–157). Main/producción intactas.

Próximo: cambio de categoría durante sabor pendiente, ingredientes de otro plato mientras elige bebida, consultas+acción y después de confirmar. No acreditar esos caminos con158: mantiene guardas de selección pendiente. Contraste real pendiente según whatsapp-api-validation-next-2310.md. Ver whatsapp-side-paraphrases-validation-2310.md. No declarar vendible por conteos.

## VIGENTE — tanda157: ingredientes consultados durante datos del checkout (23/10)

Base9e76e0b1, staging.60 recorridos nuevos: tres platos/acompañamientos×detalle conocido/desconocido×agente simulado on/off×nombre,dirección,teléfono,pago,confirmación. Baseline36 fallos/24 aprobados: tryHandleReferencedSideDetail excluía nombre/dirección/teléfono; pregunta se rechazaba o iba al fallback. Consulta de solo lectura ahora permitida en esos estados, responde carta o reconoce ingredientes no confirmados y añade recordatorio del paso pendiente. No amplía compra+pregunta a esos estados. Conserva sesión, carrito y contacto; cierre con DTO verificado.

Foco114/114,15,302s; TypeScript general/build OK, Node92/92. Global17.431/17.431,226suites,524hashes,596,08s; inventario exacto/fuente congelada. /tmp/ppp-157-global-summary.json. Cero API/Meta/órdenes externas. Deploy agrupado154–157 verificado2026-10-24T02:29:16Z: staging0a3e2ae45efd06a29421f3250ff20107c051fd47, imagen sha256:aa59f3db2972689f1ad34d889f10626d0592ccc93dba5ebb15a101f6a632ad8e, running/healthy,0reinicios; health OK,DBconnected,circuitCLOSED. publicChat=true/orderEvents=false. Producción conserva ef426c93… y0reinicios. Rollback ppp-nest-staging:rollback-before-0a3e2ae4. Evidencia /tmp/ppp-157-{before-deploy,deploy,verified}.log. Bases/volúmenes/privados preservados. Commit documental posterior no requiere reconstrucción. Main intacta. Ver whatsapp-checkout-side-ingredients-validation-2310.md.

Próximo: «qué lleva esa salsa», «la ensalada de qué es», cambio de categoría mientras espera sabor, consulta+acción durante datos, después de confirmar. Esta tanda acredita «de qué es la/el … hoy» con referente existente y sin selección pendiente; no generalizar a todas las preguntas. Sigue pendiente contraste real acotado según whatsapp-api-validation-next-2310.md; no declarar vendible por conteos.

## VIGENTE — tanda156: preguntas durante checkout y caducidad de sabor (23/10)

Baseaa160493, solo staging.36 casos nuevos:30 matriz de consultas de contenido/tiempo en nombre,dirección,teléfono,pago,confirmación (tres menús×agente simulado on/off);6 recorridos de sabor+apartamento con ejecución real de runSessionExpiry y clearPendingChoices, repositorio/envío simulados. Preguntas no cambian carrito/contacto/destino ni estado; luego datos corregidos y DTO. Caduca sabor, conserva plato y conflicto de apartamento, responde consulta, admite «2» como apartamento y cierra sin bebida caducada.

Sin cambios runtime. Foco90/90,10,639s; TypeScript general/build OK, Node92/92. /tmp/ppp-156-{baseline,focus,tsc,node}.log. No global redundante por tests/docs: última global154=17.317/222suites; no sumar focos a global. Cero API/Meta/órdenes externas. Publicación solo staging. Runtime154 sigue pendiente de deploy agrupado; servidor82b77757(152–153), Main intacta.

Énfasis solicitado por usuario: responder consultas a lo largo del flujo y luego retomar pendiente. Próximo: preguntas de ingredientes no documentados («de qué es la ensalada de hoy»), cambio de categoría durante sabor, pregunta+acción en un mismo turno, consulta tras confirmación y referentes tras caducidad. Plan detallado en whatsapp-checkout-inquiry-expiry-validation-2310.md. Modelo/mapa simulados; no declarar cobertura total ni vendible.

## VIGENTE — tanda155: sabor pendiente con aclaración de apartamento (23/10)

Baseb0d82553, solo staging.18 conversaciones nuevas: tres cartas con jugo/malteada/smoothie, agente simulado on/off, dirección primero/sabor primero/cancelar bebida. La guarda154 ya cubre pendingAttribute: «1» ambiguo conserva sesión y no cotiza; etiqueta de apartamento o sabor explícito resuelve su pendiente. Cancelar bebida mantiene el plato y la dirección pendiente; luego «2» resuelve apartamento sin compra accidental. DTO final exacto con una o dos líneas según cancelación, sabor y destino verificados.

Sin cambios de runtime. Foco60/60,13,036s; TypeScript general/build OK, Node92/92. No repetir global por tests/documentación: última global154=17.317/222suites, no afirmar que se ejecutó una global nueva. Evidencia /tmp/ppp-155-{corrected-baseline,focus,tsc,node}.log. Cero API/Meta/órdenes externas. Publicación solo staging; no deploy de155 (solo tests/docs). Runtime154 sigue pendiente de despliegue agrupado; último servidor82b77757 (152–153), Main intacta.

Próximo: caducidad real de una elección con otra pendiente, código explícito, GPS+respuesta corta conservando coordenadas, primera compra+dirección contradictoria. Estos casos no se acreditan con155. Contraste real acotado sigue pendiente según whatsapp-api-validation-next-2310.md; no declarar vendible por conteos. Ver whatsapp-address-flavor-collision-validation-2310.md.

## VIGENTE — tanda154: número ambiguo entre producto y apartamento (23/10)

Base0ed2d7ca, solo staging.24 recorridos nuevos en tres menús (Bowl/Hamburguesa/Sandwich), agente simulado on/off, respuesta1/2 y resolución producto primero/dirección primero. Baseline12/12 falló: número elegía apartamento y cotizaba aunque también podía elegir producto. Con ambos pendientes, respuesta corta sin etiqueta pide indicar apartamento o nombre del producto/opción y no muta sesión. Se verifica consulta intermedia de precio, conservación de pendientes/carrito, selección explícita en ambos órdenes y DTO final con dos líneas, opciones/notas y apartamento2.

Foco54/54, TypeScript general/build OK, Node92/92. Global17.317/17.317,222suites,520hashes,584,79s; inventario exacto/fuente congelada. /tmp/ppp-154-global-summary.json. Cero API/Meta/órdenes externas. Publicada solo staging; despliegue pendiente para agrupar. Servidor último verificado82b77757 (152–153); Main/producción intactas. Ver whatsapp-address-product-collision-validation-2310.md.

Próximo: atributo/sabor pendiente con conflicto de interior, caducidad/cancelación de una elección, código explícito frente a número desnudo, GPS+respuesta corta conservando pin y referencias. Los24 casos acreditan pendingMatch; no extrapolar a todos los tipos de pendiente aunque la guarda también los detecte. Sigue pendiente contraste real acotado según whatsapp-api-validation-next-2310.md; no declarar vendible por conteos.

## VIGENTE — tanda153: salida del conflicto de domicilio (23/10)

Base952632de, solo staging.18 recorridos nuevos: tres cartas×agente simulado on/off×recogida/reinicio/GPS seguido de dirección corregida. Se reproduce bloqueo al cambiar a recogida: applyPickupIntent conservaba pendingAddressConflict y tryConfirmOrder exigía apartamento. Se limpia ese pendiente junto con los demás componentes de entrega al elegir recogida. Reinicio ya limpiaba. Pin válido conserva la duda del apartamento hasta aclaración; no autoriza confirmar por sí solo. Carrito, respuesta, estado y DTO de una unidad verificados.

Foco30/30, TypeScript general/build OK, Node92/92. Global17.293/17.293,221suites,519hashes,609,52s; inventario exacto/fuente congelada. /tmp/ppp-153-global-summary.json. Cero API/Meta/órdenes externas. Deploy agrupado152–153 verificado2026-10-24T01:53:03Z: staging82b77757fe644b703f744afe841f07e132540fae, imagen sha256:affbbf5719ad2f1c4ae7683ea9450c45a13040e24b8c79bbd924dbbc0ed19efb, running/healthy,0reinicios; health OK,DBconnected,circuitCLOSED. publicChat=true/orderEvents=false. Producción conserva ef426c93… y0reinicios. Rollback ppp-nest-staging:rollback-before-82b77757. Evidencia /tmp/ppp-153-{before-deploy,deploy,verified}.log. Bases,volúmenes,privados y mariadb_local preservados. Commit posterior solo documental no requiere reconstrucción. Main intacta. Ver whatsapp-address-conflict-exits-validation-2310.md.

Próximo: elecciones de producto y dirección simultáneas; GPS seguido de respuesta corta preservando coordenadas y referencias; primera compra con dirección contradictoria. No acreditar esos caminos con estos tests. Sigue pendiente contraste acotado con modelo/mapa real según whatsapp-api-validation-next-2310.md. No declarar vendible por conteos.

## VIGENTE — tanda152: aclaración corta de interiores (23/10)

Base c5aa493d, solo staging.20 casos nuevos:12 conversaciones en tres menús con agente simulado on/off y8 contratos de componentes. Baseline12/12 falló: «708» no recuperaba la calle contradictoria pendiente. Se conserva fuente/etiqueta/valores en sesión; una respuesta corta resuelve solo el componente ofrecido, conserva conjunto/torre y permite una consulta de precio intermedia. Número no ofrecido, etiqueta diferente y confirmar no eligen un apartamento ni crean orden. Dirección completa corregida limpia pendiente; tryConfirmOrder protege también entrada directa con skipFinalConfirm. La limpieza usa undefined porque saveSession real fusiona el patch.

Foco44/44, TypeScript general/build OK, Node92/92. Global17.275/17.275,220suites,518hashes,834,79s; inventario exacto/fuente congelada. /tmp/ppp-152-global-summary.json. Cero API pagada/Meta/órdenes externas. Publicación staging; sin deploy para agrupar. Último servidor verificado2f7f9d86 (150–151); Main/producción intactas. Ver whatsapp-short-address-clarification-validation-2310.md.

Límites/próximo: primer mensaje compra+dirección contradictoria, cambio a recogida o ubicación GPS durante el pendiente, coexistencia con elección de producto/opción y caducidad. En particular comprobar que el nuevo pendiente no impida cerrar recogida cuando ya no necesita dirección; no acreditar este escape sin prueba. Solo respuesta corta con valor ofrecido o dirección numerada completa. Mapa/modelos simulados; validación real acotada sigue pendiente según whatsapp-api-validation-next-2310.md. No declarar vendible por conteos.

## VIGENTE — tanda151: disponibilidad al elegir y conflicto de interiores (23/10)

Baseb420c1cb, staging.42 casos nuevos:24 productos no disponibles/retirados durante elección desde compra/pago,12 direcciones repetidas/contradictorias,6 contratos. Stock ya estaba protegido: primer fallo se debía a ignoreBusinessHours=true del harness, corregido a false con negocio simulado abierto. No acreditar ese baseline como bug. Runtime ahora aclara dos componentes de dirección contradictorios antes de guardar/geocodificar; conserva sesión y continúa al recibir dirección corregida. Ver whatsapp-stock-address-conflict-validation-2310.md.

Foco66/66, TypeScript general/build OK, Node92/92. Global17.255/17.255,218suites,516hashes,642,89s; inventario exacto/fuente congelada. /tmp/ppp-151-global-summary.json. Cero API pagada/Meta/órdenes externas. Despliegue150–151 verificado2026-10-24T00:50:53Z: staging2f7f9d86b81f0a8fed2608e3d091f1865e2cbefb, imagen sha256:f9a7b5ed00976b80f7abc63136623434f8d883fd0bf3076b974c0be860d49ea6, running/healthy,0reinicios. /api/health OK,DBconnected,circuitCLOSED. publicChat=true/orderEvents=false. Producción conserva ef426c93… y0reinicios. Rollback ppp-nest-staging:rollback-before-2f7f9d86. Evidencia /tmp/ppp-151-deploy.log y /tmp/ppp-151-verified.log. Bases/volúmenes/privados preservados. Commit posterior solo documental no requiere reconstrucción.

Límites: modelos/mapa simulados; conflicto en calle numerada con carrito existente, se pide dirección completa corregida. Próximo: aclaración corta («708») conservando calle/conjunto, primer mensaje con compra+dirección contradictoria, opción disponible solo en una candidata. Contraste real acotado sigue pendiente según whatsapp-api-validation-next-2310.md; no declarar vendible por conteos.

## VIGENTE — tanda150: interior parcial y compra ambigua con consulta (23/10)

Base6ac84a03, solo staging.31 casos nuevos:12 direcciones,12 recorridos de compra ambigua desde compra/pago con pregunta de precio,7 contratos de detalles. Completar calle con apartamento nuevo conserva torre y demás componentes; reemplazo explícito no hereda destino. Compra adicional por cabeza compartida abre alternativas reales sin editar unidad anterior, conserva opción/nota y retoma checkout. Ver whatsapp-partial-interior-ambiguous-addition-validation-2310.md.

Foco66/66 + contratos7/7; TypeScript general/build OK, Node92/92. Global17.213/17.213,215suites,513hashes,642,96s; inventario exacto/fuente congelada. /tmp/ppp-150-global-summary.json. Cero API pagada/Meta/órdenes externas. Publicación solo staging; deploy150 pendiente para agrupar. Último servidor verificado2c02456a (148–149), Main/producción intactas.

Límites: modelos/mapa simulados, cabeza exacta compartida y opción admitida por todas las candidatas. Siguiente: alternativa agotada, opción disponible en solo una candidata, cambios de opinión en esa selección y dos apartamentos contradictorios. Contraste real acotado sigue pendiente según whatsapp-api-validation-next-2310.md; no declarar vendible por conteos.

## VIGENTE — tanda149: compras abreviadas y revisión de interior (23/10)

Base95089843, solo staging.30 casos nuevos:12 compras abreviadas con opción/nota,6 cambios explícitos de opción,12 direcciones completadas con torre/apto nuevos frente a reemplazo explícito. Se expande cabeza única del catálogo con opción configurada antes de los manejadores de producto no encontrado/cambio; completar calle conserva nombre de conjunto y usa interior nuevo. Ver whatsapp-abbreviated-interior-validation-2310.md.

Foco54/54, TypeScript general/build OK, Node92/92. Global17.182/17.182,212suites,510hashes,654,12s; inventario exacto/fuente congelada. /tmp/ppp-149-global-summary.json. Cero API pagada/Meta/órdenes externas. Despliegue148–149 verificado2026-10-24T00:09:16Z: staging2c02456a5e48d97afabd665895d94def5344c6d8, imagen sha256:6db5faea0db540db0d2c4346cebd250a51b5195683c5c13724385402ba3a7685, running/healthy,0reinicios. /api/health OK, DBconnected,circuitCLOSED. publicChat=true/orderEvents=false. Producción conserva ef426c93… y0reinicios. Rollback ppp-nest-staging:rollback-before-2c02456a. Evidencia /tmp/ppp-149-deploy.log y /tmp/ppp-149-verified.log. Bases,volúmenes y privados preservados; aviso de mariadb_local sin intervención. Commit posterior solo documental no requiere reconstrucción.

Límites: servicios/modelo simulados; cabeza única y opción explícita, interior completo nuevo. Siguiente: corrección de solo apartamento manteniendo torre, cabezas compartidas y descriptores no configurados; contraste real acotado según whatsapp-api-validation-next-2310.md. No declarar vendible por conteos.

## VIGENTE — tanda148: variantes con notas y conjunto completado con calle (23/10)

Base e9635765, solo staging.24 conversaciones nuevas, tres cartas por familia y agente simulado on/off. Corrige compra adicional con preparación distinta que editaba la línea anterior; «solo quiero uno… y que lleve…» pide aclaración antes de descartar opciones/notas diferentes; calle que completa conjunto pendiente conserva torre/apartamento, cambio explícito reemplaza destino. Ver whatsapp-variant-place-completion-validation-2310.md.

Foco24/24, TypeScript general/build OK, Node92/92. Global17.152/17.152,210suites,508hashes,767,34s, inventario exacto/fuente congelada. Evidencia /tmp/ppp-148-global-summary.json y /tmp/ppp-148-focus2.log. Cero API pagada/Meta/órdenes externas. Publicar solo staging; despliegue agrupado pendiente. Servidor último verificado eef121c1, producción intacta.

Límites: servicios/modelo simulados, nombre completo de SKU en compra adicional; completar conjunto sin coordenadas con calle sin interior propio. Próximo: nueva calle con cambio de torre/apto y alias de compra frente a modificación de opción. Contraste real acotado sigue pendiente según whatsapp-api-validation-next-2310.md; no declarar vendible por conteos.

## VIGENTE — tandas146–147: acompañamientos, corrección exclusiva y nombre con ubicación pendiente (23/10)

Base cdd54a1a, solo staging.48 casos nuevos:24 consultas/preparación/corrección de carrito y24 nombre/conjunto (18 recorridos completos +6 contratos de mapa). Separa compra singular de consulta de acompañamiento, evita consulta como compra/nota, conserva referente de preparación ofrecida y corrige «solo quiero… y que lleve…» a cantidad absoluta cuando las opciones coinciden. Nombre explícito reconoce «Mi nombre es», «Ya te dije que era» y «…es mi nombre real», persiste antes de continuar checkout. Descriptor condominio/condómino no altera identidad del conjunto; se siguen rechazando nombres distintos y resultados parciales. Sin excepciones PPP.

Validación: foco146 final846/846 después de corregir regresión con «salsa con harto limón»; foco147374/374, TS general/build OK, Node92/92. Global agrupada17.128/17.128,208suites,506hashes,621,17s; inventario exacto y fuente congelada. /tmp/ppp-147-global-summary.json, /tmp/ppp-146-preparation-regression.log, /tmp/ppp-147-{focus,tsc,node}.log. Dos globales previas interrumpidas (nuevo caso y regresión), no acreditadas. No sumar focos/reintentos.

Desplegadas146–147 solo staging: eef121c13c6888d5732eb91a67c272db3e35eb0c, imagen sha256:20007c4f98b5ba8cfd0040adeedab800829729096ad8b9e8e00a8df116844fa6. Verificación independiente2026-10-23T23:25:25Z: running/healthy,0 reinicios, /api/health OK,DBconnected,circuitCLOSED. publicChat=true/orderEvents=false conservados. Producción mantiene ef426c93… y0reinicios. Rollback ppp-nest-staging:rollback-before-eef121c1. Evidencia /tmp/ppp-147-deploy.log y /tmp/ppp-147-verified.log. La conexión SSH original quedó sin finalizar aunque el contenedor arrancó22:23:42Z; se comprobó que no había compose remoto activo y se cerró solo el cliente SSH local. No confundir salida truncada de transporte con fallo del contenedor. Privados/bin/,bases y volúmenes preservados. Commit posterior solo documental no requiere reconstrucción. Cero API pagada, Meta u órdenes externas. Detalles en whatsapp-side-detail-preparation-validation-2310.md y whatsapp-name-place-recovery-validation-2310.md.

Límites: texto y servicios/modelo simulados; la prueba de mapa verifica aceptación de candidato, no búsqueda Google real. No acredita que el conjunto concreto siempre se encuentre. Próximo: contraste real acotado según whatsapp-api-validation-next-2310.md, con presupuesto previo; conservación de conjunto/interior al recibir calle/número; «solo» con variantes incompatibles y notas diferentes. No declarar vendible por conteos.

## VIGENTE — tanda144: condiciones abreviadas con acción independiente (23/10)

Base5e081a8c, solo staging.24 recorridos nuevos +4 controles: opción sin verbo «Mora si no cuesta más; aparte quita…», orden inverso, condición sola y ambas cláusulas condicionadas. Baseline12 fallos/36 aprobados: guarda superior reconocía condición con pendingChoice, pero separador no recibía contexto. Se propaga desde current.pendingAttribute con predeterminado false. Se conserva bebida pendiente y solo se aplica retirada independiente; luego elección firme y DTO exacto, sin órdenes prematuras. Sin excepciones PPP.

Foco142/142,12,435s; TS general/build OK; Node92/92. Global17.080/17.080,206suites,504hashes,582,89s; inventario exacto/fuente congelada. Evidencia /tmp/ppp-144-global-summary.json, /tmp/ppp-144-{baseline,final-focus,tsc,node}.log. No sumar focos repetidos. Cero API pagada, WhatsApp u órdenes externas.

Desplegadas142–144 solo staging:426b8eff, imagenc13f9ae2…, verificado23/10 16:40:07 Bogotá. Running/healthy,0reinicios; /api/health OK,DBconnected,circuitCLOSED. publicChat=true/orderEvents=false conservados. Producción conserva imagenef426c93… y0reinicios; Main intacta. Rollback ppp-nest-staging:rollback-before-426b8eff; bases,volúmenes,bin/ y privados preservados. Evidencia /tmp/ppp-144-deploy.log y /tmp/ppp-144-verified.log. Límites: dos cláusulas con independencia explícita, texto serial/mocks, no acredita recargos reales ni audio/mapas/modelo. Próximo: ronda real acotada de conversaciones nuevas según whatsapp-api-validation-next-2310.md, con presupuesto registrado y stop ante fallo. No seguir posponiendo por conteos.

## VIGENTE — tanda143: condición explícita y acción independiente (23/10)

Base07e56735, staging.24 conversaciones nuevas desde carrito vacío en tres cartas sintéticas, agente simulado on/off: condición antes/después de eliminación independiente, condición sola y ambas cláusulas condicionadas. Se compra adicional, abre elección de bebida, procesa mensaje compuesto, conserva selección pendiente, responde costo no confirmado y aplica solo eliminación independiente. Elección firme posterior y cierre para recoger verifican una unidad/opción exactas en DTO, adicional presente solo cuando no se autorizó quitarlo, cero órdenes prematuras.

Sin cambios de runtime. Foco114/114,10,388s; TypeScript general/build y Node92/92. No se repite global por tests/documentación. Primer intento12 fallos/6 aprobados era oráculo incompleto: sendQueued devuelve solo último mensaje; se corrigió para inspeccionar todos los mensajes emitidos en ese turno. No acreditar ese intento como defecto del bot. Evidencia /tmp/ppp-143-{focus,replies,final-focus,tsc,node}.log.

Publicar solo staging. No deploy:142 sigue pendiente de despliegue agrupado, servidor último verificado c82df32d. Main intacta. Cero API pagada/Meta/órdenes externas. Alcance: verbo explícito «Cambia», separador «; aparte», turnos seriales, retirada total de un adicional. NO acredita opción elíptica «Mora si no cuesta más; aparte…», conjunciones libres, retirada parcial ni costo real. Revisar la diferencia de contexto entre isCostConditionalRequest y splitCostConditionFromIndependentAction para esa elipsis antes de extrapolar. Sigue pendiente validación acotada con modelo real del plan API.

## VIGENTE — tanda142: sabor obligatorio en nuevas familias de bebidas (23/10)

Base510ef1a1, solo staging. Corregido el hueco de141: malteadas, batidos y smoothies con varias opciones de Sabor ya no reciben el primero automáticamente. requiresExplicitAttributeChoice reconoce categoría o inicio del nombre; no modifica isLikelyDrinkProduct ni añade excepciones PPP.18 recorridos nuevos +6 controles de categoría/platos con bebida; respuesta, carrito, estado y DTO exactos. Los18 anteriores permanecen.

Baseline18 fallos/18 aprobados. Primer intento amplió clasificación global y regresó cancelación; global interrumpida, no acreditada. Corrección acotada: foco90/90 seleccionados, TS general/build y Node92/92. Global final205suites:17.026 aprobados y2 expectativas antiguas fallidas (malteada sin elegir sabor). Se actualizó solo esa suite para comprobar cantidad2 pendiente y sabor explícito; revalidación60/60. Cobertura final17.028, sin sumar reintentos; inventario exacto y runtime intacto entre global/revalidación. No afirmar una sola corrida global verde. Evidencia /tmp/ppp-142-validation-summary.json y detalle whatsapp-flavor-families-validation-2310.md.

Publicar staging; despliegue agrupado pendiente. Servidor no consultado/reconstruido: última versión verificada c82df32d (139+140). Main intacta. Cero API pagada, WhatsApp y órdenes externas. Próximo: condición+acción independiente, después contraste real acotado del plan API; no seguir posponiéndolo por volumen de pruebas. No acredita audio/visión/mapas ni producto vendible.

## VIGENTE — tanda141: dos atributos con interrupciones (23/10)

Base 99d13261, solo staging. Añadidas18 conversaciones completas: jugo en agua, jugo en leche y gaseosa; agente simulado on/off; consulta de precio, nombre anticipado o número inválido entre Base y Sabor. Cada selección numérica se aplica al atributo actual; las interrupciones conservan pendiente y carrito vacío. Después se verifica respuesta con ambas opciones, una unidad en carrito, pago, confirmación y DTO exactos; ninguna orden prematura.

Validación: foco78/78 en tres suites,8,349s; TypeScript general/build OK; Node92/92. No cambian reglas de producción: no se repite global ni se reconstruye servidor. Última global ejecutable140:16.986/16.986; no sumar ejecuciones focales. Cero API pagada, WhatsApp u órdenes externas. Main intacta; último despliegue sigue c82df32d (139+140), sin nueva verificación remota.

Hueco nuevo NO corregido: Malteada Artesanal con Base [Entera, Deslactosada] y Sabor [Vainilla, Fresa] completa Vainilla automáticamente después de elegir Base2. Reproducido6/6 combinaciones; no se cuentan como aprobadas. Detalle y reproducción en whatsapp-two-attributes-validation-2310.md. Priorizar criterio general de bebida/sabor explícito, después condición más acción independiente. Los mocks no acreditan comprensión del modelo real; sigue pendiente contraste acotado del plan API.

## VIGENTE — tanda140: selección condicionada y recuperación (23/10)

Base f0820466, staging.24 conversaciones nuevas: tres cartas sintéticas (crepe,sándwich,pasta), agente simulado on/off, condición antes/después de opción, recargo y número9 fuera de lista. Desde carrito vacío se abre selector de bebida; mensaje condicionado o inválido no compra; consulta precio y nombre intermedios preservan pendiente; elección2 explícita permite cierre con DTO de una unidad/opción/nombre exactos y cero órdenes prematuras.

Baseline12 fallos/12 aprobados: «si no cuesta más, ponle…» no reconocía verbo ponle; opción sin verbo «Mora si no vale más» no activaba guarda de condición. Se añade ponle y contexto pendingChoice para permitir condición sin verbo solo con pendingAttribute activo. Split de acción independiente mantiene detección sin ese contexto; callback map explícito evita pasar índice como booleano. Error TS2345 intermedio corregido antes de acreditar pruebas. Regla general, sin nombres/IDs PPP.

Foco126/126,14,522s; TS general/build OK, Node92/92. Global16.986/16.986,204suites,502hashes,575,36s; inventario exacto/fuente congelada. Evidencia /tmp/ppp-140-focus.log (baseline), /tmp/ppp-140-after.log (TS intermedio), /tmp/ppp-140-final-focus.log, /tmp/ppp-140-tsc.log, /tmp/ppp-140-node.log, /tmp/ppp-140-global-summary.json. No sumar focos solapados. Cero inferencias pagadas/Meta/órdenes externas.

Límites: texto serial y servicios simulados; no prueba política comercial real de recargos ni todas las condiciones. No declara recargo cero por ver opción disponible. No acredita modelo real/audio/mapas. Próximas seis tandas en whatsapp-recovery-next-batches-2310.md; prioridad condición+acción independiente y dos atributos sucesivos; contraste real pendiente según whatsapp-api-validation-next-2310.md. No declarar vendible por conteos.

Desplegadas139+140 solo en staging:c82df32d, imagena18b22c5…, verificado23/10 14:35:04 Bogotá. Running/healthy,0reinicios, /api/health OK,DBconnected,circuitCLOSED. publicChat=true/orderEvents=false conservados. Producción conserva imagenef426c93… y0reinicios; Main intacta. Rollback ppp-nest-staging:rollback-before-c82df32d. Bases,volúmenes,bin/ ajeno y privados preservados. Evidencia /tmp/ppp-140-deploy.log y /tmp/ppp-140-verified.log.

## VIGENTE — tanda139: consulta de precio y elección en un turno (23/10)

Base e7f54766, staging.36 conversaciones nuevas en tres cartas sintéticas (arepa,wrap,ravioles), agente simulado on/off, consulta antes/después de elección, opción por nombre/punto y coma o número/salto de línea, y cambio posterior de bebida. Parten de carrito vacío, abren selector, preguntan precio y eligen en un turno, cierran para recoger, pagan y confirman. Respuesta incluye precio y opción; carrito/DTO una sola unidad con última bebida; no crea orden antes de confirmar.

Fallos: baseline12/12 omitían precio aunque elegían correctamente. Ampliación falló24/36: elección numérica mezclada no se aplicaba, y «Mejor cambia la bebida a…» se procesaba como productos inexistentes. Correcciones generales: reconocer dos cláusulas con consulta referencial y opción ofrecida, conservar marca de consulta de precio y enviar solo elección a la ruta normal; al mutar el carrito se reutiliza resumen con precios. «Mejor cambia…» se normaliza como comando de cambio solo con carrito existente y sin interrogación. Sin excepciones PPP.

Foco final186/186,10,784s, TS general/build OK, Node92/92. Global16.962/16.962,203suites,501hashes,573,83s; inventario exacto y fuente congelada. Evidencia /tmp/ppp-139-baseline.log, /tmp/ppp-139-focus.log (ampliación fallida), /tmp/ppp-139-change.log, /tmp/ppp-139-expanded.log, /tmp/ppp-139-final-focus.log, /tmp/ppp-139-tsc.log, /tmp/ppp-139-node.log, /tmp/ppp-139-global-summary.json. Son36 casos nuevos; no sumar ejecuciones repetidas.

Publicado en staging; despliegue139 agrupado pendiente. Último servidor verificado sigue638d0d85, imagen5e97df19…, healthy en tanda138 a23/10 13:53:41 Bogotá; sin nueva comprobación remota en139. Main/producción intactas. Cero API pagada, WhatsApp u órdenes externas.

Límites: texto serial, mocks, consulta referencial explícita separada por punto y coma o salto de línea; selección única y sin sustitución pendiente. No acredita paráfrasis libres, audio, condiciones ni modelo real. Siguiente: «si no cuesta más» frente a elección firme, conjunciones naturales y número fuera de opciones sin compra implícita. Después contraste con inferencia real según whatsapp-api-validation-next-2310.md. No declarar vendible por conteos.

## VIGENTE — tanda138: consultas durante opciones y contacto anticipado (23/10)

Base d69c2518, staging.18 conversaciones nuevas desde carrito vacío en tres cartas sintéticas: combo pollo, menú hamburguesa, plato pasta; agente simulado on/off; datos separados/juntos/corregidos. Preguntan precio del producto pendiente mientras eligen bebida, aportan nombre/teléfono/dirección con interior, eligen por número y cierran. Respuesta, pendiente, carrito y DTO exacto de una unidad, bebida y contacto verificados; cero órdenes prematuras.

Fallo: consulta «cuánto cuesta ese plato» en selección abierta desde compra (sin pendingCheckoutResume) no resolvía referente. Se responde con producto del catálogo del pendingAttribute para referencias explícitas plato/producto/combo/menú, antes de exigir estado de checkout. Se excluyen selecciones múltiples y sustituciones; resto del handler conserva su guardia. No depende de nombres/IDs PPP.

Baseline funcional18/18 fallos; primer intento anterior carecía mock generateTurn (no contarlo como fallo del runtime). Añadirlo con respuesta neutra acreditó que no respondía precio. Primer cambio dentro del bloque checkout no alcanzó selección desde compra; se movió únicamente la consulta referencial antes de esa guardia. Foco final174/174,13,827s; TS general/build OK, Node92/92. Global16.926/16.926,202suites,500hashes,586,67s; inventario exacto y fuente congelada. Logs /tmp/ppp-138-{baseline,after,after2,final-focus,tsc,node}.log y /tmp/ppp-138-global-summary.json. No sumar focos solapados.

Cero API/Meta/órdenes externas. Límites: simulación textual serial, tres catálogos y tres referencias; no acredita modelo real, audios ni mapas. Siguiente: cambios de opinión y consulta+elección en un mismo mensaje; después contraste real acotado según whatsapp-api-validation-next-2310.md. No declarar vendible por conteos.

Desplegadas137+138 solo en staging:638d0d85, imagen5e97df19…, verificado23/10 13:53:41 Bogotá. Running/healthy,0reinicios, /api/health OK,DBconnected,circuitCLOSED. publicChat=true/orderEvents=false conservados. Producción mantiene imagenef426c93… y0reinicios; Main intacta. Rollback ppp-nest-staging:rollback-before-638d0d85. Archivos privados, bin/ ajeno, bases y volúmenes preservados. Evidencia /tmp/ppp-138-deploy.log, /tmp/ppp-138-verified.log y /tmp/ppp-138-health.log. Primera consulta a /health devolvió404 por ruta incorrecta; /api/health verificada después.

## VIGENTE — tanda137: señal de dirección pendiente y evaluación real (23/10)

Base a2ed6950, staging. Se reforzaron los36 recorridos de136: un resumen con destino ambiguo o fuera de cobertura no debe marcar esa dirección con ✅. Baseline36/36 fallos. Corrección general en formatCartOnly: solo mostrar marca si dirección confirmada, cobertura no rechazada y tarifa calculada presente (incluye0). No cambia el texto de la dirección ni desbloquea órdenes. Se mantienen consultas, cambios de carrito/teléfono y salidas corregir/recoger/cancelar.

Foco98/98,18,658s; TypeScript general/build OK, Node92/92. Global16.908/16.908,201suites,499hashes,583,62s; inventario exacto y fuente congelada. Evidencia /tmp/ppp-137-baseline.log, /tmp/ppp-137-focus.log, /tmp/ppp-137-tsc.log, /tmp/ppp-137-node.log, /tmp/ppp-137-global-summary.json. No son36 casos nuevos, son aserciones reforzadas de136. Cero API pagada, Meta u órdenes externas.

Publicar solo en staging; despliegue agrupado pendiente. Último ejecutable remoto verificado sigue ad76d212, imagen25de57c9…, tanda135 del23/10 11:33:31 Bogotá. No se verificó servidor de nuevo. Main intacta. La corrección137 todavía no está acreditada en servidor.

Los mocks no acreditan comprensión real. Registro compartido187 intentos/188 de último tope operativo,1 restante; no es gasto total de la cuenta. Preparado [plan de validación API](whatsapp-api-validation-next-2310.md): conversaciones nuevas, modelo real con servicios externos aislados, costo/latencia y detención ante fallo. No ejecutado. Próximo bloque: interrupciones durante sabor pendiente, datos anticipados e instrucciones compuestas, seguido de contraste real acotado. No declarar vendible por conteos.

## VIGENTE — tanda136: interrupciones con dirección pendiente (23/10)

Base f5df65c0, staging. 36 conversaciones nuevas: tres menús sintéticos, agente simulado on/off, dirección ambigua/fuera de cobertura, salidas corregir/recoger/cancelar. Desde carrito vacío se consultan total y carrito, elimina adicional y cambia teléfono mientras falta el destino. Confirmación prematura explica el dato pendiente sin crear orden. Corrección conserva interiores nuevos; recogida descarta dirección anterior; cancelación vacía carrito. DTO válido contiene dos unidades con nota, contacto y tarifa correctos.

Sin cambios de producción. Foco 98/98, tres suites,13,077s; TypeScript general/build OK y Node92/92. Evidencia /tmp/ppp-136-final-focus.log, /tmp/ppp-136-tsc.log y /tmp/ppp-136-node.log. No repetir global por tests/documentación; última global ejecutable135:16.872/16.872,200suites. No sumar focos solapados. Cero llamadas pagadas, WhatsApp u órdenes externas.

Staging conserva ejecutable ad76d212, imagen25de57c9…, última verificación135:23/10 11:33:31 Bogotá. Sin nuevo rebuild/verificación remota; Main intacta. Límites: cotizador/modelo simulados, turnos seriales, nombre conocido y productos sin selector. No acredita mapas reales.

Pendiente detectado: resumen muestra ✅ junto a dirección aún no ubicable, aunque sí explica el problema y bloquea confirmar. Revisar esa señal; no está corregida en136. Después: consultas/cambios durante sabor pendiente y datos anticipados en mensajes con varias intenciones.

## VIGENTE — tanda 135: bebida del combo y adicional (23/10)

Base 17c1216e, staging. 24 conversaciones nuevas desde carrito vacío en tres cartas sintéticas (combo de pollo, menú hamburguesa, plato de pasta), agente simulado on/off, adicional con nombre del catálogo o lenguaje natural, bebida incluida sola o una bebida extra explícita. Compra + pregunta de sabores abre selección, pregunta sobre acompañamiento no pierde el plato pendiente, elección por nombre/número aplica la bebida al combo, extra alimentario se añade, consulta de total no muta y cierre llega a DTO exacto. La bebida independiente solo se cobra si se pidió aparte.

Fallos reproducidos: la regla compra+consulta de sabores solo reconocía atributos Sabor, no Bebida; la búsqueda simplificada eliminaba «combo» y perdía la coincidencia exacta; respaldo del agente no reconocía una porción adicional porque quitaba «porción» solo de la petición, no del nombre de catálogo. Correcciones generales: reconocer ambos atributos, priorizar nombre completo tras retirar únicamente cantidad y comparar simétricamente nombres de porciones/adicionales. Sin IDs/precios/nombres PPP en producción.

Foco final 92/92 en tres suites, 16,906 s; 24 casos nuevos. TypeScript general/build OK; Node 92/92. Global aprobada: 16.872/16.872, 200 suites, 498 hashes intactos, inventario exacto; 575,31 s. Evidencia /tmp/ppp-135-global-summary.json. Incluye tandas133/134/135; no sumar focos solapados. Desplegado solo en staging: ad76d212, imagen 25de57c9…, verificado 23/10 11:33:31 Bogotá. Running/healthy, cero reinicios, health OK, DB connected y circuito CLOSED. publicChat=true/orderEvents=false conservados. Producción conserva imagen ef426c93… y cero reinicios; Main intacta. Rollback ppp-nest-staging:rollback-before-ad76d212; bases, volúmenes y archivos privados preservados. Evidencia /tmp/ppp-135-deploy.log y /tmp/ppp-135-deploy-verified.log. Cero API pagada, WhatsApp u órdenes externas.

Siguiente: dirección ambigua/fuera de cobertura con correcciones de carrito y contacto, conservando interiores y sin afirmar dirección segura. Límites135: turnos seriales, recogida, atributos simples, agente con respuestas programadas; no acredita percepción real ni todas las paráfrasis. Un código solo no siempre inicia selector: el comportamiento predeterminado se conserva. [Detalle135](whatsapp-combo-extra-journey-validation-2310.md).

## VIGENTE — tanda 134: nombre, dirección y contacto desde carrito vacío (23/10)

Base bb7ff7e5, staging. 24 conversaciones nuevas, tres menús sintéticos (lasagna, bowl, filete), agente simulado on/off, consulta de precio/contenido y dirección antes/después del nombre. Arrancan sin nombre ni carrito; compran dos unidades con nota, cierran, preguntan durante solicitud de nombre, aportan nombre/dirección con conjunto+torre+apto, cambian teléfono durante pago y confirman. Validan respuesta pertinente, conservación de carrito y estado, nombre no tratado como destino, ausencia de nueva cotización al dar nombre/teléfono y DTO con contacto, interiores y dos unidades con nota. Cero órdenes antes de confirmar.

Sin cambios de producción. Foco final 121/121 en tres suites, 50,333 s; 24 casos nuevos. Primer ensayo: 6/12 fallos de fixture porque el agente genérico no seleccionaba domicilio y conservaba pickup del harness; se configuró respuesta simulada setOrderType solo al mensaje explícito «para un domicilio» y se añadió aserción inmediata de delivery. No atribuir esa corrección al modelo real. TypeScript general/build aprobados; contratos Node 92/92. No repetir global por test/documentación: última global ejecutable132, 16.812/16.812 en 197 suites; no sumar resultados focales solapados.

Staging conserva ejecutable bd3f5e5e (tandas131+132), imagen7db0a13f…, última verificación23/10 10:59:49 Bogotá en tanda132, sin nueva comprobación remota en134. Main/producción intactas; publicChat=true/orderEvents=false. Cero API pagada, WhatsApp ni órdenes externas. Publicar tests/documentación sin rebuild.

Límites: cotizador simulado exitoso, turnos seriales y productos sin atributos; la prueba acredita conservación de dirección/interiores, no selección real del mapa ni separación geográfica calle/interior dentro del servicio de rutas. El agente de domicilio está programado explícitamente: no mide comprensión real. Siguiente: catálogo con bebida incluida y extra vendible; consulta sobre acompañamiento durante selección y cierre. Después contrastar dirección ambigua/fuera de cobertura sin bloquear cambios, con origen de tarifa comprobado. [Plan de conversaciones](whatsapp-complete-conversations-next-2310.md). [Detalle134](whatsapp-delivery-contact-journey-validation-2310.md).

## VIGENTE — tanda 133: compra desde cero, cambio parcial y cierre (23/10)

Base bd3f5e5e, staging. Doce conversaciones nuevas con carrito vacío en tres menús (bao/salsa, pizza/masa, batido/base), agente simulado on/off, conservar o deshacer el cambio. Compran dos unidades con opción A; cambian una a B con nota propia del menú; cierran para recoger; consultan total y cambian nombre durante pago; opcionalmente deshacen; pagan, confirman y envían gracias. Se verifican respuesta, cantidad total, notas/opciones por unidad, estado pendiente y DTO de dos unidades, sin duplicación por cortesía final.

Sin cambio de producción en esta tanda. Foco final 168/168 en tres suites, 30,199 s. Primer run de doce casos pasó con una nota común; al usar notas por menú hubo cuatro fallos de oráculo por azúcar/azucar, corregidos normalizando tildes únicamente en la comparación semántica. No se relajaron cantidades, atributos ni aislamiento de notas. TypeScript general/build OK; contratos Node92/92. No repetir global por tests/documentación: última global ejecutable132 es 16.812/16.812,197suites; no sumar focos solapados.

Staging ya ejecuta131+132: bd3f5e5e, imagen7db0a13f…, healthy/DBconnected/circuitCLOSED, cero reinicios, verificado23/10 10:59:49 Bogotá. publicChat=true/orderEvents=false. Main/producción intactas. Esta tanda solo añade tests/documentación, no requiere rebuild. Cero API pagada, WhatsApp u órdenes externas.

Límites: nombre inicial conocido, recogida en local, catálogo con un producto/atributo por caso y turnos seriales; no acredita envío real, precisión del modelo, dirección o teléfono nuevos, ni todas las familias del plan. Siguiente: comenzar sin nombre, consulta mientras lo solicita y dirección con interior conservada; después teléfono en pago y producto con bebida incluida + extra. Plan: [conversaciones completas](whatsapp-complete-conversations-next-2310.md). Detalle: [tanda133](whatsapp-empty-cart-options-close-validation-2310.md).

## VIGENTE — tanda 132: ciclo de vida del último cambio de opciones (23/10)

Base e414e883, rama staging. 36 pruebas nuevas en tres menús sintéticos (bao/salsa, pizza/masa y batido/base), agente simulado on/off. Cubren dos cambios sucesivos y deshacer solo el segundo, consulta intermedia del total, reinicio, pedido confirmado, conversación cerrada manualmente y edición inicialmente ambigua resuelta por línea. Se comprueban respuesta, carrito, estado y DTO de orden simulada; no se crea otra orden al deshacer después de confirmar.

Corrección general: interceptar deshacer antes de reabrir una conversación terminada. Distingue completed (pedido registrado) de closed (conversación cerrada sin acreditar una orden). No restaura carritos ni inicia pedidos nuevos en esos estados. No hay excepciones por restaurante.

Validación final: foco previo 210/210 (30 nuevos), suite final ampliada 90/90 (36 nuevos), TypeScript general/build OK y Node 92/92. Global 16.812/16.812, 197 suites, inventario exacto y 495 hashes intactos; 1.592,57 s. Se ejecutó con timeout de test de 15 s y cuatro workers en el bloque general, sin cambiar plazos de producción. Dos intentos previos de ráfagas excedieron 5 s y un tercero se interrumpió por timeouts en otras suites: no acreditarlos como aprobados. Evidencia /tmp/ppp-132-global-summary.json y logs por fase. Cero API pagada, WhatsApp u órdenes externas. Tandas131+132 desplegadas juntas en staging: bd3f5e5e, imagen7db0a13f…, verificado23/10 10:59:49 Bogotá: running/healthy, cero reinicios, healthOK, DBconnected, circuitoCLOSED. publicChat=true/orderEvents=false. Producción conserva imagenef426c93… y cero reinicios; Main intacta. Rollback ppp-nest-staging:rollback-before-bd3f5e5e. Evidencia /tmp/ppp-132-deploy.log y /tmp/ppp-132-deploy-verified.log. Bases, volúmenes y archivos privados preservados.

Siguiente bloque preparado: [conversaciones completas](whatsapp-complete-conversations-next-2310.md), con doce familias y oráculos por turno/DTO. Son casos de desarrollo, no muestra reservada.

Límites: deshacer un único cambio contado con registro vigente; no historial de undo, inferencia libre de «esos dos», ni evaluación real de voz/modelo. Los fixtures parten de carrito preparado. Siguiente: conversaciones completas desde carrito vacío con compras, notas repartidas, consulta y cierre, además de distinguir referencias a grupos explícitos de inferencias por cantidad. Mantener publicChat=true/orderEvents=false. No declarar vendible por conteos.

Detalle: [tanda 132](whatsapp-option-undo-lifecycle-validation-2310.md).

## VIGENTE — tanda 131: deshacer el último cambio contado de opciones (23/10)

Base c65f6e7a, staging. El registro lastUnitOptionEdit solo tenía texto/firma para idempotencia. Ahora guarda opcionalmente beforeCart y createdAt al aplicar el cambio directo o el resuelto por selección. «Deshaz el último cambio», «deshaz eso/ese cambio» y «revierte el último cambio» restauran exclusivamente ese carrito cuando la firma actual coincide, han pasado como máximo diez minutos, no hay selección/enlace de pago pendiente, el estado permite editar y las opciones originales siguen disponibles. Se consume el registro al restaurar. Se preservan estado, contacto y otros datos actuales. Sin nuevas tablas ni excepciones por restaurante.

54 casos nuevos en tres menús sintéticos, agente simulado on/off: directo, consulta del total, cambio de nombre, nota posterior, vencimiento, registro ausente, repetición, opción retirada y selección pendiente. Los casos válidos llegan a DTO de tres unidades con opciones/notas originales; los rechazados conservan carrito y piden corrección explícita. Baseline funcional 39 fallos/3 aprobados; primer intento anterior no ejecutó tests por un campo incorrecto del fixture, corregido a conv.customerName. Foco final 180/180, TypeScript general/build OK, Node 92/92. Global 16.776/16.776, 197 suites, inventario exacto, 495 hashes intactos, 621,22 s. Cero API pagada, WhatsApp u órdenes externas.

Publicado solo en staging; despliegue agrupado pendiente. Servidor conserva bb6c21eb, imagen 388efe82…; última verificación tanda 130 a las 09:44:45 Bogotá, no nueva verificación aquí. Main/producción intactos; conservar publicChat=true/orderEvents=false.

Límites: solo último cambio contado de opciones con registro válido; no undo de compras, direcciones, pagos ni órdenes confirmadas. Carrito preparado en fixtures. No restaura tras una nota posterior para evitar borrarla; pide corrección explícita. No acredita aún dos cambios consecutivos y deshacer el segundo, la ruta de edición inicialmente ambigua seguida de selección, ni resolver «esos dos» con antecedente inequívoco. Siguiente: esas tres familias; verificar que no se revierte el primer cambio ni se reutiliza el registro después de reiniciar/confirmar. No declarar vendible por conteos.

Detalle: [tanda 131](whatsapp-last-option-undo-validation-2310.md).

## VIGENTE — tanda 130: referencias ambiguas y recuperación explícita (23/10)

Base f5993513, staging. 24 casos nuevos, tres menús sintéticos (bao/salsa, pizza/masa, batido/base), agente simulado on/off. Dos líneas preparadas de tres unidades con opciones y notas propias en confirmación. «Cambia dos de esos/esas/de los que te dije a [opción]» y «Cambia dos de esos a como estaban» deben aclarar sin mutar. Consulta de precio intermedia conserva carrito; instrucción posterior por línea cambia solo dos unidades, conserva nota original y añade la nueva; DTO de seis unidades solo tras confirmar.

Los casos pasan con código existente. Foco final 192/192 en tres suites, TypeScript general/build OK, Node 92/92. Solo pruebas/documentación, sin nueva global: última global ejecutable es tanda 129, 16.698/16.698 en 196 suites; no sumar esta cifra con ejecuciones focales. Cero API pagada, WhatsApp u órdenes externas.

129/130 desplegadas juntas exclusivamente en staging: bb6c21eb, imagen 388efe82…, verificado 23/10 09:44:45 Bogotá: running/healthy, cero reinicios, health OK, DB connected, circuito CLOSED. publicChat=true y orderEvents=false conservados. Producción mantiene imagen ef426c93… y cero reinicios; Main intacta. Rollback ppp-nest-staging:rollback-before-bb6c21eb. Evidencia /tmp/ppp-130-deploy.log y /tmp/ppp-130-deploy-verified.log. Bases, volúmenes y archivos privados preservados. Límites: prueba aclaración segura con dos grupos posibles y lenguaje de cambio contado; no acredita resolver automáticamente «esos dos» con antecedente único, «deshaz eso» aislado ni revertir desde historial. Parten de carrito preparado. Siguiente: construir evidencia de la última mutación aplicada antes de aceptar un deshacer, o pedir una corrección explícita; contrastar antecedente único frente a varios y no inferirlo solo por cantidad. No declarar vendible por conteos.

Detalle: [tanda 130](whatsapp-deictic-subset-clarification-validation-2310.md).

## VIGENTE — tanda 129: retirar una nota conservando instrucciones posteriores (23/10)

Base f7df399a, staging. 18 conversaciones nuevas en tres menús sintéticos (bao/salsa, pizza/masa, batido/base), agente simulado on/off. Carrito preparado con dos líneas de dos unidades, opciones y notas diferentes. Se añade sin ajo y después salsa aparte a la primera; se retira solo sin ajo, se repite la retirada o se solicita primero un producto con dos líneas (debe aclarar), se consulta total y se cierra hasta DTO de cuatro unidades.

Baseline: 18 fallos. La regla general de empaque interceptaba «a la primera ponle como nota salsa aparte» y guardaba la instrucción completa. Ahora las notas explícitamente dirigidas a una línea se dejan al editor de notas existente. Sin excepciones por producto. Se conserva sin cebolla y salsa aparte, la otra línea y sus opciones, cantidades y precio. No hay orden antes de confirmar.

Foco 129/129 en tres suites, TypeScript general/build OK, Node 92/92. Global final 16.698/16.698, 196 suites, inventario exacto y 494 hashes intactos, 619,37 s. Incluye las 30 pruebas de tanda 128 y las 18 de esta, además de la global anterior; no sumar ejecuciones focales solapadas. Cero API pagada, WhatsApp u órdenes externas.

Publicación solo en staging; despliegue agrupado pendiente. Servidor conserva 3d5ef289, imagen a6f987f7…; última verificación 23/10 09:20:16 Bogotá de tanda 128, no verificado nuevamente aquí. Main/producción intactos. Mantener publicChat=true y orderEvents=false.

Límites: retirar una nota explícita/ordinal no equivale a deshacer cualquier modificación. Referencias «esos dos», «de esos tres deja dos como estaban» o «deshaz eso» siguen pendientes; requieren identificar un grupo y el cambio realmente guardado, sin reconstruirlo desde respuestas narrativas. Los fixtures parten de carrito preparado; no acreditan audio/modelo real ni checkout interrumpido por estas notas en todos sus estados. Siguiente: referencias libres con selección inequívoca y aclaración cuando haya varias; comprobar respuesta, carrito, estado y DTO. No declarar vendible por conteos.

Detalle: [tanda 129](whatsapp-note-undo-scope-validation-2310.md).

## VIGENTE — tanda 128: segundo cambio parcial sobre líneas divididas (23/10)

Base 2d77a7bb, staging. 30 casos nuevos en tres menús sintéticos (bao/salsa, pizza/masa, batido/base), agente simulado on/off. Parten de un carrito preparado de seis unidades, dos líneas de tres con opciones y notas propias, en confirmación. Cambian dos unidades de la primera línea a otra opción con nota adicional; después cambian solo una de ese nuevo grupo. Contrastan consulta de precio, consulta del carrito, selección ambigua y exceso de cantidad antes de una corrección explícita válida.

Los 30 pasan con el código existente: seis unidades conservadas, dos unidades con la nota adicional, las tres de la otra línea intactas, respuesta coherente, estado de confirmación conservado y DTO de seis unidades solo tras confirmar. Foco final 242/242 en tres suites, TypeScript general/build OK, Node 92/92. Solo pruebas/documentación: no repetir global. Última global del código ejecutable es tanda 127, 16.650/16.650 y 195 suites; no presentarla como global nueva. Cero API pagada, WhatsApp ni órdenes externas.

Tandas 127/128 desplegadas juntas exclusivamente en staging: 3d5ef289, imagen a6f987f7…, verificado 23/10 09:20:16 Bogotá: running/healthy, cero reinicios, health OK, DB connected y circuito CLOSED. publicChat=true y orderEvents=false comprobados. Producción conserva imagen ef426c93… y cero reinicios; Main intacta. Rollback ppp-nest-staging:rollback-before-3d5ef289. Evidencia /tmp/ppp-128-deploy.log y /tmp/ppp-128-deploy-verified.log; bases, volúmenes y archivos privados preservados. Mantener publicChat=true y orderEvents=false. Límites: los casos parten de carrito preparado y usan cambios explícitos por opción; no acreditan «de esos tres deja dos como estaban», deshacer semántico, audio/modelo real ni toda la compra desde carrito vacío. Siguiente: esas referencias libres y deshacer una modificación sin perder cambios posteriores, con variantes de menú, respuesta/carrito/estado/DTO. No declarar vendible por conteos.

Detalle: [tanda 128](whatsapp-repeated-subset-edits-validation-2310.md).

## VIGENTE — tanda 127: tres unidades con notas elípticas (23/10)

Base c276bb01, staging. Se reproducen 18 fallos en «tres platos, uno sin…, otro sin… y el último sin…»: la expansión del resto implícito consumía el primer grupo y perdía la distribución. Se reconoce primero la distribución completa de tres unidades, con propietario único disponible obtenido del catálogo. Reconoce masculino/femenino, tres/3 y último/ultima; conserva cada nota en una unidad. Sin nombres, IDs ni precios especiales de producción.

36 conversaciones nuevas (tres menús sintéticos: pasta, bowl, pescado; agente simulado on/off; dos formas elípticas × compra/coste/edición de segunda línea). Comprueban respuesta, cantidades, notas sin contaminación entre líneas, consulta sin mutación, cierre y DTO de tres unidades sin orden antes de confirmar. Suite de familia final 66/66; foco previo 107/107 (antes de añadir femenino), TypeScript general/build OK y Node 92/92. Global final 16.650/16.650, 195 suites, inventario exacto y 493 hashes intactos, 613,74 s. Cero API pagada, WhatsApp u órdenes externas.

Solo publicación en staging: despliegue agrupado pendiente. Servidor conserva la tanda 126: 0a0e5365, imagen a1651634…; última verificación 23/10 08:58:25 Bogotá, no una nueva verificación en esta tanda. Main/producción intactos. Mantener publicChat=true y orderEvents=false. No atribuir resultados a modelo o audio real ni declarar vendible por conteos.

Límites: tres grupos completos con notas acotadas y separadores explícitos; no acredita cualquier paráfrasis, reparto incompleto, cantidad contradictoria, ni instrucciones adicionales después del tercer grupo. Siguiente: correcciones parciales de grupos ya divididos («de esos tres, deja dos como estaban»), referencias ambiguas y consultas intercaladas; preservar total, notas y opciones, pedir aclaración cuando el grupo no sea único. Evidencia: [tanda 127](whatsapp-elliptical-three-notes-validation-2310.md).

## VIGENTE — tanda 126: tres líneas del mismo plato con notas distintas (23/10)

Base 4e25463f, staging. El usuario pidió confirmar generalidad y continuar. Se detectó un fallo transversal: tres repeticiones explícitas y contadas del mismo SKU, cada una con nota distinta, se reducían a una por deduplicación por ID. Se permite conservar repeticiones con nota propia distinta cuando el segmento original trae cantidad explícita. No hay excepciones por producto/restaurante. Segundo fallo: «a la segunda ponle como nota sin ajo» no editaba la línea. El editor existente ahora resuelve ordinales del carrito y conserva las otras líneas; ante selección pendiente o posición inexistente pide aclarar sin modificar.

32 regresiones nuevas: tres menús sintéticos (pasta, bowl, pescado), agente simulado on/off; compra de tres líneas, consulta de total, edición de segunda línea y DTO de tres unidades. Doce controles de posición inexistente/selección pendiente conservan carrito. Baseline 18 fallos; tras corregir deduplicación quedaron seis de ordinal; final foco 89/89 en tres suites, TypeScript general/build OK, Node 92/92. No hay llamadas pagadas, WhatsApp ni órdenes externas. Global final 16.614/16.614, 195 suites, inventario exacto y 493 hashes intactos. El runner registró 30.128,87 s de reloj; no usar esa cifra como latencia del bot ni como benchmark de CPU (no se auditó suspensión/cambio de reloj).

Límites: cantidades y nombres explícitos en cada segmento, notas de exclusión distintas; no acredita todavía elipsis de tres grupos («uno…, otro…, el último…»), reparto libre con notas parafraseadas ni cambios de stock. No atribuir a modelos reales los resultados de mocks. Siguiente: esas formas elípticas y correcciones de grupos pendientes, con conservación del total y consulta intermedia. Main/producción y configuración pública/aislamiento de staging se preservan. No declarar vendible por conteos.

Publicado y desplegado exclusivamente en staging: 0a0e5365, imagen a1651634…, verificado 23/10 08:58:25 Bogotá: running/healthy, cero reinicios, health OK, DB connected, circuito CLOSED. publicChat=true y orderEvents=false conservados. Main/producción intactos (imagen ef426c93…). Rollback ppp-nest-staging:rollback-before-0a0e5365; bin/ privado, bases y volúmenes preservados. Evidencia /tmp/ppp-126-deploy.log y /tmp/ppp-126-deploy-verified.log. Detalle: [tanda 126](whatsapp-three-note-groups-validation-2310.md).

## VIGENTE — tanda 125: notas, cantidades repartidas y apertura (23/10)

Base 1e6a2961, staging. Se reproducen los dos chats: milanesa/ajiaco rechazados por notas, pregunta de rechazo que compraba, y dos sopas convertidas en tres/cuatro. Notas de abundancia admiten femenino harta/arta y sustitución compacta anclada al plato; reparto de dos unidades con notas distintas se expande 1+1. Las herramientas validan cantidad contra el segmento identificado por nota literal única. Preguntas sobre un rechazo no compran. «Ya abriste?» y «puedo hacer un pedido?» consultan BusinessService y cerrado muestra agradecimiento/horario. Sin excepciones por nombres/IDs.

40 regresiones nuevas, PPP y tres menús sintéticos; herramientas reales con proveedor simulado, router, respuesta, carrito y DTO simulado. Foco 71/71; TypeScript general/build OK; Node 92/92. Global final 16.584/16.584, 194 suites, inventario exacto, 492 hashes intactos, 762,95 s. Primer intento global detenido al llegar el segundo chat; no se acredita como aprobación. Cero API pagada, WhatsApp ni órdenes externas.

Publicado y desplegado exclusivamente en staging: 52fa1e95, imagen d0671e0c…, verificado 23/10 00:26:40 Bogotá (05:26:40Z): running/healthy, cero reinicios, health OK, DB connected, circuit CLOSED. publicChat=true y orderEvents=false conservados. Producción mantiene ef426c93… y Main intacta. Rollback ppp-nest-staging:rollback-before-52fa1e95. Evidencia /tmp/ppp-125-deploy.log y /tmp/ppp-125-deploy-verified.log; bin/ privado, bases y volúmenes preservados. GET público de BusinessService del 23/10 devuelve abierto, 00:00–23:59, America/Bogota; no acredita horario histórico de las 23:59 anteriores. No cambiar horarios/configuración, publicChat=true ni orderEvents=false.

Siguiente: reparto en tres grupos y corrección libre de un grupo pendiente; notas parafraseadas en herramientas; consultas y cierre completo. Un «sí» después de preguntar por un fallo no ejecuta reintento automático: la respuesta solicita pedido explícito. La tanda no acredita audio real ni todos los repartos libres. Detalle y límites: [validación 125](whatsapp-qualified-notes-counts-validation-2310.md).

## VIGENTE — tanda 124: confirmación de varios productos con notas propias (22/10)

Solicitud explícita: mostrar los productos añadidos en lista y la nota debajo de su producto, en vez de nombres separados por comas y notas al final. Base a52a6ec8, staging. buildCartAddReply presenta varias adiciones numeradas; opciones y nota quedan bajo cada producto. Una adición conserva el formato breve previo. Las notas se buscan entre las últimas líneas de ese producto, distinguiendo apariciones repetidas, sin tomar notas de líneas antiguas. No cambia carrito, cantidades, precios ni asignación de notas.

Siete pruebas nuevas: seis recorridos router (tres menús, agente simulado on/off) comprueban compra, nota en su plato y posición de respuesta; una de formato contrasta dos variantes del mismo producto con notas diferentes y una línea antigua. Baseline siete fallos de formato; final siete aprobados. Dos suites relacionadas aportan 636 aprobadas (combos y notas/opciones). Un run intermedio falló por spy de ordersService.create ausente en el nuevo test; se corrigió el fixture y se repitió la suite afectada. TypeScript general/build OK. No nueva global por cambio exclusivamente de presentación; última global de reglas: tanda 121, 16.459 aprobadas. Cero API pagada, WhatsApp u órdenes externas.

Publicado y desplegado exclusivamente en staging: 4fec2b0f, imagen 8905126e…, verificado 22/10 23:56 Bogotá: running/healthy, cero reinicios, health OK, DB connected, circuit CLOSED. publicChat=true y orderEvents=false. Producción conserva ef426c93…; Main intacta. Rollback ppp-nest-staging:rollback-before-4fec2b0f; bin/ privado, bases y volúmenes preservados. Siguiente: retomar correcciones libres de grupos pendientes y conversación básica de cierre. La repetición semántica dentro de una nota (ej. «sin arroz más yuca, más yuca») no se normaliza en este cambio; se conserva el texto de cocina almacenado.

## VIGENTE — tanda 123: cancelar un reparto pendiente y retomar el cierre (22/10)

Base 0ba5a9ce, staging. 36 regresiones nuevas: seis escenarios × tres menús sintéticos × agente simulado on/off. Después de iniciar el reemplazo de cuatro platos por combos y repartir solo dos con Uva/sin tomate: cancelar ese cambio, olvidarlo, cancelar la selección, cancelar y elegir de nuevo con Pepsi, reiniciar y comprar otra vez, o cancelar después de guardar un nombre. Todos llegan a DTO, sin orden antes de confirmar.

Los 36 casos pasan con el código existente. Cancelar selección conserva el carrito original y su nota sin cebolla; la nota sin tomate del reparto abandonado desaparece; al reintentar no sobreviven sabores parciales; reiniciar vacía y permite una compra nueva de una unidad. El nombre explícito guardado antes de cancelar se conserva en el cierre. No se modificaron reglas de producción.

Foco final 852/852 en cinco suites (84,349 s); TypeScript general/build OK y Node 92/92. Solo pruebas/documentación: no nueva global ni despliegue. La última global de código ejecutable sigue siendo tanda 121, 16.459/16.459 en 192 suites; no es un conteo global de esta tanda. Cero API pagada, WhatsApp u órdenes externas.

Publicar en staging. Servidor conserva 17bc27a7, imagen 2a57360d…, última verificación de despliegue 22/10 23:41 Bogotá. No se cambió Main/producción ni acceso público de staging/bloqueo de eventos de cocina. Evidencia: [tanda 123](whatsapp-cancel-partial-distribution-validation-2210.md).

Siguiente: corrección libre del grupo aún pendiente («los primeros mejor con…», «esos dos sin…») sin cancelar el producto; preservar el resto y preguntar si el grupo no es único. Sigue pendiente contrastar conversación básica completa con consulta, dirección y cierre fuera de la familia de combos. Esta tanda no acredita esas correcciones libres, cancelación de órdenes ya confirmadas, cambios de stock ni modelo real.

## VIGENTE — tanda 122: varios atributos por grupo y recuperación (22/10)

Base 245c5c7a, staging. 42 regresiones nuevas: tres menús sintéticos (arroz con preparación de pollo, hamburguesa con término y salchipapa con salsa), agente simulado on/off. Cada grupo lleva bebida y preparación distintas, nota propia sin tomate/con ají y nota común sin cebolla. Reparto completo o entre turnos, cambio de opinión mediante nuevo reparto 1+3, nombre y consulta de sabores intercalados, exceso de cantidad y selección incompleta seguida de recuperación válida. Todos terminan en DTO de cuatro unidades, sin crear orden antes de confirmar.

No se encontró fallo en esta familia: los primeros 24 y la extensión de 18 pasaron con el código existente. Se añadieron tests, no reglas de producción. Foco final 816/816 en cinco suites (44,38 s); TypeScript general/build y Node 92/92 aprobados. No se repite global ni build de servidor porque no cambió código ejecutable: la última global de esa fuente sigue siendo 16.459/16.459, 192 suites, tanda 121. No presentar ese conteo como global nueva ni sumar ejecuciones solapadas.

Solo pruebas/documentación publicadas en staging; no requiere despliegue. Servidor sigue ejecutando 17bc27a7 (120/121), imagen 2a57360d…, verificado en la tanda anterior 22/10 23:41 Bogotá. Main/producción intactos; acceso público de staging y bloqueo de eventos de cocina deben conservarse. Cero API pagada, WhatsApp u órdenes externas. Evidencia: [tanda 122](whatsapp-multiple-group-attributes-validation-2210.md).

Límites: dependencias/modelos simulados, grupos explícitos y cambio de opinión mediante reparto completo. No acredita correcciones libres del grupo pendiente («los primeros mejor…»), cambio de producto/agotado entre turnos ni contacto múltiple en la misma respuesta. Siguiente: correcciones de un grupo aún pendiente, cancelar/reemplazar esa selección y retomar checkout; contrastar además conversación básica completa para evitar concentrar toda la cobertura en repartos. Sin cambios de fuente, focalizar; global solo cuando cambien reglas compartidas.

## VIGENTE — tanda 121: notas separadas por grupo y correcciones parciales (22/10)

Base cead288b, staging. 72 regresiones nuevas, tres menús sintéticos y agente simulado on/off, todas hasta DTO simulado. Cuatro unidades distribuidas en dos o tres grupos: notas sin tomate/con ají/sin sal, frases completas o por turnos, con/sin conjunción y comas; misma bebida con notas distintas; recuperación de sabor desconocido; cambio de una sola unidad en pago/confirmación; cubiertos, salsa aparte e hielo. Conserva nota común y opciones compatibles, suma cuatro unidades, no mezcla notas entre grupos y no crea orden antes de confirmar.

Los primeros 36 casos pasaron sin cambios. Al ampliar redacción se reprodujeron 12 fallos (744 aprobados): «con Pepsi con ají» perdía la nota al consumirla como parte de la bebida. Se retira exclusivamente la opción resuelta del catálogo al inicio del grupo antes de extraer las notas; no se añade excepción por bebida, producto o restaurante. Los grupos con la misma bebida y notas distintas permanecen separados.

Foco final 774/774 en cinco suites; TypeScript general/build OK; Node 92/92. Global final 16.459/16.459, 192 suites, inventario exacto, 490 hashes intactos, 565,33 s. Cero API pagada, WhatsApp u órdenes externas. Modelos y servicios externos simulados; no acredita mejora de transcripción/visión real ni calidad general para venta.

Tandas 120/121 publicadas y desplegadas juntas en staging: 17bc27a7, imagen 2a57360d…, verificado 22/10 a las 23:41 Bogotá: running/healthy, cero reinicios, health OK, DB connected y circuit CLOSED. publicChat=true, outbound=true, canal configurado, staging=true y orderEvents=false efectivos. Producción conserva imagen ef426c93…; Main intacta. Rollback ppp-nest-staging:rollback-before-17bc27a7; bin/ privado, bases y volúmenes preservados. Mantener acceso público de staging y eventos de cocina bloqueados. Evidencia: [tanda 121](whatsapp-distributed-group-notes-validation-2210.md).

Siguiente: varios atributos en cada grupo (bebida+término/salsa/temperatura), cambios de opinión antes de completar el reparto y notas/contacto intercalados. Contrastar respuestas sin cantidad, preguntas y disponibilidad cambiante. No usar conteos para declarar vendible ni cambiar Main sin solicitud explícita.

## VIGENTE — tanda 120: reparto de opciones en varios turnos (22/10)

Base 054f45f9, staging. 66 regresiones nuevas, tres menús sintéticos (arroz, hamburguesa, salchipapa), agente simulado on/off. Cuatro unidades: «dos con Uva», luego «los otros con Pepsi», cantidad explícita o sabor solo/con cortesía. Incluye consulta intermedia, opción desconocida, exceso de unidades, índice ambiguo, reinicio, reparto completo corregido y original modificado. 54 recorridos hasta DTO; seis reinicios y seis protecciones de original modificado. Conserva notas/opciones compatibles, carrito original mientras falta reparto y ninguna orden antes de confirmar.

Se reproducían 36/36 fallos iniciales: una elección parcial se aplicaba antes de terminar el reparto. Se guardan grupos en pendingAttribute.distributionParts y se usa el planificador atómico existente al completar la cantidad. El sabor solo completa las restantes; el índice aislado pide nombre para evitar aplicarlo a todas. Una distribución completa nueva sustituye la propuesta parcial. Extensión «Pepsi, por favor»: 6/6 fallos antes de normalizar cortesía. La primera global completa iniciada detectó una regresión del PDF («uno con… y el otro con…» completo); se detuvo y corrigió la prioridad, sin publicar esa versión. El reparto completo conserva su ruta previa.

Validación: foco inicial 696/696 en cinco suites; tras cortesía, 444/444 de combos; reparación histórica + combos 1.170/1.170. TypeScript general/build OK; Node 92/92. Global final 16.387/16.387, 192 suites, inventario exacto y 490 hashes intactos, 587,22 s. No sumar runs de desarrollo como pruebas independientes. Cero API pagada, WhatsApp u órdenes externas.

Publicación en rama staging; pendiente de despliegue agrupado. Servidor conserva e4fdb03a (118/119), imagen ddefc8e4…; acceso público de staging debe seguir activo, eventos de cocina bloqueados. Main/producción preservados. Evidencia: [tanda 120](whatsapp-multiturn-option-distribution-validation-2210.md).

Límites: opciones de un producto ya seleccionado, dependencias/modelo simulados. No acredita inferencia real, reparto libre entre varios productos, notas diferentes por grupo ni contacto mezclado con cada fracción. Siguiente: notas y opciones sobre cada grupo en varios mensajes, corrección de solo uno, tres grupos y distintos atributos (temperatura, término, salsa), con varios menús y DTO. Mantener la validación histórica de repartos completos. No desplegar a Main sin solicitud explícita.

## VIGENTE — tanda 119: reparto de bebidas durante reemplazo por combo (22/10)

Base 73816c6b, staging. 36 regresiones nuevas, tres menús sintéticos y agente simulado on/off. Reparto de cuatro combos en Uva×2/Pepsi×2 mediante «los quiero 2 con…», «dos con… y dos con…» o comas. 18 recorridos hasta DTO; 18 controles de suma incorrecta, sabor desconocido y original modificado. Notas y opciones compatibles conservadas; ninguna orden antes de confirmar.

Fallo reproducido: la distribución añadía combos sin retirar el plato original y omitía comprobar que el original siguiera intacto. Se prepara un carrito temporal retirando solo la coincidencia exacta y se guarda después de validar todos los grupos. Se hereda la nota del original. Durante pendingAttribute se reconoce el reparto breve sin «los quiero». Baseline inicial 12 fallidos/12 aprobados; extensión breve 12/12 fallidos antes de corregir. Foco final 636/636 en cinco suites; TS general/build OK; Node 92/92. Global 16.321/16.321, 192 suites, 490 hashes intactos, inventario exacto, 575,15 s, sin reintentos.

Cero llamadas pagadas, WhatsApp u órdenes externas. Main/producción preservados. Tandas 118/119 desplegadas juntas en staging: e4fdb03a, imagen ddefc8e4…, verificado 22/10 a las 22:51 Bogotá: running/healthy, cero reinicios, health OK, DB connected y circuit CLOSED. publicChat=true y orderEvents=false efectivos. Producción conserva ef426c93…; rollback ppp-nest-staging:rollback-before-e4fdb03a, bin/ privado y bases/volúmenes preservados. Acceso público de staging debe permanecer activo y eventos de cocina bloqueados. Evidencia: [tanda 119](whatsapp-pending-combo-distribution-validation-2210.md).

Límites: reparto completo de opciones mientras el producto ya está seleccionado; no cubre por esta tanda varias instrucciones de contacto/notas en la misma respuesta ni grupos enviados en mensajes separados. Siguiente: repartir por turnos («dos con Uva» / «los otros con Pepsi»), consultas entre ambos y cambio de opinión; conservar total y no confirmar un reparto incompleto.

## VIGENTE — tanda 118: cambiar una unidad de una línea dividida (22/10)

Base cc4e71e5, staging. 36 regresiones nuevas: tres menús sintéticos, agente simulado on/off, compra/pago/confirmación y elección de línea explícita o mediante aclaración. Parten de cuatro combos con Uva y nota, cambian dos bebidas a Pepsi y solo una de las dos unidades restantes a Limonada. Verifican reparto final Uva×1/Pepsi×2/Limonada×1, opciones compatibles, notas, estado y 36 DTO completos sin crear órdenes antes de confirmar.

Baseline: 18 aprobados por aclaración y 18 fallidos con «cambia una de la línea N por Limonada». La regla de referencia explícita admite ahora «de la línea» además de «unidad de la línea»; no cambia selección por producto ni cantidades. Foco 600/600 en cinco suites; TS general/build OK, Node 92/92. Global 16.285/16.285, 192 suites, 490 hashes intactos, inventario exacto, 606,42 s, sin reintentos.

Código publicado en staging, pendiente de despliegue agrupado. Servidor conserva 6863b72c (tanda 117), acceso público activo; Main/producción preservados. Cero llamadas pagadas, WhatsApp u órdenes externas. Evidencia: [tanda 118](whatsapp-split-combo-unit-validation-2210.md).

Límite: cambios sobre combos ya añadidos y divididos, no selección inicial de varios sabores en una opción pendiente. Siguiente: reparto completo durante elección inicial de bebida y conservación de contacto/notas; contrastar cantidades que no suman y sabores no ofrecidos. No inferir calidad del modelo real a partir de mocks.

## VIGENTE — tanda 117: recuperación y acceso público de staging (22/10)

Base 098e6e58, rama staging. 24 regresiones nuevas de recuperación en tres menús y agente simulado on/off: precio cambiado, combo retirado/agotado y bebida desconocida; datos de contacto conservados, dos unidades con nota, alternativa válida y 24 DTO completos. Pasaron en el código existente; no se parcheó el orquestador.

A solicitud expresa del usuario, staging debe responder a cualquier número. Se añade WHATSAPP_STAGING_PUBLIC_CHAT=true: omite solo la lista de destinatarios, mantiene WHATSAPP_STAGING_OUTBOUND_ALLOW=true, el canal STAGING_WHATSAPP_PHONE_NUMBER_ID exacto y validación del número. Sin esa opción conserva la lista cerrada. Diez pruebas nuevas de acceso: texto a tres visitantes, medios, canal incorrecto, salida deshabilitada, destinatario inválido y valores distintos de true. Baseline 4 fallidos/14 aprobados; foco final 354/354 en cinco suites; TS general/build OK, Node 92/92. Global 16.249/16.249, 192 suites, 490 hashes iguales, inventario exacto, 536,78 s.

Cero API pagada, WhatsApp u órdenes externas en la validación. Los visitantes reales sí usarán los modelos habituales. Mantener STAGING_ORDER_EVENTS_ALLOW desactivado; no abrir cocina, pagos ni runners de prueba. Main/producción intactos. Publicado y desplegado en staging: 6863b72c, imagen 8bd4fa85…, verificado el 22/10 a las 22:03 Bogotá: running/healthy, cero reinicios, health OK, DB connected y circuit CLOSED. Configuración efectiva publicChat=true, salida habilitada, canal configurado y orderEvents=false. Producción conserva ef426c93…. Rollback ppp-nest-staging:rollback-before-6863b72c; env previo guardado privado en /root/ppp-staging-env-before-public-chat-117. bin/, bases y volúmenes preservados. Evidencia: [tanda 117](whatsapp-public-staging-recovery-validation-2210.md).

Siguiente: varias unidades con sabores diferentes durante selección de combo y cambios posteriores sobre solo una unidad; varias familias de menú, respuesta/carrito/estado/DTO. Prueba real de visitante desde otro número aún no realizada por el agente.

## VIGENTE — tanda 116: elección, bebida y contacto juntos (22/10)

Base 2aa0a9e7, staging. 48 regresiones nuevas, tres menús sintéticos y agente simulado on/off: elección textual + bebida + nombre/teléfono/dirección, datos antes/después, comas/saltos de línea, cantidad explícita. 24 recorridos hasta DTO con bebida, nota, cantidad y contacto. Otros 24 contrastan opción no ofrecida, bebida desconocida, dos sabores ambiguos y cantidad cero, sin mutar el carrito.

Baseline 24/24 fallidos en los recorridos iniciales; se reutiliza la resolución de oferta de reemplazo por combo después de capturar datos, en lugar de perder la selección o usar atributos por defecto. La separación reconoce referencias textuales a filas y cantidades; disponibilidad, precio, bebida y límites siguen a cargo de la ruta existente. Foco 624/624 en cinco suites; TS general/build OK, Node 92/92. Global final 16.215/16.215, 192 suites, inventario exacto, 490 hashes sin cambios, 531,70 s. Cero API pagada, WhatsApp u órdenes externas.

Límites: oferta de reemplazo con preferredId; cláusulas separadas por salto de línea o comas reconocidas, nombre explícito, dirección vial completa y bebida exacta del catálogo. No acredita texto libre sin separadores, reparto entre varios sabores ni modelos/Maps reales. Main/producción preservados. Tandas 115/116 desplegadas juntas en staging: 4b70288d, imagen 548e50d1…, verificado el 22/10 a las 21:46 Bogotá: running/healthy, cero reinicios, health OK, DB connected y circuit CLOSED. Rollback ppp-nest-staging:rollback-before-4b70288d conserva 8e2a6f5e…. Producción conserva ef426c93…; bin/ privado preservado, sin cambios de bases/volúmenes. Evidencia: [tanda 116](whatsapp-combo-drink-contact-validation-2210.md).

Siguiente: contacto y selección combinados cuando cambia precio/disponibilidad; recuperación de bebida desconocida sin perder datos; después varios sabores/unidades. Conservar contraste entre pregunta y compra y DTO hasta confirmación.

## VIGENTE — tanda 115: nombre durante una opción pendiente (22/10)

Base ff8c7f81, rama staging. 18 regresiones nuevas en tres menús sintéticos (arroz, hamburguesa y salchipapa), agente simulado on/off: nombre, teléfono o dirección mientras se elige bebida de un combo de reemplazo. Comprueban respuesta con elección pendiente, carrito y selección conservados, atributos compatibles, datos guardados y 18 recorridos hasta DTO simulado sin crear orden antes de confirmar.

Se reproducía pérdida del nombre explícito: 6 fallidos / 228 aprobados. Se guarda el nombre etiquetado durante pendingAttribute y se recuerda que el dato ya se recibió cuando existe checkout pendiente. La primera global detectó una regresión en la reanudación del nombre; se corrigió y la global final pasó completa. Foco final 576/576 en cinco suites; TypeScript general/build OK; Node 92/92. Global final 16.167/16.167, 192 suites, 490 hashes intactos, inventario exacto, 522,28 s. Cero API pagada, WhatsApp u órdenes externas.

Límite: nombre explícito como mensaje separado, sin cola multiorden. No acredita interpretación de mensajes mixtos con elección+bebida+contactos ni precisión de modelos reales. Código publicado en staging, pendiente de despliegue agrupado; servidor staging sigue en a254850e (tanda 114), Main/producción preservados. Evidencia: [tanda 115](whatsapp-pending-option-contact-validation-2210.md).

Siguiente: elección textual + bebida + nombre/teléfono/dirección en un mensaje; datos antes/después de la elección; cambios de nombre y alternativas mientras se elige, con varios menús. Validar respuesta, carrito, estado y DTO sin confundir el número de opción con cantidad/teléfono.

## VIGENTE — tanda 114: cantidad, opción y bebida (22/10)

Base 2887c476, staging. 48 regresiones nuevas en tres catálogos y agente simulado on/off: «dos del combo 2 con Uva», «uno de la opción 1 con Uva», «dame 3 del combo 2 porfa»; aumento/reducción, notas/opciones compatibles, bebida pendiente y 18 DTO simulados. Contrastes de cantidad cero, negativa, superior al límite de lectura 30, fila no ofrecida y cantidad conservada después de cotizar precio nuevo. Baseline 42 fallidos/168 aprobados; suite final 216/216. Foco 558/558 en seis suites; TypeScript general/build OK; Node 92/92. Global 80 + 16.069 = 16.149, 192 suites; inventario exacto y 490 hashes intactos; 805,77 s, sin reintentos.

Se separa cantidad explícita de referencia a fila y bebida. Reemplazar usa la cantidad solicitada, manteniendo el original intacto mientras faltan opciones. La cotización nueva conserva la cantidad en la selección pendiente. Cero/negativos/fuera de rango y filas no ofrecidas no reemplazan por el combo preferido. Se conservan límites de carrito existentes además del límite de lectura. No hay excepciones de productos PPP.

Límites: oferta de reemplazo por combo con preferredId, cantidad explícita antes de «del/de la/de el», bebida validada por la tanda 113. No acredita reparto entre varias líneas/sabores ni contacto/dirección en el mismo mensaje. Router y dependencias simuladas; cero llamadas pagadas, WhatsApp u órdenes externas. Main y su despliegue permanecen sin cambios. Tandas 113/114 desplegadas juntas en staging: a254850e, imagen 8e2a6f5e…, verificado 22/10 a las 20:54 Bogotá, running/healthy, cero reinicios; health OK, DB connected, circuit CLOSED. Rollback ppp-nest-staging:rollback-before-a254850e conserva b4f94e08…. Producción conserva ef426c93…; bin/ privado preservado, sin cambios de bases/volúmenes. Evidencia: [tanda 114](whatsapp-counted-combo-selection-validation-2210.md).

Siguiente: contacto/dirección mientras se elige combo y bebida, respuesta con varios datos y conservación del paso pendiente; luego distribución entre varias opciones. Mantener controles de precio, disponibilidad, notas y DTO.

## VIGENTE — tanda 113: opción y bebida en la misma frase (22/10)

Base 1e7a6fdc, staging. 60 regresiones nuevas, tres catálogos y agente simulado on/off: «el combo 2 con Uva porfa», «la opción 2 con Pepsi», «quiero el número 1 con Uva», «la opción 2 con bebida Uva»; dos unidades con nota, atributos compatibles y 24 DTO simulados. Contrastes: número no ofrecido, bebida desconocida, dos sabores, producto retirado/agotado y cambio de precio. Baseline 30 fallidos/114 aprobados (primera extensión); final 168/168 en la suite ampliada. Foco 389/389 en cinco suites; TypeScript general/build OK y Node 92/92. Global 80 + 16.021 = 16.101, 192 suites, inventario exacto y 490 hashes intactos; 628,1 s, sin reintentos.

Se resuelve primero la referencia a la fila ofrecida y después la bebida exacta de ese producto, sin inferir el combo preferido a partir del sabor. La lista existente valida disponibilidad/precio para esa fila. Una bebida desconocida o ambigua conserva carrito y pide repetir opción/bebida; no elige por defecto ni agrega bebida aparte. Los productos retirados o agotados no se reemplazan silenciosamente por el preferido. Reglas por catálogo, sin excepciones PPP.

Límites: oferta de reemplazo por combo con preferredId; nombre de bebida exacto tras normalización y cortesía. No acredita selección + cantidad explícita («dos del combo 2 con Uva»), nombre/teléfono/dirección en la misma frase, ni distribución de sabores. Modelos, transporte y servicios externos simulados; cero API pagada/WhatsApp/órdenes externas. Publicado en la rama staging, sin despliegue de esta tanda: servidor staging conserva 3e87cdac (hasta 112), Main conserva hasta 109. Agrupar el próximo despliegue validado. Evidencia: [tanda 113](whatsapp-inline-combo-drink-validation-2210.md).

Siguiente: selección + cantidad explícita y opciones, contrastando número de fila/código/cantidad; después contacto y dirección durante selección. Mantener consultas, agotados, precio cambiado y DTO como controles.

## VIGENTE — tanda 112: elegir combo con número y cortesía (22/10)

Base 8556c983, staging. 42 regresiones nuevas en tres catálogos y agente simulado on/off: «el combo 1 porfa», «el combo 2 por favor», «la opción 2 gracias», «quiero el número 1»; dos unidades con nota y opciones compatibles, 24 DTO simulados, número no ofrecido, consulta de contenido y cambio de precio. Baseline 30 fallidos/66 aprobados; final 108/108. Foco 534/534 en siete suites, TypeScript general/build OK, Node 92/92. Global 80 + 15.961 = 16.041 en 192 suites; inventario exacto y 490 hashes intactos; 561,62 s, sin reintentos.

Se comparte el lector de referencias numéricas entre la lista general y la oferta de reemplazo por combo. Las palabras descriptivas deben pertenecer a todas las opciones ofrecidas. Números fuera de la lista de reemplazo no pasan a selección aproximada del combo preferido: se pide una opción válida conservando carrito. Precio cambiado mantiene la aceptación previa al flujo de bebida. Sin nombres/IDs/precios PPP en reglas.

Límites: selección con cortesía y bebida en turno posterior; no acredita «el combo 2 con Uva» ni selección/cantidad/datos de entrega en el mismo mensaje. Estos casos usan router real y harness con reply/servicios externos simulados; no inferencia real, WhatsApp ni órdenes externas. Main y su despliegue siguen hasta tanda 109, sin cambios. Tandas 111 y 112 desplegadas juntas en staging: 3e87cdac, imagen b4f94e08…, verificado 22/10 a las 20:14 Bogotá, running/healthy, cero reinicios, health OK/DB connected/circuit CLOSED. Rollback ppp-nest-staging:rollback-before-3e87cdac conserva imagen eca86842…. Main y el contenedor productivo conservan ef426c93…; bin/ privado preservado, sin cambios de bases/volúmenes. Evidencia: [tanda 112](whatsapp-text-combo-selection-validation-2210.md).

Siguiente: selección + bebida («el combo 2 con Uva»), selección + cantidad explícita, cambio de opinión durante opciones y contacto/dirección en la misma frase. Mantener controles de número no ofrecido, consultas que no compran y DTO completo.

## VIGENTE — tanda 111: compra inicial con pregunta de acompañamiento (22/10)

Base cf510ed2, rama staging. 22 regresiones nuevas: compra de una/dos unidades más pregunta de contenido, respuesta afirmativa/negativa, aceptar/rechazar, 12 recorridos hasta DTO simulado y cuatro reproducciones del pollo frito/papa francesa. Tres menús sintéticos y fixture PPP, agente simulado on/off. Las doce compras hasta DTO y los cuatro casos literales restauran reply real; transporte/modelos/persistencia externos simulados.

Se responde primero sobre el contenido y se conserva una oferta con cantidad, sin añadir el acompañamiento consultado. Solo se resuelve un nombre de catálogo inequívoco con carrito vacío; nombres con prefijo «1» pueden coincidir con la compra de «un…». La aceptación de una oferta limpia su estado antes del flujo de atributos, evitando conservar una oferta ya aceptada. Baseline: 18 fallidos/84 aprobados; tras corregir y ampliar: 106/106 en la suite. Foco 214/214, TypeScript general/build OK, Node 92/92. Global 15.999/15.999, 192 suites, inventario exacto, 490 hashes intactos, 997,5 s, sin reintentos. No inferir mejora del rendimiento: esta global tardó más que la anterior.

Límites: pregunta con signos, hasta 120 caracteres y acompañamiento corto; nombre explícito único, no alias ambiguos. No incluye búsqueda automática de combo alternativo para esa pregunta inicial ni preguntas de bebida, que conservan su ruta. No acredita precisión de modelos/Maps reales. Evidencia: [tanda 111](whatsapp-initial-side-question-validation-2210.md). Cero llamadas pagadas, WhatsApp u órdenes externas. Main y su despliegue se preservan (hasta tanda 109). Esta tanda queda publicada en la rama staging, sin reconstruir el servidor; el despliegue de staging sigue en tanda 110 (4b2e84d5). Agrupar el siguiente despliegue validado.

Siguiente: selección con texto («el combo 2 porfa»), contraste número de opción/cantidad, respuestas mientras elige bebida y conservación del DTO. Después ampliar nombres/acompañamientos y oferta de variantes sin asumir compra de adicionales.

## VIGENTE — tanda 110: elegir combo por número conserva opciones y pregunta bebida (22/10)

Base c06fec97, staging. Se cierra el pendiente de la tanda 104 para números simples en una oferta de reemplazo con combo preferido. Antes «1»/«2» entraban por selección genérica y asignaban primera bebida; ahora usan la misma elección de opciones que «sí», conservan atributos compatibles/cantidad/nota y mantienen el plato original hasta completar las opciones. Si el precio cambió, se delega primero a la ruta existente de aceptación de precio.

32 regresiones nuevas en whatsapp-related-combo-offer.spec.ts: tres catálogos (arroz con pollo, hamburguesa con término, salchipapa con salsa), agente on/off; dos combos, número no ofrecido, dos unidades con nota y precio cambiado antes de seleccionar. Doce recorridos llegan al DTO simulado, sin crear orden antes de confirmar. Baseline 12/54 fallidos (primera extensión); extensión final 66/66. Foco 479/479 en 7 suites; TypeScript general/build OK, Node 92/92. Global 80 + 15.897 = 15.977, 192 suites, inventario exacto y 490 hashes intactos, 556,93 s, sin reintentos. Evidencia: [tanda 110](whatsapp-numeric-combo-options-validation-2210.md).

Límites: solo números simples y ofertas de reemplazo con preferredId; no generalizar a todas las selecciones ni a «el combo 2 porfa». La compra inicial con pregunta («un pollo frito, ¿viene con papa francesa?») sigue pendiente. Modelos/servicios externos simulados; no API pagada, WhatsApp ni órdenes externas. Main sigue con tandas hasta 109. Desplegado y verificado en staging el 22/10 a las 17:55 Bogotá: 4b2e84d5, imagen eca86842…, running/healthy, 0 reinicios, health OK/DB connected/circuit CLOSED. Rollback rollback-before-4b2e84d5. Producción conserva imagen ef426c93… y Main hasta tanda 109; sin cambios en bases, volúmenes ni archivos privados.

Siguiente bloque: pedido inicial + pregunta de contenido, mantener intención de compra sin convertir acompañamiento consultado en adicional; luego variantes de selección numérica con texto. Conservar límites de direcciones relativas y sustitución abreviada documentados anteriormente.

## VIGENTE — promoción a Main y producción verificada (22/10, 15:06 Bogotá)

Solicitud explícita del usuario: desplegar los cambios en Main. Main remoto y local actualizados por fast-forward a 368723a8; incluye tandas 95–109. Producción /var/www/ppp-nest reconstruida: imagen ef426c93…, running, 0 reinicios, health OK/DB connected/circuit CLOSED. Hash agregado de módulos WhatsApp compilados idéntico al staging validado (cca1ccfc…). Sin cambios de código durante la promoción; aplica validación de tanda 109, 15.947 tests/192 suites. Compose privado conservado por SHA; bases y volúmenes intactos. Rollback ppp-nest-api:rollback-before-368723a8.

Staging se conserva en su checkout y rama, imagen 43efcaaf… intacta, para la siguiente tanda. Cambios generados previos del checkout local Main preservados. Registro: [promoción 22/10](whatsapp-main-promotion-2210.json). Las entradas anteriores que indican «solo en staging» describen el estado histórico; todas las tandas hasta 109 están ahora en producción. Siguen vigentes los límites y pendientes de la tanda 109; no se acredita precisión del modelo real ni piloto completo por esta promoción.

## VIGENTE — tanda 109: recorrido completo, cantidad con adicionales y pin con acceso (22/10)

Base a69c14f7, staging. 42 recorridos nuevos en tres catálogos sintéticos (pollo, hamburguesa, pasta), agente simulado on/off. Pregunta de acompañamiento → adicional → corrección de cantidad → bebida → nombre → dirección no ubicada → pin → consulta de importe → pago → DTO o cancelación. Se restauró reply real, con transporte y servicios externos simulados. Contrastes: opciones distintas requieren aclarar; destino previamente cotizado, petición de nueva dirección, pin identificado y fuera de cobertura no heredan el apartamento anterior.

Dos fallos reproducidos: el pin borraba torre/apartamento; «solo pedí un X» con otro producto en el carrito no reducía X correctamente. La prueba anterior de la tanda 87 era débil (solo exigía no aumentar el conteo): ahora verifica una unidad exacta y conservación íntegra del adicional. Se permite disputa de cantidad limitada a las líneas nombradas; no se cambia la semántica de «deja solo…». Un pin desnudo que resuelve una geocodificación fallida conserva el texto anterior como referencia, usando las coordenadas nuevas para cotizar.

Validación: baseline inicial 6/12 fallidos por pérdida de acceso; baseline definitivo contra HEAD anterior 12/42 fallidos (la corrección de cantidad bloqueaba seis recorridos antes del pin). Foco 650/650, 7 suites; TypeScript general/build OK; Node 92/92; global 80 + 15.867 = 15.947, 192 suites, inventario exacto y 490 hashes intactos, 534 s, sin reintentos. Evidencia: [tanda 109](whatsapp-checkout-full-journey-validation-2210.md).

Límites: menús distintos con una estructura común de plato/adicional/bebida; no acredita todas las estructuras multitenant ni precisión de Maps/modelo reales. Pin nativo probado; enlace de Maps/foto de dirección no cubiertos por este cambio. No es replay literal de todas las respuestas del modelo en los chats históricos. Sin API pagada, WhatsApp ni órdenes externas. Main intacto. Publicado y desplegado en staging: 603d7daa, imagen 43efcaaf…, verificado el 22/10 a las 15:03 Bogotá, running/healthy, 0 reinicios, health OK/DB connected/circuit CLOSED. Rollback rollback-before-603d7daa conserva imagen 5045bad1…. Producción conserva 1d512d0c… y Main intacto.

Siguiente: compra con pregunta en el mismo mensaje («un pollo frito, ¿viene con papa francesa?»), elección numérica del combo conservando atributos y cambio deliberado de ubicación con notas de acceso; mantener pendientes de referencias relativas («aquí al frente») y reemplazos abreviados de la tanda 107. No declarar piloto listo por estos conteos.

## VIGENTE — tanda 108: referencias de dirección, corrección y confirmación respaldada (22/10)

Base 2bef214f, staging. 90 casos nuevos: referencias posteriores y antepuestas, interiores, esquina/alfrente/costado/portería, nombres de lugares no recortados, dirección exacta del chat, cambios durante pago que eliminan pin/tarifa viejos, 24 DTO simulados, otra puerta rechazada y protestas que no convierten geocodificación fallida en dirección confirmada. Tres menús, agente on/off. Baseline 28/60 fallidos; extensión reprodujo respuesta ficticia de confirmación.

Cambios: separación general de referencias, preservar intersecciones/nombres; mensaje distinto cuando ya hay calle/número; protección de respuesta final contra afirmación de dirección confirmada con tarifa nula por fallo. Estos tests restauran reply real (el harness general lo reemplaza), con transporte simulado. Foco 288/288; TypeScript general/build OK; Node 92/92; global 15.905/15.905, 191 suites, 489 hashes congelados, sin reintentos.

Límites: Google/modelo simulados; no acredita el resultado real actual de Maps. Referencias antepuestas sin delimitador, cruces sin puerta y otras paráfrasis de confirmación requieren siguiente tanda. Siguen pendientes abreviaturas de reemplazos (107). Evidencia: [tanda 108](whatsapp-address-directions-validation-2210.md). Sin API pagada, WhatsApp ni órdenes externas. Desplegado y verificado en staging el 22/10 a las 14:31 Bogotá: 34311fd1, imagen 5045bad1…, running/healthy, 0 reinicios, health OK, DB connected, circuito CLOSED. Rollback rollback-before-34311fd1. Producción conserva imagen 1d512d0c…; Main intacto.

## VIGENTE — tanda 107: «quita X y dame Y» como reemplazo validado (22/10)

Base d297c651, staging. 24/24 reproducciones iniciales fallaban: borrado sin reemplazo o duplicado. Ahora el patrón compuesto usa reemplazo validado en construcción y checkout, conserva opciones compatibles y permite cambiarlas explícitamente. 38 regresiones nuevas en arroces, hamburguesas y pizzas; agente on/off, compras adicionales, destino inexistente, seis DTO simulados y dos controles de abreviatura real. Foco 289/289; TypeScript general/build OK; Node 92/92; global 15.815/15.815, 190 suites, 488 hashes congelados, sin reintentos.

Límite importante: «quita el de costilla y dame el combo con medio broaster y up» ahora conserva y pide aclaración; todavía no resuelve automáticamente los nombres incompletos. Siguiente: resolver referencias por familia y opciones del catálogo, sin alias globales injustificados; después impedir afirmaciones de dirección confirmada no respaldadas por estado.

Evidencia: [tanda 107](whatsapp-compound-replacement-validation-2210.md). Sin API pagada, WhatsApp ni órdenes externas. Main intacto. Desplegado y verificado en staging el 22/10 a las 14:13 Bogotá: código 319c7ab4, imagen 399569af…, running/healthy, 0 reinicios, health OK/DB connected/circuit CLOSED. Incluye tandas 106 y 107. Rollback rollback-before-319c7ab4; producción conserva imagen 1d512d0c… y Main intacto.

## VIGENTE — tanda 106: auditoría de chats y categoría antepuesta (22/10)

Base d1020db1, staging. Revisadas tandas 101–105 frente a chats recientes: dirección numerada con referencia, ejecutivos duplicados, opción compartida entre combos y consulta de sopa con carrito. Se añaden 16 comprobaciones: dos formas de pregunta en tres menús y ambos modos (12), dirección exacta del chat en routing/checkout (4). Baseline 253/255: «postre de que tienes hoy» falla en ambos modos. Corrección general en findAskedCategory: reconoce categoría real antes de «de qué tienes». Foco 255/255, TypeScript general/build OK, Node 92/92; global 80 + 15.697 = 15.777, 189 suites (inventario exacto), 487 hashes congelados, sin reintentos.

Detalle y límites: [auditoría 22/10](whatsapp-chats-2210-audit.md). Sin inferencia, mapas reales, WhatsApp ni órdenes externas. Cambio local validado para publicar en staging; sin despliegue nuevo ni promoción a Main. Staging activo verificado al inicio: 32e7f2ac, tanda 105.

Siguiente: reproducir sustitución costillas → medio pollo broaster conservando 7up y quitando el anterior; probar afirmación «dirección confirmada» después de fallo de geocodificación, contrastada con estado y DTO. No declararlos corregidos por el resultado final del chat. Mantener los pendientes de tanda 104 sobre selección numérica del combo.

## VIGENTE — tanda 105: «¿de qué sopa hay?» lista la categoría aunque haya un plato en el carrito (22/10)

Base bf111ad1, staging. Chat real en staging: con 1 Pollo Broaster en el carrito, «de que sopa hay?» respondió la ficha del pollo («Ya lo tienes en el carrito»). Causa: con agente la pregunta llegaba al modelo antes del listado de Nest; además «quiero saber de que sopa hay…» se descartaba por empezar con «quiero» (sin agente salía «No tenemos productos de quiero una sopa») y las categorías fuera de la lista fija (p. ej. Postres) caían en «Eso no lo resuelvo por este chat». Sin el arreglo fallan 28/63.

63 regresiones nuevas (whatsapp-category-question-cart.spec.ts) con tres menús sintéticos (Sopas, Jugos, Postres) y un plato en el carrito, agente on/off: «de qué X hay?», «qué Xs tienen», «y de qué Xs hay?», «si pero quiero saber de qué X hay quiero una X», «quisiera saber…», «qué Xs venden?», «qué tienen de Xs?» listan toda la categoría sin tocar el carrito; elegir tras el listado agrega junto al plato; contrastes: pedir un producto de la categoría lo agrega, una categoría inexistente no lista nada, y una pregunta sobre el plato del carrito no responde con la categoría. Sonda con el catálogo real: el chat completo (incluido «me das un ajiaco y un mondongo pequeño») sale bien en ambos modos.

Arreglo general: gancho previo al agente y a answerMenuWithNest (ambos modos) para preguntas de categoría resueltas por resolveCatalogQuestion o findByCategory; «quiero/quisiera saber» ya no cuenta como pedido; findAskedCategory reconoce la palabra preguntada contra los nombres reales de categoría del menú (singular o plural) y lista esa categoría; randomAsideLabel no la toma como consulta ajena.

Validación: foco 732/732 (13 suites); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (487): 80/80; fase 2 primera corrida 15678/15680 con 2 timeouts de 5 s en part-06 (retransmisión) por carga alta (aislados ~1.2 s con el cambio y ~1.3 s sin él), repetida completa 15680/15680, unión = inventario 188, 489 s. Commit 32e7f2ac desplegado solo en staging (imagen aaa198cd…, health OK 17:56Z, 0 reinicios, rollback rollback-before-32e7f2ac); producción 1d512d0c… intacta (Main 54c057b5, tandas hasta 94). Evidencia: docs/whatsapp-category-question-agent-validation-2210.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: tandas 95–105 solo en staging hasta nueva promoción a Main; elegir el combo por número pone la primera bebida; «que tienen en <categoría de varias palabras>» sigue sin reconocerse si la palabra no coincide; pendientes anteriores sin cambio.

## VIGENTE — tanda 104: «¿lleva bebida?» muestra todos los combos relacionados (22/10)

Base 18d8f87a, staging. Chat real en staging: al preguntar si el arroz chino llevaba bebida se ofreció solo el combo del mismo plato y no el otro combo de arroz chino con bebida. Causa: el filtro sameDish de la tanda 99. Además, al pasar al combo propio se volvía a preguntar la opción ya elegida (Pollo: Broaster). Sin el arreglo fallan 24/36.

36 regresiones nuevas (whatsapp-related-combo-offer.spec.ts) con tres menús sintéticos (arroz, hamburguesa, salchipapa), agente on/off: lista el combo propio primero y el otro también; el nombre de la bebida y «sí» toman el combo propio y conservan la opción del plato (con «sí» solo pregunta la bebida); el número del otro combo lo reemplaza; «no» deja el plato; contraste: un plato sin un único combo propio no cambia con un «sí» suelto. Se actualizó la prueba de la tanda 99 que exigía ocultar el otro combo.

Arreglo general: combos relacionados = familia del catálogo + combos «<base del plato> con …» (la base es el nombre antes de «con»; «Combo Arroz Paisa» no entra para arroz chino); el combo del mismo plato va primero como preferredId; las opciones del plato que el combo también ofrece se conservan. Revertido: atender el número dentro del manejador rompía 128 pruebas de aceptación de precio; el número sigue por la selección genérica (elige la primera bebida, pendiente conocido).

Validación: foco 2919/2919 (45 suites); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (486): 80/80; fase 2 primera corrida 15614/15617 con 3 timeouts de 5 s en part-03 por carga alta (aislados 2.0–2.6 s, igual que sin el cambio), repetida completa 15617/15617, unión = inventario 188, 613 s con carga ~6. Commit a31c376b desplegado solo en staging (imagen d71cef9b…, health OK 17:28Z, 0 reinicios, rollback rollback-before-a31c376b); producción 1d512d0c… intacta (Main 54c057b5, tandas hasta 94). Evidencia: docs/whatsapp-related-combo-offer-validation-2210.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: tandas 95–104 solo en staging hasta nueva promoción a Main; elegir el combo por número pone la primera bebida; la nota «con medio broaster y up» del chat (escrita por el agente) no se revisó; pendientes anteriores sin cambio.

## VIGENTE — tanda 103: «… en combo con ginger los dos» y cambiar la gaseosa de los dos combos (22/10)

Base 86a6a933, staging. Chat real en staging: «me das un pollo frito y uno broaster en combo con ginger los dos» respondía «Por ahora no manejamos: dos» y solo el segundo combo quedaba con Ginger; luego «nada mas pero quiero que la gaseosa de los dos combos sea ginger» listaba gaseosas sueltas. Al generalizar apareció un bug previo: «una X y una Y con <opción>» se fundía en un solo ítem (la cláusula del segundo plato se tomaba como bebida del primero) y se perdía un plato. Sin el arreglo fallan 34/59.

59 regresiones nuevas (whatsapp-shared-line-option.spec.ts): tabla de sharedOrderModifier (6 positivos, 5 negativos: «para los dos», sin modificador, un solo ítem, conteo que no coincide); tres menús sintéticos (hamburguesas con bebida, pizzas con borde, salchipapas con salsa), agente on/off: «… con X las dos» y «…, ambas con X» aplican la opción a ambos; «X y Y con opción» conserva ambos platos; cada plato conserva su opción; seguimiento «la gaseosa/el borde/la salsa de las dos …» cambia ambas líneas; con «nada más pero …» pasa al checkout. Contrastes: «los tres» con dos líneas no cambia nada; una línea sin esa opción no se toca.

Arreglo general: sharedOrderModifier quita el marcador distributivo (si su conteo coincide con los ítems) y el modificador compartido se suma a las opciones de cada línea; una cláusula que nombra otro plato no se pliega como bebida de la línea anterior; tryApplyOptionToAllCartLines (antes del agente) cambia una opción en todas las líneas que la ofrecen.

Validación: foco 2691/2691 (44 suites); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (485) 80/80 + 15581/15581, unión = inventario 187, 570 s (118 + 452), sin reintentos. Commit 72b26624 desplegado solo en staging (imagen bc99f7d5…, health OK 16:49Z, 0 reinicios, rollback rollback-before-72b26624); producción 1d512d0c… intacta (Main 54c057b5, tandas hasta 94). Evidencia: docs/whatsapp-shared-line-option-validation-2210.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: tandas 95–103 solo en staging hasta nueva promoción a Main; «X en combo con Y y Z en combo con Y» escrito ítem por ítem todavía no siempre arma ambos combos (el parser funde segmentos con «en combo»); pendientes anteriores sin cambio.

## VIGENTE — tanda 102: productos en dos categorías listados dos veces y «un ejecutivo» empatado (22/10)

Base e9140594, staging. Chat real en staging: «… me das un ejecutivo» respondía «Pediste 1. ¿Cuál prefieres?» con las dos variantes repetidas (4 opciones). Causa: el catálogo real tiene 4 productos en dos categorías y getMenuProducts los agregaba una vez por categoría (el fixture no tiene categorías, por eso no lo veían las pruebas). Además, con agente apagado, «un ejecutivo» agregaba la primera variante empatada sin preguntar; «ola buenas tardes me das …» no contaba como pedido explícito; y «Pediste 1» salía con cantidad 1. Sin el arreglo fallan 29/48.

48 regresiones nuevas (whatsapp-shared-category-products.spec.ts) con tres menús sintéticos (almuerzos, hamburguesas, wraps) cuyos productos están en dos categorías: catálogo sin duplicados con ambas categorías, navegación por la segunda categoría, disponibilidad si está disponible en alguna; agente on/off: saludo + pedido lista cada opción una vez, elegir «2» toma esa opción, nombrar la variante la agrega directo, «quiero 2 …» sigue diciendo «Pediste *2*»; agente off: la palabra sola pregunta.

Arreglo general: getMenuProducts deja un producto por id con categoryNames; navegación, agrupación, menú para IA y conceptos usan todas las categorías; empate en el primer puntaje lista los empatados; el pedido explícito ignora saludos iniciales; «Pediste *N*» solo con N > 1.

Validación: foco 8816/8816 (35 suites); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (484) 80/80 + 15522/15522, unión = inventario 186, 542 s (112 + 430), sin reintentos. Commit ffee0370 desplegado solo en staging (imagen c2724b10…, health OK 16:28Z, 0 reinicios, rollback rollback-before-ffee0370); producción 1d512d0c… intacta (Main 54c057b5, tandas hasta 94). Evidencia: docs/whatsapp-shared-category-products-validation-2210.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: tandas 95–102 solo en staging hasta nueva promoción a Main; «que tienen en <categoría de varias palabras>» no encuentra la categoría (sí con el nombre solo); pendientes anteriores sin cambio.

## VIGENTE — tanda 101: direcciones con referencia («…, frente al parque») y número con espacios sueltos (22/10)

Base 795efddf, staging. Chat real: tras «a una nueva», una dirección numerada escrita con letras separadas y seguida de «, frente al parque» respondía «No pude identificar con seguridad ese conjunto o lugar». Causa: la referencia y el número sin normalizar llegaban a Google, que devolvía partial_match, y el validador de vía numerada lo rechazaba. Sin el arreglo fallan 23/68 (baseline parcial).

68 regresiones nuevas (whatsapp-address-reference.spec.ts): tabla de normalización (20 positivos, 8 negativos), tabla de referencias (13 separaciones, 8 sin separar), separación en orden y etiqueta, routing con Google simulado (puerta distinta y partial rechazados; zona en otra posición aceptada) y E2E agente on/off con tres direcciones sintéticas («…, frente al parque», «… al lado de la droguería», «…, portón negro, timbre 2»). Contraste: un punto de referencia solo («frente al parque principal») sigue siendo el destino y va entero a Maps.

Arreglo general: splitAddressReference separa referencias (frente a, al lado de, junto a, cerca de, diagonal a, detrás de, a N cuadras, esquina, portón/fachada de color, timbre, llamar al llegar, referencia) solo si antes hay vía numerada o lugar nombrado; canonicalStreetAddress normaliza «calle 38 sur 72 j 15» → «Calle 38 Sur # 72J-15»; la geocodificación consulta primero la vía canónica sin referencia y compara vía + zonas como conjunto; partial_match y otra puerta se siguen rechazando. La dirección guardada queda como la escribió el cliente; la orden muestra « / Ref: …» y la etiqueta « · Referencia: …».

Validación: foco 1296/1296 (30 suites); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (482) 80/80 + 15474/15474, unión = inventario 185, 532 s (108 + 424), sin reintentos. Commit 7c2ef0f8 desplegado solo en staging (imagen 76428d15…, health OK 15:44Z, 0 reinicios, rollback rollback-before-7c2ef0f8); producción 1d512d0c… intacta (Main 54c057b5, tandas hasta 94). Evidencia: docs/whatsapp-address-reference-validation-2210.json. Sin llamadas pagadas (Google simulado), WhatsApp ni órdenes externas.

Pendiente: tandas 95–101 solo en staging hasta nueva promoción a Main; el harness no aplica customerLocationLabel; pendientes anteriores sin cambio.

## VIGENTE — tanda 100: chat real de combo con arepas, ubicación y nombre repasado; «¿las arepas se pueden fritas?» (22/10)

Base f9e13b33, staging. Chat real del 21/10 15:06 (producción antes de promover Main) repasado con el router actual y la carta real: ya corregidos «2 que esté fría porfavor» (tanda 95) y todo el checkout — el nombre tras ubicación + referencia queda como nombre, el domicilio sigue en $2.000 y «Porque le sube 5…» / «No entiendo porque sube todo eso» se explican y no se guardan como nombre (8ba56bc3, ya en Main/producción). Regresión encontrada: «Las arepas se pueden fritas ?» agregaba una «Porcion De Arepas (Fritas)» aparte sin agente y no hacía nada con agente; la producción vieja cambiaba la opción del combo. Sin el arreglo fallan 18/48.

48 regresiones nuevas (whatsapp-cart-option-possibility.spec.ts): combo con arepas + porción de arepas, hamburguesa con pan + pan aparte, pasta con salsa + salsa extra; agente on y off. Contrastes: en checkout se aplica y se repite el paso; opción ya elegida se confirma; opción fuera de la carta no se escribe; compra aparte no edita el plato; dos líneas con esa opción no cambian ambas.

Arreglo general: tryHandleCartOptionPossibility (antes del agente, ambos modos): una pregunta de posibilidad («se puede(n) / puede(n) ser / puede venir / podría(n)…») que nombra un atributo y una de sus opciones de exactamente una línea del carrito cambia esa opción en su sitio; palabras de compra (quiero, dame, agrega, otra, porción, aparte, extra, números), opciones ambiguas o desconocidas siguen por los otros caminos.

Validación: foco 3647/3647 (59 suites); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (481) 80/80 + 15406/15406, unión = inventario 184, 435 s, sin reintentos. Commit 61df5207 desplegado solo en staging (imagen 7af799e4…, health OK 05:27Z, 0 reinicios, rollback rollback-before-61df5207); producción 1d512d0c… intacta (Main 54c057b5, tandas hasta 94). Evidencia: docs/whatsapp-cart-option-possibility-validation-2210.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: tandas 95–100 solo en staging hasta nueva promoción a Main; «un pollo frito … ese viene con papa francesa?» lista versiones sin responder sí/no; pendientes anteriores sin cambio.

## VIGENTE — tanda 99: «¿Ese viene con gaseosa?» sobre el plato del carrito y respuestas a la oferta de combo (21/10)

Base 3ad5f4ec, staging. Chat real: tras «Listo ✅ <plato>», «¿Ese viene con gaseosa?» respondió ingredientes de las gaseosas y dejó una elección pendiente; el siguiente mensaje cambió al combo por casualidad. Causa: el manejador de bebida incluida solo quitaba «ese» si lo seguía un espacio, así que «ese» quedaba como sujeto, no encontraba producto y entraba la ficha de composición. Además: «y eso trae bebida?» caía en el atajo «eso trae …» (ficha del plato); ya mostrada la oferta, «sí» volvía a preguntar, «dale» pasaba al checkout sin cambiar, «no gracias» cambiaba al combo con agente, «sprite» no hacía nada y «una gaseosa 1.5 litros» cambiaba al combo con la primera bebida; familias con varias proteínas ofrecían el combo de otro plato y la bebida dicha se perdía; el glosario duplicaba «litros». Sin el arreglo fallan 64/77.

77 regresiones nuevas (whatsapp-cart-line-drink-combo.spec.ts): arroz + combo (Bebida), hamburguesa + combo (atributo Gaseosa), plancha + combo (bebidas con jugos); agente on y off. Contrastes: combo ya en el carrito no se vuelve a ofrecer; sin combo en la carta no hay oferta ni ingredientes; «no gracias» y luego «1» no cambia; familia con combo de otro plato ofrece solo el del mismo plato; opciones de bebida prueban bebida, no gaseosa; el glosario respeta la unidad escrita.

Arreglo general: demostrativos sueltos no son sujeto (vuelve al último producto confirmado) y el atajo de composición omite objetos de bebida. La oferta conserva solo combos cuyo nombre contiene el plato completo, lista las bebidas a elegir y corrige el género. tryAnswerComboSwapOffer (antes del agente, ambos modos) resuelve la oferta de un combo: rechazo deja la línea; una opción de bebida reemplaza con esa bebida; sí / «mejor el combo» pregunta la bebida conservando el reemplazo; una bebida con tamaño igual al del combo entra al combo; otra bebida con tamaño de la carta se agrega aparte con la marca como nota. drinkInclusion no cambia (un primer intento que contaba marcas como gaseosa renumeraba listas; revertido sin tocar la aserción existente).

Validación: foco 2087/2087 (34 suites); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (480) 80/80 + 15358/15358, unión = inventario 183, 497 s, sin reintentos. Commit 9e9697b4 desplegado solo en staging (imagen 9a5088b5…, health OK 01:05Z del 22/10, 0 reinicios, rollback rollback-before-9e9697b4); producción 1d512d0c… intacta. Evidencia: docs/whatsapp-cart-line-drink-combo-validation-2110.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: elegir el combo por número sigue llenando la primera bebida por defecto; con varios combos candidatos la bebida dicha no se aplica; «déjame 2 combos»; «mejor dos combos y una limonada»; anuncios vs acción aplicada; customerLocationLabel en el harness; evaluar modelo real con presupuesto registrado.

## VIGENTE — tanda 98: totales inventados por el agente y «cuánto llevo / cuánto vamos» (21/10)

Base cdec703c, staging. Sonda con el router real y agente simulado: las respuestas respaldadas por acciones ya se reconstruían desde el carrito y las preguntas de precio eran deterministas. Salió mal: texto libre del modelo con un total equivocado («Listo, el total es $99.000», «Llevas $10.000 en total», «Jaja, por cierto el total es $99.000») se reenviaba en la ruta principal y en la rama de tema ajeno, incluso con carrito vacío; «cuanto llevo», «cuánto vamos?» y «y cuánto llevo hasta ahora?» no se leían como pregunta por el total (la última preguntaba «¿De cuál producto…?» o reenviaba el total del modelo). Sin el arreglo fallan 27/100.

100 regresiones nuevas (whatsapp-agent-total-claims.spec.ts): combo de pollo + limonada, pizza + gaseosa, roll + jugo; agente on y off. Contrastes: un total correcto del agente se conserva; mencionar el precio de un producto («sale en $6.000») no es un total; «cuanto vale <producto>» sigue respondiendo el precio; «cuánto llevo esperando?», «cuanto se demora» y «cuánto vale el domicilio» no son preguntas por el total; carrito vacío.

Arreglo general: statedOrderTotals extrae montos que la respuesta presenta como total del pedido; misstatesOrderTotal los compara con el subtotal del carrito y subtotal + domicilio. Si no se aplica ninguna acción y algún total no coincide, la ruta principal vuelve a reglas (agent_misstated_total) y la rama de tema ajeno usa su respaldo. isCartChargeQuestion acepta «(y/entonces/bueno/ok) cuánto llevo/llevamos/vamos/voy/va/van (en total/hasta ahora/por ahora/hasta el momento) (porfa)» y muestra el carrito.

Validación: foco 441/441 (5 suites); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (479) 80/80 + 15281/15281, unión = inventario 182, 518 s, sin reintentos. Commit 6b503525 desplegado solo en staging (imagen 459d2b7a…, health OK 23:13Z, 0 reinicios, rollback rollback-before-6b503525); producción 1d512d0c… intacta. Evidencia: docs/whatsapp-agent-total-claims-validation-2110.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: «déjame 2 combos» sigue sumando (ambiguo); «mejor dos combos y una limonada» suma en vez de rehacer el pedido; anuncios que difieren de la acción aplicada (dice 3, aplica 2) aún no se comparan; el harness no aplica customerLocationLabel en reply(); evaluar modelo real con presupuesto registrado.

## VIGENTE — tanda 97: respuestas del agente que anuncian cambios no aplicados y «déjalo en N» (21/10)

Base 451dc866, staging. Auditoría pendiente de la tanda 96: agente simulado que anuncia «agregué / quité / cambié / actualicé / eliminé / añadí / lo dejé en 2» con y sin acciones, 8 tipos de mensaje (gracias, charla, horario, demora, parqueadero, risa, tercera persona) en building_cart, awaiting_name, awaiting_payment y awaiting_final_confirm (288 combinaciones). Salió mal: en building_cart la ruta principal reenviaba «cambié la cantidad a 3», «quité…», «actualicé…», «eliminé…» sin ninguna acción (solo «agregué» volvía a reglas), y la rama de tema ajeno reenviaba «ya lo dejé en 2» en todos los estados. Durante la auditoría apareció otro defecto: «déjalo en 2 combos», «ponlo en 3…», «cámbialo a 2…» y «mejor 2 combos» sumaban unidades (1 → 3) con y sin agente; «mejor 2 limonadas naturales» no encontraba la línea por el plural. Sin el arreglo fallan 66/156.

156 regresiones nuevas (whatsapp-unapplied-claims-quantity.spec.ts): combo de pollo + limonada, pizza + gaseosa, roll + jugo; agente on y off (el modelo legado devuelve el mismo anuncio). Contrastes: un retiro respaldado por la acción se confirma; «déjalo en 3» con dos líneas pregunta cuál; «mejor N» de un producto que no está en el carrito no corrige cantidad; «mejor N … y …» no es corrección de una línea; «¿Te lo agrego?», «Te dejo el menú arriba» y «¿Quieres cambiar algo?» no son anuncios.

Arreglo general: replyClaimsCartChange se comparte entre la rama de tema ajeno y una nueva guarda de la ruta principal: si la respuesta anuncia un cambio de carrito y no se aplica ninguna acción, vuelve a reglas (agent_claimed_change_without_actions). parseCartQuantityCorrection lee «déja/pon/cambia + lo/la/los/las + en/a + N + producto»; el manejador lee «mejor N <producto>» solo si coincide exactamente una línea del carrito y «déjalo en N» con una sola línea; el plural quita «-es» tras vocal + l/r/n/d/j.

Validación: foco 10004/10004 (46 suites); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (478) 80/80 + 15181/15181, unión = inventario 181, 513 s, sin reintentos. Commit 5b2467a0 desplegado solo en staging (imagen e6a31140…, health OK 22:59Z, 0 reinicios, rollback rollback-before-5b2467a0); producción 1d512d0c… intacta. Evidencia: docs/whatsapp-unapplied-claims-quantity-validation-2110.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: «déjame 2 combos» sigue sumando (ambiguo); «mejor dos combos y una limonada» suma en vez de rehacer el pedido; anuncios que difieren de la acción aplicada (dice 3, aplica 2) aún no se comparan; el harness no aplica customerLocationLabel en reply(); evaluar modelo real con presupuesto registrado.

## VIGENTE — tanda 96: pregunta del monto a pagar y respuestas del agente que anuncian cambios no aplicados (21/10)

Base a635aa00, staging. Hueco pendiente de un chat real anterior (agente encendido): en checkout «Te transformo 57.000?» (preguntaba si transfería el total) terminó con «Listo, agregué <combo de ese precio>». Reproducido con el router real: randomAsideLabel lo toma como tema ajeno y esa rama reenviaba la respuesta del agente aunque anunciara un cambio de carrito que no se aplicó (el carrito no cambiaba, pero el cliente leía «agregué»); sin agente respondía «Eso no lo resuelvo por este chat» y «te transfiero 57.000» solo repetía el menú de pago. Sin el arreglo fallan 45/85.

Auditado sin cambio: el pedido directo llena opciones con la primera por diseño (fillDefaultAttributes las muestra para cambiarlas); el pin crudo en la explicación del domicilio solo aparece en el harness (reply() de producción ya usa customerLocationLabel); nombres que empiezan por palabra de lugar («Santa Maria Lopez», «Kennedy Rojas») siguen siendo ambiguos con barrios reales y «Ana Villa» ya es nombre.

85 regresiones nuevas (whatsapp-payment-amount-check.spec.ts): combos de pollo, pizzas, rolls de sushi, cada uno con un producto que cuesta exactamente el total con domicilio; agente on y off, ambos simulando el error del chat real. Contrastes: monto distinto se corrige con el total real; «pago con 100.000» y un monto suelto no se interceptan; carrito vacío no responde total; recoger no suma domicilio; una respuesta inofensiva del agente a un tema ajeno se conserva.

Arreglo general: parsePaymentAmountQuestion (verbo de pago + monto, o «son/serían/total + monto?»; 57.000 / 57,000 / 57000 / 57 mil / $) se responde antes del agente y de la ruta legada con el total y su desglose («Sí, el total es…» o «El total del pedido es …, no …»), y en el paso de pago, si la transferencia está habilitada, indica escribir *transferencia*. La rama de tema ajeno nunca reenvía una respuesta que anuncie agregar, quitar o cambiar.

Validación: foco 11303/11303 (72 suites); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (477) 80/80 + 15025/15025, unión = inventario 180, 513 s, sin reintentos. Commit 389bfcf5 desplegado solo en staging (imagen 261cb109…, health OK 22:33Z, 0 reinicios, rollback rollback-before-389bfcf5); producción 1d512d0c… intacta. Evidencia: docs/whatsapp-payment-amount-check-validation-2110.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: auditar otras rutas que reenvían texto del agente distinto de las acciones aplicadas; el harness no aplica customerLocationLabel en reply(); «2 y una coca cola» con opción abierta es ambiguo; evaluar modelo real con presupuesto registrado.

## VIGENTE — tanda 95: opción abierta por número con nota de servicio (21/10)

Base 8bfd833f, staging. Antes de esta tanda, por pedido del usuario, staging (tandas hasta 94) se fusionó en Main (54c057b5, árbol idéntico a staging validado) y se desplegó en producción: ppp_nest_api imagen 1d512d0c…, health OK/DB connected/circuit CLOSED 21:52Z, 0 reinicios, rollback ppp-nest-api:rollback-before-54c057b5 (bf4596b2…), compose productivo intacto, módulos WhatsApp compilados idénticos a staging. Evidencia: docs/whatsapp-main-promotion-2110.json.

Hueco pendiente del chat real de la tanda 94: con una opción abierta, «2 que esté fría porfavor» no elegía la bebida (el modelo real sí). Reproducido con el router real con 3 y 9 opciones: un número seguido de texto era inválido; con agente se delegaba (respuesta genérica), sin agente se volvían a pedir las opciones. «la 3 bien fría», «4, sin hielo por favor» y «2 por favor» fallaban igual; «Manzana bien fría» perdía la nota sin agente y no se elegía con agente. Sin el arreglo fallan 34/79.

79 regresiones nuevas (whatsapp-option-index-note.spec.ts): combo de pollo (arepas + 7 bebidas), hamburguesa con término primero (término + gaseosa), desayuno con bebida caliente (huevos + bebida); agente on y off. Contrastes: número fuera de rango no elige; «la 2 viene fría?» es pregunta; número seguido de otra opción no se lee como número con nota; una temperatura que es opción («Fría», «Helada», «Frío») se elige sin repetirla como nota; en el primer paso «2 por favor» se comporta igual que «2».

Arreglo general: splitOptionIndexAnswer y trailingServingNote (whatsapp-kitchen-preference.ts). absorbPendingOptionAnswer resuelve el número en el paso actual si está en rango y el resto es nota de servicio o de cocina sin dígitos ni nombres de opción (o solo cortesía), guarda la nota en la línea y pasa el número al flujo de opción pendiente; nombre de opción con temperatura final conserva la nota salvo que la temperatura sea una opción.

Validación: foco 9104/9104 (37 suites); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (476) 80/80 + 14940/14940, unión = inventario 179, 489 s, sin reintentos. Commit 3fba4ce0 desplegado solo en staging (imagen 11ae84cf…, health OK 22:11Z, 0 reinicios, rollback rollback-before-3fba4ce0); producción 1d512d0c… intacta. Evidencia: docs/whatsapp-option-index-note-validation-2110.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: pedido directo llena todas las opciones por defecto y desde lista pregunta la restante; la explicación del domicilio muestra el pin crudo; nombres de dos palabras con segunda palabra de lugar («Ana Villa») o que empiezan por palabra de lugar; «2 y una coca cola» con opción abierta es ambiguo; «Te transformo 57.000?» con agente; evaluar modelo real con presupuesto registrado.

## VIGENTE — tanda 94: nombres fuera de la dirección, pin con referencia y explicación del domicilio (21/10)

Base 6979a62a, staging. Chat real de staging (domicilio, agente encendido; datos personales no copiados). Salió bien: lista de la familia con descripciones, elección por número, bebida con nota «que esté fría», cambio de arepas, cierre con «así está bien gracias», pin cotizado por ruta, pago en efectivo, confirmación y respuesta de tiempo. Salió mal: un nombre completo cuyo último apellido es palabra de lugar («… Torres») se guardó como dirección y subió el domicilio de 2.000 a 5.000 mientras se volvía a pedir el nombre; «Agrupación bosques de Castilla» después del pin reemplazó el pin; «¿por qué sube el domicilio…?» recibió la pregunta del nombre y «No entiendo porque sube todo eso» quedó como nombre. Causa común reproducida: «torres», «plaza», «iglesia», «san X», «santa» y las zonas de cobertura cuentan como lugar en cualquier posición; el atajo del agente lo vuelve set_address y con una opción abierta lo toma la ruta determinista. Sin el arreglo fallan 57/85.

85 regresiones nuevas (whatsapp-checkout-name-pin-fee.spec.ts): pollo (combo con dos opciones), pastas (tamaño y salsa), mariscos (picante y acompañante); modo distancia simulado; agente on (con el atajo set_address del agente) y off. Contrastes: una calle con número después del pin lo reemplaza y recotiza; el conjunto sin pin sigue siendo la dirección; «¿cuánto es el total?» no es pregunta de domicilio; «Torres del Parque», «Conjunto Torres de Castilla», «San Martin», «Plaza de las Americas», «Castilla reservado», «Hospital de Kennedy» y «Santa Isabel» siguen siendo lugares.

Arreglo general: looksLikePersonNameNotPlace (2–4 palabras solo letras, sin preposiciones/artículos/sustantivos de dirección, primera palabra que no es cabeza de lugar ni zona, palabra de lugar después) bloquea looksLikeAddressOnlyMessage, los detectores de landmark de isPlausibleDeliveryAddress / looksLikeAddressReplacement y el rechazo de nombre. Un pin confirmado conserva coordenadas y tarifa y agrega el conjunto o landmark como referencia («Anoté la referencia … junto a tu ubicación»), salvo calle con número. isDeliveryFeeChangeQuestion responde con la dirección anotada, km de ruta y valor (o tarifa fija) y repite el paso abierto.

Validación: foco 2602/2602 (43 suites; el primer foco falló 3 casos de «Portería nuevo sol», arreglado agregando palabras de acceso); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (475) 80/80 + 14861/14861, unión = inventario 178, 501 s, sin reintentos. Commit 8ba56bc3 desplegado solo en staging (imagen 28d5ebc7…, health OK 21:47Z, 0 reinicios, rollback rollback-before-8ba56bc3); producción bf4596b2… intacta. Evidencia: docs/whatsapp-checkout-name-pin-fee-validation-2110.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: con agente simulado «2 que esté fría porfavor» no elige la bebida (el modelo real sí); pedido directo llena todas las opciones por defecto y desde lista pregunta la restante; la explicación muestra el pin crudo; nombres de dos palabras con segunda palabra de lugar («Ana Villa») o que empiezan por palabra de lugar; nota que repite opciones; «Te transformo 57.000?» con agente; evaluar modelo real con presupuesto registrado.

## VIGENTE — tanda 93: los lugares con artículo lo conservan en la referencia de domicilio (21/10)

Base d85904a8, staging. Revisando el pendiente de la tanda 92. Baseline con router real y menú sintético, con y sin agente: «Los Almendros» se anotaba como «Almendros», «El Prado» como «Prado», «La Esperanza» como «Esperanza»; «en Villa Clara» quedaba con la preposición; «Me lo envias a La Esperanza» guardaba «Esperanza». No es defecto: «San Telmo», «Santa Inés» y «barrio X» coinciden a propósito con las palabras de barrio y se cotizan como barrio. Sin el arreglo fallan 20/42.

42 regresiones nuevas (whatsapp-delivery-place-article.spec.ts): arepas (calle simple), pastas (tamaño, calle con apto), mariscos (picante, dos unidades, diagonal con torre); agente simulado on/off, clasificador null. Contrastes: el artículo antes de una calle se sigue quitando; «me lo envías a la <calle>» cotiza la calle sin artículo; «al conjunto <nombre>» conserva el conjunto.

Arreglo general: normalizeDeliveryAddress quita «la/el/los/las» inicial solo antes de un sustantivo genérico de dirección (calle, carrera, conjunto, barrio, casa, torre, edificio, misma, que, de…) o de un número; ante cualquier otra palabra es parte del nombre y se conserva. La ruta «Anoté la referencia» y el cambio a domicilio del checkout usan la misma limpieza (sin preposición, con artículo).

Validación: foco 1531/1531 (28 suites); tsc ambos OK; node 92/0; diff --check OK. El primer global falló 3 casos de whatsapp-order-lookup-release.spec.ts («el pedido es para las 7 de la noche» se leía como consulta de estado al conservar «las 7»); se arregló quitando el artículo antes de un número, se recongelaron hashes y se repitió: 80/80 + 14776/14776, unión = inventario 177, hashes 474, 524 s. Commit 3ba7e2fc desplegado solo en staging (imagen 72f55b06…, health OK 21:24Z, 0 reinicios, rollback rollback-before-3ba7e2fc); producción bf4596b2… intacta. Evidencia: docs/whatsapp-delivery-place-article-validation-2110.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: «al <lugar>» sigue perdiendo el «El» del nombre (contracción ambigua); un barrio solo se confirma sin calle (diseño actual); nota que repite opciones ya elegidas; respuesta determinista al «Te transformo 57.000?» con agente; evaluar modelo real con presupuesto registrado.

## VIGENTE — tanda 92: el lugar dicho antes de la calle queda en la dirección (21/10)

Base 6301588c, staging. Pendiente de la tanda 90. Baseline con router real y menú sintético, con y sin agente, pedido para recoger en el pago: «Me lo envias a Villa Clara» y luego «calle 45 # 12-10» dejaba la dirección «calle 45 # 12-10» sin el lugar; lo mismo con «domicilio» → «Villa Clara» («Anoté la referencia: _Villa Clara_») → calle: el bot decía que lo anotaba y lo perdía. Sin el arreglo fallan 24/42.

42 regresiones nuevas (whatsapp-delivery-place-reference.spec.ts): arepas (calle simple), pastas (tamaño, calle con apto), mariscos (picante, dos unidades, diagonal con torre); agente simulado on/off, clasificador null. Contrastes: una calle que ya nombra el lugar no lo repite; «domicilio» sin lugar no agrega nada; volver a recoger borra el lugar.

Arreglo general: campo de sesión pendingDeliveryPlace (nunca se geocodifica solo), igual que pendingDeliveryUnit: lo guardan la ruta «Anoté la referencia» y el cambio a domicilio con lugar del checkout (sin «en/a/al/para/hasta» ni artículo); withDeliveryAddress lo agrega una vez a la siguiente calle explícita («<calle>, <lugar>») salvo que ya lo nombre; la ubicación de WhatsApp lo agrega junto al pin; pasar a recoger o pedir una dirección nueva lo borra.

Validación: foco 1331/1331 (26 suites); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (473) 80/80 + 14734/14734, unión = inventario 176, 478 s, sin reintentos. Commit d5177ef4 desplegado solo en staging (imagen 5ad3270f…, health OK 21:00Z, 0 reinicios, rollback rollback-before-d5177ef4); producción bf4596b2… intacta. Evidencia: docs/whatsapp-delivery-place-reference-validation-2110.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: algunos lugares de dos palabras («San Telmo», «Los Almendros») se cotizan como dirección en vez de anotarse como referencia; nota que repite opciones ya elegidas; respuesta determinista al «Te transformo 57.000?» con agente; evaluar modelo real con presupuesto registrado.

## VIGENTE — tanda 91: platos que empiezan por «arepa» y acompañamientos pedidos solos se agregan directo con agente (21/10)

Base c76dcca0, staging. Pendiente de la tanda 90. Baseline con router real y menú sintético, agente encendido: «quiero una arepa rellena», «quiero 1 arepa rellena», «me das una arepa rellena» y «quiero pedir una arepa rellena» respondían «¿Cuál prefieres?» con el carrito vacío; con un plato de arepa en la carta, «dame arepas fritas» (acompañamiento real) tampoco se agregaba. Causa: isLikelySideOnlyProduct tomaba como acompañamiento cualquier nombre de hasta tres palabras que empezara por «arepa». Sin agente ya funcionaba. Sin el arreglo fallan 26/75.

75 regresiones nuevas (whatsapp-arepa-dish-direct-add.spec.ts): arepa rellena + arepas fritas, arepa de pollo + arepa blanca, arepa mixta + «Arepa»; agente simulado on/off, clasificador null. Contrastes: la arepa simple sigue siendo acompañamiento en el catálogo; una pregunta de precio no agrega; «sin <acompañamiento>» sobre un plato del carrito no agrega el acompañamiento.

Arreglo general: una arepa es acompañamiento solo si después del nombre vienen descriptores de porción simple (blanca, frita, asada, de maíz, sencilla, pequeña, redonda, tela); «Arepa Rellena», «Arepa De Pollo» o «Arepa Mixta» son platos. nestWouldAddDirectDishOrder agrega directo un acompañamiento cuando el mensaje es solo su nombre tras el verbo, la cantidad y «porción de»; «con/sin/y <acompañamiento>» sigue por la ruta existente.

Validación: foco 2533/2533 (39 suites); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (472) 80/80 + 14692/14692, unión = inventario 175, 494 s, sin reintentos. Commit 43cc6838 desplegado solo en staging (imagen b718f82a…, health OK 20:43Z, 0 reinicios, rollback rollback-before-43cc6838); producción bf4596b2… intacta. Evidencia: docs/whatsapp-arepa-dish-direct-add-validation-2110.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: el lugar de «me lo envías a <lugar>» no queda como referencia al llegar la calle; nota que repite opciones ya elegidas; respuesta determinista al «Te transformo 57.000?» con agente; evaluar modelo real con presupuesto registrado.

## VIGENTE — tanda 90: pasar a domicilio un pedido para recoger desde el checkout (21/10)

Base cd916b16, staging. Pendiente de la tanda 89. Baseline con router real y fixture beta, con y sin agente, pedido para recoger en la pregunta de pago: «domicilio», «es a domicilio», «mejor a domicilio por favor», «no, lo quiero a domicilio», «envíamelo» y «Me lo envias a Villa Clara» respondían «¿Cómo pagas?» y el pedido seguía para recoger. Ya funcionaban «me lo traes al barrio Santa Fe» (dirección plausible) y el cambio inverso «mejor paso a recogerlo». Sin el arreglo fallan 48/72.

72 regresiones nuevas (whatsapp-checkout-switch-delivery.spec.ts): arepas (sin opciones), pastas (tamaño), mariscos (picante, dos unidades); agente simulado on/off, clasificador null. Contrastes: un destino cotizable sigue por la ruta directa; «domicilio» en un pedido ya a domicilio conserva la dirección; «¿hacen domicilio?» no cambia el pedido; «contraentrega» sigue eligiendo el pago.

Arreglo general: tryHandleCheckoutSwitchToDelivery (cadena del checkout, antes del cambio de dirección), en pago, confirmación final, nombre o teléfono con pedido para recoger: una petición de domicilio sin dirección («(no/mejor) (lo quiero/es/que sea) a domicilio», «envíamelo/mándamelo/tráemelo», «me lo llevas») pasa a domicilio, borra la dirección y la tarifa de recoger y pregunta «¿A qué dirección te lo llevamos?»; «me lo envías/mandas/traes a <lugar>» con un lugar que no es dirección plausible pasa a domicilio y pide calle y número nombrando el lugar. Preguntas, pedidos ya a domicilio y respuestas de pago no se tocan.

Validación: foco 657/657 (15 suites); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (471) 80/80 + 14617/14617, unión = inventario 174, 452 s, sin reintentos. Commit a5b67b78 desplegado solo en staging (imagen 224625bb…, health OK 20:27Z, 0 reinicios, rollback rollback-before-a5b67b78); producción bf4596b2… intacta. Evidencia: docs/whatsapp-checkout-switch-delivery-validation-2110.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: con agente, «quiero una arepa rellena» va al modelo en vez de agregarse directo («una arepa rellena» sí); el lugar de «me lo envías a <lugar>» no queda como referencia al llegar la calle; nota que repite opciones ya elegidas; respuesta determinista al «Te transformo 57.000?» con agente; evaluar modelo real con presupuesto registrado.

## VIGENTE — tanda 89: nota repetida, opciones del almuerzo al responder la bebida y «cambiar mi dirección» (21/10)

Base 1de0cc06, staging. Fragmento de chat real pegado por el dueño (sin nombre, teléfono ni dirección). Salió bien: el almuerzo quedó con presa, sopa y bebida; domicilio cotizado por distancia; resumen con tipo, nombre, dirección y teléfono; referencia de mapa adjunta. Salió mal: la nota repitió lo mismo con y sin tilde («Limonada sin azúcar, sin azucar»); la dirección guardó la muletilla («Me lo envias a …»); «Quiero cambiar mi direction» en el pago repitió la pregunta de pago. El baseline con router real y fixture beta, con y sin agente, reproduce los tres (dos mensajes en ráfaga dejan «sin azúcar\nsin azucar») y además: al elegir de la lista, en la pregunta de bebida «menudencias» agregaba la sopa como producto aparte y dejaba Ajiaco; «Limonada sin azúcar» perdía la nota; «pierna pernil, menudencias, limonada sin azúcar» dejaba la sopa por defecto; «Ejecutivo broaster, pierna pernil, sopa de menudencias, Limonada sin azúcar» agregaba una limonada aparte (cobro extra) y dejaba la bebida por defecto. Sin el arreglo fallan 60/90.

95 regresiones nuevas (whatsapp-pending-option-extras.spec.ts): almuerzos (porción, sopa, bebida), bowls (base, salsa, bebida), desayunos (huevos, acompañante, bebida); agente simulado on/off, clasificador null; 5 pruebas unitarias de la deduplicación. Contrastes: «y una <producto> aparte» en la pregunta de bebida no cambia la opción; una bebida pedida con artículo sigue siendo producto aparte; «quiero cambiar mi bebida» no es cambio de dirección; notas distintas («sin cebolla, sin tomate») se conservan.

Arreglo general: absorbPendingOptionAnswer, mientras se pregunta una opción, un valor de otra opción llenada por defecto la reemplaza (uno solo, sin artículo, cantidad ni «aparte»), y la nota de una respuesta que resuelve la opción queda en pendingAttribute.answerNote (nunca fuente de cantidad) y se une al agregar; con agente esa respuesta ya no se desvía al modelo. absorbBareDrinkOptionSegments: en pedido multiproducto, una bebida suelta que es opción de un solo plato del mismo mensaje entra en ese plato. dedupeKitchenNoteParts: partes repetidas (sin tilde o contenidas) quedan una vez, conservando la tilde escrita. Cambio de dirección acepta «mi/el»; stripDeliveryAddressPreface quita «me lo envías / me la mandas / nos lo traes a|al|para|en». La primera global falló 6 casos de part-03 (la nota unida perdía la tilde de «harto ají»); se conservó la forma con tilde y se repitió la global.

Validación: foco 3428/3428 (52 suites); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (470) 80/80 + 14545/14545, unión = inventario 173, 454 s, sin reintentos. Commit 868d9bd8 desplegado solo en staging (imagen b1533df4…, health OK 20:04Z, 0 reinicios, rollback rollback-before-868d9bd8); producción bf4596b2… intacta. Evidencia: docs/whatsapp-pending-option-extras-validation-2110.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: «me lo envías a <lugar de dos palabras>» sin calle ni punto conocido se ignora en el pago; «domicilio» en el pago tras recoger por defecto solo repite la pregunta de pago; nota que repite opciones ya elegidas en «<plato> con <adicional> y <bebida>»; «un té verde frío» junto a un plato con opción «Te Verde» se absorbe; nombre corto en lista con comas puede quedarse solo con el adicional; respuesta determinista al «Te transformo 57.000?» con agente; evaluar modelo real con presupuesto registrado.

## VIGENTE — tanda 88: lo que trae el plato del carrito y «una porción de papa con el combo» (21/10)

Base e2ca708f, staging. Cierra los dos huecos que dejó el chat real de la tanda 87. Baseline con router real y fixture beta, con y sin agente, tras pedir el combo broaster: «Ese viene con papa a la francesa ?» mostraba la ficha de la papa; «trae yuca?» la ficha de la yuca; «el combo trae papas?» y «viene con papa salada?» la ficha del combo sin decir sí o no; «Bueno dame una porción de papa con el combo de pollo» reabría la lista de combos. Sin el arreglo fallan 56/84.

84 regresiones nuevas (whatsapp-cart-side-inclusion.spec.ts): combos de pollo («Acompañado con …»), menús de hamburguesa («Incluye …»), platos de pasta («Trae …»); agente simulado on/off, clasificador null. Contrastes: con dos platos un «ese trae X?» suelto queda en el flujo general; una descripción suelta («Con X») no basta para negar; con carrito vacío no se responde como plato del carrito; una referencia que no está en el carrito no usa esta ruta; la pregunta por bebida sigue con su respuesta.

Arreglo general: tryHandleCartSideInclusionQuestion (antes del manejador de bebida incluida, también en checkout) responde «(sujeto) trae/viene con/incluye/lleva X?» sobre el único plato no bebida del carrito, el plato pendiente de opción o el plato nombrado, desde los componentes de la descripción. Sí: «Sí ✅ *Plato* trae …. Viene con …». No solo con una lista enumerada, y ofrece el acompañamiento aparte con precio. Nunca toca el carrito. tryHandleSideForCartLine: «(bueno) dame/quiero/agrega <cant> <acompañamiento> con/para el <plato del carrito>» agrega el único candidato o lista varios («<plato> sigue en el carrito. ¿Cuál quieres aparte?»). La primera global falló 2 casos de part-12 (plato descrito solo «Con arroz» debe decir que el detalle no está confirmado); se exigió lista enumerada para negar y se repitió la global.

Validación: foco 2570/2570 (33 suites); tsc ambos OK; node 92/0; diff --check OK; global en dos fases con hashes congelados (469) 80/80 + 14450/14450, unión = inventario 172, 474 s, sin reintentos. Commit 1a291afc desplegado solo en staging (imagen 34724722…, health OK 19:32Z, 0 reinicios, rollback rollback-before-1a291afc); producción bf4596b2… intacta. Evidencia: docs/whatsapp-cart-side-inclusion-validation-2110.json. Sin llamadas pagadas, WhatsApp ni órdenes externas.

Pendiente: respuesta determinista al «Te transformo 57.000?» con agente (hoy el carrito queda protegido pero responde el modelo); prefijo de familia («quiero un menu hamburguesa») agrega un miembro sin listar; etiquetas iguales para líneas del mismo producto; evaluar modelo real con presupuesto registrado.

## VIGENTE — tanda 87: chat real de staging — fila de lista no es cantidad, «solo pedí un combo» y «cancela, ya lo pedí por llamada» (21/10)

Base 8cbc3616, staging. Chat real pegado por el dueño (sin datos personales). Salió bien: domicilio reconocido; «Un pollo a la Broster en combo» resolvió el combo broaster; la lista de combos de pollo con su contenido; «Coca Cola» cambió la bebida del combo; la ubicación compartida quedó como domicilio con tarifa por ruta. Salió mal: «El combo 2 por fa» en la lista agregó la fila 2 como dos unidades (carrito ×3); tras «8» la respuesta mostró «Bebida: Colombiana» de la línea vieja; «Solo pedí un combo» y «Dame solo el combo de pollo número 2» no bajaron la cantidad (el modelo prometió un combo y el carrito siguió con tres); «Te transformo 57.000?» agregó otro combo por precio (ruta del agente); «Cancela ya lo pedí por llamada» → «No encontré *ya lo pedí por llamada* en tu carrito»; «Cancela el pedido» con una orden telefónica ya registrada dijo que no podía y añadió «No entendí bien tu mensaje»; «Ese viene con papa a la francesa ?» mostró la ficha de la papa en vez del contenido del combo; «dame una porción de papa con el combo de pollo» reabrió la lista de combos. Baseline con router real y fixture beta, con y sin agente, reproduce los seis primeros; con cartas sintéticas además «El combo 2 por fa» sobre la lista de alternativas elegía la fila 1 ×2 y «quiero un combo pollo asado» (nombre exacto) daba «Por ahora no manejamos *pollo asado*». Sin el arreglo fallan 92/108.

108 regresiones nuevas (whatsapp-list-row-count-cancel.spec.ts): combos de pollo, menús de hamburguesa, platos de pasta; agente simulado on/off, clasificador null. Contrastes: un número suelto en la lista sigue siendo una unidad de esa fila; la cantidad disputada que ya coincide no cambia nada; unidades en líneas con opciones distintas se listan sin adivinar; con otro plato en el carrito la disputa queda en las rutas existentes y no agrega nada; con orden registrada y sin carrito del chat, cancelar se rechaza sin «No entendí»; «no canceles el pedido» conserva el carrito.

Arreglo general: tryResolvePendingMatchPick, palabras compartidas por todas las filas más un número («el combo 2», «la opción 3», «combo número 3») eligen esa fila, y si el número nombra la fila elegida no es cantidad (cantidad de la lista o 1). buildCartAddReply describe la línea más nueva del plato. tryHandleOrderedCountDispute (cadena del carrito): «(yo) solo (te) pedí N X», «pedí solo N X», «dame/deja solo el/un X (número K)» cuando todas las líneas son ese plato — una línea toma N; varias se listan sin cambios; una cantidad igual dice que no hay de más; funciona en el checkout y conserva el paso. isCancelIntent acepta «cancela(lo)» con su motivo («ya lo pedí», «ya no lo quiero», «lo pedí por llamada/teléfono»); handleCancelRequest con orden registrada hoy descarta el carrito no enviado del chat y nombra la orden; el rechazo ya no agrega «No entendí». La respuesta de fuera de carta para «quiero un …» se omite si el texto nombra completo un producto. No codifica nombres, productos ni precios.

Validación: 3.518 focalizados (62 suites), TypeScript general/build, 92 Node y diff --check. Global en dos fases: ráfagas 80/80 en 63s; resto 14.366/14.366 en 406s, 170 suites; unión exacta con inventario de 171, 468 hashes intactos, sin reintentos (470s). Total: 14.446 pruebas. Evidencia whatsapp-list-row-count-cancel-validation-2110.json. Cero llamadas pagadas, Meta u órdenes externas. Main intacto.

Desplegado solo staging: runtime bfc822e2cbdc367d4ff2ff6e8b31f1f59b92f154, imagen 64f0a2788e1c8b208c40a8c4bbf2fd25bfc6bc25c3ea468776bd5105b326acbc (arranque 19:00:40Z); running/healthy/cero reinicios; health OK, DB connected/circuit CLOSED a 2026-10-21T19:01:11Z. Producción conserva bf4596b27d048cba46f186d17e49dde9c12644f43bcba7f984c78485a6998af0. Bases, volúmenes y bin/ privado preservados. Rollback ppp-nest-staging:rollback-before-bfc822e2 (imagen 46f7e061…). Commit documental posterior no requiere rebuild.

Límites (siguiente tanda): «Ese viene con papa a la francesa ?» sobre un combo del carrito muestra la ficha de la papa; «dame una porción de papa con el combo» reabre la lista de combos; «quiero un menu hamburguesa» / «quiero un plato pasta» (prefijo de familia) agrega uno en silencio en vez de listar; «Te transformo 57.000?» en la ruta del agente agregó por precio (modelo real no evaluado); una opción única que no es bebida se llena con su primer valor sin preguntar (política existente).

Siguiente prioridad: pregunta de contenido sobre el combo del carrito y acompañante pedido «con el combo»; pedido con prefijo de familia que lista; monto de transferencia que nunca agrega productos. Después evaluación de inferencia real con presupuesto registrado. No declarar vendible por conteos.

## VIGENTE — tanda 86: nota sin plato con varias líneas pregunta cuál («una sin cebolla», «sin cebolla», «la hamburguesa sin cebolla») (21/10)

Base 6ed1ac99, staging. Huecos anotados en las tandas 81 y 85. Baseline con router real, con y sin agente: «una sin cebolla» con dos platos anotaba en silencio la última línea, aunque fuera una Limonada. «sin cebolla» suelto preguntaba «¿A cuál plato le aplico esa nota?» sin dejar nada pendiente: «2» solo mostraba el carrito y «la doble» se buscaba como producto nuevo («No te ofrecemos doble»). «la hamburguesa sin cebolla» con dos hamburguesas respondía «Tienes varias líneas de ese plato…» y contestar «1» o «la clasica» perdía la nota. Con agente, «el perro» respondía «¿Cuál prefieres?»; sin agente agregaba otro perro. Sin el arreglo fallan 72/102.

102 regresiones nuevas (whatsapp-ambiguous-cart-note.spec.ts): hamburguesería, taquería, pizzería; agente simulado on/off, clasificador null. Respuestas por número, nombre corto y nombre completo; bebida en el carrito listada y nunca anotada en silencio; línea de varias unidades separa una. Contrastes: una sola línea recibe «sin X» directo; una línea de dos unidades sigue separando «una sin X» (tanda 85); nombrar el plato con artículo anota esa línea sin preguntar; «las dos sin X» que cubre todas las unidades anota todo sin preguntar; «no apliques esa nota» retira la pregunta; una cantidad mayor al total pregunta sin cambios; en la suite existente, dos líneas del mismo plato con notas distintas conservan la respuesta «varias líneas».

Arreglo general: tryHandleUnscopedCartKitchenNote (orquestador, en la cadena de notas tras la de unidades parciales; dos o más líneas, sin selección pendiente ni pregunta): «(y) (las) (N) (de ellas) sin/poco/poca X» que no nombra una línea ni es opción de un producto del carrito. Si N cubre todas las unidades, anota todas; si las supera, pregunta sin cambios; si no, abre la lista existente pendingSubsetKitchenNote (byUnits). La nota con alcance sobre varias líneas de productos distintos abre la misma lista; con líneas del mismo producto responde nombrando cada línea con su nota. La respuesta a la lista usa uniqueClarificationLine como respaldo, así «la doble», «el perro» o un ordinal resuelven. La pregunta de una unidad dice «¿Cuál producto lleva la nota «X»? (1 unidad)». No codifica nombres, productos ni precios.

Validación: 1.643 focalizados (24 suites), TypeScript general/build, 92 Node y diff --check. Global en dos fases: ráfagas 80/80 en 62s; resto 14.258/14.258 en 403s, 169 suites; unión exacta con inventario de 170, 467 hashes intactos, sin reintentos (468s). Total: 14.338 pruebas. Evidencia whatsapp-ambiguous-cart-note-validation-2110.json. Cero llamadas pagadas, Meta u órdenes externas. Main intacto.

Desplegado solo staging: runtime 73cde653c6e9d04058dd1d319716ce1522544cf0, imagen 46f7e06172d38d56b6385f6fa8ad204e5cc5644eb7bf4e54bbe967b64f65bac4 (arranque 18:36:25Z); running/healthy/cero reinicios; health OK, DB connected/circuit CLOSED a 2026-10-21T18:36:58Z. Producción conserva bf4596b27d048cba46f186d17e49dde9c12644f43bcba7f984c78485a6998af0. Bases, volúmenes y bin/ privado preservados. Rollback ppp-nest-staging:rollback-before-73cde653 (imagen f1afa168…). Commit documental posterior no requiere rebuild.

Límites: líneas del mismo producto que solo difieren por nota u opción se listan con el mismo nombre (el número funciona, el nombre corto es ambiguo); «<plato completo> sin X» sin artículo se toma como compra nueva (previo); con agente no se evaluó el modelo real (simulado).

Siguiente prioridad: plato nombrado sin «de» con agente («quiero una arepa carne»); etiquetas distinguibles para líneas del mismo producto en las listas de selección; después evaluación de inferencia real con presupuesto registrado. No declarar vendible por conteos.

## VIGENTE — tanda 85: nota para algunas unidades deja el resto normal («dos hamburguesas, una sin cebolla») (21/10)

Base bf2467a1, staging. Prioridad pendiente de las tandas 81 y 84 (notas por unidad). Baseline con router real, con y sin agente: «dos hamburguesas clasicas, una sin cebolla» agregaba ×2 con «sin cebolla» en ambas; «3 hamburguesas clasicas, dos sin tomate» ponía la nota en las tres; tras «dos hamburguesas clasicas», «una sin cebolla» anotaba toda la línea ×2 (solo «una de las hamburguesas sin cebolla» o «y la otra normal» la separaban). Con una línea de una unidad, «una sin alcaparras» y «las dos sin alcaparras» mostraban el carrito y perdían la nota: el detector de notas contadas solo conocía una lista fija de ingredientes. Sin el arreglo fallan 46/92.

92 regresiones nuevas (whatsapp-partial-unit-note.spec.ts): hamburguesería, taquería, sopas; agente simulado on/off, clasificador null. Contrastes: con una línea de una unidad, «una sin X» sigue anotando esa línea; «las dos sin X» anota ambas; «una sin X y la otra normal» sigue separando; «una sin X y la otra sin Y» en el mismo mensaje da a cada una su nota; con dos líneas distintas de una unidad no se separa nada (la nota a la última línea, previa, no cambia); una línea que ya tiene nota no se separa con nota implícita; «dos <plato>, tres sin X» no se separa; el parser no toma «una más sin cebolla», «otra sin cebolla», «… adicional» ni «… y otra sin tomate» como separación implícita.

Arreglo general: parsePartialNote devuelve separación implícita para «(y) M (de ellas) sin/poco/poca/bien/extra …»; tryHandlePartialUnitKitchenNote la aplica solo a una única línea sin nota con más de M unidades y si no deja seguir el flujo existente. La expansión de mismo SKU reescribe «N <plato>, (y) M (de ellas) sin/poco/poca …» con M < N ≤ 30 y un solo producto sin opciones como «(N−M) <plato> y M <plato> <nota>». El detector de notas de cocina acepta cualquier ingrediente tras un sujeto contado («una / las dos / ambas / todas … sin X»). No codifica nombres, productos ni precios.

Validación: 1.450 focalizados (22 suites), TypeScript general/build, 92 Node y diff --check. Global en dos fases: ráfagas 80/80 en 62s; resto 14.156/14.156 en 386s, 168 suites; unión exacta con inventario de 169, 466 hashes intactos, sin reintentos (451s). Total: 14.236 pruebas. Evidencia whatsapp-partial-unit-note-validation-2110.json. Cero llamadas pagadas, Meta u órdenes externas. Main intacto.

Desplegado solo staging: runtime c8df9648bc85c3ae2ef55690b3b54ac6553ff9ad, imagen f1afa168f414436cc6e7e17843dcdf28730160e0fcfa2b912bf6c267a30e1ae3 (arranque 18:21:42Z); running/healthy/cero reinicios; health OK, DB connected/circuit CLOSED a 2026-10-21T18:22:12Z. Producción conserva bf4596b27d048cba46f186d17e49dde9c12644f43bcba7f984c78485a6998af0. Bases, volúmenes y bin/ privado preservados. Rollback ppp-nest-staging:rollback-before-c8df9648 (imagen 1009410f…). Commit documental posterior no requiere rebuild.

Límites: con dos líneas distintas de una unidad, «una sin X» sigue anotando la última línea en vez de preguntar (previo); «la hamburguesa sin cebolla» con dos líneas de hamburguesa responde «Tienes varias líneas de ese plato…», redacción mejorable; la separación implícita en el mismo mensaje solo cubre productos sin opciones (con opciones sigue la ruta de variantes distribuidas); con agente no se evaluó el modelo real (simulado).

Siguiente prioridad: nota ambigua con varias líneas (preguntar en vez de anotar la última, redacción más clara); plato nombrado sin «de» con agente; después evaluación de inferencia real con presupuesto registrado. No declarar vendible por conteos.

## VIGENTE — tanda 84: pregunta por una familia de platos lista la familia («qué hamburguesas tienen?», «quiero ver las lasagnas», «arepas») (21/10)

Base 8dbc1754, staging. Hueco anotado en la tanda 82 (con agente, «qué hamburguesas tienen?» mostró el detalle de una sola) y el de palabra de familia arrastrado desde la tanda 41. Baseline con router real: con agente, «qué hamburguesas tienen?» / «qué hamburguesas hay?» mostraban solo «Hamburguesa Pollo» con «¿Te lo agrego?»; sin agente, «tienen hamburguesas?» y «que hamburguesas manejan» igual. «quiero ver las hamburguesas» / «quiero ver las lasagnas» agregaban una al carrito, con y sin agente. Sin agente, «lasagnas» suelto agregaba «Lasagna Vegetal» en silencio y «qué lasagnas tienen?» daba «Eso no lo resuelvo por este chat». «hamburguesas» suelto (doce letras) se tomaba como código de puntos de factura. Sin el arreglo fallan 44/71.

71 regresiones nuevas (whatsapp-family-browse.spec.ts): hamburguesería, pastas, arepería; agente simulado on/off, clasificador null. Siete formulaciones por familia. Contrastes: el número tras la lista pide ese plato; nombrar un plato sigue pidiéndolo (con agente puede ir al modelo); una palabra con un solo producto no es lista de familia; una palabra de categoría («qué bebidas tienen?») sigue respondiendo la categoría; puntos: «A3F9K2M8PQ75», «a3f9k2m8pq75» y «ABCDEFGHJKMN» siguen siendo códigos.

Arreglo general: tryHandleFamilyBrowse (orquestador, antes del rechazo de encargos fuera de carta; sin lista ni opción pendiente y fuera del checkout): «qué/cuáles X tienen/hay/manejan/venden/ofrecen», «tienen/hay/manejan X», «(quiero/puedo) ver las/los X», «muéstrame las/los X» o un plural suelto; si 2–12 productos disponibles tienen esa palabra en el nombre (sin importar singular/plural) y no es palabra de categoría, lista la familia (formatCategoryList) y la deja como lista abierta. Puntos: una palabra suelta de doce letras en minúscula y sin dígito no es código de factura (los impresos van en mayúscula; con mayúsculas o dígito siguen contando). El catálogo expone singularToken. No codifica nombres, productos ni precios.

Validación: 526 focalizados (12 suites), TypeScript general/build, 92 Node y diff --check. Global en dos fases: ráfagas 80/80 en 63s; resto 14.064/14.064 en 376s, 167 suites; unión exacta con inventario de 168, 465 hashes intactos, sin reintentos (439s). Total: 14.144 pruebas. Evidencia whatsapp-family-browse-validation-2110.json. Cero llamadas pagadas, Meta u órdenes externas. Main intacto.

Desplegado solo staging: runtime 38b3548973cb892fb531a24f6fd452bb255939dd, imagen 1009410feeffec59a9c2a17a335b1cfb92ba49d5b346c0c02de1f223f26b6ca9 (arranque 18:05:29Z); running/healthy/cero reinicios; health OK, DB connected/circuit CLOSED a 2026-10-21T18:05:55Z. Producción conserva bf4596b27d048cba46f186d17e49dde9c12644f43bcba7f984c78485a6998af0. Bases, volúmenes y bin/ privado preservados. Rollback ppp-nest-staging:rollback-before-38b35489 (imagen d5766ef7…). Commit documental posterior no requiere rebuild.

Límites: con agente, «quiero una arepa carne» (plato nombrado sin «de») va al modelo en vez de agregarse (previo); con otra lista abierta, la pregunta de familia la atiende la ruta existente de explorar con pendiente (deliberado, sin cambio); familias de más de 12 platos o cuya palabra es también categoría conservan las respuestas existentes de categoría.

Siguiente prioridad: selección parcial ambigua con varias líneas existentes y notas por unidad (pendiente de la tanda 81); plato nombrado sin «de» con agente; después evaluación de inferencia real con presupuesto registrado. No declarar vendible por conteos.

## VIGENTE — tanda 83: «buenos días, uqe me ofreces» es pregunta por la carta (21/10)

Base c4b9ca77, staging. Chat real de staging: «buenos dias, uqe me ofreces» → «¿Qué se te antoja? Escribe el plato o el código.» más el enlace del menú; el dueño reportó que ignoró la pregunta. Baseline con router real: sin agente, «que me ofreces», con saludo, «uqe» o «q» daban el mismo empujón genérico; «qué me ofreces?» daba «Eso no lo resuelvo por este chat»; con y sin agente, «buenas tardes, qe hay de comer» daba «No tenemos productos de comer». «que tienen», «que venden» y «que me recomiendas» ya listaban la carta: el patrón de explorar no aceptaba «me» entre «que» y el verbo. Sin el arreglo fallan 31/68.

68 regresiones nuevas (whatsapp-offer-question-typos.spec.ts): parrilla (carnes + bebida), panadería (pan + café), pescados (pescado + jugo); agente simulado on/off, clasificador null. Ocho formulaciones con saludo y errores de tipeo. Contrastes: un pedido explícito sigue agregando el plato; preguntar por algo que no está en la carta sigue diciendo que no lo hay; el glosario deja igual «q tal», «ok q bien», «el k 2» y un «que me ofreces» ya correcto.

Arreglo general: glosario local, «uqe/qeu/qe/ke/k/q» pasa a «que» solo antes de un verbo de oferta (hay, tienen, tiene(s), ofrece(n/s), sirven, venden, vendes, manejan, recomienda…, sugiere…), con «me/nos/le» opcional. isMenuExploreIntent e isCategoryBrowseQuestion aceptan «me/nos/le» y «ofrece/vendes». unavailableAskReply no responde a una pregunta de explorar carta (con glosario aplicado) ni a un sujeto genérico (comer, comida, almuerzo, cena, desayuno, algo, hoy). No codifica nombres, productos ni precios.

Validación: 253 focalizados (9 suites), TypeScript general/build, 92 Node y diff --check. Global en dos fases: ráfagas 80/80 en 62s; resto 13.993/13.993 en 413s, 166 suites; unión exacta con inventario de 167, 464 hashes intactos, sin reintentos (476s). Total: 14.073 pruebas. Evidencia whatsapp-offer-question-typos-validation-2110.json. Cero llamadas pagadas, Meta u órdenes externas. Main intacto.

Desplegado solo staging: runtime d6fa7a9b49b7d5d8724c58e13428b524974703bf, imagen d5766ef768f65c3d8b4ad947b6788efdcebd5caaf10c71e2cfae66cefe85002c; running/healthy/cero reinicios; health OK, DB connected/circuit CLOSED a 2026-10-21T17:47:31Z. Producción conserva bf4596b27d048cba46f186d17e49dde9c12644f43bcba7f984c78485a6998af0. Bases, volúmenes y bin/ privado preservados. Rollback ppp-nest-staging:rollback-before-d6fa7a9b (imagen c1be4663…). Commit documental posterior no requiere rebuild.

Límites: con agente la pregunta ahora llega al modelo; no se evaluó la respuesta del modelo real (simulado). Errores de tipeo en el verbo mismo («ofreses», «tiens») dependen del emparejamiento difuso existente donde lo hay.

Siguiente prioridad: selección parcial ambigua con varias líneas existentes y notas por unidad (pendiente de la tanda 81); pregunta de familia que elige un producto en vez de listar; después evaluación de inferencia real con presupuesto registrado. No declarar vendible por conteos.

## VIGENTE — tanda 82: varias filas de la lista en un mensaje («1 o 2», «el 1 y el 2», «2 de la primera y 1 de la segunda») (21/10)

Base e6799a5d, staging. Prioridad anotada en las tandas 80–81 (disyunción aislada, «o» frente a «y», cantidad por opción). Baseline con router real: sin agente, «el primero o el segundo» daba «no manejamos: primero o» y perdía la lista; «1 o 2» mostraba el carrito y la perdía; «cualquiera de los dos» daba «no manejamos: dos». Con agente, «1 o 2» sobre una lista de reemplazo iba al modelo y la lista se perdía. «el 1 y el 2» sobre un reemplazo de dos unidades ponía ambas en la primera opción; sobre una lista normal agregaba solo la primera fila. «2 de la primera y 1 de la segunda» daba «no manejamos»; «uno de cada uno» se ignoraba; «1 y 2» respondía «¿Qué se te antoja?». Sin el arreglo fallan 84/90.

90 regresiones nuevas (whatsapp-several-list-rows.spec.ts): bowl (smoothie con fruta), pastas (pizza personal con sabor), arroz (jugo con sabor); agente simulado on/off, clasificador null. Recorridos de reemplazo (dos unidades con nota → «Trae bebida?» → lista de dos combos) hasta DTO simulado con un combo de cada uno y la nota conservada. Contrastes: un solo número sigue eligiendo solo esa fila; una fila con opciones no recibe opción por defecto en silencio; una lista para tres unidades con dos filas sin conteo pregunta el reparto; una fila retirada de la carta no se compra y no se agrega nada más; conteos de reemplazo que no suman preguntan y conservan carrito y lista.

Arreglo general: tryResolveSeveralPendingRows corre primero dentro de tryResolvePendingMatchPick. Dos referencias unidas por «o/u» (número de fila, ordinal o código de una fila listada) o «cualquiera» conservan carrito y lista y preguntan mostrando esas filas con precio. Referencias unidas por «,/y/e», «uno de cada uno» o «ambos» (lista de dos filas) compran cada fila; un conteo opcional por referencia («2 de la primera», «una <nombre>») fija su cantidad. Una lista de reemplazo (o una lista para N unidades sin conteos) debe sumar: si no, pregunta cuántas de cada una y no cambia nada. La primera fila toma la línea reemplazada; las demás heredan su nota. Una fila retirada, una fila recotizada en reemplazo o un producto con opciones detienen la compra con explicación. Las comas se separan antes de normalizar. No codifica nombres, productos ni precios.

Validación: 1052 focalizados (19 suites), TypeScript general/build, 92 Node y diff --check. Global en dos fases: ráfagas 80/80 en 64s; resto 13.925/13.925 en 408s, 165 suites; unión exacta con inventario de 166, 463 hashes intactos, sin reintentos (472s). Total: 14.005 pruebas. Evidencia whatsapp-several-list-rows-validation-2110.json. Cero llamadas pagadas, Meta u órdenes externas. Main intacto.

Desplegado solo staging: runtime f7feda7fa4c086b653c19730eed77c90a582c44c, imagen c1be4663ffbff0b6541b0b5f77be647cc1364c29caf97741bfc7193756b1a3eb; running/healthy/cero reinicios; health OK, DB connected/circuit CLOSED a 2026-10-21T17:34:58Z. Producción conserva bf4596b27d048cba46f186d17e49dde9c12644f43bcba7f984c78485a6998af0. Bases, volúmenes y bin/ privado preservados. Rollback ppp-nest-staging:rollback-before-f7feda7f (imagen b36dc7c6…). Commit documental posterior no requiere rebuild.

Límites: «el 1 o el 3» en una lista de dos filas (fuera de rango) sigue con el «no lo resuelvo» genérico más el recordatorio; filas con opciones se piden de a una (no se recogen opciones por fila en un mensaje); con ignoreBusinessHours (pruebas nocturnas) la disponibilidad por horario se fuerza a propósito y solo retirar de la carta bloquea una fila; con agente, «qué hamburguesas tienen?» en un menú de tres hamburguesas mostró el detalle de una sola en vez de la lista. Modelo y servicios simulados: no acredita inferencia real.

Siguiente prioridad: selección parcial ambigua con varias líneas existentes y notas por unidad (pendiente de la tanda 81); pregunta de familia que elige un producto en vez de listar; después evaluación de inferencia real con presupuesto registrado. No declarar vendible por conteos.

## VIGENTE — tanda 81: dos unidades, solo una con opción binaria (21/10)

Base 33e1a358 (tanda 80 validada localmente), staging. Caso real: «Dos botella De Agua, una con gas» asignaba con gas a ambas y una corrección posterior decía arreglar sin mutar carrito. Se añaden 24 recorridos: agua/café/batido, agente simulado on/off, compra inicial/corrección durante pago, opción con/sin. Conservan churrasco independiente, dos unidades repartidas en líneas distintas, corrección repetida idempotente y DTO final con una de cada opción. En corrección el modelo simulado afirma haber corregido sin acciones; la prueba exige estado real, no texto del modelo.

Primer fixture omitió hasAttributes y primer intento de test tuvo TS18048; ambos corregidos antes de baseline válido: 12/12 fallidos. Primera implementación tardía no alcanzaba la ruta inicial; se mueve antes de agrupación genérica. Corrección fallaba porque normalizeForMatch elimina interrogación; se ajusta reconocimiento del preámbulo «las/los dos… quería solo una…». Final focalizado 268/268 en cinco suites, incluyendo 24 nuevos. TypeScript general/build y 92 Node aprobados. Global aprobada: 13915 pruebas / 165 suites, inventario exacto y 462 hashes intactos.

Regla general solo con cantidad dos y atributo con exactamente dos opciones opuestas con/sin definidas en catálogo. Compra usa adición validada existente y comprueba apertura/disponibilidad. Corrección opera sobre línea agrupada de dos mediante prepareUnitOptionActions; reconoce como idempotente dos líneas ya repartidas. Persiste carrito antes de responder con resumen, mantiene paso de pago/confirmación. No codifica agua/gas ni precios. No promete opciones inexistentes.

Límites: no resuelve automáticamente más de dos unidades, atributos con tres opciones, varios productos candidatos ni dos líneas distintas aún incorrectas. Estas requieren análisis/clarificación posterior. No acredita transcripción real ni catálogo de producción: modelo y servicios simulados. Cero llamadas pagadas, Meta u órdenes externas. Main intacto. Tandas 79–81 desplegadas juntas: código b22c988c4a02c163bd09dcb5120120dd95ffd3f0, imagen b36dc7c627463d21c6006acc1fc94f1039a84b043c1224ea7dcf1d1673d2a41c. Running/healthy/cero reinicios; health OK, DB connected/circuit CLOSED a 2026-10-21T17:17:59.542Z (12:17 Bogotá). Producción conserva bf4596b27d048cba46f186d17e49dde9c12644f43bcba7f984c78485a6998af0. Bases, volúmenes y bin/ privado preservados. Rollback ppp-nest-staging:rollback-before-b22c988c. Commit documental posterior no requiere rebuild.

Siguiente prioridad: evaluar selección parcial ambigua con varias líneas existentes, conservar notas por unidad y evitar afirmaciones de edición sin acciones verificadas. Retomar después disyunción aislada y evaluación de inferencia real con presupuesto registrado. No declarar vendible por conteos.

## VIGENTE — tanda 80: alternativas ambiguas y precio con contacto (21/10)

Base 25f9e339, staging. 42 casos nuevos: 36 recorridos hasta DTO con tres menús, agente simulado on/off, «el primero o el segundo», «1 o 2» o «cuánto cuestan?», con punto y coma o sin separador antes del teléfono. Se conserva carrito y pendingMatch, guarda teléfono, aclara opciones o informa precios y luego acepta elección explícita hasta orden simulada. Seis controles adicionales actualizan precio y agotan alternativa antes de consulta, verificando catálogo vigente y nueva aceptación de precio sin mutar carrito.

Baseline 18/18 fallidos: alternativas ambiguas perdían pendingMatch; consulta de precios ignoraba teléfono. Handler reconoce disyunción de dos selecciones ofrecidas y pregunta de precio relativa a la lista, junto a datos. No trata «o» como compra de ambas; no aplica a «y». Precio se consulta en catálogo vivo y se informa indisponibilidad. No hay excepciones de PPP. Selección+pregunta en la misma cláusula queda fuera de este handler para no ignorar la consulta.

Focalizado 282/282 en cinco suites antes de expansión; expansión final 42/42 (36 ya incluidos, no sumar reruns). TypeScript general/build y 92 Node aprobados. Global aprobada: 13891 pruebas / 164 suites, inventario exacto y 461 hashes intactos. Cero API pagada, Meta y órdenes externas. Main preservado. El caso nuevo de botellas interrumpe el despliegue: agrupar 79–81 tras validar ese reparto;  runtime previo staging 3de69a15.

Límites: esta tanda exige datos de contacto junto a disyunción/consulta. No acredita disyunción aislada ni una compra de dos opciones con «y». Preguntas acotadas a precio de la lista, no contenido libre de cualquier producto. Modelos/servicios simulados: no inferencia real, PDF completo ni estado vendible.

Siguiente: probar disyunciones sin teléfono y compras explícitas de varias alternativas (distinguir «o» de «y» y cantidad por opción); después evaluación real acotada de conversaciones congeladas con gasto registrado. Evitar confundir una oferta de sustitución con autorización para duplicar unidades. Mantener el objetivo de piloto supervisado con pedidos correctos, cierre breve, latencia y costo medidos.

## VIGENTE — tanda 79: elección y teléfono sin separadores (21/10)

Base 4001caf7, staging. 54 casos nuevos con tres menús y agente simulado on/off: 36 sustituciones con aceptación de precio+teléfono sin coma/salto de línea hasta DTO; 18 controles de lista ambigua, cambio explícito a segunda opción y segundo cambio de precio. Baseline 36 fallos/0 verdes. El parser separa el sufijo telefónico etiquetado solo si el prefijo completo es una elección ofrecida o una afirmación reconocida. Reutiliza captura de contacto y resolvedor existentes; no codifica nombres/productos/precios.

Focalizado 372/372 en seis suites; TypeScript general/build y 92 Node aprobados. Global aprobada: 13849 pruebas / 163 suites, inventario exacto y 460 hashes de fuente intactos. Cero API pagada, WhatsApp y órdenes externas. Main intacto. Publicación validada; agrupar deploy con siguiente tanda. Runtime staging sigue 3de69a15.

Límites: teléfono con etiqueta, no todos los datos ni prosa libre. Dos elecciones simultáneas (p. ej. «1 o 2») siguen pendientes. Afirmación sin opción concreta conserva lista y no compra. Las plantillas miden router con modelos/servicios simulados, no precisión de inferencia real ni cobertura total PDF.

Kamppo: portar contratos de intención/estado, resolvedor por catálogo, fixtures parametrizados y suites reutilizables; los casos PPP son fixtures de regresión, no excepciones de runtime. Las tandas son historial de validación, no módulos que copiar uno por uno. Añadir aislamiento de sesión/carrito/catálogo/precios/configuración por tenant y pruebas concurrentes antes de acreditar multitenencia. La extracción a Kamppo aún no se ha realizado.

Siguiente: dos elecciones ambiguas y consultas dentro del mensaje mixto; luego evaluación focalizada de modelo real con presupuesto registrado. Mantener criterios de piloto basados en pedidos correctos y cierre supervisado, no conteo de tests.

## VIGENTE — tanda 78: conversaciones completas con interrupciones del cierre (21/10)

Base e5ce5ff3, staging. 12 conversaciones nuevas: dos secuencias (corregir nombre+teléfono o dirección), tres menús (bowl, pescado, churrasco), agente simulado on/off. Empiezan con sesión vacía: saludo+solicitud de carta, consulta de precio sin compra, dos platos con nota, datos de domicilio, consulta de contenido durante pago, corrección de datos con acuse visible, consulta de total, pago, pregunta de tiempo durante confirmación, confirmación y agradecimiento sin duplicar orden. Verifican respuesta, carrito, estado, datos y DTO simulado de dos unidades con notas. No son doce intenciones independientes: son dos recorridos combinados con variaciones de menú/modelo simulado.

Baseline 12/12 verdes; no cambio runtime. Al fortalecer el acuse visible apareció TS18048 del test (reply opcional), corregido con fallback de string; rerun 12/12. Focalizado final 294/294 en seis suites. TypeScript general/build y 92 Node aprobados. Se explicita mock classifyMessage null; generateTurn devuelve respuesta genérica sin acciones. El fallback del router es parte de lo probado; no acreditar comprensión del modelo real. Advertencia de telemetría placed_order_only no implica orden externa: el mock ordersService se verifica sin llamadas antes de confirmar y una sola después.

Sin global nueva porque solo se añade test/documentación. Última global runtime: tanda 76, 13729/160, no sumar nuevos tests como si fueran una global ejecutada. Sin despliegue necesario; staging runtime sigue 3de69a15. Main intacto, cero API pagada, Meta u órdenes externas.

Siguiente: mensajes mixtos sin separadores y dos elecciones ambiguas; después evaluación focalizada del modelo real con presupuesto registrado sobre estas conversaciones ya congeladas. Quedan audio/visión reales y evaluación supervisada de pedidos, costo y tiempo de cierre. No declarar piloto listo solo por regresiones gratuitas ni afirmar revisión completa de PDF.

## VIGENTE — tanda 77: compra inicial, datos y rechazo de combo (21/10)

Base 7504ab66, staging. 54 conversaciones nuevas: tres menús (arroz+gaseosa, bowl+ensalada, pasta+pan), agente simulado on/off, tres decisiones (combo, por separado, solo plato) y tres datos (teléfono etiquetado, nombre, dirección). En cada recorrido se repiten los datos, se consulta precio antes de elegir y se comprueban respuesta, carrito, pendingMatch, datos guardados y DTO de orden simulada; ninguna orden antes de confirmar. Los acompañamientos no se duplican al elegir combo; separarlos conserva ambos artículos; solo plato excluye acompañamiento.

Baseline 54/54 verdes: no se encontró fallo de runtime en estos recorridos. El fixture no implementaba classifyMessage y el router capturaba TypeError; se añade mock explícito null (clasificador sin resultado) al test nuevo y a la suite de decisiones anterior. Es saneamiento del simulador, no prueba de calidad de inferencia real. Focalizado 396/396 en siete suites, TypeScript general/build y 92 Node aprobados. Revalidación limpia de ambos fixtures documentada en evidencia. No se modifica runtime. No se repite global ni despliega: última global del runtime vigente, tanda 76, 13729/160. No sumar 54 a esa cifra y presentarla como global ejecutada.

Runtime staging sigue 3de69a151411da91e1ec537360766eec8e5a6616; publicación de tests/documentación no necesita rebuild. Main intacto. Cero API pagada, WhatsApp u órdenes externas.

Siguiente tanda: conversaciones completas nuevas desde saludo, consulta de catálogo, selección, corrección de datos y pregunta durante cierre; reservar enunciados antes de editar y registrar baseline. Añadir después mensajes mixtos sin separadores y dos elecciones ambiguas. Evitar seguir multiplicando únicamente etiquetas/menús de una misma plantilla: priorizar secuencias distintas y pruebas negativas. Quedan evaluación del modelo real con gasto registrado, audio/visión y medición supervisada antes de declarar listo para vender. Este bloque no acredita todos los PDF.

## VIGENTE — tanda 76: aceptación y contacto en el mismo mensaje (21/10)

Base 96f768b1, staging. 54 casos nuevos con tres menús (bowl, pasta, arroz) y agente simulado on/off. 36 recorridos hasta DTO: dos opciones y aceptación con teléfono separada por coma, punto y coma o salto de línea, incluyendo cortesía y puntuación. Dieciocho controles de carrito/estado/respuesta: aceptar una lista aún ambigua, elegir otra opción tras recotizar y segundo cambio de precio. La lista ambigua conserva alternativas, guarda teléfono y permite elegir después; no compra con «sí» sin referente.

Baseline 24 fallos/12 verdes. Tras unificar gramática de aceptación y separar teléfonos etiquetados, pasan 36/36. Expansión descubre seis fallos: el mensaje mixto ambiguo conservaba carrito pero perdía pendingMatch. Se consume la cláusula afirmativa junto a datos sin ejecutar selección cuando no existe candidato recotizado. Alternativa explícita continúa usando el resolvedor existente y prevalece sobre el marcador de precio. No hay productos/precios de PPP codificados en runtime.

Focalizado 300/300 en cinco suites; TypeScript general/build y 92 controles Node aprobados. Global aprobada: 13729 pruebas / 160 suites, inventario exacto y 457 hashes intactos. Cero API pagada, Meta y órdenes externas. Main preservado. Tandas 75–76 desplegadas juntas en staging: código 3de69a151411da91e1ec537360766eec8e5a6616, imagen 8c54c83ba8b9c2219e52fa774e3f28f690c1663fe72ef00f97957b04b0e672dd. Running/healthy/cero reinicios; health OK, DB connected y circuito CLOSED a 2026-10-21T15:17:14.985Z (10:17 Bogotá). Producción conserva bf4596b27d048cba46f186d17e49dde9c12644f43bcba7f984c78485a6998af0. bin/ privado, bases y volúmenes preservados; rollback ppp-nest-staging:rollback-before-3de69a15. Commit documental posterior no requiere rebuild.

Límites: pruebas gratuitas del router con servicios y modelo simulados; no acredita precisión de inferencia, audio/visión ni todos los chats de PDF. Esta tanda comprueba sustituciones, no toda compra inicial. Falta estudiar mensajes sin separadores, dos elecciones en el mismo mensaje, cambio de intención a compra separada, y datos mezclados con consultas no resueltas. No declarar vendible por conteos.

Plan próximo: (1) controles de compra inicial y rechazo de combo, (2) conversaciones completas reservadas desde saludo hasta confirmación con cambios de datos y preguntas, (3) una evaluación real acotada del candidato validado, con presupuesto registrado, (4) piloto supervisado con medición de pedidos correctos, turnos de cierre, latencia y costo. Las regresiones gratuitas son requisito, no sustituyen los puntos 3–4.

## VIGENTE — tanda 75: teléfono etiquetado y aceptación de precio (21/10)

Base 7721a355, staging. 54 casos nuevos: 36 recorridos hasta DTO simulado con tres menús (bowl, pasta y arroz), agente simulado on/off, dos opciones ofrecidas y tres etiquetas de teléfono. Dieciocho controles adicionales vuelven a cambiar precio, retirar o agotar el producto antes del «sí»; verifican respuesta, carrito intacto y elección pendiente. Los controles de segundo cambio aceptan de nuevo y verifican el precio actual; no llegan a DTO.

Baseline 36/36 fallidos: tras recotizar y recibir teléfono, «sí» no resolvía la sustitución. Primera implementación del marcador dentro del resolvedor también dejó 36 fallos porque el router interceptaba antes la aceptación. Se enruta únicamente la aceptación breve con candidato explícitamente recotizado al resolvedor existente; allí se revalida catálogo, precio y disponibilidad. El marcador pertenece a pendingMatch y no elige arbitrariamente la primera alternativa. Teléfonos etiquetados se normalizan antes de la validación telefónica existente. No hay excepciones por restaurante, producto o precio.

Focalizado final: 246/246 (54 nuevos, 192 regresiones). TypeScript general/build y 92 pruebas Node aprobados. Global aprobada: 13675 pruebas / 159 suites, inventario exacto y 456 hashes intactos. Publicación a staging validada. Cero API pagada, Meta u órdenes externas. Main intacto. No desplegado: agrupar con la siguiente tanda; el runtime staging sigue 624317ce.

Límites: las 36 conversaciones son sustituciones de un plato ya añadido, con contacto en turno separado. No acreditan inferencia real, audio/visión, todo el PDF ni todas las formas libres. Pendientes: aceptación+teléfono en una misma frase, puntuación en aceptaciones, dos elecciones ambiguas, mensajes parcialmente reconocidos y cambiar de intención tras recotizar. Añadir controles de compra inicial con acompañamiento antes de ampliar esta gramática. No declarar vendible por conteo.

## VIGENTE — tanda 74: elegir combo y enviar datos juntos (21/10)

Base 4932d853. 84 casos nuevos: 72 recorridos completos con tres menús, agente simulado on/off, compra inicial/sustitución, filas 1/2 y elección por número inicial, ordinal inicial separado por coma o código al final separado por salto de línea. Verifican respuesta, datos, cantidad dos, nota previa, ausencia de pedido externo antes de confirmar y DTO simulado. Doce controles adicionales combinan datos y elección de una opción retirada o con precio cambiado, conservan carrito y vuelven a elegir alternativa o aceptar precio. Estos doce terminan en carrito, no DTO.

Baseline 72/72 fallidos: no se resolvían simultáneamente datos y selección. Se amplía el handler de tanda 73 para aceptar una única cláusula de elección inequívoca de la lista ofrecida, guardar datos y usar tryResolvePendingMatchPick existente. No hay nueva vía que salte disponibilidad/precio/sustitución. Números telefónicos se reconocen antes que índices. Índices fuera de lista y nombres duplicados no califican en este handler. La elección con datos no confirma automáticamente la orden.

Focalizado 144/144 primero; expansión 192/192 con tandas 72–73. 84 casos nuevos, sin contar reruns. TypeScript general/build y 92 Node aprobados. Global 13621 pruebas / 158 suites, inventario exacto y 455 hashes intactos. Resto cuatro workers 563,632 s. Tandas 73–74 desplegadas juntas: 624317ce324b18448db0535ebf9016c54dde6e1f, imagen b8436b9508987b1c8bead2f8d4aa79e5f73cf4a4c32680f39b3cd3bcf1d7f084. Primera consulta starting con health OK; verificación final running/healthy/cero reinicios, DB connected/circuit CLOSED a 2026-10-21T14:45:32.037Z (09:45 Bogotá). Producción conserva bf4596b27d048cba46f186d17e49dde9c12644f43bcba7f984c78485a6998af0. bin/ privado, bases y volúmenes preservados. Rollback ppp-nest-staging:rollback-before-624317ce. Commit posterior documental no requiere reconstruir. Cero API pagada, Meta u órdenes externas. Main preservado. Agrupar despliegue staging 73–74 tras validar.

Límites: elección expresada como cláusula separada; no cubre toda redacción libre ni selección final separada solo por coma, teléfono etiquetado, ambigüedad de nombres o múltiples elecciones. Reglas dependen del catálogo vigente, sin excepciones PPP. Modelo y servicios externos simulados; no acredita audio/visión ni todos los PDF.

Siguiente: teléfono con etiqueta, datos+elección cuando cambió precio con aceptación breve, dos elecciones ambiguas, y controles de mensaje parcialmente reconocido sin perder resto. Conviene factorizar el parser de datos compartido con atributos solo con regresiones de ambos caminos. No declarar vendible por conteo.

## VIGENTE — tanda 73: contacto durante oferta de combo (21/10)

Base 2d6e3aa3, staging. 72 recorridos nuevos: tres menús (bowl/pasta/arroz), agente simulado on/off, compra inicial o sustitución, seis formas de datos (nombre, teléfono, dirección, todos con saltos de línea/comas/punto y coma). Se repiten datos para verificar que no compren ni dupliquen; se conserva pendingMatch exactamente, cantidad y nota. Elegir después lleva al cierre y DTO simulado con dos unidades correctas, nombre/teléfono/dirección esperados. No acreditar una compra real ni precisión de modelo por estos mocks.

Baseline: primer setup 24 fallos antes del turno bajo prueba porque entregar dirección previamente avanzaba al checkout. Se corrige fixture para tener la oferta activa antes de inyectar el estado de entrega. Baseline válido 18 fallos/6 verdes: dirección aislada pasaba, nombre/teléfono/conjunto de datos no. Nuevo handler acotado a building_cart con oferta integral o sustitución pendiente, sin selección de atributos/multi simultánea. Solo consume mensaje compuesto enteramente por datos explícitos reconocidos; no confunde una respuesta de producto con contacto. Acknowledgement con datos guardados y lista pendiente, conservando compra. pendingCheckoutDetailsCaptured retoma cierre tras elegir; no confirma pedido sin consentimiento.

Primer intento de implementación falló en TypeScript por tipo inferido de next; se declara WhatsappSessionData y se repite. Focalizado inicial 24/24; expansión primera 36 + 168 previos = 204/204; final 72/72. TypeScript general/build y Node verdes. Global aprobada: 13537 pruebas / 157 suites, inventario exacto y 454 hashes de fuente intactos. Resto cuatro workers 479,183 s; ráfagas aisladas 67,841 s. Publicación a staging validada; despliegue agrupado pendiente. El script temporal global previo no persistía en /tmp; primer intento no lanzó pruebas, se recreó el mismo procedimiento (ráfagas aisladas, resto cuatro workers, inventario y hashes).

Límites: datos con prefijos explícitos para nombre, número telefónico sin etiqueta y dirección fuerte. No cubre aún nombre sin prefijo, datos+elección en el mismo mensaje, cambios de contacto después de subir precio, ubicaciones ambiguas ni audio/visión. La gramática de cláusulas replica la usada por interrupciones de atributos; consolidarla en helper compartido solo con controles de ambos flujos. Cero API pagada, Meta u órdenes externas. Main intacto; publicar validado en staging y agrupar próximo despliegue. Runtime actual sigue 6e748c15.

Siguiente: elección más datos juntos (ej. «el segundo, a nombre de Ana...»), corrección de datos repetidos, teléfono con etiqueta, aceptación breve después de recotizar y prueba reservada con conversación completa. No declarar vendible por conteo.

## VIGENTE — tanda 72: aceptar precio actualizado y ofertas desaparecidas (20/10)

Base 5e9ddfe8, staging. 36 casos nuevos con bowl/pasta/arroz y agente simulado on/off: 12 sustituciones con subida/bajada de precio hasta DTO simulado; 12 compras iniciales de dos combos con subida/bajada, carrito vacío hasta repetir elección; 12 consultas de precio después de agotarse/retirarse todas las ofertas, seguidas de compra por separado. Baseline inicial 24/24 fallidos: precio cambiaba silenciosamente; ausencia total seguía invitando a elegir una presentación inexistente.

Cambio acotado a pendingMatch de sustitución o includesRequestedAccompaniment: comparar precio vigente con snapshot ofrecido; si difiere, comunicar anterior/nuevo por unidad, actualizar precio de esa opción conservando índices/cantidad/notas/origen y pedir que vuelva a elegir. No comprar hasta ese siguiente turno. Si todas las ofertas desaparecieron al consultar precio, explicar disponibilidad y ofrecer compra por separado u otro plato. Mantener query permite recuperar compra separada sin inventar productos.

Actualización legítima del contrato de tanda 71: sus 18 casos de precio ahora comprueban aviso y carrito intacto antes de repetir selección por fila/código/nombre. Fixture reemplaza objeto vigente (simulando nueva lectura de catálogo) en vez de mutar el mismo objeto del snapshot; no debilitar expectativas para ocultar compras silenciosas. Los demás casos de agotado/retirado se mantienen.

Focalizado 120/120 antes de última expansión; expansión 36/36. Global aprobada: 13465 pruebas / 156 suites, inventario exacto y 453 hashes de fuente intactos. TypeScript general/build y 92 Node aprobados. Resto cuatro workers: 732,169 s; no confundir esta duración local con latencia de producción. Cero API pagada, Meta y órdenes externas. Main intacto. Tandas 71–72 desplegadas juntas en staging: 6e748c15854c4a124778b8ae8e7a07969205b904, imagen 1562b9bd68c887060eb776652d774b1b504a92af9986ede0f97ae739faa1fe2d, running/healthy/cero reinicios. Health OK, DB connected y circuito CLOSED a 2026-10-21T05:12:17.633Z (00:12 Bogotá). Producción conserva imagen bf4596b27d048cba46f186d17e49dde9c12644f43bcba7f984c78485a6998af0. bin/ privado, bases y volúmenes preservados. Rollback ppp-nest-staging:rollback-before-6e748c15. Commit posterior documental no requiere reconstruir.

Límites: modelo y servicios simulados; no transacción concurrente real ni inferencia pagada. Precio cambia solo en elección de combo, no política general de precios/checkout. Cuando ya se consultó precio actualizado puede pedir una elección extra porque el snapshot conserva el precio originalmente ofrecido; mejorar sin permitir compra por consulta. Aceptación breve «sí» en lista múltiple merece contrato propio; hoy se pide explícitamente número/nombre. Datos de nombre/teléfono/dirección durante alternativas siguen como siguiente tanda.

## VIGENTE — tanda 71: catálogo que cambia durante la elección (20/10)

Base 28508946, staging. 54 recorridos nuevos con bowl/pasta/arroz, agente simulado on/off, elección por fila/código/nombre y tres cambios entre oferta y elección: agotado, retirado, precio actualizado. Todos recorren carrito inicial de dos unidades con nota, oferta de combo, elección, conservación o sustitución y DTO de orden simulada. Ante agotado/retirado se comprueba carrito intacto y luego selección de otra alternativa con la numeración original, conservando cantidad y nota. Precio actualizado se comprueba en carrito; no se afirma consentimiento específico de un aumento de precio ni precio unitario del DTO.

Fallo reproducido: tryResolvePendingMatchPick usaba el snapshot chosenLite si el producto ya no existía en el menú. Permitía comprar un producto retirado y sustituir el plato válido del carrito. Se elimina ese fallback: solo un producto vigente puede seleccionarse; ante ausencia responde claramente, conserva carrito y selección para elegir otra alternativa. Regla por ID de catálogo, sin nombres/IDs PPP en runtime.

Baseline 18 casos: seis fallos por retirado, doce verdes en agotado/precio. Después: 96/96 focalizados junto a tandas anteriores. Expansión inicial de 54: 18 fallos del fixture por códigos de cinco dígitos, fuera del formato de 1–4 dígitos del parser. Se corrigen códigos sintéticos a 601–603 sin cambiar IDs ni expectativas; 54/54 aprobados. No contar reruns como casos nuevos. TypeScript general/build y Node verdes. Global aprobada: 13429 pruebas / 155 suites, inventario exacto y 452 hashes de fuente intactos. Partición resto 523,909 s; cuatro workers. Publicar a staging; despliegue agrupado pendiente. Runtime sigue 7a3e82b6 (tanda 70); no afirmar que esta corrección está live.

Límites: mocks de modelo, Meta, persistencia y órdenes. Cero llamadas pagadas o pedidos externos. Main intacto. No acredita disponibilidad real concurrente/transacciones de inventario ni todos los PDF. No cambiar política comercial de precios en esta tanda.

Próximo: avisar y volver a pedir aceptación si el precio cambió entre oferta y selección; lista de alternativas totalmente retirada; recuperación con nombre/teléfono/dirección mientras se resuelve selección; ofertas de compra con precio consultado cuando desaparece la última alternativa (evitar respuestas vacías). Agrupar próximo despliegue a staging; no promover a Main sin solicitud.

## VIGENTE — tanda 70: decisiones de combo y referencia tras elegir (20/10)

Base 4810d812. Trabajo en staging. Caso real: después de añadir pollo frito, «Trae bebida?/Trae gaseosa?» contestaba también sobre broaster. Se reprodujo un camino equivalente: pendingMatch.selectionAdded conserva una lista de navegación y el handler de inclusión la trataba como elección pendiente. Ahora prioriza la última confirmación o el único producto seleccionado de esa lista que está en el carrito. Puede ofrecer la variante con bebida y reemplazar la línea únicamente cuando el cliente elige. No inferir inclusión ausente en catálogo ni afirmar que bebida genérica equivale a gaseosa.

La repetición de la pregunta descubrió otro fallo: al volver a presentar el mismo combo se perdía replacement.originalLine. Se conserva esa intención solo si el conjunto de alternativas es el mismo. Doce recorridos nuevos (tres menús × dos preguntas × agente simulado on/off) prueban elección inicial, consulta, segunda consulta, sustitución y DTO. Seis controles mantienen listas aún no elegidas sin comprar. Baseline contexto: 12 fallos/18 verdes; extensión repetición: seis fallos/30 verdes.

También 42 casos nuevos (arroz, bowl, pasta; agente simulado on/off) para rechazar combo y pedir separado, mantener solo plato y preguntar precio. Baseline inicial: separado y precio fallaban (12 fallos/6 verdes); solo plato ya pasaba. La pregunta de precio llegaba a comprar el combo sin autorización. Ahora responde precios vigentes sin cambiar carrito; separado reinterpreta la compra explícita y conserva flujo normal. Alcance probado: una unidad; múltiples cantidades y disponibilidad cambiante siguen pendientes.

Validación focalizada: 78/78 en dos suites; 60 casos nuevos, sin sumar reruns. TypeScript general/build verdes; Node 92 verdes. Global aprobada: 13375 pruebas / 154 suites, inventario exacto y 451 hashes de fuente intactos. Desplegado staging 7a3e82b608de8ccb4d5c46fc04ae82617c5c2a6c el 20/10 a las 23:34 Bogotá. Imagen 8cb815677a0208f27a63ffc551c1163e4f945bf3e9c67834a842356a44d5c8b9, running/healthy/cero reinicios; health OK, DB connected y circuito CLOSED a 2026-10-21T04:34:39.661Z. Producción conserva bf4596b27d048cba46f186d17e49dde9c12644f43bcba7f984c78485a6998af0. bin/ privado preservado, sin tocar bases/volúmenes. Rollback ppp-nest-staging:rollback-before-7a3e82b6. Commit posterior documental no requiere rebuild. Main preservado. Servicios/modelos simulados: no acreditar precisión del modelo real, audios o todos los chats/PDF. Cero API pagada, Meta u órdenes externas.

Siguiente: oferta que cambia de disponibilidad, consulta repetida con varias alternativas, rechazo de sustitución y compras separadas con cantidades distintas. Revisar checkout sin perder datos. Mantener diferencia Main/staging explícita: Main recibió solo hotfix puntual de cerrado, no todas las tandas recientes.

## VIGENTE — cierre breve fuera de horario y hotfix a Main (20/10, tanda 69)

Solicitud explícita: saludo + «Hay servicio de domicilio?» recibió invitación a pedir y, después, cerrado + tarifas + nueva invitación. tryHandleBusinessServiceInquiry concatenaba siempre tarifas/CTA incluso con isOpen=false. Ahora termina con una única respuesta breve: cerrado, horario configurado de hoy e invitación a escribir en horario de atención. No promete apertura mañana sin evidencia. El saludo informal «uy buenas noches» también pasa por el aviso de cerrado; estando abierto conserva el saludo habitual. No cambia carrito/estado ni tarifas de negocio abierto.

17 pruebas nuevas del router: cuatro mensajes × agente simulado on/off × carrito vacío/existente, más servicio abierto. Baseline 12 fallos/5 verdes; 17/17 después, TypeScript general/build verdes. Cero API pagada, Meta u órdenes externas. No afirmar que ya estén cubiertas todas las consultas geográficas/horarios especiales por este cambio.

Promoción puntual autorizada a Main: cherry-pick del código b34e70a8 como a9e0cac8, sin promover las otras 142 revisiones acumuladas de staging. Main no tenía whatsapp-accuracy.test-support.ts: primer intento de prueba falló en compilación por ese import. Se extrajo el harness existente en Main, sin modificar comportamiento productivo. Segundo intento 17/17 aprobado sobre Main; se comprueba también TypeScript de build. Los 454 archivos generados previamente modificados en el checkout Main se preservan; no hacer reset/clean.

Global staging: 13315 pruebas / 153 suites, inventario exacto y 450 hashes intactos. Main: 17 regresiones focalizadas + TypeScript build aprobados; no se ejecutó su global histórica separada.

Producción desplegada el 20/10 a las 23:07 Bogotá: Main 639e7cd77e64a301734ee6f004d3c704278fd301, imagen bf4596b27d048cba46f186d17e49dde9c12644f43bcba7f984c78485a6998af0, running, cero reinicios, health OK/DB connected/circuit CLOSED a 2026-10-21T04:07:39.287Z. Texto nuevo verificado en JS compilado. Hashes de compose y .env iguales antes/después; rollback ppp-nest-api:rollback-before-639e7cd7.

Staging desplegado b34e70a8ade834f5838acdaca4ab8c2c90468f5d, imagen 903d1ef91b501deb8075ae36b6a27641cd90a8c366a15f60e420058e38d08b29, running/healthy/cero reinicios, health OK a 2026-10-21T04:08:32.841Z. Rollback ppp-nest-staging:rollback-before-b34e70a8. Bases, volúmenes y bin/ preservados. Main y staging conservan distintas mejoras acumuladas: solo este hotfix está en ambos, no afirmar paridad de todas las tandas.

Siguiente: continuar en staging con sabores/acompañamientos; horarios especiales, consulta con zona y preguntas sobre pedidos ya confirmados merecen controles propios. No repetir deploy por commits documentales.

## VIGENTE — compra con pregunta de sabores, sin falso bloqueo por cita (20/10, tanda 68)

Base cbfda295, tanda 67 validada y aún sin desplegar. Caso recibido durante su global: pollo en carrito → «una gaseosa, de que sabor tienes?» → «Dime la opción. El pedido sigue igual». quotedBotQuestionWithoutAnswer reconocía «que sabor» como cita del bot aunque «tienes/hay» sea una consulta del cliente. Excluir estas preguntas del guard era necesario, pero no suficiente: el router pasaba a catálogo/lista sin sabores. Se agregó interpretación acotada de compra + pregunta de sabores con consulta al catálogo y atributos disponibles. Producto inequívoco → pregunta de opciones sin default silencioso; varias presentaciones → lista con precio y sabores de cada una, elección de presentación y después sabor. No hay excepciones PPP.

26 pruebas nuevas: 24 recorridos completos con gaseosa, helado y yogur, cantidades 1/2, «de que sabor tienes?»/«qué sabores hay?», agente simulado on/off. Verifican respuesta con sabores, carrito intacto hasta elección, producto/atributo/cantidad posterior y DTO de orden simulada. Dos reproducciones PPP parten de snapshot de pollo ya añadido, verifican lista, seleccionan #28 y Manzana, y conservan pollo sin duplicarlo. El setup inicial de PPP con modelo simulado devolvía una consulta y no añadía pollo; se cambió por snapshot explícito para reproducir el estado reportado, no se acredita ese turno previo con ese mock.

Baseline inicial ocho fallos. Guard solo dejó ocho fallos (lista/detalle sin sabores y un setup PPP sin carrito). Primer nuevo handler tenía error singular/plural en regex; corregido y cubierto por ambos. Error de fixture TS por code faltante reparado antes de ejecutar. Seis casos sintéticos pasaron; dos PPP requerían resolver categoría cuando el buscador de prefijos descarta un nombre débil como gaseosa. Expansión a 24 recorridos + 2 PPP y comprobación de selección posterior: 79/79 focalizados junto a tanda 67. No contar reruns como pruebas nuevas.

Global final: 13298 pruebas / 152 suites, inventario exacto y 449 hashes intactos. TypeScript general/build y 92 Node verdes. Evidencia docs/whatsapp-flavor-customer-question-validation-2010.json. Despliegue agrupado 67–68 verificado el 20/10 a las 22:52 Bogotá (2026-10-21T03:52:02.724Z): código 429ffc14198b520c96fe5e2dfd6c27978364f2e0, imagen 020346117c6ddb9a524cc47cf683c78975803ee5a7488e0e457e4ff1bab40da4. Running/healthy, cero reinicios, health OK/DB connected/circuit CLOSED. Producción conserva c5e97ab1f09502b3a64a73fb332665395f9e6054349b7195bc3d58081bf4559e. Rollback ppp-nest-staging:rollback-before-429ffc14. bin/ privado, bases y volúmenes preservados. Commit documental posterior no requiere rebuild.

Límites: servicios/modelo simulados, cero inferencia pagada, Meta u órdenes externas. Nueva compra+pregunta cubre building_cart sin atributos/lista/multi pendientes; gramática acotada, no todas las preguntas abiertas ni pedidos compuestos. La distinción de citas sigue heurística textual, no se afirma que WhatsApp quoted-message metadata esté completamente validada. Global valida los controles previos de citas con/sin respuesta. Main intacto.

Siguiente tanda: consultas sin compra («qué sabores tienes de …»), cambio de producto mientras se consultan sabores, rechazo de combo ofrecido y agotado entre oferta/elección; estados checkout y pregunta+datos de entrega. Mantener respuestas útiles y cantidad/opciones hasta DTO. Evitar extrapolar conteos a vendibilidad; piloto requiere medir conversaciones reales y latencia/costo por separado.

## VIGENTE — compra de plato con acompañamiento: ofrecer presentación incluida (20/10, tanda 67)

Base a941f2ae. Prioridad solicitada: «Quiero Un arroz chino con gaseosa» no debe comprar automáticamente plato y gaseosa por separado si hay una presentación relacionada con bebida. Se consulta la familia del catálogo y su evidencia de inclusión; se muestran nombres, códigos, precios y descripción antes de elegir. Aplica también a ensalada y pan sin excepciones de nombres/IDs PPP en runtime. «Bebida» permite ofrecer la presentación con esa descripción, no afirmar una gaseosa específica; exclusión explícita gana. Extras opcionales/con recargo no prueban inclusión. Compra explícita «aparte» conserva productos separados.

53 pruebas nuevas: 24 recorridos en arroz/bowl/pasta con cantidades 1/2, disponibilidad de combo y agente simulado on/off; dos recorridos exactos PPP con elección y atributos; seis compras separadas; seis listas con dos combos y elección de la segunda fila; 15 controles de gramática/evidencia. Los 12 recorridos positivos sintéticos iniciales llegan a DTO de orden simulada y comprueban unidades de combo sin componentes duplicados. Los restantes comprueban el contrato focalizado de oferta/selección, no todos llegan a DTO.

Baseline 22 fallos/4 verdes en 26: parte de los negativos de disponibilidad requirió corregir el harness, cuyo ignoreBusinessHours=true expone agotados; los tests usan false con negocio abierto. Tras primera corrección quedaron cuatro fallos: al elegir combo se reprocesaba la consulta y se añadían también plato y bebida, perdiendo cantidad. Una marca de oferta integral evita reañadir componentes y consumir la selección como lista de navegación. Expansión encontró seis selecciones que dejaban lista residual: corregidas sin debilitar expectativa. Un intento focalizado apuntó a archivo inexistente (nombre incompleto); repetido con la suite correcta. Final focalizado: 149/149 en cuatro suites. TypeScript general/build y 92 Node verdes.

Global congelada: 13272 pruebas / 151 suites; inventario exacto y 448 hashes intactos. Evidencia: docs/whatsapp-accompaniment-offer-validation-2010.json. Publicación/despliegue agrupado pendiente con el nuevo caso de sabores recibido durante la global.

Límites: texto acotado de compra directa, plato base identificado inequívocamente por nombre normalizado, building_cart sin selección pendiente. No acredita voz/visión/modelo real ni todos los PDF. Familias ambiguas, solicitudes multilínea con datos, sabores específicos y cambios durante checkout necesitan tandas posteriores; esta regla no debe absorber notas «poquita ensalada/harta papa», cantidades explícitas de extras ni «aparte». Menús externos y llamadas pagadas: cero. Main preservado.

Siguiente tanda: rechazo del combo («prefiero por separado»), pregunta de precio/contenido antes de seleccionar, variante agotada tras la oferta, sabores específicos y variantes con restricciones incompatibles. Extender las conversaciones hasta DTO, manteniendo precio y cantidad; no cambiar expectativas antiguas para ocultar regresiones. Global única con fuente congelada, ráfagas aisladas y resto cuatro workers, inventario exacto y hashes; desplegar agrupado solo tras validar.

## VIGENTE — consulta de bebida/combo con elección efectiva (20/10, tanda 66)

Base cf0e4199. Chat real: familia pollo + arta papa → 1 → «Viene con gaseosa?» → «No hay algun combo?» → 1 ignorado. Causa: tryHandleComboAvailabilityQuestion mostraba opciones numeradas con carrito existente sin registrar pendingMatch. Además la búsqueda por nombre completo no vinculaba «1 Pollo Broaster» con su combo y exigía gaseosa literal, ignorando evidencia genérica de bebida.

18 recorridos nuevos: dos menús sintéticos (bowl/hamburguesa), cantidades 1/2, agente simulado on/off, consulta directa de combo o precedida por bebida, más dos secuencias exactas PPP. Baseline original 10 fallos. Nuevo requisito de ofrecer combo desde bebida se reprodujo antes de corregir. Primer test DTO asumía cantidad por línea: corregido al contrato real de items unitarios, comprobando cantidad de items y notas de todos. No es una corrección del DTO productivo. Final focalizado 184 controles de cinco suites; TypeScript general/build y 92 Node verdes.

Consulta no compra. Al resolver un único plato del carrito y sin otra elección pendiente, se guarda una propuesta de reemplazo con snapshot de línea y cantidad. El número usa el reemplazo atómico existente y conserva notas; no suma otro plato. Consulta de bebida ofrece combos de la familia con evidencia de bebida en catálogo, precio/código/descripción y acción explícita de cambiar. «Bebida» no prueba «gaseosa», ausencia en descripción no prueba exclusión; mantener respuestas negativas solo ante evidencia explícita. No excepciones PPP.

Global: 13219 pruebas / 150 suites, inventario exacto, 446 hashes intactos. Evidencia whatsapp-combo-inquiry-validation-2010.json; logs /tmp/ppp-t66-result.log.

Desplegado staging el 20/10 a las 22:18 Bogotá (2026-10-21T03:18:07.385Z): código 0c509dc5d0cb0054818b7b52c4fa77bc9a8b2aa3, imagen dd5fa61b43d78d96b517307a46454962dd55e607e1e8c9d2abb2a4c86dcad8fe. Running/healthy, cero reinicios, health OK/DB connected/circuit CLOSED. Producción conserva c5e97ab1f09502b3a64a73fb332665395f9e6054349b7195bc3d58081bf4559e. Rollback ppp-nest-staging:rollback-before-0c509dc5; bin/ privado, bases y volúmenes preservados. Commit documental posterior no requiere rebuild.

Límites: servicios/modelo simulados, cero llamadas pagadas/Meta/órdenes externas. Nueva oferta automática de bebida cubre building_cart, no rama checkout/condicional. Filas repetidas del mismo SKU y elecciones paralelas requieren aclaración; no demostrar cobertura de esa UX por estos tests. Atributos nuevos del combo siguen el flujo existente; transferencia de todas las opciones antiguas compatibles requiere tanda propia. No afirmar que todas las listas del bot sean ejecutables por esta mejora ni cobertura total de PDF. Main intacto.

Siguiente tanda 67: auditar otras listas que invitan a elegir sin guardar acción; selección con varias líneas del mismo SKU, preservar opciones compatibles al pasar a combo, preguntas intermedias y regreso al cierre. Verificar respuesta + estado + carrito + DTO, incluyendo resultados negativos; no usar conteos como criterio de venta. Global única con fuente congelada, ráfagas aisladas, resto cuatro workers, inventario/hashes exactos; timeout 15000 solo margen del runner.

## VIGENTE — preferencias de sabor y abundancia antes de elegir producto (20/10, tanda 65)

Base 03ba0adc. Prioridad cambiada por nuevos chats reales: «Quiero algo picante» recibía producto inexistente; «Quiero Un Pollo con arta papa» perdía la separación plato/nota al ofrecer alternativas. El segundo sí requiere elegir presentación, pero no negar el plato ni perder la nota.

35 casos nuevos: 18 pedidos ambiguos (pollo, bowl, pasta × arta/harta/bastante × agente simulado on/off), 12 consultas de preferencia (picante/dulce/ligero × carrito vacío/existente × on/off), tres límites para no absorber compras/dirección y dos secuencias exactas con el catálogo PPP. Los 18 pedidos comprueban selección numérica contra la lista efectivamente ofrecida, una sola línea, cantidad y nota en DTO de orden simulada. Baseline 30 fallos/3 verdes; después se añadieron dos casos exactos. Primera corrección dejó seis fallos por asumir orden de lista del fixture: se corrigió el test para verificar el ID que realmente se ofrece como 1, no se cambió el orden productivo. Primer focalizado 102 verdes (35 nuevos + 67 existentes). Primera global: 15 fallos/13186 verdes; expansión general de abundancia recortaba/duplicaba notas anteriores en platos concretos. Se restringió la expansión al camino de familia ambigua antes del fallback, dejando el parser anterior para platos concretos. Recuperación intermedia mostró ocho casos de pollo aún interceptados antes de la nueva rama; se adelantó la rama. Recuperación final 88 verdes (incluye los 15 fallos y las 35 nuevas); TypeScript general/build y 92 Node verdes. No modificar expectativas antiguas de notas para ocultar regresiones.

Regla general: separar intensificadores de acompañamiento con gramática acotada; pasar nota a pendingMatch durante la elección de familia. Preferencia sin plato recibe orientación por categorías actuales, sin agregar producto ni afirmar propiedad no verificada. No se promete extra gratis ni se cobra una porción no pedida. No hay excepciones PPP en runtime.

Global final: 13201 pruebas / 149 suites, inventario exacto y 445 hashes intactos. Ráfagas 80 + resto 13121. Evidencia whatsapp-preference-discovery-validation-2010.json; logs /tmp/ppp-t65-final-result.log.

Despliegue agrupado 64–65 verificado el 20/10 a las 22:01 Bogotá (2026-10-21T03:01:25.918Z): código 4ce3addd80a931976b837b094496f4e0e373ce35, imagen 945f4848705c2cca4f34376b00183c77274494ca36e27ae512f890cf088215e8, running/healthy, cero reinicios, health OK/DB connected/circuit CLOSED. Primer probe starting/200; segundo healthy/200. Producción conserva c5e97ab1f09502b3a64a73fb332665395f9e6054349b7195bc3d58081bf4559e. Rollback ppp-nest-staging:rollback-before-4ce3addd; bin/ privado, bases y volúmenes preservados. Commit documental posterior no requiere rebuild.

Límites: modelo/servicios simulados, cero API pagada/Meta/órdenes externas; no acredita precisión del modelo ni audio real. Recomendación por preferencia es aclaración orientada, no ranking de platos por ingredientes. Solo building_cart sin selección pendiente; redacciones fuera de gramática, dietas, alergias, preferencias durante atributos y consultas mixtas quedan pendientes. No afirmar cobertura universal ni todos los PDF por los conteos. La tanda 64 trataba navegación por categorías, no estos dos comportamientos.

Siguiente tanda 66: preferencias mientras se eligen sabores y consultas de contenido/tiempo en listas; preservar carrito, resolver pregunta y reanudar el paso. Añadir controles de producto concreto con nota y compra extra separada; no ampliar silenciosamente una regla sin baseline. Global en particiones con ráfagas aisladas, resto cuatro workers y timeout 15000 del runner; fuente congelada, inventario exacto y hashes al terminar. Main intacto.

## VIGENTE — filtrar categorías y disponibilidad parcial (20/10, tanda 64)

Base 7ec1ff35. 36 recorridos nuevos: tres menús (pizzas/pastas, carnes/pescados, postres/bebidas), agente simulado on/off, carrito vacío/existente. Incluyen «mejor solo [categoría]» después de una lista y consulta por categoría disponible/ausente en ambos órdenes. Comprueban respuesta, carrito intacto, estado building_cart, ausencia de orden externa y selección numérica posterior correcta.

Baseline: 36 fallos. Primera corrección: 85/91 focalizados; quedaban seis fallos de filtrado con carrito existente por prioridad del enrutamiento. Corrección final: filtrar la lista ofrecida antes de editores del carrito, solo cuando el texto corresponde a la categoría; informar categorías ausentes sin descartar las opciones disponibles. 91 focalizados verdes, TypeScript general/build y 92 Node verdes. Se sustituyó un control antiguo que exigía rechazar categorías conocidas+ausentes por recorridos de la nueva conducta; no se omitió silenciosamente.

Global congelada: 13166 pruebas / 148 suites, inventario exacto, 444 hashes intactos; partición de ráfagas 80 y resto 13086. Evidencia: docs/whatsapp-category-reconsideration-validation-2010.json. Log local /tmp/ppp-t64-result.log.

Publicar solo staging; despliegue agrupado pendiente, runtime anterior sigue tanda 63 (fc8df6d7). Main/prod intactos. Cero llamadas pagadas, mensajes WhatsApp u órdenes externas. No declara vendible ni acredita precisión/latencia del modelo real. No se cerraron órdenes: el contrato de esta tanda termina al seleccionar el producto, por eso no hay DTO de cierre nuevo.

Siguiente tanda 65: consultas de contenido/tiempo mientras se muestra una lista, cambio de categoría durante sabores y checkout; confirmar respuesta útil, pedido intacto y recuperación del paso pendiente. Controles de condiciones «sin huevo/sin gluten», intención mixta consulta+compra, todas las categorías ausentes y categorías no ofrecidas siguen siendo límites: no darlos por resueltos por esta tanda. Ampliar solo a partir de reproducción, preservar reglas de catálogo y no usar nombres/IDs PPP en runtime. No afirmar cobertura completa de PDF sin trazabilidad. Ejecutar focalizados primero; global única solo tras cambios compartidos, ráfagas separadas, cuatro workers, fuente congelada e inventario/hashes exactos. testTimeout=15000 es margen del runner, no SLA.

## VIGENTE — consultas básicas encadenadas por categorías (20/10, tanda 63)

Desplegada únicamente en staging el 20/10 a las 19:38 Bogotá: código fc8df6d768ea59b0bdca854d6533078cf734d005, imagen e13c2e75606d934ad7e1dfbb893ff4411c369a87c19ec0d3d69e7e0be4201bc3, healthy/cero reinicios, health OK, DB connected, circuito CLOSED. Producción conserva c5e97ab1f09502b3a64a73fb332665395f9e6054349b7195bc3d58081bf4559e; bin/ privado, bases y volúmenes preservados. Rollback ppp-nest-staging:rollback-before-fc8df6d7.

Base 7583292d. 56 casos nuevos: tres menús (carnes/pescados, pizzas/pastas, postres/bebidas), agente simulado on/off, carrito vacío/existente, audio con transcripción simulada y texto. Incluye frase real «Quiero algo como de carne. ¿Qué tiene de carne? O de pescado, ¿qué tiene de pescado?», pregunta con «o», preguntas separadas, carta con saludo, repetición sin duplicar y selección numérica posterior. Comprueba respuesta, carrito intacto, estado, ausencia de orden y compra posterior correcta.

Baseline 24 fallos / 24 verdes de 48; los saludos/carta ya pasaban. Corrección general: separar cláusulas explícitas de consulta, resolver cada una contra categorías/conceptos del catálogo, reunir candidatos únicos y mantener una lista seleccionable antes del rechazo por producto inexistente. Ninguna excepción por nombres o IDs PPP. Dos controles nuevos detectaron descarte de «sin gluten/sin huevo»; el compositor ahora declina esas condiciones y cualquier cláusula no reconocida. Esto NO acredita respuesta nutricional correcta en el flujo restante.

147 focalizados (120 router + 27 catálogo), TypeScript/build, 92 Node. Global congelada: 13131/147, inventario exacto, 443 hashes intactos; testTimeout=15000 del runner, no certificación de latencia. Cero llamadas pagadas, Meta u órdenes externas. Evidencia whatsapp-basic-category-validation-2010.json. Una invocación focalizada apuntó a un archivo inexistente: se corrigió la ruta, no las expectativas.

Siguiente tanda 64: preguntas básicas con cambio de opinión («mejor solo…»), una categoría conocida y otra ausente, pregunta de contenido/tiempo junto a navegación; luego cruzarlas con nombre/dirección/pago/confirmación. Mantener matriz de comportamiento y resultado esperado, no solo paráfrasis/conteos. En cada conversación comprobar consulta→respuesta→pedido intacto→continuación correcta, y DTO cuando cierre. No dar por cubiertos escenarios descartados por guards ni los chats PDF sin trazabilidad. Estado de alcance: solo building_cart y categorías reconocidas; pendiente selección de atributos y consultas de categorías durante cierre.

## VIGENTE — solicitudes ignoradas fuera de catálogo (20/10, tanda 62)

Despliegue agrupado 61–62 verificado el 20/10 a las 19:17 Bogotá: código 7d0151a33e997017b66c71019893426d1f3d5a25, imagen de589f3ffde242d6ae35ada8be526ce49a677bd4f5224acac6ccf08b4ca1e51f, healthy, cero reinicios, health OK/DB connected/circuit CLOSED. Producción intacta. Casos de categorías aún pendientes en whatsapp-multicategory-pending-2010.json: son fixtures propuestos, no pruebas ejecutadas.

Base f2969077, lote integrado con tanda 61. 64 casos nuevos: 48 recorridos con tres productos/catálogos, presente/ausente, carrito vacío/existente, audio/texto, agente simulado on/off, con insistencia tras rechazo; 13 exclusiones de otras intenciones y tres sabores. Baseline inicial 12 fallos / 12 verdes. Solicitudes simples explícitas sin coincidencia reciben rechazo nombrado y alternativas del catálogo cuando existen; carrito conservado. No hay excepciones por nombres/IDs PPP. No interceptar opciones pendientes, modificaciones ni frases compuestas. Audio usa descarga/transcripción simuladas; el texto real se confirmó mediante lectura de mensajes de staging.

Primera global: 13066 verdes y seis fallos (regresión «mora en leche» + cinco timeouts). Se corrigió sabor reutilizando resolveStandaloneDrinkOrder; contraste aislado pasó. Recuperación aislada de ráfagas: 93 verdes y un timeout distinto. Global final con testTimeout=15000 (solo runner, no SLA): 13075/146, inventario exacto, 442 hashes intactos. TypeScript/build y 92 Node. No ocultar fallos anteriores ni afirmar precisión/latencia real por mocks. Evidencia whatsapp-unhandled-product-validation-2010.json. Cero API/Meta/órdenes externas. Main intacto.

Nuevo fallo pendiente, audio recibido durante validación: «Quiero algo como de carne. ¿Qué tiene de carne? O de pescado, ¿qué tiene de pescado?». Transcripción correcta confirmada en staging. Bot respondió ausencia de «carne o de pescado que tiene de pescado». No está corregido por tanda 62. Priorizar tanda 63: consultas con varias categorías y reformulación/repetición; varios menús, audio/texto, carrito vacío/existente; no mutar pedido, mostrar opciones reales o aclarar, nunca buscar toda la frase como un SKU. Revisar unavailableAskReply y findCategoryBrowseHit; no añadir excepciones carne/pescado. Después ampliar desconocidos con productos válidos y elecciones pendientes.

## VIGENTE — consultas combinadas y fallo real de productos no atendidos (20/10, tanda 61)

Base f2969077. 72 casos nuevos: tres menús sintéticos, agente simulado on/off, pago/confirmación, pregunta de contenido o tiempo junto con cambio explícito de nombre/teléfono/dirección, en ambos órdenes. Baseline 72 fallos; corrección separa consulta independiente y deja la modificación al flujo existente. Valida respuesta del turno completo, carrito, estado y DTO único. Límites: una pregunta delimitada por puntuación, formas explícitas de cambio; no acredita toda redacción libre.

Validación: 120 focalizados, TypeScript/build TypeScript, 92 Node. Global congelada 13011 pruebas / 145 suites; inventario exacto y 441 hashes intactos. Evidencia: whatsapp-checkout-mixed-inquiries-validation-2010.json. Cambios locales validados, todavía no desplegados. Runtime continúa tanda 60. Main intacto. Cero llamadas pagadas, WhatsApp u órdenes externas.

Prioridad siguiente: peticiones ignoradas de productos fuera de catálogo, tanto audio como texto. Consulta de solo lectura a mensajes de staging confirmó transcripciones: «Hola vecino, quiero un sancocho trifásico, por favor.» y «Te acabo de decir que quiero sancocho trifásico, por favor.»; ambas recibieron invitación genérica. «un aguardiente» recibió solo carrito existente. Esto acredita fallo posterior a transcripción, no mala transcripción. Archivo original recibido en Downloads (WhatsApp Ptt 2026-10-20 at 4.55.05 PM.ogg), no reenviado ni transcrito de nuevo. No declarar solucionados estos casos todavía.

Próxima reproducción: catálogo con/sin producto, carrito vacío/con contenido, cortesía y reiteración, varios menús; entrada de audio con transcripción simulada por pipeline y entrada de texto. Comprobar que producto conocido se procesa y desconocido recibe respuesta explícita sin alterar carrito ni inventar disponibilidad. Investigar fallback/guardas antes de modificar modelo. Las fechas serializadas por mysql2 mostraron desplazamiento horario; correlación basada en contenido y secuencia, no tomar esa serialización como hora UTC comprobada.

## VIGENTE — consultas y cambios durante cierre (20/10, tanda 60)

Despliegue agrupado 59–60 verificado 2026-10-20T21:46:45.124Z: staging 95c0860b43d50583103e5fbf61484761ac973dcb, imagen b00a298223c70c5f6fb0acdc6ba7fe9b6bf4e7ee99a6fd0548b901124aef21d4, running/healthy, cero reinicios, /api/health OK, DB connected, circuito CLOSED. Primer probe durante arranque 502; siguiente healthy/200. Producción conserva c5e97ab1f09502b3a64a73fb332665395f9e6054349b7195bc3d58081bf4559e. Rollback ppp-nest-staging:rollback-before-95c0860b; bin/ privado, bases y volúmenes preservados. Commit documental posterior no requiere reconstrucción.

Base 02b0da40. Nueva suite whatsapp-checkout-question-recovery.spec.ts: 30 recorridos, tres menús (bowl, pizza, pescado), cinco estados (nombre/dirección/teléfono/pago/confirmación), agente simulado on/off. Compra por router, luego estado/datos faltantes preparados explícitamente. Pregunta precio y solicita carrito sin mutar nombre, dirección, teléfono, carrito o paso. Completa el dato faltante, cambia destinatario y teléfono, confirma una única orden con nuevos datos y nota sin cebolla conservada.

Baseline 30/30 verdes; se fortalecieron los mismos casos con cambio de nombre y comprobación de respuesta/DTO. No se requirió modificar runtime. Final 68 focalizados (suite nueva + recorridos desde saludo + envelope), TypeScript/build y 92 Node. No repetir global por solo pruebas/documentación: última global acreditada 12909/143 de tanda 59; no presentar 12939 como una global ejecutada. Evidencia whatsapp-checkout-question-recovery-validation-2010.json. Cero API pagada, WhatsApp y órdenes externas.

Tandas 59–60 publicadas y desplegadas únicamente en staging, con verificación indicada arriba. Main intacto.

Siguiente tanda 61: trazabilidad de chats del PDF y controles de preguntas de contenido/tiempo con cambio de datos en un mismo turno, referencias ambiguas y negaciones durante cierre; combinar con recorridos desde saludo donde no haya reproducción completa. Priorizar casos reales pendientes sobre más paráfrasis de estas dos consultas. Modelo/servicios simulados, menús simples sin sabores; los estados de cierre de esta suite se preparan, no se alcanzan desde saludo. No acredita todas las preguntas ni todos los chats del PDF. Muestra reservada real/costo/latencia sigue siendo puerta de piloto.

## VIGENTE — conversaciones desde saludo y destinatario de entrega (20/10, tanda 59)

Base 5fa407dd. Nueva suite whatsapp-from-greeting-checkout.spec.ts: 18 conversaciones, tres menús, agente simulado on/off, carrito vacío desde saludo. Pedido con poquito arroz/poquita ensalada sin comprar acompañamientos; pedido y datos completos juntos; datos posteriores y consulta de precio/corrección de dirección durante pago. Cierre hasta DTO y agradecimiento sin segunda orden. Cinco guardas nuevas en checkout-envelope para formulario sin compra y cláusulas adicionales ambiguas.

Baseline: 12 fallos / 6 verdes. Los seis pedidos con datos juntos ya pasaban; los doce con datos en mensaje posterior conservaban Wilmer en vez de Carlos Torres. Corrección: checkoutEnvelope acepta encabezado «Para domicilio»/«Domicilio» sin productos solo cuando ya existe carrito; conserva validaciones estrictas de destinatario/teléfono/calle/referencias. No descarta cláusulas adicionales ni adivina datos. Aplica nombre y contacto y continúa la ruta existente de dirección. Sin excepciones de menú/ID PPP.

Validación: 38 focalizados, TypeScript/build TypeScript, 92 Node. Global congelada: 12909 pruebas / 143 suites, inventario exacto y 439 hashes intactos, cero fallos/reintentos. Evidencia whatsapp-from-greeting-validation-2010.json. Publicar únicamente staging; despliegue diferido para agrupar con tanda 60. Runtime acreditado sigue ccb6a395 (57–58). Main intacto, cero API pagada/WhatsApp/órdenes externas.

Siguiente tanda 60: consultas y correcciones durante nombre, dirección, teléfono, pago y confirmación, con seguimiento hasta cierre; priorizar casos del usuario y trazabilidad PDF→test→commit→runtime. Después evaluación reservada real/costo/latencia para decidir piloto. Esta tanda usa perfil conocido, carrito vacío y servicios/modelo simulados, tarifa fija; no acredita mapas reales ni formularios libres o cualquier orden de campos. No declarar todos los chats PDF resueltos. Plan: WHATSAPP-PILOT-EXECUTION-PLAN-2010.md.

## VIGENTE — recuperación sin alternativas y plan de piloto (20/10, tanda 58)

Despliegue agrupado 57–58 verificado 2026-10-20T21:28:00.411Z: staging ccb6a39587d8e1f3b056039d83be54407951c406, imagen a6d3e57d5bc6b03a31429344d5528e23d0ee9ca33b93ed940d1963d7f6c34d4b, running/healthy, cero reinicios, /api/health OK, DB connected, circuito CLOSED. Primer chequeo durante arranque respondió 502; siguiente chequeo tras 15s pasó. Producción conserva c5e97ab1f09502b3a64a73fb332665395f9e6054349b7195bc3d58081bf4559e. Rollback ppp-nest-staging:rollback-before-ccb6a395; bin/ privado, bases y volúmenes preservados. Commit documental posterior no requiere reconstrucción.

Base f2187263. 36 casos nuevos en whatsapp-pending-alternative-recovery.spec.ts: tres menús, agente simulado on/off, lista vacía inicialmente, retirada de todas las alternativas y código inválido; cada escenario termina eligiendo sabor original o cancelando solo la bebida. Se comprueban respuesta, carrito, pendiente, retorno al pago y DTO único con cantidades/notas/contacto/dirección conservados.

Baseline: 24 fallos / 12 verdes. Lista vacía saltaba el guard de alternativas y la retirada completa todavía pedía «elige otra». Corrección general: distinguir lista ofrecida vacía de ausencia de lista; rechazar códigos fuera del conjunto y, si no hay opciones, mostrar sabor pendiente/cancelación en lugar de una selección imposible. No modifica catálogo ni productos PPP.

Validación: 198 focalizados, TypeScript/build TypeScript y 92 Node. Global congelada 12886 pruebas / 142 suites; inventario exacto, 438 hashes intactos, cero fallos/reintentos. Duración 110.1s ráfagas + 371.7s resto (~8min). Evidencia whatsapp-alternative-recovery-validation-2010.json. Cero llamadas pagadas, WhatsApp u órdenes externas. Publicadas y desplegadas únicamente en staging las tandas 57–58, con verificación indicada arriba. Main intacto.

Plan vigente: [Plan de piloto](WHATSAPP-PILOT-EXECUTION-PLAN-2010.md). Próxima prioridad tanda 59: recorridos desde saludo (notas sin adicionales, todos los datos juntos, corrección durante pago) con varios menús y DTO. Luego tanda 60: interrupciones cruzadas de cierre y matriz PDF→chat→prueba→commit→runtime; después muestra reservada real y costo/latencia antes de decidir piloto supervisado. No seguir indefinidamente ampliando variantes de alternativas. PDF18/10 leído según auditoría, no todos los chats completos acreditados. Los mocks con checkout sembrado no prueban comprensión inicial, mapas o medios reales. Sigue pendiente retirar también la bebida original, productos nuevos y alias de sabor; registrar como huecos, no como resueltos.

## VIGENTE — alternativas renombradas y códigos cambiantes (20/10, tanda 57)

Base caff85d7. Nueva suite whatsapp-pending-alternative-renamed.spec.ts: 36 recorridos en tres menús sintéticos, agente simulado on/off. Cambio simultáneo de nombre y código después de ofrecer alternativas: elegir por nombre anterior/nuevo y código anterior/nuevo; colisión del alias o código anterior con otra alternativa ofrecida. Verifica respuesta, carrito, pendiente, retorno a pago y DTO único conservando plato previo, dos bebidas sin hielo, contacto y dirección.

Baseline inicial 24: 12 fallos (referencias nuevas), 12 verdes (anteriores). Se añadieron 12 contrastes de colisiones. Corrección general: combinar identidad ofrecida y catálogo actual, deduplicar por ID estable; no ampliar a productos no ofrecidos. Si dos IDs coinciden, aclarar mostrando nombre/código actuales y no comprar arbitrariamente. Precio y disponibilidad siguen leyéndose del catálogo vigente. Sin excepciones PPP ni migración.

Validación: 162 focalizados, TypeScript y build TypeScript, 92 Node. Global congelada: 12850 pruebas / 141 suites, cero fallos/reintentos, inventario exacto y 437 hashes intactos. Evidencia: whatsapp-alternative-renamed-validation-2010.json.

Publicar solo staging; despliegue diferido para agrupar con siguiente tanda. Runtime acreditado permanece 30cffa27 (55–56); no se ha desplegado esta corrección. Main intacto. Cero llamadas pagadas, WhatsApp u órdenes externas.

Siguiente tanda: listas vacías inicialmente o tras retirar todas las alternativas, cancelación tras códigos inválidos, volver al sabor original y retomar cierre. También pendientes: productos nuevos después de ofrecer, alias coincidente con sabor y recorridos desde saludo. Se acotó esta tanda a identidad cambiante para cerrar una corrección coherente. Límites: checkout sembrado, modelo/mapas/servicios simulados, nombres exactos/prefijos por palabra; no acredita cualquier redacción ni precisión real. Mantener muestra reservada real, costo/latencia y trazabilidad antes de declarar venta autónoma.

## Estado vigente — 20/10, tanda 56

Despliegue agrupado 55–56 verificado 2026-10-20T20:58:40.916Z: staging 30cffa27c05a74a84d2b43b11b1754fa71de9df0, imagen aa0b13c19f1fef9d385a83477ae857f6decdbced27beee42cea9656cd35b2b7e, running/healthy, cero reinicios, /api/health OK, DB connected, circuito CLOSED. Producción conserva c5e97ab1f09502b3a64a73fb332665395f9e6054349b7195bc3d58081bf4559e. Rollback ppp-nest-staging:rollback-before-30cffa27; bin/ privado, bases y volúmenes preservados. El commit posterior de documentación no requiere reconstrucción.

48 casos nuevos: alternativas retiradas, códigos no ofrecidos y consultas sin compra. Validación: 258 focalizados, TypeScript/build TypeScript, 92 Node. Global congelada: 12814 pruebas / 140 suites, cero fallos/reintentos; inventario exacto y 436 hashes intactos. Evidencia whatsapp-alternative-catalog-validation-2010.json.

Siguiente: listas vacías, cambio de nombre/código, alias coincidente con sabor y cancelación tras errores. Modelo/servicios simulados; no acredita venta autónoma. Main intacto; cero llamadas pagadas. Despliegue acreditado en encabezado vigente.

## Estado vigente — 20/10, tanda 55

36 casos nuevos: nombres cortos únicos/ambiguos, duplicados y agotamiento después de ofrecer alternativas. Validación: 210 focalizados, TypeScript/build TypeScript, 92 Node. Global congelada: 12766 pruebas / 139 suites, cero fallos/reintentos; inventario exacto y 435 hashes intactos. Evidencia whatsapp-alternative-identity-validation-2010.json.

Publicar solo staging; despliegue diferido para agrupar. Runtime sigue 6bba0c4e. Siguiente: productos retirados, códigos no ofrecidos y consultas de alternativas. Pruebas simuladas; no acredita precisión real ni venta autónoma. Main intacto, cero llamadas pagadas.

## Estado vigente — 20/10, tanda 54

Despliegue agrupado 53–54 verificado 2026-10-20T20:35:43.534Z: staging 6bba0c4eac1586a2381ac852218bed9f42191c4f, imagen aa581ba8a064a707f12eb80b5a268499d2ad5de9d10ee640f9f8efbe962c2d78, running/healthy, cero reinicios, /api/health OK, DB connected y circuito CLOSED. Producción conserva c5e97ab1f09502b3a64a73fb332665395f9e6054349b7195bc3d58081bf4559e. Rollback ppp-nest-staging:rollback-before-6bba0c4e; bin/ privado, bases y volúmenes preservados. El commit posterior de documentación no requiere reconstrucción.

42 casos nuevos en tres menús: alternativas ambiguas, sabores disponibles/inexistentes, contenido/precio y seguimiento por nombre o retorno al sabor original. Validación: 280 focalizados, TypeScript/build TypeScript, 92 Node. Global congelada: 12730 pruebas / 138 suites, cero fallos/reintentos; inventario exacto y 434 hashes intactos. Evidencia whatsapp-pending-drink-questions-validation-2010.json.

Siguiente: consultas sobre alternativas mostradas, nombres abreviados/duplicados y disponibilidad cambiante. Modelo/servicios simulados; no acredita precisión real. Main intacto, cero llamadas pagadas. Despliegue acreditado en encabezado vigente.

## Estado vigente — 20/10, tanda 53

36 casos nuevos: precio de bebida pendiente, total de dos y formulaciones explícitas de reemplazo. Validación: 238 focalizados, TypeScript/build TypeScript, 92 Node. Global congelada: 12688 pruebas / 137 suites, cero fallos/reintentos; inventario exacto y 433 hashes intactos. Evidencia whatsapp-pending-drink-price-validation-2010.json.

Publicación solo staging; despliegue diferido para agrupar. Runtime sigue 132a846c. Siguiente: alternativas ambiguas, disponibilidad/composición durante sabor, precio con cambios hipotéticos y recorridos desde saludo. Modelo/servicios simulados; no acredita precisión real. Main intacto, cero llamadas pagadas.

## Estado vigente — 20/10, tanda 52

Despliegue agrupado 51–52 verificado 2026-10-20T19:49:13.611Z: staging 132a846c1c6b97c459ebe234679ee5b8f666ad21, imagen 0cf66f5f90a914984629d01bb5531c92bca2b7a987cfd084d55165fbc5a4585b, running/healthy, cero reinicios, /api/health OK, DB connected, circuito CLOSED. Producción conserva c5e97ab1f09502b3a64a73fb332665395f9e6054349b7195bc3d58081bf4559e. Rollback ppp-nest-staging:rollback-before-132a846c; bin/ privado y volúmenes preservados. El commit posterior de documentación no requiere reconstrucción.

42 casos nuevos: correcciones de contacto repetidas durante sabor y sabor+datos juntos. Validación: 202 focalizados, TypeScript/build TypeScript, 92 Node. Global congelada: 12652 pruebas / 137 suites, cero fallos/reintentos; inventario exacto y 433 hashes intactos. Evidencia whatsapp-mixed-flavor-contact-validation-2010.json.

Siguiente: formulaciones variadas de reemplazo, precio durante sabor, recorridos desde saludo. Modelo y servicios simulados; piloto aún requiere muestra reservada real y costo/latencia. Main intacto. Despliegue acreditado en el encabezado vigente.

## Estado vigente — 20/10, tanda 51

54 casos nuevos en tres menús: cambio de bebida durante sabor pendiente y captura anticipada de nombre/teléfono/dirección; preservan unidades, notas y orden simulada. Global final congelada: 12610 pruebas / 137 suites, cero fallos, inventario exacto y 433 hashes intactos. 92 controles Node aprobados. Segunda global tras corregir la regresión; no un reintento sin cambios. Evidencia whatsapp-pending-drink-interruptions-validation-2010.json.

Publicar solo staging; despliegue diferido para agrupar, runtime sigue e893e3ca. Próximo: datos y sabor en una frase, correcciones de datos, formulaciones variadas y recorridos desde saludo. Piloto aún requiere muestra reservada real, costo/latencia y trazabilidad. Cero API pagada/WhatsApp/órdenes externas; Main intacto.

## Estado vigente — 20/10, tanda 50

Se validaron selección de sabor, reducción/cancelación y retorno a nombre/teléfono/dirección en tres menús. Validación: 66 nuevos + 246 relacionados = 312 focalizados, TypeScript/build TypeScript, 92 Node y diff check. Global congelada: 80 ráfagas + 12476 resto = 12556 / 136 suites, cero fallos/reintentos, inventario exacto y 432 hashes intactos. Tiempos [109.723, 361.031]. Evidencia whatsapp-conditional-flavor-validation-2010.json. No se cambió fuente/tests después de global.

Despliegue agrupado 49–50 verificado: e893e3ca, healthy, /api/health OK a las 18:37:02Z; producción intacta. Después: consultas durante sabor, cambio a otro producto, datos de contacto antes de terminar la selección y recorridos desde saludo. Piloto supervisado sigue requiriendo muestra reservada real, costo/latencia y trazabilidad de chats; los mocks no acreditan precisión de modelo, audio o mapas.

## Estado vigente — 20/10, tanda 48

Runtime staging 805136eb, healthy verificado 17:49:45Z. La respuesta conserva evidencia genérica de bebida incluida y muestra nombres/códigos/volumen del catálogo sin afirmar gaseosa. Global 12.450 / 134 suites, 32 casos nuevos, cero inferencia pagada. Producción intacta. Ver evidencia whatsapp-generic-drink-validation-2010.json y relevo vigente.

Pendiente principal de la siguiente tanda: continuación de aclaraciones de compra condicional, lenguaje sin puntuación, conservación de cantidad/opciones y retorno al checkout; después muestra real reservada y matriz de chats con versión. Las pruebas simuladas no acreditan comprensión real ni cobertura completa. Encabezados siguientes históricos.

## Estado vigente — 20/10, tanda 47

Tandas 45–47 publicadas y desplegadas solo a staging: runtime 7057ec9b, healthy verificado 17:30:35Z. Global 12.418 pruebas / 133 suites; no equivale a tasa de comprensión real. Se corrigieron evidencia de inclusión de bebida, consulta durante cierre y compra condicional, con DTO simulado. Main intacto.

Siguiente puerta: condiciones libres, consultas con cambio de sabor, recuperación de aclaraciones, reproducción completa desde saludo; luego evaluación reservada real con costo/latencia y matriz PDF→test→commit→runtime. Las dependencias externas están simuladas en esta tanda; no acredita mapas, medios o modelo real. No declarar vendible por conteos. Ver WHATSAPP-LOCAL-NEXT-AGENT.md y whatsapp-conditional-drink-validation-2010.json. Los encabezados siguientes son históricos.

## Estado de validación actualizado — 20/10, tanda 45

El relevo vigente es WHATSAPP-LOCAL-NEXT-AGENT.md. Hay 12.328 pruebas en la global documentada; no son una tasa de comprensión ni prueba de que todos los chats reales estén cubiertos. La revisión de aserciones encontró cuatro compras incorrectas ocultas por tests que solo miraban una frase. Se fortalecieron y corrigieron, junto con evidencia de bebida incluida y un inicio truncado de pedido.

Prioridades antes del piloto: (1) respuesta y carrito coherentes, cantidades/notas/opciones y DTO final en familias recientes; (2) mismas consultas durante cada estado de checkout, con negaciones, datos incompletos y correcciones; (3) matriz de chats reales con versión y prueba asociadas, sin marcar como resuelto solo por parecido; (4) muestra reservada con modelo real, medios originales, costo y latencia; (5) piloto supervisado con cero errores críticos conocidos sin contención. Los tests de corrección con carrito sembrado no acreditan comprensión inicial; los mapas y modelos simulados no prueban precisión real. No promover a Main automáticamente.

Último runtime acreditado por relevo: 3812417c; la tanda 45 aún no se desplegó. Las secciones siguientes conservan historia y no deben usarse como estado actual del servidor. Evidencia: whatsapp-inclusion-evidence-validation-2010.json.

## Revisión vigente de conversaciones del 18 de octubre

Prioridad acordada tras analizar el archivo de chats de las 14:16 a las 17:08: integridad del pedido, direcciones y cierre. Esta revisión sustituye el orden de trabajo anterior; la conversión parcial a combo queda detrás de estos riesgos. Es análisis y plan, sin nuevas pruebas ni correcciones de ejecución en este turno.

Fuente local: adjunto a9b4e009-3d70-4e8b-a335-1c2bbbf075ce/Pasted text.txt. Se leyeron 309 mensajes y 21 comprobantes; no equivalen a 21 pedidos correctos. No copiar teléfonos, base64 ni datos personales del adjunto a fixtures públicos: usar sustitutos. Las imágenes y audios omitidos no permiten auditar su reconocimiento original. Los chats no identifican commit/modelo efectivo; no atribuir los fallos a staging actual ni declararlos resueltos sin reproducción. Base local revisada fd7c4321, rama staging limpia. Último runtime acreditado por relevo: 0a1b7585; no se comprobó servidor en esta revisión.

### Lo que funciona y debe conservarse

- Selección de variante de arroz con medio pollo; pedidos por código; pollo y medio descompuesto en un entero y un medio.
- En varias conversaciones, la dirección después del producto ya lleva a pago sin exigir «nada más».
- Cambio de bebida incluida correcto a las 15:16, Ginger a las 15:19 y Coca Cola Zero en combo explícito a las 15:26. El mismo comportamiento falla en otra formulación a las 15:31: no está consolidado.
- Actualización de teléfono finalmente reflejada en muchos resúmenes y comprobantes; «sí» y «confirmar» completan varios pedidos.
- Cambio tardío de dirección a las 14:39 conserva carrito y pago; complemento de torre/apartamento a las 15:26 se conserva.
- La dirección con calle sin nombre de conjunto permite recuperar Plazuela a las 16:23. La ubicación compartida se presenta sin coordenadas crudas en varios mensajes.
- El menú ejecutivo de las 16:22 conserva presa, sopa y nota. El cambio a recoger a las 16:50 elimina domicilio.
- El flujo muestra sustitución del enlace cuando cambia el carrito con Mercado Pago. El texto no acredita que el enlace anterior quede realmente inutilizable ni que el pago se haya conciliado.

Estos son aciertos observados, no una tasa comparativa de mejora. Hay progreso visible en el recorrido, pero también pedidos confirmados con errores.

### Inventario de hallazgos por conversación

1. 14:16–14:17. Producto/variante correctos. Foto con texto «así nada más» termina en aclaración de plato y no cierre. Separar intención del texto y resultado de visión; si la imagen pudiera modificar el pedido, aclarar solo esa incertidumbre. Sin la imagen no afirmar que debía reconocerse.
2. 14:20–14:22. «Me regalas medio y qué vale un plátano» contiene compra contextual y consulta. Repite la ficha del medio pollo y omite el plátano; «sí» acaba reutilizando una dirección con carrito vacío. Riesgo de resolver una oferta con la selección equivocada.
3. 14:23–14:25. Dirección más «sin ensalada» se reconoce verbalmente pero el siguiente paso ofrece la dirección anterior y pierde la nota hasta repetirla. El teléfono sí acaba guardado, aunque la respuesta solo repite pago. Nota visible en carrito pero ausente del comprobante: revisar DTO antes de concluir que cocina no la recibió.
4. 14:26–14:27. Productos correctos. Ráfaga con Tv y «no» produce pregunta de barrio y luego dirección anterior. Después recupera dirección, teléfono y transferencia. El archivo completo sí contiene selección de pago y «sí»: no fue una orden sin confirmar según esta secuencia.
5. 14:31–14:34. Reconoce producto de imagen y cierra. Limpieza incompleta de prefijos deja «Esta es la Calle». Teléfono guardado sin reconocimiento explícito en la respuesta.
6. 14:35–14:39. Imagen y variante correctas. «depapa» genera falsa indisponibilidad mientras ofrece el producto equivalente. Repetición sin typo añade la porción; nueva dirección tardía se aplica. Resumen de corrección repite dirección y omite parte de los datos que el cliente debe verificar.
7. 15:05–15:09. Pedido largo omite dos mondongos y recorta «San Felipe Castilla» a «Castilla». La primera corrección es ignorada durante pago. Tras repetir, abre selección y recupera cantidad dos. No debería avanzar sin explicar productos pendientes. Enlace actualizado tras cambio de carrito: verificar contrato con revisión del pedido.
8. 15:10–15:12. Combo, calle y unidad interna correctos; cierre exitoso. Fricción repetida al proporcionar teléfono durante pago.
9. 15:15–15:18. Dos sopas pequeñas y cambio de bebida del combo correctos. Teléfono de 11 dígitos no se explica como inválido y se conserva silenciosamente el anterior válido. Mantener el válido está bien; informar rechazo y pedir corrección.
10. 15:18–15:21. Ginger correcto. «por favo» queda en dirección; no resuelve conjunto sin calle, lo cual por sí solo no prueba fallo del mapa. Con calle recupera. Teléfono y pago seguidos generan pregunta redundante antes del resumen.
11. 15:24. «Arroz chino con costillas» se divide en arroz y costillas independientes y pierde la bebida indicada. La existencia del producto compuesto debe resolverse antes de separar ingredientes. No asumir combo sin verificar catálogo e intención de bebida aparte.
12. 15:26–15:27. Combo explícito con Zero correcto. Mapa refiere un número diferente al escrito: 82A38 frente a 82a91. No aceptar equivalencia por cercanía sin revisar precisión. Torre/apartamento se conservan.
13. 15:28. Comprobante #123 vacío, total cero, sin dirección ni pago y sin mensaje de cliente inmediatamente anterior. Hallazgo crítico para investigar logs y origen; el texto no prueba que el router haya creado esa orden ni descarta actividad externa. Ningún camino autorizado del bot debe crear pedido vacío.
14. 15:31–15:36. Combo más Coca-Cola se interpreta como gaseosa extra. Corrección añade un combo mixto no pedido y deja bebida del broaster incorrecta. Eliminar bebida y combo exige pasos adicionales; «no» no cierra, «no más» sí. La orden final mantiene Colombiana aunque se pidió Coca-Cola. Negar un extra debe corregir el plan, sin inventar reemplazos.
15. 15:41. Pedido correcto, pero «Senderos de Castilla» pierde «Senderos» y queda solo Castilla. Cobertura/importe no pueden acreditarse con una coincidencia geográfica tan genérica.
16. 15:44–15:46. Omite medio pollo broaster del primer mensaje; al repetirlo lo añade. Pago y teléfono seguidos producen dos resúmenes, el primero con teléfono antiguo.
17. 15:47–15:50. Pedido por código y ubicación completan flujo. «Ubicación compartida» es legible pero poco útil para verificar destino; conservar pin accesible y añadir dirección aproximada si es fiable. No sustituir coordenadas exactas por un texto aproximado.
18. 15:50–15:53. «Rosaleda 8 303» se asocia con Calle 8 Sur; parece coincidencia débil entre número interno y calle. Teléfono enviado un segundo antes de pago no aparece hasta repetirlo: posible pérdida por ráfaga/estado, por confirmar en logs y test de intercalado.
19. 15:54–15:56. Pollo y medio correctos. «48casa10» no se separa limpiamente y mapa refiere intersección en vez de puerta exacta. Evitar presentar precisión mayor que la disponible.
20. 15:58–15:59. «Un combo de pollo broaster porfaor» produce aclaración genérica sin opciones operables. Al responder «1» añade pollo frito. Toda pregunta debe guardar qué selección o cantidad espera; no convertir respuesta en código global de producto.
21. 15:59–16:01. Combo con Coca-Cola y dirección completa funcionan. Persisten fricción de teléfono y nombre heredado wilmer.
22. 16:06–16:07. Dos ejecutivos distribuidos por preparación y sopa terminan en un ejecutivo y cuatro pollos broaster, con respuesta contradictoria ×2/×4. Fallo crítico de alcance de cantidades, agrupación de atributos y ráfaga. Esperado: exactamente dos ejecutivos, sin pollos enteros ni bebidas/sopas sueltas.
23. 16:17–16:18. «Sin ensalada» en mensaje seguido añade una porción de ensalada y la cobra; la orden se confirma así. Negación debe ser modificación del producto activo, sin alta de la entidad negada. Evaluar también qué hace «sin arroz», «sin salsa», «sin bebida» en todos los estados.
24. 16:22–16:24. Ejecutivo correcto. Dirección completa más conjunto falla; vuelve a preguntar calle ya suministrada, muestra check de dirección a la vez que dice no identificarla y pregunta «algo más». Teléfono desencadena pago pese al bloqueo de ubicación. Sin conjunto la misma calle funciona. Geocodificar calle separada del conjunto/unidad, conservar todos los datos originales y mantener un único pendiente coherente.
25. 16:49–16:50. Consulta de tiempo para recoger responde con tiempo según zona (domicilio). Cambia a recoger pero ignora «mi nombre es Jairo Gutierrez», confirmando wilmer. Procesar modalidad y nombre en el mismo turno; ETA de preparación separado de reparto y solo con datos configurados.
26. 17:04–17:06. Productos y cantidades correctos. Audio omitido produce dirección contaminada; corrección textual sí resuelve. Teléfono enviado junto a dirección requiere repetición. Transferencia aparece sin elección textual visible; puede proceder del audio omitido: investigar antes de atribuir herencia. No evaluar transcripción sin audio original.
27. 17:07–17:08. Tolera «paias» y «coa cola», reconoce bebida incluida y usa ubicación. Cierre correcto según texto, con fricción de teléfono y destino genérico en comprobante.

### Familias causales que se deben verificar

Hipótesis de código, no diagnósticos confirmados de estas ejecuciones: ramas tempranas procesan una sola intención y pierden las restantes; parsers de ingredientes compiten con productos compuestos; selecciones pendientes interpretan números fuera de su contexto; actualizaciones de sesión y respuestas pueden usar revisiones diferentes. Los helpers actuales de formulario y dirección son acotados: checkoutEnvelope exige una estructura concreta y splitDeliveryAddressParts separa solo unidades numéricas etiquetadas. Su existencia y pruebas no acreditan estos chats completos.

Reglas generales de diseño:
- Extraer un plan de turno con compras, modificaciones, consultas, destinatario, teléfono, destino, modalidad, pago y cierre; validar todas las acciones contra catálogo y sesión antes de aplicar.
- Un solo escritor por conversación; procesar cada mensaje con orden estable, deduplicación por ID y revisión de sesión. Una ráfaga puede completarse progresivamente sin perder turnos ni enviar resúmenes obsoletos. No diagnosticar concurrencia solo por la transcripción.
- Distinguir entidad mencionada de entidad comprada: «sin ensalada» no compra ensalada; «con Coca-Cola» dentro de combo suele llenar bebida; «adicional/aparte» permite línea separada. Aclarar si hay más de un producto compatible.
- Toda selección tiene objetivo, opciones, cantidad, estado y revisión. Invalidarla al eliminar/cambiar ese objetivo; un «1» nunca cae al código global si había una selección pendiente válida.
- Respuesta y DTO derivados de la misma sesión persistida. Las afirmaciones «añadido», «actualizado» y «confirmado» deben coincidir con acciones aplicadas.

### Plan de ejecución por lotes

1. Integridad antes del cierre. Reproducir #123 con mocks y revisar trazas solo de lectura si están disponibles; bloquear carrito vacío, producto no válido, cantidad inválida, datos obligatorios o pendientes sin resolver. Confirmación explícita ligada a la revisión mostrada; un cambio la invalida y una reentrega no crea duplicado. Cubrir también DTO con notas y ubicación. Investigar origen del comprobante vacío sin afirmar todavía causa.
2. Ráfagas y turnos múltiples. Fixtures de ejecutivos, «sin ensalada», dirección/teléfono/pago en ambos órdenes y con pausas distintas. Incluir mensajes que llegan mientras hay procesamiento y reintentos. Acreditar cantidad exacta, cero entidades no pedidas y ninguna actualización perdida. Esta tanda precede nuevas optimizaciones de estilo.
3. Dirección estructurada. Separar calle/placa, nombre de conjunto, barrio/ciudad, entrada/torre/casa/apartamento y pin. Precedencia: dato explícito actual sobre histórico; complemento agrega unidad, corrección reemplaza destino. Retirar cortesías/prefijos sin borrar «Senderos» ni «San Felipe». Geocodificar calle o lugar base, no número interno; comparar calle y placa del candidato. Coincidencia de barrio/intersección no es puerta exacta. Conservar texto humano y coordenadas, pedir solo dato realmente faltante; dirección no resuelta no muestra check validado ni habilita cierre.
4. Cierre y contacto. Si hay productos y el cliente da destino/modalidad, pasar al siguiente dato necesario. Teléfono válido: confirmar «Teléfono actualizado» y continuar pago; inválido: explicar qué corregir sin reemplazar el válido. Nombre y pago en un turno se aplican juntos. No repetir carrito completo por cada campo. Reconocer «sí», «así está bien», «no más» según la pregunta pendiente, sin confundir fin de compra con confirmación final.
5. Catálogo e interrupciones. Compra más consulta en el mismo turno, typos unidos y corteses, compuestos, bebida incluida y correcciones negativas. «Me regalas medio y cuánto vale un plátano»: añadir el medio contextual, responder plátano y conservar paso pendiente. «Porfaor» no cambia el plato; «1» responde a su selección. Resolver corrección/pregunta durante pago y reanudar el paso necesario.
6. Mensajería y medios. Texto/caption de imagen conserva intención aunque visión falle; no adivinar contenido omitido. Audios originales cuando existan, transcripción y comprensión evaluadas por separado. ETA según recoger/domicilio y configuración real; ubicación con pin accesible y dirección humana fiable. Comprobante conserva notas y atributos relevantes sin duplicarlos.
7. Validación reservada y piloto. Tras mocks verdes y global de fuente congelada, ejecutar conversaciones reservadas con modelo real en una sesión autorizada con presupuesto explícito; mismas condiciones/modelos en staging y producción comprobadas en runtime. Probar direcciones reales de forma controlada antes de acreditar mapa. Mantener alcance efectivo/transferencia; la configuración de Mercado Pago en este archivo no cambia por este plan.

### Contrato de cierre propuesto

Producto más dirección o recogida inicia checkout si no quedan elecciones. Recoger nombre/contacto faltante, resolver destino y tarifa, y preguntar pago. Si llegan varios datos juntos, aplicarlos juntos. Mostrar una sola revisión compacta con cantidades/opciones/notas, total con domicilio, destino una vez, destinatario/contacto y pago. Pedir confirmación explícita; crear exactamente una orden de esa revisión. Si cambia cualquier campo, actualizar revisión y volver a confirmar. Las consultas no mutan el pedido ni reinician checkout. «No más» termina la compra; no equivale por sí solo a autorizar una orden sin haber mostrado el resumen final.

Ejemplo de teléfono durante pago: «Teléfono actualizado. Total $49.000 con domicilio. ¿Pagas en efectivo o transferencia?». No volver a preguntar productos cuando ya hay intención de cerrar. No pedir «con cuánto paga» antes de saber que eligió efectivo; registrar cambio si el negocio lo requiere.

### Pruebas y criterio de salida

Cada incidente anterior debe tener ID de fixture anonimizado, intención esperada, carrito antes/después, estado, respuesta, llamadas permitidas/prohibidas y DTO exacto. Añadir variantes en al menos tres catálogos sintéticos y PPP sin reglas por nombre/ID; permutar estado de compra, dirección, teléfono, pago y confirmación. Mantener parte de las reformulaciones fuera de los tests de desarrollo. Usar eventos reales simulados de transporte, no solo concatenación de textos.

Por lote: medir reproducción antes de corregir; controles afectados y TypeScript; global cuando cambien reglas compartidas, sin editar fuente mientras corre; registrar SHA, configuración, límites y despliegue efectivo. No reconstruir por cambios documentales. No añadir llamadas pagadas o órdenes externas en heartbeats.

Para piloto supervisado: cero pedidos vacíos/duplicados, cero productos extra por negaciones, cero pérdida de datos explícitos en los recorridos reservados críticos; direcciones sin coincidencia suficiente deben pedir aclaración y no simular validación; las correcciones e interrupciones deben poder terminar el pedido sin reinicio. La prueba con modelo real y la ubicación real son evidencias separadas de los mocks. Medir turnos evitables, repeticiones exigidas al cliente, exactitud del pedido, latencia y costo por conversación; fijar umbrales comerciales con datos observados antes de ampliar el piloto. No estimar porcentaje de preparación a partir del número de tests.

## VALIDADO — aviso de bebidas aparte; desplegar con la siguiente tanda, 18/10/2026

Código `6c5de4248cad4a4b963c83394902d13a58c8f5f1` publicado en origin/staging. Despliegue pendiente para agrupar con la siguiente tanda; no reconstruir solo por este cierre documental.

Global final de 86 suites / 9.144 pruebas en 570.533 segundos, con 376 hashes intactos. Pasan 58 controles focalizados, TypeScript y 92 contratos Node. No hay suites activas. Se corrigieron 16 fallos de respuesta sin alterar reglas de cálculo ni de conservación del carrito: la conversión a combo enumera las bebidas que siguen aparte con cantidad y sabor. La retirada explícita posterior elimina la bebida suelta y conserva la incluida en el combo.

22 pruebas nuevas: 16 conversaciones completas con dos menús y seis controles del aviso; las conversaciones anteriores de sabores también exigen ausencia del aviso cuando no queda botella aparte. Se verifican respuesta, estado, carrito, consulta de total, corrección, checkout y DTO simulado. Evidencia: `whatsapp-retained-drink-notice-validation-1810.json`. Los servicios/modelos son mocks; no son pruebas reales del modelo.

Despliegue diferido para agrupar esta mejora de respuesta con la siguiente tanda. El último runtime verificado sigue siendo `5693c57b`, imagen `d8d72cc1…`, comprobado a las 20:05:51 UTC; no afirmar que este aviso ya está activo. Queda preparado el probe `/tmp/ppp-retained-drink-notice-compiled-1810.cjs` para ejecutar al desplegar. Main, configuración privada, modelos, bases y volúmenes no se tocaron. Cero llamadas pagadas, Meta y órdenes externas; presupuesto 188/187/1 intacto.

Siguiente: cuatro unidades del plato más cuatro botellas; convertir exactamente dos a combo, conservar dos platos solos y dos botellas. Comprobar cantidades/variantes/DTO, no solo total: el precio podría coincidir incluso con un reparto incorrecto. Si no soporta conversión parcial, aclarar sin convertir las cuatro unidades. La división de atributos del mismo SKU no acredita por sí sola un cambio parcial a otro SKU combo. Después retomar unidades internas con letras y formularios etiquetados. Un solo lote cerrado en este despertar. Entradas inferiores históricas.

## VIGENTE — 18/10/2026, 15:05 Bogotá: sabor al convertir a combo, desplegado solo en staging

Código `5693c57bbe1eaf7e5e4623ca781231fd5b96c791` publicado y desplegado. Imagen activa y candidate: `sha256:d8d72cc159a217a14d03d78b62be9a0bb6c40478bf7c1f07d86dc58bf38b2245`. Contenedor running/healthy; health OK, DB connected, circuito CLOSED a las 20:05:51 UTC. Rollback: `ppp-nest-staging:rollback-before-5693c57b`. Probe compilado de 12 combinaciones de volumen/sabor y probe previo aprobados. Evidencia: `whatsapp-combo-flavour-validation-1810.json`. No reconstruir por documentación posterior.

Ocho fallos iniciales reprodujeron que «Coca Cola 1.5L Zero» se comparaba como la bebida base. Se conserva la validación de tamaño y se omite el volumen únicamente al comparar el sabor seleccionado con la bebida del combo. Una botella distinta no se retira por error; una compatible se incorpora sin duplicarla. Las notas, cantidades adicionales y líneas ambiguas siguen protegidas por los controles previos.

20 regresiones nuevas: ocho conversaciones completas con dos menús y agente configurado encendido/apagado, más doce controles de formatos 1.5L/1,5 litros/1500ml y sabores Original/Ligero. Se comprueban respuesta, carrito, consulta de total sin mutación, checkout y DTO de orden simulada. Pasan 36 focalizados, TypeScript, 92 contratos Node y global de 86 suites / 9.122 pruebas en 580.25 segundos, con 376 hashes intactos. No hay suites activas. Los modelos y servicios externos están simulados: no acredita nueva precisión lingüística ni disponibilidad para venta por conteos.

Main local y producción siguen en `14d9dd84`, imagen productiva `c5e97ab1…` running. Configuración privada, modelos, bases, volúmenes, bin/ y orphan preservados. Cero llamadas pagadas, Meta y órdenes externas; presupuesto 188/187/1 intacto. Este despertar cierra una sola tanda.

Siguiente:
1. Hacer visible una botella retenida por sabor incompatible en la respuesta de conversión y aclarar intención cuando sea ambigua; actualmente el total, carrito final y confirmación protegen esa conservación.
2. Convertir solo dos de cuatro unidades y asignar exactamente sus bebidas, conservando el resto.
3. Retomar unidades internas con letras/cambio de unidad, formularios etiquetados y notas/opciones sobre subconjuntos.
4. Validación reservada del modelo, costo/latencia y mapa real solo en ejecución activa con presupuesto; los despertares programados siguen gratuitos, sin Meta ni órdenes externas.

Las mejoras de dirección, contacto y cierre del lote anterior siguen incluidas. La cobertura real de Villa Galante no queda acreditada por HTTP simulado. Mercado Pago productivo continúa habilitado y staging deshabilitado; el piloto acordado sigue con efectivo y transferencia. Entradas inferiores históricas.

## VIGENTE — 18/10/2026, 14:49 Bogotá: lote desplegado solo en staging

Código `3a5a204badc1e24fb438c845d2cf13a6cb65f872` publicado y desplegado. Imagen activa y candidate iguales: `sha256:6890143f77da7d69f5c245c97010804d02b17643275ad726df644c358d5d970f`. Contenedor running/healthy; health OK, DB connected y circuito CLOSED a las 19:49:22 UTC. Rollback: `ppp-nest-staging:rollback-before-3a5a204b`. Los commits posteriores de documentación no requieren reconstrucción.

Validación final: 86 suites / 9.102 pruebas en 566.854 segundos, con 376 hashes de fuente intactos; TypeScript y 50 controles de la última ampliación aprobados. El lote anterior aportó 516 controles focalizados, 21 de reparación y 92 contratos Node. El checkpoint `29da6788` aprobó su global de 9.074 pruebas antes de añadir las abreviaturas. Las dos globales fallidas de cierre se corrigieron antes de publicar y no cuentan como aprobación. Pasaron los probes del compilado actual y los controles previos de herramientas y notas. El router completo se verifica en TypeScript con servicios simulados; estos resultados no acreditan inferencia, geocodificación ni entrega de WhatsApp reales.

Cambios acreditados:
- Actualizar teléfono reconoce el cambio antes de retomar el pago; nombre y pago pueden llegar juntos.
- Un formulario completo conserva compra, destinatario, teléfono, dirección y pago explícito. El formato admitido sigue siendo acotado.
- Una bebida explícita junto a un plato sin bebida incluida se conserva. La conversión explícita a combo puede absorber una única botella compatible, de cantidad y tamaño documentados; las ambiguas o adicionales se conservan.
- El mapa busca el destino separado de entrada, torre y apartamento numéricos. Los detalles siguen en la orden simulada. Repetir un lugar rechazado no lo convierte en una unidad interna ni evita validar cobertura.
- `Tv` sin punto ya pasaba en staging. Se corrigieron `Tv.` y `Kr`, y se probaron cuatro formas de dirección con dos menús, ráfagas del coalescer, mensajes separados, dirección guardada antigua y DTO final simulado. No se crea orden al elegir pago sin confirmación final.

Main local y producción siguen en `14d9dd84`; imagen productiva `c5e97ab1…` running. Este lote no se promovió. Configuración privada, modelos, bases, volúmenes, bin/ y orphan preservados. Cero llamadas pagadas, Meta y órdenes externas; presupuesto 188/187/1 intacto. La auditoría de contacto productivo encontró una respuesta no vacía con ID de Meta a los dos segundos; no acredita su renderizado en el dispositivo. El último fragmento humano omite mensajes de pago y confirmación: no inferir una orden indebida solo de ese recorte.

Siguiente tanda:
1. Original/Zero al convertir a combo; botellas con notas, cantidades distintas o selección ambigua.
2. Unidades con letras, bloque B, cambio de unidad y detalles antes del conjunto.
3. Formularios con etiquetas Teléfono/Nombre y distinto orden de campos, conservando cláusulas desconocidas.
4. Opciones y notas sobre subconjuntos; retirar una cláusula sin borrar las demás.
5. Conversaciones completas reservadas con modelo real, costo y latencia; mapa real bajo presupuesto de ejecución activa. Los despertares programados siguen gratuitos, sin Meta ni órdenes externas.

No acreditar cobertura real de Villa Galante por HTTP simulado ni preparación comercial por conteos. Mercado Pago productivo sigue habilitado y staging deshabilitado: auditoría de lectura, sin cambio de configuración. El piloto acordado sigue con efectivo y transferencia. Evidencias: `whatsapp-sales-closure-validation-1810.json` y `whatsapp-fresh-street-validation-1810.json`. Las entradas inferiores son históricas.

## VIGENTE — 18/10/2026, 13:04 Bogotá: opciones e intensidad desplegadas en staging

Código `bd23e68d5641820bb3d5624b16c3e563c1c1241d` publicado y desplegado solo en staging. Imagen activa = candidate `sha256:506ac358710a356e6312f065e6c52cbd2c86b7e0d1646fc86c7138cd1561368e`; contenedor running/healthy y health OK, DB connected, circuito CLOSED a las 18:03:52 UTC. La primera inspección dio starting; únicamente la comprobación posterior acredita healthy. Rollback `ppp-nest-staging:rollback-before-bd23e68d`. Probe compilado aprobado: seis propuestas deliberadamente contradictorias del modelo se corrigen desde la fuente y conservan nota, además de los controles previos. Evidencia `whatsapp-intensity-options-validation-1810.json`.

29 regresiones nuevas: 12 conversaciones router → consulta de precio → DTO simulado en tres menús, 11 controles catálogo/helper y seis herramientas reales sin nota propuesta por modelo. 111 focalizados, TypeScript, 92 Node y global final de 82 suites / 8.963 pruebas en 1585.882 s; 370 hashes intactos. La global válida es `accepted-global`; la anterior fue interrumpida con exit 130 antes de editar y no cuenta como aprobación. No es inferencia real ni acredita precisión ASR o cumplimiento en cocina. Cero API pagada, Meta y órdenes externas; presupuesto 188/187/1 sin cambios.

Main y producción sí recibieron la mejora ANTERIOR de intensidad por petición del usuario: HEAD `14d9dd84`, imagen productiva `c5e97ab1…`, running; comprobados de nuevo al cerrar. Esta tanda nueva no se promovió. Modelos, configuración privada, bases, volúmenes, bin/ y orphan preservados. No reconstruir por documentación.

SIGUIENTE: reproducir frases completas con opción canónica «No Tan Picante» (el control actual solo prueba la respuesta literal sola); luego «menos dulce»/«sin tanto azúcar», preferencias sobre subconjuntos existentes y retirada de una cláusula conservando otras. Reanudar con menús variados, respuesta/carrito/estado/DTO y controles de consultas durante checkout. Las compras iniciales actuales no acreditan esos recorridos. Mantener staging permanente y no promover nuevas tandas a Main sin solicitud. Reservadas reales, costo/latencia y supervisión siguen pendientes para decidir piloto. Entradas inferiores históricas.

## VIGENTE — 18/10/2026,12:22 Bogotá: intensidad promovida a producción

Por solicitud explícita del usuario,Main actualizado a e8cdfc2b y backend productivo desplegado. Código validado07a2416a;imagen productiva c5e97ab1f09502b3a64a73fb332665395f9e6054349b7195bc3d58081bf4559e,running,health OK/DB connected/circuit CLOSED a17:21:51UTC. Probe compilado de intensidad/herramientas/catálogo/adapter aprobado;sin inferencia ni pedidos externos. Rollback ppp-nest-api:rollback-before-e8cdfc2b. Configuración privada/compose/artefactos locales preservados,sin cambio de modelos. Evidencia whatsapp-intensity-validation-1810.json. Staging mantiene runtime07a2416a,healthy139d8378…;no reconstruir por docs.

CONTINUAR SOLO EN STAGING:preferencia negativa frente a opciones configurables,menos dulce/sin tanto azúcar,subconjuntos y retiro de una cláusula. Global previa82suites/8934tests con370hashes intactos. No acreditar comprensión real por mocks ni promover nuevas tandas a Main sin nueva solicitud. Presupuesto188/187/1 sin cambios. Entradas inferiores históricas.

## VIGENTE — 18/10/2026,12:14 Bogotá: intensidad desplegada SOLO en staging

Código07a2416a99db0e16d25b57c6ef4b3bc3556fe305 publicado y desplegado en staging. Contenedor running/healthy,imagen activa=candidate sha256:139d8378e76d26da0348361001a2ae6881635222ed464c4248e90da8bcee725f. Health OK/DB connected/circuit CLOSED a17:13:51UTC. Rollback ppp-nest-staging:rollback-before-07a2416a. Compilado acredita extracción y herramientas reales en6menús,además del adaptador/guards previos;router completo probado en TS con dependencias simuladas. Evidencia whatsapp-intensity-validation-1810.json. No reconstruir por este cierre documental.

12fallos iniciales→45regresiones nuevas:12conversaciones de intensidad con precio intermedio/DTO final,10SKU con adjetivos en nombre,23helper.82focalizados,TypeScript,92Node y global82suites/8934tests en943.587s aprobados,370hashes intactos. Gramática acotada dulce/picante/salado/ácido/grasoso con nota literal;sin excepciones por restaurante. No es nueva precisión de modelo/ASR ni garantía de preparación. CeroAPIpagada/Meta/órdenes externas;188/187/1 intacto. Main queda76a412b2,código productivoe46996fa;modelos/configuración privada/bases/volúmenes/bin/orphan preservados.

PRÓXIMA TANDA:preferencias negativas frente a atributos seleccionables (ej.Salsa Picante/Suave),«menos dulce»/«sin tanto azúcar»,retirada de una cláusula y conservación de las restantes. Después subconjuntos con variantes/nota y consultas durante checkout,menús variados. No asumir cubiertos por los6menús actuales sin atributos. Inferencia real reservada,costo/latencia y conversaciones completas siguen pendientes antes de acreditar piloto. Automatización gratuita y solo staging;no promover Main sin nueva solicitud. Entradas inferiores históricas.

## VIGENTE — 18/10/2026, 11:52 Bogotá: Main y staging desplegados

El usuario autorizó promoción y deploy productivo. Código e46996fae72639d8a924298b8b448a16f05d0f29 publicado en Main/staging y desplegado en ambos. Producción ppp_nest_api running, health OK/DB connected/circuit CLOSED (16:51:01UTC); imagen6e71bc54… Staging running/healthy, imagen activa=candidate cc1c4ce3… y health OK (16:51:56UTC). Evidencia exacta en whatsapp-main-promotion-1810.json. Los cuatro módulos compilados comprobados coinciden; no se comparó binariamente todo el backend.

Se alinearon los cuatro modelos en .env privado productivo con staging: agente gpt-6.1-sol, visión/assist gpt-6-luna, audio gpt-transcribe. Backup privado .env.before-model-parity-e46996fa; compose productivo intacto. Rollbacks ppp-nest-api:rollback-before-e46996fa y ppp-nest-staging:rollback-before-e46996fa. Preservados454artefactos modificados y18no versionados de Main local, archivos privados/bases/volúmenes/orphan. No frontend para subir a Hostinger.

Global final82suites/8889tests en947.954s,370hashes intactos;TypeScript,72Node,controles focalizados y probes compilados aprobados. Primer global falló en3notas ají+sin arepa: reparado antes de promoción. No son llamadas reales del modelo ni evidencia universal de venta. CeroAPIpagada/Meta/órdenes externas;presupuesto188/187/1 intacto.

CONTINUAR SOLO EN STAGING, rama permanente conservada. No reconstruir por esta documentación. Próxima tanda: matriz de dulzor/picante/sal/grasa/temperatura/textura entre restaurantes, preferencias por subconjunto y retiro de una cláusula de nota; conversaciones completas reservadas/costo/latencia antes de acreditar piloto. Ver whatsapp-next-batches.md. La lista es plan de pruebas, no soporte ya acreditado. Entradas inferiores históricas.

## Estado vigente — 18/10/2026, 08:19 Bogotá

Staging190c6c86 desplegado/verificado, running/healthy y healthOK. Compras con variantes durante checkout y consultas contadas conservan carrito/estado.84regresiones nuevas de consultas;global81suites/8788tests en592.772s,368hashes intactos,TypeScript y72Node. Evidencia whatsapp-group-inquiries-validation-1810.json. Main intacta; ceroAPIpagada/Meta/órdenes externas.

Pendientes concretos antes del piloto: compra explícita mezclada con consulta de precio aún se rechaza por question_not_order (fallo reproducido, sin compras parciales); notas que retiran solo una cláusula, productos sin atributos y consultas de detalles no documentados; conversaciones reservadas completas con modelo real, costo/latencia y supervisión. No usar conteos/mocks como acreditación comercial. La automatización sigue gratuita; validación real corresponde a ejecución activa autorizada bajo presupuesto. Secciones inferiores históricas.

## Estado vigente — 18/10/2026,06:54 Bogotá

Stagingd043cc54 desplegado/verificado,Main intacta. Reemplazo/borrado de nota para unidades seleccionadas conserva el resto.47regresiones nuevas;global81suites/8635tests en594.556s con368hashes intactos,TypeScript y72Node. Ver whatsapp-note-modes-validation-1810.json. CeroAPIpagada/Meta/órdenes externas;presupuesto188/187/1 intacto.

Antes del piloto:falta validar compra por variantes durante checkout,consultas puras con reparto,notas ambiguas/retirar una cláusula/productos sin atributos y conversaciones reservadas reales del modelo,costo/latencia. La validación actual mide estado/contrato/DTO con mocks,no nueva precisión lingüística. Automatización horaria gratuita sigue activa;no duplicar. Secciones inferiores históricas.

## Estado vigente — 18/10/2026,01:53 Bogotá

Staging71114d9d desplegado/verificado,Main intacta. Baseline12fallos demostró compras parciales por propuesta incompleta del modelo. Contrato nuevo exige total/grupos por cantidad y opciones de catálogo antes de aplicar esa familia de compra distribuida.21tests nuevos;global81suites/8588tests en590.562s con368hashes intactos,TypeScript y72Node;rechazos verificados en compilado. CeroAPIpagada/Meta/órdenes externas en esta tanda automática. Evidencia whatsapp-distribution-atomic-validation-1810.json.

Pendientes para piloto:reemplazar/borrar notas sin contradicciones,compras distribuidas durante checkout,consultas puras que mencionan grupos,referencias y escenarios reservados completos,costo/latencia. No inferir precisión del lenguaje del modelo por estos mocks ni declarar preparación comercial por conteos. Continuación horaria gratuita sigue activa;no duplicar. Secciones inferiores históricas.

## Estado vigente — 18/10/2026, tanda conjunta desplegada

Staging6efd6903 desplegado/verificado,Main intacta.57regresiones nuevas;global final81suites/8567tests con368hashes intactos,TypeScript y72Node. Corrige alcance conjunto de opciones+nota y repartos por variantes. Una primera global detectó una regresión del reparto10cajas;se corrigió y pasó la segunda. Evidencia whatsapp-joint-subset-validation-1810.json.

Inferencia reservada:1turno de bowls,3requests,US$0.0226031 estimados;capturada y reproducida gratis tras el fix final de enrutamiento. No acreditar una conversación real completa. Presupuesto operativo188/187/1. Continuación horaria gratuita activa en el hilo;no duplicar ni usar API pagada en sus despertares.

Antes del piloto:probar omisión/fallo parcial de un grupo y suma incoherente en propuestas de modelo;notas contradictorias/borrado;compras distribuidas durante checkout;referencias entre variantes;conversaciones reservadas completas,costo y latencia. La nota actual solo añade:no prueba reemplazo semántico. Ver cola vigente en whatsapp-next-batches.md. El conteo de regresiones no equivale a preparación comercial. Secciones inferiores históricas.

## Estado vigente — 18/10/2026

Staging243c2e3b desplegado/verificado;81suites/8510tests con365hashes intactos,TypeScript y72contratos Node. Corrige pérdida de intención en no-op y evita cambiar el resto al repetir una partición sin identificar variante. Sin nuevas llamadas pagadas;Main intacta. Evidencia whatsapp-unit-option-followup-validation-1810.json y relevo WHATSAPP-LOCAL-NEXT-AGENT.md.

Aún piloto supervisado pendiente: ampliar unión de atributos+nota del mismo subconjunto, compras nuevas distribuidas, alusiones/negaciones entre variantes;reservar conversaciones completas no usadas al ajustar y medir modelo real,costo y latencia. El conteo global no equivale a garantía comercial. Mantener efectivo/transferencia y probar sin órdenes externas hasta verificar aislamiento. Las secciones inferiores son historial.

# Plan vigente de piloto y venta — 17 de octubre de 2026, Bogotá

Esta sección es la referencia actual. Las entradas inferiores son historial y sus modelos, presupuestos, SHAs y conteos no describen necesariamente el runtime vigente. El relevo técnico es `WHATSAPP-LOCAL-NEXT-AGENT.md` y cada tanda tiene un informe JSON. No existe aún evidencia suficiente para declarar venta autónoma ni una fecha de lanzamiento defendible.

## 1. Dónde estamos y qué demuestra la evidencia

- Opciones por unidades ya desplegadas en cf6ded72: herramienta agrupada, guard, proyección y respuesta derivada, conservación de variantes y precios.210focalizados,TypeScript,72contratos Node y global80suites/8473tests;363hashes intactos. Un turno reservado real aprobado (3peticiones,US$0.0221102 estimados), medido antes del ajuste de consolidación; traza reproducida gratis sobre el candidato final. No equivale a una conversación completa ni a un benchmark amplio. Ver whatsapp-unit-option-integration-validation-1710.json.
- Integración permanente: `staging`. Candidato publicado y desplegado `cf6ded72`, con opciones por unidades y consolidación por precio, además de ubicación legible y compras no disponibles de f61cecff. La aceptación automatizada es de servicios externos/modelo simulados; distinguirla del turno de inferencia real documentado.
- Último código desplegado y verificado: `cf6ded72`, staging healthy el17/10 a23:25 Bogotá. Imagen activa=candidate sha256:b318ba027fff3a61f37337619a3bd471251cff0b6797f65c177a99a349de590e. Compilado/health/modelos comprobados;bot y agente V1 efectivos habilitados. Primera global de esta tanda interrumpida por un caso nuevo de subtotal;se corrigió y se ejecutó otra global final completa antes de publicar.
- Main local verificada en `1a2b2e23`, sin el manejador `isPoliteMenuLinkRequest` presente en staging; esta revisión no la promueve ni verifica nuevamente el runtime de producción. No atribuir un chat de Main a la versión nueva de staging.
- La frase exacta «Hola buenas tardes tienes la carta por favor» ya tiene regresión en staging. Se amplió la familia con modales, «menú completo», saludos, consultas de aprobación y ETA hipotética frente a aprobación explícita:80casos nuevos y839focalizados verdes; consultar `whatsapp-basic-greeting-confirmation-validation-1710.json`. No acredita todas las preguntas compuestas/citas de autorización.
- La cobertura ya incluye cantidades, opciones, combos, preguntas durante checkout, correcciones, fotos y transcripciones simuladas. Quedan fronteras entre intenciones y falta ampliar evidencia independiente del modelo y de medios originales.
- Piloto acordado: un restaurante, efectivo y transferencia. Mercado Pago e impresión automática quedan fuera. Cocina usa pantalla, no impresora automática.

## 2. Qué significa estar listo

**Para iniciar piloto supervisado:** cerrar todos los fallos críticos conocidos de comprensión, fijar un candidato reproducible, verificarlo desplegado y aprobar conversaciones completas nuevas. La revisión humana debe poder detener o corregir antes del efecto operativo. No abrir tráfico nuevo si esa revisión no está disponible.

**Para vender como producto:** además del piloto, demostrar calidad antes de intervención, recuperación de errores, costos y soporte sostenibles y aislamiento entre restaurantes. La venta inicial debe describir el alcance probado y la supervisión que todavía requiere.

**Criterios que bloquean avance:** confirmación sin permiso, pedido duplicado, cantidades o productos cambiados sin pedirlo, cobros/precios inventados, pérdida de una preparación acordada o dirección incorrecta tratada como segura. Cualquier caso observado exige reproducir su familia y volver a validar el candidato; no se compensa con un porcentaje alto de casos fáciles.

## 3. Primera puerta: conversaciones básicas y estados

Responsable de ejecución: agente de desarrollo. Prioridad inmediata.

1. Saludo solo y saludo con solicitud: carta, precios, cobertura, horarios o compra. El saludo no debe ocultar la intención que viene después. «Carta» como consulta no es un producto; «menú ejecutivo» sí puede nombrar uno.
2. Consultas en cada paso pendiente: nombre, dirección, teléfono, variante, pago y resumen. Responder sin guardar la pregunta como dato, conservar carrito y recordar el paso correcto.
3. Confirmaciones: «sí», «sí señor», «así está bien», «no gracias, eso es todo», mensajes fragmentados y repetidos. Confirmar solo con resumen válido y sin selecciones pendientes. «Confirmo?» y «¿cuánto tarda si confirmo?» son consultas, no aprobación. «Lo confirmo. ¿Cuánto tarda?» sí contiene aprobación explícita y consulta: debe resolver ambas sin duplicar.
4. Final de conversación: agradecimientos no reabren el carrito ni registran otra orden. Una compra nueva explícita debe distinguirse de la cortesía.

Aceptación: cada caso verifica mensajes completos, estado previo/posterior, datos del cliente y número de llamadas de creación de orden. Probar con agente simulado activo/inactivo y más de un catálogo. Ninguna consulta modifica el carrito o confirma una orden. No usar respuestas ficticias del modelo como prueba de comprensión real.

## 4. Segunda puerta: composiciones difíciles sin perder lo básico

Orden de trabajo después de cerrar la primera puerta:

1. Edición más compra nueva: «el que tengo sin salsa y agrega otro normal». Modificar solo la unidad anterior y añadir exactamente la nueva. Incluir un producto todavía fuera de carrito para impedir ediciones parciales que lo pierdan.
2. Varias unidades y variantes: identificar línea y número de unidades; no seleccionar el primer sabor cuando hay varios. Conservar cantidades totales, atributos, notas previas compatibles y productos ajenos.
3. Corrección de preparación: retirar o sustituir una nota sin acumular instrucciones opuestas. Separar nota, opción del catálogo y acompañamiento cobrado; no prometer sustituciones o gratuidad no configuradas.
4. Ambigüedad y cambios de intención: pedir una aclaración concreta, permitir otra consulta y retomar. Cada selección debe tener dueño; «ese cambio» no puede retirar otra compra pendiente.
5. Mensajes largos y ráfagas: un pedido distribuido en mensajes conserva el mismo producto foco cuando corresponda. Verificar orden de llegada, respuestas y efectos únicos; probar reenvío y repetición sin generar unidades extras.

Método: fallo reproducido primero, regla general por catálogo, una familia de positivos y negativos, continuaciones hasta orden simulada y controles existentes. Un fallo nuevo no se tapa con una frase especial para PPP. Los fixtures pueden nombrar productos; las reglas de producción no deben fijar sus IDs/nombres/precios.

### Trabajo estructural para dejar de depender de parches por frase

Trabajo estructural: el primer contrato compartido de aprobación está en validación sobre66ec9438 (whatsapp-compound-approval-validation-1710.json); no sustituye la consolidación de todo el router. El resto del trabajo sigue planificado:
- Inventariar las rutas que actúan antes del modelo y las que consumen el paso pendiente. Fijar con contratos una prioridad común: reconocer consulta/edición/compra explícita antes de interpretar cualquier texto como nombre, dirección, opción o pago.
- Consolidar un resultado de turno que distinga intención, entidades del catálogo, cantidad, atributos, preparación, destinatarios y duda pendiente. Un «no resuelto» no puede convertirse en «no existe» sin comprobar catálogo y contexto.
- Validar el plan antes de aplicarlo: identidad de línea/unidad, disponibilidad, precio y autorización. La mezcla edición+compra requiere aplicación coherente; no guardar media operación y responder como si estuviera completa.
- Emitir la respuesta desde el resultado persistido: qué cambió, qué no se añadió y qué falta. Nunca confiar en una afirmación libre de «listo» para acreditar que se llamó la herramienta correcta.
- Migrar una familia a la vez con comparación antes/después y regresiones de contratos. Reutilizar las estructuras ya existentes cuando cumplan este contrato; no iniciar una reescritura general sin evaluación y rollback.

La prueba de mejora debe ser que una familia nueva funciona en varias cartas y estados, y que los básicos siguen pasando. Añadir sinónimos sin medir esas fronteras no cierra la deuda de enrutamiento.

## 5. Tercera puerta: evaluación independiente y medios

Preparar40 conversaciones reservadas:12 básicas/consultas,12 compras/cambios,8 checkout/interrupciones,4 ráfagas y4 con medios. Es una primera muestra propuesta, no garantía estadística ni evidencia ya obtenida. Reservarlas antes de ejecutar; un caso inspeccionado para corregir pasa a desarrollo y necesita reemplazo como muestra independiente.

Ejecutar por lotes pequeños. Primera comparación con modelo real: escoger tres conversaciones nuevas y un límite de requests antes de red; detener ante el primer fallo para analizarlo gratis. El saldo operativo registrado hoy es2requests; eso no permite prometer40 conversaciones con herramientas. La autorización de gasto moderado del usuario persiste, pero cualquier ampliación operativa debe registrarse con alcance y límite explícitos, sin reiniciar los181 intentos acumulados ni confundir requests con dólares.

Audio: separar transcripción de interpretación. Usar el original disponible con permiso y grabaciones controladas de pedidos nuevos; revisar nombres, números, negaciones, dirección y notas. La transcripción correcta no acredita el pedido y una transcripción escrita no acredita reconocimiento de voz. Imágenes: producto único, carrito con cantidades, varias tarjetas, foto ilegible y envío sin texto. No confundir mocks HTTP con calidad visual real.

Registrar SHA, catálogo, configuración, modelos efectivos, fuente de entrada, salida del modelo, acciones aceptadas/rechazadas, carrito, respuesta, tokens y costo cuando estén disponibles. Conservar datos personales y originales fuera de Git; fixtures sintéticos por patrón.

Aceptación: cero errores críticos, ausencia explícita de información inventada y consultas resueltas sin bloqueos. Todo fallo crítico reabre la familia y el candidato se vuelve a probar. No reportar éxito independiente usando solo reensayos corregidos.

## 6. Cuarta puerta: un candidato desplegado y un piloto acotado

Agrupar reglas antes de desplegar. Congelar fuente, ejecutar suites afectadas y TypeScript; cuando cambien reglas compartidas, ejecutar global y comprobar mapa completo de hashes. Publicar staging, conservar rollback y verificar SHA, imagen activa/candidata, health, modelos y configuración del candidato. No promover Main sin petición explícita.

Antes de abrir el piloto, hacer una comprobación acotada del canal real y de la recepción operativa en un entorno deliberadamente aislado. Esto queda después del trabajo de comprensión, respetando la prioridad del usuario. Los tests de router no acreditan entrega por Meta ni recepción visual en cocina.

Propuesta de fases, no fechas prometidas:
- Primeros10 pedidos: revisión humana antes de liberar cada orden; corregir y registrar discrepancias. No automatizar una confirmación externa de prueba sin aislamiento.
- Hasta50 pedidos: incluir horas pico y consultas/cancelaciones; revisar también abandonos, no solo pedidos exitosos.
- Revisión a100 pedidos completados: objetivo propuesto de98% correctos antes de intervención y cero errores críticos enviados a operación. Registrar por separado correcciones humanas antes de cocina. El tamaño de muestra es un punto de revisión, no una garantía.

Si aparece un error crítico, suspender el comportamiento afectado o volver al candidato anterior; documentar conversación, versión y corrección. No ampliar tráfico hasta resolverlo y revalidar. Responsables humanos pendientes para esa fase: encargado del local que revisa y persona que decide detener/reanudar. El usuario los define al llegar a esta puerta, no hace falta bloquear ahora el desarrollo para preguntarlo.

## 7. Medición para decidir venta y precio

Medir por conversación elegible y por pedido completado, con denominadores separados:
- Exactitud antes de corrección: producto, cantidad, opciones, notas, dirección, modalidad, pago y totales.
- Intervención necesaria, abandono por error y consultas resueltas; separar cancelación voluntaria de fallo.
- Primera respuesta útil y tiempo hasta confirmación; informar mediana y p95 medidos, no fijar un SLA sin datos.
- Costo de texto, voz, visión, canal, infraestructura y tiempo de soporte. Registrar tokens y uso, no estimar rentabilidad por número de mensajes.

Costo variable por pedido = IA + canal + parte variable de infraestructura + soporte atribuible. Comparar ese costo con el ingreso neto por pedido que resulte del plan de suscripción; simular también locales con pocos pedidos y muchos audios. Definir límites incluidos, excedentes y margen objetivo después de medir, sin prometer precio rentable hoy.

Puerta comercial: resultados del piloto revisados, seguimiento de incidentes, responsable de soporte, procedimiento de rollback/pausa y alcance de servicio documentado. La marca «vendible» no deriva de7968 tests ni de que el servidor esté healthy.

## 8. Kamppo y producto reutilizable

Migrar comportamientos y contratos, no excepciones de PPP. Separar núcleo conversacional, adaptador de catálogo/pedidos/canal y configuración de tenant: menú, atributos, alias, políticas, entrega, puntos y mensajes. Menús ficticios acreditan independencia de vocabulario; no acreditan aislamiento multitenant.

Antes de incorporar otro restaurante: ejecutar la misma matriz con su catálogo real y al menos dos tenants simultáneos; probar que teléfono, sesión, caché, productos, dirección, puntos, credenciales y órdenes no crucen tenant. Versionar configuración/modelos junto con el candidato y ejecutar evaluación cuando cambien. Empezar por un segundo restaurante de piloto antes de ofrecer expansión amplia.

## 9. Cómo continuar sin perder el control

Mantener un único backlog priorizado: caso/familia, severidad, expectativa, prueba, causa, cambio, evidencia y candidato desplegado. No sumar reruns como casos nuevos. Actualizar `WHATSAPP-LOCAL-NEXT-AGENT.md` al cerrar cada tanda. `staging` permanece; Main y producción solo cambian con autorización de promoción.

Esta entrega cerró80casos y su deploy agrupado. La próxima debe ampliar preguntas compuestas/citas sobre autorización, luego edición+compra nueva y notas contradictorias. Después viene muestra independiente y piloto supervisado. Si una puerta sigue abierta, indicar exactamente la evidencia faltante en lugar de inventar un porcentaje o fecha.

---

# Historial conservado

## Familias, repartos de opciones y consultas del carrito — 16/10

Estado vigente: código **d410291e** (incluye 620c982b), publicado y desplegado solo en staging. Esta entrada sustituye la prioridad anterior de familia genérica. Main no se modificó ni producción se reconstruyó.

162 pruebas nuevas gratuitas: 64 familias de catálogo (Pizza/Bowl/Crepe/Ramen), 48 compras repartidas por opciones (Coca Cola/Helado/Te/Arepa), 50 reparto de dos preparaciones y checkout. El prefijo explícito de catálogo precede al plato del carrito al preguntar precio; una compra genérica abre presentaciones y conserva cantidad. «Dame dos Original y dos Zero» hereda una oferta activa, valida grupos y agrega líneas por atributo. Un mero productFocus viejo pide producto sin comprar. Una opción desconocida conserva el reparto completo sin aplicar. No se adivina selección multiproducto/reemplazo pendiente.

Los dos ejecutivos se planifican como una unidad de cada preparación, con atributos individuales y sopa/bebida compartidas; notas se extraen después de resolver el producto, por cláusula. Se probó el mensaje exacto con/sin saludo y carta ficticia ramen, cantidad inconsistente, opción compartida desconocida, orden inverso, carrito previo y pago. La continuación «Es uno…», «sí», «Perfecto sería eso» conserva el carrito ya correcto. Las consultas de carrito interrumpen nombre/teléfono/dirección/pago/confirmación sin guardar la pregunta como dato. «Sí para Altavista» elimina el prefijo al normalizar dirección.

Evidencia real corregida: el usuario mostró que las cuatro Coca-Colas sí estaban en su carrito; allí hubo respuesta contradictoria, no pérdida permanente acreditada. Los 16 fallos iniciales de ese bloque son recorridos simulados distintos. El chat completo de ejecutivos sí terminó con tres unidades y una bebida por defecto en el tercero; también bloqueó la petición de ver ítems y guardó «Sí para…» literalmente. La prevención del pedido inicial está probada; no acreditar con ello reparación automática de un carrito productivo ya dañado. Se revisan todos los mensajes emitidos al agregar sabores; la lectura posterior comprueba no duplicación, pero el agente simulado no acredita calidad de su respuesta libre.

Validación final: 162 focalizadas, TypeScript aprobado. **57 suites/6666 pruebas WhatsApp** (669.187 s) + **19 suites/98 complementarias** (15.862 s) = **76 suites/6764 pruebas**, dos ejecuciones disjuntas sobre fuente congelada verificada. El bloque inicial de prefijos tuvo otra global previa; no sumarla como casos distintos. Hubo una global interrumpida deliberadamente por revisión del riesgo de productFocus viejo, documentada como interrumpida y no aprobada. Solo el resultado final anterior acredita esta fuente.

Despliegue verificado **2026-10-16T20:29:59.375186+00:00**: running/healthy, imagen activa=candidate **sha256:f81a5e34f651f892b9d4ce2150e1a6edd0e98af35bbb04850a0199c3bebbe64e**, funciones compiladas verificadas, health OK/DB connected/circuit CLOSED. Modelos efectivos intactos: Sol 6.1 para agente, Luna visión/assist y GPT Transcribe audio. Cero llamadas OpenAI/Meta/mapas/órdenes externas; presupuesto183/178/5 intacto. La publicación documental posterior no requiere reconstrucción.

Siguientes familias: sujeto explícito desconocido en precio sin caer al carrito; plurales irregulares; «me falta X» cuando X ya está para evitar duplicación; reparar un pedido anterior corrupto sin borrar productos ajenos; notas equivalentes duplicadas (ej. arroz sin ensalada/más papa); opciones con notas por grupo o varias presentaciones ofrecidas; reemplazo atómico en building_cart y alcance condicional ambiguo. Mantener todo por catálogo y probar restaurantes ficticios. Antes de piloto ampliar contraste acotado con modelo real/canal; estas suites son mocks y no prueban precisión de audio/visión/modelo real. No dar porcentaje de vendibilidad basado en volumen de tests.

Evidencia: docs/whatsapp-generic-family-validation-1610.json, docs/whatsapp-offered-option-split-validation-1610.json, docs/whatsapp-family-distribution-checkout-validation-1610.json. Logs /tmp/ppp-final-family-{targets,full,complement,tsc,deploy}.log y /tmp/ppp-final-family-deploy-verified.json; fuente /tmp/ppp-final-family-source.json. El archivo gap anterior conserva observaciones y resolución limitada. No repetir global por este cierre documental.

## Selección corta entre edición y catálogo/variante — 16/10

Código 5b7cc5ad, solo staging. Baseline real del conflicto: 16/16 fallidas; con reemplazo de sopa pendiente, una pregunta de precio o una lista combo→presentación individual dejaba «2» ejecutando el reemplazo antiguo. Ahora, si una edición del carrito coexiste con otra lista, «2», «la segunda» o «dos» piden nombre completo sin mutar la sesión. El nombre resuelve la cotización sin comprar, o la variante del combo conservando los demás platos. Tras un cambio confirmado del carrito, se retira una aclaración de reemplazo cuya firma ya no corresponde al carrito; no se elimina ningún producto por ese retiro.

64 pruebas nuevas gratuitas: 48 cruces (dos cartas, precio/variante, dirección/pago, agente simulado habilitado/deshabilitado, tres respuestas cortas) con continuación por nombre; 16 controles de una sola lista donde «2» sigue funcionando. En la ampliación inicial, 24/48 fallaban por metadatos viejos después de completar variante; se corrigió su invalidación. 362 focalizadas aprobadas (64 nuevas y 298 controles), TypeScript aprobado. Global: 57 suites/6504 pruebas WhatsApp en 851.522 s + 19 suites/98 complementarias en 10.898 s = 76 suites/6602 pruebas, dos ejecuciones disjuntas con fuente congelada verificada.

Evidencia: docs/whatsapp-catalog-selection-validation-1610.json; logs /tmp/ppp-catalog-selection-{baseline-conflict,targets,expanded,followup,affected,full,complement,tsc,deploy,deploy-verified}.log. Cero API/Meta/mapas/órdenes externas; presupuesto 183/178/5 intacto. Desplegado y verificado running/healthy, imagen activa=candidate sha256:f4cfd24244fdc92ab80981df3c6713cefe5c63411a20f38bc8506e796c3a0209. Health OK, DB connected y circuit CLOSED en 2026-10-16T19:30:03.646Z; guard y limpieza compilados verificados. Modelos Sol 6.1/Luna/Luna/GPT Transcribe intactos. Main no modificada; producción no reconstruida.

SEGUIMIENTO HISTÓRICO: el hueco de prefijos de catálogo se aborda en la entrada vigente superior; quedan sus límites documentados.

Límites de la tanda cerrada: cruza precio y combo/presentación individual; otras claves tienen guard conservador pero no todas sus combinaciones fueron nuevas pruebas. No acredita modelo/canal/mapa real ni toda aclaración libre. Sigue pendiente reemplazo atómico en building_cart y alcance condicional ambiguo. No repetir global por cierre documental.

## Prioridad entre aclaraciones del carrito — 16/10

Código 54622c88, solo staging. Baseline inicial: 24/24 fallidas; quedaban abiertos reemplazo y nueva lista. Una segunda reproducción recorrió esos mismos 24 casos hasta «2»: se ejecutaba el reemplazo anterior y cambiaba el producto equivocado. No sumar ambas ejecuciones como 48 casos distintos. Ahora se toma una firma de cuatro aclaraciones al iniciar el turno (reemplazo, cantidad, atributo, eliminación); cuando una lista nueva queda inequívocamente abierta, se retiran las anteriores sin aplicar sus cambios. El aviso se integra en la respuesta de la lista vigente. Una consulta de tarifa sin nueva lista conserva el reemplazo pendiente.

64 pruebas nuevas gratuitas: 24 reemplazo→cantidad/atributo/eliminación; 24 orden inverso; ocho consulta informativa→selección del reemplazo; ocho sesiones antiguas con dos listas guardadas. En estas últimas, un número sin dueño fiable no cambia nada: se pide instrucción completa, se rehace la aclaración y se continúa. Dos cartas ficticias (pizza/tofu y ramen/falafel), dirección/pago pendientes y agente simulado habilitado/deshabilitado. Se conserva el resto del carrito y «2» no elige pago. Se detectó además un bucle en ocho recorridos de atributos con dos líneas del mismo SKU: tras elegir índice validado se volvía a preguntar cuál plato. Ahora ese índice evita reabrir la misma ambigüedad y cambia solo la línea elegida.

360 focalizadas aprobadas (64 nuevas y 296 controles), TypeScript aprobado. Global: 57 suites/6440 pruebas WhatsApp en 860.562 s + 19 suites/98 complementarias en 10.819 s = 76 suites/6538 pruebas, dos ejecuciones disjuntas sobre fuente congelada verificada. Evidencia: docs/whatsapp-selection-priority-validation-1610.json; logs /tmp/ppp-selection-priority-{baseline,baseline-selection,expanded,attribute-diagnosis,affected,full,complement,tsc-final,deploy,deploy-verified}.log. Cero API/Meta/mapas/órdenes externas; presupuesto 183/178/5 intacto.

Desplegado y verificado running/healthy, imagen activa=candidate sha256:b511ee97550ea81642f2d4e950d8f5b389623444f26485b76458d939a5aa8505. Health OK, DB connected y circuit CLOSED en 2026-10-16T19:06:21.079Z; prioridad y guard del índice compilados verificados. Modelos Sol 6.1/Luna/Luna/GPT Transcribe intactos. No se modificó Main ni se reconstruyó producción.

Límites: prioridad nueva para cuatro listas de edición del carrito; no declarar generalizadas todas las listas de catálogo/precio/variantes/composición. Si no existe una única firma nueva, no se inventa dueño para el número. Esta familia cruza dirección y pago; los demás estados mantienen controles heredados. Una edición inmediata sin nueva aclaración que deje metadatos antiguos es trabajo separado. No acredita modelo/canal real ni toda forma de aclaración libre.

Siguiente: reemplazo atómico durante building_cart; extender propiedad de respuestas a listas de catálogo/variantes/composición; aclaración antigua tras una edición inmediata exitosa; alcance condicional ambiguo y seguimiento. No repetir global por cierre documental.

## Reemplazo atómico en nombre, teléfono, pago y confirmación — 16/10

Código 0986bfcc, solo staging. Baseline: 52 fallidas/12 aprobadas en los 64 casos iniciales. El manejador atómico antes limitado a dirección ahora se ejecuta también en awaiting_name, awaiting_phone, awaiting_payment y awaiting_final_confirm. El marcador pendingCheckoutResume conserva el paso exacto cuando faltan opciones; completar o cancelar retoma ese paso y su pregunta, sin volver por defecto a dirección o «algo más». Un enlace de pago existente bloquea la mutación del carrito.

136 pruebas nuevas gratuitas: 64 de reemplazo directo/destino desconocido/agotado, 32 de sabor obligatorio completado/cancelado, 32 de línea original ambigua elegida/cancelada y ocho de enlace de pago existente. Cartas ficticias de pizza, ramen, jugo y limonada; cuatro estados; agente simulado habilitado/deshabilitado. Se conserva otra línea, notas, nombre, dirección, tarifa, confirmación de teléfono y pago elegido. Se respeta cantidad explícita y precio de catálogo. Seguimientos de nombre y elección de pago avanzan con el carrito corregido; no se crean órdenes automáticamente.

403 focalizadas aprobadas (136 nuevas y 267 controles), TypeScript aprobado. Global: 57 suites/6376 pruebas WhatsApp en 821.271 s + 19 suites/98 complementarias en 6.889 s = 76 suites/6474 pruebas, dos ejecuciones disjuntas con fuente congelada verificada. Evidencia: docs/whatsapp-checkout-replacement-validation-1610.json; logs /tmp/ppp-checkout-replacement-{baseline,targets,expanded,affected,full,complement,tsc-final,deploy,deploy-verified}.log. Cero API/Meta/mapas/órdenes externas; presupuesto 183/178/5 intacto.

Desplegado y verificado running/healthy, imagen activa=candidate sha256:e7c753a56e5ac19f2efe831e05ca32efdd920803ff3dbde844896308d97d711a. Health OK, DB connected y circuit CLOSED en 2026-10-16T18:42:38.594Z; restauración de estado y gate compilados verificados. Modelos Sol 6.1/Luna/Luna/GPT Transcribe intactos. No se modificó Main ni se reconstruyó producción.

Límites: no habilita nuevos cambios en completed/human/awaiting_mp_payment; no declarar corregidos los reemplazos históricos en building_cart. Identidad de destino, aclaración numérica y firma de carrito conservan límites de la tanda anterior. No acredita modelo/canal/mapa real ni toda combinación de instrucciones o listas abiertas.

Siguiente prioridad: cuando un reemplazo pide elegir línea y se abre después otra lista, evitar que «2» seleccione una lista anterior. Reproducir interrupciones/consultas durante esa aclaración antes de cambiar prioridades. Luego validar y extender reemplazo atómico a building_cart; alcance condicional ambiguo con seguimiento; reemplazo junto a otra consulta/instrucción. No repetir global por cierre documental.

## Reemplazo de producto mientras falta dirección — 16/10

Código 1e2e6097, solo staging. Baseline inicial: 24/24 fallidas; «cambia» podía reemplazar pero volver a comprar, y «no quiero X, quiero Y» podía quedar atrapado en dirección. El camino nuevo valida el reemplazo contra el catálogo antes de sustituir la línea, conserva el resto y retoma awaiting_address. La gramática admite nombres del catálogo sin ampliar la lista histórica de palabras de PPP en otros caminos. No se elimina el original si el destino es desconocido o agotado.

72 pruebas nuevas gratuitas. 24 recorridos en pizza/ramen, ambos modos de agente simulado, «cambia»/«no quiero», dirección ausente/lugar sin confirmar/dirección anterior, y calle posterior que retoma pago con cotización simulada. 16 controles de destino desconocido/agotado, consulta y condición de costo; 12 de cantidad implícita y explícita; 12 de original ambiguo con elección, cancelación o carrito cambiado; ocho de sabor obligatorio en jugo/limonada, completar o cancelar conservando el original. La primera ampliación mostró cuatro fallos de respuesta al cancelar: el estado se restauraba, pero decía «algo más». Ahora se restaura dirección antes de componer esa respuesta. El insertador de reemplazos respeta la cantidad validada recibida, en lugar de imponer la anterior.

313 focalizadas aprobadas (72 nuevas y 241 controles), TypeScript aprobado. Global: 57 suites/6240 pruebas WhatsApp en 521.241 s + 19 suites/98 complementarias en 6.592 s = 76 suites/6338 pruebas, dos ejecuciones disjuntas sobre fuente congelada verificada. Evidencia: docs/whatsapp-address-replacement-validation-1610.json. Logs /tmp/ppp-address-replacement-{baseline,targets,expanded,final-cases,affected-final,full,complement,tsc-final,deploy,deploy-verified}.log. Cero API/Meta/mapas/órdenes externas; presupuesto 183/178/5 intacto.

Desplegado y verificado running/healthy, imagen activa=candidate sha256:307a7ed888621316e46a16e46381b61e528b441c836431b62a83030ac264f513. Health OK, DB connected y circuit CLOSED en 2026-10-16T16:14:53.416Z; helper atómico y cancelación compilados verificados. Modelos Sol 6.1/Luna/Luna/GPT Transcribe intactos. Main conserva 1a2b2e23; no se reconstruyó producción.

Límites: el nuevo camino atómico se habilita mientras falta dirección; no declarar corregidos los caminos históricos de reemplazo en pago/nombre/otros estados. Requiere identidad completa de destino en catálogo; destinos desconocidos o múltiples piden repetir el nombre. La aclaración del original admite número, cancelación y firma del carrito; no agrega toda aclaración libre. No acredita modelo/canal/mapa real ni todas las instrucciones compuestas.

Siguiente: reproducir y extender garantías atómicas a otros pasos de checkout; prioridad cuando se abre otra lista durante un reemplazo pendiente (evitar que un número seleccione una lista anterior); consulta/instrucción extra junto al reemplazo; alcance condicional ambiguo y seguimiento; conjunciones en nombres de producto. No repetir global por cierre documental.

## Atributos mientras espera dirección — 16/10

Código 8b9c6e72, solo staging. Reproducción inicial: 24/24 fallidas; se actualizaba el atributo pero el manejador devolvía la conversación a building_cart y preguntaba «¿algo más?». Ahora mantiene awaiting_address y confirma el atributo con recordatorio de dirección. No confirma ni reutiliza automáticamente el domicilio anterior. Se reutiliza la resolución por catálogo; no hay excepciones por producto/restaurante.

32 pruebas nuevas gratuitas: 24 recorridos en dos cartas ficticias (falafel/bebida y tofu/salsa), agente simulado habilitado/deshabilitado, cambio explícito/referencia corta, dirección ausente/lugar no confirmado/dirección anterior guardada, y calle enviada después. Se conserva precio, cantidad, nota y direcciones; la calle posterior retoma pago con cotización simulada. Cuatro opciones inexistentes seguidas de corrección válida y cuatro elecciones entre dos platos en cartas de pita y calzone: «2» cambia solo el seleccionado, sin ser dirección ni método de pago.

279 focalizadas aprobadas (32 nuevas y 247 controles), TypeScript aprobado. Se añadió una aserción adicional de igualdad completa del carrito antes de congelar fuente, cubierta por global. Global: 57 suites/6168 pruebas WhatsApp en 1062.216 s + 19 suites/98 complementarias en 19.504 s = 76 suites/6266 pruebas, en dos ejecuciones disjuntas con fuente congelada verificada. La familia del timeout anterior pasó en esta ejecución completa sin cambiar su timeout; conservar su incidencia histórica.

Evidencia: docs/whatsapp-address-attribute-validation-1610.json; logs /tmp/ppp-address-attribute-{baseline,targets,expanded,affected,full,complement,tsc-final,deploy,deploy-verified}.log. Cero API/Meta/mapas/órdenes externas; presupuesto 183/178/5 intacto. Desplegado y verificado running/healthy; imagen activa=candidate sha256:73d838629335129a73433f00078a5976fdc5a2b13fee56bd7b9a89514a141a6a. Health OK, DB connected y circuit CLOSED en 2026-10-16T15:53:30.368Z; bindings compilados verificados. Modelos Sol 6.1/Luna/Luna/GPT Transcribe intactos. Main conserva 1a2b2e23; no se reconstruyó producción.

Siguiente: reemplazo de producto mientras falta dirección; aclarar alcance condicional ambiguo y su seguimiento; nombres con conjunciones en ediciones solas. Límite: este cambio corrige atributos configurados, no implementa sustituciones completas de producto ni mide geocodificación, modelo o canal real. Opción inválida pide elegir una válida antes de retomar dirección. No repetir global por cierre documental.

## Recargo frente a total después de editar — 16/10

Código c133e557, solo staging. Se reutiliza un detector de consulta de recargo en el clasificador de totales, las consultas de opciones y los mensajes con dos intenciones. «Quita una sopa y dime cuánto me cobran por cambiar la bebida» aplica únicamente la eliminación y explica que no hay recargo confirmado; consultar el cambio no autoriza cambiar la opción. Se conserva la respuesta al retomar checkout.

39 pruebas nuevas: 32 recorridos en dos cartas ficticias (wraps/bebida y bao/salsa), nombre/pago pendientes, agente simulado habilitado/deshabilitado, ambos órdenes y eliminación/cantidad; siete controles de clasificación. Baseline: 34 fallidas/5 aprobadas. Final: 39 nuevas y 371 focalizadas aprobadas; TypeScript aprobado. Suite global: 56/57 suites, 6135 aprobadas y UNA prueba antigua de ráfagas con timeout de5000ms (1049.324s). Repetición aislada de su familia: 80/80 aprobadas en115.54s, sin cambiar fuente ni timeout. Complementarias:19 suites/98 pruebas aprobadas en22.832s. Fuente congelada verificada. No afirmar una ejecución global completamente verde ni sumar retests superpuestos;6234 casos únicos ejercitados, con la incidencia temporal conservada.

Evidencia: docs/whatsapp-surcharge-vs-total-validation-1610.json; logs /tmp/ppp-surcharge-{baseline,targets,affected,full,complement,tsc,timeout-recheck}.log. Cero API/Meta/mapas/órdenes externas; presupuesto183/178/5 intacto. Desplegado y verificado running/healthy, imagen activa=candidate sha256:d7d341e31e6c0fc19145f02b9c5ef8a96456c1e093150d93d741f2c25435eee2, health OK/DB connected/circuit CLOSED en2026-10-16T15:30:59.705Z, bindings compilados verificados. Modelos Sol6.1/Luna/Luna/GPT Transcribe intactos. Main conserva1a2b2e23; producción no reconstruida.

Siguiente: cambios de atributos mientras espera dirección nueva; aclarar alcance condicional ambiguo; nombres con conjunciones en ediciones solas. Investigar estabilidad temporal de la familia de ráfagas si vuelve a ocurrir; no aumentar timeout por rutina ni repetir toda la suite solo por docs. Estas pruebas no acreditan modelo/canal real ni política comercial de recargos.

## Condición de costo y otra acción independiente — 16/10

64 pruebas nuevas gratuitas. Baseline inicial: 48 fallidas/12 aprobadas; la condición de costo retenía también una eliminación o corrección de cantidad expresamente independiente. Ahora se separan exactamente dos cláusulas con marcador reconocido («y aparte», salto de línea «Aparte», «; además», «y además»), se conserva el cambio condicionado y se delega la otra acción a los manejadores existentes. No se inventa el recargo ni se afirma que todo el pedido sigue igual tras editarlo.

48 combinaciones positivas en dos cartas ficticias (arepas/yuca y gyozas/pepino), tres estados, agente simulado habilitado/deshabilitado, ambos órdenes y dos acciones; condiciones de gratuidad, sin costo extra y límite menor de 3000. 12 controles conservan el carrito con alcance no autorizado o segunda condición. Cuatro recorridos adicionales con wraps y bao: eliminación ambigua, elección «2», conservación del plato condicionado y pago todavía pendiente. Son 164 focalizadas aprobadas (64 nuevas + 100 controles), TypeScript aprobado y global de 57 suites/6097 pruebas WhatsApp en 876.626 s + 19 suites/98 complementarias en 11.707 s = 76 suites/6195 pruebas en dos ejecuciones disjuntas con fuente congelada y verificada.

Evidencia: docs/whatsapp-conditional-independent-validation-1610.json. Logs /tmp/ppp-conditional-independent-{baseline,targets-final,full,complement,tsc}.log. Cero API/Meta/mapas/órdenes externas; presupuesto 183/178/5 intacto. Desplegado solo en staging: código 2ec8d86d, running/healthy, imagen activa = candidate sha256:f93638e7eb333bcc8b5ca6e38114819dc0469759b0847414dd0d4810dcc5281c. Health OK, DB connected y circuit CLOSED verificados en 2026-10-16T14:59:33.034Z; splitter compilado y modelos Sol 6.1/Luna/Luna/GPT Transcribe intactos. Main conserva 1a2b2e23; no se reconstruyó producción.

Límites: condiciones ya reconocidas por el detector compartido y dos cláusulas con marcador explícito. No incluye altas de productos ni cambios de atributo como acción independiente; el alcance ambiguo conserva el carrito con la respuesta de costo desconocido, sin nuevo estado para aclaración posterior. No acredita inferencia/canal real. Siguiente: aclarar alcance y seguir correctamente la respuesta, recargo frente a total agregado después de editar, atributo mientras espera nueva dirección y nombres con conjunciones en ediciones solas. No repetir global por cierre documental.

## Consulta seguida de cambio de atributo — 16/10

56 pruebas nuevas gratuitas: 48 combinaciones de dos cartas (Bowl De Tofu/Salsa y Combo De Falafel/Bebida), tres estados, agente simulado habilitado/deshabilitado, dos consultas y dos formas de separarlas; cuatro opciones inexistentes; cuatro recorridos de ambigüedad en pitas/salsa y calzones/queso. Baseline inicial: 52 fallidas/0 aprobadas. Se responde la consulta y se aplica solo el cambio explícito con los manejadores existentes. No se agrega el producto suelto aunque el valor de la opción también sea vendible. Se conservan notas, cantidad, precio, dirección y la otra línea; las opciones inexistentes no mutan el carrito. Una lista de productos pendientes consume «2» como producto, no como pago.

156 focalizadas aprobadas (56 nuevas + 100 controles), TypeScript aprobado. Global: 57 suites/6033 pruebas WhatsApp en 901.821 s + 19 suites/98 complementarias en 12.027 s = 76 suites/6131 pruebas en ejecuciones disjuntas con fuente congelada y comprobada. Evidencia: docs/whatsapp-query-attribute-validation-1610.json. Logs: /tmp/ppp-query-attribute-{baseline,targets-final,full,complement,tsc}.log. Cero API/Meta/mapas/órdenes externas; presupuesto 183/178/5 intacto. Desplegado solo en staging: código c54dbbdd, running/healthy, imagen activa = candidate sha256:7c17765e65f1fb73d37329da039a9101e339f409c191c2a0fd59945e4f2b36b0. Health OK, DB connected y circuit CLOSED verificados en 2026-10-16T14:37:42.219Z; independentAttributeEdit compilado y modelos Sol 6.1/Luna/Luna/GPT Transcribe intactos. Main local/remoto conserva 1a2b2e23; no se reconstruyó producción.

Siguiente bloque: condición de costo con otra acción independiente, y límite entre recargo y total agregado («quita una unidad y dime cuánto cobran por cambiar la bebida»). Añadir cambios de atributos mientras espera nueva dirección y nombres con conjunciones en ediciones solas. Esta tanda no acredita todas las variantes con typos, todos los pasos pendientes ni inferencia/canal real. No repetir global por cierre documental.

## Main integrada y nueva tanda de staging — 16/10

Solicitud del usuario: integrar todo en Main y continuar probando en staging. Main local (/home/levi/Documents/programming/PPP/PPP-NEST) y origin/Main avanzaron por fast-forward de d9241abe a 1a2b2e23, sin conflictos ni cambios exclusivos de Main. Ese corte estaba validado con 6035 pruebas. Staging se conserva; no se reconstruyó el servidor de producción. GitHub CLI no tenía sesión para consultar CI remoto: no afirmar CI remoto verde. La integración se acredita con push correcto y fuente idéntica al corte validado.

Después se trabajó solo en staging: «quita una unidad y dime cuánto queda», «deja dos y cuánto vale todo» y eliminación de línea seguida de solicitud de total. Baseline: 28 fallidas/8 aprobadas en 36 casos. Ahora se aplica la edición por los manejadores existentes y se muestra el carrito resultante; no se cotiza primero el importe anterior. Se añaden cuatro casos de mismo producto con notas distintas: aclarar línea, recibir «2», retirar esa línea y conservar pago pendiente.

40 pruebas nuevas en cartas ficticias: 36 combinaciones de dos cartas, tres estados y agente simulado habilitado/deshabilitado; cuatro de ambigüedad en otras dos cartas. 172 focalizadas aprobadas (40 nuevas + 132 controles), TypeScript aprobado. Global: 57 suites/5977 pruebas WhatsApp en 873.549 s + 19 suites/98 complementarias en 11.748 s = 76 suites/6075 pruebas, en dos ejecuciones disjuntas con fuente congelada y verificada. Evidencia: docs/whatsapp-edit-then-total-validation-1610.json; logs /tmp/ppp-edit-then-total-{baseline,targets,full,complement,tsc}.log. Cero API/Meta/mapas/órdenes externas; presupuesto 183/178/5 intacto. Nuevo lote desplegado solo en staging: código bbbeee9a, running/healthy, imagen activa = candidate sha256:9bc6973940d13945d0614badc71287c40b33121197d0708726944168f0c5cd4f. Health OK, DB connected y circuit CLOSED verificados en 2026-10-16T14:02:48.190Z; bindings editAndTotal/asksEditedTotal compilados y modelos Sol 6.1/Luna/Luna/GPT Transcribe intactos. Main sigue en 1a2b2e23 y no recibe esta tanda posterior.

Siguiente: consulta más cambio de atributo; condición con edición independiente; nombres con conjunciones en ediciones solas; referencias cortas después de mencionar dos productos. Control de límite: «quita una unidad y dime cuánto me cobran por cambiar la bebida» pregunta un recargo, no el total agregado. El nuevo bloque valida totales con tarifa de domicilio ya conocida, no cotización geográfica ni inferencia/canal real. No repetir global por cierre documental.

## Consulta y edición independientes — 16/10

72 pruebas nuevas en dos cartas ficticias, con agente simulado habilitado/deshabilitado, carrito abierto y pago pendiente. Consultas de domicilio, composición o precio seguidas de quitar una unidad o dejar una cantidad exacta. Tres formas: signos de pregunta, conjunción sin signos y punto y coma. Se conservan notas, dirección y la otra línea. El nombre «Ramen De Hongos y Miso» no se divide como dos instrucciones en este camino.

El fallo inicial se reprodujo en 24/24 casos: se perdía una intención. También se comprobó que el cierre automático podía borrar la respuesta a la consulta; ahora se conserva como prefacio del resumen. Si ya hay dirección confirmada, el carrito puede avanzar al pago conforme a la política existente; estando en pago, retoma ese paso. Se reutilizan los manejadores de eliminación y cantidad, con sus comprobaciones de ambigüedad.

Validación: 172 focalizadas aprobadas (72 nuevas + 100 controles), TypeScript y 57 suites/5937 pruebas WhatsApp en 896.193 s + 19 suites/98 complementarias en 12.939 s: 76 suites/6035 pruebas en dos ejecuciones disjuntas con fuente congelada y verificada. Evidencia: docs/whatsapp-independent-intents-validation-1610.json; logs /tmp/ppp-independent-intents-{baseline,targets-final,full,complement,tsc}.log. Cero llamadas API, Meta, mapas u órdenes externas; presupuesto 183/178/5 intacto. Desplegado código f2b883f1: running/healthy, health OK, DB connected y circuit CLOSED verificados en 2026-10-16T13:39:01.849Z. Imagen activa = candidate: sha256:d7003d7bbf6678aeb34993bbf2d03fd9d224e0f5172d869bfecec1e0acd29161. Split y prefacio compilados verificados; modelos Sol 6.1/Luna/Luna/GPT Transcribe intactos. Main intacta.

Siguiente: orden inverso («quita una sopa y dime cuánto queda»), consulta más cambio de atributo y condición con otra edición independiente («si es gratis cambia la bebida; aparte quita una sopa»). Verificar total posterior a cambios, alcance de la condición y reanudación del checkout. Añadir también nombres con conjunciones en ediciones solas y referencias cortas tras dos intenciones. Esta tanda no acredita todos esos casos, todas las variantes con typos ni precisión del modelo/canal real. No repetir global por cierre documental.

## Condiciones de costo — 16/10

60 pruebas nuevas gratuitas:56 combinaciones en bowls/raviolis,compra/pago,agente simulado habilitado/deshabilitado y7formas de condición;4recorridos autorizan después un cambio explícito. Baseline inicial:32fallidas/4aprobadas;fallaba la respuesta (precio base,producto inexistente o pago repetido),sin mutación de carrito observada. No confundir con la tanda anterior que sí detectó cambios de atributos. Ahora se conserva el pedido ante costo desconocido y se retoma el dato pendiente. No se promete gratuidad por existir una opción.

134focalizadas aprobadas (60nuevas+74controles),TypeScript y global:57suites/5865tests WhatsApp en910.845s +19/98 complementarias en12.108s =76/5963 en ejecuciones disjuntas con fuente congelada y comprobada contra /tmp/ppp-conditional-cost-source.json. Evidencia docs/whatsapp-conditional-cost-validation-1610.json;logs /tmp/ppp-conditional-cost-{baseline,targets,full,complement,tsc}.log. Cero API/Meta/mapas/órdenes externas;presupuesto183/178/5 intacto. Desplegado código70541c2d:running/healthy,healthOK,DBconnected,circuitCLOSED verificado2026-10-16T06:19:02.307Z. Imagenactiva=candidate sha256:18fd402e393f709ebc4f03a3574197c60dcdb42b43dd7ad806d28c093301d6c5;guard compilado verificado,modelosSol6.1/Luna/Luna/GPTTranscribe intactos. Main intacta.

Siguiente bloque:consulta y edición independientes en un mensaje («¿cuánto vale el domicilio? Y quita una sopa»),luego alcance de condiciones con varias acciones («si es gratis cambia la bebida;aparte quita una sopa»). Oráculos:responder la consulta,aplicar solo edición autorizada,conservar cantidades/opciones ajenas y paso pendiente. Esta tanda no acredita resolución por cláusulas ni comprensión universal;no repetir inferencia de falafel/pizza ya medida. Piloto aún requiere recorridos completos con modelo/canal real y medición de costo;estos son mocks de router.

## Consultas de cambios y recargos — 16/10

40 regresiones nuevas en dos cartas ficticias y cinco pasos de checkout;74 focalizadas aprobadas. «¿Puedo cambiar X por Y?» llegaba a mutar atributos: se resuelve ahora antes de las ediciones. Consultas conservan sesión y retoman nombre/teléfono/dirección/pago/confirmación. No se inventa recargo ni gratuidad. Global:57 suites/5805 pruebas WhatsApp +19/98 complementarias =76/5903 en ejecuciones disjuntas con fuente congelada;TypeScript aprobado. Cero API nueva;183/178/5 intacto. Evidencia:whatsapp-swap-inquiries-validation-1610.json. Desplegado código00a8dfea:running/healthy,healthOK,DBconnected,circuitCLOSED verificado2026-10-16T05:57:05.114Z. Imagenactiva=candidate sha256:6e17051913b8bc70ef577990a7725b8581ec6d07b3c24fb194ca99d42a0a14a8;modelosSol6.1/Luna/Luna/GPTTranscribe intactos. Main intacta. Siguiente:mensajes mixtos de consulta+acción,condicionales y autorizaciones con límites;no asumir permiso de sustitución por existir una opción.

# PPP: estado y plan para piloto y venta

Actualizado el 15 de octubre de 2026, America/Bogota. Plan de trabajo, no certificación de calidad ni promesa de fecha. Las cifras de aceptación son propuestas para PPP.

## Decisión actual

Estamos en validación previa a un piloto supervisado. Las correcciones del chat Banderas y de continuidad de menús pasan pruebas aisladas en staging; queda acreditar esos recorridos con modelo y canal reales antes de iniciar piloto con clientes. Podemos hacer ensayos controlados de texto con participantes conocidos; todavía no acreditar un lanzamiento autónomo. No necesitamos esperar a cubrir todo el lenguaje para iniciar un piloto acotado, pero sí cerrar los defectos críticos conocidos del alcance, comprobar el canal real y disponer de intervención humana.

Primer alcance propuesto: PPP, pedidos inmediatos por texto, catálogo y domicilios configurados, efectivo y transferencia. Audio, fotos, reservas, abonos, redenciones y sustituciones con recargo quedan asistidos o fuera del alcance hasta acreditar su recorrido. Excluir una función requiere explicar esa limitación al cliente y ofrecer atención humana comprobada; no basta escribirlo en este documento.

## Referencias cortas — 16/10, lote validado

34regresiones nuevas y28controles existentes aprobados,TypeScript aprobado. «Ese trae…» conserva el plato;«el otro trae…» usa una única alternativa cuando hay ancla segura o aclara. Ingredientes vendibles no cambian el sujeto;una aclaración no consume el pago ni las opciones de un producto pendiente. Global aprobada:76suites/5863tests en dos ejecuciones disjuntas con fuente intacta. Código44b28dea desplegado en staging,running/healthy verificado16/10 00:42Bogotá;modelos sin cambios. Cero llamadas pagadas y presupuesto183/178/5 intacto;Main/modelos sin cambios. Evidencia whatsapp-short-references-validation-1610.json.

Siguiente:sustituciones,recargos y cambios consultados sin autorizar compra;después una muestra nueva con modelo real,resultado esperado fijado antes y tope suficiente. Las pruebas actuales acreditan router/estado/respuesta con dependencias simuladas,no recepción por WhatsApp ni comprensión de todo mensaje compuesto.

## Carta incompleta e interrupciones — lote validado

42regresiones nuevas gratuitas y4controles existentes aprobados,TypeScript aprobado. Global cerrada:76suites/5829tests en dos ejecuciones disjuntas con fuente intacta. Contrato del agente y product_info/composition ya indican que dato ausente no equivale a ausencia del ingrediente y que opciones son alternativas. Consultas descriptivas con nombres completos durante checkout responden sin consumir nombre,dirección o pago;varios platos conservan su descripción individual y los tamaños numéricos no se mezclan. El render conserva datos positivos y señala detalle no confirmado;comparación léxica conservadora,no garantía semántica ni de alérgenos.

Se validó continuidad de pregunta→total→cantidad→total→efectivo en2cartas con agente simulado activo/inactivo,sin crear pedidos. Cero llamadas pagadas en esta tanda,presupuesto183/178/5 intacto. Dos ejecuciones previas interrumpidas para ampliar controles no cuentan como aprobadas. Evidencia whatsapp-incomplete-menu-validation-1510.json. Después del cierre:referencias cortas a productos,negativos explícitos de la carta frente a detalles desconocidos y consultas de cambios sin precio autorizado;definir muestra nueva antes de inferencia. Código4fdd17d6 publicado y desplegado en staging;verificación efectiva en el relevo vigente. La modificación del prompt aún no tiene nueva validación con modelo real.

## Estado integrado — 15/10 22:14 Bogotá

Staging03c994d7 desplegado y healthy;Main intacta.76suites/5787tests en dos ejecuciones disjuntas con fuente intacta y TypeScript aprobado. Se consolidó el trabajo local posterior:descripciones,foco de productos hermanos,otra unidad/variante,retiradas con cantidad final,notas de pago,ortografía de carta y combo nombrado. El relevo anterior estaba desactualizado:falafel8turnos reales ya aprobado (12solicitudes,USD0.0893154),pizza6turnos real aprobado (4solicitudes,USD0.0416464);ambos retests de desarrollo,no holdouts. Fuentes en whatsapp-latest-integration-validation-1510.json y ledger. No extrapolar costos de esas muestras ni caché a rentabilidad.

Siguiente mejora de comprensión:la ausencia de un ingrediente/opción en description no acredita que no lo traiga;corregir contrato product_info y probar catálogos incompletos antes de una nueva muestra pagada. Canal y audio original siguen separados. Un ensayo redundante propio se interrumpió al detectar fuente/ledger avanzados:8intentos contados,costo desconocido,sin resultado aceptado. No se hicieron más llamadas tras congelar fuente con el usuario;evitar esa repetición actualizando relevo antes de inferencia. Presupuesto183/178/5.

## Checkout: nueva muestra y costo — 15/10

La carta nueva de falafel reveló que placedOrderOnly descartaba una respuesta correcta del modelo durante pago y luego una edición de bebida incluida. No se aceptó el recorrido: primera muestra5solicitudes,retest8,ambos detenidos al primer fallo.USD0.0552688estimados en total de esta tanda. El menor costo del retest se debe al cache observado; no equivale a un promedio representativo de producción. Correcciones generales y41pruebas nuevas con continuación gratuita; global aprobada:76suites/5680tests en dos ejecuciones disjuntas con fuente intacta y TypeScript. Código dc14fa05 publicado en staging; ver verificación efectiva de despliegue en relevo vigente. Evidencia whatsapp-checkout-tools-validation-1510.json.

Siguiente puerta: terminar global, publicar lote en staging y validar el recorrido completo con inferencia bajo tope suficiente, además del canal. El ensayo fallido ya no es muestra reservada. Antes de fijar suscripción medir conversaciones que compran y que abandonan, rondas/cache/reintentos y costos de terceros. USD0.045de la tanda anterior fue TOTALpor6solicitudes: a ese costo observado1000recorridos idénticos≈USD45soloIA. No prometer volumen ilimitado con esa única muestra.

## Completitud: avance del 15/10, siguiente tanda

El ensayo de oficina ya completó los cuatro turnos con el modelo real: una conversación de desarrollo aceptada,6solicitudesHTTP200,notas/cantidades correctas y totales80000→75000. La herramienta ahora separa la compra de la consulta condicional y no declara «Multi claro» como garantía de completitud. Evidencia en whatsapp-tool-completeness-validation-1510.json; gasto estimadoUSD0.0450182,excluye transporte/infraestructura/impuestos. Es una observación, no distribución de costo ni prueba de rentabilidad. Tope operativo145/141/4. Validación global cerrada:76suites/5639tests en dos ejecuciones disjuntas con fuente intacta y TypeScript aprobado. Código d120b267 desplegado en staging; ver estado del contenedor en el relevo vigente. Main intacta.

Siguiente: cerrar la global, integrar en staging; luego una muestra nueva de otra carta con consulta intercalada, opción incluida y corrección durante checkout. Mantener los oráculos definidos antes de ejecutar, distinguir pruebas gratuitas/modelo/canal y detenerse al primer fallo. No gastar las cuatro solicitudes restantes en una conversación que probablemente necesite más: reservar un tope suficiente antes de comenzar. Las pruebas de WhatsApp original y audio real siguen siendo otra puerta del piloto.

## Seguimiento de costo y completitud — 15/10, posterior a la corrección de fotos

Nueva muestra real aislada con Sol:4HTTP200,acciones correctas para6ítems/notas,pero sin respuesta final porque el runner alcanzó el tope de4. Resultado incompleto; no aceptado como conversaciónE2E. Costo parcial USD0.0234683 y11.828s para el turno interrumpido; no extrapolar a precio/latencia de un pedido terminado. Presupuesto operativo135/135/0; no es una nueva limitación dictada por el usuario. Las cifras anteriores de4solicitudes disponibles son históricas.

El modelo hizo búsquedas para recuperar un té que resolve_multi_order había omitido mientras anunciaba «Multi claro». Siguiente mejora arquitectónica: devolver cobertura explícita por producto y ausencias/pendientes estructurados, no más excepciones por nombres ni solo ampliar frases del render. Medir reducción de rondas y validar una conversación completa antes de considerar superada esa puerta.

La nueva tanda gratuita sí detectó y corrigió notas explícitas de empaque («salsa aparte»,«cubiertos aparte») perdidas en filas fotografiadas.11regresiones nuevas cubren esas notas, continuidad en pago con2menús y recuperación de acciones capturadas. La corrección de cantidad de la continuación usa una respuesta de herramienta simulada, no otra respuesta de Sol. Cierre:76suites/5636tests aprobados con fuente intacta en2ejecuciones disjuntas,TypeScript aprobado; staging1e90c7c1 desplegado y healthy,Main intacta. Evidencia en WHATSAPP-LOCAL-NEXT-AGENT.md y whatsapp-office-packaging-validation-1510.json. No elevar esta tanda a aceptación comercial.

## Actualización vigente — 15 de octubre

Staging integra los modelos nuevos: agente Sol, visión/clasificación Luna y audio GPT-Transcribe. Los resultados y costos medidos están en `WHATSAPP-MEDIA-MODELS.md`; no inferir precisión acústica de clientes a partir de voz sintética ni paridad con Main. Fotos de carta se añaden completas por solicitud expresa del usuario, con una unidad por defecto y prioridad del pie que selecciona/consulta. Este contrato reemplaza el anterior «carta sin selección pregunta cuáles».

Prioridad inmediata: publicar, tras global íntegra, la respuesta de fotos sin texto posterior y la corrección de compra de un paquete con condición de inventario. Validación detallada y estado real en `WHATSAPP-LOCAL-NEXT-AGENT.md`; el historial inferior tiene cifras y modelos antiguos, no es configuración vigente. Las33regresiones nuevas quedaron verificadas:76suites/5625tests aprobados con fuente intacta (57suites WhatsApp más19complementarias, ejecuciones disjuntas) y TypeScript. Desplegado en staging df0560fa, running/healthy verificado 2026-10-15T22:26:33.992Z; esta evidencia no sustituye el reenvío real de la foto ni acredita aceptación de piloto.

Siguientes puertas, en orden:
1. Reenvío humano de la foto original en staging sin «hola» posterior: carrito completo, respuesta emitida y sin repetición de productos. Comprobar también foto seguida de nota y dos fotos de un mismo pedido. Reservar pruebas de retry tras reinicio/caducidad y recuperación de envío para la fiabilidad durable; la caché temporal no la demuestra. El transporte mock no acredita recepción en WhatsApp.
2. Muestra acotada de conversaciones nuevas con el modelo real, resultado esperado definido antes de ejecutar: pedido largo, consulta intercalada, cambio absoluto de cantidad y sustitución. Registrar por turno si hubo inferencia, carrito/respuesta, tiempo y costo. Una conversación usada para corregir deja de ser reservada.
3. Medición por pedido y tenant de tokens/cache/razonamiento/audio/reintentos, más Meta y mapas. Aún no existe una distribución representativa de costo ni p50/p95 que permita prometer una suscripción ilimitada rentable.
4. Piloto supervisado de alcance acordado con efectivo/transferencia: ningún defecto crítico conocido sin resolver o contención explícita; persona disponible y revisión de incidencias. No promover a Main sin petición de Wilmer.

Presupuesto operativo vigente135/131usadas/4restantes; autorización de inferencia moderada persiste, pero esta tanda es gratuita. No sustituir pruebas de canal por más variaciones de Jest ni declarar vendible por su contador. Las lecturas/estados de producción del historial no se han verificado de nuevo en esta tanda.

## Historial — estado del 14 de octubre


La evidencia detallada vigente está en `AGENT-HANDOFF-WHATSAPP.md`. Main/producción permanecen en d9241abe. Nueva tanda validada y desplegada en staging runtime f7be1f7d:66 suites/5233 pruebas,101 focalizadas en dos suites y TypeScript aprobados, fuente intacta (/tmp/ppp-continuity-contract-full-final2.log).62 regresiones nuevas incluyen conversaciones completas con producto/opción/precio/nota/dirección/nombre/total/efectivo, compra por código frente a consulta de pedido, corrección de bebida incluida con reversión segura de la última bebida añadida y eliminación por fila durante captura de datos/pago/confirmación. Fila inválida, otra lista activa, firma de carrito obsoleta o varios combos no autorizan mutaciones por suposición.

Staging verificado14/10 a las18:02 Bogotá:running/healthy,imagen activa=candidata,HTTP ok/DB connected/circuit CLOSED. La reversión requiere registro de última adición y carrito intacto; pedidos históricos sin ese registro requieren aclaración. Se comprobó read-only WHATSAPP_AGENT_V1=true y clave de entorno configurada en staging/producción; agente activo en ambos. Los fallos reproducidos son de coordinación y estado, no evidencia de desactivación. Cero API nueva;39/40 solicitudes usadas,una restante. Esta tanda no representa una refactorización completa ni una evaluación independiente del modelo real.

Siguiente: consolidar pregunta activa/referencia/versión de carrito y un aplicador común de comandos; completar retorno de teléfono/datos faltantes y cambios de foco; validar muestra independiente con modelo/canal reales. Mantener alcance supervisado y no declarar listo por el contador de Jest.

Evaluación real de un pedido narrado consumió3 solicitudes: el modelo interpretó2 platos/1 plato/3 bebidas, pero el backend guardó1/1/1. Ese ensayo falló. La corrección está cubierta por replay offline de la salida capturada; aún falta otra ejecución representativa real. Solo queda1solicitud autorizada y un turno con herramientas puede necesitar varias. No usar el saldo para repetir a ciegas ni prometer una ronda completa.

Prioridad siguiente: probar una muestra independiente de pedidos completos/interrupciones, acreditar modelo/canal y cerrar los defectos críticos del alcance del piloto. Mantener piloto supervisado por texto y efectivo/transferencia; medios y casos no acreditados requieren asistencia. La consulta de cobertura debe recordar el carrito, cotizar sin cambiar destino y permitir volver al paso pendiente.

## Evidencia histórica y límites

- Backend: 66 suites / 3.227 pruebas aprobadas, TypeScript aprobado. Verificación completa en una ejecución: /tmp/ppp-cancel-courtesy-edit-full-final.log,307.352s. Incluye la tanda de básicos/extras y continuidad con pausas. Incluye cantidades, notas, opciones, correcciones, consultas, ráfagas, referencias, direcciones y pedidos completos. No todas las pruebas son conversaciones; gran parte simula modelo, Meta y persistencia.
- Tanda posterior de pruebas, sin cambios de runtime:68 casos nuevos; suite general afectada1484/1484 aprobada y TypeScript aprobado. Cubre consultas durante captura de nombre/teléfono/dirección, negocio cerrado y respuestas cortas con/sin elección pendiente en catálogos ficticios. Log /tmp/ppp-fields-closed-short-suite.log. No equivale a una nueva ejecución global ni acredita el modelo real.
- Interrupciones:96 nuevos recorridos de precio,total,recap y corrección de cantidad durante captura de datos/pago, con continuación del dato pendiente. Dos catálogos ficticios y agente simulado activo/inactivo. No acredita todas las intenciones posibles ni canal/modelo reales.
- Generalización: menús ficticios vegetarianos, marinos y orientales; hamburguesas, pizzas y bowls sin conceptos de ejecutivo/menú. Las últimas dos tandas añadieron39 casos y encontraron errores reales en correcciones y alcance. Esto acredita esos patrones en esos catálogos; no cualquier restaurante ni aislamiento multitenant.
- Versión validada y desplegada de código: 0508049d en staging, running/healthy, imagen activa igual a candidata y health ok/DB connected. Verificada el 13/10 a las 14:32 Bogotá; una actualización documental posterior no requiere reconstruir API.
- Producción: esta última tanda no se promovió. No asumir paridad entre producción y staging por usar el mismo modelo. La versión efectiva de producción debe comprobarse al preparar promoción.
- Modelo configurado según última lectura: gpt-4.1-2025-04-14 para texto/imágenes en ambos entornos, whisper-1 para audio. No se volvió a verificar configuración efectiva durante la tanda gratuita final.
- API real: última tanda documentada, cuatro conversaciones aceptadas; dos usaron inferencia y dos fueron deterministas, diez solicitudes incluyendo la ejecución limitada y su continuación. Se evaluaron antes del último ajuste de presentación de propuestas vacías; no acredita todavía la nueva tanda local de desistimiento y compra. Presupuesto vigente40 autorizadas/39usadas/1restante en docs/whatsapp-model-budget.json; contabilizar cada intento, incluidos fallos/reintentos.
- Canal: el preflight documentado verificó acceso/destinatario/aislamiento, con webhookPosts=0. No es una prueba de mensajes originados y recibidos por un teléfono.
- PDF:26 patrones ejercitados en backend, no todos los chats/variantes ni percepción real de los archivos. Audio e imágenes originales siguen pendientes de una evaluación representativa.

## Qué falta, en orden

### 1. Cerrar la siguiente tanda gratuita

Responsable: agente. Usar router real con dependencias externas simuladas, carrito/estado/respuesta como oráculos y catálogos PPP y ficticios.

1. Cobertura: una tarifa calculada no demuestra que el domicilio esté en zona. Revisar preguntas con calle numérica y tarifa fija; pedir ubicación o aclaración cuando no haya evidencia geográfica suficiente.
2. Opción que no existe: no declarar un cambio ni inventar variante/precio.
2. Pregunta condicional o de precio: no comprar ni modificar por preguntar «¿se puede con…?» o «¿cuánto cuesta cambiar…?» sin intención de cambio inequívoca.
3. Cambio durante cierre: modificar dirección, cantidades, notas y opciones conservando los otros datos; recalcular resumen y volver a pedir confirmación cuando corresponda.
4. Precio y permisos: el contrato del catálogo debe distinguir opción sin recargo, adicional vendible y sustitución que requiere autorización. Cuando falten datos, aclarar o derivar; no inventar equivalencias.
5. Casos nuevos reservados: otro vocabulario, interrupciones y mezclas no usados para corregir. Un caso usado en desarrollo deja de ser reservado.

Salida: regresiones necesarias verdes, full/TypeScript si se modifica regla compartida, ningún defecto crítico conocido sin resolver dentro del alcance. Un defecto crítico cambia unidades/productos sin autorización, pierde una corrección, inventa un importe o mezcla clientes. No prolongar indefinidamente la fase por añadir variaciones de casos que ya pasan.

### 2. Comprobar el modelo y el canal reales

Responsable: agente; Wilmer ayuda a verificar recepción.

- Elegir6–8 recorridos cortos: pedido fácil, ejecutivo con componentes, pedido completo largo, aclaración, corrección al cerrar y consulta seguida de compra. Definir resultado esperado antes de ejecutarlos.
- Usar llamadas restantes en lotes pequeños, un intento por caso y parada ante fallo; nunca asumir que un caso cuesta una llamada. Reservar parte del saldo para diagnóstico. Revisar gratis el fallo antes de repetir.
- Acreditar qué turnos realmente usaron inferencia. Un runner con agente habilitado que hace0solicitudes solo acredita ruta determinista.
- Antes de ejecutar el ensayo de11pasos del canal, añadir un límite efectivo de solicitudes: el runner documentado no limita hoy el modelo por sí solo.
- Probar mensajes auténticos desde el teléfono autorizado y observar recepción/respuesta, ráfaga, reintento y carrito final. No confirmar órdenes externas de prueba sin comprobar aislamiento.
- Verificar intervención humana: pedir persona, conservar contexto/carrito y comprobar que una persona puede atender. No aprobarlo por el texto de un mensaje automático.

Salida: informe por conversación con resultado comercial, versión, inferencia utilizada y errores. Esta puerta es necesaria antes de admitir clientes del piloto; el resultado gratuito no la sustituye.

### 3. Preparar una versión de piloto

Responsable: agente prepara; Wilmer decide publicación y operación.

- Identificar commit de código/configuración/catálogo/modelos y promover a Main únicamente cuando Wilmer lo solicite. Mantener staging. Después del deploy verificar versión activa y health.
- Preparar y comprobar reversión a la versión anterior y una forma de pausar el bot/atender manualmente.
- Validar catálogo, precios, domicilios, valores por defecto y política de cambios del local.
- Definir horario, persona responsable y cómo recibe las conversaciones que necesitan ayuda.
- Registrar pedidos intentados, resultado del carrito, tiempo, intervención, costo e incidentes. Sanitizar corpus; no publicar conversaciones privadas.
- Comprobar una orden controlada extremo a extremo con el local antes de recibir pedidos del piloto. Es una verificación mínima operativa, no una nueva fase de implementación de cocina/pagos.

Salida: versión identificada, canal real acreditado, responsable disponible, resumen confirmable y pausa/reversión comprobadas.

## Cuándo podemos probar el piloto

Ensayo controlado: ya podemos organizarlo en staging con mensajes de texto y participantes conocidos, respetando presupuesto/aislamiento; no equivale a atender clientes sin supervisión.

Piloto real reducido: al terminar las tres puertas anteriores. Propuesta inicial10–20 conversaciones que intenten pedir, durante un horario atendido, revisando todos los pedidos antes de procesarlos. No prometer una fecha hasta verificar modelo/canal y responsable humano. No exige terminar Kamppo ni perfeccionar audio/fotos si esas funciones se derivan de forma comprobada.

Ampliación: si esa primera muestra no presenta incidentes críticos abiertos, ampliar progresivamente hacia100 conversaciones en varios días/horarios. No completar la muestra seleccionando solo éxitos; registrar abandonos, consultas y fallos por separado. Cualquier incidente crítico pausa la ampliación, se corrige, recibe una regresión y se vuelve a comprobar el patrón.

## Cómo decidimos si ya se puede vender

Propuesta para venta asistida, posterior al piloto:

- Cero incidentes críticos abiertos y revisión de todos los de la muestra. No garantiza ausencia de fallos futuros.
- Al menos95% de intentos de pedido con resultado correcto contando ayuda humana; informar aparte el porcentaje sin ayuda. Una conversación derivada no es éxito automático.
- Intervención humana funcional en todas las solicitudes explícitas observadas, con contexto conservado.
- Medir latencia mediana/p95, repreguntas, abandono, costo por pedido y tiempo humano. Objetivo de texto p95≤15s provisional, pendiente de línea base; no está medido por tests locales.
- Que el local observe beneficio: menos trabajo o pedidos recuperados. Si aumenta el soporte, revisar alcance antes de vender.
- Onboarding, mantenimiento de catálogo, soporte, límites de consumo y reversión documentados. Fijar precio usando API, Meta, infraestructura y soporte medidos, sin estimar margen a partir de tests.

No dar un porcentaje de «terminado»: las pruebas locales no equivalen a una tasa de éxito real. El próximo hito relevante es completar pedidos supervisados con clientes, no alcanzar un número mayor de pruebas.

## Audio, imágenes y Kamppo: ampliaciones posteriores

Audio: obtener3–5 originales iniciales y transcripción esperada; medir producto/cantidad/opciones/nota/dirección, costo y latencia. Comparar el modelo actual con candidato antes de cambiar. Esta muestra es inicial, no calidad general.

Imágenes: originales con uno/varios productos y capturas de menú frente a carrito. Comprobar cantidades y opciones, no solo nombres. Mezclar texto/foto/audio en secuencia sin perder pedido.

Kamppo: reutilizar reglas y suites con adaptadores de catálogo/configuración. Probar aislamiento de sesiones, precios, credenciales, órdenes, puntos y eventos por tenant antes de varios negocios. Los catálogos ficticios acreditan portabilidad de lenguaje, no multitenancy operativa.

## Lo que necesita aportar Wilmer

No bloquea la próxima tanda gratuita. Para iniciar el piloto sí necesitamos:

1. Una persona disponible y un horario de supervisión.
2. Validación comercial de catálogo, domicilios y cambios permitidos; aclarar cualquier política que no esté representada.
3. Ayuda para observar mensajes/pedidos auténticos y autorización de promoción de la versión preparada.

Audios/imágenes originales son necesarios para ampliar esos canales, no para iniciar un piloto limitado a texto con derivación funcional. No volver a pedir accesos ya autorizados ni credenciales por chat.

## Fuentes internas y siguiente acción

Estado: docs/AGENT-HANDOFF-WHATSAPP.md. Tandas: docs/whatsapp-next-batches.md. Presupuesto: docs/whatsapp-model-budget.json. Índice PDF sanitizado: scripts/fixtures/whatsapp-pdf-1110-patterns.json.

Siguiente acción: medir recorridos con inferencia y canal real acotados; añadir primero un límite efectivo para el ensayo real. La tanda gratuita de opciones inexistentes/consultas/cambios durante cierre está cerrada en su alcance documentado. No promueve automáticamente a producción ni acredita el piloto.

## Cierre de la tanda gratuita previa al piloto — 12/10

30regresiones nuevas;76focalizadas + full65suites/1.958pruebas y TS aprobados. Corregidas preguntas que cambiaban opciones, fuente de cantidad contaminada por dirección y respuesta de opción inexistente que se confundía con plato. Preguntas de recargo sin datos no alteran carrito ni inventan precio; cambios explícitos durante cierre conservan dirección/pago/nota y renuevan resumen. El contrato no contiene tarifas/permisos de sustitución: se deriva su confirmación, no se acredita recargo automático. Cero llamadas pagadas, saldo5. Desplegada50556d2d y verificada12/10 12:09 Bogotá, healthy/DB connected. Evidencia en relevo y /tmp/ppp-pilot-gate-deploy-verified.log.

## Prioridad nueva: chat Banderas

Diagnóstico gratis12/10, cinco escenarios fallidos en staging actual. Ver docs/WHATSAPP-BANDERAS-DIAGNOSIS.md. Prioridad antes de inferencia/canal y del piloto: corregir consultas de precio interpretadas como compra, reclamo que duplica producto, corrección que se guarda como nombre y actualización de referencia de dirección. Añadir recorrido completo y versiones con otros catálogos. La tanda anterior fue aprobada en su alcance; no acredita estos casos nuevos. No se gastó API ni se cambió producción.

## Plan actualizado: integrar cambios y mejorar voz

1. Aprobar snapshot actual con full/TS, confirmar cambios locales en staging y verificar la nueva imagen; Main conserva su versión hasta promoción solicitada.
2. Voz: el reconocimiento y la interpretación se miden separados. La transcripción tiene contexto de ortografía desde el catálogo, sin inventar menú/porciones. Whisper permanece predeterminado; candidato configurable solo para comparación controlada. Recorridos de audio simulado acreditan router, no calidad acústica.
3. Obtener3–5 audios originales nuevos con consentimiento para prueba y resultado esperado (combo alitas+bebida+dirección, pedido largo, corrección, ruido). Hoy el usuario no conserva originales; no enviar grabaciones ajenas encontradas en Downloads. Comparar los mismos archivos, medir producto/cantidad/opciones/dirección, costo/latencia; una llamada por intento, sin reintentos automáticos, dentro de15restantes y ledger.
4. Próximas tandas gratis: varios platos similares con diferentes atributos/notas, cambios que afecten una sola línea de un pedido grande, desistimiento de una aclaración y audio fallido seguido de texto. Reservar casos nuevos fuera de desarrollo.
5. Tras aprobar inferencia/canal y supervisión humana, piloto limitado. No presentar todo el producto como vendible por el número de tests. Recargos y sustituciones no descritos en carta requieren confirmación comercial.


## Próxima puerta de comprensión — básicos y extras
Las tandas se priorizan por cambios accidentales de producto/cantidad, pérdida de atributos y bucles de aclaración, seguidos de claridad de respuestas. La tanda actual agregó16casos y corrigió normalización de plural/cortesía;34focalizadas pasan; full66suites/2144aprobado. Consultar docs/whatsapp-next-batches.md para los8bloques con oráculos. A continuación seleccionar pocos recorridos representativos para inferencia real dentro del saldo5:pedido dividido con interrupción,consulta de precio en cierre,pedido grande con reparto,extra frente a incluido. Un fallo vuelve a diagnóstico gratuito antes de gastar más. Audio exige grabaciones originales para medir reconocimiento; los mocks no acreditan esa calidad.


## Verificación actual13/10
Conjunto local2335pruebas y TypeScript aprobado. Nuevos bloques:continuidad con consultas,desistimiento,cortesía,reparto de bebidas,corrección de una línea,recogida y cambios de pago,seguimiento posterior y propuestas sin productos disponibles.4recorridos representativos con modelo configurado aceptados (2usaron inferencia real), Meta/DB/órdenes aisladas;10solicitudes nuevas incluyendo ronda limitada y completada. Saldo5, no15. No acredita entrada genuina desde un teléfono ni atención humana operativa. Próximo paso crítico:ensayo supervisado de texto en el canal y medición de carrito/opciones/respuesta, con intervención humana comprobada. Audio/fotos todavía requieren originales para medir percepción. El listado de variantes no se considera una garantía para cualquier restaurante.


Tanda13/10:64casos nuevos en ocho menús distintos; exclusión por unidades con producto/total explícitos y controles de incoherencia. Full2535/66yTypeScript aprobado. No acredita percepción real ni cambios de atributo por subconjunto o durante pago. La incidencia de compra+opción+empaque queda pendiente de reproducción aislada.


Tanda13/10:98regresiones adicionales de plato/opción/empaque y consulta de cobertura sin autorización de dirección; catálogo variado y pasos de pago/confirmación. Full2633/66yTypeScript aprobado. Caso “Me traen un pedido hasta El Tintal?” pide dirección precisa y conserva el pedido; no acredita cobertura real de esa zona. Cambio explícito de dirección tiene prioridad sobre consulta.


## Auditoría de básicos antes de ampliar casos extremos

Una misma frase se debe comprobar al armar carrito, elegir opciones, dar nombre/teléfono/dirección, pagar y confirmar. El número de pruebas no demuestra que esos cruces estén cubiertos.

1. Preguntas de servicio: horario, ubicación, domicilio y posibilidad de recoger. La tanda actual verifica84casos en dos catálogos y tres pasos activos; incluyó fallos de respuesta y cambio de entrega por preguntar. Pendiente negocio cerrado y pasos de datos personales.
2. Compra simple: nombre/código/cantidad, opción omitida, producto no disponible y cortesía. Hay suites existentes; revisar referencias cortas y productos con nombres cercanos en cartas nuevas.
3. Consultas antes de comprar:precio,qué trae,disponibilidad. Deben conservar carrito y dejar elegir después; la referencia “eso” depende de contexto real. La tanda actual agrega precio consultado y FAQ seguida de compra explícita.
4. Edición: cantidad,quitar producto,nota y opción. Confirmar que cambia solo lo solicitado y pedir aclaración ante varias líneas posibles. Cubierto en familias previas, no todos los subconjuntos o pasos finales.
5. Domicilio:preguntar cobertura no es dar dirección;dirección nueva debe corregir la anterior;referencia de acceso no debe sustituir calle/número. Cobertura numérica con tarifa fija todavía necesita evaluación; no asumir cobertura por obtener un precio.
6. Respuestas cortas y cierre:sí/no/ok/gracias deben interpretarse según la pregunta pendiente. Añadir controles sin oferta pendiente, rechazo antes de confirmar y reinicio sin restos. Conservar los límites de aislamiento antes de ensayos con canal real.

Cada fallo básico bloquea la familia correspondiente del piloto hasta reproducirlo,corregirlo y revisar el recorrido. La tanda gratuita acredita reglas y flujo con dependencias simuladas; el piloto todavía requiere canal real y atención humana.


Cierre de básicos13/10:84casos nuevos aprobados y full2749/66verde. Se corrigieron servicio durante checkout,ubicación consultada frente a dirección declarada,posibilidad de recogida frente a elección y FAQ seguida de compra. Mantener pendientes negocio cerrado,respuestas cortas y pasos de datos personales:los tres pasos probados no acreditan todos los contextos ni inferencia/canal reales.

Se integraron32pruebas locales adicionales de resumen,total,pagos consultados,servicios del local y cobertura después de calle; incluidas en el full2749. La tanda de este agente aporta84,la integración aporta116 en total frente a2633. No usar el total de mocks para afirmar cobertura real o venta autónoma.

## Criterio de conversación mientras espera un dato

Comportamiento objetivo:responder primero una consulta resuelta y terminar con un recordatorio del siguiente dato u opción pendiente. Una corrección debe actualizar el pedido y recalcular qué falta; no elegir datos ni agregar platos por una pregunta. Si la consulta necesita aclaración, priorizar esa aclaración y conservar el paso anterior sin dos preguntas competidoras. Cancelación explícita e intervención humana deben tener sus propios recorridos.

Nueva familia aprobada en pruebas gratuitas:96recorridos de recordatorio con sabores,selección y carrito múltiple;18secuencias completas basadas en Arroz Paisa y dos cartas ficticias (consulta de precio mientras pide nombre,consulta de combo,nombre real y nueva consulta durante pago). La secuencia detectó un bloqueo con agente activado que no mostraban los turnos aislados. Prueba final66suites/3027aprobada;despliegue591c134e verificado en staging, no acreditar como producción. Próximo:consulta de precio ambigua seguida de nombre/número del producto sin duplicar el carrito,consultas repetidas y cambios durante esa aclaración.

## Próximas tandas por riesgo — 13/10/2026

No medir avance solo por cantidad de pruebas. Para cada familia comprobar respuesta,carrito,datos pendientes y siguiente turno; incluir menú ficticio con opciones y otro sin ellas. No declarar un hueco resuelto hasta reproducirlo.

1. Consultas ambiguas:carrito múltiple, “qué precio tiene”,respuesta por nombre o número. La aclaración explícita “el precio de X” pasa16recorridos nuevos; suite general afectada1710/1710 aprobada y TypeScript aprobado (/tmp/ppp-ambiguous-explicit-suite.log). Solo pruebas/documentación;no deploy requerido. 84regresiones nuevas acreditan nombre exacto,ordinal/número de lista,desistimiento,interrupción y dato válido; contexto informativo separado del carrito. No acredita toda referencia vaga ni nombres con typos. Consultar dos veces y desistir debe conservar pedido.
2. Cambio de intención:pregunta de sabor seguida de otro producto,corrección de cantidad,quitar solo una línea y “olvida eso”. Distinguir cancelar elección pendiente de vaciar el pedido completo. No aplicar una nota a todos los platos por defecto.
3. Consultas y acciones juntas:“cuánto vale y quita una”,“sin ensalada y para otra dirección”. Comprobar que atiende ambas y recalcula el total sin duplicar unidades. Si falta identificar línea,aclarar antes de mutar.
4. Referencias y tiempo:respuestas a mensajes antiguos,ráfagas con consulta intercalada,dos carritos mencionados y regreso tras pausa. No atribuir a la última línea una referencia que apunta a otra ni reconstruir pedidos expirados sin intención.
5. Datos versus lenguaje común:preguntas sin signos,typos,nombres de locales frente a nombres de personas y negativas cortas. No convertir consulta en nombre/dirección ni “sí” ambiguo en pago/compra.
6. Catálogo y domicilio:no inventar disponibilidad,recargo o cobertura por tarifa fija; preguntar ubicación cuando la evidencia no alcanza. Precio vigente de carta y precio de línea guardada deben explicar discrepancias.
7. Canal/modelo reservado:solo después de cerrar los defectos críticos reproducidos,elegir pocas conversaciones nuevas para las5llamadas restantes. Audio original e imagen real siguen necesitando evaluación representativa; mocks no acreditan percepción.

Oportunidades de experiencia:una pregunta pendiente por respuesta,resumen solo cuando ayuda,confirmar cambios mostrando qué se modificó,y conservar contexto al derivar a persona. Acreditar estas mejoras con recorridos completos y casos reservados,nunca solo con una respuesta bonita.

Resumen compacto:12regresiones verifican dirección una sola vez en el resumen de pedido,dirección conservada en carrito aislado,productos/opciones/notas e importes intactos. Full integrado66/3139 aprobado;deploy850d7ccc verificado en staging. Main intacta.

Cancelación de selección,pruebas aprobadas:36regresiones nuevas con carrito previo y notas,pedidos de bebida por sabor/producto y rechazo de bebida en plato compuesto. Distinguen abandono de selección frente a vaciar todo,verifican que opción vieja no reviva producto y conservan carrito. Verificación global66/3175 y TypeScript aprobados;deploy553a2087 verificado en staging. Siguiente ampliar cortesía/typos,alias de atributos y rechazo al editar opciones de una línea existente;no extrapolar estas36a toda forma de cancelación ni a órdenes registradas.

Tanda cortesía/edición,pruebas aprobadas:52nuevas regresiones cubren6frases con cortesía/typos,cancelación de edición de sabor,atributos Preparacion/Coccion,negación de cancelación,consulta intercalada y selección por número. Colisión nombre/opción(Mango en nombre pero solicitaLimon) usa fuente original del cambio para evitar reinterpretación.88focalizadasaprobadas,TypeScriptaprobado y full66/3227aprobado;deploy0508049d verificado en staging. No acredita rollback de una sustitución de SKU ya aplicada. Próximo:reproducir sustitución→opciones pendientes→cancelación y restaurar línea original si contrato lo requiere;propuestas múltiples y consulta+acción en mensaje/ráfaga.


### Puerta de piloto: correcciones e intención por encima del paso pendiente (13/10/2026)

La tanda actual valida los chats de dirección vieja durante pago, pregunta copiada con calle nueva, “otra dirección” sin destino, compra parcial inmediata y cantidad de paquetes. Aún no acreditada globalmente: ver relevo y /tmp/ppp-user-chat-full.log. Verificar también regresiones de dúo→consulta de sabores→elección y corrección de botella por plato ya integradas por otro trabajo en ac634386.

Antes de declarar listo el piloto:
1. Completar regresión global y revisión de carrito/respuestas; expectativas antiguas de sí no deben ocultar duplicados o selecciones perdidas.
2. Probar atributos realmente pendientes en pedidos mixtos, dos ambigüedades consecutivas, consultas entre elecciones y aceptar solo un acompañamiento sin aceptar la bebida pendiente. Preservar cantidades/notas y no crear productos desde prosa del bot.
3. Comprobar recotización de domicilio con mock que cambie tarifa/distancia; salud del servidor no acredita comprensión ni cálculo correcto.
4. Revisar catálogo con nombres duplicados, contenidos de combos, errores como Colmbiana y datos sintéticos de clientes antes de exposición real. Es un control de datos/configuración, no un parche por producto.
5. Reservar las 5 llamadas autorizadas restantes para conversaciones que ejerciten modelo real después de aprobar gratis. Ninguna llamada usada en esta tanda.

Main permanece sin tocar. Staging es la única rama de integración; no basta que la rama esté publicada: documentar imagen activa/health al finalizar deploy.


Cierre de la tanda de dirección/pedidos mixtos:66suites y3369pruebas aprobadas;TypeScript aprobado;fuente verificada por snapshot.34regresiones propias nuevas cubren dirección durantepago/pregunta copiada/rechazo sin destino,recotización,compra parcial,paquetes1/2/5,dosambigüedades yaceptación parcial conBebidapendiente en diferentescatálogos. Aprobación localconmodelo yserviciossimulados;no equivale avalidación deaudioSTT ni deWhatsApp/modeloreal. CeroAPI. Pendiente registrar despliegue.


Staging publicado/desplegado yverificado13/10/2026 18:50Bogotá,códigofb70c472,healthy,imagenactiva=candidata,healthok. Main no modificada. Piloto aún requiere validar modelo/canal real ydatos de negocio;el pase3369es con dependencias externas simuladas. Próximo foco:opciones obligatorias de varios productos sin default yconsultas intercaladas,ráfagas,STT con audios originales cuando disponibles. No cobrar ni confirmar pedidos reales desde las suites.


### Tanda: opciones obligatorias y continuidad de pedidos mixtos

52regresiones nuevas cubren consultas intercaladas,2bebidas con cantidades independientes,cambio de cantidad ycancelación de una bebida cuando es la única selección pendiente. Baseline detectó4fallos de respuesta de opciones y8de cambio/cancelación;60focalizadas finales aprobadas con controles previos. Full yTypeScript pendientes de cierre:ver relevo. Sin consumoAPI,sinpromociónMain.

Próximo hueco:cancelación de un solo producto entre varias selecciones sin perder las demás;preguntas por sabores de otro producto y notas de cada bebida. Usar catálogos diversos yverificar respuestas además del carrito.


Cierre validado de opciones obligatorias:66suites/3421pruebas yTypeScript aprobados,snapshot íntegro.52casos nuevos yregresiones anteriores acreditadas con servicios externos simulados. Se conservan elecciones/cantidades yse responde catálogo sin inferencia para consultas genéricas de opciones. Pendiente deploy;piloto aún requiere validación focal del modelo/canal real, no inferir preparación comercial solo del conteo de tests.


Staging55c5fd52 desplegado/verificado13/10/2026 19:13Bogotá,healthy eimagenactiva=candidata. Mainintacta,modelo sin cambios,noAPIpagada. Próxima tanda:cancelación selectiva con varias opciones abiertas,notas por bebida yconsulta de otro producto durante elección.


### Producción promovida y siguiente familia de puntos

Main49194fecdesplegada13/10/2026 19:29Bogotá:66suites/3421pruebas,TypeScript ycompilación aprobados;HTTPhealthOK ydosmódulosWhatsAppcoincidentesbyteporbyte. PreservadoscambiospropiosMain ycomposeadaptado. Stagingpermanentecontinúa,incluyeMainporfastforward. Las nuevascorreccionesno sepromueven automáticamente.

Tanda actual80casosnuevos:20colas/notas/cancelación selectiva,58compra+premio/consultas/códigos ycolisionesdenombres.103focalizadas aprobadas. Full/TypeScriptpendientesde cierre,verrelevo. Rutasdepuntosdebenpriorizarintenciónconcretaypreservarpedido;consultasnogastan,pedirpremiono autorizaredimirautomáticamente,beneficioesunaunidadelegiblenoelpedidoentero. Mantener ayudaextensasoloalpedirguía.

Próxima familia crítica:producto+códigoyproducto+generarpremioenmismomensaje,contexto trasgenerarcode,pago/dirección/cantidad trasaplicarbeneficio,políticasparametrizadasportenant. No declararlovendibleporcantidaddepruebas conmodelos simulados.


## Huecos adicionales para la siguiente tanda (no acreditados todavía)

Priorizar cambios de intención, no solo frases distintas de un mismo pedido. Cada caso debe comprobar respuesta, carrito, estado pendiente y ausencia de mutaciones externas. Ejecutar con dos catálogos ficticios y agente simulado activo/inactivo.

1. Respuesta tardía: preguntar sabor, cambiar a consulta de precio y luego responder «2»; no usar una numeración vieja ni añadir otro producto. Si hay dos listas posibles, aclarar a cuál se refiere.
2. Autocorrección en el mismo mensaje: «dos hamburguesas, no, mejor tres; una sin queso»; cantidad final tres, nota solo sobre una unidad.
3. Corrección negativa: «no dije dos combos, dije dos tacos»; sustituir el objeto señalado sin sumar otro combo ni borrar productos ajenos.
4. Números con funciones distintas: «combo de tres tacos, dos unidades, casa 3, pago con 50 mil»; cantidad dos combos, dirección y efectivo separados.
5. Referencia ambigua: dos hamburguesas diferentes y «esa sin cebolla»; preguntar cuál, no escoger por azar.
6. Consulta frente a compra: «si cambio la bebida cuánto vale»; no efectuar el cambio hasta que exista intención explícita.
7. Pedido más código o canje: «agrega medio pollo y aplica este premio…»; conservar compra, validar código una vez, no canjear por una consulta.
8. Retransmisión del mismo evento y dos mensajes iguales con IDs diferentes: primer caso no duplica; segundo no debe eliminar un pedido legítimo por coincidencia de texto.
9. Carrito corregido desde una imagen y luego por texto: «de la foto solo el segundo y dos del tercero»; no volver a añadir todos los productos reconocidos.
10. Nota con negación: «sin picante; el ají aparte»; conservar ambos requisitos sin convertir ají en plato.
11. Cambio de destino: «mejor recojo» mientras se pide dirección; quitar domicilio pendiente y conservar comida y pago elegido.
12. Catálogo cambiante: producto u opción retirados entre pregunta y respuesta; avisar con claridad, no aceptar opción inexistente ni perder el resto del pedido.

Estos son objetivos de pruebas pendientes, no afirmaciones de fallos ni de cobertura. Revisar las suites existentes antes de duplicar casos. Audio requiere además evaluación separada de transcripción e interpretación; sin originales no se acredita calidad acústica con fixtures de texto.


### Cierre global y protección de selección de foto

Regresión corregida acumulada:66suites/3738pruebas aprobadas,415.197s (/tmp/ppp-loyalty-fixed-full.log),snapshot íntegro /tmp/ppp-loyalty-fixed-source.json. Incluye tandas acumuladas de otros cambios conservados, no solo las78pruebas de puntos/colas. Antes deldeploy se detectó porlectura que tryApplyPhotoSubset vaciaba carrito yborraba productos ajenos a lafoto.8regresiones nuevas con cartas ficticias depizza yramen,agente simulado activo/inactivo:preservar producto externo conqty2ynota;doslíneasdel mismoSKUconnotasdistintas pidenaclaraciónsinmutar. Baseline8fallaron /tmp/ppp-photo-isolation-baseline.log. Corrección conserva líneasconIDsfuera dela lista dela foto;pide aclaración paraSKUconvariaslíneas. No acredita identificación deunidadesdel mismoSKUfusionadasantes/después deimagen ni preservación de notas/opciones deuna solalínea reconstruida:próxima tanda,requiere procedencia deimagen.

92focalizadas aprobadas /tmp/ppp-photo-isolation-targets.log,TypeScript aprobado /tmp/ppp-photo-isolation-tsc.log. Global final /tmp/ppp-photo-isolation-full.log,snapshot /tmp/ppp-photo-isolation-source.json;noeditarfuentesdurantefull.8regresionespropiasadicionales,ceroAPIen esta revisión,presupuestoefectivo36/40y4restantes. Main49194fec intacta;no nueva promoción aproducción.


## Estado aprobado para publicar en staging

La regresión final aprobó las 66 suites y 3.746 pruebas en 418,812 segundos (`/tmp/ppp-photo-isolation-full.log`). TypeScript aprobado (`/tmp/ppp-photo-isolation-tsc.log`). La comparación de todas las fuentes contra `/tmp/ppp-photo-isolation-source.json` no encontró diferencias. El conjunto acumula 325 pruebas adicionales respecto de Main49194fec; incluye trabajo previo conservado, no todas son de esta revisión.

El último fallo reproducido fue la eliminación de productos ajenos al seleccionar parte de una foto: ocho casos fallaron antes de la corrección y ahora pasan. Se conservan productos fuera de la foto y se pide aclaración cuando un SKU tiene varias líneas. No se acredita procedencia de cantidades fusionadas del mismo SKU ni conservación de todas las notas/opciones al reconstruir una única línea de la foto; esos casos quedan para la siguiente tanda.

Publicación y despliegue pendientes de verificar. Trabajar sobre staging, conservar Main49194fec y la rama staging. Presupuesto efectivo: 36 solicitudes usadas de 40; quedan 4. Esta revisión no hizo llamadas pagadas ni creó órdenes externas. Próxima tanda: notas/opciones por unidad en correcciones de foto, respuestas claras después de una mutación y referencias con contexto anterior.


## Despliegue verificado — 13 de octubre de 2026, 23:45 Bogotá

Código `bfab2af6` publicado y desplegado en staging. Contenedor `ppp-staging-api-1`: running/healthy; imagen activa y candidata coinciden: `sha256:96bea3a7e910b4812cc9ab22d38917a6cf45754699c1ed7485a642d9cd3adcfa`. HTTP local3301/api/health: statusok,DBconnected,circuitCLOSED. Evidencia: `/tmp/ppp-photo-isolation-deploy.log` y `/tmp/ppp-photo-isolation-verified.log`. La primera comprobación tenía healthstarting; la segunda healthy. Se conservó bin/ privado y mariadb_local. Producción continúa en Main `49194fec`, comprobada por SSH; no recibió esta tanda.

Validación final:66suites/3746pruebas,TypeScript aprobado yfuente sin cambios durantefull. No nuevas llamadas pagadas en esta revisión. Registro acumulado:36/40usadas,4restantes. Modelos ycredenciales sin cambios. La rama staging se conserva como integración permanente.

Siguiente paso recomendado: reproducir notas/opciones perdidas al ajustar una foto; conservar productos del mismoSKU que se pidieron antes o después de la imagen mediante procedencia explícita; verificar respuestas que hoy dicen «pedido sigue igual» tras una mutación; diferenciar precio unitario frente a importe de línea al pedir «el más caro». No dar por vendible el producto por el número de tests. Antes del piloto aún hace falta validar una muestra con inferencia real y audios originales, separando transcripción de interpretación.

## Plan concreto para habilitar el piloto

1. **Cerrar pérdida de contexto en correcciones.** Primera tanda: selección parcial de foto conserva notas, atributos, cantidades y productos ajenos; mismo SKU antes/después de foto pide aclaración cuando no hay procedencia segura. Aprobación: ningún cambio silencioso de opción ni borrado de comida ajena. Después: autocorrecciones con notas por unidad y referencias a preguntas anteriores.
2. **Revisar claridad y continuidad.** Consultar precio, ingredientes o cobertura durante nombre/dirección/pago/sabor debe responder la consulta y retomar el paso pendiente. El mensaje debe describir la mutación realizada y no afirmar que todo sigue igual. Aprobación: respuesta y estado comprobados, sin capturar consultas como datos personales.
3. **Probar conversaciones completas sin ajustar el código a cada frase.** Preparar un conjunto reservado con pedidos simples, largos, ráfagas, cambios y desistimientos en al menos tres cartas ficticias. No usar esos casos para desarrollar antes de medirlos. Aprobación: cero duplicaciones, pérdidas de productos, precios inventados o confirmaciones falsas; cualquier fallo crítico reabre su familia.
4. **Validar inferencia y medios.** Usar como máximo las cuatro solicitudes pagadas restantes, registrando cada intento y sin reintentos automáticos. Una muestra pequeña no acredita todo el sistema. Audio: obtener originales o preparar grabaciones controladas; medir por separado transcripción y pedido resultante. Imagen: incluir varias unidades, carta completa y fotos ilegibles. Aprobación: incertidumbre explícita, sin inventar productos ni perder cantidades.
5. **Piloto asistido y acotado.** Una sola operación, efectivo/transferencia, supervisión humana y canal de ayuda disponible. Registrar cada error de interpretación con carrito antes/después; corregir familias y repetir el conjunto reservado. Entrar cuando los pasos anteriores estén aprobados y no queden fallos críticos conocidos. La calidad del reconocimiento de voz sigue pendiente de audios originales.
6. **Venta y Kamppo.** Después del piloto: medir pedidos completados, abandonos, intervención humana y coste por conversación. Parametrizar programa de puntos y políticas por tenant; verificar aislamiento de catálogos y sesiones. No ofrecer soporte multitenant acreditado solo por probar menús ficticios.

Cada tanda requiere suites afectadas, TypeScript y regresión completa cuando cambia el router compartido. Publicar staging únicamente tras aprobación y verificar runtime. Main requiere nueva solicitud de promoción. No hay fecha ni porcentaje de preparación defendible hasta cerrar los bloqueos indicados.


Cierre de la primera tanda del plan: 66 suites y 3.752 pruebas aprobadas en 408,98 segundos (`/tmp/ppp-photo-attributes-final-full.log`); TypeScript aprobado (`/tmp/ppp-photo-attributes-approved-tsc.log`); todas las fuentes coinciden con snapshot final. Seis regresiones nuevas y 34 comprobaciones focalizadas. La selección ordinal de foto conserva cantidad, nota, atributos, dirección y pago; cantidades explícitas se aplican; opciones retiradas piden aclaración sin mutar. Publicación y deploy aún pendientes de verificación. Main sigue intacta. Cero llamadas pagadas en esta tanda; 36 usadas de 40, 4 restantes. Próximo bloqueo: procedencia de cantidades fusionadas del mismo SKU antes/después de una foto.


## Staging verificado — 14 de octubre de 2026, 00:03 Bogotá

Runtime `c125cd1e` desplegado y verificado. API running/healthy; imagen activa=candidata `sha256:040c74517c886aad16bfe1d95dfcb9b499c1798d8a58bfbe1fbc6a69ce34aae8`; healthok/DBconnected/circuitCLOSED. Evidencia `/tmp/ppp-photo-attributes-deploy.log` y `/tmp/ppp-photo-attributes-verified.log`. Primera consulta starting,segunda healthy. Producción verificada sigue Main49194fec. Rama staging conservada,modelos sin cambios,ninguna llamada pagada esta tanda.

Estado del plan: primer paso parcialmente completado (foto conserva nota/opción/cantidad y no captura dirección); falta procedencia para unidades del mismoSKU fusionadas antes/después deimagen. Siguiente tanda empieza por ese caso, con producto ajeno y nota diferente, antes de mejorar textos de mutación. No abrir piloto por conteo: deben pasar evaluación reservada y muestra real de medios; después piloto acotado y supervisado. Regresión final66suites/3752pruebas+TypeScript aprobados.


Cierre de procedencia de fotos: 66 suites y 3.780 pruebas aprobadas en 403,636 segundos (`/tmp/ppp-photo-provenance-full.log`); TypeScript aprobado (`/tmp/ppp-photo-provenance-final-tsc.log`); snapshot íntegro.28regresiones nuevas,102focalizadas. Se guardan carrito previo y firma de líneas de la foto; la corrección pide aclaración ante unidades previas o cambios posteriores del mismo producto; productos ajenos se conservan; foto nueva ilegible limpia referencia antigua. Esto no acredita división automática de cantidades fusionadas: la protección pide aclaración.

Próxima tanda crítica: compras con «Agrega un [producto]» capturadas como dirección en el recorrido posterior a imagen; reproducir también «añade»,«ponme»,estados building_cart/awaiting_address/awaiting_payment y diversas cartas. No declarar piloto aprobado mientras ese caso siga pendiente. Kamppo revisado solo por lectura; adaptación documentada en docs/kamppo-engine-readiness.md, sin modificación ni despliegue allí. Cero llamadas pagadas esta tanda,36/40usadas4restantes. Publicar/desplegar staging tras este pase; Main49194fec intacta.


Staging verificado14/10/2026 00:25Bogotá:runtime430e1ea0,running/healthy,imagenactiva=candidata sha256:affc186d30b907cc8425b2ccf14dd5581f0ccd340e57c0eca40f0ab462f26e61;healthok,DBconnected,circuitCLOSED. Evidencia /tmp/ppp-photo-provenance-deploy.log y /tmp/ppp-photo-provenance-verified.log. Main49194fec comprobada sin cambios.28regresiones nuevas;full66suites/3780pruebas yTypeScript aprobados;noAPIpagada. Pendiente siguiente tanda «Agrega un producto» capturado como dirección;no migración Kamppo todavía.


## Comandos de adición y dirección pendiente — 14/10/2026

84regresiones nuevas:72compras con agrega/añade/ponme,otro,cantidad2,en building_cart/awaiting_address/awaiting_payment;4bebidas con sabor pendiente y regreso a dirección;8consultas de precio de una posible adición,sin mutación. Cartas ficticias pizza/bowl/bebidas,agente simulado activo/inactivo;carrito previo conqty2ynota,dirección yórdenes externos preservados. Baseline48casos:28fallaron20pasaron /tmp/ppp-add-command-baseline.log. Normalización de comando respaldado por producto del catálogo a intención «Quiero» antes de captura checkout,sin nombres/IDs PPP. Primer parcial16fallos eran compras bloqueadas porawaiting_address /tmp/ppp-add-command-fixed.log;se guarda pendingCheckoutResume para completar compra/opciones yretomar dirección. Adición durante dirección debe pasar router normal ycontroles de catálogo,no tratarse como campo de dirección.

84focalizadas aprobadas /tmp/ppp-add-command-final-targets.log,TypeScriptaprobado /tmp/ppp-add-command-tsc.log. Global /tmp/ppp-add-command-full.log;snapshot /tmp/ppp-add-command-source.json.No editar fuentesdurantefull. Nuevos cambios todavía locales;runtime staging430e1ea0,Main49194fec intacta. CeroAPIpagada,36/40usadas4restantes. Limitación:la nueva normalización exige producto reconocido,verbo/contador alinicio ysininterrogación;no acredita comandos conproducto desconocido,correcciones deatributos,compra+consulta o dirección+compra enmismomensaje. Próxima tanda:esas fronteras ycomandos deagrupación/consulta sin pérdidas decontexto.


Adiciones aprobadas:66suites/3864pruebas,694.984s (/tmp/ppp-add-command-full.log),TypeScriptaprobado /tmp/ppp-add-command-tsc.log,fuente inmutable /tmp/ppp-add-command-source.json.84casos nuevos cubren compras reconocidas y consultas de precio,con notas/cantidad/dirección conservadas y retorno a dirección después de elegir sabor. Duración de suite no mide latencia del bot. CeroAPIpagada,36/40usadas4restantes. Pendiente publicación/deploydeexactocódigoaprobado;Main49194fec intacta. Siguiente:productos no reconocidos,comandos con códigos,compra+consulta ydireccion+compra,correcciones de atributos frente a compra. No declarar cobertura universal.


Staging verificado14/10/2026 00:46Bogotá:runtimef0c7c03c,running/healthy,imagenactiva=candidata sha256:ab254aedd882bfbb592f87ff4886ca5ee9847cc0fbd94b75f396f1aac6e1379e;HTTP3301/api/healthok,DBconnected,circuitCLOSED. Logs /tmp/ppp-add-command-deploy.log y /tmp/ppp-add-command-verified.log. Main49194fec comprobada sin cambios.84regresiones nuevas,66suites/3864pruebas+TypeScript aprobados. Ninguna llamada pagada. Mantener staging ycontinuar fronteras pendientes descritas arriba,con otros catálogos.


## Fronteras de adiciones: desconocidos, códigos y dirección — 14/10/2026

96regresiones nuevas en pizza/bowl y agente simulado activo/inactivo:72pedidos por código/con o sin cantidad yproductos desconocidos en3estados;12códigos inexistentes;8apartamentos/torres con número coincidente concódigo de menú;4productos+dirección sin reiterar la pregunta. Baseline48casos44fallaron4pasaron /tmp/ppp-add-boundary-baseline.log;formas cortas sincantidad22fallaron2pasaron /tmp/ppp-add-bare-code-baseline.log. Normalizar intención explícita para resolver catálogo antes de capturar campos;validar código y convertirlo al nombre del producto conservando cantidad;producto desconocido no muta carrito/dirección/estado. No consultar órdenes existentes por un # usado en una compra.

Parciales:28fallos /tmp/ppp-add-boundary-fixed.log por # tratado como orden,desconocidosqty2 ignorados ybloqueo decompra enpago.4fallos deapartamento/torre eran referencia interpretada como consulta deorden (Meta/órdenes simuladas);se conserva referencia de dirección,se comprueba texto ycarrito.4fallos producto+dirección perdían el producto:se reconoce compra por catálogo antes del earlyaddress-only yno se guarda resumeAddress cuando la dirección ya vino enmismo mensaje.237focalizadas aprobadas /tmp/ppp-add-boundary-final-approved.log;20controles de códigos/referencias reforzados aprobados /tmp/ppp-add-address-reference-approved.log. TypeScriptaprobado /tmp/ppp-add-boundary-final-tsc.log.

Full /tmp/ppp-add-boundary-full.log;snapshot /tmp/ppp-add-boundary-source.json. No editar fuentes durantefull. Cambios aún locales;stagingruntimef0c7c03c,Main49194fec intacta,ceroAPIpagada.36/40usadas4restantes. Limitaciones pendientes:varios códigos en unmensaje,pedido+consulta explícitos mezclados,adiciones con atributos/negaciones,nombres de productos quecoinciden con palabras de domicilio,referencias de dirección múltiples yvarios destinos. No atribuir cobertura completa por96casos.


Fronteras de adición aprobadas:66suites/3960pruebas,689.98s (/tmp/ppp-add-boundary-full.log);TypeScriptaprobado /tmp/ppp-add-boundary-final-tsc.log;fuente íntegra /tmp/ppp-add-boundary-source.json.96casos nuevos,237focalizadas y20controles reforzados. No llamadas pagadas esta tanda. Pendiente publicación ydeploy de código validado. Main49194fec intacta;presupuesto36/40usadas4restantes. Siguiente:varios códigos,compra+consulta,negación/cambio deatributo frente a compra,productos conpalabras dedomicilio yvarios destinos.


Staging verificado14/10/2026 01:16Bogotá:runtimea57ce9f1,running/healthy,imagenactiva=candidata sha256:e15b2bf712c652c09cab91a2618c90e7a994c63cef13b3f1d2cde3227bff7e69;HTTP3301/api/healthok,DBconnected,circuitCLOSED. Evidencia /tmp/ppp-add-boundary-deploy.log y /tmp/ppp-add-boundary-verified.log. Main49194fec comprobada sin cambios.96regresiones nuevas,66suites/3960pruebas yTypeScript aprobados. CeroAPIpagada. Siguiente tanda:varios códigos,pedido+consulta simultáneos,negaciones/atributos ypalabras dedomicilio ennombres deproducto;conservar número/referencias correctas sin más destinos implícitos.


## Pedidos con varios códigos, consulta y negación — 14/10/2026

48regresiones nuevas:24compras con2códigos,cantidades2/3odefault1,en building_cart/awaiting_address/awaiting_payment;4con dirección yplaca#18-27;8compra explícita+consulta delpreciounitario;8negación deSalsaPicante→Suave oconsulta hipotética sinmutar;4dosplatos compartiendoSalsa preguntan cuál yselección1cambia soloesa línea,sinconfundirla conpago. Pizza/bowl,agente simuladoactivo/inactivo;proveedores externos simulados. Baseline40casos36fallaron4pasaron /tmp/ppp-mixed-intents-baseline.log.

Se reemplazan todosloscódigos validados por nombres delcatálogo dentro delpedido,conservando cantidades ydejando intacta dirección. Enawaiting_payment,compra explícita múltiple pasa por manejador multi antesdeadición individual. Compra explícita anterior a «;¿cuánto vale cadauno?»seprocesa ysecontesta concarrito/precios reales;pregunta solanoautoriza compra. Negación conalternativa «no con X,mejor conY»usaopciónaceptada,nota/cantidadconservadas;si hayvariaslíneas seaclara. Foco positivo preciso:preguntas hipotéticas usanguardas deconsulta;no acreditar cualquierforma de negación ointerrogación.

Primer scriptdeedición rechazó parcheantesdeescribir,no aprobación;parcial de ejecución tras correcciones tenía8fallos porqueawaiting_paymentagregabasoloprimerproducto /tmp/ppp-mixed-intents-fixed.log,resuelto conruta multi existente.285focalizadas aprobadas /tmp/ppp-mixed-intents-final-targets.log;TypeScriptaprobado /tmp/ppp-mixed-intents-final-tsc.log. Global /tmp/ppp-mixed-intents-full.log;snapshot /tmp/ppp-mixed-intents-source.json.Noeditarfuentesdurantefull. Cambios locales,stagingruntimea57ce9f1,Main49194fec intacta,ceroAPIpagada,36/40usadas4restantes.

Siguiente:mezcla decódigo válido+desconocido (guard actualrechazatodoadición);consulta adicional conproductos aúnpendientes;negación sin alternativa positiva ocon«sin»;correcciones despuésdepremio;productos connombres dedomicilio;retomas/variantes de cortesía/typos. No declarar piloto por conteo: faltan evaluación reservada,inferencia ymedios representativos.


Tanda mixta aprobada:66suites/4008pruebas,700.365s (/tmp/ppp-mixed-intents-full.log);TypeScriptaprobado /tmp/ppp-mixed-intents-final-tsc.log;fuente íntegra /tmp/ppp-mixed-intents-source.json.48regresiones nuevas y285focalizadas aprobadas. Pendiente publicación/deploy delcódigo validado. Main49194fec intacta. CeroAPIpagada,36/40usadas4restantes. Siguiente:SKUcon títulos repetidos (hipótesis pendiente),válido+desconocido,negación sin alternativa,consultas conopciones pendientes yvariantes lingüísticas.


Staging verificado14/10/2026 06:10Bogotá:runtime8d28d37e,running/healthy,imagenactiva=candidata sha256:304d787babc31a609cab5b3a278d25ef492c0196829c5a8a8b23b3ed15ca77e5;HTTP3301/api/healthok,DBconnected,circuitCLOSED. Evidencia /tmp/ppp-mixed-intents-deploy.log y /tmp/ppp-mixed-intents-verified.log. Main49194fec comprobada sin cambios.48regresiones nuevas,66suites/4008pruebas+TypeScript aprobados. CeroAPIpagada. Próxima tanda prioriza títulos repetidos con códigos/precios distintos,mezcla válido+desconocido ynegación sin alternativa clara. Mantener source snapshots ystagingpermanente,no promoverMain automáticamente.


## Continuidad de consultas: siguiente puerta de aceptación — 14/10/2026

Estado de esta tanda:32 nuevas regresiones,114 focalizadas y TypeScript aprobados; global pendiente en /tmp/ppp-dialogue-context-full.log. Sin llamadas pagadas. Main d9241abe sin cambios; staging desplegado previo f7be1f7d. Referencias compartidas para composición/rendimiento y aclaraciones que retoman teléfono; no implica consolidación de todos los handlers.

Orden siguiente de trabajo:
1. Referencias entre listas y carrito: «la segunda», «quita esa», misma numeración en elección y pago; no interpretar una lista diferente ni borrar por adivinación.
2. Varios combos: cambio de bebida/presa de uno, luego otro, con preguntas intercaladas; conservar las demás líneas y revertir solo una adición equivocada comprobable.
3. Contradicciones: «normal, pero sin…», «no esa, la otra», nota frente a opción pagada; no inventar precio ni regalar extras.
4. Cambio de familia y abandono: descartar foco obsoleto sin perder carrito/datos confirmados y retomar paso pendiente.
5. Evaluación independiente: conversaciones no utilizadas para ajustar código, con modelo real y audios/fotos representativos. El saldo actual de1 llamada no alcanza para validar recorridos con herramientas; no gastarla como sustituto de evaluación completa.

Piloto supervisado: no añadir/quitar/cambiar cantidades ni datos por una consulta; consultas deben contestarse y retomar el dato pendiente; precio exclusivamente desde catálogo/cotización; ambigüedad pide aclaración; ningún fallo crítico conocido sin contención humana. Los conteos de Jest acreditan regresiones concretas, no comprensión universal ni aislamiento multitenant de Kamppo.


Cierre local de referencias:67 suites/5265 pruebas aprobadas en774.521s (/tmp/ppp-dialogue-context-full.log), fuente íntegra contra /tmp/ppp-dialogue-context-source.json.32 nuevas regresiones,114 focalizadas y TypeScript final aprobados. Pendiente deploy staging;Main d9241abe intacta. Cero API nueva;39/40 usadas,1 restante.


Staging verificado14/10/2026 a las19:06 Bogotá:runtime2ab5d14d,running/healthy,imagen activa=candidata sha256:ea2acc973fa20f442ff0ccb4632f1f1cd75af5ce5d39fac1d02cb40f5be26d33. HTTP3301/api/health ok,DBconnected,circuitCLOSED. Evidencia /tmp/ppp-dialogue-context-deploy.log y /tmp/ppp-dialogue-context-verified-final.log. Main local/producción d9241abe intacta.67 suites/5265 pruebas,114 focalizadas,TypeScript y snapshot fuente aprobados. Cero API nueva;39/40 usadas,1 restante. No promover automáticamente a Main. Siguiente:ambigüedad entre listas y filas,correcciones en varios combos,foco obsoleto y muestra independiente de modelo/canal.


## Muestra independiente con modelo real — 14/10/2026

Primer recorrido nuevo falló aunque el modelo interpretó correctamente productos/cantidades:backend convirtió contexto de oficina en productos ausentes y no reconoció referencia abreviada de precio. Detención tras2 solicitudes;41/50 usadas,9 restantes. Corrección reproducida gratis con salida capturada y14 regresiones nuevas;39 focalizadas aprobadas,global pendiente. La primera conversación pasa a desarrollo,las otras2 todavía son reservadas. Antes del piloto:global y despliegue,retoma de inferencia acotada con casos sin ejecutar,medios originales y supervisión humana. No equiparar modelo real en harness aislado con WhatsApp real ni conteos con aceptación comercial.


Cierre local oficina:67 suites/5279 pruebas aprobadas en776.889s (/tmp/ppp-office-full.log),fuente íntegra contra /tmp/ppp-office-source.json.14 regresiones nuevas,39 focalizadas y TypeScript aprobados. Antes de desplegar se inicia reensayo con modelo real:primero caso de desarrollo corregido,luego2 holdouts no ejecutados;máximo8 solicitudes/una repetición/stop-on-failure,saldo9. No darlo por aprobado antes de informe. Main d9241abe intacta.


Reensayo real posterior a oficina:/tmp/ppp-independent-1410-retest-report.json,6solicitudes adicionales (53793 promptTokens/38784cached/242completion),47/50 usadas,3restantes. Caso oficina de desarrollo aprobado,holdout wrap aprobado,holdout disculpa+nueva compra falló por replay de pendiente sin llamar modelo en segundo turno. Ningún errorHTTP/transporte. No contar2/3 como aceptación independiente:1/2holdouts aprobado. Los casos ejecutados ya no son holdouts futuros. Pedido con dirección emitió ¿algo más? antes del checkout en harness sin retención de salida;no acredita UI real.

Se añaden12regresiones de destinatario equivocado y nueva compra:sopa/pasta,agente activo/inactivo,2formas,2positivos y2negativos de clasificador. Baseline10fallaron/2pasaron /tmp/ppp-wrong-recipient-baseline.log. Clasificador reconoce disculpa+«era (para) otro negocio/tienda…»;la entrada original se conserva para reconocimiento porque glosario quita «disculpa».4variantes con disculpa fallaron tras primer fix hasta preservar fuente;76 focalizadas finales aprobadas /tmp/ppp-office-recovery-focused-final.log.26casos nuevos totales esta tanda. Global final /tmp/ppp-office-recovery-full.log;snapshot /tmp/ppp-office-recovery-source.json;TypeScript final /tmp/ppp-office-recovery-tsc-final.log. Fuente congelada;Main sin cambios;no desplegado.


Reensayo real recuperación aprobado:1recorrido/3 solicitudes (/tmp/ppp-independent-1410-recovery-live-report.json),26453promptTokens/25856cached/77completion,sin erroresHTTP/transporte. No órdenes externas. Presupuesto agotado:50/50 usadas/0restantes;esta tanda usó11 solicitudes (10 de extensión+1 pendiente previa). No nuevas inferencias hasta nueva autorización. Oficina y recuperación corregidas fueron reensayadas con modelo real;wrap pasó como muestra independiente. No prueba de comprensión universal ni WhatsApp/media reales. Fuente de global final permanece congelada.


Cierre local final oficina/recuperación:67 suites/5291 pruebas aprobadas en929.017s (/tmp/ppp-office-recovery-full.log),snapshot fuente íntegro.26regresiones nuevas respecto a5265,76focalizadas y TypeScript final aprobados. Oficina y recuperación reensayadas con modelo real después de corregir;wrap aprobado en primera evaluación.11solicitudes en esta tanda (10nuevas+1saldo previo);50/50 usadas,0restantes. Pendiente deploy staging;Main d9241abe intacta.


Staging verificado14/10/2026 a las19:59 Bogotá:runtime350c4d2b,running/healthy,imagen activa=candidata sha256:e8f462ea9bd145db22c6bbc3622a1018a04dbad12f659381194a2ee3e6c5255f. HTTP3301/api/health ok,DBconnected,circuitCLOSED. Evidencia /tmp/ppp-office-recovery-deploy.log y /tmp/ppp-office-recovery-verified-final.log. Main local/producción d9241abe intacta.67 suites/5291 pruebas,26regresiones nuevas,76focalizadas y TypeScript/snapshot aprobados.11solicitudes pagadas esta tanda (10extensión+1saldo anterior),50/50 utilizadas,0restantes. Reensayos corregidos oficina y recuperación aprobados;wrap pasó como1muestra independiente. No nuevas llamadas sin autorización. Siguiente:cierre «eso es todo» en pedido narrativo,referencias entre listas/carrito,varias líneas/combos,medios originales y más muestra independiente. No certificar listo para venta por esta tanda;no promover Main automáticamente.


Staging verificado14/10/2026 a las22:34 Bogotá:runtime d1c7d8fc,running/healthy,imagen activa=candidata sha256:667de89f18c7ce63f0573a6284ac2b0fad2b11433051cd8b11c9373702f150e0. HTTP3301/api/health ok,DBconnected,circuitCLOSED. Evidencia /tmp/ppp-kitchen-local-deploy.log y /tmp/ppp-kitchen-local-verified-final.log. Main/producción d9241abe intacta.67 suites/5353 pruebas,62casos nuevos incluidas modificaciones locales preexistentes,88focalizadas y TypeScript/snapshot aprobados. Cero API nueva,50/50 usadas/0restantes. Prioridad explícita del usuario:consolidar interpretación/validación/aplicación y medir conversaciones nuevas;no continuar solo agregando frases. La consolidación NO está implementada por esta tanda. Consultar WHATSAPP-LOCAL-NEXT-AGENT.md actualizado.

## Ajuste siguiente: ubicación comprensible y alcance por unidades — 17/10

En curso, sin prometer despliegue: la tanda de edición parcial y porciones suma76 pruebas nuevas,745focalizadas aprobadas,TypeScript y72contratos Node. Global aprobada:78suites/8220tests,356 hashes idénticos a `/tmp/ppp-options-portions-source-1710.json`; resultado vigente en `whatsapp-partial-options-portions-validation-1710.json`. La tanda de autorización b062d801 está incluida en el despliegue agrupado a3b462a3,verificado17/10 a21:00 Bogotá.

La petición nueva de mapa requiere separar **destino exacto** de **etiqueta visible**. Los pines ya suministran lat/lng para ruta; actualmente esa rama omite geocodificación inversa y construye la dirección con coordenadas y enlace. Probar después: pin con nombre/dirección, pin sin nombre, enlace Google con coordenadas codificadas, respuesta inversa cercana/ambigua, timeout y ausencia de clave, destino fuera de cobertura, coordenadas inválidas y repetición en checkout. La etiqueta de fallback puede ser «Ubicación compartida»; conservar coordenadas para ruta/payload, no convertir una dirección aproximada en número de casa confirmado. No introducir una llamada al modelo para esto. Medir costo/latencia de mapas antes de añadir geocodificación inversa repetida; aprovechar etiqueta del pin y caché. La presentación sin coordenadas ya está implementada y desplegada en f61cecff;no se añadió geocodificación inversa.

La corrección parcial actual es una gramática de edición acotada antes de la ruta por línea. Para ampliar a cualquier redacción generada por el modelo, el contrato de acciones debe expresar cantidad afectada y selección de línea, con validación central y conservación de las unidades restantes. `updateAttributes` hoy no expresa ese alcance. No atribuirle al contrato general esa capacidad por los76 casos nuevos. Próximo diseño: resolver todas las acciones contra una misma instantánea, validar cantidad/atributos/propietario, preparar particiones sin mutar y aplicar de manera atómica; comprobar respuesta y payload final. El presupuesto real y las conversaciones reservadas siguen siendo puertas aparte.
