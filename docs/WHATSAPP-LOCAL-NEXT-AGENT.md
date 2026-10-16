## Condiciones de costo — 16/10

60 pruebas nuevas gratuitas:56 combinaciones en bowls/raviolis,compra/pago,agente simulado habilitado/deshabilitado y7formas de condición;4recorridos autorizan después un cambio explícito. Baseline inicial:32fallidas/4aprobadas;fallaba la respuesta (precio base,producto inexistente o pago repetido),sin mutación de carrito observada. No confundir con la tanda anterior que sí detectó cambios de atributos. Ahora se conserva el pedido ante costo desconocido y se retoma el dato pendiente. No se promete gratuidad por existir una opción.

134focalizadas aprobadas (60nuevas+74controles),TypeScript y global:57suites/5865tests WhatsApp en910.845s +19/98 complementarias en12.108s =76/5963 en ejecuciones disjuntas con fuente congelada y comprobada contra /tmp/ppp-conditional-cost-source.json. Evidencia docs/whatsapp-conditional-cost-validation-1610.json;logs /tmp/ppp-conditional-cost-{baseline,targets,full,complement,tsc}.log. Cero API/Meta/mapas/órdenes externas;presupuesto183/178/5 intacto. Pendiente desplegar este lote;Main intacta.

Siguiente bloque:consulta y edición independientes en un mensaje («¿cuánto vale el domicilio? Y quita una sopa»),luego alcance de condiciones con varias acciones («si es gratis cambia la bebida;aparte quita una sopa»). Oráculos:responder la consulta,aplicar solo edición autorizada,conservar cantidades/opciones ajenas y paso pendiente. Esta tanda no acredita resolución por cláusulas ni comprensión universal;no repetir inferencia de falafel/pizza ya medida. Piloto aún requiere recorridos completos con modelo/canal real y medición de costo;estos son mocks de router.

## Consultas de cambios y recargos — 16/10

40 regresiones nuevas en dos cartas ficticias y cinco pasos de checkout;74 focalizadas aprobadas. «¿Puedo cambiar X por Y?» llegaba a mutar atributos: se resuelve ahora antes de las ediciones. Consultas conservan sesión y retoman nombre/teléfono/dirección/pago/confirmación. No se inventa recargo ni gratuidad. Global:57 suites/5805 pruebas WhatsApp +19/98 complementarias =76/5903 en ejecuciones disjuntas con fuente congelada;TypeScript aprobado. Cero API nueva;183/178/5 intacto. Evidencia:whatsapp-swap-inquiries-validation-1610.json. Desplegado código00a8dfea:running/healthy,healthOK,DBconnected,circuitCLOSED verificado2026-10-16T05:57:05.114Z. Imagenactiva=candidate sha256:6e17051913b8bc70ef577990a7725b8581ec6d07b3c24fb194ca99d42a0a14a8;modelosSol6.1/Luna/Luna/GPTTranscribe intactos. Main intacta. Siguiente:mensajes mixtos de consulta+acción,condicionales y autorizaciones con límites;no asumir permiso de sustitución por existir una opción.

## Desplegado — referencias cortas, 16/10 00:42 Bogotá

Código44b28dea en staging;running/healthy verificado2026-10-16T05:42:23.689Z. Imagen activa=candidate sha256:6c374af03033833e04b5b51dd1a8033416449210d262dabde154bbe506f1df63;healthOK,DBconnected,circuitCLOSED. Bindings shortReferences/otherAnchor compilados. Modelos efectivos iguales:Sol6.1/Luna/Luna/GPTTranscribe. Main intacta.

57suites WhatsApp/5765tests en513.161s +19complementarias/98tests en6.477s:76suites/5863tests en dos ejecuciones disjuntas con fuente intacta contra /tmp/ppp-short-references-source.json. TypeScript y62focalizadas aprobados (34nuevas+28compatibilidad). Logs /tmp/ppp-short-references-{full,complement,tsc,final-targets,deploy,deploy-verified}.log. Informe durable docs/whatsapp-short-references-validation-1610.json. CeroAPI nueva/Meta/mapas/órdenes externas;presupuesto183/178/5 intacto. No repetir global por este cierre documental.

Siguiente familia:sustituciones y recargos consultados frente a autorizados. Preguntar «se puede cambiar X por Y/cuánto cuesta» no debe mutar carrito,prometer gratuidad o inventar permisos;solo aplicar cuando catálogo/política e intención lo autorizan. Probar cartas distintas y regreso al dato pendiente;oráculos antes de inferencia. También quedan mensajes compuestos con consulta+acción simultánea. Esta tanda valida referencias descriptivas calificadas,no selección desnuda «el otro» ni todo el lenguaje. Canal/audio original y costo por tenant siguen separados;no repetir falafel/pizza ya medidos por relevo histórico.

## Cierre global aprobado — referencias cortas, 16/10

57suites WhatsApp/5765tests +19complementarias/98tests: total76suites/5863tests en dos ejecuciones disjuntas con fuente intacta. TypeScript y62focalizadas aprobados (34nuevas+28compatibilidad). CeroAPI nueva;presupuesto183/178/5 intacto. Se publica lote en staging;falta verificar despliegue. Evidencia durable whatsapp-short-references-validation-1610.json.

## Tanda actual local — referencias cortas, 16/10

Basee092e9f4,staging.34tests nuevos y28compatibilidad pasan (62focalizados),TypeScript aprobado. Baseline inicial26casos:22fallidos/4verdes;los8controles finales se añadieron antes de global. Global en curso /tmp/ppp-short-references-full.log,snapshot /tmp/ppp-short-references-source.json. No modificar fuente hasta cerrar.

Cambios generales:«y ese trae salsa» conserva el plato referido;un ingrediente vendible no roba el sujeto. «El otro trae…» solo se resuelve con foco real en carrito,sin compra pendiente,y una única alternativa disponible. Varios otros/sin ancla aclaran;no se elige el primero. La aclaración retiene la pregunta original y restaura el paso de pago;un número de esa aclaración no es selección de pago. Tras hablar del otro se guarda ese foco. Las compras pendientes prevalecen sobre foco anterior. Sin IDs/recetas/nombres particulares en código productivo.

CeroAPI/Meta/mapas/órdenes externas en esta tanda;presupuesto183/178/5 intacto. Modelos/Main sin cambios. Evidencia docs/whatsapp-short-references-validation-1610.json. Próximas familias:consultas de cambios/sustituciones sin precio/autorización y mensajes de varios actos simultáneos;referencia «el otro» sin predicado puede ser selección de compra y no se reinterpreta aquí. No afirmar que se cubrió todo el lenguaje ni precisión semántica/alérgenos. Esperar global íntegra antes de publicar/desplegar.

## Desplegado — carta incompleta, 15/10 22:48 Bogotá

Código4fdd17d6 en staging;running/healthy verificado2026-10-16T03:48:17.907Z. Imagen activa=candidate sha256:311bbf3490b354f59ea68567a71568c4adaf6167c285c0dfc83ffc5adeea7ed5;healthOK,DBconnected,circuitCLOSED. Bindings compilados:unknownPolicy,unknownRendering,numericPresentation. Modelos efectivos sin cambios:Sol6.1/Luna/Luna/GPTTranscribe. Main intacta.

57suites WhatsApp/5731tests en522.301s +19complementarias/98tests en6.511s:76suites/5829tests en dos ejecuciones disjuntas con fuente intacta contra /tmp/ppp-incomplete-menu-source-closed.json. TypeScript y46focalizadas aprobados (42nuevas+4compatibilidad). Las dos ejecuciones globales anteriores se interrumpieron para ampliar controles y NO se suman. Logs /tmp/ppp-incomplete-menu-{full-closed,complement-closed,tsc,final-targets,deploy,deploy-verified,deploy-health}.log. Informe durable docs/whatsapp-incomplete-menu-validation-1510.json. CeroAPI pagada/Meta/mapas/órdenes externas. Presupuesto183/178/5 intacto. No repetir global por este cierre documental.

Siguiente tanda:referencias cortas a un plato con datos incompletos («¿y ese trae salsa?»),descripción explícitamente negativa frente a desconocida,opciones ofrecidas frente a ingredientes incluidos y consultas sobre cambios sin precio/autorización. Definir oráculos antes de modelo real. El nuevo prompt no tiene nueva inferencia real;las regresiones prueban router/estado/respuesta y contrato de herramientas con dependencias simuladas. Comparación léxica conservadora de detalle,no prueba semántica ni de alérgenos. No volver a gastar en falafel/pizza por relevo histórico:ya se validaron en desarrollo. Canal/audio original y costo por tenant siguen pendientes.

## Cierre aprobado — carta incompleta

57suites WhatsApp/5731tests +19suites complementarias/98tests:76suites/5829tests en dos ejecuciones disjuntas con fuente intacta. TypeScript aprobado,46focalizadas (42nuevas+4existentes). Presupuesto183/178/5 intacto,ceroAPI nueva. Fuente congelada verificada contra /tmp/ppp-incomplete-menu-source-closed.json. Logs /tmp/ppp-incomplete-menu-{full-closed,complement-closed,tsc,final-targets}.log. Se publica lote en staging;falta verificar despliegue. No declarar validado con modelo/canal real.

## Tanda actual local — carta incompleta e interrupciones, 15/10

