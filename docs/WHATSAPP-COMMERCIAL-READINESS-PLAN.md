# Plan vigente de piloto y venta — 17 de octubre de 2026, Bogotá

Esta sección es la referencia actual. Las entradas inferiores son historial y sus modelos, presupuestos, SHAs y conteos no describen necesariamente el runtime vigente. El relevo técnico es `WHATSAPP-LOCAL-NEXT-AGENT.md` y cada tanda tiene un informe JSON. No existe aún evidencia suficiente para declarar venta autónoma ni una fecha de lanzamiento defendible.

## 1. Dónde estamos y qué demuestra la evidencia

- Integración permanente: `staging`. Candidato publicado y desplegado `a9693ea1`, con notas parciales, solicitudes de carta y consultas de confirmación/ETA.77 suites/8046 tests, TypeScript y72 contratos Node aprobados con354 hashes intactos. Son pruebas con servicios externos/modelo simulados, no8046 conversaciones reales independientes.
- Último código desplegado y verificado: `a9693ea1`, staging healthy el17/10 a20:07 Bogotá. Imagen activa=candidate y guards/modelos verificados; informe `whatsapp-basic-greeting-confirmation-validation-1710.json`. Incluye las notas parciales de `eec87f78`. Publicar Git no actualiza el contenedor.
- Main local verificada en `1a2b2e23`, sin el manejador `isPoliteMenuLinkRequest` presente en staging; esta revisión no la promueve ni verifica nuevamente el runtime de producción. No atribuir un chat de Main a la versión nueva de staging.
- La frase exacta «Hola buenas tardes tienes la carta por favor» ya tiene regresión en staging. Se amplió la familia con modales, «menú completo», saludos, consultas de aprobación y ETA hipotética frente a aprobación explícita:78casos nuevos y839focalizados verdes; consultar `whatsapp-basic-greeting-confirmation-validation-1710.json`. No acredita todas las preguntas compuestas/citas de autorización.
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

Esta entrega cerró78casos y su deploy agrupado. La próxima debe ampliar preguntas compuestas/citas sobre autorización, luego edición+compra nueva y notas contradictorias. Después viene muestra independiente y piloto supervisado. Si una puerta sigue abierta, indicar exactamente la evidencia faltante en lugar de inventar un porcentaje o fecha.

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

Tanda actual78casosnuevos:20colas/notas/cancelación selectiva,58compra+premio/consultas/códigos ycolisionesdenombres.103focalizadas aprobadas. Full/TypeScriptpendientesde cierre,verrelevo. Rutasdepuntosdebenpriorizarintenciónconcretaypreservarpedido;consultasnogastan,pedirpremiono autorizaredimirautomáticamente,beneficioesunaunidadelegiblenoelpedidoentero. Mantener ayudaextensasoloalpedirguía.

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