Base05720e94,staging.42tests nuevos gratuitos y4compatibilidad pasan,TypeScript aprobado.24casos de descripción vacía (2cartas,agente on/off,6estados),2contratos de herramienta,8consultas de dato ausente de descripción parcial,4continuaciones hasta efectivo,2consultas de varios platos y2controles de presentación numérica. Baseline10fallidos/4verdes;los4ya decían «No tengo el detalle» y no eran defectos. Dos ejecuciones globales se interrumpieron para añadir consulta múltiple y presentación numérica;no contarlas como aprobadas. Global cerrada en curso /tmp/ppp-incomplete-menu-full-closed.log,snapshot /tmp/ppp-incomplete-menu-source-closed.json.

Cambios generales:se elimina instrucción que deducía ausencia por no aparecer en description;informationPolicy declara unlistedDetails=unknown y optionsAreAlternatives=true en product_info/composition. Preguntas descriptivas con nombres completos se responden antes del parser de datos de checkout,sin mutar estado/carrito. Varios productos se responden por separado;subnombres contenidos se descartan. Render de detalle ausente conserva description y aclara que no está confirmado. Es comparación léxica conservadora,no entendimiento semántico ni certificación de alérgenos. Los atributos son alternativas,no todos incluidos ni cambios gratuitos.

CeroAPI/Meta/mapas/órdenes externas en esta tanda;presupuesto183/178/5 intacto. Modelos/Main sin cambios. Evidencia durable docs/whatsapp-incomplete-menu-validation-1510.json. Esperar global íntegra antes de publicar/desplegar. Próximos:preguntas cortas referenciales con conocimiento incompleto,detalles explícitamente negativos frente a desconocidos y sustituciones/costos no autorizados;preparar muestra nueva antes de inferencia. No repetir falafel/pizza ya validados en desarrollo.

## Estado vigente — staging integrado, 15/10 22:14 Bogotá

Código03c994d7 desplegado;running/healthy verificado2026-10-16T03:14:34.463Z. Imagen activa=candidate sha256:c74e7e23c80dddfe211b7102e31bce609d41ca128086d06ebbb9872e793df8c8;healthOK,DBconnected,circuitCLOSED. Bindings de ortografía/product_info compilados y modelos efectivos sin cambios:agenteSol6.1,visión/assistLuna,audioGPTTranscribe. Main intacta. Se publicaron los11commits pendientes previos y el último lote de ortografía/combo.0525f6eb registró esa fuente ya congelada durante la validación; hashes prueban fuente idéntica durante las pruebas.03c994d7 añade informe,ledger/relevo y limpieza de EOF del spec.

Validación57suites WhatsApp/5689tests en580.499s +19complementarias/98tests en9.105s: total76suites/5787tests en dos ejecuciones disjuntas. TypeScript y22focalizadas aprobados. No repetir global por este cierre documental. Evidencia durable docs/whatsapp-latest-integration-validation-1510.json; logs /tmp/ppp-latest-integration-{full,complement,deploy,deploy-verified}.log. Source snapshot /tmp/ppp-latest-integration-source.json. Fuente productiva idéntica a la validada; solo EOF de spec limpiado después.

Próximo trabajo: corregir y probar instrucción product_info que convierte ausencia en descripción en negación (debe expresar dato no confirmado); catálogos incompletos,opciones no documentadas y preguntas intercaladas. Evitar repetir falafel/pizza por relevo viejo: ya pasaron con modelo real en desarrollo (8turnos/12calls/USD0.0893154 y6turnos/4calls/USD0.0416464). No son holdouts ni acreditan canal. Preparar otra muestra nueva solo después de pruebas gratis. Presupuesto183/178/5,espejo sincronizado;8intentos propios interrumpidos quedaron contados con costo desconocido. No más API tras freeze confirmado por usuario. Leer HEAD/status/ledger ANTES de ejecutar y usar set -e/&& en pasos dependientes. No mezclar edición simultánea con validación. Canal WhatsApp/audio original y rentabilidad por tenant siguen pendientes.

## Cierre global de integración, 15/10

57suites WhatsApp/5689tests y19suites complementarias/98tests aprobadas: total76suites/5787tests en dos ejecuciones disjuntas contra fuente intacta. TypeScript y22focalizadas aprobados. Se quitó solo una línea vacía extra al EOF del spec después del cierre; fuente productiva idéntica. Se integra lote de11commits locales más correcciones de ortografía/combo contra d95cc942. Sin nuevas llamadas pagadas tras congelar fuente con autorización del usuario. Falafel8turnos y pizza6turnos reales ya aprobados por el otro agente en desarrollo, no holdouts. No repetirlos solo porque encabezados viejos del relevo no lo mostraban.

## Integración actual: relevo desactualizado detectado, 15/10

HEAD d95cc942 avanzó11commits locales respecto a origin/staging. Otro agente completó falafel8turnos (12solicitudes,USD0.0893154,docs/whatsapp-falafel-retest-1510.json) y pizza6turnos (4solicitudes,USD0.0416464,ledger del commit d95cc942). Son retests de desarrollo, no holdouts. Los encabezados anteriores no mostraban estos resultados. El usuario confirmó que ya no se edita; se congela fuente y se valida global antes de integrar.22focalizadas y TypeScript pasaron con fuente intacta. Cambios locales nuevos:alineación ortográfica contra palabras únicas de carta,selección de combo por palabras distintivas; además de los11commits previos de descripción,hermanos,otra unidad,retiradas y notas de pago. Evidencia docs/whatsapp-latest-integration-validation-1510.json.

Incidente propio de esta continuación: esperaba presupuesto154yHEADb5891c35,pero checkout/ledger habían avanzado. La aserción falló y el shell continuó al runner; se interrumpió proceso propio con preload falafel al revisar cambios.8intentos quedaron contabilizados170→178; no se emitió reporte completo de usage,por tanto costo desconocido/no cero,0conversaciones aceptadas. No reiniciar ni restar esos intentos. Clave temporal eliminada; espejo sincronizado. Presupuesto183/178/5. No más llamadas pagadas durante esta integración. Para futuros comandos dependientes usar set -e o &&; leer HEAD/status/ledger antes de capturar modelo o clave y evitar repetir un caso ya validado por otro agente.

Global en curso contra snapshot /tmp/ppp-latest-integration-source.json; no editar fuente hasta cerrar. Revisión pendiente:hint product_info dice que lo ausente de description no lo trae; catálogo incompleto debería expresar desconocido,no una negación segura. No cambiar durante el freeze ni ocultarlo como prueba de aceptación comercial. Falta canal/audio original y costo representativo. Main intacta.

## Desplegado — checkout, 15/10 18:27 Bogotá

Código dc14fa05 en staging. Running/healthy verificado2026-10-15T23:27:33.213Z;imagen activa=candidate sha256:44dc6086afb6af33e7d61262e605c248c33f8b7343f11ea85f60d6b89326dfa4,healthOK,DBconnected,circuitCLOSED. Bindings compilados de respuesta/edición y cuatro modelos sin cambios.57suites WhatsApp/5582tests +19suites complementarias/98tests,total76/5680 en dos ejecuciones disjuntas con fuente intacta. TypeScript aprobado. Logs /tmp/ppp-checkout-tools-{full,complement,tsc,deploy,deploy-verified,deploy-health}.log. Informe durable whatsapp-checkout-tools-validation-1510.json. Main intacta. No repetir global por este cierre documental.

Siguiente: retest de desarrollo del recorrido falafel completo de8turnos con modelo real sobre esta versión; los dos intentos anteriores fallaron y se detuvieron antes de terminar. La continuación gratuita pasó seis turnos desde el carrito correcto con acciones de modelo simuladas, no es inferencia real. Para evaluar completo fijar tope suficiente antes de iniciar,hay4restantes del tope158:154usadas. Autorización humana moderada persiste, no reiniciar contador ni truncar otra vez a4. Registrar incremento operativo y espejo antes de red. El caso ya no es holdout; después elegir otra muestra nueva. Corregir también hint similar_offer de search_menu cuando recibe pregunta descriptiva completa: en este ensayo devolvió modo similar_offer aunque el modelo respondió correctamente desde description. No había fuente para atribuir esto a comprensión deficiente del modelo. Validar canal WhatsApp y audio original como puertas separadas del piloto.

## Cierre global del lote checkout — 15/10

57suites WhatsApp/5582tests más19suites complementarias/98tests: total76suites/5680tests en dos ejecuciones disjuntas,fuente intacta contra /tmp/ppp-checkout-tools-source.json. TypeScript aprobado. Se publican las cuatro correcciones juntas para staging; falta verificar contenedor tras deploy.41tests nuevos incluidos en global. Ninguna llamada real adicional tras el segundo fallo; cero conversaciones nuevas completas aceptadas en API.

## Tanda nueva local — checkout y costo, 15/10

Base ba8d1faa. Modelo Sol interpretó bien la pregunta de papas incluidas y la corrección de bebida del combo; el backend placedOrderOnly descartaba respuesta/edición y luego repetía pago o añadía bebidas sueltas. Se conservan respuestas con herramientas de consulta sin acciones y sin error; se aplican únicamente updateAttributes/updateCartLines de herramientas permitidas mediante guard y aplicador existentes, conservando estado del checkout. Rechazo o índice inválido no cae a otra compra. Para checkout el agente recibe originalText: la normalización previa quitaba «Deja solo» y convertía la corrección en compra. tryKeepOnlyNamedCartLine rechaza «queda/sigue igual» o «no cambies/toques/quites» para no borrar líneas retenidas. isCartChargeQuestion reconoce consultas ancladas «cuál es el total con domicilio/envío» sin tragarse hipótesis ni compras adicionales.

41pruebas nuevas gratuitas:8consultas/4controles/16ediciones/4edicionesinválidas/1continuación/8total. Baseline8consultas fallidas; la primera tanda16ediciones tenía8fallos reales de atributos y8aserciones incorrectas de que tenía que usar agente para cantidades. Al quitar esa aserción apareció borrado real de hummus; corregido con guard. No contar16defectos independientes. Focalizadas32aprobadas y continuación+total9aprobadas, logs /tmp/ppp-checkout-tools-final-targets.log y /tmp/ppp-falafel-free-continuation.log. Global y TypeScript en curso con snapshot /tmp/ppp-checkout-tools-source.json.

API:primer caso nuevo5HTTP200 falla consulta mostrada; retest desarrollo8HTTP200 muestra consulta bien y falla edición aplicada.13solicitudes totales,USD0.0552688estimados,0conversaciones completas aceptadas. Se detuvo cada run al primer fallo; sin más API después del segundo fallo. Todos los modelos correctos en los puntos observados; no atribuirlos a mala comprensión. La continuación de seis turnos posterior es SIMULADA gratis hasta transferencia, no modelo real. Evidencia docs/whatsapp-checkout-tools-validation-1510.json. Presupuesto158/154/4,espejo sincronizado,clave temporal eliminada. No proyectar el costo de cache caliente del retest como promedio de clientes.

Costo aclarado al usuario:USD0.0450182de la tanda anterior era el TOTAL de6solicitudes, noUSD0.045porcadauna. 1000conversaciones idénticas seríanUSD45.02soloIA; tráfico,abandono,reintentos,canal/mapas/infraestructura y plan comercial faltan para rentabilidad. Ningún modelo ni Main modificados. No desplegar hasta cerrar global íntegra.

## Desplegado y verificado — completitud de herramientas, 15/10 18:08 Bogotá

Código d120b267 en staging; running/healthy,imagen activa=candidate sha256:02b77d77d7ff1fda7eb477dae589a2a64979c71de052f5b2b567f39a74ba8e3a. Verificado2026-10-15T23:08:44.976Z:healthOK,DBconnected,circuitCLOSED,binding compilado y cuatro modelos sin cambios. Global57suites/5541tests más complemento19/98,total76/5639 en dos ejecuciones disjuntas con fuente intacta; TypeScript aprobado. Main intacta. Informe durable whatsapp-tool-completeness-validation-1510.json. Logs /tmp/ppp-completeness-{full,complement,deploy,deploy-verified,deploy-health}.log.

Próxima tanda: conversación nueva en otra carta, con opción incluida, consulta intercalada y corrección durante checkout; definir esperado antes de inferencia. El ensayo japonés fue retest de desarrollo, no holdout ni canal real. Presupuesto145/141/4; para una conversación nueva completa asignar primero tope operativo suficiente bajo autorización moderada vigente, mantener contador acumulado/espejo y stop-first-failure. Comprobar recepción real de fotos y audio original como puertas separadas del piloto. Corregir redacción de ejemplos PPP en carta ficticia cuando se trabaje el resumen. No repetir toda la global solo por este cierre documental.

## Cierre global de completitud — 15/10

57suites WhatsApp/5541tests y19suites complementarias/98tests aprobadas en dos ejecuciones disjuntas con la misma fuente intacta: total76suites/5639tests. TypeScript aprobado. La conversación real de cuatro turnos pasó con6solicitudes. Código listo para desplegar en staging; ver informe whatsapp-tool-completeness-validation-1510.json.

## Actualización 15/10: conversación completa y completitud de herramientas

Cambio local aún sin desplegar al escribir esta entrada. resolve_multi_order analiza la compra previa a una condición con conditionalPurchaseText; devuelve completeness=requires_review y menciones no contabilizadas como pistas, nunca compras automáticas. El té del caso de oficina ahora aparece en el resultado del parser; no se necesitan las búsquedas de té observadas en la captura anterior. No afirmar reducción estadística de costo/rondas: la ejecución anterior quedó incompleta.

Validación real de desarrollo: cuatro turnos completos aceptados, seis solicitudes HTTP200 a Sol/Responses, cero errores de agente/proveedor. Gyozas1 sin cebolla,ramen2,té3 sin azúcar; consulta total80000; corrección absoluta té2 conservando nota; total75000. Dos consultas de total deterministas. Respuestas y notas revisadas además de los oráculos automáticos. Tiempo inicial9701ms y corrección6246ms; solicitudes3701,2847,2770,1545,2269,2205ms. Costo estimadoUSD0.0450182 a tarifas oficiales estándar, sin Meta/mapas/infraestructura/impuestos. Una sola conversación previamente usada en desarrollo; no holdout ni validación del canal. Evidencia durable docs/whatsapp-tool-completeness-validation-1510.json. El ejemplo de ayuda de cantidades del resumen todavía menciona ajiaco/menudencias en la carta ficticia: oportunidad de redacción, no pérdida del pedido.

Tope operativo ampliado por el agente bajo autorización humana vigente:145acumuladas/141usadas/4restantes; espejo privado sincronizado antes de red y después del informe. No se reiniciaron contadores. Clave temporal eliminada tras el ensayo. Suites del agente82tests/2suites y TypeScript aprobados. Complemento19suites/98tests aprobado. Global WhatsApp en curso; no declarar desplegado hasta verificar cierre y contenedor. Main intacta.

## Avance local 15 octubre, 17:54 Bogotá: completitud de resolve_multi_order

Cambio local, todavía sin desplegar: la herramienta analiza el tramo de compra previo a una consulta condicional usando conditionalPurchaseText. Esto recupera el té omitido en el caso de oficina capturado con Sol. Devuelve completeness=requires_review y unaccountedMentions como información, nunca como autorización automática de compra; elimina la afirmación «Multi claro». Tres contratos nuevos cubren pedido simple, pedido con postre condicional y consulta de producto disponible que no debe añadirse. Suites de agente y TypeScript pasan; evidencia /tmp/ppp-completeness-agents.log y /tmp/ppp-completeness-tsc.log. No hubo llamadas pagadas. Pendiente validar suite WhatsApp global antes de integrar/desplegar; luego medir conversación completa con modelo real, con presupuesto acotado. Main y servidor sin cambios en esta tanda.

# Continuación local de PPP WhatsApp

## Desplegado: notas explícitas de foto y evaluación real acotada (15/10)

Base307ecd16. Cuatro solicitudes reales a Sol (Responses), todasHTTP200, consumieron el resto del tope135. Ensayo sintético nuevo: pack de gyozas sin cebolla,2ramen,3tés sin azúcar y condición «si no venden flan, no lo reemplacen». El modelo propuso/guardó los6ítems y notas correctamente. Hizo resolve_multi_order,2search_menu y3add_item; se agotó el límite antes de la respuesta final. Resultado INCOMPLETO,0conversaciones aceptadas; no presentarlo como éxito E2E ni defecto del proveedor. Costo parcial estimado USD0.0234683;36512input,27103cache,194output,0razonamiento reportado. Excluye Meta,mapas,infraestructura,impuestos. Fuente de precios oficial consultada15/10:https://developers.openai.com/api/docs/models/gpt-6.1-sol . No es costo de una conversación terminada.

Evidencia versionada:scripts/fixtures/whatsapp-sol-office-{menu,cases,conditional-capture}-1510.json. La continuación offline reproduce las acciones iniciales capturadas con error de tope y SIMULA una respuesta update_item en el turno de cantidad: el modelo real no ejecutó ese turno. Un primer mock repetía las acciones iniciales al volver a entrar al agente y añadía productos; se corrigió la simulación, no un bug de producción. El resto de consultas/total se resuelve sin inferencia. Presupuesto135/135/0,espejo sincronizado. La autorización humana moderada persiste, pero el tope de4de esta tanda se respetó: ninguna llamada adicional.

Hallazgo gratis real en filas anotadas de OCR: «salsa aparte»,«cubiertos aparte»,«aderezo aparte» se perdían al faltar «con». El parser ahora conserva esas notas de empaque en la cola explícita de cada fila; las etiquetas de atributos con dos puntos siguen siendo atributos, no notas. Sin IDs/nombres/precios particulares en producción. Cuatro negativos de nota perdían texto antes de corregir; el control de etiqueta no compraba ni alteraba nota. Compatibilidad78tests/3suites y11regresiones nuevas focalizadas aprobadas. Incluyen foto→precio→eliminación→cantidad→total durante pago en PPP y carta japonesa,agente simulado activo/inactivo; el carrito conserva la nota y el paso de pago.

Validación final:57suites WhatsApp/5538tests en468.21s (/tmp/ppp-office-packaging-full.log) y19suites complementarias/98tests en6.225s (/tmp/ppp-office-packaging-complement.log). Total76suites/5636tests en2ejecuciones disjuntas contra la misma fuente; snapshot /tmp/ppp-office-packaging-source.json comparado e idéntico al final. TypeScript /tmp/ppp-office-packaging-final-tsc.log aprobado. Main intacta. Desplegado en staging código1e90c7c1, verificado2026-10-15T22:47:46.222Z:running/healthy,imagen activa=candidate sha256:ff5b88658257d3b4e906e6a9cb43137abf1493077909b4bb72c84417193e8603,HTTP200/DBconnected,circuitCLOSED. Binding compilado de notas explícitas y4modelos comprobados sin cambios. Evidencia /tmp/ppp-office-packaging-deploy.log y /tmp/ppp-office-packaging-deploy-verified.log. Los logs focalizados son /tmp/ppp-office-photo-packaging-final-targets.log y /tmp/ppp-office-packaging-compat.log.

Próximo estructural: resolve_multi_order devolvió2confident y«Multi claro» aunque el texto pedía también té. Sol recuperó el té con búsquedas, pero eso añade rondas. No parchear nombres: añadir cobertura/completitud por producto explícito y ausencias estructuradas, después medir otra muestra nueva. Las4calls observadas no permiten certificar costo completo ni rendimiento de otros restaurantes.

## Desplegado: respuesta autónoma de fotos y pedidos condicionales (15/10)

Base a60f4fc6. El usuario reportó foto con6productos y silencio hasta escribir «hola». No atribuirlo al reconocimiento: su captura muestra el carrito completo al continuar. Se reprodujeron dos defectos de entrega sin inferencia: un retry con el mismo messageId incrementaba el ticket de álbum y suprimía la respuesta original; un texto pendiente movía la salida de la foto a carry. No hay trazabilidad por mensaje que pruebe cuál ocurrió en esa captura; los logs agregados de staging mostraron1carry y0errores de visión/descarga en la ventana inspeccionada, sin exportar textos/teléfonos de clientes.

Cambios: ticket transitorio reutilizado por waId+messageId durante5min, máximo4096entradas; UNIQUE persistente conserva la autoridad de dedup y no cambia. Solo otra foto real puede sustituir el resumen. Avisos de álbum en el mismo lote se suprimen antes/después de la foto, sin mezclar waId. La salida final de una foto ya procesada se libera aunque haya texto pendiente de agrupar; no requiere otra burbuja para enviar. Dos fotos de mitades distintas producen un carrito final con6productos. No es un SLA de inferencia ni evaluación de nuevos medios.

Se cerró además el pendiente previo de compra de un paquete con condición de inventario: evidencia de compra se limita al texto anterior al «si hay/tienen/venden/manejan/ofrecen». El guard permite agregar el producto pedido allí, pero NO un postre que solo se consulta después. Primer guard global demasiado amplio falló2negativos; se corrigió por ámbito de producto. Se interrumpió la primera global al detectar ese límite; no cuenta como aprobada. Contratos negativos conservados.

33regresiones nuevas:19de compra/consulta/continuidad (2menús,3estados pendientes,4turnos por conversación),12de cola pública de imágenes (foto sola, retry en lote/otro webhook/tardío, dos fotos distintas y sobre posterior en2menús),2de liberación de salida frente a texto pendiente. La frontera de Meta se simula y se comprueba sendText efectivo, cantidades y ausencia de buffers residuales. Primeros fixtures de cola tenían códigos ficticios de5dígitos fuera del contrato y opciones de preparación pendientes; se ajustaron a códigos válidos y pedidos completamente determinados para aislar la entrega, sin cambiar código del parser ni debilitar los oráculos de carrito/salida.

Focalizadas finales:56tests/5suites aprobados /tmp/ppp-photo-reply-final-targets.log, además de109controles previos de herramientas/intención. TypeScript /tmp/ppp-photo-reply-tsc.log aprobado. La primera global de este bloque se interrumpió al fallar un mock de comprobante incierto: se evitó consultar catálogo con OCR vacío, preservando recepción/verificación manual.133controles de compatibilidad aprobados /tmp/ppp-photo-reply-compat-targets.log. Validación final íntegra:57suites WhatsApp/5527tests aprobados en473.292s (/tmp/ppp-photo-reply-approved-full.log), más19suites complementarias/98tests en7.323s (/tmp/ppp-photo-reply-complement.log). Total76suites/5625tests en dos ejecuciones disjuntas; NO afirmar una sola invocación. Snapshot /tmp/ppp-photo-reply-approved-source.json comparado e idéntico al final de ambas. TypeScript final /tmp/ppp-photo-reply-approved-tsc.log aprobado. Cero llamadas pagadas,Meta,mapas,órdenes reales; presupuesto135/131/4sin cambios. Main intacta. Desplegado en staging código df0560fa, verificado 2026-10-15T22:26:33.992Z:running/healthy, imagen activa=candidate sha256:633726eda3263be9bdc2301bd47e7d6fe513eb490fcfa20d20a491a29e751225,HTTP200/DBconnected,circuitCLOSED. Bindings compilados de liberación de fotos,tickets deduplicados,avisos de álbum y ámbito condicional comprobados. Modelos sin cambios. Evidencia /tmp/ppp-photo-reply-deploy.log y /tmp/ppp-photo-reply-deploy-verified.log. Próximo: reenvío humano de la foto original sin texto posterior. Siguiente familia de entrega: retry anterior al reinicio o a la caducidad de caché, varios workers y fallo de envío de Meta; no equiparar la caché temporal con una garantía durable de entrega.

## Cambio de producto solicitado: foto de carta añade todos (15/10)

El usuario pidió explícitamente volver al comportamiento de añadir TODOS los productos reconocidos en una foto, sin preguntar cuál/cuáles. Una unidad por defecto; conservar cantidades/atributos/notas cuando visión los entrega. El texto acompañante que elige un subconjunto o solo consulta tiene prioridad; comprobantes no son pedidos. Esto reemplaza intencionalmente el contrato anterior de «varias tarjetas sin selección no compran», no un fallo que deba restaurarse.

Trabajo sobre staging, sin cambiar modelos ni Main. Actualizados prompt normal/OCR y compatibilidad con respuestas históricas unclear+OCR de varios productos, usando catálogo genérico y códigos etiquetados. Ver pruebas de foto PPP+menú ficticio y carritos/atributos existentes. Primera tanda:357tests/4suites aprobados, /tmp/ppp-photo-autoadd.log. Tras ampliar6productos/cantidades/exclusiones:163verdes+1rojo («No agregues nada»), /tmp/ppp-photo-autoadd-final.log; se amplía la negación a sus formas verbales sin tocar oráculos. Regresión final aprobada:4suites/164tests de medios,3998omitidos ajenos al filtro,en65.177s, /tmp/ppp-photo-autoadd-approved.log. TypeScript aprobado /tmp/ppp-photo-autoadd-approved-tsc.log. No es una nueva global. Desplegado en staging código c4ef9db1, verificado 2026-10-15T21:58:25Z: running, imagen activa=candidate sha256:f286fce0fbd9d5194bce8f7f7e64c7fd9d629ff3898eb31452e0a0cf51ba4272, endpoint HTTP200/DBconnected. Compilado: autoañadido de todos, extracción de cantidad marcada y prompt TODOS verificados; modelos conservados. Evidencia /tmp/ppp-photo-autoadd-deploy.log y /tmp/ppp-photo-autoadd-deploy-verified.log. Main intacta. Hay8regresiones nuevas además de adaptar los contratos anteriores al comportamiento solicitado. Cero llamadas pagadas en este bloque por ahora.

## En validación: foto de carta con varias opciones (15/10)

Reporte humano posterior al cambio de modelo: primer carrito fotografiado conserva tres productos y variantes; segunda foto de cuatro tarjetas de carta termina en «Vi tu foto… llámanos». La captura permite observar la respuesta, pero no demuestra que Luna no leyera los nombres: no tenemos aquí la imagen original aislada ni la salida cruda de ese request.

Cambio local: conservar OCR de varias opciones como reconocimiento sin compra; nombrar opciones reconocidas en catálogo y preguntar cuáles/cantidades. No repetir OCR si ya hay al menos dos opciones reconocidas. Foto ilegible o descarga fallida solicita nombre/reenvío sin ofrecer teléfono inmediatamente. Comprobantes mantienen aviso de verificación. Se elimina contradicción de prompt «código implica SIEMPRE pedido» cuando hay varias tarjetas sin selección. No se cambia modelo ni Main.

Validación focal inicial:12tests aprobados (2nuevos PPP+catálogo ficticio y10existentes), /tmp/ppp-menu-image-focused.log. TypeScript sin errores /tmp/ppp-menu-image-tsc.log. La ejecución de la suite general completa se interrumpió voluntariamente para acotar a los caminos de medios afectados; no cuenta como global aprobada. Primera tanda de medios:147verdes/7fallos de redacción al desaparecer «cuál plato/código», sin fallos de carrito; se conserva la pregunta específica junto al reenvío, sin contacto telefónico. /tmp/ppp-menu-image-media-regressions.log. Regresión final aprobada:4suites/156tests de medios,3998ajenos omitidos por filtro,en63.887s, /tmp/ppp-menu-image-media-final.log. TypeScript final aprobado /tmp/ppp-menu-image-final-tsc.log. No es una nueva global. Los2casos nuevos ahora parten de carrito con cantidad/nota y comprueban sesión idéntica. Cero inferencia/API pagada en esta corrección. Presupuesto135/131/4 sin cambios. Publicado y desplegado en staging, código444df5a9: contenedor running, imagen activa=candidate sha256:a16705aa0a2cc81469ad86fe09e47f0101af675a740c2b349d8752644246cd99, bindings compilados comprobados y endpoint healthHTTP200/DBconnected a2026-10-15T18:35:04Z. Evidencia /tmp/ppp-menu-image-deploy.log y /tmp/ppp-menu-image-deploy-verified.log. No se ha repetido la foto original aislada con inferencia real; no afirmar superioridad ni equivalencia de reconocimiento entre modelos a partir de estas pruebas gratuitas.

## Tanda vigente: visión y audio desplegados (15/10)

Seleccionados y validados localmente Luna para visión/clasificación/respaldo y GPT-Transcribe para audio; Sol sigue como agente. **Activos en staging, código a591d1f4**, verificados 2026-10-15T18:15:50.795454+00:00: running/healthy, imagen coincide con candidate, HTTP200/DBconnected, variables y bindings compilados comprobados. Main intacta. Ver `docs/WHATSAPP-MEDIA-MODELS.md` y `docs/whatsapp-media-model-validation-1510.json`.

16 solicitudes reales aprobadas sobre medios sintéticos:6imágenes,5audios (incluye ruido/silencio),4clasificaciones,1saludo.35segundos reportados para ASR; costo estimado combinado USD0.004503. Carritos de visión PPP+japonés y2audios capturados pasan replay completo gratis; no afirmar voz real de clientes ni superioridad acústica frente a Whisper. Dos replays de texto usaron0nuevas llamadas de modelo (exit1 del runner por exigir alguna llamada, no por fallar los escenarios).

192controles focalizados y6replays completos aprobados; TypeScript sin errores. Global definitiva aprobada: **76suites/5582tests**,20regresiones nuevas frente a23642b84,en826.223s. Fuente final intacta. Evidencia: `/tmp/ppp-media-model-final-full.log`; snapshot `/tmp/ppp-media-model-final-source.json`. TypeScript aprobado: /tmp/ppp-media-model-final-tsc.log. Activos en staging los overrides VISION/ASSIST=gpt-6-luna y AUDIO=gpt-transcribe, conservando AGENT=gpt-6.1-sol. Main intacta. Presupuesto135tope/131usadas/4restantes, registro+espejo sincronizados; no más llamadas pagadas necesarias para cerrar este bloque.

Se corrigieron códigos de catálogo confundidos con órdenes y filas anotadas cuya identidad explícita se volvía ambigua. Fuente general, sin excepciones de IDs de PPP. Los archivos de medios exactos y hashes están versionados bajo scripts/fixtures/media-models-1510. La nueva global pasó con snapshot intacto:76suites/5582tests;20regresiones nuevas. Próximo: pruebas humanas con fotos/audios originales y medición por tenant para Kamppo.

## Tanda vigente: reemplazo de modelo (15/10)

**Sol (`gpt-6.1-sol`) elegido para validación de calidad en staging.** Código integrado y validado: **74 suites / 5.562 pruebas aprobadas**,40 más que a1bcfd0f (incluye cambios locales previos conservados),851.419s. TypeScript aprobado. Snapshot src/scripts intacto; global definitiva `/tmp/ppp-model-integration-final-full.log`, snapshot `/tmp/ppp-model-integration-source.json`, TypeScript `/tmp/ppp-model-integration-tsc.log`. Una global anterior fue interrumpida para corregir render; no cuenta como aprobada.

Transporte Responses para GPT-6, compatibilidad anterior conservada, rollback por WHATSAPP_AGENT_MODEL. Sol pasó dos conversaciones completas de3turnos con PPP+yotra carta, tokens reportados USD0.025812 y USD0.0325505. No son holdouts ni un ranking estadístico. Luna propuso carrito/respuesta correctos; el backend descartó formulaciones de indisponibilidad. Ver [comparación y plan](WHATSAPP-MODEL-COMPARISON.md) y `whatsapp-model-comparison-1510.json`. Se corrigieron guardia de bebida incluida, preámbulo de precio y render; no excepciones de platos en producción.

Presupuesto actual:119top operativo/115intentos usados/4restantes;38intentos en la tanda, uno antes de red por preparación defectuosa. Suma sobre tokens reportados USD0.125462, no factura. Registro y espejo sincronizados. No confundir estos topes elegidos por agente con cifras del usuario. No Meta/pagos/mapas/órdenes externos; solo inferencia real y router aislado.

**Sol activo en staging, código fd4c2f0c**, verificado 2026-10-15T17:35:34.124427+00:00: running/healthy, imagen coincide con candidate, healthHTTP200/DBconnected y WHATSAPP_AGENT_MODEL=gpt-6.1-sol. Main intacta. Visión todavía usa ajuste compartido gpt-4.1; voz runtime whisper-1. Retirada de GPT-4.1 NO queda completamente resuelta hasta migrar visión/clasificación. Latencia inicial Sol14.9–17.7s en los recorridos aprobados, mejora pendiente.

Próximo: fuente idéntica por candidato, más conversaciones no inspeccionadas, contrato estructurado de ausentes (render regex solo intermedio), compra simple de paquete con condición capturada como pregunta, reducir rondas/latencia, evaluar medios por separado. No declarar vendible por tests verdes ni que Sol es superior a Luna por fallos del backend.

## Historial anterior

Estado local actualizado al 15/10/2026. Última verificación del runtime:14/10/2026,22:34Bogotá. Este es el punto de entrada breve; el historial completo está en `AGENT-HANDOFF-WHATSAPP.md`. Las secciones antiguas de ese historial no representan el presupuesto ni el despliegue actual.

## Tanda actual: recuperación técnica y compras condicionales (base 931c6a4e)

Bloque validado: **70 suites / 5.522 pruebas aprobadas**,31regresiones nuevas frente a931c6a4e,en486.72s. Fuente intacta y TypeScript sin errores. Publicado solo en rama staging,sin deploy ni cambios aMain. Evidencia: `/tmp/ppp-technical-mixed-approved-full.log`. TypeScript: `/tmp/ppp-technical-mixed-approved-final-tsc.log`; snapshot de src/scripts TS: `/tmp/ppp-technical-mixed-approved-source.json`. Snapshot comparado e idéntico al finalizar. No deploy ni Main.

Cambios comprobados focalmente:

- Si una acción modificó el carrito y después falló la respuesta del proveedor, mostrar el carrito aplicado y pedir revisión. Se prueba timeout sostenido con sus tres reintentos, HTTP500, mensaje inexistente y contenido vacío. La respuesta no debe pedir repetir un cambio ya aplicado ni confirmar una orden externa.
- Un lote con compras aceptadas y otros SKUs rechazados conserva las aceptadas. El rechazo no se interpreta como producto olvidado ni se reconstruye desde el parser viejo. Se muestra qué fragmento no se añadió. No demuestra completitud del mensaje entero; el seguimiento de rechazos por ID todavía no distingue una variante rechazada y otra aceptada del mismo SKU.
- La ruta rápida de multi-producto comprobará modificadores explícitos en fichas con descripción de receta usando la misma validación que add_item. Las fichas sin descripción conservan la ruta anterior: ausencia de metadatos no demuestra ausencia de ingrediente. La descripción también cuenta como receta confirmada. Sustituciones registradas conservan su propio contrato. Falta ampliar ingredientes sin «con» y aclaraciones posteriores.
- Una compra con condición de inventario pasa al agente antes del parser de varios platos, solo en building_cart, con agente activo y sin pendientes. El texto entero llega al modelo. Una consulta o un «sí» aislado no activan esta ruta; si no se resuelve, no se consume parcialmente mediante el atajo viejo. No se ha migrado todo el router a un único intérprete.

Modelo real: fixture nuevo `whatsapp-mixed-followup-1510.json` falló antes del modelo (0requests): omitió bowl y trató instrucciones como platos ausentes. Tras diagnóstico y regresión gratuita pasó los 3turnos con gpt-4.1-2025-04-14 en 3requests:wrap Yogur+bowl,ausencia brownie,cambio a Tahini+sin cebolla solo wrap,total33.600. Es reensayo de desarrollo, no holdout. Informe `/tmp/ppp-fresh-mixed-correction-retest-live.json`; captura sintética versionada `whatsapp-recorded-conditional-correction-output.json`. Fallos técnicos se simularon gratis; no se provocaron errores pagados artificialmente. No acredita WhatsApp/voz/fotos reales.

La primera global falló4regresiones (5518/5522pasaron,854.863s):se habían tratado fichas sin descripción como recetas completas. Se corrigió la frontera por disponibilidad de datos y se mantienen los4oráculos originales.35focalizadas en3suites aprobadas tras reparación;global definitiva aprobada5522/5522. No usar la global fallida como aprobación. El modelo se ensayó antes de este último ajuste de fichas sin descripción;su carta sí tenía descripciones.

Presupuesto actual: topes elegidos por agente bajo autorización continuada del usuario,80acumuladas/77usadas/3restantes. Esta tanda gastó3requests;0el fallo inicial determinista. Registro y espejo sincronizados. No atribuir al usuario un límite numérico que no expresó.

Próximo: identidad por línea para rechazos de variantes del mismo SKU;aclaración persistente de la línea no añadida;API401 tras acción aceptada (su fallback anterior sigue distinto);más mensajes no inspeccionados;replay de chats reales y piloto supervisado. Mantener abiertos esos límites aunque la global pase.

## Historial de tandas anteriores

## Tanda vigente (15/10): destinatarios, línea normal y paquetes

Base647a3739. Usuario autorizó más inferencia y recargó saldo tras HTTP429. Tanda operativa elegida por el agente:15requests adicionales;14consumidas (incluye1rechazada por saldo),1restante;acumulado75/74/1. No es límite numérico dictado por el usuario ni autorización permanente. Contadores y espejo privados sincronizados.

Tres conversaciones completas pasaron con gpt-4.1-2025-04-14 en simulador de router aislado:mixto+productoausente+notadirigida (5requests);sopa normal+misma sopa sincilantro+tercerplato+total37.100 (retest2);trío1+dosbebidas sinazúcar→tresen total (4). El primer intento independiente de destinatarios falló con2requests:modelo propuso las3líneas bien,backend rechazó bowl al tratar «para cada uno…»/«a la de [persona]…» como dirección. Corregido gratis y reensayado. Paquetes no cuenta como holdout:tuvo pruebas gratuitas antes de la llamada exitosa. Capturas sintéticas versionadas scripts/fixtures/whatsapp-recorded-recipient-pack-output.json;ninguno acredita audios/fotos ni transporte WhatsApp real.

Cambios:reparto de comensales no se guarda como dirección;«a la de…»/«en la de…» son referencias anafóricas;línea normal+gemelo connota distinta pueden preservar lote validado (duplicados idénticos siguen rechazados);cantidad literal unida al nombre completo se lee antes de limpieza para búsqueda,después del cálculo de comensales;duo/trio abreviados conservan tamaño de paquete y aclaran si variosSKUs coinciden. Sin nombres/IDs/precios PPP codificados en producción.

Pruebas focalizadas:132contratos en5suites;38focalizadas en3suites y4controles de ambigüedad. Cierre validado:70suites/5491tests en490.707s,28regresiones nuevas frente a647a3739. Global /tmp/ppp-recipient-pack-full.log,snapshot src+scripts /tmp/ppp-recipient-pack-source.json intacto,TypeScript /tmp/ppp-recipient-pack-final-tsc.log sin errores. Publicado solo en rama staging;no deploy/Main.

Próximo bloque:recuperación tras fallo técnico después de tools aceptadas;mensajes con aceptados/rechazados y completitud total;más destinatarios/pronombres y correcciones que cambian una de varias líneas iguales. Antes de piloto:replay de chats reales sin mutaciones inesperadas,ensayos nuevos no inspeccionados con catálogo PPP+yotro,familias de interrupciones en cada estado, y muestra supervisada en WhatsApp. Mantener todos los hallazgos rojos abiertos aunque la global pase. Voz real sigue pendiente de audios originales;no pedir al usuario repetir casos que ya entregó ni afirmar que transcripción mide voz.

## Historial anterior (supeditado a la tanda vigente)

## Último bloque local (15/10): reparto y lote aceptado

El caso narrativo ya pasa completo con modelo real:2bowls+wrapTahini+wrapYogur y consulta total67.200.4requests en ese bloque. Presupuesto actual:60usadas/0restantes tras el reensayo mixto posterior. Es reensayo de desarrollo del caso conocido,no holdout nuevo. También pasa gratis con otra carta ficticia y notas separadas. Se conserva un lote íntegramente aceptado por herramientas sin volver a interpretar cantidades/opciones en reconciliación/planner. Se mantienen catálogo,límites y legacy para lotes mixtos/duplicados/notas sin distinta opción. Ver límites al final del handoff largo.

La primera global falló y su fuente cambió por ediciones concurrentes;no usarla como validación. El usuario confirmó que terminó de editar y autorizó integrar. Global definitiva aprobada70suites/5456tests en476.716s (/tmp/ppp-integrated-approved-full.log),snapshot src+scripts /tmp/ppp-integrated-approved-source.json intacto.146focalizadas+77router+82contratos y TypeScript aprobados. TypeScript aprobado. Source congelada,sin deploy ni cambios a Main. Próximo paso:completitud del mensaje entero,productos ausentes y lotes mixtos;repartos con pronombres y notas distintas de mismoSKU sin variar atributos. No reabrir el caso oficina como si siguiera rechazado ni reducir sus oráculos. Captura real sintética versionada:whatsapp-recorded-distributed-output.json.

## Seguimiento mixto (15/10, validado)

Base integrada y publicada81b4fd13. unavailableAskReply ahora respeta isAvailabilityInquiry del mensaje entero:una condición «si no hay brownie» dentro de una compra no intercepta los platos disponibles.7regresiones gratuitas aprobadas y84contratos de catálogo/lenguaje. Reensayo real4requests:primer turno completo correcto;segundo update_item apunta solo al wrap y carrito correcto,pero el límite corta la respuesta final. NO aprobar conversación completa por ese resultado. Informe /tmp/ppp-mixed-conditional-live-report.json. Presupuesto agotado60/60;no inferencias nuevas sin autorización. Global aprobada:70suites/5463tests en469.355s;TypeScript aprobado y snapshot src+scripts intacto. Evidencia /tmp/ppp-mixed-conditional-full.log y /tmp/ppp-mixed-conditional-source.json. Corrección publicada solo en staging,sin deploy/Main.

Próximo orden:1reparto con una línea normal y otra con nota;2paquetes frente a cantidades absolutas;3rechazos mezclados y completitud de todo el mensaje;4recuperación ante fallo del proveedor después de una herramienta aceptada. Para cada familia:catálogo PPP+ficticio,estado/carrito/respuesta y controles negativos. Voz real pendiente por falta de audios originales;texto transcrito no acredita detección de audio. No deploy/Main.

## Procedimiento vigente: entregas locales acumuladas

El usuario pidió no desplegar por cada ajuste. La entrega actual consolida contratos localmente y NO debe desplegarse automáticamente. Se puede publicar trabajo validado en la rama staging sin reconstruir el servidor. El runtime verificado que se enumera abajo sigue siendo el anterior hasta un deploy explícito de una entrega acumulada.

## Objetivo y alcance autorizado

Crear un chatbot vendible con piloto supervisado, empezando en PPP y posteriormente adaptándolo a Kamppo multitenant. Prioridad del usuario: entender mensajes humanos, typos, notas, cantidades, opciones, pedidos largos, ráfagas, correcciones e interrupciones. No dedicar esta fase a cocina, impresoras o Mercado Pago. Piloto con efectivo y transferencia. El usuario pide continuar corrigiendo y probando staging, preservar esa rama y no publicar nuevas mejoras en Main sin solicitud.

No declarar vendible por cantidad de tests ni asignar un porcentaje inventado. Los errores recientes muestran que el modelo puede interpretar bien y el backend aplicar o responder mal. Separar interpretación del modelo, cambios de estado/carrito y respuesta al usuario.

## Abrir el checkout correcto

- Repo de trabajo: `/home/levi/Documents/programming/PPP/PPP-NEST-staging`.
- Rama permanente: `staging`; remoto `https://github.com/wilmerx5/PPP-NEST.git`.
- Código verificado desplegado: `d1c7d8fc`; puede haber un commit posterior solo de documentación. Comprobar HEAD local/remoto antes de editar.
- Main local: `/home/levi/Documents/programming/PPP/PPP-NEST`, rama `Main`, `d9241abe`; producción también `d9241abe`. Ambos se verificaron intactos.
- `/home/levi/Documents/Codex/2026-10-09/t` es la carpeta del chat, NO el checkout activo. Hay copias antiguas en `work/`; no editar esas copias ni usarlas para desplegar.
- Leer `AGENTS.md`, este documento, el final del historial y `docs/whatsapp-model-budget.json`. Revisar status, fetch y comparar HEAD antes de editar. Si aparecen cambios ajenos, preservarlos.
- No crear ramas/worktrees por rutina, borrar staging, limpiar stashes ni lanzar subagentes sin autorización aplicable. Stash histórico preservado: `edd763f8adb87bd445dc8235e37e17258133e54b`.

Inicio:

```bash
cd /home/levi/Documents/programming/PPP/PPP-NEST-staging
git status --short
git branch --show-current
git fetch origin staging
git rev-parse --short HEAD
git rev-parse --short origin/staging
```

## Estado aprobado y límites de la evidencia

- Global final: **67 suites / 5.353 tests aprobados**, 869.815 s.
- 62 regresiones nuevas en la última tanda (incluye cambios locales preexistentes), 88 focalizadas aprobadas y TypeScript sin errores. Fuente congelada y snapshot idéntico al finalizar.
- Logs locales: `/tmp/ppp-kitchen-local-full.log`, `/tmp/ppp-kitchen-local-final2.log`, `/tmp/ppp-kitchen-local-tsc-final.log`, `/tmp/ppp-kitchen-local-source.json`.
- Staging: `d1c7d8fc`, running/healthy; imagen activa y candidate iguales: `sha256:667de89f18c7ce63f0573a6284ac2b0fad2b11433051cd8b11c9373702f150e0`. HTTP health ok, DB connected, circuit CLOSED.
- Deploy/health: `/tmp/ppp-kitchen-local-deploy.log`, `/tmp/ppp-kitchen-local-verified-final.log`. `/tmp` puede desaparecer: el resumen verificado está en Git.
- Modelo de texto real de esta tanda: **gpt-4.1-2025-04-14**, usando configuración privada de staging. No cambiar modelos por intuición ni afirmar una comparación nueva con producción; releer configuración si es necesario.
- Agente activo en staging y producción en última comprobación de env: `WHATSAPP_AGENT_V1=true`. Esto no demuestra que todos los turnos lleguen al modelo: muchos handlers deterministas interceptan antes.
- Jest simula modelo/Meta/persistencia/órdenes. El runner real usa router y modelo real, pero también aísla Meta, persistencia, cotización y órdenes. No equivale a WhatsApp real ni acredita percepción de audio/foto.

## Presupuesto vigente

**60 autorizadas / 56 usadas / 4 restantes.** Extensión del usuario vigente; detener ante fallo y diagnosticar gratis antes de reensayar. No resetear contadores al cambiar agente o proceso.

La última tanda usó11 solicitudes:10 adicionales autorizadas por «continua, si quieres autoriza ams llaamadas» y1 pendiente anterior. Cada intento se contabilizó antes de red, incluidos fallos. Fuente de saldo: campos superiores de `docs/whatsapp-model-budget.json`; `evaluationHistory` registra los ensayos recientes. `latestEvaluation` conserva una evaluación histórica y no reemplaza el saldo actual.

Espejo privado: `/home/levi/Documents/Codex/2026-10-09/t/work/authorized-model-budget.json`. Debe mantenerse sincronizado cuando exista nueva autorización/uso. No imprimir ni guardar keys, tokens, passwords o env completos. No estimar gasto exacto con número de solicitudes; se registraron tokens, pero no precio monetario de4.1 en estos informes.

## Qué cambió recientemente

1. `whatsapp-dialogue-context.ts`: referencias compartidas para consultas de composición/rendimiento. Pendientes/oferta tienen prioridad sobre foco viejo; varios candidatos requieren aclaración. Es una extracción parcial: NO se ha consolidado todo el orquestador.
2. Consultas intercaladas mientras falta teléfono conservan pedido y vuelven al teléfono; aclaraciones mantienen IDs aun si se reordena catálogo. Correcciones explícitas pueden sustituir la consulta.
3. Corrección de bebida del combo: revierte únicamente una última adición registrada con firma de carrito intacta; conserva bebidas anteriores. Sin evidencia o con varios combos, aclarar. No deshacer compras históricas por adivinación.
4. Eliminación por fila/ordinal puede interrumpir checkout y conservar el dato pendiente. Si había snapshot viejo de Mercado Pago, se invalida como exigía el control histórico. No usar un número de otra lista como fila del carrito.
5. Última tanda: prefacio narrativo de grupo/lugar delimitado por dos puntos y etiquetas de destinatarios con nombre propio dejan de convertirse en productos ausentes; siguen avisándose productos ajenos al menú. Precio abreviado de familia identifica productos del carrito por palabras completas/plurales y cotiza todos si hay varios.
6. Disculpa de destinatario equivocado + compra nueva: se descarta propuesta sin confirmar y se procesa la compra del mismo mensaje. El texto original conserva la disculpa aunque el glosario la elimine; «otro combo» o «otra persona» no deben cancelar el pedido.

Archivos principales: `src/whatsapp/whatsapp-orchestrator.service.ts`, `whatsapp-session-intents.ts`, `whatsapp-dialogue-context.ts`, `types/whatsapp-session.types.ts`, `whatsapp-general-accuracy.spec.ts`. El orquestador sigue siendo grande y con caminos propios. No seguir sumando excepciones por nombres/IDs/precios PPP; usar catálogo/configuración y extraer responsabilidades gradualmente con regresiones.

## Evaluación real: qué pasó

Muestra sintética nueva con carta vegetal, `scripts/fixtures/whatsapp-independent-1410-cases.json`:

- Oficina:2 bowls,1 paquete trío,3 bebidas. Modelo correcto; backend inicialmente rechazó «somos varios en»/«oficina» y no resolvió «cuánto cuesta cada bowl». Corregido gratis y reensayado con modelo real: aprobado.
- Wrap: consulta de ingredientes sin comprar →2 wraps con salsa/dirección →total durante pago →transferencia. Aprobado al primer ensayo, sin ajustes para ese recorrido.
- Destinatario equivocado:pedido ajeno →«Uy perdón era otro negocio. Ahora sí quisiera una sopa de zapallo». Bloqueó con rechazo viejo; corregido gratis y reensayado real: aprobado.

Informes: `/tmp/ppp-independent-1410-model-report.json` (2 solicitudes, fallo), `/tmp/ppp-independent-1410-retest-report.json` (6, dos aprobados/un fallo), `/tmp/ppp-independent-1410-recovery-live-report.json` (3, reparación aprobada). La respuesta capturada de oficina está versionada en `scripts/fixtures/whatsapp-recorded-office-output.json`.

**Los3 casos ya se ejecutaron; oficina y recuperación se usaron para corregir. No llamarlos holdouts nuevos ni reutilizarlos como prueba de generalización.** Una muestra independiente pasó sin ajustes; esto no acredita cobertura global ni piloto autónomo.

## Prioridad nueva del usuario: consolidar comprensión

El usuario pidió dejar de avanzar mediante parches de frases. Tras la tanda local de cocina/cierre/listas, el siguiente trabajo principal es trazar desvíos y extraer un contrato común de intención/referencias/acciones/consultas, validar contra catálogo y aplicar cambios de sesión de forma coherente. El modelo ya propone acciones estructuradas: investigar reinterpretaciones posteriores antes de añadir otro parser. Migrar una familia acotada con comparación de recorridos, sin reescribir todo ni activar inferencia para cada turno sin medir costo/latencia. Las preguntas pendientes son contexto, no un bloqueo.

Los casos usados para corregir son regresiones, no medida de generalización; reservar conversaciones nuevas y catálogos distintos. Saldo vigente arriba; el último fallo nuevo debe diagnosticarse gratis antes de reensayar. Ver la entrada «Cambio de prioridad pedido por el usuario: generalización» al final del historial.

## Familias pendientes para comprobar dentro de la consolidación

### 1. Cierre de compra dentro de un mensaje largo (primera tanda gratuita)

Observación real pendiente: «…Eso es todo por ahora, gracias» todavía responde ¿algo más? y queda building_cart sin pedir dirección. Crear primero baseline con router completo y comprobar respuesta/estado, no solo carrito.

Probar «eso es todo», «solo eso», «nada más» al final de compras de varios productos; mensajes con dirección y pago; mensajes con opciones aún pendientes; consulta hipotética («si pido…») que NO autoriza compra. Variar menús y usar cantidades/paquetes distintos. Si falta opción obligatoria, resolverla antes del checkout; si falta dirección, pedirla; si ya hay dirección/opciones, continuar a pago/confirmación según datos reales. No crear una orden ni interpretar cualquier aparición de «nada más» como autorización de compra.

### 2. Referencias entre listas, carrito y pago

Prioridad conocida: `pendingCompositionAsk` es una lista de consulta, pero el guard de filas históricamente contemplaba otras listas. Investigar «quita la2», «la segunda», «esa no» mientras hay consulta abierta y carrito diferente. No afirmar fallo hasta reproducirlo. Un número debe pertenecer a una elección identificada; si hay ambigüedad, pedir nombre sin mutar. Probar reordenamiento de catálogo, filas retiradas y preguntas durante elección.

### 3. Varios combos / varias líneas del mismo producto

Cambiar bebida/presa de uno y después otro; conservar notas, cantidades y bebidas compradas aparte. Reparto2 de una preparación/1 de otra, eliminación parcial y corrección posterior. Foco antiguo, oferta abandonada y cambio de familia no deben arrastrar producto equivocado. No restaurar snapshot si cambió carrito.

### 4. Contradicciones y recuperación

«Normal, pero sin…», «no esa, la otra», nota frente a extra pagado, desconocido mezclado con conocidos, rechazo de propuesta + nueva compra/consulta. Cortesía no es producto. Extras sin precio/disponibilidad configurados requieren aclaración o revisión humana, no gratuidad inventada.

### 5. Evaluación independiente y medios (sin API hasta autorización)

Preparar casos originales y congelar oráculos antes de ejecutar, distinguiendo desarrollo/reservados/reensayo. Cuando haya permiso, medir conversaciones completas con límite explícito de solicitudes, una repetición y stop-on-failure; guardar antes/después/respuesta/ruta/propuesta del modelo y uso. No gastar el saldo aislado ni repetir hasta obtener verde sin diagnosticar.

Audio: usuario no tiene originales guardados. Se detectaron compras de combo que conservaron bebida/dirección y perdieron producto padre. Texto transcrito solo prueba interpretación; no acredita mejora de Whisper. Fotos: usar archivo original y contexto para comparar, no captura de respuesta. No cambiar transcripción/visión sin evidencia y evaluación representativa.

Fuentes del usuario disponibles: `/home/levi/Downloads/chats 11_10.pdf` y `/home/levi/.codex/attachments/e387d2f2-9c09-43b2-9d1e-0bc7aa6603ad/Pasted text.txt`. Revisar patrones/fixtures existentes antes de duplicar casos. Sanitizar datos privados antes de versionar nuevos fixtures. Si se aplica skill PDF, leer su SKILL.md correspondiente.

## Ciclo local por tanda

1. Reproducir rojo con dependencias aisladas; incluir oráculos de carrito completo, cantidades, atributos/notas, dirección/nombre/teléfono/pago, estado, respuesta y ausencia de orden externa.
2. Probar PPP y cartas ficticias. Agente simulado activo/inactivo cuando corresponda. No confundir excepción por mock faltante con defecto de producción.
3. Cambiar una responsabilidad general. Mantener controles negativos/ambigüedad. No debilitar expectativas para aprobar; corregir un oráculo de redacción solo si conserva significado y datos verificables.
4. Ejecutar focalizadas y TypeScript. Luego global si se tocó regla compartida. Congelar todo `src/**/*.ts` durante global y comparar snapshot al finalizar; no atribuir verde a fuente editada mientras corría.
5. Global tarda actualmente13–16min. Esperar el footer y código de salida; proceso activo sin stdout no equivale a bloqueo. Dar actualizaciones concisas y no lanzar otra global igual sin cambios/fallos que lo justifiquen.
6. Documentar fallos, límites, resultados, fuente, commit y presupuesto; commit/push solo archivos pertinentes. Deploy staging si hay cambios de producto validados; no reconstruir por documentación sola.

Comandos gratuitos (no usar runner live por defecto):

```bash
npx jest src/whatsapp/whatsapp-general-accuracy.spec.ts --runInBand --silent -t 'NOMBRE DE LA TANDA'
npx tsc --noEmit --incremental false
npx jest --runInBand --silent > /tmp/ppp-next-full.log 2>&1
git diff --check
```

No regenerar dist/tsbuildinfo con compilación normal si no se necesita; respetar archivos ajenos. No repetir matriz MariaDB si no cambian esquema/transacciones. Captura de modelos: `scripts/whatsapp-live-router-rehearsal.ts` exige flag live/key, presupuesto compartido válido y límite; leerlo antes de usarlo. El presupuesto compartido impide superar el saldo vigente.

## Deploy autorizado: solo staging

SSH con llave local: `root@76.13.119.125`; checkout `/opt/ppp-staging`, rama staging. Contenedor `ppp-staging-api-1`; candidate `ppp-nest-staging:candidate`; health `http://127.0.0.1:3301/api/health`.

```bash
ssh -o BatchMode=yes -o ConnectTimeout=15 root@76.13.119.125 'cd /opt/ppp-staging && test "$(git branch --show-current)" = staging && git fetch origin staging && git merge --ff-only origin/staging && docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml up -d --build api'
```

Después verificar HEAD, contenedor running/healthy, imagen activa=candidate y HTTP/DB/circuit. Starting no es healthy; esperar y verificar de nuevo. No `--remove-orphans`, no borrar volúmenes ni tocar `mariadb_local`. No abrir env ni imprimir secretos. Checkout del servidor puede incorporar un commit solo de documentación sin reconstruir; distinguir HEAD del código en imagen.

Producción: `/var/www/ppp-nest`, container `ppp_nest_api`, puerto3000; conservar d9241abe. No tocar compose general ni reconstruir producción por continuar staging. No subir nada a Hostinger: esta tanda no modifica frontend.

## Puerta para piloto

Piloto supervisado pequeño, no venta autónoma certificada. Aceptar solo cuando preguntas no muten pedido/datos, correcciones se apliquen y retomen el paso pendiente, precios provengan de catálogo/cotización, ambigüedad no adivine y fallos críticos tengan contención humana. Falta evidencia de medios/canal y muestra independiente más amplia. Kamppo requiere además separación de catálogo/configuración y claves de sesión por tenant; menús ficticios no prueban aislamiento multitenant.

Primera acción del siguiente agente: comprobar checkout/HEAD, leer el último cierre verificado y presupuesto vigente; reproducir gratis el fallo de validación por línea de la última evaluación narrativo/oficina. La primera extracción de contrato ya está en6daf557b. El cierre largo tiene correcciones validadas y desplegadas en d1c7d8fc; no duplicar esos casos ni dar por probado el retorno tras varios turnos de opciones. No necesita gastar API ni preguntar nuevamente por rama.


## Última evaluación local (prioridad vigente)

Base6daf557b,contrato local69suites/5372tests aprobado antes de ajuste de referencia de bebida. El ajuste y10regresiones aprobaron69suites/5382tests en806.44s;fuente src+scripts intacta.14focalizadas y TypeScript aprobados;log /tmp/ppp-price-class-full.log. No se despliega.

Nuevo caso narrativo de oficina en scripts/fixtures/whatsapp-contract-independent-office-1410.json falló:2bowls+doswraps con salsas distintas quedan1bowl+1wrap. Dos llamadas pagadas;saldo52/60usadas,8restantes. Reproducción gratuita demuestra que add_item rechaza acciones correctas por palabras gramáticas «cada»/«pero». Los argumentos reales del modelo no se capturaron;no atribuirle una propuesta correcta sin prueba. El fallback también pierde cantidades/variantes. Prioridad:contrato de evidencia por línea y contención de fallback;no seguir gastando ni sumando frases al azar. Ver diagnóstico y límites al final de AGENT-HANDOFF-WHATSAPP.md. Referencia de bebida corregida es un bloque distinto;no afirmar que arregla este pedido narrativo.


### Criterios del próximo bloque (antes de más API)

1. Reproducir gratis el fixture narrativo completo con propuesta estructurada conocida, tool add_item y router. Exigir2bowls,1wrapTahini,1wrapYogur;notas y atributos por fila;no añadir bebidas negadas. No basta assert de IDs agregados.
2. Definir evidencia por línea:fragmento del mensaje original,SKU autorizado,cantidad y opciones propuestas. No aceptar fragmentos inventados ni usar la selección de un fragmento para eludir una pregunta/no-compra o un ingrediente realmente ajeno al plato.
3. Separar tres resultados de validación:aceptado,ambiguo/no respaldado,rechazado por contradicción explícita de catálogo. Una palabra gramatical sobrante no es evidencia de un producto inexistente. No resolver incertidumbre sumando una compra parcial sin avisar.
4. Pruebas negativas:arroz con mariscos cuando no existe;combo frente a sus componentes;negación de bebida;dos variantes del mismoSKU;producto realmente inexistente entre otros válidos;consulta de precio/ingredientes sin compra;opción no permitida;contradicción de cantidades. Usar más de una carta ficticia.
5. Respuesta derivada del resultado aplicado:si faltan líneas,explicar cuál falta y conservar pedido previo;si hay opciones distintas,no fusionarlas;si no hubo aplicación,no afirmar añadido. Distinguir faltantes del pedido nuevo de filas preexistentes.
6. Congelar fuente y aprobar focalizadas,TypeScript/global antes de repetir modelo. Reensayo del caso ya visto es regresión;reservar otro caso nuevo independiente. Máximo8solicitudes restantes y detener primer fallo. No desplegar hasta entrega acumulada explícita.


## Bloque posterior: resultados de herramientas y contención

Nueva entrega local después de66be665a:purchaseAttempts distingue intento rechazado/aceptado sin PII. Si todos los add_item fallan y no hay adiciones aceptadas,el router conserva carrito y pide aclaración;ya no reconstruye el pedido erróneo por fallback. Un intento posterior exitoso sigue permitido. Runner sintético captura argumentos/resultados por turno y distingue model_call de validation_probe.15focalizadas y TypeScript aprobados;global definitiva70suites/5397tests aprobada en795.382s (/tmp/ppp-rejected-tools-approved-full.log),snapshot src+scripts intacto. La primera global se interrumpió por ajuste de prioridades y no se cuenta como resultado. Atención humana validada y consultas de pedido/ETA tienen prioridad;conservan carrito preexistente. Sin requests nuevas,saldo8,sin deploy. Ver límites de casos mixtos y próxima evidencia por línea al final del handoff largo. El pedido narrativo NO está aprobado como compra completa;no reducir su oráculo.

Último cierre local:contención y trazas validadas70/5397,sin deploy y sin nueva API. Empezar por la validación de evidencia por línea pendiente,conservar el oráculo completo del fixture de oficina y usar diagnóstico gratuito antes de las8solicitudes restantes.

Las entradas previas de contención/rechazo de oficina describen el estado anterior. El bloque15/10 de arriba y el final del handoff largo los sustituyen para la prioridad y el presupuesto vigentes.

Integración15/10:conservar nuevas familias de notas distintas/dirección que mantiene paso pendiente. Se corrigieron herencia de cantidad en reemplazos y opciones dadas como nota;dobles de pruebas actualizados. Fuente congelada para global definitiva. Consultar el cierre más reciente del handoff largo antes de publicar;56/60usadas,4restantes,sin deploy.

Punto validado15/10:70/5456,59pruebas nuevas incluyendo integración ajena.149contratos+32router+TypeScript aprobados. Nuevo caso mixto falló antes del modelo0requests porque unavailableAskReply ignoraba isAvailabilityInquiry=false. Es el siguiente bloque;ver evidencia al final del handoff. No declarar que todo el agente está cerrado ni contar fixture nuevo como aprobado.
