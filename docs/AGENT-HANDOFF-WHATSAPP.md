# Relevo del agente: PPP WhatsApp

## VIGENTE — tanda299: aclaración corta de retirada y adición (29/10)

Tanda299 desplegada en staging: código `6046e45b`, imagen `sha256:d03c77b89bbc0c4ca66f9e7a56e34555d7cb12e095a27420942e65a355096b5a`, healthy, cero reinicios, API local/pública operativas y modelos/configuración preservados. Controles compilados previos aprobados; cobertura específica299 en pruebas locales. Evidencia `whatsapp-batch-299-staging-deployment.json`. Producción292 y Kamppo282 permanecen sin promoción.

Base `bd836a14`. Si «quita dos de los de pechuga y agrega tres Agua Mineral» tiene varias líneas de origen pero un destino exacto disponible sin opciones requeridas, conserva ambas acciones pendientes. Resuelve con número, «el segundo» o nota distintiva; aplica retirada y adición juntas después de volver a validar catálogo, cantidad y límites. Preguntar total conserva la elección. Precio/nombre/disponibilidad/opciones cambiados, carrito modificado o elección vencida no aplican media operación. Caducidad30min. Cancelar el cambio conserva el carrito; reiniciar sigue vaciándolo por el flujo existente. Confirmar/no más/pregunta no resuelven la elección por accidente.

202 pruebas nuevas:144 recorridos (3 catálogos ×2 agentes simulados ×2 cantidades ×destino nuevo/existente ×6 formas de resolver/interrumpir);16 controles de cambio de catálogo/carrito, pago, límites, cantidad insuficiente y caducidad;42 controles en construcción/pago/confirmación. Baseline160 fallidos; corrección160 aprobados; ampliación detectó6 bloqueos de reinicio, corregidos. Foco1042/4; global27220/366, inventario exacto y579 fuentes congeladas. TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-299-validation.json`.

Staging299 desplegado y verificado: código `6046e45b`; evidencia `whatsapp-batch-299-staging-deployment.json`. Producción292 y Kamppo282 sin promoción. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Idiomas aplazados. El destino ambiguo o con atributos sigue solicitando petición completa/elección; esta mejora no acredita un planificador general de operaciones combinadas.


## VIGENTE — tanda298: matriz de recuperación de operaciones mixtas (29/10)

Base `bacddb3d`.384 recorridos sintéticos:8 rechazos (destino inexistente, retirada excesiva/negativa, adición decimal/cero, referencia inexistente, condición, tercera acción) ×3 catálogos ×agente simulado off/on ×efectivo/transferencia ×retirada parcial/completa ×destino nuevo/existente. Primero exige carrito intacto y respuesta explícita; después repite la instrucción completa corregida. Comprueba retirada y adición juntas, fusión de cantidades, notas/atributos del plato restante, ausencia de notas heredadas en el producto añadido, estados de checkout, creación única solo al confirmar, unidades exactas del DTO y total/nota en recibo.

384 nuevos aprobados +456 regresiones relacionadas =840 pruebas en3 suites; TypeScript general/build aprobados. Sin fallos nuevos ni cambio de motor. Publicación de pruebas, sin despliegue nuevo. Último global de runtime26514/362 en295; no reejecutado ni atribuido al inventario ampliado298. Evidencia `whatsapp-batch-298-validation.json` y `whatsapp-batch-298-patterns.md`.

Última verificación registrada: PPP staging295, producción292, Kamppo282. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Idiomas aplazados. Límite pendiente: aclaraciones cortas y persistentes de operaciones mixtas («el segundo»); esta tanda acredita recuperación repitiendo la petición completa, no soluciona ese límite.


## VIGENTE — tanda297: preparación parcial hasta confirmación (29/10)

Base `250febb5`.72 recorridos nuevos: tres catálogos sintéticos, agente simulado off/on, grupos de2/3/4 unidades, posición de línea alternada y efectivo/transferencia. «Cámbiame uno de los de pechuga a pollo broaster» y referencias equivalentes de tofu/pescado. Separa exactamente una unidad, conserva notas y atributos compatibles, mantiene la otra línea con bebida/opciones distintas y aplica el precio del destino. Verifica carrito exacto, respuesta, estados de recogida/pago/confirmación, ausencia de creación anticipada, una sola creación, unidades del DTO con notas/atributos y recibo con total correcto.

Baseline72/72; foco466/3; TypeScript general/build aprobados. Sin fallos nuevos ni cambios del motor; publicación de pruebas, sin despliegue. Último global de runtime:26514/362 en295, no reejecutado ni atribuido al inventario ampliado297. Evidencia `whatsapp-batch-297-validation.json` y `whatsapp-batch-297-patterns.md`.

PPP staging295, producción292, Kamppo282 según última verificación registrada. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. No implica validación con modelo real. Idiomas aplazados. Próximo: recuperación de operaciones mixtas ambiguas y continuidad tras aclaraciones, conservando el pedido hasta resolver destino y cantidad.


## VIGENTE — tanda296: «el otro» hasta orden y recibo (29/10)

Base `9099e57a`.48 recorridos nuevos sobre tres catálogos sintéticos, agente simulado off/on y efectivo/transferencia. Nota «sin cebolla» aplicada a una línea; «no, el otro» con destino único, aclaración entre varias líneas, destino con nota incompatible y cancelación de la redirección. Conserva el carrito mientras aclara; la resolución mueve solo la nota reciente y mantiene las notas anteriores, bebidas, presentaciones, cantidades y precios. Continúa por recogida, pago, revisión y confirmación; DTO y recibo contienen la nota en el plato correcto. No crea orden antes de confirmar.

Baseline48/48; foco480/3; TypeScript general/build aprobados. Solo pruebas, sin cambios del motor ni despliegue nuevo. Último global de runtime:26514/362 en295; no atribuirlo al inventario ampliado296. Evidencia `whatsapp-batch-296-validation.json` y `whatsapp-batch-296-patterns.md`.

PPP staging295, producción292, Kamppo282. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. Carritos preparados de una unidad por línea, no reproducción íntegra de chats nuevos ni prueba de audio. Esta tanda acredita notas; no generaliza «el otro» a cambios de SKU/preparación. Idiomas siguen aplazados. Próximo: referencias de preparación/variante hasta checkout y aclaración persistente de operaciones mixtas.


## VIGENTE — tanda295: producto frente a ocasión de consumo (29/10)

Tanda295 desplegada en staging: código `d4533407`, imagen `sha256:763875a6257c241fe50552f4e4579fbf1049a0c22382b90fc768f95cd2a61fb3`, healthy, cero reinicios, API local/pública operativas y modelos/configuración preservados. Controles compilados previos aprobados; cobertura específica295 en pruebas locales. Evidencia `whatsapp-batch-295-staging-deployment.json`. Producción292 y Kamppo282 permanecen sin promoción.

Base `0bb16f76`. Reporte Kamppo «hamburguers for lunch»; usuario aplazó expresamente idiomas. Se reproduce solo la familia española: «tienen hamburguesas para almorzar», cena/desayuno, saludo/veci/porfa y verbo «tines». Consulta explícita acotada separa producto y ocasión; respeta calificadores, título literal de catálogo, selección pendiente y estados de checkout. Presentaciones por palabras del catálogo, no IDs de PPP. Una sola mini hamburguesa también es oferta válida; agotados no se listan y ausencia real no se cambia por ejecutivos. Sin compra implícita ni promesa de horario futuro.

87 pruebas nuevas:60 recorridos con tres familias, carrito vacío/existente y agente simulado off/on;16 controles de presentación única, agotado, inexistente y todas agotadas;11 límites/calificadores. Baseline36:8 aprobados/28 fallidos. Foco304/5; global26514/362, inventario exacto y575 fuentes congeladas. TypeScript general/build y Node aprobados. Global no-timers con timeout20s como CI; timers seriales. Evidencia `whatsapp-batch-295-validation.json` y `whatsapp-batch-295-patterns.md`.

Cero inferencia/Meta/órdenes externas, ledger267/256/11 intacto. Sin SQL/modelos nuevos. Revisión de patrones seleccionados ya versionados y chats del hilo, no recenso de todos los chats originales ni nueva revisión de audio/PDF. Prioridad siguiente: referencias/cambios, cierre informal, datos fragmentados y postventa. Producción292 y Kamppo282; deploy staging se registra aparte. Mezcla de idiomas aplazada.


## VIGENTE — tanda294: total intercalado y recuperación de opciones (29/10)

Tanda294 desplegada en staging: código `de3e16be`, imagen `sha256:999bc03177539e9150ee810e58c334834626db362f5c15d9f90cae5eb3e0319d`, healthy, cero reinicios, API local/pública operativas y modelos/configuración preservados. Controles compilados previos aprobados; cobertura específica294 en pruebas locales. Evidencia `whatsapp-batch-294-staging-deployment.json`. Producción292 y Kamppo282 permanecen sin promoción.

Base `b4c1df2d`. «Cuánto va todo», «en cuánto va todo» y «cuánto va el pedido hasta ahora» leen el total del carrito sin acudir al modelo ni consumir la elección de sabor pendiente. Regla acotada y anclada; excluye producto específico, condiciones, adiciones, tiempo de entrega y futuras hipótesis. No suma productos pendientes de elección.

80 pruebas nuevas:72 recorridos de petición mixta rechazada por opciones faltantes, adición separada, selección por número/nombre o recuperación tras sabor inexistente y retirada explícita posterior; ocho límites de intención. Tres catálogos, agente simulado off/on, cantidades1/2 y total intercalado. Verifica que no se retire a medias ni se ejecute una operación antigua implícitamente. La aclaración atómica persistente de la mezcla sigue pendiente; estas pruebas acreditan recuperación mediante instrucciones separadas.

Baseline tras corregir fixtures:36/72 pasan y36 fallan. Foco631/5; global26427/361, inventario exacto y573 fuentes congeladas; TypeScript general/build y Node aprobados. Un timeout inicial de5s con seis workers se revalidó ejecutando toda la suite afectada en serie, sin cambiar código ni timeout; las demás suites se ejecutaron con cuatro workers. Evidencia `whatsapp-batch-294-validation.json`. Cero inferencia/Meta/órdenes externas, ledger267/256/11 intacto. Modelos preservados; sin SQL ni campos nuevos. Datos sintéticos, no nuevos chats/audio/PDF revisados. Producción292 y Kamppo282; publicación/despliegue staging se registra aparte.


## VIGENTE — tanda293: recuperación mixta hasta cierre (29/10)

Después de promover283–292 aMain, se añaden36 recorridos sintéticos con tres catálogos, agente simulado off/on y efectivo/transferencia. Una operación mixta inválida (destino inexistente, unidades insuficientes o condición) conserva el carrito; la corrección válida permite seguir por recogida, pago, revisión, confirmación y DTO correcto. Repetir confirmar no duplica la orden. Foco456/2, TypeScript general/build aprobados.

Solo pruebas, sin cambios de runtime ni despliegue nuevo. PPP staging/producción siguen con código292 verificado; Kamppo282. Global final del runtime:26311/359 en292; no atribuir ese global al inventario ampliado293. Cero inferencia/Meta/órdenes externas; presupuesto267/256/11 intacto. Evidencia `whatsapp-batch-293-validation.json`. Siguiente: opciones/aclaración de operaciones mixtas y matriz trazable de fuentes/paridad; medios originales y prueba real del modelo permanecen aparte.


## VIGENTE — tanda292: incidentes de dirección y pedidos reportados (29/10)

Tanda292 desplegada en producción/Main: código `df8e16c3`, imagen `sha256:8bb006a013aab47e811e3ce223ac9e5af12bd06195efe344d75394db84e8d29b`, contenedor activo, cero reinicios y API local/pública saludables (este compose no configura healthcheck Docker). Configuración/modelos preservados. Promoción283–292 autorizada por usuario, validada primero en staging. Evidencia `whatsapp-batch-292-production-deployment.json`. Kamppo sigue282.

Tanda292 desplegada en staging: código `df8e16c3`, imagen `sha256:e8184267f4387291c03be4bce11e4f7af82f88efd67dc268911c851f6f1b6352`, healthy,0reinicios, API local/pública operativas y controles compilados previos de «ni», conflicto y recuperación aprobados; cuatro controles compilados292 de dirección aprobados y cobertura de router292 acreditada localmente. Modelos y configuración privada preservados. Evidencia `whatsapp-batch-292-staging-deployment.json`. Después se verificó producción292; Kamppo conserva282.

Base `0cb3ef0f`. Prioridad del usuario: incidentes reportados, similares, staging y luego Main. Conserva nomenclatura dictada frente a «número» confundido con teléfono, bloquea cierre de calle sin placa aunque haya tarifa, contiene corrección posterior sin reabrir compra ni prometer edición de orden registrada. Esta última requiere coordinación telefónica con restaurante. Opciones bebida/arepas juntas, sugerencia confirmable de broaster ante booster/boster, porción+dirección con agente activo, nota residual y despedida corregidas. Saludo sin llamada y minutos ya existentes revalidados; ETA general no se presenta como tiempo restante.

74 casos nuevos derivados de textos sanitizados y variantes; baseline inicial32:2 aprobados/30 fallidos, con corrección del campo DTO del fixture durante reparación. Foco218/6; global26311/359, inventario exacto y571 fuentes congeladas, TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-292-validation.json` y `whatsapp-batch-292-patterns.md`.

Cero inferencia pagada/Meta/órdenes externas; ledger267/256/11 intacto. Sin SQL/campos/modelos nuevos. No prueba del audio original ni edición automática de órdenes ya enviadas. Usuario autorizó promoverMain después de validar; registrar evidencia de cada despliegue por separado. Kamppo permanece282, sin migración en esta tarea. Después de la promoción, retomar otras tandas.


## VIGENTE — tanda291: retirada contada y adición atómica (29/10)

Tanda291 desplegada en staging: código `97d628ba`, imagen `sha256:b0ad3228effa5bd53c8c4d588b0029a80f4784a04acc4ed772c94006463f9e4c`, healthy,0reinicios, API local/pública operativas y controles compilados previos de «ni», conflicto y recuperación aprobados; la cobertura específica291 consta en la validación local. Modelos y configuración privada preservados. Evidencia `whatsapp-batch-291-staging-deployment.json`. PPP producción y Kamppo conservan282.

Base `e147c34b`. «Quita uno de los de pechuga y agrega dos Agua Mineral» valida una retirada y una adición antes de guardar. Prepara resultado en copia de sesión, reutiliza adición/límites existentes y conserva notas/opciones/precios de las demás unidades. Acumula en línea compatible; límites sobre resultado final. Cantidad inválida, referencia desconocida/ambigua/insuficiente, destino desconocido/ambiguo/agotado/con opciones, límites, pregunta/condición/tercera acción y selecciones/pagos pendientes conservan todo.

420 pruebas nuevas (192 operaciones,216 guardas,12 recuperaciones), tres catálogos, compra/revisión y agente simulado off/on. Baseline inicial396:192 aprobadas/204 fallidas;24 guardas añadidas después. Foco1130/4. Global26237/358, inventario exacto y570 fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-291-validation.json` y `whatsapp-batch-291-patterns.md`.

Sin SQL, campos de sesión ni modelos nuevos. Cero inferencia pagada/Meta/órdenes externas; ledger267/256/11 intacto. Fixtures sintéticos; no nueva revisión de chats/PDF/audio. Gramática acotada, destino por nombre completo sin opciones requeridas. No orden inverso, alias, tres acciones, preparación ni aclaración persistente de esta mezcla. Siguiente: opciones/aclaración de operaciones mixtas y matriz trazable de fuentes/paridad. PPP producción y Kamppo mantienen282;283–291 son staging. Despliegue registrado aparte.


## VIGENTE — tanda290: aclaración de retiradas compuestas (29/10)

Tanda290 desplegada en staging: código `d7babf8a`, imagen `sha256:6978a43d7b1502593df22a43e2f052dd53586bc577bf174caed3b0137e94fe42`, healthy,0reinicios, API local/pública operativas y controles compilados previos de «ni», conflicto y recuperación aprobados; la cobertura específica290 consta en la validación local. Modelos y configuración privada preservados. Evidencia `whatsapp-batch-290-staging-deployment.json`. PPP producción y Kamppo conservan282.

Base `ee127315`. Aclara cada referencia ambigua conservando todas las cantidades; selección por número/nota, ninguna mutación hasta resolver todo. Reutiliza el flujo múltiple con `pendingCartRemoval.batchQuantities` opcional; retirar líneas completas conserva su contrato. Total intercalado, cancelación tras la primera selección, firma antigua, cantidades insuficientes, referencias superpuestas y selecciones/pagos pendientes protegidos. Recordatorios muestran cantidad; desconocidos/cantidades inválidas posteriores impiden crear la aclaración.

276 pruebas nuevas (96 aclaraciones,120 guardas,48 recuperaciones,12 superposiciones), tres catálogos, compra/revisión y agente simulado off/on. Baseline inicial264:36 aprobadas/228 fallidas;12 casos añadidos después. Foco1260/7. Global25817/357, inventario exacto y569 fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-290-validation.json` y `whatsapp-batch-290-patterns.md`.

Sin SQL o modelos nuevos. Cero inferencia pagada/Meta/órdenes externas; ledger267/256/11 intacto. Fixtures sintéticos derivados del plan; no nueva revisión de chats/PDF/audio. Pruebas de dos cláusulas, gramática de289; no añadir+cambiar+retirar ni reparto entre líneas. Para sustituir una petición contada pendiente: cancelar y repetir. Siguiente: matriz trazable de fuentes/paridad y operaciones heterogéneas. PPP producción y Kamppo mantienen282;283–290 son staging. Despliegue registrado aparte.


## VIGENTE — tanda289: retiradas compuestas con cantidades (29/10)

Tanda289 desplegada en staging: código `688f7f85`, imagen `sha256:ce3613aee13e03b1d02c708e704a4654081df5d00ad9cf491143f7dd4a7c52d4`, healthy,0reinicios, API local/pública operativas y controles compilados previos de «ni», conflicto y recuperación aprobados; la cobertura específica289 consta en la validación local. Modelos y configuración privada preservados. Evidencia `whatsapp-batch-289-staging-deployment.json`. PPP producción y Kamppo conservan282.

Base `2b12373a`. «Quita dos de los de pechuga y uno de los de cubos» resuelve todas las referencias y valida cantidades antes de guardar. Conserva notas, opciones, precio y saldo de unidades. Ambigüedad, referencias repetidas/desconocidas, cantidades inválidas o insuficientes, preguntas, condiciones, acciones mezcladas y pagos/selecciones pendientes conservan el pedido completo. Se solicita repetir la instrucción completa; no hay aclaración compuesta por número ni aplicación parcial.

396 pruebas nuevas (216 retiradas,168 guardas,12 recuperaciones), tres catálogos, compra/revisión y agente simulado off/on. Baseline168 aprobadas/228 fallidas; foco1176/3. Global25541/356, inventario exacto y568 fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-289-validation.json` y `whatsapp-batch-289-patterns.md`.

Sin SQL, campos de sesión o modelos nuevos. Cero inferencia pagada/Meta/órdenes externas; ledger267/256/11 intacto. Fixtures sintéticos derivados del plan; no son nueva revisión de chats/PDF/audio. Pruebas de dos cláusulas; parser acotado a2–5. No cubre añadir+cambiar+retirar ni distribución entre líneas. Siguiente: aclaración compuesta y matriz trazable de fuentes/paridad. PPP producción y Kamppo mantienen282;283–289 son trabajo de staging. Despliegue registrado aparte.


## VIGENTE — tanda288: cantidades de retirada referenciada (29/10)

Tanda288 desplegada en staging: código `3db03dde`, imagen `sha256:cab26a51896df63ec95518802e36105bb6322c6e95122db17d304afb30987c29`, healthy,0reinicios, API local/pública operativas y controles compilados previos de «ni», conflicto y recuperación aprobados; la cobertura específica288 consta en la validación local. Modelos y configuración privada preservados. Evidencia `whatsapp-batch-288-staging-deployment.json`. PPP producción y Kamppo conservan282.

Base `ce2449aa`. «Quita dos de los de pechuga» conserva cantidad al aclarar por número/nota. Rechaza cantidades inválidas o superiores a las de la línea, sin repartir la retirada entre otras líneas; permite elegir otra tras insuficiencia. Conserva total intercalado, cancelación, firma del carrito, pagos/otras selecciones. Campo opcional `pendingCartRemoval.quantity` ahora numérico validado; sin SQL/modelos nuevos.

360 pruebas nuevas (144retiradas,144guardas,72recuperaciones), tres catálogos, compra/revisión y agente simulado off/on. Baseline26aprobadas/334fallidas; foco882/3. Global25145/355, inventario exacto y567fuentes congeladas; TypeScript general/build y Node aprobados. Evidencia `whatsapp-batch-288-validation.json` y `whatsapp-batch-288-patterns.md`.

Cero inferencia pagada/Meta/órdenes externas; ledger267/256/11 intacto. Carritos previos preparados como fixtures, no conversaciones nuevas ni audio. Cantidades nuevas principales2/3 y límites inválidos; gramática acotada, no reparto entre líneas ni cambios compuestos. Siguiente: operaciones compuestas y auditoría trazable de fuentes/paridad. Producción PPP y Kamppo mantienen282;283–288 son trabajo de staging. Despliegue se registra aparte.


## Hoja de ruta operativa actualizada — 29/10/2026

El usuario pidió el plan completo para elevar la calidad. Consultar el inicio de [WHATSAPP-COMMERCIAL-READINESS-PLAN.md](WHATSAPP-COMMERCIAL-READINESS-PLAN.md): paridad283–287, inventario trazable de chats/PDF, cantidades y cambios compuestos, consolidación de acciones, conversaciones completas, muestra independiente con modelo, medios/canal y piloto medido. Los umbrales allí son propuestas, no métricas alcanzadas. Próxima tanda prevista288: cantidades de retirada; aún no implementada. Este cambio es documental: no se desplegó ni migró código ni se gastó inferencia. Staging287 y producción/Kamppo282 siguen siendo la última evidencia registrada.


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


## HISTÓRICO — diagnóstico previo a tanda275 y corrección Kamppo973a072 (28/10)

No hay corrección ni deploy nuevo. En PPP274 y Kamppo local `daabec4b`, «Quiero algo De tomar» responde producto no disponible pese a bebidas presentes; «No maa» no avanza al checkout, mientras «No más» sí. «Si» tras revisión final sí intenta crear. Adaptador Kamppo construye `clientRequestId` hasta128, columna `orders.client_request_id` limitada a64; prueba aislada imponiendo ese contrato reproduce el error interno y «llámanos al el restaurante». No se consultaron logs/DB productivos. Manifiesto de migración apunta a PPP265, no274; los dos huecos lingüísticos también persisten aquí. Evidencia `whatsapp-kamppo-reported-drink-checkout-diagnostic-2810.json`; repro opt-in `src/whatsapp/whatsapp-something-to-drink.repro.ts` (14probes,9rojos/5verdes; el control de categoría con modelo vacío no acredita defecto del modelo real). Sin cambios de runtime, inferencia pagada, Meta ni órdenes externas. Copias temporales de pruebas Kamppo retiradas del checkout; evidencia en `/tmp/kamppo-*-repro.*`. Priorizar contrato de creación y mensaje de error en adaptador; después lenguaje de bebidas y cierre tolerante a errata. No truncar identificadores sin considerar colisiones/idempotencia.


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


Punto de entrada actualizado al 14 de octubre de 2026: leer primero [Continuación local](WHATSAPP-LOCAL-NEXT-AGENT.md) y `AGENTS.md`. Este archivo conserva historial con estados y presupuestos antiguos; usar el relevo breve y las entradas finales para el estado vigente. No es evidencia de que el producto ya sea vendible.

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


## Detección de medios y diferencia Main/staging

Base `1e1e0268`, rama staging. Auditoría de los dos módulos compilados de WhatsApp de producción: recompilar Main a6890c4a en `/tmp/ppp-main-media-verify` con TypeScript/dependencias vigentes produjo exactamente los hashes activos en ppp_nest_api. AI `eceac7c6eb5f3455714fc5ca4cb2acd78d48a95a76f557e7f343208015b8a34c`; orquestador `90228fd9b79e5506a04ad3f68d7ed9cb801fd79dc9b5434be04c77816d48b9bc`. Es evidencia para esos dos módulos, no comparación binaria de todo el backend. Producción ejecuta Main del piloto; las tandas posteriores siguen solo en staging. En producción no está normalizeSpokenOrderCourtesy ni humanPhoneHint. No se cambió Main ni configuración productiva.

32 regresiones nuevas gratuitas: nueve de extracción de imagen, ocho de transcripción, tres de descarga, cuatro de carta/pie de foto y ocho de código/cantidad en PPP y catálogo ficticio. HTTP, modelos y Meta simulados. No acreditar mejor precisión del reconocimiento real a partir de estos mocks. Audio conserva texto español y modelo whisper-1; FLAC ahora tiene extensión FLAC. Archivos vacíos no se envían a OpenAI. Descarga de Meta comparte deadline de 30 segundos entre metadatos/binario; cada llamada de visión/transcripción tiene 45 segundos. No es un SLA total: hay cola y puede haber un segundo OCR.

Imágenes: se conserva textForBot completo, antes truncado a 500 caracteres. finish_reason=length no ejecuta un pedido parcial aunque el JSON sea válido. GPT-5 original/mini/nano y sus snapshots usan reasoning_effort=minimal para extracción; el límite sigue en 700, sin aumento ni cambio de modelo. No enviar minimal a 5.1/otras familias automáticamente. Fuentes oficiales consultadas: [parámetros GPT-5](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_new_params_and_tools) y [transcripción/formato de archivo](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create). La documentación respalda compatibilidad, no acredita causa de la foto concreta.

Carta ambigua sin selección no compra el primer producto por OCR; un pie explícito de producto o código se procesa como texto conservando cantidades aunque visión sea incierta. Un código no equivale a su número de unidades; conservar prefijo explícito o x3. Se encontró que calcular cantidad a partir de original + copia procesada convertía el código de una copia en cantidad de la otra; se usa el original una vez y se excluyen identificadores en el extractor general. No se añaden excepciones por IDs/nombres/precios.

Baselines: contrato HTTP de visión/audio 10 fallidos / 11 verdes (`/tmp/ppp-media-detection-baseline.log`); carta sin selección y cantidad del pie 2 fallidos (`/tmp/ppp-media-menu-selection-baseline.log`); selección por código 1 fallido (`/tmp/ppp-media-caption-code-baseline.log`); cantidad/código y pie explícito 7 fallidos / 2 verdes (`/tmp/ppp-media-code-quantity-baseline.log`); descarga 2 fallidos / 1 verde (`/tmp/ppp-media-download-baseline.log`). Son runs de desarrollo con solapamientos; no sumarlos como casos independientes. Intento directo con ts-node sin tsconfig-paths falló al resolver imports; repetir con tsconfig-paths confirmó el problema de copias duplicadas. No es defecto de producción.

Verificación focalizada final: 73 controles aprobados (32 nuevos y 41 existentes), cinco suites; TypeScript final sin errores. `/tmp/ppp-media-detection-targets-final.log`, `/tmp/ppp-media-detection-tsc-final.log`. Cero API pagada: presupuesto compartido sigue 11/20 usado, nueve restantes. No se modifica esquema/persistencia; no repetir matriz MariaDB.

Suite completa final: 65 suites / 1.733 pruebas aprobadas en un único run, 196,254 segundos (`/tmp/ppp-media-detection-full.log`). No se interrumpió este run ni se editó código/tests durante él.

Código `f03cc522` publicado y desplegado en staging, verificado 2026-10-11 15:40 Bogotá: running/healthy, imagen activa y candidate iguales (`sha256:2bef785e68d1e119c13bb2ca310c208e961a60f6f61d4a1f494f519e77e714af`), health OK, DB connected y circuito CLOSED. Evidencia `/tmp/ppp-media-detection-deploy.log` y `/tmp/ppp-media-detection-deploy-verified.log`. Commit posterior de documentación no requiere reconstrucción. Main y ppp_nest_api no se alteraron.

Siguiente: foto/audio originales con reproducción aislada y presupuesto; carta mal clasificada como order sin textForBot; entradas MIME desconocidas; aislamiento multitenant y ráfagas concurrentes. No atribuir a GPT-5 una mala calidad general por el fallo concreto ni afirmar que minimal lo resolvió sin inferencia real.

## Seguimiento de imagen no reconocida — aclaración específica

Base `b4ca1edd`, rama staging. El usuario indicó la respuesta de producción «Vi tu foto, escribe el plato o código; no entendí bien tu mensaje…». Corresponde al fallback de lectura de imagen con pie vago: la plantilla añadía humanHelpHint, que devuelve el aviso genérico completo. No atribuir esto al contexto de comprobante. Consulta privada de producción encontró un candidato en las últimas 24 h: una entrada image y una única salida image_clarification en la ventana de 20 s. No se exportaron cuerpos, teléfonos ni raw_payload; evidencia privada `/tmp/ppp-image-fallback-trace.log`. La estructura no acredita dos mensajes duplicados de Meta.

Se añade un texto de contacto telefónico sin el aviso genérico para errores de foto/audio y recepción de comprobantes. El resto de los fallbacks genéricos conserva su contrato. Seis nuevas regresiones con el router y dependencias externas simuladas: dos pies vagos, descarga de foto fallida, audio ilegible, comprobante explícito y comprobante que no abre. Todas comprueban una salida, conservación/no compra, instrucción específica y ausencia de la segunda aclaración. Baseline: 6/6 fallaron antes de corregir. Focalizadas: 29 controles aprobados (6 nuevos y 23 existentes); TypeScript aprobado. Logs `/tmp/ppp-media-clarification-baseline-final.log`, `/tmp/ppp-media-clarification-targets.log`, `/tmp/ppp-media-clarification-tsc.log`.

Suite completa aprobada: 63 suites / 1.701 pruebas, un único run de 192,054 segundos (`/tmp/ppp-media-clarification-full.log`). Después solo se ajustó puntuación/salto de línea del aviso de comprobante que no abre («aquí. Si prefieres…»); no cambió lógica. Esa redacción final se verifica con seis casos nuevos más dos controles de comprobante y TypeScript, sin repetir toda la suite por puntuación. Evidencia final `/tmp/ppp-media-clarification-copy-final.log` y `/tmp/ppp-media-clarification-tsc-final.log`.

Código `c48ec171` publicado y desplegado en staging; verificado 2026-10-11 15:19 Bogotá. Running/healthy, imagen activa y candidate iguales (`sha256:7367d7ccbd72d7cbd112895ec7a48649357bc4d3712588159e5677945727ff20`), health OK, DB connected y circuito CLOSED. Logs `/tmp/ppp-media-clarification-deploy.log`, `/tmp/ppp-media-clarification-deploy-verified.log`. Commit posterior de documentación no requiere reconstrucción.

El fallo de reconocimiento concreto sigue sin atribución confirmada: producción tiene un modelo diferente; no hay imagen original disponible para comparación controlada y no se registraba finish_reason de respuestas vacías en ese despliegue. No afirmar que cambiar el modelo lo corrige. Cero llamadas pagadas; presupuesto sigue 11/20 usado, nueve restantes. No cambiar Main ni configuración de producción por esta aclaración. No modifica esquema ni persistencia; no repetir MariaDB.

## Cuarta tanda PDF y fotos — contexto y contrato de pruebas

Base `6490ab41`, rama staging. Veintiuna regresiones nuevas: diecisiete de orquestador y cuatro del contrato HTTP de visión. Patrón PDF sanitizado «el mismo pasa en 10 mn por el pedido» probado con PPP y menú ficticio; negación y recogida del mensajero conservan domicilio. Estados completed/closed y contexto Nequi no convierten un resultado explícito de comida en comprobante. Menú sin selección pide elegir; foto ilegible conserva carrito; reintento OCR conserva cantidad; comprobante explícito requiere verificación manual aunque contenga un nombre de plato.

Baseline de quince casos: nueve verdes, seis fallidos. Dos controles posteriores reprodujeron falsos positivos con tercero negado y domiciliario; la regla nueva excluye ambos. La búsqueda de órdenes se simula vacía en esos controles para acreditar conservación, no estado real. La recogida declarada era absorbida por consulta de estado antes de actualizar logística; no confundir este fallo con el servicio de órdenes que faltaba en el mock tras añadir el primer detector. Se prioriza recogida declarativa con carrito, se admite tercero + tiempo «mn» y se conserva ese tiempo como nota, sin garantizar preparación. Contexto de pago/cierre deja de sobreescribir reconocimiento positivo de comida. Si el pie pide comida, una clasificación incierta no se da por comprobante. La clasificación explícita payment_proof sigue siendo comprobante y nunca acredita pago automáticamente.

Diagnóstico de la imagen reportada: lectura del servidor a las 14:50 Bogotá aproximadamente. Módulo compilado de visión idéntico en producción y staging (`eceac7c6eb5f3455714fc5ca4cb2acd78d48a95a76f557e7f343208015b8a34c`); orquestadores distintos. Configuración almacenada: producción gpt-5-mini, staging gpt-4.1-2025-04-14. No se encontraron errores Vision/Image resolve en las tres horas previas. Eso NO identifica la causa de la imagen concreta: faltan hora, respuesta exacta y reproducción con la misma imagen/contexto. No se cambió modelo ni configuración productiva. Lectura de ajustes limitada a modelo/enabled, sin credenciales; evidencia privada `/tmp/ppp-vision-config-check.log`.

El límite de visión permanece en 700 tokens: no aumentarlo ni atribuir el fallo a ese límite sin evidencia. Una respuesta vacía ahora registra modelo y finish_reason, sin OCR, imagen ni credenciales; el test reproduce una respuesta vacía con finish=length, NO acredita que haya ocurrido en producción. Nuevo `docs/whatsapp-test-contract.md` estandariza fuente, semilla, oráculo, conservación, respuesta, efectos prohibidos y separación entre regresión, reservado e inferencia real.

Cero llamadas pagadas; presupuesto compartido permanece 11/20 usado, nueve restantes. Meta/modelo/persistencia externos simulados. Pruebas de fotos recorren el límite resolveImageMessage, no acreditan visión real ni todo el checkout posterior al cierre. No se modifican esquema/transacciones; no repetir MariaDB. Main permanece sin cambios.

El primer run completo se interrumpió al añadir estos dos controles: `/tmp/ppp-pdf-fourth-full-interrupted.log` no acredita aprobación.

Verificación final: 36 controles focalizados (21 nuevos, 15 existentes), TypeScript sin errores, 63 suites / 1.695 pruebas aprobadas en un único run, 190,794 segundos. Logs `/tmp/ppp-pdf-fourth-targets-final.log`, `/tmp/ppp-pdf-fourth-tsc.log` y `/tmp/ppp-pdf-fourth-full.log`. Baselines `/tmp/ppp-pdf-fourth-baseline-final.log` y `/tmp/ppp-pdf-fourth-negation-baseline.log`.

Publicado y desplegado código `61320dd7`, verificado 2026-10-11 15:03 Bogotá: running/healthy, imagen activa y candidate iguales (`sha256:f46fb1a8caa38569ccd02d86c5062914da4fe7bc4d5071aba7f156af9edb5df9`), health OK, DB connected y circuito CLOSED. Primer SSH falló por timeout sin ejecutar deploy; el reintento terminó. Evidencia `/tmp/ppp-pdf-fourth-deploy-retry.log` y `/tmp/ppp-pdf-fourth-deploy-verified-final.log`. La primera comprobación del nuevo contenedor indicó starting, no se acredita como healthy; la final sí. Commit posterior solo de documentación no requiere reconstrucción. Main local continúa `a6890c4a`; archivos dist ajenos preservados.

Siguiente: comparación de foto original solo cuando se tenga fuente/contexto; reparto entre dos productos padre, líneas repetidas con notas y ráfagas concurrentes. No dar por cubiertos estos últimos por los tests de turnos seriales.

## Tercera tanda PDF — citas, recogida y repartos

Base `31e84085`, rama `staging`. Diecisiete casos nuevos gratuitos: citas nativas ausentes, ajenas o referidas a platos retirados; cantidad histórica que no restaura diez unidades; recogida por tercero frente al repartidor; pedido/dirección/apartamento/barrio en turnos consecutivos; reparto de un producto entre combinaciones de dos atributos, conservando notas. Controles de cantidades incompatibles, opción desconocida y conjuntos de atributos inconsistentes conservan el carrito.

Correcciones generales: la recogida explícita evita que la palabra persona active asesor; domiciliario/repartidor/mensajero y la negación explícita no activan esa nueva regla. El reparto separa por cantidad + con, conservando la conjunción entre atributos; exige el mismo conjunto de atributos en cada combinación y aplica todos sin guardar cambios parciales. No se añaden excepciones por nombre, ID ni precio de PPP.

Límites: transporte, modelo y servicios externos simulados; estas citas prueban el contexto nativo reproducido, no Meta real. Las ráfagas son turnos seriales, no concurrencia ni deduplicación. El reparto probado es de un mismo producto padre en un menú sintético: dos ejecutivos diferentes con varias opciones siguen pendientes. Recogida con nombre propio y tercera persona sin verbo recoge necesita otra tanda. Los casos ya usados son regresiones de desarrollo, no evaluación independiente. Cero llamadas pagadas; presupuesto permanece 11/20 usado, nueve restantes. Producción Main no se modifica.

Verificación: 20 controles focalizados aprobados (17 nuevos y tres de reparto existentes), TypeScript sin errores y 62 suites / 1.674 pruebas aprobadas en un único run, 190,955 segundos. Evidencia: `/tmp/ppp-pdf-third-targets.log`, `/tmp/ppp-pdf-third-tsc.log`, `/tmp/ppp-pdf-third-full.log`. Baseline inicial: diez casos, seis aprobados y cuatro fallidos antes de corregir. No se modifica esquema ni persistencia de órdenes; no repetir matriz MariaDB.

Desplegado y verificado el 2026-10-11 a las 14:41 Bogotá: código `4f009555`, contenedor running/healthy, imagen activa y candidate iguales (`sha256:632714d4b8fddf4c890241f81b2c6dc4e3eb086860b706335e38f05e39d9e0d1`), health OK, DB connected, circuito CLOSED. Evidencia `/tmp/ppp-pdf-third-deploy.log` y `/tmp/ppp-pdf-third-deploy-verified.log`. Commit posterior solo de documentación no requiere reconstruir.

Siguiente tanda: reparto entre dos productos padre, referencias a líneas repetidas con distintas notas, recogida por tercero con nombre y hora, cita antigua durante una selección nueva y concurrencia controlada de mensajes. Añadir un conjunto reservado antes de corregir, revisar respuesta y estado, y mantener oráculos derivados del catálogo.

## Objetivo y alcance acordado

Crear un agente de pedidos fiable y vendible para PPP, reutilizable después en Kamppo multitenant. El usuario quiere tandas sistemáticas de casos variados, no depender de que él descubra cada fallo por WhatsApp. Prioridad actual: comprensión de mensajes, consultas frente a compra, ambigüedad, cantidades, variantes, notas, cambios, interrupciones y checkout breve. Cocina, WebSocket, impresoras y pagos externos quedan fuera del foco actual. El piloto considera efectivo y transferencia; Mercado Pago está fuera de esta fase.

Seguir trabajando dentro del alcance autorizado sin pedir permiso otra vez para pruebas gratuitas, correcciones reversibles y despliegues rutinarios de staging. No enviar mensajes a clientes, Meta ni crear pedidos externos por accidente. El usuario autorizó usar su número y reiniciar sus pedidos de prueba, no datos de clientes reales. No inferir que staging está aislado de todas las integraciones: conservar los bloqueos existentes.

## Segunda tanda PDF — dinero, referencias y catálogo alternativo

Base 83e6e89b, staging. Treinta y dos casos nuevos derivados de patrones del PDF y controles sintéticos: precio histórico frente a precio vigente, cancelación frente a “cancelo con 100mil”, consultas de disponibilidad, referencias de cantidad sin producto, demora durante compra y después del pedido, preferencia de bebida condicional, dirección y plato juntos en tres menús sintéticos. Comprueba respuesta además de conservación del carrito. Presupuesto sin cambios: cero llamadas pagadas, 11 usadas / 9 restantes.

Correcciones generales: el destino explícito después de para + calle/carrera se separa antes de aceptar el mensaje completo como dirección; los productos de catálogos alternativos no quedan dentro de la dirección. “Cancelo con” + monto se interpreta como pago/cambio, sin ampliar cancelación. Preferencia condicional compara primero opción principal y después alternativa con opciones de catálogo; no inventa bebida y pregunta el plato si hay más de uno compatible y conserva el cambio elegido por candidato para retomarlo al responder, sin duplicar el plato. Una comida con solo atributo Bebida también admite elección aunque no se llame combo. Opciones de dos letras requieren contexto explícito del atributo y límites de palabra. Consulta temporal de precio usa catálogo vigente, conserva precio del carrito y aclara cuando no hay producto identificado. Referencia de cantidad con varios platos no se atribuye automáticamente al último.

Montaje y límites: el primer run tuvo errores de montaje (servicio de órdenes no simulado, monto esperado como número aunque el contrato es texto, demora genérica sin contexto configurado); no son fallos de producción. Los oráculos se corrigieron y luego se confirmaron defectos de cambio en “cancelo con”, dirección compuesta portable, preferencia principal de dos letras y precio histórico. El control inicial de sabor usaba la opción deseada por defecto: se invirtió el orden de opciones para exigir una modificación efectiva. El ETA genérico se prueba con contexto configurado y el reclamo posterior con búsqueda de órdenes simulada vacía. No acredita consulta de estado real ni cancela órdenes externas.

Pendientes del PDF: reparto simultáneo por varios atributos, citas antiguas, recogida por tercero y ráfagas concurrentes. Los casos ejercitados pasan a desarrollo, no son un holdout. Preferencia condicional cubre la estructura “si tienes con …, si no con …”; no acreditar todos los giros condicionales. Sustituciones comerciales, reconocimiento real de audio y aislamiento multitenant operativo siguen sin acreditarse.

Verificación final: 32/32 focalizadas aprobadas (/tmp/ppp-pdf-second-final-targets.log), TypeScript aprobado (/tmp/ppp-pdf-second-tsc.log). Un único run completo aprobó 62 suites y 1.657 pruebas en 188,72 s (/tmp/ppp-pdf-second-full.log). El run anterior se interrumpió para completar el recorrido de aclaración y no cuenta como aprobación. No se modifican esquema/transacciones de órdenes; se añade un campo opcional al contexto de edición de sesión, compatible con candidatos antiguos. No se repite DB. Código 842d6876 publicado y desplegado en staging. Verificación 2026-10-11 14:24 Bogotá: HEAD 842d687600d9035ea5844c8833e6fe4014299a50, running/healthy, imagen activa y candidate coinciden (sha256:598bb61ea79e689e336d7715ff1c27791d053acbcf33542470f8ce2e2dc48ac8), health OK, DB connected, circuito CLOSED. Evidencia /tmp/ppp-pdf-second-deploy.log y /tmp/ppp-pdf-second-deploy-verified.log. Commit posterior solo de documentación sin reconstrucción necesaria. Main permanece a6890c4a.

## PDF 11/10 y lenguaje hablado — tanda actual

Fuente privada de 30 páginas leída y primeras páginas inspeccionadas visualmente. No se versiona el PDF ni su extracción con datos personales. El índice sanitizado `scripts/fixtures/whatsapp-pdf-1110-patterns.json` separa patrones ejercitados de nueve pendientes: distribución por varios atributos, sabores condicionales, citas antiguas, precios históricos, recogida por tercero, estado posterior, cancelación/pago, referencias ambiguas y ráfagas.

Los tres primeros chats se reproducen con router y catálogo reales, servicios externos/modelo simulados. Oráculos: receta de sopa explícita limita candidatos; almuerzo conserva sopa/presa, nota sin ensalada y domicilio sin comprar gaseosa adicional; elegir estilo del ejecutivo no compra un pollo entero y cambiar la bebida conserva ese almuerzo. Se añaden menús sintéticos, cantidades independientes, dirección por partes, cortesías, total, cubiertos, billete para cambio, bebida ambigua entre dos platos y audio con transcripción simulada. Las respuestas históricas del local no son oráculo comercial ni acreditan disponibilidad actual.

El audio reportado se prueba con su transcripción exacta y reconstrucciones con pausas. No se dispone del archivo original: no se acredita calidad de reconocimiento de voz, solo interpretación del texto y entrada de audio simulada. Sustituciones se guardan como solicitudes en nota; no acreditar autorización comercial, precio ni cumplimiento del cambio. Cero llamadas pagadas; presupuesto permanece 11/20 usadas, nueve restantes. Main permanece a6890c4a. Trabajar únicamente en staging.

Validación final: 36 regresiones nuevas. Focalizadas 36/36; TypeScript aprobado. Suite completa de WhatsApp: 43 suites, 1.527 pruebas aprobadas en 186,908 s (`/tmp/ppp-pdf-full.log`). Complemento: 19 suites, 98 pruebas aprobadas en 12,502 s (`/tmp/ppp-pdf-other-suites.log`). Total 62 suites y 1.625 pruebas, ejecutadas en dos comandos secuenciales; no afirmar un único run de las 62. Logs focalizados `/tmp/ppp-pdf-targets-final.log` y TypeScript `/tmp/ppp-pdf-tsc.log`. Un run anterior completo fue interrumpido para añadir el control de horario del negocio; no cuenta como aprobación. Código e40f0e36 publicado y desplegado en staging. Verificado 2026-10-11 14:04 Bogotá: HEAD e40f0e362ad08c144ee32e9b15209da81e6a0fc1, running/healthy, imagen activa y candidate iguales (`sha256:055fccb70dfecc6efb2def2a51dde1c80a2d59b35b16401d10f395ec55b87a3d`), health OK, DB connected, circuito CLOSED. Logs `/tmp/ppp-pdf-deploy.log` y `/tmp/ppp-pdf-deploy-verified.log`. El commit posterior solo de documentación no requiere reconstrucción. La tanda anterior dbef6ed4 también se verificó sana antes de esta actualización; conservar su evidencia histórica en `/tmp/ppp-next-batch-deploy-verified.log`.

## Tanda de recuperación compuesta — 11 de octubre de 2026

Base c39cdf39, rama staging. Main se promovió al piloto en a6890c4a y el usuario informa que ya la publicó; esta tanda no modifica Main. Se ejecutaron ocho patrones anteriormente reservados con router real, catálogo/guard reales y modelo/Meta/persistencia externa simulados: primer run 4/8 aprobados, cuatro defectos. Añadidos siete controles de portabilidad y límites: 15 regresiones nuevas en total. Los ocho patrones se marcan como desarrollo, no holdout.

Correcciones generales: comparación por hechos del catálogo seguida de compra explícita separada por interrogación; conserva consulta y compra independiente. Pedidos con nota/dirección/pago separan una coma residual después de retirar el pago, evitando usar los números de la dirección como cantidad; la nota de cocina se extrae del texto del producto. Verbos agrega/agrégame/añade permiten cantidades por vocabulario del catálogo alternativo. Perdón/disculpa + cantidad + producto corrige la línea existente, conserva dirección y retoma checkout. Compra referida usa el parser común para fecha y hora; fechas/horas inválidas requieren aclaración sin comprar, no afirma reserva.

Pruebas nuevas: comparación con bebida en PPP y menú alternativo; retiro seguido de nota sobre restantes; compra con nota, domicilio y transferencia en dos menús; precio mínimo seguido de elección de tres broaster; corrección durante pago; compra referida con fecha/hora en menú alternativo; retiro por preparación; foto válida seguida de ilegible; corrección con otra bebida presente; dos horarios/fechas inválidos; consultas negativas sin compra. La compra referida se prueba con Bowl Mediterraneo sin atributos: no se atribuye aprobación al recorrido completo de arroz/medio pollo con variantes. Fotos: interpretación simulada, no visión real. La transferencia usa el ID interno transfer (el primer oráculo esperaba incorrectamente transferencia; se corrigió el montaje).

Verificación final: TypeScript aprobado (/tmp/ppp-next-batch-tsc.log); 62 suites y 1589 pruebas aprobadas en un único run completo, 314.49 s (/tmp/ppp-next-batch-full.log). Evidencias intermedias conservadas: /tmp/ppp-next-batch-baseline.log, /tmp/ppp-next-batch-fixed.log, /tmp/ppp-next-batch-portable.log y /tmp/ppp-next-batch-final-targets.log. Cero llamadas pagadas; presupuesto compartido 11 usadas / 9 restantes. Sin cambios de persistencia/esquema: no se repitió DB.

Límites pendientes: comparación y compra independiente mientras otra selección está abierta; consultas/pedidos en varias líneas; variantes + nota + domicilio + pago; correcciones con varias preparaciones coincidentes; referencia con horario, nota y domicilio en un mismo turno; foto tardía con edición intermedia. Se escriben seis patrones originales sin ejecutar en scripts/fixtures/whatsapp-reserved-followup-patterns.json; requieren semillas y expectativas por turno antes de ejecutarse. No incorporarlos a prompts ni acreditarlos como verdes. Mantener diversidad de catálogo y revisar respuesta además del carrito.

## Tanda actual: evaluación reservada, modelo real y checkout breve

Base `53e4d1c1`, rama `staging`. Se añaden 28 regresiones gratuitas: ocho patrones reservados promovidos a regresiones tras su primera ejecución, seis recuperaciones de comparación/retiro parcial, tres comparaciones por hechos de catálogo, siete recorridos de producto+dirección y cuatro controles de álbum. El paquete de tres arepas es un SKU sintético añadido al fixture; no se presume que exista en PPP real.

Primera evaluación reservada: 6/8 aprobadas; preguntar cuál sopa era la más pequeña compraba una unidad y pedir dos paquetes producía uno. Después también se reprodujo que quitar un paquete no reducía la cantidad. Se conserva la selección pendiente al comparar y se distingue el contenido de un paquete de sus unidades. Quitar una unidad conserva notas y otras líneas; varias líneas o quitar/conservar la misma requieren aclaración. Los ocho casos pasan después de corregir; ya no son un holdout independiente. Nuevo conjunto de ocho patrones en `scripts/fixtures/whatsapp-reserved-next-patterns.json`: NO ejecutado ni conectado automáticamente todavía.

Inferencia real aislada con configuración de staging, modelo `gpt-4.1-2025-04-14`: dos conversaciones, tres intentos/respuestas exitosas, 30.520 tokens de entrada (19.968 cacheados) y 93 de salida. Los oráculos automáticos aprobaron ambas, pero revisión manual rechazó la afirmación «trucha más suave», ausente del catálogo. Solo una se acredita completa en revisión manual: tres churrascos, uno sin ensalada y dos normales. Se añade comparación determinista basada en nombre, precio, descripción y opciones; la corrección posterior se verifica gratis, NO se acredita una repetición pagada. Sin estimación de dólares: el contador de precios existente no cubre este modelo. El archivo privado temporal se eliminó. Informe aislado en `tmp/whatsapp-live-router-report.json`; copia entregable anotada en outputs del chat.

Presupuesto compartido: 11/20 intentos usados, nueve restantes. `whatsapp-live-router-rehearsal.ts` persiste cada intento ANTES de fetch, valida saldo y detecta cambios de ronda/contador. Control gratuito con límite 999 rechaza antes de red y conserva presupuesto (`/tmp/ppp-live-budget-guard.log`). No lanzar inferencia por defecto, gastar artificialmente para obtener un exit code verde ni reiniciar este contador.

Caso nuevo del usuario: productos y dirección en el mismo mensaje pasan al siguiente paso necesario del checkout al terminar el turno, solo si hay carrito modificado, dirección activa confirmada y ninguna selección pendiente. Se reemplaza la respuesta de compra retenida por el prompt de pago/confirmación; consultas no compran y una sopa ambigua conserva sus unidades hasta elegir. La confirmación final sigue explícita: no se crea una orden por mandar dirección/pago. El pie de pago no publica instrucciones que mencionan métodos deshabilitados.

Álbum: se registra el lote recibido antes de su procesamiento serial. Un sobre `other` seguido de una foto real dentro de la ventana de ráfaga omite el aviso genérico «No entendí». Foto ilegible, comprobante y mensaje no soportado aislado siguen visibles. La reproducción simula interpretación de fotos y usa router/retención de respuestas: NO acredita visión real ni confirma el payload concreto de la captura del usuario. Fotos que lleguen después de esa ventana necesitan otra comprobación; no extender el silencio indefinidamente.

Verificaciones parciales: 17 controles de reservados/recuperación/comparaciones aprobados (`/tmp/ppp-reserved-targets-final.log`), un primer run completo de 62 suites/1.563 pruebas aprobado antes de los últimos casos del usuario (`/tmp/ppp-reserved-full.log`), y 17 controles de checkout/fotos aprobados (`/tmp/ppp-checkout-photo-final.log`). TypeScript final aprobado (`/tmp/ppp-checkout-photo-tsc.log`). Primer run completo después del checkout: 61 suites aprobadas y una fallida; 1.573 pruebas verdes y un fallo del montaje de envío simulado que interceptaba la prueba de ID de Meta (`/tmp/ppp-reserved-checkout-full.log`). Esa prueba vuelve a usar el envío real con Meta simulado. Tras registrar también lotes en el webhook, pasan 21 controles focalizados y TypeScript final (`/tmp/ppp-checkout-photo-batch-final.log`, `/tmp/ppp-checkout-photo-tsc-final.log`). Repetición completa final: 62 suites y 1.574 pruebas aprobadas en un único run (`/tmp/ppp-reserved-checkout-full-final.log`), 233 segundos. TypeScript final sin errores. Código `562c283c` publicado y desplegado en staging. Verificado 2026-10-11 11:08 Bogotá: contenedor running/healthy, imagen activa y candidate iguales (`sha256:ce41ac5e9e687c16079affa499f14a20b176fba0a22c5e3634a315d3a93b627d`), health OK, DB connected y circuito CLOSED. Evidencia `/tmp/ppp-reserved-checkout-deploy.log` y `/tmp/ppp-reserved-checkout-deploy-verified.log`. El commit posterior solo de documentación no requiere reconstruir. Modelos, Meta, persistencia de órdenes y pagos simulados salvo las tres inferencias indicadas. No repetir DB: no se modifica esquema/transacciones/persistencia de órdenes.

Siguiente: nuevos reservados con catálogo y expectativas explícitas, compra referida con fecha/hora compuesta, intención informativa mezclada con compra independiente, fotografías parcialmente fallidas y correcciones de cantidades durante pago. Mantener diversidad de catálogo y revisar la respuesta completa, no solo el carrito. No declarar vendible por verde unitario o dos conversaciones pagadas.

## Tanda portable: horarios, repartos y condiciones del catálogo

Base `1e694852`, rama `staging`. Se añaden 27 casos gratuitos con el router real y dependencias externas simuladas, sobre PPP y un catálogo alternativo:
- Fechas relativas, días distintos y DD/MM; horas de 24 horas y am/pm. Cambiar solo fecha conserva hora y viceversa. Conserva carrito, dirección, pago y notas ajenas. Horas ambiguas/ inválidas, fechas imposibles y notas demasiado largas requieren aclaración sin modificar la sesión.
- Reparto por un atributo de un producto con varios atributos: conserva la otra opción y notas en ambas líneas. Opción desconocida no aplica parcialmente el reparto ni cae en una compra distinta. Cambiar varios atributos simultáneamente en cada parte todavía requiere aclaración.
- Rendimiento: comunica la frase completa de la descripción, conservando negaciones y rangos; no extrae «alcanza para tres» de «no alcanza para tres».

Reproducción inicial: 21 de 22 casos fallaban (`/tmp/ppp-portable-baseline.log`). Tras corregir y añadir tres controles de conservación/límite de notas, pasan 46 controles focalizados, incluidos los 25 nuevos (`/tmp/ppp-portable-targets.log`). TypeScript sin errores (`/tmp/ppp-portable-tsc.log`). Primer run completo: 61 suites verdes, una fallida; 1.540 aprobadas y cuatro regresiones de cocción: «3/4» se confundía con fecha (`/tmp/ppp-portable-full.log`). Se distingue la fracción de cocción de una fecha con señal explícita y se añaden dos controles de fecha 3/4. TypeScript final aprobado (`/tmp/ppp-portable-tsc-final.log`). Repetición completa aprobada: 62 suites y 1.546 pruebas en un único run (`/tmp/ppp-portable-full-final.log`). Código `b904663b` publicado y desplegado en staging. Verificado 2026-10-11 09:43 Bogotá: running/healthy, imagen activa y candidate coinciden (`sha256:0ddc6b6b62cb5d2b9429db3b9a6277ff66a8da4052436bedd5d29f8c467fe552`), API OK, DB connected, circuito CLOSED. Evidencia `/tmp/ppp-portable-deploy.log` y `/tmp/ppp-portable-deploy-verified.log`. El siguiente commit solo de documentación no requiere reconstrucción. Cero llamadas pagadas; presupuesto compartido sigue 8/20 usadas, 12 restantes.

Límites pendientes: solicitudes de horario son notas, no reservas. No se resuelven fechas relativas a calendario/zona horaria ni se valida operación futura del local. Compra referida con fecha/hora compuesta, fechas escritas con nombre de mes, citas antiguas y otras intenciones nativas requieren más casos. No acreditar todo el lenguaje ni pedidos programados operativos.

## Reutilización futura en Kamppo

Reutilizar contratos de comportamiento y componentes generales; adaptar catálogo, sesión y transporte a Kamppo. Ejecutar los mismos comportamientos con fixtures por tenant, conservando las regresiones concretas de PPP. No copiar IDs, nombres o precios de PPP como reglas de producción. Añadir una suite específica de aislamiento entre tenants para catálogo, carrito, políticas, mensajes y referencias. Puntos, pagos, horarios y condiciones comerciales deben provenir de configuración del negocio; las reglas históricas de puntos siguen pendientes de parametrización. No se ha migrado ni inspeccionado Kamppo en esta tanda.

## Tanda actual: pedido grande, rendimiento, fecha y abono

Base `5f9a386d` (código previo `91cd9a67`), rama `staging`. Se añaden once regresiones gratuitas en `whatsapp-general-accuracy.spec.ts`:
- Rendimiento por personas: solo comunica la frase numérica presente en la descripción del catálogo; si no existe, pide confirmarlo con el local. No calcula unidades desde comensales. Consulta explícita recuerda un único producto concreto como foco, sin convertir la consulta en compra ni borrar selección pendiente.
- Abonos/anticipos/pagos parciales: requiere coordinación con el local; no fija porcentaje, acepta pago, cambia método ni promete reserva. El piloto sigue efectivo/transferencia; no se añade gestión comercial de abonos.
- Compra referida «quiero pedir esas diez cajas/unidades»: acepta un único producto discutido, carrito vacío y sin conflicto con otras selecciones. Conserva el producto, toma cantidad explícita y registra miércoles como fecha solicitada. No interpreta comensales o fechas como dirección. Carrito ya existente, multi-pedido, preparación pendiente de otro plato o falta de foco requiere aclaración.
- Recorrido completo de veinte comensales → consulta del arroz con medio pollo → diez cajas para miércoles → abono → respuesta nativa de mediodía → 5 Frito/5 Broaster: conserva dos líneas del producto 36 con cinco unidades, sin dirección inventada, pago elegido o reserva confirmada.
- Texto copiado más respuesta de horario: retira la cita únicamente si coincide con un mensaje Bot reciente de la misma conversación. Si parece una cita de bot/pregunta pero no se vincula al historial, pide escribir solo el horario; no reinterpreta el plato citado. No acreditar cualquier cita antigua/foto/humano.

Once controles focalizados pasaron en `/tmp/ppp-large-final-targets.log`. Verificación final del conjunto unitario en dos ejecuciones sin solapamiento: 43 suites WhatsApp/1.421 pruebas en `/tmp/ppp-large-approved-full.log`, más 19 suites restantes/98 pruebas en `/tmp/ppp-large-other-units.log`: 62 suites y 1.519 pruebas aprobadas. No fue un único run completo. TypeScript sin errores en `/tmp/ppp-large-approved-tsc.log`. No se repite DB: no se cambian esquema, transacciones ni persistencia de órdenes. Código publicado y desplegado `46a4f1bf`. Verificación 2026-10-11 09:17 Bogotá: contenedor running/healthy, imagen activa/candidate `sha256:f908954301897c15c0b338d313be74503e8d834092758adad51eef06d3a8f74c`, health OK, DB connected y circuit breaker CLOSED. Logs `/tmp/ppp-large-deploy.log` y `/tmp/ppp-large-deploy-verified.log`. El commit posterior solo de documentación no requiere reconstruir. Baseline de rendimiento/abono: cuatro fallos de respuesta. Primer recorrido largo falló al resolver la compra referida; tras resolverla quedó miércoles como dirección, corregido con exclusión de fechas/comensales puros en extracción de dirección. Modelos, Meta y persistencia externa simulados; cero llamadas pagadas, presupuesto compartido 8/20 usadas y 12 restantes.

Siguiente: rendimiento con intervalos/negación en descripción, fechas/horas distintas de miércoles/mediodía y cambios de fecha, compras referidas después de varias consultas sin foco único, opciones desconocidas y múltiples atributos en reparto, fuentes de cita más antiguas y otras intenciones. Ejecutar después casos reservados y modelo real dentro del saldo autorizado. Confirmación efectiva de pedidos futuros/abonos depende de una política explícita del local/tenant; esta tanda solo registra solicitudes. Las reglas históricas de puntos de Kamppo todavía deben parametrizarse. No declarar vendible por verde unitario.

## Histórico: respuestas nativas y reparto por preparación

Base `060c54e4`, rama `staging`. Esta tanda guarda el ID de Meta de los textos enviados por el bot y lo vincula con `raw.context.id`. El manejo nuevo está limitado a respuestas de opciones reconocidas en el catálogo, con carrito existente y sin selección pendiente: identifica una única línea actual mencionada por una respuesta saliente de la misma conversación. No incorpora cantidades o instrucciones de la cita al pedido. Cita ausente, ajena, entrante, con producto retirado o ambigua pide aclaración. No acreditar soporte completo de «Responder»: otras intenciones, citas de medios/mensajes humanos y el recorrido programado completo siguen pendientes. Los mensajes anteriores que no guardaron ID no se recuperan retroactivamente. Referencia primaria del campo de Meta: https://www.postman.com/meta/whatsapp-business-platform/folder/hysdhqs/context-object.

Se conserva cantidad y texto original en tres rutas de preparación pendiente. El reparto explícito «Los quiero 5 con … y 5 con …» usa atributos del catálogo del producto existente o pendiente, exige que la suma coincida y guarda los cambios únicamente si todas las partes se validan. No transforma arroz con medio pollo en pollos separados; conserva notas y otras opciones. Si varios platos comparten esas opciones pregunta cuál. No elige un combo por su posición cuando el usuario pide una presentación sin combo; precio explícito sigue resolviendo sobre todas las variantes. Se prueba también otro menú de bowls.

Verificación local de la tanda, sin llamadas pagadas: 62/62 suites, 1.508/1.508 pruebas y TypeScript sin errores. Logs `/tmp/ppp-color-name-full2.log` y `/tmp/ppp-color-tsc.log`. «Cuánto cuesta?» durante una preparación pendiente cotiza ese plato y conserva la cantidad. «Un Bowl Verde con arroz» ya no cae en categoría: el color queda en el nombre y la base pedida queda como atributo. El recorrido completo de rendimiento, fecha y abono sigue pendiente. Código publicado y desplegado `91cd9a67`: contenedor running/healthy, health OK y DB connected. Imagen activa/candidate `sha256:d1543094c48e97f2e65c27404715ebcfffc0062c49205369baa836d7aab6e239`. Verificación 2026-10-11. Un commit posterior solo de esta nota no cambia la imagen. La revisión inicial pasó 222 pruebas en dos suites antes de añadir controles. La primera completa se detuvo tras dos fallos de expectativas en controles nuevos (mayúscula de «cuál» y exigir preparación pendiente cuando la ruta de nota ya había agregado diez unidades). Se corrigieron las expectativas manteniendo controles de cantidad/notas/estado/carrito. Después pasaron 17 controles focalizados; se añadió otro para consultar precio antes de elegir preparación. No usar estos resultados para acreditar la revisión final. Cero llamadas pagadas; presupuesto compartido sigue 8/20 usado, 12 restante.

Siguiente: reproducir el recorrido entero de arroz para veinte personas, consulta de rendimiento, diez cajas, miércoles, abono, texto copiado y respuesta nativa de horario, hasta el reparto final. No inventar rendimiento ni aceptar reservas/abonos sin política del catálogo/local. «Un Bowl Verde con arroz» ya quedó cubierto por regresión en esta tanda. Ver `scripts/fixtures/whatsapp-development-pending.json`. Añadir controles de repartos con opciones inexistentes, atributos múltiples y varias líneas del mismo producto; todavía no quedan acreditados. Después ampliar respuestas nativas a otras intenciones con aislamiento de conversación y preservación de estado, ejecutar conversaciones reservadas y verificar modelo real dentro del saldo autorizado. No declarar vendible por pruebas unitarias.

## Histórico: correcciones, cercanía y horario

Base `93369975`, rama `staging`. Se añaden 23 regresiones. Verificación final: 62/62 suites, 1.486/1.486 pruebas y TypeScript sin errores. Logs `/tmp/ppp-references-approved-full.log`, `/tmp/ppp-references-approved-tsc.log` y `/tmp/ppp-references-targets-approved.log`. La primera ejecución completa pasó 1.482 pruebas antes de cuatro controles añadidos; la siguiente encontró una consulta que agregaba un plato (1.485 pasaron, una falló). Se corrigió la separación de consultas y la última ejecución completa pasó. Código publicado y desplegado `3a5e7f42`: contenedor running/healthy, health OK y DB connected. Imagen activa/candidate `sha256:52255c901a457e53520753345e2fd235e2521d5a149f2696915bd6662d736dd7`; verificación 2026-10-11. Documento posterior no requiere reconstrucción. Las correcciones usan catálogo para cantidades/plurales y atributos; conservan notas independientes al corregir cocción. «Los dos» con una sola unidad pregunta. La cercanía se conserva como nota y no inventa dirección; «medio día» se registra como horario solicitado sin prometer reserva.

Leer la sección nueva de `docs/whatsapp-next-batches.md` y `scripts/fixtures/whatsapp-development-pending.json` antes de seguir. Compra por nombre «Bowl Verde con arroz» está reproducida y no resuelta; la edición posterior se prueba seleccionando por código. El usuario añadió flujo de diez cajas de arroz con medio pollo, reparto 5/5 frito/broaster, rendimiento para veinte personas, miércoles/mediodía y abono: solo horario aislado acreditado; recorrido completo pendiente. El webhook conserva raw pero el orquestador no utiliza `context.id` para recuperar mensaje citado. No confundir con los tests existentes de texto copiado.

Ninguna llamada pagada; sigue 8/20 usado, 12 restante. No se cambia persistencia/transacciones; no requiere repetir DB. Siguiente prioridad: los tres casos pendientes y controles de referencia vieja/ajena, nunca tratar cita como nueva compra ni inventar políticas/rendimiento.

## Histórico: consultas, códigos sueltos y pedidos compuestos

Código publicado y desplegado `adb8d582`, base `61fc7f50`, rama permanente `staging`. Verificación: contenedor running/healthy, health OK y DB connected; imagen activa/candidate `sha256:570635addf0c281c9ab851a5cb5796bd9eec8bbd858c39bdc71753b1f609a18c`. El primer health dio 502 durante arranque; la comprobación posterior pasó tras alcanzar healthy. Una actualización posterior solo de documentación no requiere reconstrucción. Plan operativo y procedencia/licencias: `docs/whatsapp-next-batches.md`. Hay ocho casos sintéticos reservados en `scripts/fixtures/whatsapp-reserved-patterns.json`; aún no se ejecutaron y no están conectados automáticamente al runner.

Esta tanda agrega 30 regresiones: 24 de puntos/códigos y seis de pedidos compuestos en dos catálogos. Se reprodujeron 12 fallos iniciales de consultas/códigos y dos de pedidos con variante + «sin ensalada y harto ají». Las correcciones distinguen capacidad frente a petición explícita, validan vouchers sueltos antes de registrarlos como factura y separan la preferencia de cocina de la identidad del producto. No se cambiaron reglas comerciales de puntos ni persistencia. Verificación: 62/62 suites y 1.463/1.463 pruebas pasaron; TypeScript sin errores. Logs `/tmp/ppp-public-full.log`, `/tmp/ppp-public-final-tsc.log`, `/tmp/ppp-public-intents-expanded.log` y `/tmp/ppp-compound-fixed.log`. No se repitió DB porque esta tanda no cambia persistencia/transacciones.

Cero llamadas pagadas en esta tanda: presupuesto compartido sigue en ocho usadas y doce restantes. Las fuentes públicas se usan para seleccionar patrones; no se importaron ni tradujeron conversaciones de licencia no comercial al producto. Las nuevas pruebas son independientes y sintéticas, con dependencias externas simuladas.

Siguiente: cambios de preferencias con otra línea presente, referencias ambiguas después de consultas, turnos compuestos de dirección/pago, medios duplicados y errores parciales. Ejecutar casos reservados después, sin agregarlos al prompt; si fallan pasan a desarrollo y se repone el conjunto reservado. El verde unitario no acredita modelo real, visión real ni operación del local.

## Histórico: consumo del premio y total de la orden

Código publicado y desplegado: `a36a5a68`. Verificado el 2026-10-11: checkout `a36a5a6`, API running/healthy, health HTTP OK y DB connected. Imagen activa y candidate coinciden: `sha256:8fc82333a6038b4455133fc71aafb18dda5feb7bcc73c2a47c43edfdac0b05bf`. Una actualización posterior exclusiva de documentación no requiere reconstruir la API.

Verificación: 62/62 suites unitarias y 1.433/1.433 pruebas; TypeScript sin errores. Las cuatro suites DB cubren 92 pruebas: 90 pasaron en la ejecución conjunta; checkout tuvo un timeout de 30 segundos y un fallo posterior de estado. Se repitió esa suite sola, sin cambios de código ni aumento de timeout: 22/22 pasaron. Las otras tres suites habían pasado. Logs `/tmp/ppp-voucher-full.log`, `/tmp/ppp-voucher-db-full.log`, `/tmp/ppp-voucher-checkout-repeat.log`, `/tmp/ppp-voucher-tsc-final.log`. No confundir esta verificación por suites con un único run DB completo verde. Evitar ejecutar simultáneamente Jest unitario completo y Jest DB en este PC: pueden competir por memoria; la causa exacta del timeout no está acreditada por un perfil.

Base de código: `73bf4fc1` (relevo `5ab77b9d`). Se encontró y corrigió que la creación confirmaba la orden antes de aplicar el voucher y ocultaba el error del canje.

- Orden nueva: valida que tenga un medio elegible, consume el voucher dentro de la transacción de orden/inventario y guarda el código antes de commit. Código inválido/usado/vencido rechaza toda la creación. El post-commit ya no aplica premios ni ignora sus errores.
- Consumo del voucher: bloquea su fila al validar y usar. Dos pedidos distintos no pueden consumirlo a la vez. El método acepta el EntityManager de la orden; una llamada independiente abre su propia transacción.
- Aplicación a orden existente: bloqueo de orden y voucher, recálculo de puntos y guardado dentro de la misma transacción. Aviso WebSocket solo después del commit.
- Chat: carrito completo, carrito corto, contexto del agente y respuesta de éxito descuentan una sola unidad elegible. Los precios y cantidades de las líneas no se modifican. No se cotiza descuento si la caducidad está vencida o mal formada.
- Pruebas reales con MariaDB 10.11 local descartable: voucher con dos medios conserva dos unidades y deja total neto de una; reintento devuelve la orden existente; dos órdenes con el mismo voucher solo crean una; código ausente/usado/vencido o carrito sin medio no crea orden; fallo al guardar el código revierte orden, inventario y consumo. Se verifica también aplicar voucher a una orden existente.
- Estas pruebas sí usan persistencia real, pero transporte, notificaciones, facturación y proveedores siguen aislados. No prueban operación real del local ni modelo/visión real. No se gastaron llamadas API.
- Siguiente foco de canje conversacional: código de premio suelto con carrito vacío, generar para usar después, premio recién generado con carrito existente y caducidad antes de confirmar. Después, álbumes con webhooks duplicados/error en una foto, y conversaciones reservadas con modelo real dentro del saldo de 12 llamadas. Fotos originales del usuario siguen sin adjuntarse; no declarar visión real aprobada con transcripciones simuladas.
- Para Kamppo sigue pendiente parametrizar las reglas históricas de puntos por tenant. Mercado Pago sigue fuera del piloto; su cobro con vouchers no está acreditado por esta tanda.

## Tanda del 11 de octubre: integración y canjes

Checkout activo: `/home/levi/Documents/programming/PPP/PPP-NEST-staging`, rama `staging`, base `a57a2f69`. Se integran los cambios locales de comprensión, ambigüedades y fotos existentes sobre esa base. El estado histórico más abajo corresponde a una tanda anterior y no describe el runtime actual.

- Código publicado y desplegado en staging: `73bf4fc1`. Verificado el 2026-10-11: checkout `73bf4fc`, API running/healthy, health HTTP OK y DB connected; imagen activa y candidate coinciden (`sha256:7eaeeb0b0fb36897b6c5434cbd3dd5bbc4e75d3578883f135c667c65d46e2f3e`). Un commit posterior de este documento no requiere reconstruir la API.
- Verificación final: 61/61 suites y 1.428/1.428 pruebas; TypeScript sin errores. Integración adicional de canjes en MariaDB: 2/2. Logs locales `/tmp/ppp-redemption-full-final.log`, `/tmp/ppp-redemption-tsc.log`, `/tmp/ppp-redemption-db.log`.
- Canje: `PointsService.redeemPointsForVoucher` guarda premio y descuento en una transacción; bloquea la fila de la cuenta para serializar solicitudes concurrentes y elige puntos FIFO con desempate por ID. No se cambiaron las reglas comerciales ni los productos que generan puntos.
- Pruebas gratuitas contra MariaDB 10.11 local descartable: dos solicitudes simultáneas con nueve puntos producen un premio y un rechazo; un trigger que falla al actualizar puntos revierte premio y descuento. 2/2 pasaron. Esquema mínimo aislado: no acredita las migraciones completas ni configuración de staging.
- Router: consulta del procedimiento no genera premio; redimir genera código; aplicar código conserva el medio adicional; repetir con saldo cero rechaza; quitar premio no quita platos ni devuelve puntos ya convertidos en voucher. Se rechazan códigos desconocidos, vencidos, usados y de otra cuenta.
- Se corrige prioridad de «quitar el premio» antes de eliminación de platos; cancelación de «mi pedido» se mantiene como seguimiento. No se afirma una orden activa cuando no existe evidencia o falla la consulta.
- Resumen de fotos: únicamente fotos de pedidos resueltas pueden sustituir su respuesta por carrito. Errores de lectura y comprobantes permanecen visibles, así como preguntas de pago. Las pruebas de fotos simulan interpretación; falta visión real con imágenes originales y álbumes con reenvíos duplicados.
- Revisión de solo lectura en staging: `ppp_users`, `ppp_user_points` y `ppp_point_redemptions` usan InnoDB, necesario para transacciones y bloqueos.
- No se generaron códigos en cuentas reales ni en staging, no se enviaron mensajes externos ni se hicieron llamadas pagadas. Presupuesto sigue 8 usadas / 12 restantes.
- Antes de afirmar vendible: validar modelo real de forma acotada, fotos reales, álbumes con duplicados, identidad de cuenta/canje y descuento/consumo final de premio. Las reglas existentes de puntos usan códigos PPP; su configuración por tenant sigue pendiente para Kamppo.

## Histórico: tanda multilínea del 10 de octubre

- Rama única de integración y deploy: `staging` en `wilmerx5/PPP-NEST`.
- Último commit de código desplegado: `06bf8a97` — `Preserve multiline delivery orders and resolve quoted attribute choices`.
- Staging verificado: checkout del servidor `06bf8a9`, contenedor `ppp-staging-api-1` running/healthy, health HTTP OK y DB connected.
- Imagen activa coincidía con `ppp-nest-staging:candidate`: `sha256:7e5a6368dbfd8ea9e2f60bab705fdebc6d89d7cacf4636173da8a13bb559db39`.
- Suite completa: 58/58 suites, 1.307/1.307 pruebas. TypeScript sin errores. Suite de acertividad: 97 casos; 13 casos focalizados de esta tanda. Logs locales: `/tmp/ppp-multiline-full.log`, `/tmp/ppp-multiline-final-focused.log`, `/tmp/ppp-multiline-tsc.log`.
- Estas pruebas simulan modelo, persistencia y transporte. Comprueban router, catálogo, carrito, estados y respuestas; no prueban precisión del modelo real, visión real, concurrencia ni estabilidad entre días.
- Este documento se publica después de ese commit de código. Un commit posterior exclusivamente documental no implica una nueva versión de la imagen.

## Dónde trabajar

Checkout de trabajo de este chat: `/home/levi/Documents/Codex/2026-10-09/t/work/PPP-current`.

Checkout habitual del usuario: `/home/levi/Documents/programming/PPP/PPP-NEST-staging`, rama permanente `staging` (revisar HEAD antes de continuar). Tiene archivos `dist/` no rastreados: preservarlos. No confundirlo con `/home/levi/Documents/programming/PPP/PPP-NEST`, checkout de Main que no se debe tocar sin una nueva solicitud.

En el checkout de trabajo, `github` apunta al GitHub real y `origin` es un clon local; consultar `git remote -v` antes de usar comandos. En el checkout habitual y servidor, `origin` apunta al GitHub real. No inventar una rama nueva, no borrar las ramas históricas, no fusionar a Main ni hacer reset forzado sobre cambios ajenos.

Inicio en el checkout de trabajo:

```sh
git status --short
git branch --show-current
git remote -v
git fetch github staging
git log --oneline HEAD..github/staging
```

Si la rama remota avanzó, integrar con fast-forward preservando trabajo local. Revisar cambios del usuario antes de editar. Los productos concretos pertenecen a fixtures; las reglas de producción deben usar el catálogo y contexto del tenant.

## Cambios recientes y por qué importan

### `06bf8a97`: multilínea, citas y términos

- `parseCompoundOrderMessage` separa un bloque final de dirección y conserva saltos entre platos. Excluye líneas de saludo y de intención genérica de domicilio.
- Reconoce respuestas como `pierna o pechuga\nPierna porfa` solo cuando las opciones pertenecen a atributos de productos del carrito o selección pendiente y la respuesta identifica una opción única. También reconoce una elección ya aplicada sin abrir una búsqueda nueva.
- Conserva la cocción por plato en pedidos múltiples: dos churrascos `3/4` se guardan con nota `término tres cuartos`; no buscar literalmente `3/4` en el resultado esperado.
- Evita interpretar números de dirección como referencia a un pedido al consultar ETA durante el procesamiento multilínea.
- `Me confirma tiempo y valor por favor?` muestra el carrito y total. Usa `localContext.deliveryTimeNote` si existe; de lo contrario indica que el equipo debe confirmar el tiempo. No confirma la orden.
- Controles: consulta de precio multilínea no compra; catálogo sintético de bowls mantiene dos unidades, nota y atributo elegido.

### `609cd2ef`: pedidos desde foto

Se encontró una pérdida determinista: `resolveImageOrderText` devolvía el primer SKU aunque `textForBot` contuviera varios. Conserva ahora la propuesta completa para el router, con cantidades y notas. El prompt pide todos los productos seleccionados y distingue carrito de carta con múltiples opciones sin selección. Una lectura incierta con pregunta explícita no se convierte por fallback en el primer plato.

`Faltó el churrasco y el arroz con pollo` se interpreta como adición únicamente en un carrito en construcción; las pruebas parten de un pollo ya aceptado y verifican que no se duplique.

IMPORTANTE: las dos fotos originales del usuario no están adjuntas. Solo recibimos el texto del chat. Los tests de visión usaron transcripciones simuladas; no afirmar que la precisión visual esté validada. Pedir esas fotos cuando se vaya a probar visión real. No reemplazarlas por imágenes inventadas y presentarlas como las originales.

### `bf69547b` y tandas anteriores

Preparaciones compuestas (`sin salsas, más miel`), nota de sopa (`sin tanto recado`), producto inexistente (`mazorca da`), cantidades de otro catálogo, dirección por partes, exclusiones tardías, cocción `3/4`, atributos + ají en un mismo turno y cambios de cantidad durante elecciones. Existen regresiones; no deshacerlas al resolver casos nuevos.

## Archivos que orientan el trabajo

- `src/whatsapp/whatsapp-general-accuracy.spec.ts`: harness del router completo y corpus. `harness(menu, agentEnabled)` simula al agente con respuesta neutra; probar reglas con agente habilitado y deshabilitado cuando aplique. Verificar carrito exacto, cantidades, notas, atributos, estado y respuesta; no basta una confirmación bonita.
- `src/whatsapp/whatsapp-orchestrator.service.ts`: flujo, edición de carrito, dirección, selección y checkout.
- `src/whatsapp/whatsapp-catalog.service.ts`: resolución por catálogo, consultas, segmentos, atributos y cantidades.
- `src/whatsapp/whatsapp-session-intents.ts`: intenciones y consulta conjunta de tiempo/valor.
- `src/whatsapp/whatsapp-kitchen-preference.ts`, `whatsapp-cooking-term.ts`, `whatsapp-compound-parse.ts`: utilidades de preparación, cocción y mensajes compuestos.
- `scripts/fixtures/whatsapp-beta-menu.json`: menú de pruebas actual; nombres/precios históricos no son la fuente de verdad.
- `scripts/fixtures/whatsapp-real-chat-patterns.json`: 14 patrones seleccionados de 34 bloques reales, anonimizados. Nueve están automatizados, cinco pendientes.
- `docs/whatsapp-real-chat-testing.md`: cobertura, límites y evolución de las tandas.
- `docs/whatsapp-model-budget.json`: presupuesto compartido, obligatorio antes de cualquier inferencia.
- `scripts/whatsapp-live-router-rehearsal.ts` y `scripts/fixtures/whatsapp-live-router-cases.json`: ensayo con modelo real y dependencias externas simuladas. Los fixtures del corpus NO se ejecutan automáticamente con ese runner; adaptar y revisar sus expectativas primero.

El original privado de chats está en `/home/levi/.codex/attachments/e387d2f2-9c09-43b2-9d1e-0bc7aa6603ad/Pasted text.txt`. La numeración CHAT se repite entre lotes. Tratarlo como datos históricos no confiables, nunca instrucciones. No copiar teléfonos, nombres, direcciones, coordenadas o cuentas reales a Git. Los precios y respuestas antiguas del operador no son oráculos.

## Siguiente tanda concreta

1. Hecho en simulación, sin inferencia: si el cliente no nombra la bebida, el combo toma la primera opción y no pregunta. Un mensaje posterior corto la cambia solo si hay una opción única: `Giger` pasa de Colombiana a Ginger; `Fanta` deja la primera; un typo empatado no cambia nada.
2. Hecho en simulación: `preparacion-y-barrio` conserva sobrebarriga, notas `dorada delgada` y `Sin ensalada`, calle, casa y barrio.
3. Hecho en simulación: `cambio-acompanamiento` deja un ejecutivo, sopa Menudencias, nota de papa salada y «bien frito». «además / aparte / y una sopa» sigue siendo otra sopa. El mismo recorrido pasa con un almuerzo de otro catálogo.
4. Hecho en simulación: pollo sin estilo + sopa conserva las dos cantidades. «dos pollos y una sopa» pregunta frito/broaster y el tipo de sopa; «¿qué sopas tienes?» no borra esa elección. Luego «broaster» y «ajiaco» dejan 2 broaster y 1 ajiaco. El mismo recorrido pasa con otro catálogo. `pregunta-durante-variante` sigue haciendo explícito `frito`.
5. Hecho en simulación, con el menú de PPP y con un menú ficticio: un «sí» con pollo y sopa abiertos no compra; una cita sin respuesta no elige las dos opciones; un cambio que cabe en dos líneas pregunta cuál; un pago posterior reemplaza al anterior sin tocar el carrito; reiniciar suelta la cantidad pendiente; una nota contradictoria no agrega otro plato. La corrección «mejor dos» también queda en el menú ficticio.
6. Hecho en simulación, sin marcar los JSON como aprobados: si dicen que un plato es redimido y otro adicional, y no hay código validado, no se descuenta ni se inventa el premio. Lo mismo con un bowl de otro menú. Si la orden de hoy existe, «se demora» usa ese estado y «cancelarlo» no la borra: pide llamar. Si no hay orden, pide el número y no inventa una ETA. `canje-y-adicional` y `postventa-cancelacion` siguen en `automated: false`.
7. Hecho en simulación, con PPP y otra carta: «otro igual» y «para dos» suben la cantidad de un solo plato. «Lo mismo», «no gracias», «hoy no» y «listo» con elecciones abiertas no cierran ni duplican. «Mañana» no se lee como manzana. «Dos de esos» conserva la lista y deja cantidad 2. «Mitad frito mitad broaster» son dos medios. «Para la mesa» no es domicilio.

Los dos pendientes del JSON son `canje-y-adicional` y `postventa-cancelacion`. No confundir selección de casos con ejecución aprobada.

## Método de trabajo y verificaciones

- Primero reproducir el fallo gratis con el router completo; comparar estado antes/después.
- Cubrir variantes de comportamiento y otro catálogo. Evitar tests que solo reflejen el código escrito o excepciones por producto.
- Cambiar una causa concreta, ejecutar suite focalizada y corregir antes de ampliar.
- Una vez pasan los casos afectados, correr TypeScript y suite completa para reglas compartidas. No iniciar una suite completa mientras se siguen añadiendo casos que pueden fallar, ni ejecutar suites duplicadas en paralelo sin necesidad.
- Publicar y desplegar solo al pasar las comprobaciones; verificar el runtime. Actualizar corpus/documentación y el presupuesto si se usó modelo.
- Informar avances concisos en español durante el trabajo. El usuario está frustrado por el gasto; decir claramente qué es simulación, qué es inferencia real y cuánto se consumió.

```sh
npx jest src/whatsapp/whatsapp-general-accuracy.spec.ts --runInBand -t 'patrón del describe o caso'
npx tsc --noEmit --incremental false
npx jest --runInBand
```

## Presupuesto de modelo: no reiniciarlo

Autorización humana de esta ronda: hasta 20 intentos de API. Usados **11**, disponibles **9**. Fallos y reintentos también cuentan. Las últimas tandas de preparación, fotos y multilínea usaron cero llamadas. No sumar casos simulados a `acceptedConversations`: ese campo documenta rondas previas con inferencia real.

Modelo real observado: `gpt-4.1-2025-04-14`. No cambiar modelo ni inventar un coste en dólares. Registro local adicional: `/home/levi/Documents/Codex/2026-10-09/t/work/authorized-model-budget.json`; comparar con el registro versionado antes de gastar. El presupuesto es de esta ronda autorizada, no permiso permanente para futuras sesiones; conservar el saldo si el siguiente agente continúa este mismo trabajo.

Para inferencia real: casos seleccionados, una repetición, `WHATSAPP_BETA_LIVE=1`, `WHATSAPP_BETA_MAX_REQUESTS` positivo y no mayor al saldo, `WHATSAPP_BETA_CASE_IDS` explícitos, `WHATSAPP_BETA_STOP_ON_FAILURE=1`. Leer el runner antes de ejecutarlo; el fetch contabiliza cada intento. Puede salir con error si todos los casos se resuelven determinísticamente y no hubo respuesta de API exitosa: no gastar artificialmente para que el exit code sea cero.

Informe ignorado: `tmp/whatsapp-live-router-report.json`. Revisar `apiUsage`, contar TODOS los intentos y actualizar ambos registros incluso si hubo fallo. Verificar acciones/carrito, no solo las respuestas. Nunca enviar mensajes externos para esta validación.

El script local `/home/levi/Documents/Codex/2026-10-09/t/work/staging-ai-private-config.cjs` permite recuperar configuración efectiva desde el contenedor con guard de staging. Si de verdad hace falta: inspeccionar primero su funcionamiento, redirigir la salida a un archivo privado con permisos restrictivos fuera de Git, jamás imprimirla ni usar `cat` sobre ese archivo. El archivo temporal usado antes fue `work/authorized-private-ai.json` y se eliminó; comprobar que no quedó material privado. Borrar el temporal al terminar. No pegar claves en comandos visibles, comentarios ni informes.

## Deploy de staging autorizado

SSH configurado en este PC: `root@76.13.119.125`. No es `76.16.119.125`. Checkout `/opt/ppp-staging`, rama staging. Hay `bin/` no rastreado: preservar. Contenedor `ppp-staging-api-1`.

Tras commit y push a `github staging` en el checkout de trabajo:

```sh
ssh -o BatchMode=yes -o ConnectTimeout=10 root@76.13.119.125 \
  'cd /opt/ppp-staging && git pull --ff-only origin staging && docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml up -d --build api'
```

No usar compose general, `--remove-orphans`, borrar volúmenes ni reconstruir la DB por rutina. El warning de `mariadb_local` es conocido; no tocar ese servicio. `.env.staging` contiene secretos: no imprimir ni subir.

Verificar después:

```sh
ssh -o BatchMode=yes -o ConnectTimeout=10 root@76.13.119.125 \
  'cd /opt/ppp-staging && git rev-parse --short HEAD && docker inspect --format "{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}} {{.Image}}" ppp-staging-api-1 && docker image inspect --format "{{.Id}}" ppp-nest-staging:candidate'
curl --fail --silent --show-error https://dev.prontopolloportal.com/api/health
```

Esperar brevemente si está starting/502 al reiniciar; comprobar healthy y endpoint OK antes de afirmar que quedó live. Comparar imagen candidata con la del contenedor. Si el clon no tiene ref remoto de staging, seguir el refspec de `AGENTS.md`; no recrear una rama que ya existe.

Sincronizar también el checkout habitual del usuario con fast-forward después de revisar status; preservar `dist/`. Los frontends de cocina/pedidos/mesas se suben manualmente por Hostinger cuando corresponda; esta tanda solo cambió backend y no requiere subir frontends.

## Qué falta para llamarlo vendible

Cocina: el usuario la dio por verificada. `cocina-ppp` sigue apuntando a producción, así que `STAGING_ORDER_EVENTS_ALLOW` permanece apagado. Pagos en línea: el usuario ya los recorrió; no reabrir Mercado Pago en este ciclo.

Siguen abiertos: desplegar el trabajo local; un canje con puntos reales de staging (la suite ya cubre premio validado y no validado); un inbound auténtico de Meta; un piloto corto vigilado; y las 12 llamadas de modelo que quedan. No es certificación de venta.


## Tanda de OCR incierto y recuperación de audio — 2026-10-11

Base 23ccdb05, rama staging. Ocho regresiones nuevas con PPP y menú ficticio: foto incierta con un único producto visible, sin pie o con «Esto», no selecciona; selección escrita explícita se conserva; audio fallido seguido de pedido por texto recupera cantidad sin repetir error. Cuatro fallos iniciales reproducidos en /tmp/ppp-media-uncertain-baseline.log. Se evita convertir OCR incierto sin pedido propuesto en compra, incluso cuando visión no devuelve reply. Dieciocho controles focalizados aprobados (/tmp/ppp-media-uncertain-targets.log) y TypeScript aprobado (/tmp/ppp-media-uncertain-tsc.log). Suite completa aprobada: 65 suites y 1.741 pruebas, 196,519 s (/tmp/ppp-media-uncertain-full.log). Cero llamadas pagadas, presupuesto permanece 11/20 usadas y nueve restantes. Percepción simulada; no acredita el archivo original. Main no cambia.

Código 781710ad publicado y desplegado; verificado 2026-10-11 16:04 Bogotá: running/healthy, imagen activa y candidate iguales sha256:6bbfe133237a9a71081133dd38b85ad245093c09572fe552fe82a274e5781cc9, health OK, DB connected y circuito CLOSED. Evidencia /tmp/ppp-media-uncertain-deploy-verified.log. Próxima tanda: ráfagas de fotos con edición intermedia y consultas explícitas junto a imagen, simuladas primero; originales pendientes para acreditar percepción real.


## Comparación efectiva de modelos — 2026-10-11

Lectura directa de settings dentro de contenedores: producción ppp_nest_api usa gpt-5-mini; staging ppp-staging-api-1 usa gpt-4.1-2025-04-14. Ambos usan whisper-1 para transcripción (confirmado también en módulo compilado de producción); el texto transcrito pasa al router y modelo conversacional del entorno. Visión comparte openaiModel con conversación, no tiene modelo independiente. Producción mantiene límite de visión 700 sin reasoning_effort; staging incorpora minimal para familia GPT-5 original, aunque hoy corre GPT-4.1 y no envía ese parámetro. El límite max_completion_tokens incluye razonamiento y salida visible según https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create . Esto es hipótesis de fallo, no causalidad probada ni comparación de calidad. No se encontraron líneas Vision empty/incomplete response con patrón esperado en logs de producción de últimas 48 horas; ausencia de ese log no descarta truncamiento en código antiguo.

No se cambiaron modelos ni configuración de producción/staging; cero inferencia pagada, saldo 11/20 usadas. Para comparación válida usar mismo código, catálogo, prompt y archivo original con ambos modelos; medir extracción, cantidad, atributos, finalización, latencia y uso. Comparar solamente dos WhatsApps actuales confunde modelo con versiones distintas. Audio: comparar primero transcripción original, luego interpretación; cambiar modelo conversacional no cambia whisper-1. Documentación oficial consultada: https://developers.openai.com/api/docs/models/gpt-5-mini y https://developers.openai.com/api/docs/models/gpt-4.1 .


## Modelos alineados y formatos de audio — 2026-10-11

Por solicitud del usuario se actualizó SOLO el setting de staging a gpt-5-mini, igual que producción, y se reinició únicamente ppp-staging-api-1. Health OK/healthy y DB connected después. Audio sigue whisper-1 en ambos; versiones de código distintas, por lo que mismo modelo no garantiza igual comportamiento. Lecturas previas gpt-4.1 corresponden a tandas históricas, no al runtime actual. No se modificó Main ni producción.

Siete controles nuevos de audio: WAV/M4A/MPGA y cuatro respuestas inválidas del proveedor. Un fallo inicial: MPGA se nombraba OGG; corregido en audioExtension. Validación: 3 suites y 31 pruebas aprobadas (/tmp/ppp-aligned-model-audio-tests.log), TypeScript aprobado (/tmp/ppp-aligned-model-tsc.log). Baseline /tmp/ppp-aligned-model-audio-baseline.log. Cambio limitado al mapeo de formato de audio; no se repitió suite completa ni se atribuyen 1.748 aprobaciones. Cero llamadas pagadas; 11 usadas, nueve restantes.

Para mejorar reconocimiento comparar originales con whisper-1 y gpt-4o-mini-transcribe, mismos archivos y oráculos de cantidades/productos/notas/dirección. Documentación oficial https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe describe mejoras frente a Whisper, no acredita mejora local. Solicitar 3–5 audios originales con transcripción esperada, incluidos ruido, pausas y correcciones. Hay patrones del PDF pendientes; no requiere nuevos chats para seguir simulaciones. Próxima tanda: ráfagas, edición intermedia y consultas con fotos. No migrar audio en ambos entornos sin medir antes.

## Corrección de alineación por solicitud humana — 2026-10-11

El usuario indicó conservar el modelo observado funcionando en staging: se cambió el setting de producción y staging a gpt-4.1-2025-04-14 y se reiniciaron exclusivamente ppp_nest_api y ppp-staging-api-1. Relectura de ambas DB confirma el mismo modelo. Audio sigue whisper-1. Se reemplaza la alineación temporal anterior a gpt-5-mini; no modificarla en próximas tandas por rutina. No se cambiaron ramas/código ni se fusionó staging a Main. Staging running/healthy, health OK y DB connected. Producción running (sin healthcheck Docker); comprobar endpoint de health. Cero inferencia pagada. Modelos iguales no eliminan diferencias de versión de código.


## Medios secuenciales y corrección de cantidad — 2026-10-11

Diez regresiones nuevas: foto selecciona dos platos, corrección textual o audio transcrito cambia a tres sin sumar; foto ilegible posterior conserva edición; consulta de precio junto a foto incierta no compra. PPP y Bowl Mediterraneo sintético. Dos controles negativos evitan convertir «tres más» o pedido compuesto en cantidad absoluta. Cuatro fallos iniciales en /tmp/ppp-media-sequential-baseline.log; la regla de cortesía aceptaba «Perdón tres» pero no «Perdón quiero tres». Se admite quiero opcional después de disculpa explícita, conservando límites.

Diez focalizadas aprobadas (/tmp/ppp-media-sequential-tests.log); TypeScript aprobado (/tmp/ppp-media-sequential-tsc.log); suite completa 65 suites y 1.758 pruebas, 197,074 s (/tmp/ppp-media-sequential-full.log). Servicios/modelo simulados, cero API pagada, saldo nueve. No acredita concurrencia de ráfagas, reconocimiento de archivos originales ni prueba de modelo real. GPT-4.1-2025-04-14 sigue configurado en ambos entornos; producción no recibe este cambio de código. Próxima tanda: referencias con varias líneas y pedidos distribuidos entre variantes, con consulta intercalada.

Desplegado ad7f019e en staging, verificado 2026-10-11 16:40 Bogotá: running/healthy, candidate y contenedor coinciden sha256:f6cfbc3eeeb03a55bf5283660327c955f7394095904226b52cabbcfc18d300bd, health OK, DB connected, CLOSED. Evidencia /tmp/ppp-media-sequential-deploy-verified.log.

## Promoción autorizada a Main — 2026-10-11

Staging 663808ce fusionada en Main conservando cambio de puntos 0cd81307. Main local/remota publicada en 5525e502. Validación de combinación: 65 suites, 1.758 pruebas, 208,422 s (/tmp/ppp-main-promotion-full.log), TypeScript aprobado (/tmp/ppp-main-promotion-tsc.log). Ambas configuraciones efectivas reconsultadas: gpt-4.1-2025-04-14; audio whisper-1. No se reconstruyó/desplegó producción en esta promoción: publicación Git no equivale a deploy. Staging se conserva para próximas tandas. Cero inferencia pagada.


## Cambios nuevos, foto por código y ejecutivo en mensajes — 2026-10-11

Revisados y preservados cambios locales de catálogo, parser compuesto, menú nombrado, pagos y webhook. Direcciones pegadas, notas dentro de menú, reparto de dos ejecutivos y encolado de lote antes de esperar. Foto reconocida como código único se resuelve a nombre de catálogo para usar defaults; PPP y catálogo alternativo con hasAttributes explícito. El montaje alternativo inicial omitía hasAttributes y no acredita defecto de producto por sí solo.

Primera regresión completa falló: 14 casos, 3 suites (/tmp/ppp-new-changes-full.log). Corregidos límites: repetición de cantidad solo misma cantidad/referencia breve; monto temprano exige afirmación de pago, no pregunta ni opción numérica; continuación de menú solo multilínea; destino comercial seguido de dirección no queda como producto. Recuperación 256 pruebas /3 suites (/tmp/ppp-new-changes-recovery.log). TypeScript aprobado /tmp/ppp-new-changes-tsc-final.log. Run completo posterior 65 suites y 1.787 pruebas aprobado, 205,563 s (/tmp/ppp-new-changes-full-final.log).

Después de ese run se agregaron dos regresiones exactas del usuario: ejecutivo, mondongo/pollo frito/pierna pernil/papa salada, limonada en tres turnos separados y texto agrupado. Ambas pasan (/tmp/ppp-executive-three-turns.log): un ejecutivo id22, qty1, opciones correctas y nota papa salada. No afirmar 1.789 pruebas en único run ni lote auténtico de Meta: esos dos tests son router con agente deshabilitado y servicios simulados. El webhook tiene prueba separada de encolado; falta ejercicio end-to-end con eventos reales. Cero inferencia pagada; nueve solicitudes disponibles. Modelos GPT-4.1-2025-04-14 alineados; audio whisper-1. Main no recibe automáticamente esta tanda.

Tanda 1f1b2dfa desplegada y verificada 2026-10-11 19:31 Bogotá: running/healthy, candidate y activa iguales sha256:71da375cd5a34dfb14c72082041f142e7d8fd848f262598900f68705c6c609ec, health OK/DB connected/CLOSED. Evidencia /tmp/ppp-new-changes-deploy-verified.log. Primera comprobación durante build mostraba imagen antigua y no cuenta como deploy terminado.


## Ráfagas concurrentes y menús con cantidad — 2026-10-11

Ocho regresiones nuevas pasan por handleIncoming concurrente y reloj simulado: tres burbujas completan un ejecutivo PPP o menú vegetariano ficticio; cantidades uno/dos; reintento de una burbuja con mismo ID. Comprueban una sola respuesta, una línea, cantidad/atributos/nota exactos. Dos fallos iniciales: dos menú vegetariano no reconocido; se amplía marcador de cantidad en isNamedMenuDishOrderPhrase. Baseline /tmp/ppp-complex-burst-baseline.log. Focalizadas 27 pruebas/3 suites (/tmp/ppp-complex-burst-tests.log), TypeScript aprobado (/tmp/ppp-complex-burst-tsc.log), full único 65 suites y 1.797 pruebas, 206,344 s (/tmp/ppp-complex-burst-full.log). Incluye los dos casos exactos añadidos después del run previo.

Meta/modelo simulados; no son mensajes reales enviados ni acredita latencia/entrega de Meta. El usuario autoriza ráfagas WhatsApp al número de pruebas cuando se necesiten; conservar guard de destinatario, aislamiento y límite de API compartido. Esta tanda usa cero llamadas pagadas, saldo nueve. No modifica Main ni modelos. Próxima tanda: ráfagas con pausa larga, cambio de intención y mezcla foto/audio/texto; no asumir que todo mensaje siguiente pertenece al mismo plato.

Desplegado c32574dc, verificado 2026-10-11 19:45 Bogotá: running/healthy, imagen activa y candidate iguales sha256:2c488d5c82c8f0d394b8f0bc675f70692c8e7e1a4080a8a653cfb29732262460, health OK, DB connected, CLOSED. Evidencia /tmp/ppp-complex-burst-deploy-verified.log.

## Tanda en desarrollo: extras dentro de ráfaga

Ocho regresiones nuevas en general-accuracy: PPP y menú vegetariano, cantidades 1/2, mensajes separados o ráfaga concurrente, bebida incluida + sopa adicional aparte. Resultado inicial seis fallos y dos verdes (PPP separados), /tmp/ppp-burst-extras-tests.log. Estado NO publicable: pruebas locales rojas conservadas, sin cambio de producción ni deploy. En PPP ráfaga la sopa del adicional sustituye la sopa incluida y se replica nota; en sintético pierde cantidad/opciones incluso separado. Registro sanitizado scripts/fixtures/whatsapp-burst-extras-development.json. Resolver alcance por línea y prioridad de selección pendiente antes de aceptar sopa como SKU independiente. No marcar estos casos aprobados ni saltarlos. Cero API pagada, nueve restantes. Última release saludable c32574dc; documentos publicados posteriores 2d300b3e.


## Cierre de extras dentro de ráfaga — 2026-10-11

Los ocho casos pendientes ahora pasan. Se delimita texto del menú antes de una línea de compra adicional explícita, se conserva texto propio del extra y no se heredan notas globales. Opciones con nota se procesan sin retirar elecciones del catálogo; «de tomar» no bloquea opción de bebida. Lectura de cantidad de catálogo acepta «quiero pedir dos…». No usar originalText con dirección al agregar menú: produjo cantidad 7 por calle 7 y se revirtió ese intento.

Recuperación inicial 6/8 y luego 7/8; full intermedio tuvo 15 regresiones de ediciones, corregidas con protección de nombres/opciones. Suite general intermedia 486/487, último fallo dirección corregido. Evidencias /tmp/ppp-burst-extras-recovery.log, recovery2.log, general-final.log y full.log; no acreditan aprobación final. Validación final 12 focalizadas aprobadas (/tmp/ppp-burst-extras-approved-targets.log), TypeScript aprobado (/tmp/ppp-burst-extras-tsc-final.log), 65 suites y 1.805 pruebas en único run completo, 206,618 s (/tmp/ppp-burst-extras-full-final.log). Registro JSON actualizado a development_regressions_passed. No se cambiaron oráculos para aprobar. Meta/modelo simulados, cero llamadas pagadas, nueve restantes. Main no recibe esta tanda.

Desplegado b37179cc, verificado 2026-10-11 20:05 Bogotá: running/healthy, activa/candidate iguales sha256:3b0181c6d55435a3ea6a5036246effe958faa7de966c2b51fe1ee05852cb46af, health OK/DB connected/CLOSED. Evidencia /tmp/ppp-burst-extras-deploy-verified.log.


## Pausas y correcciones después de extra — 2026-10-11

Seis regresiones nuevas en general-accuracy, sin cambio de código de producción: PPP y Menu Vegetariano ficticio, 5/60 segundos entre mensajes vía handleIncoming con fake timers, dos almuerzos con sus opciones y una sopa extra sin notas ajenas. Consulta de precio intercalada no muta carrito; «Perdón quiero tres [menú]» cambia cantidad del menú sin tocar sopa adicional. Seis pasan de entrada (/tmp/ppp-pauses-tests.log); controles relacionados 33 pruebas/2 suites aprobadas (/tmp/ppp-pauses-related-tests.log), TypeScript aprobado (/tmp/ppp-pauses-tsc.log). No se repite suite completa porque no hay implementación nueva; no atribuir 1.811 a full. Último full sigue 1.805. Cero llamadas pagadas y no se enviaron WhatsApps reales; clock/Meta/modelo simulados. Tanda solo pruebas/documentos: no requiere rebuild. Última imagen saludable b37179cc. Main intacta. Próxima tanda: dos platos compatibles con una opción, referencia «el segundo» y foto/audio entre las burbujas; crear baseline antes de modificar.


## Elección posicional dentro de cambio ambiguo — 2026-10-11

Ocho nuevas regresiones en PPP/otro catálogo: el primero/el segundo/2 eligen una línea para cambiar opción y agregar nota, conservando cantidad y otra línea; el tercero fuera de lista conserva carrito y pendingCartAttributeEdit. Baseline seis fallos y dos verdes /tmp/ppp-ordinal-edit-baseline.log. Se admite referencia posicional solo con pendingCartAttributeEdit y firma de carrito vigente; se muestra lista numerada en orden de carrito. Debug detectó orden inverso de candidatos; ahora ordena índices antes de mostrar/persistir. No alterar referencias de listas antiguas: selección se aplica según candidatos almacenados. Los mocks de debug eliminados antes de validar.

14 focalizadas aprobadas /tmp/ppp-ordinal-edit-targets-final.log; TypeScript /tmp/ppp-ordinal-edit-tsc.log aprobado; full único 65 suites/1.819 pruebas, 213,674 s /tmp/ppp-ordinal-edit-full.log. Incluye seis controles de pausas publicados en tanda previa. Cero API, nueve restantes. Modelo/Meta simulados. Main no recibe la tanda. Próximo: invalidación por cambio de carrito durante aclaración y retorno desde foto/audio al referente; no interpretar ordinal sin elección pendiente.

Desplegado 3a0914cc, verificado 2026-10-11 20:19 Bogotá: running/healthy, candidata/activa iguales sha256:d984e9fb117ab30c7da612562e72727cabb27e791becfa346cf5496806c7cafa, health OK, DB connected, CLOSED. Evidencia /tmp/ppp-ordinal-edit-deploy-verified.log.


## Preparación de ensayo real WhatsApp — 2026-10-11

Usuario solicita WhatsApp real y mejora de audio. Runner human-rehearsal actualizado de rama histórica a staging; solo workflow_dispatch, sin autoenvíos por push. Cinco pruebas node offline aprobadas (/tmp/ppp-live-preflight-offline.log), commit4e7390de publicado; cambio de runner/workflow sin rebuild API. GitHub CLI no autenticada local/servidor, pero credencial Git existente permitió dispatch sin imprimir claves. Preflight real terminado éxito: https://github.com/wilmerx5/PPP-NEST/actions/runs/38191659364 . Informe privado /tmp/ppp-real-preflight-report: ok=true, authorized_context/health_database/staging_admin_login/effective_staging_target/catalog_and_empty_chat/logout verdes; webhookPosts=0 y steps vacíos. NO acreditar mensajes WhatsApp enviados ni modelo real por este preflight.

Próximo: añadir y verificar límite de intentos de inferencia efectiva para ensayo real antes de execute=true; runner actual tiene 11 pasos y no impone tope al modelo del backend. Saldo compartido nueve; no gastar sin límite ni activar workflow de 11 pasos asumiendo que todos serán deterministas. Mantener un único destinatario, no confirmar pedidos y detener con actividad concurrente. Audio permanece whisper-1, gpt-4o-mini-transcribe es candidato documentado, no migrado. Faltan archivos originales y transcripción esperada para comparar calidad; no contar transcripciones simuladas como reconocimiento real. Cero API pagada esta tanda. Main intacta.


## API real y revisión de cobertura PDF — 2026-10-11

Runner full-router ejecutado con key/config privada de staging; modelo gpt-4.1-2025-04-14, Meta/órdenes/persistencia aislados. Primer intento max3 paró por límite antes de respuesta final, consulta y carrito correctos pero agent_error de presupuesto: NO es rechazo de comprensión. Informe /tmp/ppp-api-capped-report.json, log /tmp/ppp-current-model-api.log. Repetición focalizada del mismo recorrido max4: context-question-then-other-purchase aprobada con cuatro respuestas exitosas, consulta mojarra no compra, elección posterior añade una trucha asada. Log /tmp/ppp-current-model-api-completion.log y tmp/whatsapp-live-router-report.json ignorado. Los otros dos casos seleccionados inicialmente NO se ejecutaron por stop-on-failure; no acreditarlos. Siete intentos nuevos, total18/20 y DOS restantes. Local ledger previo8/12 estaba desactualizado; sincronizado desde registro autoritativo. Temporal privado de credenciales eliminado.

Índice PDF:24 patrones de desarrollo ejercitados y2 pending_not_executed. Distribución completa de varios atributos/papa por línea y ráfaga pedido/dirección/barrio aún requieren cierre; los tests recientes cubren partes, no sirven para marcar todo patrón aprobado. Audio sigue whisper-1; faltan originales para comparación de percepción. Esta ronda no envió WhatsApps reales ni confirma órdenes; API real no equivale a Meta real. No fijar coste USD: proveedor reporta tokens, informe no tiene tarifa calculada. Mantener saldo2 como límite compartido, no reutilizar cifras históricas de nueve/doce. Main intacta.


## Autorización adicional y API real — 2026-10-11

El usuario autorizó 20 llamadas adicionales, sumadas a dos restantes: límite acumulado40, saldo inicial22; no se reinicia usado18. Tanda max10 intentos, una repetición y stop-on-failure: cinco conversaciones aprobadas con full-router/modelo/config de staging. Dos usan API (arroz con harto ají + consulta de jugos, ejecutivo con sus opciones + sopa adicional); tres deterministas (sopa/cantidad tras consulta de bebidas, pollo/cantidad tras precio, aclaración de arepas+nota). No acreditar esas tres como inferencia real. Siete respuestas API exitosas, sin errores; total25/40, QUINCE disponibles. Modelo gpt-4.1-2025-04-14. Log /tmp/ppp-api-additional-round.log; reporte ignorado tmp/whatsapp-live-router-report.json; resumen sanitizado outputs/PPP-api-ronda-adicional.json en chat. Ledger primario/local y AGENTS actualizados.

Nuevo escenario versionado pdf-executive-options-extra-after-interruption: dos ejecutivos, mondongo/frito/pierna pernil/papa salada, limonada y sopa adicional independiente. Runner real aprobó cantidades/atributos/notas/respuesta. Los nombres son fixtures y oráculos del catálogo de ensayo, no excepción productiva. Meta/órdenes/persistencia aisladas, no se enviaron mensajes reales. No se hicieron cambios de implementación ni se reconstruyó API; no repetir full gratuito por rutina. Temporal de credenciales eliminado. Main no cambió. Audio sigue pendiente de originales. No atribuir cobertura al PDF completo ni presupuestos históricos como vigentes.

## Plan comercial documentado

Leer docs/WHATSAPP-COMMERCIAL-READINESS-PLAN.md: evidencia actual, puertas de piloto/venta, fuentes primarias AWS/Google/Intercom y tareas por responsable. Metas100conversaciones/95%conresultado/p95texto15s son propuestas, no mediciones ni estándares de marcas. Referencia vigente a modelo/presupuesto/commits debe contrastarse antes de usar. La siguiente acción es cerrar patrones PDF pendientes gratis, conjunto reservado focalizado con API y canal real con tope efectivo. No gastar llamadas para documentar.


## Cierre de patrones PDF en backend — 2026-10-11

Cinco nuevas regresiones: reparto de ejecutivo con presa/sopa y notas papa salada/sin ensalada por unidad; otro catálogo con base/sopa/notas diferentes; rechazo atómico de suma incompatible; pedido/dirección/barrio en handleIncoming concurrente con una respuesta en PPP/otro menú. Un fallo inicial: nota papa salada perdida (/tmp/ppp-pdf-pending-baseline.log). Se extrae nota por cada parte del reparto, filtra texto ya representado por atributos y conserva nota compartida previa. No autoriza sustituciones comerciales: son solicitudes de cocina.

Seis focalizadas (cinco nuevas+control) aprobadas /tmp/ppp-pdf-distribution-targets.log; TS /tmp/ppp-pdf-distribution-tsc.log aprobado; full65suites/1.824pruebas,210,518s /tmp/ppp-pdf-distribution-full.log. Índice PDF ahora26patrones ejercitados y0 sin ejecución de backend, con verification_pending separado para Meta/percepción/inferencia. No acredita todos los chats del PDF ni todas variaciones. Simulado primero, cero API; quedan15 de40 autorizadas. Main intacta.

Desplegado f35636c1, verificado 2026-10-11 20:48 Bogotá: running/healthy, candidata/activa iguales sha256:9108be6d066641d51e9d539a79a894053891996f840b302e9e0ca1ac42fdd5a9, health OK/DB connected/CLOSED. Evidencia /tmp/ppp-pdf-distribution-deploy-verified.log.


## Revisión de cambios locales y pedidos largos — 2026-10-12

Base eb58f33b. Revisados/preservados cambios locales en catálogo, glosario, clasificación, notas, menús nombrados y numerosas regresiones de ejecutivos. Incluye cinco casos reservados preparados previamente pero no publicados y cinco nuevos pedidos completos largos: PPP tres productos/notas/cocción/dirección/pago con ;, saltos o y; menú ficticio tres productos, seis unidades, base y notas independientes. Baseline de largos cinco fallos, /tmp/ppp-long-orders-baseline.log. Correcciones: separadores explícitos conservan cantidad/texto, no cortan por decimal; cantidades por vocabulario de catálogo; cocción y nota coexisten; no absorber extra en atributos ni fusionar dos menús; límites de palabras de pago aceptan puntuación; seleccionar candidato de bebida válido antes de priorizarlo.

Full intermedio detectó12regresiones (5suites) /tmp/ppp-long-orders-full.log. Corregidas con casos originales intactos; intento full-final durante cambios no acredita aprobación. Debug comparó catálogo HEAD/current con transpile-only por conflicto nominal TS, luego se eliminó fuente temporal y typecheck aprobado. Validación final estable: TypeScript /tmp/ppp-long-orders-tsc-approved.log aprobado;65suites/1.888pruebas,126,04s /tmp/ppp-long-orders-full-approved.log. Focalizadas de pago/largos43 y últimas de marca/largos10 aprobadas. No repetir matrices DB: no hubo cambios de persistencia.

Runner con configuración real y agente habilitado para long-complete-order-three-products aceptó carrito/notas/dirección/pago/respuesta,0solicitudes de OpenAI; exit1 porque exige successfulResponses>0. No es fallo comercial ni inferencia real. /tmp/ppp-long-orders-api.log. Saldo25usadas/15restantes de40, no sumar acceptedConversations de API. Credenciales temporales eliminadas. Meta/persistencia simulados, sin WhatsApps enviados. Índice de reservados actualizado: dos consumidos en desarrollo, una comprobación parcial de foto con carrito sembrado, tres patrones aún reservados. No afirmar recorrido original de foto aprobado ni todos los casos PDF/holdout.

Diferencia entre asistente y bot: interpretar texto y ejecutar una mutación exacta son responsabilidades distintas. Esta tanda mostró fallos en la capa de segmentación/alcance/persistencia del pedido aunque algunos productos se reconocían. No atribuirlos automáticamente a modelo inferior ni prometer comprensión perfecta. Main no recibe la tanda.


## Caso exacto ejecutivo Plazuela — 2026-10-12

Regresión con el texto original del usuario (eejcutivo, enslada, ala pechuga, mondongo, papa salada y dirección). Aprobada: una sola línea de ejecutivo frito, cantidad1, Presa Ala, pechuga, Sopa Mondongo, notas sin ensalada/papa salada y dirección conservada. Prueba focalizada1 aprobada /tmp/ppp-exact-executive-plazuela.log, añadida después del full estable1.888; no afirmar full1.889. Backend simulado, cero llamadas pagadas, sin Meta. Implementación ya incluida en8c61b17c.

Despliegue staging verificado 2026-10-12 11:31 Bogotá: checkout3f2862e, API running/healthy, candidata/activa iguales sha256:b19ad6786cf37dac2a8a3b4435aa62c6c149beafd0de58c963568b1b75ddd2f5, endpoint health ok/DB connected/CLOSED. Evidencia /tmp/ppp-long-orders-deploy-verified.log. Main/producción sin cambios.


## Generalización por catálogo — 2026-10-12

Base55836de3. Quince regresiones nuevas con tres menús ficticios (vegetariano, marino, oriental): componentes incluidos/dirección, adicional explícito, precio sin compra, corrección conservando cantidad/notas, dos líneas posibles piden aclaración sin mutación. Un fallo nuevo "Mejor con Ternera": no era reconocido como cambio de atributo; se acepta marcador general "mejor", con opción validada por catálogo y objetivo inequívoco. No se codifican Ternera/IDs/nombres de fixtures. Focalizadas23 aprobadas, TS aprobado; full65suites/1.904pruebas126,524s /tmp/ppp-catalog-generalization-full.log. Cero API/Meta,25 usadas/15 restantes. Leer siguiente tanda en docs/whatsapp-next-batches.md: los menús nombrados no acreditan generalización universal, falta probar compuestos sin esos tokens y contrato de inclusión/precios/permisos. Main no recibe cambios.

Desplegado staging f9ed5de4, verificado2026-10-12 11:39 Bogotá: API running/healthy, imagen candidata=activa sha256:f1b267688b1480e1eececce5a241176c8aa4446a66abc7535de5e877e079023e, health ok/DB connected/CLOSED. Primer chequeo durante arranque retornó starting/curl56; segundo sano. Evidencia /tmp/ppp-catalog-generalization-deploy-verified.log. Producción intacta.


## Compuestos sin menú nombrado — 2026-10-12

Baseb95853ac. Veintiuna regresiones nuevas en hamburguesa artesanal, pizza campestre y bowl tropical, con opciones de queso/masa/base y SKU independiente que colisiona con la opción. Comprueban componentes incluidos, extra explícito, pedidos completos con tres separadores/dirección/transferencia, corrección seguida de precio sin mutación y aclaración seguida de elección del segundo. Dieciocho casos iniciales aprobados; tres aclaraciones fallaron. Identidades anidadas (producto y producto Premium) seguían ambiguas después de elegir. Se prioriza identidad explícita más larga solo si las otras identidades coincidentes están contenidas en ella; nombres diferentes o iguales siguen ambiguos. Se elimina nota exacta "con <opción>" si el atributo ya la representa, conservando notas mixtas/cantidad/otros platos. Nada de IDs/nombres/precios ficticios en reglas.

Focalizadas44 aprobadas /tmp/ppp-compound-catalog-approved.log; TypeScript aprobado /tmp/ppp-compound-catalog-tsc.log; full65suites/1.925pruebas126,661s /tmp/ppp-compound-catalog-full.log aprobado. Cero OpenAI/Meta/órdenes externas; saldo25usadas/15restantes. No afirmar universalidad, permisos de sustitución ni extras tarifados que el contrato no modele. Siguiente tanda: opciones fuera del catálogo, preguntas condicionales sin compra, precio de cambios, cambios durante checkout y alcance cuando se nombran varios platos explícitamente.

Control adicional antes del cierre: tres casos con ambos nombres explícitos (producto y producto Premium) detectaron compra adicional incorrecta, /tmp/ppp-compound-multiple-identity.log. Prioridad al nombre más específico solo si, después de quitarlo del mensaje, no queda otra identidad explícita. Los24 casos nuevos +23controles pasan (47focalizadas) /tmp/ppp-compound-catalog-final-approved.log. Se repite full/TS por cambio nuevo; el full anterior1.925 no acredita el estado final. El primer deploy2af2dd8b terminó antes del control; preparar nueva versión tras aprobación final.

Full final intermedio detectó2regresiones (64suites/1.926pruebasaprobadas): identidades con prefijo numérico "1 Pollo Frito" no se eliminaban al leer "pollo frito". Corregido quitando prefijos de cantidad de identidad, de forma general.49focalizadas aprobadas /tmp/ppp-compound-catalog-recovery.log; volver a acreditar con full estable y TS. No usar /tmp/ppp-compound-catalog-full-final.log como aprobación.

Aprobación final estable:65suites/1.928pruebas126,195s /tmp/ppp-compound-catalog-full-stable.log; TypeScript aprobado /tmp/ppp-compound-catalog-tsc-stable.log.24 nuevas en esta tanda. Cero llamadas pagadas, presupuesto intacto.

Despliegue final staging a46e3cb8 verificado2026-10-12 11:54 Bogotá: running/healthy, activa=candidata sha256:5ddcff93a43832a4c7e0b44ded8c3ab6c0130cf1edaeacb4858155dcbd904b2e; health ok/DB connected/CLOSED. /tmp/ppp-compound-catalog-deploy-verified.log. Main/producción intactas; sin cambios de modelo/presupuesto.


## Puerta previa al piloto — consultas opciones y cierre (2026-10-12)

Base251c1182.30casos nuevos en hamburguesa/pizza/bowl: preguntas de posibilidad, precio de cambio, opción inexistente con opciones válidas en respuesta, cantidades1–3 con dirección numérica, consulta condicional en confirmación, cambio de opción/dirección/cantidad durante cierre. Baseline18casos tuvo9fallos: consultas modificaban atributos; quantity source incorporaba dirección y terminabaqty10. Corrección: preguntas de posibilidad y recargo se responden antes de mutaciones; cantidades de add se calculan sobre productText sin dirección/pago. Ampliación exigió opciones útiles ante inexistente y detectó3respuestas genéricas incorrectas: se muestran opciones del atributo nombrado, sin mutar pedido. No se añaden excepciones por nombre/ID.

Focalizadas76 aprobadas /tmp/ppp-pilot-gate-approved.log. Full65suites/1.958pruebas125,785s aprobado /tmp/ppp-pilot-gate-full.log; TypeScript aprobado /tmp/ppp-pilot-gate-tsc.log. Meta/modelo/persistencia aislados; cero solicitudes pagadas;25usadas/15restantes. Contrato actual de atributos no representa recargos ni permisos de sustitución: esta tanda cubre abstención/derivación, no cobro de extras ni confirma gratuidad. Pregunta pura "se puede con X" deja pedido igual; solicitud explícita de cambio sigue actualizando. No crear una oferta de confirmación "sí" si el flujo no guarda esa oferta; se pide indicar plato/opción para aplicar.

Despliegue staging50556d2d verificado2026-10-12 12:09 Bogotá: running/healthy, activa=candidata sha256:9c81496578d13de04a2dd9ecd606aeef145101f7ad95c684b7a46db273f71857; health ok/DB connected/CLOSED. Evidencia /tmp/ppp-pilot-gate-deploy-verified.log. Main intacta. Próximo paso: inferencia real/canal con límite efectivo; no reiniciar saldo15.


## Nueva evidencia crítica — chat Banderas12/10

Leer docs/WHATSAPP-BANDERAS-DIAGNOSIS.md. Cinco escenarios de diagnóstico fallaron en staging actual: cortesía separada como producto, consulta de medio pollo crea compra pendiente, reclamo de precio duplica cuarto, corrección capturada como nombre, referencia de dirección no se actualiza. Segundo diagnóstico comprueba carrito inicialid6qty1 y usa fixture15.000 (no confirma precio productivo). /tmp/ppp-banderas-diagnosis-correct-seed.log. Suite temporal eliminada; no se cambió código ni se ejecutó full, Meta o API. Saldo15 intacto. Reabrir puerta previa al piloto: estas fallas no están resueltas por las1.958pruebas anteriores. Siguiente tanda: regresiones con recorrido completo y catálogos sintéticos, luego fixes generales/full/TS.


## Chat de Main y caminos encadenados — 12/10

El usuario confirmó origen Main del transcript Banderas. Se prueban sus patrones en staging, no se afirma paridad entre entornos.31regresiones (PPP/bowl/pizza y conversación completa). Ver docs/WHATSAPP-BANDERAS-DIAGNOSIS.md. Baseline22fallos/28; focalizadas finales31 aprobadas. La secuencia completa detectó oferta vieja aceptada como compra tras comparar barato, fragmento de preparación que agregaba pollo entero y referencia que no cambiaba tras salir de la aclaración. Correcciones por catálogo/intención/estado. No fijar precios13/16ni ubicación privada. Full/TS pendientes al escribir; log /tmp/ppp-banderas-full.log. Cero llamadas pagadas, saldo15. Staging únicamente; mantener Main intacta.

Control del full intermedio:3 regresiones en consulta condicional de recargo (65suites,1.986aprobadas/3fallidas); se separó precio de modificación de precio/disputa del producto.61focalizadas finales pasan /tmp/ppp-banderas-targets-final.log. No cambiar expectativas para ocultar errores; /tmp/ppp-banderas-full.log no es aprobación final. Full estable en ejecución /tmp/ppp-banderas-full-approved.log.


## Integración local, voz y pedidos grandes — 12/10

Baseac27ae4e, staging publicado anterior50556d2d. Se preservó una tanda local amplia de catálogo, jugos, tamaños, reparto por unidad, notas/negaciones y corpus PDF, que aún no estaba confirmada en Git. El full histórico1.989 no acreditaba esos cambios posteriores. Se auditaron y corrigieron riesgos: aviso de cobertura ahora por waId con consumo/limpieza; confirmación de acompañamiento valida firma del carrito, precio/disponibilidad actuales, conserva notas y utiliza tryAddProductToCart/límites/atributos (si faltan no muta). Evita ignorar una porción existente y agrega una nueva unidad confirmada.

Nueva evidencia del usuario: chat Main solo guardó gaseosa1.5L/Pepsi y dirección al pedir combo alitas. No hay audio original; no atribuir el fallo a transcriptor vs parser sin datos. Se añadieron seis recorridos texto/audio simulado de alitas, dos de aislamiento, cuatro de acompañamiento, seis de pedido grande con cinco platos/quince unidades/tres separadores/cambio posterior, un recorrido descarga-transcripción-pedido y dos de presentación por catálogo. API de audio añade cinco pruebas de vocabulario/modelo/tamaño. Baselines detectaron pérdida de notas, confirmaciones viejas, extra inválido/ignorado, bebida incluida cobrada aparte y ají perdido en pedido grande. Focalizadas28aprobadas /tmp/ppp-audio-round-targets.log y recorridovoz aprobado; caso doble presentación muestra lista (no compra), se valida esa lista y ambos nombres en vez de exigir redacción específica.

Se eliminó nueva equivalencia global arroz chino con pollo→medio: selección solo si la carta deja un compuesto único; con varias presentaciones requiere elección. Audio conserva whisper-1 por defecto. WHATSAPP_AUDIO_MODEL permite candidato explícito, sin fallback/reintento silencioso. Prompt de ortografía desde nombres/opciones del catálogo, prioridad plato en foco, máximo200bytesUTF8; no precios, teléfono, historial ni cantidades predeterminadas. RespuestaJSON y límite25MB. Modelos/API reales no ejecutados, saldo25usadas/15restantes. Fuente oficial: https://developers.openai.com/api/docs/guides/speech-to-text (prompts limitados224tokens de Whisper y evaluación contra originales). No afirmar calidad acústica aprobada. Full/TS en ejecución /tmp/ppp-staging-audio-bulk-full.log y /tmp/ppp-staging-audio-bulk-tsc.log. Snapshot de fuentes /tmp/ppp-audio-validation-source.json; comprobar que no cambiaron durante el full antes de acreditar.

Recuperación del full inicial (7suites/57fallos;2.057aprobadas): mayoría de fallos eran harness Object.create sin inicializar nuevo Map de cobertura; se inicializó en cuatro fixtures, sin cambiar expectativas ni código productivo para ocultar fallos. Fallos comerciales: preparación elegida automáticamente; adición de1unidad ignorada por sourceText vacío considerado restatement; entero eliminado por comparación con medio; alternativas de bebida demasiado filtradas. Se exigen elecciones de preparación, sourceText no vacío para restatement, porciones distintas no se absorben y alternativas ordenadas conservan otros tamaños.173focalizadas aprobadas /tmp/ppp-audio-round-regression-recovery.log. Full estable final/TS en ejecución /tmp/ppp-staging-audio-bulk-full-final.log y /tmp/ppp-staging-audio-bulk-tsc-final.log; snapshot renovado, no modificar fuente durante validación.


### Seguimiento de validación — resumen de audio alitas (12/10)
El usuario confirmó que el resumen de Main conservó únicamente Gaseosa 1.5L/Pepsi y dirección Pío 12. No aportó audio ni transcripción de proveedor: no atribuir todavía el fallo a Whisper o al router. Casos reconstruidos prueban principal + bebida incluida, bebida de distinto tamaño, dirección y mensaje largo; los mocks no acreditan reconocimiento acústico.
Segundo full de esta tanda: 61/65 suites y 2106/2120 pruebas aprobadas; 14 fallos. Evidencia /tmp/ppp-staging-audio-bulk-full-final.log. No desplegar ni declarar aprobación. Se retiró la regla demasiado amplia de atributos obligatorios (preparación/selección/etc.), se conserva la elección de Pollo pendiente cuando el resolvedor no la completa y se pasa texto de aclaración al alta desde lista para evitar duplicados. TypeScript de esta revisión aprobado (/tmp/ppp-round-tsc4.log); suite focalizada en ejecución /tmp/ppp-round-recovery4.log. Los archivos locales siguen sin commit. Main y despliegue intactos; cero llamadas pagadas en esta ronda.


### San Esteban: evidencia específica del usuario (12/10 18:29)
El usuario reporta solo aviso fuera de cobertura para sopa de menudencias + Plazuelas de San Esteban. Se reejecutó la regresión exacta existente con routing simulado: 3/3 aprobadas (agente activado/desactivado y otro catálogo), /tmp/ppp-san-esteban-coverage-check.log. En código local la sopa queda qty1, dirección conservada, una respuesta confirma el plato y comunica cobertura, no abre pago. Esto NO verifica los 6.7km reales ni está acreditado desplegado. Geocodificador acepta primer resultado cercano sin contrastar nombre del conjunto contra consulta; investigar ubicación elegida antes de afirmar que está fuera de cobertura. No cambiar tarifas/radio por este ejemplo ni hardcodear San Esteban.
Revisión posterior de preparaciones: 20 focalizadas aprobadas /tmp/ppp-round-recovery5.log; TypeScript aprobado /tmp/ppp-round-tsc5.log. Full final en ejecución /tmp/ppp-round-full5.log (sesión58649). No atribuir aprobación completa hasta terminar; no editar código durante el run. Sin commit/deploy todavía.


### Corrección de alcance: San Esteban sí tiene cobertura
El usuario confirmó que la dirección sí está cubierta. El fallo es geocodificación, no radio comercial. Se añadió validación general de nombres de destinos (conjunto/hotel/etc.) contra el resultado y se distinguen coincidencias ambiguas de fuera de cobertura. Ante ambigüedad se bloquea cotización/checkout, conserva carrito y pide ubicación/calle-número; no se aplica tarifa fija como si estuviera ubicado. Sin IDs ni coordenadas de San Esteban codificados. 49 controles aprobados /tmp/ppp-landmark-combined.log, incluidos 5 de routing y conservación de sopa, y controles de aclaraciones. TypeScript final aprobado /tmp/ppp-landmark-tsc-final.log. Full completo en ejecución /tmp/ppp-landmark-full-final.log sesión56984. No desplegado ni publicado. Dirección exacta solicitada para verificar punto real. Cero llamadas externas/API en esta tanda.

Verificación real de Maps, lectura sin cambios de entorno: usuario aporta «cr 78 b 6 b 20». Origen efectivo de staging leído de ppp_whatsapp_settings:4.6323019,-74.1471957, máx5.50km. Geocode actual del nombre devuelve Plazuelas de San Esteban 4.6334187,-74.1444932 con partial_match=true; ruta driving1.952km. Geocode de Carrera78B#6B-20 devuelve Cra.78B#6 4.6256079,-74.1474138; ruta1.874km (fin Cra.78B#6-16). Ambos dentro de cobertura; no confirmar exactitud de numeración pues Maps normalizó distinto. No se reconstruyó el destino usado a las18:29 ni se consultó origen efectivo de Main: no afirmar causa específica del6.7km más allá de evidencia de mala ubicación/config posible. Se hicieron4 consultas Maps (2geocode/2routes), cero llamadas de modelo; presupuesto modelos25/40 intacto. No se guardaron claves ni cambiaron configuraciones.

Validación estable final12/10:66suites/2120pruebas aprobadas en378.783s /tmp/ppp-landmark-full-final.log; TypeScript aprobado /tmp/ppp-landmark-tsc-final.log. Incluye las mejoras locales previas preservadas, tandas de pedidos largos/audio, Banderas y geocodificación incierta. Cero solicitudes de modelo;4consultas Maps de diagnóstico. No atribuir mejora acústica medida sin audios originales.

Desplegado y verificado staging59064dc3 el12/10/2026 21:16 Bogotá:running/healthy, imagen activa=candidata sha256:bd2640ddfc5baa85eca5b81953d5c97ee26ceef31cc0dc026770bb122437366a; healthok,DBconnected,circuitCLOSED. /tmp/ppp-landmark-deploy-verified.log. Main/producción no modificadas. Próximo: repro real de conversación con ubicación dudosa, corrección a calle/número o pin y mantenimiento del carrito; evaluar audio original antes de medir calidad acústica.


## Continuidad de platos en varios mensajes — verificación 12/10
Base29421277; runtime desplegado59064dc3. Chat exacto ejecutivo→mondongo/frito/pierna-pernil/papa-salada→limonada aprobado con mensajes separados y agrupados. Resultado: una línea Ejecutivo Con Pollo Frito qty1, Sopa Mondongo, Presa Pierna Pernil, Bebida Limonada, nota papa salada. No pollo entero ni bebida independiente. Otros controles cubren dos menús, adicionales explícitos, consultas/correcciones y pausas5/60segundos.
Ocho pruebas nuevas: PPP y menú vegetariano ficticio × pausas0/900/4000/60000ms antes de opciones, luego reenvío tardío de ID ya procesado. Verifican carrito, atributos, notas y ausencia de nueva salida ante replay. Primer intento falló8/8 solo en replay porque el harness genérico siempre reclamaba IDs; la fixture local ahora reproduce el contrato UNIQUE de persistencia (no se alteró runtime ni se relajaron expectativas). Esto no acredita entrega real de Meta ni persistencia de varias instancias.
Focalizadas35/35 aprobadas (8nuevas,27existentes), /tmp/ppp-executive-bursts-approved.log; cero llamadas externas ni pagadas. Full anterior66suites/2120 sigue siendo evidencia del runtime, no contar los8nuevos como full ejecutado. Solo tests/docs modificados: no se requiere reconstrucción del servidor.

Siguientes tandas, con criterios de aceptación:
- Corrección antes de completar: «dos ejecutivos»→«fritos con mondongo»→«mejor uno broaster»→bebidas. Dos unidades totales; atributos asociados por línea; preguntar si el reparto no es inequívoco.
- Incluido frente a adicional: «la limonada del menú» frente a «otra limonada aparte» y «dos limonadas para los dos menús». Cantidad correcta sin convertir atributos en compras adicionales.
- Cancelación y cambio de intención: «olvida ese ejecutivo»→otro plato; «solo quería saber qué trae». Cancelar únicamente la compra pendiente; una consulta nunca añade productos.
- Contexto con interrupciones: precio/horario entre presa y bebida, cambio de dirección durante elección. Responder la consulta sin perder cantidad/opciones pendientes ni capturar respuestas como nombre/dirección.
- Referencias ambiguas con varias líneas: «el otro sin ensalada», «los dos con esa sopa», «ese no». Resolver cuando el antecedente es único; de otro modo aclarar sin modificar carrito.
- Ráfagas mixtas: audio→texto corrigiendo transcripción→dirección, o foto→«son dos»→nota. Preservar plato principal y modificaciones; separar calidad acústica/visual de interpretación del texto.
- Repetición de texto con distinto ID: distinguir recordatorio de «otro igual»; deduplicación de webhook no equivale a suprimir nuevas compras legítimas.
Cada tanda se ejecutará con catálogos PPP y sintéticos, comparando carrito/estado/respuesta tras cada mensaje. Inferencia real solo focalizada sobre fallos sin explicar, con saldo15 y registro de cada intento.


## Tanda de básicos y extras — 12/10, basef1a4498e
16pruebas nuevas: ocho recorridos de menú completado (PPP y vegetariano ficticio: precio sin mutación, bebida adicional independiente, cantidad del menú sin alterar extra, reinicio de carrito/pendientes) y ocho plurales con variantes gramaticales y agente simulado activo/inactivo. Baseline4fallos detectó «dos almuerzos ejecutivos» convertido en broaster/ajiaco por falta de normalización plural. Ampliación detectó2fallos adicionales con «Porfa dos…», que compraba preparación por defecto. Corrección general de frase plural y cortesía inicial en glosario; no IDs ni precios codificados. Los16casos nuevos y16controles existentes pasan:32/32 /tmp/ppp-meal-basics-extra-final.log. Full yTypeScript en ejecución /tmp/ppp-basic-extras-full.log y/tmp/ppp-basic-extras-tsc.log. Cero llamadas pagadas/Meta/Maps; saldo modelos15 intacto. No publicar hasta full aprobado.

Plan por riesgo para las próximas rondas (las familias existentes no equivalen a todas las variantes):
1. Repartos:3menús,2con una sopa y1con otra;2presas diferentes; bebida común; corregir solo uno. Verificar suma de cantidades y atributos por unidad, no únicamente número de líneas.
2. Extras/reemplazos:incluido,adicional,sin bebida,cambiar por producto de otro precio,extra agotado y rechazo del recargo. Sin precio/permisos confirmados se deriva o aclara; no inventar sustitución gratuita.
3. Negación/desistimiento:«ese no»,«solo preguntaba»,cancelar antes/después de aclaración,reiniciar y después «lo mismo». No recuperar una compra cancelada del historial ni crear pedido confirmado.
4. Interrupciones básicas:precio,qué incluye,horarios,disponibilidad; luego retomar atributo pendiente. Consulta no muta carrito y no se captura como nombre/dirección/pago.
5. Correcciones en cierre:cantidad/producto/nota/dirección durante selección de pago; pregunta de precio no añade;«no» no obliga a un bucle de pago. Preservar correcciones y volver a presentar total válido.
6. Entrada mixta:nota antes del producto,mensaje largo,ráfaga con pausas,typos,emoji,códigos con direcciones numéricas,voz→corrección por texto,foto→cantidad. Calidad de reconocimiento exige originales; transcripciones simuladas prueban interpretación.
7. Robustez semántica:producto inexistente,opción inexistente,varias referencias posibles,promesas de rendimiento/abono sin información,catálogo vacío/cambio de disponibilidad. Aclaración útil y sin productos/precios inventados.
8. Generalización:repetir casos principales con menús sin pollo/ejecutivo,catálogos cambiados e IDs diferentes. Portar fixtures/contratos para Kamppo; aislamiento multitenant requiere verificación propia.
Puerta de piloto:ningún defecto crítico conocido del alcance, prueba focalizada con modelo/canal real, atención humana comprobada y catálogo vigente. No perseguir infinitas variantes gratuitas como sustituto de medir conversaciones reales. Mantener límite de15solicitudes restantes, seleccionar recorridos representativos y detener ante fallo para diagnosticar gratis.

Full inicial de básicos/extras:65/66suites y2143/2144pruebas; una regresión en menú ficticio «Por favor me condes…» /tmp/ppp-basic-extras-full.log. Se acotó retirada de cortesía a frases que empiezan directamente por cantidad; no quitarla indiscriminadamente antes de verbos.34focalizadas aprobadas (16nuevas,18controles) /tmp/ppp-basic-extras-controls-final.log. Full final/TypeScript en ejecución /tmp/ppp-basic-extras-full-final.log /tmp/ppp-basic-extras-tsc-final.log. Mantener código sin editar durante run.

Aprobación estable final:66suites/2144pruebas en172.88s /tmp/ppp-basic-extras-full-final.log; TypeScript aprobado /tmp/ppp-basic-extras-tsc-final.log.16casos nuevos de básicos/plurales; también acredita8nuevos de ráfagas de la tanda anterior. Cero API/Meta/Maps, presupuesto modelos25/40 intacto. Publicar únicamente staging.

Despliegue de esta tanda verificado12/10/2026 21:39 Bogotá:staging1433958e running/healthy; imagen activa=candidata sha256:8a6a10ebb57ec00d87e85999c9af6e93cf2ebe926db7f794fc8ac0166ecbc7e1; healthok,DBconnected,circuitCLOSED. /tmp/ppp-basic-extras-deploy-verified.log. Main intacta. Siguiente bloque prioritario:reparto de opciones por unidad y cancelación/consulta durante aclaraciones; luego inferencia real focalizada sin reiniciar saldo15.


## Ampliación de cortesía y abandono + interrupciones — 12/10, basefaebdb9e
44casos nuevos:36de cortesía/chat equivocado (16recorridos de abandono PPP+otra carta,12saludos con compra inexistente en ambas cartas,8negativos de corrección/consulta/dirección);8de precio/composición/horario y cancelación antes de compra nueva PPP+menú oriental ficticio. Primer baseline20/43fallaron:6formas de abandono por carta,2saludos por carta y4falsos positivos de «pensé que era…»/destino Otro Chat. Corrección: señales explícitas de destinatario equivocado; «pensé/creí» solo no implica chat equivocado;normalización de cortesía con verbo y typo de saludo.43focalizadas aprobaron.
Segunda tanda baseline6fallos:2reales pérdida de pendingMatch tras composición/horario,4por fixture vegetariano que ya completaba atributos por defecto (no era selección pendiente). Se reemplazó la fixture por menú oriental con elección real Pollo/Horno/Plancha, manteniendo el oráculo. Se responde composición antes de abandonar selección y se reconoce consulta «a qué hora cierran/abren/atienden».51/51focalizadas aprobadas /tmp/ppp-courtesy-interruptions-recovery.log. Full/TS en ejecución /tmp/ppp-courtesy-interruptions-full.log /tmp/ppp-courtesy-interruptions-tsc.log; no mutar código durante run.
Se agregan3recorridos versionados para runner aislado con modelo real:compra tras chat equivocado,ejecutivo con consulta de composición y reclamo de precio tipo«pensaba que era más barato». No ejecutados todavía; evitar atribuirles aprobación por definición. Presupuesto antes de esta ronda25usadas/15restantes.


## Revisión de nuevos cambios locales — 13/10
Basefaebdb9e. Además de la familia de cortesía/interrupciones, aparecieron cambios locales no publicados en catálogo, orquestador, variantes distribuidas y pruebas:recogida de tercero,cierre/precio/combos,referencias y fotos,recargo histórico,reparto de bebidas,paraNpersonas,textura del plato,corrección de precio/horario/pago,corrección de una línea,preguntas de servicio,citas del bot,básicos de cartas diferentes y seguimiento después de registrar. Se preservaron y revisaron sin atribuirlos todos a esta tanda.
Full conjunto inicial:65/66suites,2327/2328pruebas; único fallo recogida dejaba building_cart donde el flujo previo avanzaba a pago. /tmp/ppp-new-local-combined-full.log. Corrección de integración:opción de recogida reanuda checkout sin crear orden, conserva selecciones auténticamente pendientes y distingue una lista retenida después de alta exitosa (pendingMatch.selectionAdded, JSON sin migraciónSQL). Link activo no cambia entrega ni reemite pago; MP elegido sin link exige confirmación.3regresiones nuevas de límites transaccionales.121focalizadas aprobadas /tmp/ppp-pickup-integration-approved.log.
Ampliación previa de cortesía:corrección genérica respeta saltos de línea; agregó2negativos de corrección de teléfono. Interrupciones pasan con agente simulado activo/inactivo; opciones del catálogo que progresan una selección única se procesan antes de delegar una oración al modelo. No generalizar a mensajes multidish o direcciones.
Full/TS final en ejecución /tmp/ppp-new-local-combined-full-final.log /tmp/ppp-new-local-combined-tsc-final.log. Hashes /tmp/ppp-new-local-combined-snapshot-final.json; verificar que no cambiaron antes de acreditar. Rehearsal real limitado a6solicitudes, stop-on-failure, configuración privada de staging en memoria; Meta/persistencia/órdenes aisladas. Registroautoridad docs/whatsapp-model-budget.json; no usar saldo15histórico después de ejecutar. No desplegar antes de resultados finales.


Aprobación completa estable13/10:66suites/2331pruebas en433.264s /tmp/ppp-new-local-combined-full-final.log; fuentes sin cambios frente a snapshot final. Tras corregir únicamente propuesta vacía,64focalizadas aprobadas /tmp/ppp-unknown-proposal-targets-final.log y nuevo full66suites/2335pruebas en419.217s /tmp/ppp-current-stage-all-final.log; TypeScript aprobado /tmp/ppp-current-stage-tsc-final.log. Comparado con última versión publicada2144,191pruebas adicionales integradas; incluye cambios locales ajenos preservados y las tandas de esta sesión.
Verificación modelo real gpt-4.1-2025-04-14:4recorridos únicos aceptados (2con inferencia,2deterministas),10solicitudes API exitosas en total. Primera ronda max6 dejó una conversación incompleta por presupuesto aunque carrito/respuesta eran correctos; repetición focalizada max4 la completó, sin repetir recorrido ya aceptado. /tmp/ppp-courtesy-real-capped-report.json y/tmp/ppp-courtesy-model-completion-report.json. Meta/persistencia/órdenes aisladas. Prueba de modelo precede al ajuste de texto de propuesta vacía; no repetir llamadas por cambio de presentación.35usadas/5restantes, registro docs/whatsapp-model-budget.json yAGENTS actualizados; credenciales solo en memoria, scripts privados temporales eliminados.
Propuesta sin coincidencias ya no afirma varios platos ni pide confirmar «el resto» vacío; conserva confirmación útil cuando sí hay parte reconocida y conserva carrito preexistente.


## Continuación 13/10: desistimiento seguido de nueva intención

Base publicada y desplegada: 4eb1d109. Verificación 13/10 06:59 Bogotá: running/healthy, imagen activa=candidata sha256:8215f7ec73ca70d862f226fa4749ed1ea3d4065dd18b5e89b2c46575b74dda9d, health OK/DB connected/circuit CLOSED. Logs /tmp/ppp-conversation-integration-deploy.log y /tmp/ppp-conversation-integration-deploy-verified.log.

Nueva tanda local: 80 casos en PPP y carta ficticia. Mensaje único, ráfaga de dos y tres mensajes, con/sin carrito previo, cortesía y desistimiento seguidos de compra o consulta. Baseline inicial 24/24 fallaron: la disculpa descartaba también la compra nueva. Separación general por intención explícita y limpieza de pendientes abandonados conservando carrito válido. La ampliación detectó cuatro consultas de composición mal interpretadas y 36 precondiciones incorrectas del test: el modo agente simulado no genera la propuesta pendiente de productos ajenos; no atribuir esas 36 a inferencia real. Se mantiene el control de propuesta pendiente donde el router determinista realmente lo genera.

No se usaron llamadas pagadas; saldo compartido permanece 35/40 usadas, 5 restantes. Main intacta. Cambios de esta nueva tanda todavía requieren aprobación completa y despliegue; no confundir con la base 4eb1d109 desplegada.

Focalizadas: 76/80 aprobadas después de corregir la precondición; las cuatro restantes eran composición con “qué” acentuado (límite de palabra incorrecto). Corrección final: 8/8 consultas aprobadas, /tmp/ppp-apology-questions-final.log. Suite completa en curso: /tmp/ppp-apology-all-final.log. No editar fuentes mientras corre. La compra en modo agente se prueba con inferencia simulada; no acredita percepción real.

Aprobación final en dos ejecuciones: WhatsApp 47 suites / 2.317 pruebas (/tmp/ppp-apology-all-final.log) y las restantes 19 suites / 98 pruebas (/tmp/ppp-apology-remaining-final.log). Total 66 suites / 2.415 pruebas, todas aprobadas. TypeScript aprobado /tmp/ppp-apology-tsc-final.log. Fuentes verificadas sin cambios durante la suite contra /tmp/ppp-apology-source-snapshot.json. 80 regresiones nuevas frente a 4eb1d109. No se acreditan nuevas llamadas reales ni recepción desde teléfono.

Publicado y desplegado el código 6d19d88f, verificado 13/10/2026 08:49 Bogotá: running/healthy, imagen activa=candidata sha256:cc3d2a261f44bf7fb69a32a58d234ecc4a3bc7b498193d689cdfaa4678eb34e4, health OK/DB connected/circuit CLOSED. Logs /tmp/ppp-apology-deploy.log y /tmp/ppp-apology-deploy-verified.log. Main intacta. Próxima tanda: cambios de intención sin disculpa (“olvida lo anterior”, “mejor solo…”), consulta seguida de compra y corrección de pedido grande; reservar casos distintos para evaluación. No gastar saldo por rutina.


## Tanda 13/10: rechazo de propuesta seguido de compra y pedidos grandes

Base 3fc14067 (documental; código activo 6d19d88f). 24 casos nuevos reproducen que “Olvida lo anterior, mejor quiero…”, “Eso no, dame…” y “Déjalo, ahora quiero…” descartaban también la compra nueva. PPP y carta ficticia, mensaje único/ráfaga, carrito vacío o válido previo acreditado por aserción. Baseline 24/24 fallaron (/tmp/ppp-intent-switch-baseline.log); corrección 24/24 aprobados (/tmp/ppp-intent-switch-recovery.log).

La transición se limita a propuestas aún no aplicadas (pendingMultiOrder o pendingMatch sin selectionAdded). Conserva carrito y deja correcciones de productos ya añadidos en sus handlers existentes. No significa “vaciar todo el carrito” ni cambia el caso de atributos pendientes. No excepciones por SKU/nombre/precio de PPP.

Otros 12 casos: 8 platos principales y 6 sopas, coma/conjunción/salto de línea, agente simulado activo/inactivo, PPP y tacos/sopa ficticios. Productos+dirección saltan a cierre, cambio de dirección conserva 14 unidades y notas. Todos aprobados antes de modificar su ruta: /tmp/ppp-large-switch-baseline.log. Estas pruebas son modelos/Meta/persistencia simulados, no WhatsApp real. TypeScript aprobado /tmp/ppp-intent-switch-tsc.log. Cero nuevas llamadas pagadas; saldo 35/40 usado, 5 restantes.

Suite completa en curso: /tmp/ppp-intent-switch-all-final.log. Snapshot /tmp/ppp-intent-switch-source-snapshot.json; verificar al finalizar. No promover Main ni acreditar despliegue hasta terminar validación.

Resultado final: 66 suites / 2.451 pruebas aprobadas en una única ejecución completa, /tmp/ppp-intent-switch-all-final.log. TypeScript aprobado. Fuentes sin cambios durante validación contra snapshot. 36 regresiones nuevas. Saldo sin cambios. Main intacta.

Código 18887d8b publicado y desplegado, verificado 13/10/2026 09:08 Bogotá. Running/healthy; imagen activa=candidata sha256:93a31c11d859b7c6fb73d0b98989649b3d35eb21d3714bee78d87ce0c3b4ab92; health OK, DB connected, circuit CLOSED. Evidencia /tmp/ppp-intent-switch-deploy.log y /tmp/ppp-intent-switch-deploy-verified.log. Próxima tanda: selección ambigua rechazada seguida de otro plato, cantidad/nota por subconjunto en pedido grande y controles de consulta frente a compra. Pendientes de piloto reales permanecen; no acreditados por estos mocks.


## Tanda 13/10: ediciones focales de un pedido grande

Base 0e42a7e5, código activo 18887d8b. 20 pruebas nuevas con PPP y carta ficticia, pedido inicial de tres líneas/18 unidades verificado, agente simulado activo e inactivo al editar. Cantidad absoluta de un producto, exclusión directa nombrando plato, cambio de atributo nombrando plato en plural y subconjuntos sin producto que deben pedir aclaración. Se acredita conservación exacta de otras líneas y ausencia de líneas añadidas; no solo cantidades del primer match.

Baseline 6/20 fallaron (/tmp/ppp-bulk-scoped-baseline.log): cuatro no guardaban nota declarativa; dos agregaban un wrap con opción nueva en vez de editar los seis existentes. Corrección general: notas directas “los platos sin…” con artículo y exclusión, límites existentes de preguntas/compuestos intactos; reconocimiento contiguo del nombre con plurales s/es y consumo de esa identidad al resolver cambios de atributo. Sin excepciones por SKU/PPP. 20/20 aprobadas (/tmp/ppp-bulk-scoped-final-new.log). Diagnóstico intermedio de controles: 285 aprobadas, dos errores todavía abiertos antes de la corrección final (/tmp/ppp-bulk-scoped-final-targets.log); no acreditarlo como aprobación final.

Suite completa final en curso /tmp/ppp-bulk-scoped-all-final.log. Snapshot /tmp/ppp-bulk-scoped-source-snapshot.json. TypeScript final /tmp/ppp-bulk-scoped-tsc-final.log. No editar fuentes hasta terminar. Ninguna llamada real nueva: 35/40 usadas, 5 restantes. Main intacta. No equivale a transcripción real ni canal WhatsApp real.

Aprobación final: 66 suites / 2.471 pruebas aprobadas en una ejecución completa (/tmp/ppp-bulk-scoped-all-final.log); TypeScript aprobado (/tmp/ppp-bulk-scoped-tsc-final.log). Snapshot sin cambios durante el run. 20 nuevas regresiones, cero llamadas pagadas. Próxima tanda: exclusión por unidades nombrando producto (“dos de los ocho… y los demás normales”), repetición del cambio y conservación de notas previas. No acreditar división explícita de unidades con esta tanda: aquí el subconjunto sin plato pide aclaración y la edición focal afecta toda la línea nombrada.

Código 90c57dec publicado/desplegado en staging, verificado 13/10/2026 09:30 Bogotá: running/healthy, imagen activa=candidata sha256:83d7accad5798d56b8524d5d846edfa0118a131182526b6d66b13ae53ad6ec4c; health OK, DB connected, circuit CLOSED. Evidencia /tmp/ppp-bulk-scoped-deploy.log y /tmp/ppp-bulk-scoped-deploy-verified.log. La actualización documental posterior no requiere reconstrucción. Main intacta y presupuesto sin cambios.


## Tanda 13/10: subconjuntos en ocho menús distintos

Base a68a0caa, código activo90c57dec. 64 regresiones nuevas:40positivas/repetición en cocina japonesa (nigiri), italiana(pizza), árabe(shawarma), india(curry) y marina(ceviche), atributos Salsa/Masa/Pan/Picante/Acompañamiento y nombres cercanos del mismo menú. Dos formas: “dos de los ocho [plato] sin X y los demás normales” / “de los ocho [plato], dos sin X y los otros seis normales”. Agente simulado activo/inactivo; con/sin nota ya almacenada. Verificar total8, distribución2+6, atributos y demás platos; repetir no vuelve a dividir ni añade unidades, actualmente aclara si hay varias líneas del mismo producto.24negativas adicionales en cocina francesa(crepe), tailandesa(padthai) y peruana(lomo saltado):cantidad superior,total distinto,resto inconsistente,producto inexistente; debe conservar carrito y aclarar.

Baseline original40fallos /tmp/ppp-cuisines-subset-baseline.log:20fallaron en la división y20en la preparación inicial que mezclaba opción con “bien empacado”. No atribuir los40 al algoritmo de subconjunto. Preparación final usa pedido válido verificable; la nota previa se fija como estado almacenado independiente del mensaje de división. Incidencia de compra+opción+empaque queda pendiente para siguiente reproducción; no acreditarla resuelta.

Corrección:parsePartialNote acepta producto/cantidad total explícitos; selecciona una única línea por catálogo/corrección genérica, exige que el total y resto concuerden, conserva otras líneas y añade nota sin borrar la previa. Límite de200caracteres del editor de notas. Sigue limitado a building_cart y sin selección pendiente; no acreditar subconjuntos durante pago final con esta tanda. No nombres/IDs de platos en runtime.72focalizadas aprobadas(64nuevas+8controles), /tmp/ppp-cuisines-subset-final-targets.log.

Full en curso /tmp/ppp-cuisines-subset-all-final.log; snapshot /tmp/ppp-cuisines-subset-source-snapshot.json; TypeScript /tmp/ppp-cuisines-subset-tsc-final.log. No editar fuentes mientras corre. Cero solicitudes nuevas;35/40usadas,5restantes. Main intacta. No acredita transcripción ni WhatsApp real.

Resultado final:66suites/2535pruebas aprobadas en552.405s (/tmp/ppp-cuisines-subset-all-final.log), TypeScript aprobado (/tmp/ppp-cuisines-subset-tsc-final.log), snapshot sin cambios durante validación.64regresiones nuevas,72focalizadas. Próximos casos:reproducir pedido+opción+“bien empacado” en estos menús; atributos por subconjunto y exclusiones durante cierre. No afirmar que pedidos con empaque ya funcionan porque se preserva una nota almacenada.

Código f7432714 publicado/desplegado en staging, verificado13/10/2026 09:46Bogotá:running/healthy, imagenactiva=candidata sha256:967b62c29db8560dc84c8bbd7b06e41fd2945ac08269ba6480f65123b93eb043, healthOK/DBconnected/circuitCLOSED. Logs /tmp/ppp-cuisines-subset-deploy.log y /tmp/ppp-cuisines-subset-deploy-verified.log. Main y modelos sin cambios; presupuesto35/40,5restantes.


## Tanda 13/10: empaque y consulta de cobertura del chat real

Base de488dd2; código desplegado f7432714.96regresiones nuevas.48de empaque/opción (36con notas y12controles) en Moussaka, Schnitzel de cerdo, Bibimbap, Quesadilla de hongos, Pho de ternera y Empanada de carne:8unidades, opción explícita, “bien empacado”, “bien empacados”, “en cajas separadas”, cortesía. Baseline34fallaron/14pasaron (/tmp/ppp-packaging-cuisines-baseline.log); incluía el pho sin empaque. splitKitchenPreference separa instrucciones de empaque acotadas, conserva límites de preguntas/compras extra. Búsqueda y guard de nota standalone reconocen nombre de catálogo+opción positiva como pedido:Pho con fideos de huevo no es nota de acompañamiento. Sin excepciones por nombre/ID; la elección viene del catálogo.48/48aprobadas (/tmp/ppp-packaging-cuisines-approved2.log).

Caso real añadido por Wilmer: “n Donde estan ubicados” seguido de “Me traen Un pedido hasta El tintal?”. Fallo:consulta de cobertura consumida como dirección; no es autorización de entrega/cierre.48casos:doscatálogos ficticios(tamales/risotto), agente simulado activo/inactivo, carrito vacío/pago/confirmación, cuatro formas de consulta (“me traen”, “hacen entregas”, “quiero saber si llegan”, “nos llevan”). Baseline48/48fallaron (/tmp/ppp-coverage-question-baseline.log). Consulta se atiende antes de guardar dirección en estados activos y no modifica sesión/estado; barrio/lugar sin número pide calle y número antes de afirmar cobertura/costo. No se afirma que El Tintal tenga o no cobertura:estos casos no consultan Maps ni acreditan distancia.

108focalizadas aprobadas(96nuevas+12controles), /tmp/ppp-packaging-coverage-targets.log. TypeScript aprobado /tmp/ppp-packaging-coverage-tsc.log. Full en curso /tmp/ppp-packaging-coverage-all-final.log; snapshot /tmp/ppp-packaging-coverage-source-snapshot.json. No editar fuentes mientras corre. Cero llamadas pagadas;35/40usadas,5restantes. Main intacta. Pendientes:opción/empaque en pedido de varias líneas y cobertura con dirección numérica/config de tarifa fija, sin asumir que calcular tarifa acredita cobertura; cobertura tras selección pendiente y después de orden completada requieren casos propios.

Primer full:65/66suites,2630/2631pruebas aprobadas; fallo “Actualiza domicilio a Carrera7…” quedó interceptado como cobertura (/tmp/ppp-packaging-coverage-all-final.log). Corrección:consulta de cobertura descarta cambios explícitos de dirección antes de su matcher. Dos controles puros nuevos distinguen actualización/domicilio declarado de consulta; total98regresiones nuevas.117focalizadas aprobadas,3suites (/tmp/ppp-packaging-coverage-boundaries-final.log). TypeScript final aprobado /tmp/ppp-packaging-coverage-tsc-final.log. Nueva aprobación completa en curso /tmp/ppp-packaging-coverage-all-approved.log, maxWorkers2, fuentes congeladas contra /tmp/ppp-packaging-coverage-source-final.json. No acreditar el primer full como verde ni desplegar antes del resultado final.

Aprobación completa final:66suites/2633pruebas aprobadas (/tmp/ppp-packaging-coverage-all-approved.log), maxWorkers2, snapshot sin cambios; TypeScript aprobado.98nuevas regresiones en total. La primera ejecución con un fallo no se usa como acreditación final. Cero llamadas nuevas, Main intacta.

Código352c2997publicado/desplegado en staging, verificado13/10/2026 10:27Bogotá:running/healthy, imagenactiva=candidata sha256:b80adc6decc07137f4aad623dca424c5c10e60eb81d4d1dce9faae26d40241d6; healthOK/DBconnected/circuitCLOSED. Evidencia /tmp/ppp-packaging-coverage-deploy.log y /tmp/ppp-packaging-coverage-deploy-verified.log. Main intacta y presupuesto sin cambios. La actualización documental posterior no requiere reconstruir API.


## Tanda 13/10: auditoría de básicos cotidianos por paso

Base e157eb5b; código activo352c2997. La petición actual prioriza básicos antes de extremos.84regresiones nuevas en Estofado Irlandes y Baguette de jamón, precios y dirección sintéticos/configurables.60casos de FAQ:atendiendo, cierre, ubicación, posibilidad de recoger y servicio a domicilio; agente simulado activo/inactivo, building_cart/awaiting_payment/awaiting_final_confirm. Se verifica respuesta útil y conservación de carrito,dirección,tipo,pago y paso.

Baseline34/60fallaron,26pasaron (/tmp/ppp-everyday-basics-baseline.log). Tres familias: “Están atendiendo” no reconocida; ubicación ignorada al pedir pago; “Puedo recoger en el local?” cambiaba entrega/dirección sin autorización. Corrección:FAQ de servicio/ubicación antes del checkout, reconocimiento de atendiendo, consulta de posibilidad de recogida responde sin seleccionar método. La frase explícita “paso a recoger” conserva su flujo.

Otros16casos:precio por nombre/referencia(“eso cuánto vale”,“me dices el precio”) sin añadir platos; pregunta de recogida seguida de elección explícita. Todos pasaron (/tmp/ppp-everyday-basics-expanded.log). Cuatro recorridos adicionales reprodujeron consulta+compra juntas perdiendo el pedido (/tmp/ppp-everyday-basics-mixed-baseline.log); se ampliaron a8con agente simulado activo/inactivo. Mensaje con pregunta terminada en ? seguida de verbo de compra explícito se procesa en ambas partes; no acreditar formatos sin separador con esta tanda.

84focalizadas aprobadas (/tmp/ppp-everyday-basics-final-targets.log), TypeScript aprobado (/tmp/ppp-everyday-basics-tsc.log). Full en curso /tmp/ppp-everyday-basics-all-final.log, maxWorkers2; snapshot /tmp/ppp-everyday-basics-source-snapshot.json. No editar fuentes mientras corre. Cero llamadas pagadas,35/40usadas,5restantes. Main intacta. Siguiente auditoría:FAQ cuando negocio cerrado, sí/no/ok sin oferta frente a elección pendiente, disponibilidad/precio antes de comprar, consulta y compra sin signo ? y pasos awaiting_name/phone/address. No afirmar que todo lo básico queda cubierto por estos84.

Primera ejecución completa detenida intencionalmente al reproducir dos regresiones conocidas de ubicación frente a cambio de dirección (/tmp/ppp-everyday-basics-all-final.log; proceso Jest detenido conSIGINT tras verificar PID). No se editó código mientras corría ni se acredita ese run como aprobado. Corrección:FAQ de ubicación no intercepta cambios explícitos ni dirección suelta del cliente.93focalizadas aprobadas(84nuevas+9límites existentes) /tmp/ppp-everyday-basics-boundaries-final.log; TypeScript final /tmp/ppp-everyday-basics-tsc-final.log aprobado. Full final en curso /tmp/ppp-everyday-basics-all-approved.log, snapshot /tmp/ppp-everyday-basics-source-final.json.

Segundo full terminó con65/66suites y2714/2717pruebas aprobadas (/tmp/ppp-everyday-basics-all-approved.log):tres referencias “La dirección en [almacén/boutique]” se consumían como ubicación del local. Corrección:FAQ de ubicación temprana exige pregunta/petición explícita o palabra suelta de ubicación; no basta contener “dirección”.96focalizadas aprobadas(84nuevas+12controles) /tmp/ppp-everyday-basics-boundaries-approved.log; TypeScript final /tmp/ppp-everyday-basics-tsc-approved.log aprobado. Full aceptable en curso /tmp/ppp-everyday-basics-all-accepted.log, snapshot /tmp/ppp-everyday-basics-source-approved.json. No acreditar los runs anteriores fallidos ni editar fuentes hasta cerrar.

Aprobación final:66suites/2749pruebas, todas aprobadas,451.091s (/tmp/ppp-everyday-basics-all-accepted.log), maxWorkers2; TypeScript aprobado (/tmp/ppp-everyday-basics-tsc-approved.log). Fuentes sin cambios contra snapshot final.84regresiones nuevas de básicos y96focalizadas incluyendo referencias y checkout. Las ejecuciones fallidas/detenidas se conservan como diagnóstico, no como aprobación. Presupuesto35/40usadas,5restantes; Main intacta.

Integración adicional detectada al cerrar:32pruebas locales y handlers de resumen/total,pregunta de medios de pago,servicios de local y calle tras consulta de cobertura. Se preservaron y revisaron; estaban incluidos en snapshot final y full2749. No atribuirlos a las84regresiones de esta tanda. Aprobación integrada:116pruebas adicionales frente a2633. Incluir dependencia isReachSavedAddressQuestion de whatsapp-session-intents.ts antes de desplegar; el commit intermedio a836d232 no es fuente completa para deploy por sí solo. Cobertura con tarifa fija no acredita que una ubicación esté dentro de zona:mantener esta limitación del plan y comprobar rutas/configuración en siguiente ronda.

Versión completa06eaf915publicada y desplegada en staging, verificada13/10/2026 12:45Bogotá:running/healthy; imagenactiva=candidata sha256:87d7e0b064fbaf5a29828117c38eca59748c81128cf629b7f4896b601c9626fc; healthOK/DBconnected/circuitCLOSED. /tmp/ppp-everyday-basics-deploy.log y /tmp/ppp-everyday-basics-deploy-verified.log. TypeScript integrado aprobado /tmp/ppp-everyday-integrated-tsc.log; fuentes exactas del full2749. Main no se cambió. Siguiente:negocio cerrado,respuestas cortas,FAQ durante nombre/teléfono/dirección y comprobar cobertura efectiva sin deducirla de tarifa fija.


## Tanda siguiente: datos pendientes, negocio cerrado y respuestas cortas

Base07b3fa01; runtime desplegado06eaf915.68regresiones nuevas, todas pasaron sin cambios de código productivo:36de consultas mientras pide nombre/teléfono/dirección (Jollof de verduras y Pastel de choclo),8de negocio cerrado(Arepa de reina pepiada y Samosa de verduras),16de sí/no/ok/gracias sin oferta pendiente(Gyros y Croissant),8de sí/ok ante lista ambigua(Bao y Crepe). Agente simulado activo/inactivo en datos,cierre y selección ambigua; respuestas sueltas sin oferta se probaron en modo determinista.

Datos:horario/ubicación/efectivo no consumen el campo ni cambian carrito o pago; la entrada válida siguiente actualiza el dato y avanza sin registrar orden. Negocio cerrado:FAQ usa estado efectivo y horario09–18, conserva pedido aun con ignoreBusinessHours del harness. Respuestas sueltas no añaden unidades ni confirman órdenes; lista ambigua mantiene candidatos/cantidad y pide elegir. No acreditar todos los usos de sí/no ni percepción/modelo/canal reales.

Focalizadas68/68aprobadas /tmp/ppp-fields-closed-short-expanded.log. Suite completa afectada en curso /tmp/ppp-fields-closed-short-suite.log; TypeScript /tmp/ppp-fields-closed-short-tsc.log; snapshot /tmp/ppp-fields-closed-short-source-snapshot.json. Solo cambió el spec; no repetir toda la batería ni reconstruir API por rutina si no aparecen fallos o cambios runtime. Preservar archivos dist/tsbuildinfo ajenos. Cero llamadas pagadas;35/40usadas,5restantes. Main intacta. Próximo frente crítico: cobertura numérica/tarifa fija no puede afirmar cobertura por obtener precio; preguntas cortas con teléfono/nombre ambiguos y contexto perdido.

Cierre de la tanda:68 nuevas regresiones aprobadas; suite completa afectada whatsapp-general-accuracy:1484/1484 aprobadas,444.98s (/tmp/ppp-fields-closed-short-suite.log). TypeScript aprobado (/tmp/ppp-fields-closed-short-tsc.log). Fuentes verificadas sin cambios durante la ejecución. Solo pruebas y documentación; no hay cambio de runtime ni reconstrucción/deploy necesarios. Última ejecución global sigue siendo66suites/2749pruebas; no atribuir1484 ni el inventario ampliado a una nueva ejecución global. Cero llamadas pagadas;35/40usadas,5restantes. Main intacta. Próxima prioridad: cobertura geográfica no acreditada por una tarifa fija, seguida de respuestas ambiguas durante captura de datos.

## Interrupciones mientras espera datos o pago — 13/10/2026

Base d8bea3ad. Solicitud del usuario: atender otras intenciones mientras espera una respuesta, sin bucles de la misma pregunta.96casos nuevos del router real con dependencias simuladas, Curry de garbanzos/Empanada de espinaca, agente simulado activo/inactivo.80 consultas (precio,total,tres variantes de recap) en awaiting_name/phone/address/payment conservan carrito/datos/estado y permiten continuar;16correcciones absolutas “Mejor quiero tres…” conservan datos pendientes y permiten completarlos luego. Nunca crean órdenes externas.

Baseline64:32pasaron/32fallaron (/tmp/ppp-checkout-interrupt-baseline.log). Recap no reconocía “Qué tengo en el carrito”; cambio absoluto “Mejor quiero tres” no se resolvía consistentemente. Ampliación de reglas generales del recap y parser de cantidades; corrección conserva captura pendiente de nombre/teléfono/dirección/pago y responde con cantidad corregida más pregunta pendiente. No depende de nombres/IDs del catálogo. Final96focalizadas aprobadas (/tmp/ppp-checkout-interrupt-expanded.log);124casos de primera variante+suite de cantidades aprobados (/tmp/ppp-checkout-interrupt-targets.log). Primera corrección parcial tuvo4fallos de teléfono; se conserva diagnóstico /tmp/ppp-checkout-interrupt-fixed.log.

Verificación global en curso /tmp/ppp-checkout-interrupt-full.log; TypeScript /tmp/ppp-checkout-interrupt-tsc.log; snapshot /tmp/ppp-checkout-interrupt-snapshot.json. No editar fuentes durante full. Cero API pagadas;35/40usadas,5restantes. Main intacta. No afirmar desplegado antes de verificar servicio efectivo. No acredita todos los cambios de atributos/consultas ambiguas ni modelo/canal reales.

Aprobación final de interrupciones:96nuevas; TypeScript aprobado. Batería completa dividida por rutas sin solapamiento:47suites WhatsApp/2815pruebas aprobadas (289.565s, /tmp/ppp-checkout-interrupt-full.log) y19suites restantes/98pruebas aprobadas (7.572s, /tmp/ppp-checkout-interrupt-other-suites.log), total66suites/2913pruebas. No fue una sola ejecución global. Snapshot sin diferencias durante verificación. Main intacta, cero API pagadas. Pendiente verificar despliegue.

Código d39c27a5 publicado y desplegado en staging, verificado13/10/2026 13:15Bogotá:running/healthy, imagen activa=candidata sha256:36b33aca7c8c9ff40f5dce631b04f4069c0ae95ea4d9d7f432410cd9be683cf3; healthOK/DBconnected/circuitCLOSED. Logs /tmp/ppp-checkout-interrupt-deploy.log y /tmp/ppp-checkout-interrupt-deploy-verified.log. Primera comprobación starting con healthOK; segunda healthy. Main intacta. Próximo ampliar interrupciones con opciones pendientes, múltiples líneas, retiro/adición y cambios condicionales; cobertura geográfica sigue pendiente. No reiniciar saldo5.

## Recordatorio tras consulta con opciones y carrito múltiple — 13/10/2026

Base4d2f52ee (runtime d39c27a5).96nuevas regresiones gratuitas:dos catálogos ficticios Kebab/Te y Gofre/Batido, agente simulado activo/inactivo.16consultas mientras elige sabor,16mientras elige producto numerado,64con carrito de dos líneas mientras solicita nombre/teléfono/dirección/pago. Cuatro consultas:total,recap,efectivo y precio de producto nombrado. Verifican respuesta,recordatorio,carrito/opciones conservados y selección/dato posterior correctos. Base72falló por ausencia de recordatorio (/tmp/ppp-pending-reminders-baseline.log),no por72mutaciones del carrito. Primera corrección204focalizadas aprobadas (72+96anteriores+36datos) /tmp/ppp-pending-reminders-targets.log; ampliación96aprobada /tmp/ppp-pending-reminders-expanded.log.

Regla productiva genérica:consultas básicas de total,recap,medios de pago/servicios y precio resuelto muestran respuesta más paso pendiente. Opciones/selección pendientes tienen prioridad sobre checkout. Precio que necesita aclarar qué producto NO agrega pregunta competidora sobre pago/datos. El recordatorio no muta sesión ni selecciona pago. Si no hay platos confirmados,una opción pendiente permanece pendiente; no inventar total. No acredita todas lasFAQ ni consultas ambiguas encadenadas. Próxima prueba importante:consulta de precio ambigua en carrito múltiple y respuesta posterior con nombre/número no debe convertirse en nueva compra. Añadir también rechazo/cambio durante aclaración.

Full en curso /tmp/ppp-pending-reminders-full.log (todas suites,maxWorkers2). TypeScript /tmp/ppp-pending-reminders-tsc.log aprobado. Snapshot /tmp/ppp-pending-reminders-source.json;no editar fuentes durante ejecución. Main intacta,ceroAPI35/40usadas,5restantes.

Verificación previa al chat recibido:66suites/3009pruebas aprobadas,310.99s (/tmp/ppp-pending-reminders-full.log), TypeScript aprobado,snapshotigual. No publicar esa cifra como evidencia del ajuste posterior de combo.

Chat real recibido durante la verificación:cliente pide Arroz Paisa, envía calle, pregunta “Que precio tiene” durante nombre y “Pero ese viene en combo o solo?”. Mensaje pegado dos veces; tratado como una conversación, no dos incidencias.18recorridos completos:PPP,Poke de tofu y Falafel con variantecombo en catálogos ficticios,agente simulado activo/inactivo,tres consultas de precio. Baseline9aprobadas/9fallaron (/tmp/ppp-arroz-price-name-baseline.log):precio ya no se capturaba como nombre,pero combo durante awaiting_name con agente habilitado terminaba pidiendo nombre sin contestar. La secuencia verifica luego nombre real y precio durante pago sin cambios de carrito.

Corrección:consulta de disponibilidadcombo se resuelve antes de agente/captura de datos; información de versiones no sustituye selección pendiente ni inicia otro pedido si ya hay carrito. Respuesta recuerda paso pendiente.120focalizadas aprobadas (18secuencias nuevas+96recordatorios+6controlesexistentes) /tmp/ppp-pending-combo-fixed.log. Total nuevas114. Full final en curso /tmp/ppp-pending-combo-full.log, snapshot /tmp/ppp-pending-combo-source.json; TypeScript final /tmp/ppp-pending-combo-tsc.log. No editar fuentes. Cero API, Mainintacta. Expiración por inactividad no reproducida/acreditada como parte de estos18; no inferir que la configuración de Main coincide con staging.

Aprobación final integrada:66suites/3027pruebas aprobadas,300.657s (/tmp/ppp-pending-combo-full.log);TypeScript aprobado (/tmp/ppp-pending-combo-tsc.log). Snapshot fuente sin cambios.114regresiones nuevas (96recordatorios+18secuencias). Mainintacta,35/40APIusadas,5restantes. Pendiente verificar deploy.

Código591c134e publicado/desplegado staging,verificado13/10/2026 13:35Bogotá:running/healthy,imagenactiva=candidata sha256:aaf13ec72af80b15fe0db8b66d5826d30e07d4da4de50c0ffd9ae11569391a8d; healthOK/DBconnected/circuitCLOSED. Logs /tmp/ppp-pending-combo-deploy.log y /tmp/ppp-pending-combo-deploy-verified.log. Primera comprobación starting/healthOK;segundahealthy. Mainintacta. Conservados archivos dist/tsbuildinfo locales y bin/ remoto. No cambios de modelos ni gastoAPI. Siguiente:precio ambiguo en carrito múltiple,aclaración de consulta sin comprar,cambio/rechazo mientras hay opción pendiente,cobertura efectiva.

## Plan de huecos y aclaración explícita — 13/10/2026

Basefa968bba,runtime591c134e.16pruebas nuevas con carrito de dos productos Sushi/Gyozas y Pasta/Crema,agente simulado activo/inactivo y awaiting_name/phone/address/payment. “Que precio tiene” aclara producto sin dos preguntas competidoras; “Quiero saber el precio de X” responde sin modificar sesión y permite continuar dato pendiente.16/16focalizadas aprobadas /tmp/ppp-ambiguous-explicit-price.log. Solo cambia spec/documentación;sin runtimepatch ni deploy requerido. Suite general afectada en curso /tmp/ppp-ambiguous-explicit-suite.log;TypeScript /tmp/ppp-ambiguous-explicit-tsc.log. No acreditar la respuesta abreviada X/el segundo todavía:próxima prioridad para evitar compra al aclarar consulta.

Plan ampliado en WHATSAPP-COMMERCIAL-READINESS-PLAN:consulta ambigua,cancelación de selección frente a pedido,cambios y consultas juntas,referencias/ráfagas/pausas,clasificación de datos,precio/cobertura y evaluación real reservada. No convertir cada frase en parche por SKU. Mainintacta,ceroAPI35/40usadas5restantes.

Cierre:16nuevas aprobadas y suite general completa1710/1710aprobada,287.318s (/tmp/ppp-ambiguous-explicit-suite.log),TypeScript aprobado. Sin modificaciones runtime;última verificación global sigue66/3027, no acreditar3043como ejecución global nueva. No reconstruir API. Prioridad siguiente:respuesta abreviada a consulta de precio ambigua (nombre/número),conservando captura y carrito;después cancelación de elección frente a carrito. Mainintacta,ceroAPI35/40usadas5restantes.

## Contexto de consulta de precio — 13/10/2026

Base15a4b3b0,runtime591c134e.84regresiones nuevas:64respuesta abreviada/desistimiento en nombre/teléfono/dirección/pago con2menús ficticios y agente simulado activo/inactivo;12controles durante pago(número fuera de lista,ordinal inválido,consulta intercalada,repetición,desistimiento y acción explícita);8nuevos datos válidos abandonan la consulta pendiente. Baseline64/64fallaron /tmp/ppp-price-context-baseline.log:aclaración no mantenía intención informativa. Dato válido baseline2fallaron/6pasaron /tmp/ppp-price-context-data-baseline.log,teléfono numérico se confundía con índice.

Corrección general:pendingPriceInquiry separado de pendingMatch/atributos,candidatos numerados por productos actuales del carrito,snapshotcart+estado;precio por nombre exacto/número/ordinal responde sin compra. Desistir limpia solo consulta;acción/dato nuevo la abandona;otra consulta mantiene contexto. Número de lista máximo2dígitos,para no bloquear teléfono. Cambio de carrito/estado invalida contexto. Campo JSON opcional,no migraciónBD. No afirmar resolución de toda referencia vaga/typo.

103focalizadas aprobadas(84nuevas+19controlesprevios) /tmp/ppp-price-context-final-targets.log. Primer full /tmp/ppp-price-context-full.log detenido conSIGINT sobre PIDpropio662193 antes de editar fuentes para reproducir límite del teléfono;no acreditar como aprobado. Full final en curso /tmp/ppp-price-context-full-final.log;TypeScript /tmp/ppp-price-context-tsc-final.log;snapshot /tmp/ppp-price-context-source-final.json. No editar fuentes durantefull. Mainintacta,ceroAPI35/40usadas5restantes.

Solicitud adicional durantefull:resumir confirmación que repetía3vecesdirección. Segundo full /tmp/ppp-price-context-full-final.log detenido intencionalmente(SIGINT PIDpropio663295) antes de editar fuentes;no acreditar como aprobado. Integración presentación:formatCartOnly permite omitir dirección solo al componer resumen completo;campo de dirección apareceuna vez en datos de entrega. Carrito aislado conserva dirección. tryConfirmOrder evita repetirla enprefacio/anotación común cuando el cuerpo ya la muestra,preserva avisos tarifarios/ubicación.

12regresiones nuevas(2catálogos,domicilio/recogida,pago pendiente/elegido,carrito aislado y turnorealdirección→pago). Baseline6fallaron/6pasaron /tmp/ppp-compact-summary-baseline.log. Corrección parcial tuvo2fallos por aviso “Anoté” que también repetía dirección /tmp/ppp-price-summary-targets.log. Final115focalizadas aprobadas(96nuevas+19previas) /tmp/ppp-price-summary-approved.log. Full integrado en curso /tmp/ppp-price-summary-full.log;snapshot /tmp/ppp-price-summary-source.json;TypeScript /tmp/ppp-price-summary-tsc.log. Noeditar fuentes. Mainintacta,ceroAPI.

Cierre integrado:66suites/3139pruebas aprobadas (/tmp/ppp-price-summary-full.log);TypeScript aprobado /tmp/ppp-price-summary-tsc.log;snapshot sin cambios.96nuevas (84contextoprecio+12resumen),más16de tanda anterior ahora incluidas en full. Ejecuciones detenidas no son aprobación. Pendiente deploy. Mainintacta,ceroAPI35/40usadas5restantes.

Código850d7ccc desplegado/verificado13/10/2026 13:59Bogotá:running/healthy,imagenactiva=candidata sha256:459895adfc0ffd376994e675d459e5fc5eaee72c74c7cf68e364bf09ff7a280f;healthOK/DBconnected/circuitCLOSED. /tmp/ppp-price-summary-deploy.log y /tmp/ppp-price-summary-deploy-verified.log. Primera comprobación starting conhealthOK;segundahealthy. Mainintacta,modelos ypresupuesto sin cambios. Siguiente:cancelar elección pendiente frente a vaciar pedido,consulta+acción y referencias vagas/códigos durante consulta de precio. No acreditar bare“no”,typos o todos los ordinales con estos84.

## Cancelación de selección frente a pedido completo — 13/10/2026

Baseacd19ae3,runtime850d7ccc.36regresiones nuevas:32con carrito previo de2platos+nota,pendiente de sabor/producto en2cartas ficticias(Arepa/Infusión y Tarta/Smoothie),agente simulado activo/inactivo. Olvidaeso/noquieroesabebida/cancelaesaselección abandonan selección sin borrar carrito;vacía todo pedido sí limpia. Turno viejo de sabor no revive el producto abandonado.4controles de rechazo a bebida dentro de plato compuesto aclaran cambiar bebida frente a cancelarplato;preservan sopa elegida y cantidad3hasta decisión.

Baseline24fallaron/8pasaron /tmp/ppp-selection-cancel-baseline.log;variosfallos eran de claridad de respuesta,otrosdejaban selecciónactiva. Regla general temprana para cancelación de una selección(no propuestas múltiples ni enlacesMP)antes del agente/cancelación del pedido. Platos compuestos con atributoBebida necesitan aclaración del alcance. No acreditar todos los “olvida” ni cancelación de órdenes registradas.56focalizadas aprobadas(36nuevas+20controles) /tmp/ppp-selection-cancel-expanded.log.

Full en curso /tmp/ppp-selection-cancel-full.log;TypeScript /tmp/ppp-selection-cancel-tsc.log;snapshot /tmp/ppp-selection-cancel-source.json.Noeditarfuentes. Mainintacta,ceroAPI35/40usadas5restantes.

Aprobación final:66suites/3175pruebas aprobadas (/tmp/ppp-selection-cancel-full.log),TypeScript aprobado /tmp/ppp-selection-cancel-tsc.log;snapshot sin diferencias.36regresiones nuevas.NoAPI,Mainintacta. Pendiente deploy.

Código553a2087 desplegado/verificado13/10/2026 14:11Bogotá:running/healthy,imagenactiva=candidata sha256:bb3a3fac469fdc35dc6d0c4d85ca189799c5458fff8fc2519d768094ca8135be;healthOK/DBconnected/circuitCLOSED. /tmp/ppp-selection-cancel-deploy.log y /tmp/ppp-selection-cancel-deploy-verified.log. Primera comprobación starting/healthOK;segundahealthy. Mainintacta,modelos/presupuesto sin cambios. Próximo:cortesía/typos,alias de atributos,cancelación de edición de línea existente frente a eliminarla,propuestas múltiples.

## Cortesía, cancelación de edición y continuidad por número — 13/10/2026

Based8e43b98,runtime553a2087.48regresiones nuevas:24cortesía/typos al abandonar selección (Bebida de cítricos/Granizado),12cancelación real de edición de sabor en carrito con2productos y cantidades2/3(Refresco/Batido,Yogur/Helado),12con Preparacion/Coccion:cancelar,consultar total y negar cancelación,luego aplicar cambio al segundo plato. Pruebas conrouterreal,catalogoficticio,agentesimuladoactivo/inactivo. Baseline36/36fallaron /tmp/ppp-cancel-courtesy-edit-baseline.log.

Regla general:normalizar cortesía en el intent de cancelación y2typosdeacción/selección acotados;cancelar pendingCartAttributeEdit limpia solo ese cambio,conserva opciones/cantidades originales. “No cambies el/la [atributo]” usa nombres del catálogo,noSabor fijo. Negación“No canceles ese cambio” no abandona selección. Consultas muestranrecordatorio de plato pendiente. La ampliación tuvo8fallos por respuesta numérica que noaplicaba cambios /tmp/ppp-cancel-courtesy-edit-expanded.log y /tmp/ppp-cancel-courtesy-edit-approved.log. Corrección:respuestas de selección de edición antes del parser/modelo genérico,actualizaciones de atributo por catálogo acotadas al índice elegido. Debug /tmp/ppp-edit-resume-debug.log no es aprobación;consoletemporal quitado.

84focalizadas aprobadas(48nuevas+36controles) /tmp/ppp-cancel-courtesy-edit-final-targets.log. Full en curso /tmp/ppp-cancel-courtesy-edit-full.log;TypeScript /tmp/ppp-cancel-courtesy-edit-tsc.log;snapshot /tmp/ppp-cancel-courtesy-edit-source.json.Noeditarfuentes. Mainintacta,ceroAPI35/40usadas5restantes. No acreditar toda referencia/cortesía ni rollback de SKU que ya fue reemplazado antes de elegir opciones;propuestas múltiples siguen pendientes.

Extensión antes del cierre:4pruebas por colisión entre nombre de plato y opción (“deMango” en nombre,cliente solicitaLimon),2paresdecartasagentesimuladoactivo/inactivo.4/4baselinefallaron /tmp/ppp-edit-name-option-baseline.log. Corrección:selectedUpdates usa fuente original del cambio, no texto reconstruido con nombre de candidato.88focalizadas aprobadas(52nuevas+36controles) /tmp/ppp-cancel-courtesy-edit-all-targets.log. Full previo /tmp/ppp-cancel-courtesy-edit-full.log detenido(SIGINT PIDpropio682202) antes de editar,no aprobado. Full final /tmp/ppp-cancel-courtesy-edit-full-final.log;TypeScriptfinal /tmp/ppp-cancel-courtesy-edit-tsc-final.log;snapshotfinal /tmp/ppp-cancel-courtesy-edit-source-final.json.Noeditarfuentes.

Aprobación final:66suites/3227pruebas,307.352s (/tmp/ppp-cancel-courtesy-edit-full-final.log),TypeScript aprobado /tmp/ppp-cancel-courtesy-edit-tsc-final.log,snapshot sin diferencias.52nuevasregresiones,88focalizadas. Full detenido no aprobado. Mainintacta,ceroAPI35/40usadas5restantes. Pendiente deploy.

Código0508049d desplegado/verificado13/10/2026 14:32Bogotá:running/healthy,imagenactiva=candidata sha256:562082b34bf0942e56e18acbf26d506f092d8405fcad6bc03c16af2e0a4e041d;healthOK/DBconnected/circuitCLOSED. /tmp/ppp-cancel-courtesy-edit-deploy.log y /tmp/ppp-cancel-courtesy-edit-deploy-verified.log. Primera comprobación starting/healthOK;segundahealthy. Mainintacta,ceroAPI:modelos/presupuesto sin cambios. Próximo:sustitución deSKU→opciones pendientes→cancelación/restauración;propuestas múltiples;consulta+acción.


## Correcciones de dirección y pedidos mixtos — 13/10/2026, en validación

Se encontró HEAD ac634386 (publicado por otro trabajo concurrente), que ya integraba los 8 casos de sustitución de SKU de esta tarea y nuevos casos de direcciones/ofertas. Se preservó ese trabajo y se revisaron los cambios locales de aceptación de acompañamiento; no reiniciar ni atribuir todos esos cambios a esta tanda.

Fallos observados en chats del usuario:
- Dirección con texto conversacional guardado (“No, a esta…”); alias Direction durante pago ignorado; pago aplicado a dirección vieja; pregunta copiada antes de calle conservaba la anterior, pese a responder “Dirección lista”. Nueva calle debe reemplazar y volver a cotizar, manteniendo carrito/pago.
- “A una Nueva”/rechazo de anterior bloqueaba la captura; “es esta” sin destino se guardaba literalmente. Pedir destino concreto, no geocodificar demostrativos.
- Pedido mixto requería sí para productos ya claros. Añadir lo inequívoco; mantener por separado selección/opciones; excluir desconocidos y evitar duplicarlos con un sí posterior.
- “Un combo de tres tacos” se interpretó como tres unidades del SKU. Separar cantidad de paquetes y contenido del paquete; conservar ambigüedad entre SKUs con nombres similares.
- Oferta de dúo→consulta de bebida→sabor perdió SKU y compró botella; corrección en pago ignorada. Ac634386 ya trae pruebas de ese camino y otro menú; comprobarlas en regresión integrada.
- Aceptación de yuca se trató como plato; no debe aceptar además una sustitución de bebida ni reconstruir cantidades desde la prosa del bot. Se revisaron 6 pruebas locales: sin carrito estructurado se pide platos/cantidades, no se inventan compras.
- Colmbiana y Cliente Sintético son problemas visibles de presentación/datos; estos chats no prueban su origen. Pendiente auditar datos del catálogo/perfil antes de piloto; no corregir por SKU.

24 regresiones nuevas propias (10 dirección/copiar pregunta/rechazos, 2 pedido mixto, 12 paquetes en tacos/gyozas, cantidades1/2/5, agente simulado activo/inactivo). Baseline inicial10fallaron/2pasaron /tmp/ppp-address-mixed-baseline.log. Dirección10/10 /tmp/ppp-address-sequence-fixed.log; pedido+oferta6/6 /tmp/ppp-mixed-offer-fixed.log. Ampliación detectó6fallos más al reconocer alias de paquete con cantidad numérica;12/12 finales /tmp/ppp-pack-final-target.log. Debug de catálogo eliminado; logs debug no acreditan aprobación.

Full en curso /tmp/ppp-user-chat-full.log, TypeScript /tmp/ppp-user-chat-tsc-final.log, snapshot /tmp/ppp-user-chat-source.json. No editar fuentes hasta terminar. No acreditar pase completo ni desplegar hasta revisar regresiones; la nueva conducta de compra inmediata puede requerir actualizar expectativas antiguas de confirmación, sin ocultar fallos de carrito. Main intacta, cero llamadas API, 35/40 usadas,5restantes.


Extensión y regresión integrada:primer full /tmp/ppp-user-chat-full.log terminó con65suites aprobadas y1fallida,3343aprobadas/16fallidas,385.311s. Las16 expectativas iniciales suponían productos claros aún fuera de carrito. Actualizadas a compra inmediata, sin reducir comprobaciones de cantidades ni duplicados. La ejecución focal posterior detectó6fallos reales de respuesta:desconocido omitido en mensaje con domicilio y afirmación del desconocido respondida solo con carrito. Corregidos:avisar exclusión al añadir y guardar recentUnavailableOrder como contexto de consulta por15min, nunca borrador de compra; petición explícita del desconocido conserva carrito y responde sin inventar producto. CampoJSONopcional,no migraciónBD.

10pruebas adicionales propias:2recotización que sustituye tarifa2000/distancia1.4/coordenadas viejas por6000/4.6/coordenadas nuevas conservando cash/cantidad2/nota;4con dos ambigüedades en Pizza/Ramen que materializan primera elección sin esperarsegunda;4aceptación de yuca/edamame con Bebida aún pendiente y cantidad3. Baseline4/4fallaron para dos dudas (/tmp/ppp-mixed-two-ambiguities-baseline.log) y4/4 para aceptación parcial (/tmp/ppp-side-pending-drink-baseline2.log). Primeros intentos de fixture sin atributos y cfg sin campos fallaron compilación;no son prueba de comportamiento. Eliminado helper no usado que reconstruía compras desde prosa del bot. Aceptación exige contexto del último mensaje;con pendingAttribute y sin opción explícita preserva estado y pide opciones reales del producto.

34regresiones propias nuevas en total,6pruebas locales de aceptación revisadas y16expectativasprevias actualizadas.65focalizadas aprobadas /tmp/ppp-user-chat-targets-corrected3.log;45focalizadas trasúltima extensión aprobadas /tmp/ppp-side-mixed-final.log. Esos resultados no acreditan full nuevo.

Full final en curso /tmp/ppp-user-chat-full-final.log;TypeScript /tmp/ppp-user-chat-tsc-approved.log;snapshot /tmp/ppp-user-chat-source-final.json.No editar fuentes hasta terminar. SSHpreflight servidor estaba enac63438,running/healthy;no modificarbin/privado. Mainintacta por esta tarea, ceroAPI35/40usadas5restantes. Pendiente commit/deploy tras fullverde y snapshotválido.


Aprobación final de esta tanda:66suites/3369pruebas aprobadas,390.54s (/tmp/ppp-user-chat-full-final.log),TypeScript aprobado /tmp/ppp-user-chat-tsc-approved.log,snapshot final íntegro sin diferencias.34regresiones nuevas propias,6aceptacioneslocales revisadas y16expectativasprevias adaptadas a compra inmediata. El full inicial con16fallos no es aprobación. No llamadas API ni órdenes externas. Pendiente publicar/desplegar exacto código aprobado.


Código fb70c472 publicado y desplegado en staging13/10/2026 18:50Bogotá. Verificación /tmp/ppp-user-chat-deploy-verified.log:HEADfb70c47,running/healthy,imagenactiva=candidata sha256:f119b95ff8268ec334117f756d476dab99353bd3e45a541bc377b26de6308056;healthok,DBconnected,circuitCLOSED. Deploy /tmp/ppp-user-chat-deploy.log. No tocar orphanmariadb_local ni bin/privado;se preservaron. Main sin cambios por esta tarea. Presupuesto35/40usadas5restantes, ceroAPI esta tanda.

Siguiente tanda:atributos realmente obligatorios sin default al resolver primer/segundo plato de pedido mixto;consultas y correcciones intercaladas entre esas opciones;ráfagas de continuación;aceptaciones parciales sin draft recuperable;errores/tamaño/calidad deaudioSTT separados de interpretación. Los34casos acreditan caminos específicos, no todo lenguaje humano. Las4pruebas de dos dudas y4de acompañamiento con bebida cierran esos casos focales del plan. Revisar datos sintéticos y nombres/opciones del catálogo antes del piloto. No promover Main automáticamente.


## Opciones obligatorias en pedidos mixtos — 13/10/2026

Base31a0037c;último runtime desplegadofb70c472.52regresiones nuevas propias con2cartas ficticias y agente simulado activo/inactivo:28consultas de precio/total/sabores/opciones mientras hay bebida pendiente;16secuencias con dos bebidas, cantidades3/2 y2/4, incluida corrección solo de la primera;4cambios explícitos tres→cinco con sabor aún pendiente;4cancelaciones locales que conservan plato y no reviven bebida al enviar después su sabor. Router/catalog/guard reales;persistencia,Meta,modelo yórdenes simuladas,ceroAPI.

Baseline inicial /tmp/ppp-required-options-baseline.log:4fallaron/8pasaron. Consulta genérica de sabores caía al modelo (apagado:mock generateTurn inexistente;encendido:respuesta genérica “¿Cuál prefieres?”). Regla temprana responde con opciones del producto pendiente por nombres de atributos del catálogo;no selecciona valor ni consume pedido. Solo preguntas genéricas exactas:nombrar otro producto no se fuerza al actual.

Ampliación /tmp/ppp-required-options-final-targets.log:8fallaron/36pasaron en cantidad/cancelación. Corrección con nombre de bebida no ajustaba cantidad;cancelación local no cubría “olvida esa bebida” y cola multi mantenía duplicado del mismo producto pendiente. Cambio de cantidad actualiza solo pendingAttribute al nombrarlo (o referencia abreviada de cantidad);mantiene cola de otros productos. Cancelación admite cola vacía o que solo contiene el producto actual;con otras dudas pendientes aún no se acredita cancelación selectiva. No cancelar carrito ni perder atributos de plato compuesto. Debug de cola /tmp/ppp-required-cancel-debug.log eliminado del código;no acredita pase.

60focalizadas aprobadas (52nuevas+8controles de sustitución) /tmp/ppp-required-options-approved-targets.log. Full en curso /tmp/ppp-required-options-full.log,TypeScript /tmp/ppp-required-options-tsc.log,snapshot /tmp/ppp-required-options-source.json.Noeditarfuentesdurantefull. Mainintacta,35/40solicitudesusadas5restantes,noAPIesta tanda. Pendientecommit/deploytrasaprobación.

Siguiente:cancelar solo primera bebida cuando quedan otras selecciones;preguntas de otro producto mientras se elige sabor;correcciones de cantidad por referencia abreviada con varios candidatos;notas independientes de cada bebida;ráfagas/retomas con cantidad corregida. No declarar cobertura completa por52casos.


Aprobación final:66suites/3421pruebas aprobadas,676.044s (/tmp/ppp-required-options-full.log);TypeScript aprobado (/tmp/ppp-required-options-tsc.log);snapshot íntegro sin diferencias.52regresiones propias nuevas,60focalizadas concontroles. Duración de suite no es medición de latencia del bot. Mainintacta,cero llamadas pagadas,35/40usadas5restantes. Pendiente publicar/desplegar código aprobado.


Runtime55c5fd52 publicado/desplegado/verificado13/10/2026 19:13Bogotá:running/healthy,imagenactiva=candidata sha256:37ae6339eb3cd6ed5f619effebcce06281f5e5b4a1646954f426f228f41316cc;healthok,DBconnected,circuitCLOSED. Logs /tmp/ppp-required-options-deploy.log y /tmp/ppp-required-options-deploy-verified.log. Preservados bin/,privados yorphanmariadb_local. Mainintacta,modelos sin cambios,cero llamadas pagadas. Artefactos dist/ ytsbuildinfo locales previos no se incluyeron en commit.


## Promoción autorizada a producción — 13/10/2026 19:29 Bogotá

Usuario pidió desplegar a Main y luego continuar staging. Main49194fec integra stagingb8b497d6 sin conflictos yconserva cambios propios enauth/admin.controller.ts yorders.service.ts.66suites/3421pruebas aprobadas,694.269s (/tmp/ppp-main-required-options-full.log),TypeScript aprobado /tmp/ppp-main-required-options-tsc.log;fuente inmutable /tmp/ppp-main-required-options-source.json. Compilación independiente /tmp/ppp-main-promotion-dist y /tmp/ppp-main-promotion-build.log.

Producción /var/www/ppp-nest,Main49194fec,compose efectivo docker-compose.yml,proyecto ppp-nest,contenedor ppp_nest_api. Compose local adaptado y backups conservados;no sobrescribirlos ni usarcompose staging enproducción. Se construyó con Dockerfile multietapa, sin volumen de fuente encompose efectivo. Running,imagenactiva=ppp-nest-api sha256:38beb7e91d1ab3919b85a662991bf791b74fb27b35295d832f419a978b038cdd;HTTP3000/api/healthOK,DBconnected,circuitCLOSED. Contenedor sinhealthcheckDocker:verHTTP. Dos módulos compilados coinciden byteporbyte concompilación local:orchestrator a6fc0a056221ca02f30207b03f88bbd0ef04e63e0f1daa57be4a26eb9d2e8dc6;AI20677034b5f343566d5fa3bb56bf7e697f47882656a6b37134cbb346f400ce32. Evidencia /tmp/ppp-main-required-options-deploy.log y /tmp/ppp-main-required-options-verified.log. Imagen anterior preservada como ppp-nest-api:before-promotion-49194fec. Sin cambios de modelos/credenciales ni llamadas pagadas.

Staging se conserva yse actualizó porfastforwarda49194fec paraincluir también cambios propiosMain. Trabajar nuevas tandas soloenstaging,no Main. Las próximas correcciones no sepromueven automáticamente. Presupuesto35/40,5restantes. Staging API todavía55c5fd52 hasta siguiente deployaprobado.


## Continuación en staging: colas de opciones y puntos — en validación

Tras producción49194fec,staging local avanzó a ese commit. El primer fastforward rechazó artefactos generados locales;se preservaron enstash local edd763f8adb87bd445dc8235e37e17258133e54b (solo12rutasdist/ ytsconfig.build.tsbuildinfo). No aplicar ese stash sobre código actual ni borrarlo por rutina. Main conserva dist/ históricos rastreados,que entraron en staging por integración;Docker compila src/ fresco,no usar esos dist/ como evidencia de runtime. Main quedó intacta después deldeploy.

20regresiones nuevas sobre colas:8cancelar bebida actual cuando quedaotra,8notas independientes entreplato/jugo/gaseosa(con ysin cancelación),4mismoSKUyaen carrito y2solicitudespendientes. Baseline8/8fallaron /tmp/ppp-selective-queue-baseline.log. Corrección cancela primera fila activa, nunca todas las filas delSKU;resuelve siguiente producto porcatálogo,mantiene cantidad/atributos/notas yresto delcarrito.20aprobadas /tmp/ppp-selective-queue-notes.log. Cancelación conserva restricciones deambigüedad/colasdeotros tipos;no acreditar todo “no”.

Usuario añadió compra “medio pollo más pero para pagar con puntos” ypidió buscarhuecos generales.58regresiones nuevasdepuntos:24compra+premio,30consultas específicas/sin cuenta/códigomalformado,4productos conPremioen su nombre. Baseline24/24fallaron /tmp/ppp-points-order-baseline.log;consultas22fallaron/8pasaron /tmp/ppp-points-topic-baseline.log;nombres4/4fallaron /tmp/ppp-points-name-collision-baseline.log. Pago conpuntos se separa depedido explícito yse explica acción concreta(códigoexistente oredimir con9puntos);no canje ni descuentoautomáticos. Se conserva contexto deproducto/conversación;las preguntas de saldo/pago/premio usan textooriginal antesdeETA/captura. Código inválido oausente pidecódigo específico;cuentas no vinculadas reciben siguiente paso,no guía completa. Compra de producto quecontiene Premiono se convierte enayuda deprograma;no quitar palabras queformanpartedelnombre literal delcatálogo.

Parcialesdetectaron6fallos porproductoBowlDelPremio,9porTengoPremio/TodoGratis (esteúltimo seconfundía con progreso depedido),2porBrownieConPremio(stripsecomíanpartedelnombre). Corregidos,103focalizadas aprobadas /tmp/ppp-loyalty-queue-targets-final.log (78nuevas+25controlesdecanje/códigos). NormativaPPPdepuntos(9yproductos elegibles)eslegada enPointsService/PointsHelp;no introducir nuevos IDs/nombres excepcionales en clasificador. FicciónBowl usa código2 delprograma existente;esto no acredita programas de puntos distintos por tenant. ParaKamppo parametrizarpolítica, no copiarPPPcódigoscomoreglaglobal.

Fullen curso /tmp/ppp-loyalty-queue-full.log;TypeScript /tmp/ppp-loyalty-queue-tsc.log;snapshot /tmp/ppp-loyalty-queue-source.json.Noeditarfuenteshasta terminar.78regresiones nuevas. Mainproducción49194fec NOtieneestasúltimascorrecciones,sonsolo staging.35/40llamadasusadas5restantes;ceroAPIpagada,Meta/BD/modelos/órdenes simulados.

Próximos huecos:pedido+códigodepremioenmismomensaje;pedido+redimir explícito;tras generar premio,aplicarlo alpedido solo cuando intención persistida loautorice;cancelación conambigüedadesadicionales;otrosproductos/nombresde12letrasquecolisionancon códigos;programas de puntos de otros tenants;saldo parcial mientrasfaltanopcionesycorrecciones despuésdepremio. Yaexistíancontroles decódigousado/vencido/otrocliente yregistrodefactura:reutilizados, no duplicar ni acreditar pruebas reales decanje.


### Revisión global de la tanda de puntos — no desplegar todavía

Primer full:62suites aprobadas/4fallidas;3436pruebas aprobadas/63fallidas,3499total,666.448s (/tmp/ppp-loyalty-queue-full.log).46fallos en notas/eliminaciones/cantidades eran harnesses Object.create sin pointsHandler;se añadió servicio real con dependencia externa simulada a esos tres fixtures.17fallos en ráfagas/pedidos agrupados mostraban interferencia de la ruta nueva de premio en mensajes ordinarios;entrada pointsPurchaseOrderText ahora exige palabra puntos/premio antes de invocarse. No atribuir los63fallos a infraestructura.

Verificación corregida:160casos focalizados aprobados en suite general /tmp/ppp-loyalty-global-fixes.log (los46fallos de fixtures en ese run corresponden a la captura anterior a actualización de esos archivos);después111pruebas aprobadas en las tres suites completas /tmp/ppp-loyalty-fixture-fixes.log. TypeScript aprobado /tmp/ppp-loyalty-fixed-tsc.log. Nueva global pendiente /tmp/ppp-loyalty-fixed-full.log; snapshot /tmp/ppp-loyalty-fixed-source.json. No editar fuentes durante ejecución. Mainproducción49194fec permanece intacta. Correcciones nuevas siguen locales, sin publicar/desplegar hasta full aprobado. CeroAPIpagada.


Revisión posterior de árbol pendiente:hay cambios acumulados adicionales conservados en types/session-intents/partial-note,unas1571líneas de fixtures y rutas de autocorrección,imagen parcial,códigos+pedido,alergias,cancelación y cuenta. Todos figuran en snapshot /tmp/ppp-loyalty-fixed-source.json,sin diferencias al comprobarlo;no atribuir toda esa ampliación a las78regresiones iniciales. Presupuesto efectivo docs/whatsapp-model-budget.json:36/40usadas,4restantes;registro de una llamada de consulta de celebración13/10Bogotá,que encontró captura falsa de dirección y fue corregida por trabajo acumulado. No sobrescribir ese registro con el saldo35 anterior. No nuevas llamadas en revisión actual.

Próxima revisión de claridad:tryRemoveMostExpensiveLine ytryApplyAllergyOrder dicen «pedido sigue igual» después de mutación;distinguir «los demás platos se conservan». Añadir caso precio unitario vsimporte de línea,empate del mismoSKUcon notas diferentes,nota parcial junto a autocorrección (hoy queda texto «una sin...» en una línea agrupada),referencias foto caducadas/reinicio,alergia al corregir carrito existente. Estos son huecos de revisión pendientes,no fallos globales acreditados.


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


## Plan de piloto y siguiente corrección de foto

El plan concreto está al final de WHATSAPP-COMMERCIAL-READINESS-PLAN.md: seis pasos con criterios de aprobación, desde correcciones/contexto hasta evaluación reservada, medios, piloto asistido y parametrización Kamppo. No acreditar todo el programa por pruebas de catálogo sintético.

Seis regresiones nuevas: cuatro preservan nota y Salsa:Picante al reducir cantidad de Pizza Vegetal/Bowl De Quinoa desde una foto, con agente simulado activo/inactivo y estados awaiting_address/awaiting_payment; conservan dirección/pago. Dos prueban opción retirada del catálogo. Baseline inicial4/4fallaron /tmp/ppp-photo-attributes-baseline.log;la frase de foto se guardaba como dirección. Cambio: despachar referencia explícita a foto antes de captura checkout;reutilizar nota/atributos de una sola línea;validar contra carta actual antes de reconstruir. Parcial detectó2fallos porque helper elegía valor por defecto para opción retirada;ahora se pide aclaración sin mutar. Error TypeScript de atributo opcional corregido,solo último pase acredita aprobación.

34focalizadas aprobadas /tmp/ppp-photo-attributes-approved.log;TypeScript aprobado /tmp/ppp-photo-attributes-approved-tsc.log. Full en curso /tmp/ppp-photo-attributes-full.log;snapshot /tmp/ppp-photo-attributes-source.json. No editar fuentes durante ejecución. Nuevos cambios locales,no desplegados todavía. Main intacta,staging runtimebfab2af6. Cero llamadas pagadas esta tanda,36/40usadas4restantes. Pendiente procedencia del mismo SKU antes/después de foto,mezclas de variantes y notas por unidad.


Corrección del criterio antes de publicar: «solo el primero» selecciona el producto, no expresa cantidad1. Se conserva cantidad existente de la primera selección ordinal;«dos del tercero»sí cambia cantidad. Las cuatro pruebas nuevas ahora acreditan qty3conservada,nota/atributo,direcciónypago,no una reducción solicitada inexistente. Global anterior /tmp/ppp-photo-attributes-full.log fue interrumpida conexit130 antes de editar fuentes;no acredita pase. Último focal34aprobadas9.712s yTypeScriptaprobado. Nueva global /tmp/ppp-photo-attributes-final-full.log,snapshot /tmp/ppp-photo-attributes-final-source.json. No editar fuentes durante ejecución.


Cierre de la primera tanda del plan: 66 suites y 3.752 pruebas aprobadas en 408,98 segundos (`/tmp/ppp-photo-attributes-final-full.log`); TypeScript aprobado (`/tmp/ppp-photo-attributes-approved-tsc.log`); todas las fuentes coinciden con snapshot final. Seis regresiones nuevas y 34 comprobaciones focalizadas. La selección ordinal de foto conserva cantidad, nota, atributos, dirección y pago; cantidades explícitas se aplican; opciones retiradas piden aclaración sin mutar. Publicación y deploy aún pendientes de verificación. Main sigue intacta. Cero llamadas pagadas en esta tanda; 36 usadas de 40, 4 restantes. Próximo bloqueo: procedencia de cantidades fusionadas del mismo SKU antes/después de una foto.


## Staging verificado — 14 de octubre de 2026, 00:03 Bogotá

Runtime `c125cd1e` desplegado y verificado. API running/healthy; imagen activa=candidata `sha256:040c74517c886aad16bfe1d95dfcb9b499c1798d8a58bfbe1fbc6a69ce34aae8`; healthok/DBconnected/circuitCLOSED. Evidencia `/tmp/ppp-photo-attributes-deploy.log` y `/tmp/ppp-photo-attributes-verified.log`. Primera consulta starting,segunda healthy. Producción verificada sigue Main49194fec. Rama staging conservada,modelos sin cambios,ninguna llamada pagada esta tanda.

Estado del plan: primer paso parcialmente completado (foto conserva nota/opción/cantidad y no captura dirección); falta procedencia para unidades del mismoSKU fusionadas antes/después deimagen. Siguiente tanda empieza por ese caso, con producto ajeno y nota diferente, antes de mejorar textos de mutación. No abrir piloto por conteo: deben pasar evaluación reservada y muestra real de medios; después piloto acotado y supervisado. Regresión final66suites/3752pruebas+TypeScript aprobados.


## Procedencia de foto y revisión Kamppo — 14/10/2026

Kamppo inspeccionado solo por lectura en /home/levi/Documents/programming/Kamppo. Ya hay módulo WhatsApp,tenantId en conversaciones e índice tenantId/waPhone,servicios separados y fixtures multi-restaurante. No ejecutar migración ni atribuir aislamiento acreditado: no se ejecutaron suites Kamppo. Notas de adaptación en docs/kamppo-engine-readiness.md;portar comportamientos/casos a tipos/IDs/opciones de Kamppo, no copiar orquestador PPP completo ni su política de puntos.

28regresiones nuevas de foto con cartas pizza/bowl y agente simulado activo/inactivo.12casos de contexto antes/después/ajeno:baseline8fallaron4pasaron /tmp/ppp-photo-provenance-baseline.log.16recorridos imagen→carrito→corrección guardan snapshot previo/firma posterior y limpian referencia con foto sin productos oilegible. Resolución de imagen y proveedores simulados;no inferencia pagada. Dos metadatos opcionales JSON,no migración DB. Primera imagen invalida contexto previo;fin de turno exitoso guarda firma solo de líneas de productos de esa foto. Corrección pide aclaración si producto ya estaba antes o líneas cambiaron después,conservando todo;productos ajenos no bloquean. No atribuir reparto exacto de unidades fusionadas:el guard pide cantidad final explícita.

Parcial de integración4fallaron porque «Agrega un [producto]» fue capturado como dirección;control de procedencia usa luego «Quiero otro [producto]» ycomprueba qty2antes deltest. Ese primer fallo NOse corrigió en esta tanda:queda como siguiente bloqueo de clasificación checkout/compra,con nombres de pizza/bowl. No esconderlo ni declarar piloto listo.102focalizadas aprobadas /tmp/ppp-photo-provenance-final-targets.log yTypeScript aprobado /tmp/ppp-photo-provenance-final-tsc.log. Global /tmp/ppp-photo-provenance-full.log;snapshot /tmp/ppp-photo-provenance-source.json. Noeditarfuentesdurantefull. Staging runtimec125cd1e hasta siguiente deploy;Main49194fec intacta. CeroAPI enesta tanda,36/40usadas4restantes.


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

Hipótesis de revisión siguiente (sin prueba ejecutada todavía): códigos distintos con nombres idénticos y precios/presentaciones diferentes. La normalización actual sustituye código por nombre; verificar que no pierda identidad SKU al resolver varias líneas. Probar primero fixture con mismo título y dos códigos/precios. No afirmar fallo confirmado ni cobertura hasta ejecutar ese recorrido. Prioridad junto a código válido+desconocido y negación sin alternativa.


Tanda mixta aprobada:66suites/4008pruebas,700.365s (/tmp/ppp-mixed-intents-full.log);TypeScriptaprobado /tmp/ppp-mixed-intents-final-tsc.log;fuente íntegra /tmp/ppp-mixed-intents-source.json.48regresiones nuevas y285focalizadas aprobadas. Pendiente publicación/deploy delcódigo validado. Main49194fec intacta. CeroAPIpagada,36/40usadas4restantes. Siguiente:SKUcon títulos repetidos (hipótesis pendiente),válido+desconocido,negación sin alternativa,consultas conopciones pendientes yvariantes lingüísticas.


Staging verificado14/10/2026 06:10Bogotá:runtime8d28d37e,running/healthy,imagenactiva=candidata sha256:304d787babc31a609cab5b3a278d25ef492c0196829c5a8a8b23b3ed15ca77e5;HTTP3301/api/healthok,DBconnected,circuitCLOSED. Evidencia /tmp/ppp-mixed-intents-deploy.log y /tmp/ppp-mixed-intents-verified.log. Main49194fec comprobada sin cambios.48regresiones nuevas,66suites/4008pruebas+TypeScript aprobados. CeroAPIpagada. Próxima tanda prioriza títulos repetidos con códigos/precios distintos,mezcla válido+desconocido ynegación sin alternativa clara. Mantener source snapshots ystagingpermanente,no promoverMain automáticamente.


## Identidad de códigos repetidos y aceptación parcial — 14/10/2026

24 regresiones nuevas con dos cartas ficticias (Trio De Tacos/Bowl Especial), dos SKU homónimos con códigos y precios distintos, agente simulado activo/inactivo, building_cart/awaiting_address/awaiting_payment. Comprueban IDs, cantidades 2/3 o una copia por omisión, precios 39.000/34.000, dirección conservada, ninguna orden externa y consultas sin compra. Código válido + #9999 añade inmediatamente el válido y explica el desconocido.

Baseline: 16/16 fallaron (/tmp/ppp-code-identity-baseline.log). Primera corrección: 12 pasaron y 4 fallaron porque la ruta de estado de un pedido interceptaba códigos de catálogo en building_cart/awaiting_address (/tmp/ppp-code-identity-target.log); no se añadió un mock para ocultar esa ruta equivocada. Ahora las cláusulas independientes de códigos se resuelven por identidad de catálogo y se procesan por el manejador multi existente antes de checkout/consulta de órdenes, respetando las guardas de negocio y pendientes. La ruta se limita a listas de código y cantidad; dirección, notas y consultas siguen el parser normal. No se sustituyen por nombres estas listas: dos títulos iguales siguen siendo dos productos distintos.

80 focalizadas aprobadas (/tmp/ppp-code-identity-target2.log); TypeScript aprobado (/tmp/ppp-code-identity-tsc.log). Global en ejecución: /tmp/ppp-code-identity-full.log; snapshot de src/**/*.ts: /tmp/ppp-code-identity-source.json. No editar fuentes durante el global. Cambios todavía locales; runtime staging anterior 8d28d37e, Main 49194fec intacta. Cero llamadas pagadas; saldo 36/40 usadas, 4 restantes.

Límites y siguiente tanda: esta corrección acredita listas independientes de códigos explícitos; no acredita un solo código de un título duplicado, listas de códigos combinadas con notas/dirección ni mezcla de código desconocido con productos por nombre. Añadir esas fronteras, atributos obligatorios y producto no disponible, negaciones sin alternativa positiva y «sin» frente a opciones válidas. No declarar piloto aprobado por el conteo de pruebas; siguen pendientes evaluación reservada, inferencia y medios originales representativos.


Cierre local de identidad: 66 suites / 4.032 pruebas aprobadas en 534.911 segundos (/tmp/ppp-code-identity-full.log), 80 focalizadas y TypeScript aprobados; snapshot íntegro. 24 regresiones nuevas. Pendiente publicación y despliegue del código validado. Main 49194fec intacta. Cero API pagada; 36/40 usadas, 4 restantes. Negación sin alternativa queda pendiente para siguiente tanda; no se ejecutó ni corrigió en este cierre.


Staging verificado 14/10/2026 07:42 Bogotá: runtime c3589adb, running/healthy, imagen activa = candidata sha256:2db338458820e8d796b352f508c80d6bb09dd33dd4782090f3d6d75d96a31fd2; HTTP3301/api/health ok, DB connected, circuit CLOSED. Evidencia /tmp/ppp-code-identity-deploy.log y /tmp/ppp-code-identity-verified.log. Main local y servidor 49194fec comprobadas sin cambios. 24 regresiones nuevas, full 66 suites/4032 pruebas y TypeScript aprobados, fuente íntegra. Cero API pagada. Siguiente: código aislado homónimo, listas con notas/dirección, atributos pendientes, negación sin alternativa; no promover Main automáticamente.


## Fronteras de código, notas, dirección y negación — 14/10/2026

60 regresiones nuevas con cartas ficticias de pizza/tacos y bowls/bebidas, modelo simulado activo/inactivo. 24 códigos aislados de títulos repetidos (elige cada SKU, cantidad2, precio real, estados building_cart/awaiting_address/awaiting_payment); 4 listas con notas propias por línea; 4 listas con dirección/placa #18-27; 4 rechazos «No con salsa picante»; 8 alternativa «mejor sin picante» disponible/no configurada; 8 SKU homónimos con Salsa y disponible/no disponible; 4 aclaración posterior Salsa Suave preserva cantidad/nota y no se convierte en pago; 4 código con nota y producto por nombre conserva la segunda compra.

Baseline inicial36:32 fallaron4 pasaron (/tmp/ppp-code-boundaries-baseline.log). Primera corrección88 focalizadas aprobadas (/tmp/ppp-code-boundaries-target.log). Negación «sin» adicional8:4 fallaron4 pasaron (/tmp/ppp-negative-sin-baseline.log): nota «sin picante» podía coexistir con Salsa:Picante o volver a pago. Se pide opción válida sin mutar ante rechazo sin alternativa configurada; si la carta tiene Sin Picante se elige esa opción. SKU con atributos/disponibilidad y seguimiento12 aprobados (/tmp/ppp-code-attributes-target.log).

resolveExplicitCodeOrder resuelve códigos a productos sin sustituir identidad por título; admite código único, notas con/sin y separa dirección final antes de resolver. Una cola con «y un/una/dos…» de otro producto vuelve al parser multi normal para no absorber la segunda compra como nota. El orquestador pasa compras explícitas por esta ruta antes de checkout/estado de pedido, con guardas de horario y opciones pendientes; respeta no disponibilidad y usa el guard/carrito existente.

156 focalizadas aprobadas (/tmp/ppp-code-boundaries-final2-target.log); TypeScript aprobado (/tmp/ppp-code-boundaries-final-tsc.log). Global en ejecución /tmp/ppp-code-boundaries-full.log; snapshot src/**/*.ts /tmp/ppp-code-boundaries-source.json. No editar fuentes durante global. Staging desplegado aún c3589adb; cambios locales. Main 49194fec intacta, cero API pagada, 36/40 usadas4restantes.

Límites: no acredita listas arbitrarias mixtas de SKU homónimos por código y productos por nombre, conectores sin cantidad, toda forma de «no/sin», cambio de varios atributos parcialmente negados ni idempotencia de correcciones posteriores. Próxima tanda debe centrarse en opciones pendientes interrumpidas por precio/cambio/negación y regreso al paso, usando recorridos completos reservados de varias cartas. Inferencia y medios reales pendientes; no declarar piloto por conteo ni promover Main automáticamente.


Cierre local de fronteras: 66 suites / 4092 pruebas aprobadas en 412.781 segundos (/tmp/ppp-code-boundaries-full.log), 156 focalizadas y TypeScript final aprobados; snapshot íntegro. 60 regresiones nuevas. Pendiente publicar y desplegar código validado. Main 49194fec intacta, cero API pagada; 36/40 usadas4restantes. Siguiente prioridad: interrupciones con opciones pendientes y retorno al mismo producto, variando cartas y preservando cantidades/notas.


Publicación/despliegue pendientes por conectividad: código validado guardado en commit local a18070ad. Primer push falló DNS github.com; segundo falló conexión443. SSH76.13.119.125 falló No route to host y reintento Connection timed out. Primer intento de despliegue no accedió al servidor (/tmp/ppp-code-boundaries-deploy.log); no acreditar nueva imagen ni salud. Último staging verificado runtime c3589adb,checkout7802e6a6. Main local comprobada49194fec, sin cambios realizados. Reintentar git push origin staging y SOLO después de éxito deploy de staging api y verificar SHA/imagen/health; conservar dist, bin y volúmenes. Las pruebas completas sí terminaron:66/4092,156focalizadas,TypeScript,snapshot íntegro,ceroAPIpagada.


## Recuperación de conectividad y cantidad contextual pendiente — 14/10/2026

La publicación pendiente se completó: origin/staging 1b87be04, runtime de código a18070ad desplegado y verificado el 14/10/2026 a las 09:03 Bogotá. Contenedor running/healthy; imagen activa = candidata sha256:b6ff1404d9bbaac4684699de4a008200faec67da445130679311ce5fd63bf61c. HTTP 3301/api/health ok, DB connected, circuit CLOSED. Evidencia: /tmp/ppp-code-boundaries-retry-deploy.log y /tmp/ppp-code-boundaries-retry-verified.log. Main del servidor 49194fec comprobada intacta. Esto cierra el bloqueo de red anterior; las nuevas correcciones de cantidad todavía no están desplegadas.

32 regresiones nuevas:
- 24 recorridos con Jugo Natural / Gaseosa Artesanal, agente simulado activo/inactivo, compra por nombre/código y nota «sin hielo», consulta de precio antes de «Mejor solo dos» / «Que sean dos por favor» / «En vez de tres quiero dos», consulta de sabores y selección final. Verifican carrito previo conservado, cantidad 2, opción y nota correctas, una sola línea añadida y ninguna orden externa.
- 4 controles: «si mejor solo pido dos cuánto cuestan» cotiza $16.000 para dos unidades sin cambiar las tres pendientes; responder «2» elige el segundo sabor y mantiene cantidad 3.
- 4 cancelaciones después de corregir cantidad: enviar un sabor después no reactiva la compra.

Baseline: 24/24 fallaron por cantidad contextual no actualizada (/tmp/ppp-pending-context-baseline.log). Primera corrección: 84 focalizadas aprobadas (/tmp/ppp-pending-context-target.log). Controles adicionales: 2 fallos / 90 aprobadas (/tmp/ppp-pending-context-final-target.log). La consulta hipotética sin repetir el producto iba al modelo legacy con agente apagado; con agente activo consultaba al modelo sin cotización determinista. Se amplía la guarda de precio pendiente para ese patrón breve y se contesta con precio/cantidad de catálogo sin mutar la compra. No se añadió un mock para ocultar esa falta de ruta.

92 focalizadas finales aprobadas (/tmp/ppp-pending-context-final2-target.log); TypeScript aprobado (/tmp/ppp-pending-context-final-tsc.log). Global en ejecución: /tmp/ppp-pending-context-full.log; snapshot de src/**/*.ts: /tmp/ppp-pending-context-source.json. No editar fuentes durante el global. Cambios locales; staging runtime a18070ad, Main 49194fec intacta. Cero API pagada; 36/40 usadas, 4 restantes.

Límites: estos patrones no cubren todas las paráfrasis, precios de opciones extra, corrección simultánea de cantidad+sabor, cambio a un nuevo SKU durante selección, referencias a varias compras pendientes ni evaluación con audio original. Siguiente: comparar cambio de cantidad frente a «otra/una más», resolver varios atributos y cotizaciones hipotéticas con otro producto nombrado. Crear recorridos reservados de varias cartas; luego inferencia/medios representativos dentro del saldo. No declarar piloto por conteo ni promover Main automáticamente.


Cierre local contextual: 66 suites / 4124 pruebas aprobadas en 414.823 segundos (/tmp/ppp-pending-context-full.log), 92 focalizadas y TypeScript final aprobados; snapshot íntegro. 32 regresiones nuevas. Pendiente publicación/despliegue de este código. Main 49194fec intacta; cero llamadas pagadas, 36/40 usadas, 4 restantes.


Staging verificado el 14/10/2026 a las 09:15 Bogotá: runtime 7ae76bf3, running/healthy, imagen activa = candidata sha256:f1994453cb9241b51b37367465266803dc894a238241bcab74c7a74948d82548. HTTP3301/api/health ok, DB connected, circuit CLOSED. Evidencia: /tmp/ppp-pending-context-deploy.log y /tmp/ppp-pending-context-verified.log. Main local y servidor 49194fec comprobadas sin cambios. 32 regresiones nuevas; 66 suites / 4124 pruebas, 92 focalizadas y TypeScript aprobados; fuente íntegra; cero API pagada. La conectividad pendiente anterior queda resuelta. Próxima tanda: sustituir frente a incrementar cantidad, varios atributos, consultas con otro producto y recorridos reservados. Mantener staging; no promover Main automáticamente.


## Reemplazo frente a incremento y atributos en un turno — 14/10/2026

40 regresiones nuevas, con agente simulado activo/inactivo y cartas ficticias:
- 20 recorridos de Jugo Natural / Gaseosa Artesanal: tres unidades pendientes; «que sean dos» deja dos, «añade dos más» deja cinco, «una más por favor» deja cuatro; reemplazo/incremento con sabor en el mismo turno resuelven cantidad y sabor. Conservan nota «sin hielo», carrito previo de dos Bowl Vegetal y una sola línea de bebida; ninguna orden externa.
- 4 consultas «si añado dos más cuánto cuestan»: informa $16.000 por las adicionales y $40.000 por cinco unidades, sin modificar las tres pendientes ni el carrito.
- 8 límites: añadir 28 a las tres pendientes o añadir cero no muta el pedido y aclara el rango 1–30.
- 8 recorridos Jugo De Avena / Bebida De Citricos: cantidad con Sabor y Endulzante en un turno. La selección explícita Stevia reemplaza Azucar previamente aplicado por defecto; se conserva la nota y se añade una sola línea.

Baseline de 24: 18 fallaron, 6 pasaron (/tmp/ppp-pending-increment-baseline.log). Primera corrección: 64 focalizadas aprobadas (/tmp/ppp-pending-increment-target.log). Límites: 72 aprobadas (/tmp/ppp-pending-increment-final-target.log). La primera fixture multia atributo suponía que Relleno/Salsa obligaban a preguntar: en este catálogo esos atributos se completan por defecto, así que no era una compra pendiente. Se ajustó la fixture a bebidas con Sabor que requiere elección, sin cambiar esa política para hacer pasar un test. Esto deja como frontera de Kamppo configurar obligatoriedad/defaults por catálogo, más allá de inferencias por nombre de atributo/producto.

El recorrido de bebidas con varios atributos reprodujo la retención incorrecta de Endulzante:Azucar pese a pedir Stevia (/tmp/ppp-pending-increment-final3-target.log). Primer intento de mezclar todas las opciones en selected antes del resolver eliminaba la progresión pendiente y falló (/tmp/ppp-pending-increment-final4-target.log). Corrección final: reemplazar solo elecciones ya presentes; los atributos nuevos pasan por el resolver habitual. No se añaden directamente productos ni se bypassan guardas.

96 focalizadas finales aprobadas (/tmp/ppp-pending-increment-final5-target.log); TypeScript aprobado (/tmp/ppp-pending-increment-final2-tsc.log). Global en ejecución: /tmp/ppp-pending-increment-full.log; snapshot src/**/*.ts: /tmp/ppp-pending-increment-source.json. No editar fuentes durante el global. Cambios locales; runtime staging 7ae76bf3, Main 49194fec intacta. Cero API pagada; 36/40 usadas, 4 restantes.

Límites y siguiente: esta tanda acredita la selección de atributos pendiente, no incrementos referidos a varias líneas ya compradas o a todas las compras de una cola. Faltan cantidad+opción inválida, nota nueva con cantidad, referencias «las otras», decrementos y preguntas sobre precios con opciones extra. Priorizar recorridos reservados completos en otras cartas e inferencia focalizada dentro del saldo disponible; no declarar piloto por conteo ni promover Main automáticamente.


Cierre local de incremento: 66 suites / 4164 pruebas aprobadas en 764.342 segundos (/tmp/ppp-pending-increment-full.log); 96 focalizadas y TypeScript final aprobados; snapshot íntegro. 40 regresiones nuevas. Pendiente publicar/desplegar esta versión. Main 49194fec intacta; cero API pagada, 36/40 usadas, 4 restantes.


Staging verificado el 14/10/2026 a las 09:40 Bogotá: runtime 03c89636, running/healthy, imagen activa = candidata sha256:41513d66d09e395c088280a63a5762d05c7a133e4927f774ca7511be474d3a1d. HTTP3301/api/health ok, DB connected, circuit CLOSED. Evidencia: /tmp/ppp-pending-increment-deploy.log y /tmp/ppp-pending-increment-verified.log. Main local y servidor 49194fec comprobadas sin cambios. 40 regresiones nuevas; 66 suites / 4164 pruebas, 96 focalizadas y TypeScript aprobados; snapshot íntegro. Cero API pagada. Próxima prioridad: recorridos completos reservados de otras cartas y evaluación focalizada con modelo real dentro de las 4 solicitudes restantes; no convertir el conteo en aprobación de piloto. Mantener staging, no promover Main automáticamente.


## Recorridos completos reservados y diagnóstico con modelo real — 14/10/2026

15 regresiones nuevas:
- 6 recorridos completos en tres cartas ficticias (hamburguesa/jugo, pizza/gaseosa, sandwich/bebida), agente simulado activo/inactivo: precio, compra por código con nota, cotización de incremento mientras espera sabor, incremento+sabor, dirección, cambio de dirección, consulta de total y efectivo hasta awaiting_final_confirm. Verifican cantidades 2+5, notas, precio total $78.500, dirección vigente y ausencia de órdenes externas.
- 6 controles de narración de comensales: sin acciones válidas del modelo, conserva el carrito vacío y pide aclaración; no inventa un ejecutivo ni cantidades. PPP y dos cartas ficticias.
- 3 replays de acciones estructuradas: uno usa la salida real versionada en scripts/fixtures/whatsapp-recorded-narrative-output.json; dos cambian a cartas de curry/pasta/pizza. Verifican cantidades 2/1/3 o 3/1/4 y notas.

Los seis recorridos iniciales fallaron en precio: una pregunta sobre la bebida pendiente respondía el precio del plato del carrito (/tmp/ppp-reserved-flows-baseline.log). Se prioriza el producto pendiente para preguntas sin nombre; un producto nombrado sigue siendo explícito. Después apareció una cola pendingMultiOrder vacía que impedía avanzar al dar dirección (/tmp/ppp-reserved-address-probe2.log): popCompletedNeedsAttribute descarta la cola solo cuando no quedan opciones, productos o desconocidos. El recorrido llegó a pago después de corregirlo.

Evaluación aislada con configuración efectiva de staging y modelo gpt-4.1-2025-04-14: un pedido narrado («somos tres», dos churrascos, un arroz, una limonada para cada uno) primero falló sin API porque la ruta determinista inventaba ejecutivos; tras corregir la inferencia de almuerzo todavía inventaba una bandeja y confundía tres cuartos con cuarto de pollo. Se dirige una nueva compra narrada por comensales al agente antes de segmentación insegura; sin agente/acciones válidas se pide cantidad por producto sin mutar carrito. La introducción «almuerzo: somos…» no es un SKU ejecutivo.

El modelo hizo 3 solicitudes exitosas e interpretó correctamente 2 churrascos / 1 arroz / 3 limonadas, con notas. El backend guardó 1/1/1, por perder el contexto grupal al recortar el texto de cada producto. Informe /tmp/ppp-reserved-model-report.json, log /tmp/ppp-reserved-model-run.log. No se acredita ese ensayo como aprobado: el carrito fue incorrecto. El oráculo también pedía nota literal «3/4», aunque la respuesta decía correctamente «tres cuartos»; los replays verifican el término equivalente y la nota sin ensalada.

Corrección posterior SOLO validada offline: extractQuantityNearProduct reconoce cantidades asociadas a «dos van a comer» y «para cada uno una» con un grupo explícito; resolveAddItemQuantity conserva el texto grupal para esa distribución. Se respetan cantidades respaldadas por el mensaje, sin confiar ciegamente en la IA. No se repitió inferencia después de corregir. La salida real queda como fixture sintética reproducible, sin credenciales ni mensajes externos.

Presupuesto: 39/40 intentos usados, 1 restante. El registro local work/authorized-model-budget.json estaba en 25/40; se sincronizó al versionado más restrictivo antes de gastar y a 39/40 después. docs/whatsapp-model-budget.json y AGENTS.md actualizados. Clave y prompt recuperados del contenedor en memoria, nunca impresos ni guardados; launcher temporal eliminado. No cambiar modelos. No nuevas llamadas sin revisar el saldo; una llamada restante no garantiza completar un turno con tools.

233 focalizadas generales/named-menu aprobadas (/tmp/ppp-reserved-flows-broader-target.log). Tras convertir la captura real a fixture, 15 nuevas aprobadas (/tmp/ppp-reserved-flows-recorded-target.log), TypeScript final aprobado (/tmp/ppp-reserved-flows-recorded-tsc.log). Global en ejecución /tmp/ppp-reserved-flows-full.log, snapshot src/**/*.ts /tmp/ppp-reserved-flows-source.json. No editar fuentes durante global. Staging runtime03c89636; Main49194fec intacta; cambios nuevos aún locales.

Límites: esta tanda acredita los recorridos descritos y aplicación de las acciones capturadas. No acredita segunda ejecución pagada, todos los pedidos narrados, todos los grupos/alias/typos, cantidades incoherentes ni todas las formas de «cada uno». Las narraciones existentes en checkout/carrito previo siguen siendo frontera. Las conversaciones reservadas que fallaron y guiaron una corrección pasan a regresión; dejan de ser evaluación independiente. Crear otra muestra reservada y probar inferencia representativa antes de declarar piloto. Referencia de metodología consultada con OpenAI Docs: https://developers.openai.com/api/docs/guides/evaluation-best-practices.


## Integración de cambios concurrentes, consultas inesperadas y cobertura — 14/10/2026

La ejecución anterior /tmp/ppp-reserved-flows-full.log terminó con 26 fallos y 4153 aprobadas, pero la fuente cambió durante la ejecución; no acredita la versión integrada. Se preservaron los cambios concurrentes de saludo, reparto por persona, reparto incoherente, pedido previo, selección del más barato y consultas ajenas. Las regresiones de precio revelaron una prioridad demasiado amplia del atributo pendiente: se restringe a consultas por unidad o cantidades hipotéticas; el precio general del carrito y las listas de precios conservan su comportamiento.

Familias añadidas en esta integración: 36 interrupciones en nombre/teléfono/dirección/pago/confirmación/sabor, 16 favores externos con cortesía/typos, 12 consultas de cobertura y 24 preguntas no previstas. Agente simulado activo/inactivo, cartas sintéticas, estado y sesión completos sin mutación, opciones pendientes conservadas y ninguna orden externa. El agente no puede aplicar addItems, clearCart, notas ni lookupPlacedOrder cuando responde estas consultas. La guarda se ejecuta antes de las consultas externas y la aplicación de acciones. Se usa un recordatorio del paso pendiente, sin repetir el carrito entero.

Cobertura: con cuatro productos ya en el carrito, la respuesta recuerda esos cuatro y permite continuar; no invita a iniciar un pedido vacío. La cotización se calcula sobre una copia y no cambia la dirección guardada. El caso no autoriza cambiar domicilio ni cantidad. Con carrito vacío mantiene la invitación a pedir; con sabor pendiente conserva esa elección. No se redefine aquí el timeout de sesión ni se interpreta un nuevo pedido ambiguo como reemplazo automático.

Revisión de respuestas encontró falsos platos en «somos cuatro», «cada uno quiere» y «para cada uno de nosotros»: cantidades correctas, pero texto de error incorrecto. Se descartan únicamente las cláusulas estructurales del reparto explícito y se fortalecen los ocho recorridos de cartas diferentes para exigir ausencia de «no tenemos/no manejamos». Los productos desconocidos siguen sujetos a validación.

291 focalizadas aprobadas (/tmp/ppp-context-integration-target7.log); TypeScript aprobado (/tmp/ppp-context-integration-tsc7.log). Global en ejecución: /tmp/ppp-context-integration-full.log; snapshot de src/**/*.ts: /tmp/ppp-context-integration-source.json. No editar fuentes durante el global; comparar snapshot antes de acreditar resultado. Código aún local, runtime staging03c89636. Main49194fec intacta. Sin nuevas llamadas pagadas: 39/40 usadas, 1 restante; no alcanza para asegurar un turno con tools completo.

Pendientes posteriores: otra muestra reservada independiente con reparto/narración y preguntas fuera del flujo; validación real del carrito 2/1/3 corregido offline; audio original representativo cuando esté disponible; cobertura dudosa y confirmación expresa de destino, sesión expirada frente a pedido nuevo. Las pruebas con agente simulado no acreditan comprensión real universal. No promover Main automáticamente ni declarar vendible por cantidad de pruebas.


Global integrado inicial: 65 suites aprobadas/1 fallida; 4431 pruebas aprobadas/14 fallidas, 4445 totales, 442.47s (/tmp/ppp-context-integration-full.log). Fuente estable. La ruta genérica de pregunta inesperada capturaba cambios de acompañamiento («cambien»), alergia e interrogantes sobre sopa; además el mock de modelo devolvía «¿Cuál prefieres?» para instalaciones conocidas. Se restringe el detector para preservar contexto de comida/alergia y formas de cambiar; las instalaciones conocidas vuelven al handler determinista, con recordatorio breve del pedido y sin carrito completo ni llamada al modelo. Se conserva la expectativa previa de responder con referencia al local; la nueva prueba acredita que esa vía no usa el agente. No se reduce la cobertura de los tests de acompañamientos/alergia.

362 focalizadas finales aprobadas (/tmp/ppp-context-integration-target8.log) y TypeScript aprobado (/tmp/ppp-context-integration-tsc8.log). Nueva ejecución global /tmp/ppp-context-integration-final-full.log, snapshot /tmp/ppp-context-integration-final-source.json. No desplegar ni acreditar resultado hasta final verde y fuente estable.


Cierre local integrado:66 suites /4445 pruebas aprobadas en451.396s (/tmp/ppp-context-integration-final-full.log),362 focalizadas y TypeScript aprobados; snapshot src/**/*.ts íntegro. Son281 nuevas pruebas respecto al último global4164. La primera global integrada falló14 y no se acredita; la ejecución final cubre las regresiones corregidas. Pendiente publicación/despliegue staging. Main49194fec intacta. No se repitió evaluación pagada;39/40 usadas,1 restante.


Publicado staging a7930a70 y API reconstruida. Imagen activa igual a candidata sha256:108c01aa6275a6f1fac55fcfe9d97968ae9c3c523645394d94e15009dcd37681. HTTP3301/api/health ok, DB connected, circuit CLOSED; Docker running/healthy comprobado el14/10/2026 a las11:42 Bogotá. Main servidor49194fec intacta. Evidencia /tmp/ppp-context-integration-deploy.log y /tmp/ppp-context-integration-verified.log.


## Cantidades después de cobertura y referencias cortas — 14/10/2026

72 regresiones nuevas, cartas ficticias de sopa/pizza/ramen, agente simulado activo/inactivo y router completo:
-36 recorridos con cuatro unidades y otro producto: consultar cobertura sin cambiar destino, añadir una, dejar solo una, reconsiderar dos en total, quitar una, consultar precio e hipotético de añadir una. Conservan nota, otro producto y no crean órdenes externas.
-18 controles de incremento: cero, total mayor de30 y dos líneas del mismo producto con notas distintas. No mutan; rechazan rango o piden precisar la línea.
-18 referencias cortas: «Mejor solo una» reemplaza cuatro por una, «Una más por favor» incrementa a cinco, dos líneas posibles obligan a aclarar. Se conserva nota y no se invoca orden externa.

Baseline36:18 fallos (/tmp/ppp-after-coverage-baseline.log). «Agrega una más» añadía una segunda línea con nota «más por favor»; «Quita una» borraba toda la línea; un hipotético nombrado perdía el plato. Correcciones: incremento explícito sobre una línea inequívoca usa cantidad absoluta con límites; la eliminación reconoce «una PLATO» como una unidad; la consulta hipotética extrae el nombre sin comprar. Se comprobó que la normalización previa convierte «agrega» a «quiero», por eso el incremento reconoce ambos, solo con «más» explícito.

Baseline de referencias cortas18/18 falló (/tmp/ppp-after-coverage-short-baseline.log). «Solo una» se confundía con variante sin combo; se prioriza exclusivamente la corrección corta de unidades antes de cambio de variante. Si faltan opciones de otra compra, no se asigna esa referencia a un plato del carrito. No inferir el referente entre varias líneas.

78 focalizadas aprobadas (/tmp/ppp-after-coverage-target5.log),24 controles de eliminación aprobados (/tmp/ppp-after-coverage-removal.log),TypeScript aprobado (/tmp/ppp-after-coverage-final2-tsc.log). Global en ejecución /tmp/ppp-after-coverage-full.log, snapshot /tmp/ppp-after-coverage-source.json. No editar src durante la ejecución; comprobar snapshot antes de acreditar. Código local; runtime staging a7930a70, Main49194fec intacta. Cero nuevas solicitudes API;39/40 usadas,1 restante.

Límites: no acredita todas las expresiones de decremento, incrementos compuestos con notas nuevas, selección posterior de la línea ambigua ni nueva inferencia real. Siguiente: «dos menos», incremento/corrección más opción o nota en un turno, conservación de compra pendiente al modificar otra línea y sesión expirada frente a nuevo pedido. No declarar piloto por conteo ni promover Main sin solicitud.


Cierre local de cantidades tras cobertura:66 suites/4517 pruebas aprobadas en447.558s (/tmp/ppp-after-coverage-full.log); snapshot íntegro.72 nuevas pruebas;78 focalizadas,24 controles de eliminación y TypeScript aprobados. Pendiente publicación/deploy. Main49194fec intacta. Cero API nueva;39/40 usadas,1 restante.


Staging verificado el14/10/2026 a las11:59 Bogotá: runtime5654678e, running/healthy, imagen activa=candidata sha256:e75ce770c25c87ce84cca3802dd51e88d220d97a6497cbe7dfc5b81ff19f87c5. HTTP3301/api/health ok, DB connected, circuit CLOSED. Evidencia /tmp/ppp-after-coverage-deploy.log y /tmp/ppp-after-coverage-verified.log; el primer chequeo Docker starting se completó como healthy antes de cerrar. Main local/servidor49194fec comprobadas intactas.72 regresiones nuevas,66 suites/4517 pruebas,78 focalizadas,24 controles de eliminación y TypeScript aprobados. Fuente estable. Cero API nueva,39/40 usadas,1 restante. Próxima tanda: decremento «dos menos», cantidad con opción/nota nueva, edición de otra línea sin perder compra pendiente.


## Decrementos y edición sin perder otra compra — 14/10/2026

64 pruebas nuevas con router real, modelo/Meta/persistencia simulados, cartas ficticias y agente activo/inactivo:
-12 recorridos con cuatro platos y tres bebidas pendientes de Sabor: corregir cantidad absoluta o quitar una unidad del plato conserva pendingAttribute y estado awaiting_attribute; responder Lulo después añade tres bebidas con nota sin hielo.
-12 decrementos explícitos («dos menos de PLATO», «quita dos unidades de PLATO») dejan dos de cuatro, conservando nota.
-8 recorridos de cantidad+sabor+nota en un turno: «Mejor solo dos con Lulo y sin hielo» o «Una más con Lulo y sin hielo»; conservan sin azúcar de la compra inicial y añaden sin hielo, sin duplicar producto.
-24 controles: cero, quitar más unidades de las anotadas, quitar todas las unidades y referente ambiguo. Conservan otras líneas; rechazan rango/referencia cuando corresponde.
-4 controles de nota inicial válida al elegir sabor.
-4 controles de eliminación completa con nombres que incluyen números (1 Pollo Frito, Dos Empanadas). El número del nombre no es la cantidad a retirar.

Baseline válido de32 casos falló32 (/tmp/ppp-decrement-pending-baseline2.log). La primera fixture no compiló por poner note en pendingAttribute, cuyo contrato guarda notas en sourceText; no se acredita ese intento como ejecución de casos. Se ajustó a sourceText. Para la nota inicial se usa «sin azúcar» y controles de selección normal, sin suponer que una nota desconocida está soportada.

Correcciones: los decrementos explícitos se convierten en cantidad absoluta o eliminación completa con las guardas existentes; rechazan negativos/cero/exceso o múltiples líneas posibles. Edición y eliminación de una línea conservan una compra pendiente de atributos de otro SKU, con recordatorio de sabor. Cantidad+sabor ahora incorpora la nota detectada al sourceText de la compra pendiente antes de continuar por el resolver de opciones. No se modificó el modelo ni se aplicaron excepciones PPP.

136 focalizadas aprobadas (/tmp/ppp-decrement-pending-target3.log), TypeScript aprobado (/tmp/ppp-decrement-pending-final2-tsc.log). Global en ejecución /tmp/ppp-decrement-pending-full.log; snapshot src/**/*.ts /tmp/ppp-decrement-pending-source.json. No editar fuentes hasta finalizar y comparar snapshot. Código aún local; runtime staging5654678e. Main49194fec intacta. Cero nuevas llamadas pagadas;39/40 usadas,1 restante.

Límites: conserva otra compra con pendingAttribute de SKU diferente; no acredita edición de una línea frente a otra compra del mismo SKU ni todos los pendingMatch/pendingMulti. Los decrementos cubren las dos formas explícitas, no «menos dos» sin producto ni pedidos colectivos. Pendiente otra muestra independiente y modelo/canal reales; no declarar piloto por conteo.


Cierre local de decrementos y compra pendiente:66 suites/4581 pruebas aprobadas en447.724s (/tmp/ppp-decrement-pending-full.log),snapshot src íntegro.64 regresiones nuevas;136 focalizadas y TypeScript aprobados. Pendiente publicar/desplegar. Main49194fec intacta. Cero API nueva;39/40 usadas,1 restante.


Staging verificado el14/10/2026 a las12:30 Bogotá: runtime73419c8f, running/healthy, imagen activa=candidata sha256:10a9dee121243376dd52f7f755251aa25f722eed475cbb4c66904201bb720306. HTTP3301/api/health ok,DB connected,circuit CLOSED. Evidencia /tmp/ppp-decrement-pending-deploy.log y /tmp/ppp-decrement-pending-verified.log; primer Docker starting confirmado healthy antes de cerrar. Main local/servidor49194fec intactas.64 regresiones nuevas;66 suites/4581 pruebas,136 focalizadas,TypeScript y snapshot aprobados. Cero API nueva;39/40 usadas,1 restante. Próxima tanda: edición frente a otra compra del mismo SKU, pendingMatch/pendingMulti y referencias ambiguas con correcciones; no promover Main automáticamente.


## Mismo SKU en carrito y compra pendiente; listas simultáneas — 14/10/2026

50 regresiones nuevas, router completo y dependencias externas simuladas, tres cartas ficticias y agente activo/inactivo:
-24 casos de bebida ya agregada ×4 sabor Mango y otra compra del mismo SKU ×3 pendiente: corrección absoluta, quitar una o agregar una más sin opción deben aclarar carrito vs pendiente; «deja solo dos PRODUCTO con Mango» identifica la línea, conserva la compra pendiente y luego permite añadir tres Lulo con la nota inicial.
-6 controles: «Mejor solo dos con Lulo» modifica únicamente la compra pendiente; conserva los cuatro Mango del carrito y sus notas.
-8 recorridos de listas abiertas: aclaración de cantidad entre dos líneas, consulta de precio entre dos SKU, con/sin otra bebida pendiente. «2» no se asigna a la lista de precios mientras hay otra selección. El nombre del producto resuelve precio sin alterar la aclaración de cantidad; si queda selección de sabor y cantidad, otro «2» sigue siendo ambiguo. Sin otra selección, «2» corrige la segunda línea y conserva las demás.
-12 casos de referente: varias líneas del mismo SKU y otra compra pendiente obligan a aclarar sin crear otra lista; si ese SKU solo existe en la compra pendiente, «que sean dos PRODUCTO» modifica su cantidad, conserva el carrito previo y permite completarla.

Baseline30/30 falló (/tmp/ppp-same-product-baseline.log); las correcciones borraban la compra pendiente, y la preferencia «solo» podía cambiar/reemplazar el carrito aunque acompañara una cantidad y una opción de la compra pendiente. Correcciones: cotejar tanto líneas como compra pendiente por nombre/opciones ya seleccionadas; pedir aclaración antes de mutar o abrir una lista si ambos referentes coinciden. Una opción propia del carrito identifica la línea y conserva la compra pendiente incluso siendo el mismo SKU. «Solo + cantidad + opción» no se interpreta como variante solo/combo al corregir la compra pendiente.

La primera ejecución de listas no compiló por un atributo opcional no comprobado; se corrigió la fixture. Resultado integrado posterior:4 fallos/66 aprobadas (/tmp/ppp-same-product-target3.log),todos en precio+aclaración de cantidad sin sabor pendiente: otherOpenList no incluía pendingCartQuantity/removal. Se añaden ambas, y una lista de cantidad no consume números de otra selección activa. Baseline de referente12/12 falló (/tmp/ppp-same-product-referents-baseline.log),por crear lista antes de comprobar la compra pendiente o decir que el producto no estaba en carrito aunque sí se estaba eligiendo. Se corrige la prioridad sin descartar la compra.

86 focalizadas finales aprobadas (/tmp/ppp-same-product-target4.log),TypeScript aprobado (/tmp/ppp-same-product-final-tsc.log). Global en ejecución /tmp/ppp-same-product-full.log; snapshot src/**/*.ts /tmp/ppp-same-product-source.json. No editar src hasta completar y comparar snapshot. Código aún local; runtime staging73419c8f,Main49194fec intacta. Cero API nueva;39/40 usadas,1 restante.

Límites: referente identificado por nombre/opciones del catálogo; notas libres como selector, pendingMatch con múltiples productos y multiorden con varias necesidades siguen requiriendo otra tanda. No acredita modelo/canal reales ni todas las referencias. Mantener staging; no promover Main ni declarar piloto por conteo.


Cierre local de referentes y listas:66 suites/4631 pruebas aprobadas en446.443s (/tmp/ppp-same-product-full.log),snapshot íntegro.50 regresiones nuevas;86 focalizadas y TypeScript aprobados. Pendiente publicación/deploy staging. Main49194fec intacta. Cero API nueva;39/40 usadas,1 restante.


Staging verificado el14/10/2026 a las12:49 Bogotá: runtime60f17cb9,running/healthy,imagen activa=candidata sha256:c039574e1eb8f1d4a77de21055bb0f00c3749644137aa5625014e242fc6a26db. HTTP3301/api/health ok,DB connected,circuit CLOSED. Evidencia /tmp/ppp-same-product-deploy.log y /tmp/ppp-same-product-verified.log. Main local/servidor49194fec intactas.50 regresiones nuevas;66 suites/4631 pruebas,86 focalizadas,TypeScript y snapshot aprobados. Cero API nueva;39/40 usadas,1 restante. Próxima prioridad: referentes por notas libres,pendingMatch y multiórdenes con varias necesidades; otra muestra independiente y modelo/canal reales antes de acreditar piloto.


## Promoción autorizada a Main — 14/10/2026

El usuario pidió «pasa todos los cambios a main, y continua con las pruebas». Main local/origin se avanzó por fast-forward49194fec→d9241abe; fuente src idéntica al snapshot validado de66 suites/4631 pruebas. Staging se conserva. Producción /var/www/ppp-nest actualizada a d9241abe y reconstruida con compose efectivo docker-compose.yml/proyecto ppp-nest, sin volumen de fuente. Se conservaron adaptación local del compose y backups; imagen anterior preservada como ppp-nest-api:before-main-d9241abe.

Verificación14/10 a las12:53 Bogotá: ppp_nest_api running, imagen activa=ppp-nest-api sha256:6c0e72f8ac8161d610b56b1c10ee446e0c963ed1c747ffeac90c691b4e8d0279. Sin healthcheckDocker; HTTP3000/api/health ok,DB connected,circuit CLOSED. Orquestador compilado idéntico entre prod y staging: sha256551e39ccfbd383e13d0585b9b90792df01163afc573ee93794091fe57f4d4cba. Evidencia /tmp/ppp-main-d9241abe-deploy.log y /tmp/ppp-main-d9241abe-verified.log. No se cambiaron modelos/credenciales ni se ejecutaron órdenes reales. Frontend sin archivos cambiados en esta promoción. Presupuesto39/40,1 restante.

Las pruebas nuevas continúan únicamente en staging. Esta autorización acredita la promoción realizada; no promover automáticamente mejoras posteriores.


## Referentes por notas con/sin — tanda posterior a promoción Main

24 regresiones nuevas con cartas sintéticas sopa/pizza/ramen y agente simulado activo/inactivo.12 recorridos corrigen a dos unidades solo la línea «con cilantro» o «sin cilantro»,conservando la otra línea y una bebida.12 controles: una nota que menciona otro producto no cambia la identidad del SKU; dos líneas con la misma nota requieren elegir línea; si carrito y compra pendiente comparten el mismo SKU y nota, se aclara carrito vs pendiente sin mutación.

Baseline12/12 falló (/tmp/ppp-note-reference-baseline.log). correctionMatchesLine no consideraba notas. Corrección: las notas pueden aportar tokens cuando califican el referente con con/sin; exige la polaridad y frase explícitas,no confunde «con cilantro» con «sin cilantro». Sin ese calificador sigue usando identidad/opciones del producto para impedir que una nota con nombre de comida convierta una bebida en ese plato. La comparación con la compra pendiente incluye su nota extraída de sourceText. Sin excepciones de restaurante.

91 focalizadas aprobadas en dos suites (una tercera filtrada quedó skipped: no acreditar esa suite como ejecutada) /tmp/ppp-note-reference-target2.log;TypeScript aprobado /tmp/ppp-note-reference-final-tsc.log. Global en ejecución /tmp/ppp-note-reference-full.log;snapshot /tmp/ppp-note-reference-source.json. No editar src hasta finalizar y comparar snapshot. Main/producción d9241abe ya promovida y verificada;estas nuevas mejoras están solo locales en staging,runtime staging60f17cb9. Cero API nueva;39/40 usadas,1 restante.

Límites: selectores con/sin, no todas las notas libres ni contradicciones o paráfrasis. Pendiente multiorden con varios productos/opciones, muestras independientes y modelo/canal reales. No promover automáticamente esta tanda posterior a Main.


Cierre local de notas:66 suites/4655 pruebas aprobadas en443.632s (/tmp/ppp-note-reference-full.log),snapshot íntegro.24 nuevas;91 focalizadas y TypeScript aprobados. Pendiente publicar/deploy staging. Main/producción d9241abe permanecen en promoción anterior. Cero API nueva;39/40 usadas,1 restante.


Staging verificado el14/10/2026 a las13:05 Bogotá: runtime d1467c0f,running/healthy,imagen activa=candidata sha256:acbabb867d0af6f80afd926d24014787ad971516d954f7fa2347766dee79c7f2. HTTP3301/api/health ok,DB connected,circuit CLOSED. Evidencia /tmp/ppp-note-reference-deploy.log y /tmp/ppp-note-reference-verified.log;primer Docker starting confirmado healthy antes del cierre. Main local/origin/producción d9241abe conservan la promoción autorizada anterior;staging preservada y ahora tiene24 regresiones/correcciones posteriores.66 suites/4655 pruebas,91 focalizadas,TypeScript y snapshot aprobados. Cero API nueva;39/40 usadas,1 restante. Siguiente: selección por referencia después de pedir aclaración,multiorden con varios atributos y muestra independiente/modelo/canal reales.


## Listas con nombres completos y aclaraciones que continúan — 14/10/2026

62 regresiones nuevas, con router completo/dependencias simuladas y agente activo/inactivo:
-12 recorridos PPP y cartas sintéticas pizza/ramen: consulta de productos muestra nombre íntegro,precio y código de cada candidato; elección por fila o código termina agregando el SKU correcto ×1. Si falta una opción real (Pollo del combo PPP), se resuelve por el flujo normal, sin saltarla.
-18 consultas de descripción de opción: «qué trae la opción2»,«qué incluye la segunda»,«cómo es la opción2». Responde catálogo, mantiene carrito vacío y lista original para compra posterior.
-16 recorridos de precio con otra bebida pendiente: «el precio del segundo»,«precio2»,«el precio de la segunda» o nombre explícito resuelven precio; conservan tres bebidas pendientes, sabor y nota; luego Lulo termina correctamente.
-16 controles de rango/otras listas activas: consultar opción99 o precio99 no modifica; con lista de precios o sabor simultáneos se aclara la referencia y no se elige por número a ciegas.

Baseline de nombres6/6 falló (/tmp/ppp-full-menu-names-baseline.log): abreviaciones «Combo(con bebida)» indistinguibles y «Porcion De» incompleto. Se usa nombre completo en lista informativa y prompt de variantes. Se conserva orden/IDs/códigos/precios; no cambia selección ni defaults. La primera prueba de compra usaba códigos sintéticos de5 dígitos fuera del formato y suponía que un combo PPP sin tipo de pollo podía añadirse directamente. Se ajustan códigos válidos separados de IDs y se completan atributos requeridos; no se cambia esa política para hacer pasar tests.

Baseline de precio12/12 falló (/tmp/ppp-price-clarification-baseline.log); la etiqueta explícita «precio» permite resolver esa lista aunque haya otra opción abierta, pero números sin etiqueta siguen siendo ambiguos. Baseline de descripción6/6 falló (/tmp/ppp-list-description-baseline.log): se desviaba al handler de pregunta ajena, repetía contexto y no daba descripción. Se agrega ruta de consulta read-only de opción de lista antes de ese handler; valida índice, usa catálogo vigente y no compra ni descarta la lista. No cubre rendimientos/gramos ni inventa esas cifras.

74 focalizadas finales aprobadas (suite general) /tmp/ppp-full-menu-names-target5.log;TypeScript aprobado /tmp/ppp-full-menu-names-final3-tsc.log. Global en ejecución /tmp/ppp-full-menu-names-full.log;snapshot /tmp/ppp-full-menu-names-source.json. No editar src hasta terminar/comparar snapshot. Código local;runtime staging d1467c0f. Main/producción d9241abe intactas. Cero API nueva;39/40 usadas,1 restante.

Límites: aclaración explícita precio por nombre/número/ordinal1–4 y descripción de opción por número/ordinal1–4; no todas las paráfrasis ni respuestas cortas «sí» después de descripción. Sigue pendiente muestra independiente/modelo/canal y multiorden con varias elecciones. No promover automáticamente a Main.


Cierre local de nombres y aclaraciones:66 suites/4717 pruebas aprobadas en447.436s (/tmp/ppp-full-menu-names-full.log),snapshot íntegro.62 nuevas;74 focalizadas y TypeScript aprobados. Pendiente publicación/deploy staging. Main/producción d9241abe conservan promoción anterior. Cero API nueva;39/40 usadas,1 restante.


Staging verificado el14/10/2026 a las13:29 Bogotá: runtime f9128032,running/healthy,imagen activa=candidata sha256:9863f5a87b6837993fc090ce56962bb19ce428273e9318a98c6afab45f02396b. HTTP3301/api/health ok,DB connected,circuit CLOSED. Evidencia /tmp/ppp-full-menu-names-deploy.log y /tmp/ppp-full-menu-names-verified.log. Main local/producción d9241abe conservan promoción anterior.62 nuevas;66 suites/4717 pruebas,74 focalizadas,TypeScript y snapshot aprobados. Cero API nueva;39/40 usadas,1 restante. Siguiente: «sí, ese» después de describir una opción,cierre de aclaraciones por nombre/notas,multiorden con varias elecciones,muestra independiente y modelo/canal. No promover esta tanda a Main automáticamente.


## Integración de aclaraciones y pedidos múltiples — 14/10/2026

Se revisaron y conservaron los cambios locales nuevos del usuario: referencia al producto descrito («sí, ese»), selección de líneas por nombre/notas, varias elecciones y atributos en un turno, reparto en dos/tres partes y separación de «somos tres» del nombre de un producto. 386 regresiones focalizadas pasaron con menús PPP y sintéticos, agente activo/inactivo.

La revisión descubrió un fallo de polaridad en la selección por nota: «el que va con cilantro» elegía una línea «sin cilantro» por coincidencia de palabras libres. Ocho regresiones secuenciales fallaron antes de corregirlo. Ahora la referencia conserva con/sin y admite «el que va sin cilantro» para resolver después de rechazar una referencia incorrecta; cubre cantidad y eliminación en sopa/pizza. Evidencia baseline: /tmp/ppp-local-note-polarity-baseline.log.

394 focalizadas finales aprobadas (/tmp/ppp-current-local-batch-final-target.log), TypeScript aprobado (/tmp/ppp-current-local-batch-final-tsc.log). Global en ejecución: /tmp/ppp-current-local-batch-full.log; snapshot: /tmp/ppp-current-local-batch-source.json. No considerar publicado hasta cierre global y verificación del deploy. Main/producción d9241abe permanecen intactas. Cero llamadas API nuevas; 39/40 usadas, una restante.

Estos son recorridos del router con dependencias externas simuladas. Falta validar muestras independientes y el modelo/canal real; no equivalen a comprensión universal ni aprobación comercial. Seguir trabajando en staging; no promover automáticamente a Main.


Actualización de validación: la primera global no pasó: 65 suites aprobadas, una fallida; 5107 pruebas aprobadas y cuatro regresiones al resolver un cambio compuesto por nombre. Se conservaba la opción pero se perdía la nota. Ahora se recupera la nota del texto original del cambio pendiente, sin reinterpretar el selector de línea como una modificación nueva. Fuente del primer run intacta.

El usuario aportó «Por favor me envias Un cuarto De Pollo frito con arto aji». Dos recorridos exactos fallaron también en staging local. Se corrige limpieza de cortesía inicial, equivalencia de porciones 1/4 ↔ cuarto / 1/2 ↔ medio para separar notas del producto y reconocimiento de «me envías» como solicitud explícita. No se incluyen productos/códigos PPP en las reglas nuevas. 24 recorridos con pizza, ramen, bowl y tacos ficticios, tres formulaciones de cortesía, también pasan. Antes del último ajuste 16 fallaron porque «me envías» se trataba como consulta.

424 focalizadas aprobadas /tmp/ppp-current-local-batch-target-final2.log. El caso real termina en un cuarto de pollo frito ×1 con nota «con harto ají», tras elegir presa si corresponde. Pendiente nueva global y TypeScript de fuente final; no desplegado todavía. Logs de fallos preservados.


Cierre de integración y cortesía: 66 suites/5137 pruebas aprobadas en 478.738s, fuente íntegra (/tmp/ppp-current-local-batch-full-final.log, snapshot final). 420 regresiones nuevas respecto a 4717; 424 focalizadas (incluyen cuatro regresiones históricas), TypeScript aprobado. Pendiente publicar y desplegar staging. Main d9241abe intacta; cero API nueva. Nuevo caso aportado después: alias maduro/plátano y compra «dame dos» después de pregunta de rendimiento; no afirmar corregido por esta tanda.


Publicada tanda 52e4b9e1 en origin/staging y reconstruida API. Primera comprobación: running/starting, HTTP ok, DB connected, circuit CLOSED, imagen activa=candidata sha256:a538446bd4a71e5c124752bcc6debb475629e810f51682599c4fb630dd55c346. Pendiente confirmar healthy. Evidencia /tmp/ppp-current-local-batch-deploy.log y /tmp/ppp-current-local-batch-verified.log. Main/producción d9241abe intacta.

Siguiente tanda abierta: cuatro tests «Maduro y compra después de rendimiento — chat real» añadidos después de congelar/publicar la fuente validada; todos fallan en /tmp/ppp-maduro-yield-baseline.log. Modificación local de whatsapp-general-accuracy.spec.ts sin publicar. No descartar ni cambiar oráculos para obtener verde. 5137 es el último conjunto validado, no el estado actual con las cuatro nuevas regresiones rojas. SKU53 existe en fixture como Platano Con queso y Bocadillo. Casos: disponibilidad «Hola buenas tardes tienes maduro con queso y bocadillo» debe reconocer sin comprar; luego «Un platano maduro con queso y bocadillo», «Si por favor, Para cuantas persona's alcanza?», «De acuerdo entonces Dame dos» debe conservar referencia y comprar dos, sin inventar rendimiento. Probar también ambigüedad real, otra consulta que cambia foco y catálogos sintéticos.

Staging confirmado running/healthy a las16:41 Bogotá, HTTP ok/DB connected/circuit CLOSED. Runtime52e4b9e1, imagen activa=candidata indicada arriba. No cambios en Main/producción. Siguiente tanda roja permanece local, separada del deploy validado.


Nuevo defecto confirmado 14/10, después de deploy52e4b9e1: combo broaster con papas saladas / respuesta «Lo quiero normal con papa Francesa pero que Le agreguen unas Tres papitas saladas asi como siemore me envian». Se agregó recorrido local «Combo pendiente — aclaración larga y extra de acompañamiento», con respuesta inicial simulada del agente sin acciones, y falla reproduciendo exactamente el rechazo del texto completo. Log /tmp/ppp-combo-side-reply-baseline.log. La suite general ahora tiene cinco regresiones nuevas locales pendientes (cuatro maduro/rendimiento y una combo), no publicadas. No considerar fuente actual verde.

Corrección necesaria: vincular la pregunta emitida con producto/compra pendiente persistida; clasificar la aclaración larga como respuesta al producto y conservar cantidad/opciones/dirección. Para la solicitud de tres papitas adicionales, conservar papa francesa y registrar solicitud para revisión; no prometer gratuidad/disponibilidad ni crear tres porciones pagadas de papa. Validar variantes de acompañamientos en cartas sintéticas, cambio de opinión, pregunta intercalada y ausencia real de producto pendiente.


## Continuidad de oferta y consultas de rendimiento — 14/10/2026

Se corrigen los cinco casos rojos posteriores a52e4b9e1. Cuando el agente pregunta «te lo agrego» y menciona un único producto vigente, sin acciones ni otra elección activa, Nest conserva una oferta estructurada con ID/cantidad/texto fuente y foco. Una respuesta «lo quiero normal… pero…» retoma esa oferta: usa presentación normal, conserva cantidad, registra el extra para revisión humana y avisa que disponibilidad/costo requieren confirmación; no compra porciones adicionales ni las promete gratis. El control de compra luego verifica un único combo98×1.

«De acuerdo entonces dame dos» con una oferta única añade dos; con una línea enfocada única cambia la cantidad absoluta conservando atributos/notas; con oferta múltiple o sin foco no elige por su cuenta. Las consultas de rendimiento conservan foco/oferta y no inventan personas. Resolver un nombre de catálogo con «y» no depende de parsearlo como varias líneas de corrección.

Alias culinario maduro/plátano: normalización acotada a la consulta/pedido explícito y al catálogo vigente que identifica un producto de plátano por sus componentes. Si la carta nombra un maduro propio o la composición no coincide, conserva texto. No se introducen IDs/precios/productos PPP en reglas de producción. Límite: no es un motor universal de sinónimos ni variantes; probar posibles SKU de maduro/plátano simultáneos.

34 regresiones nuevas aprobadas (cinco reportes reales y29 controles/recorridos en pizza/ramen/bowl/tacos), agente activo/inactivo; /tmp/ppp-offer-continuity-expanded-final.log. TypeScript en ejecución final /tmp/ppp-offer-continuity-tsc-final.log; global /tmp/ppp-offer-continuity-full.log; snapshot /tmp/ppp-offer-continuity-source.json. No editar fuente mientras global corre. No está desplegado. Main/producción d9241abe intacta. Cero API nueva,39/40 usadas/una restante.

Límites siguientes: aclaraciones largas sobre producto ya en pendingAttribute (además de pendingAddOffer), notas con opciones contradictorias, oferta perdida tras otra familia consultada y muestra independiente/modelo/canal reales. No certificar piloto autónomo por conteos aislados.

Cierre local de continuidad:66 suites/5171 pruebas aprobadas en470.532s (/tmp/ppp-offer-continuity-full.log), snapshot íntegro.34 nuevas,34 focalizadas y TypeScript final aprobado. Los cinco casos rojos anteriores pasan; no se eliminaron ni debilitaron. Pendiente publicación/deploy staging. Main/producción d9241abe intacta. Cero llamadas API nuevas.

Staging verificado14/10 a las16:59 Bogotá:runtime1df0b2ce,running/healthy,imagen activa=candidata sha256:936304b58f6e81b253632e3f6a9ad21dd51a7a86f6553cd72a9ef0ff27959567. HTTP3301/api/health ok,DB connected,circuit CLOSED. Evidencia /tmp/ppp-offer-continuity-deploy.log y /tmp/ppp-offer-continuity-verified-final.log. Main/producción d9241abe intacta.66 suites/5171,34 focalizadas,TypeScript y fuente íntegra aprobados. Cero API nueva;39/40 utilizadas/una restante.


## Contrato de continuidad y corrección de bebida incluida — 14/10/2026

26 regresiones nuevas;62 focalizadas pasan incluyendo36 controles existentes de interrupciones en awaiting_name/phone/address/payment/final_confirm/attribute. Cuatro conversaciones completas, dos cartas ficticias de jugos y agente activo/inactivo: saludo → compra2 por código → precio unitario sin mutar → aclaración normal sin azúcar → sabor → domicilio → consulta del total mientras captura nombre → nombre → consulta del total en pago → efectivo → final_confirm, sin crear orden. Carrito/cantidad/opciones/nota/dato pendiente/respuesta se verifican a lo largo del recorrido.

Encontrado: compra por código explícita («quiero dos #930») entraba como seguimiento de pedido. El handler de seguimiento ahora descarta sintaxis de compra por código, incluido código desconocido; el guard del agente devuelve al router una compra por código válido aunque el modelo solo pregunte. Ocho controles distinguen compra de consulta de estado con el mismo número. «Cómo va mi pedido #941» era interceptado como pregunta ajena; ahora se consulta el pedido antes de ese handler.

La primera fixture de combos suponía opciones obligatorias, pero el sistema permite defaults en combos; se sustituyó por jugos, donde Sabor requiere elección, sin cambiar política para aprobar pruebas. El harness agrega mocks de consulta de pedidos y generateTurn para cubrir sus dependencias; las primeras excepciones por mocks ausentes no se acreditan como errores de producción. La aclaración «lo quiero normal pero sin azúcar» mientras falta una opción se registra en el sourceText del producto pendiente y retoma la opción, conservando cantidad/selecciones. Límite de esta regla: referencia normal + nota sin…, no todas las paráfrasis, contradicciones ni opciones y notas en la misma respuesta.

Nuevo chat del usuario: bebida Coca Cola agregada aparte y «Pero me refiero a la gaseosa del combo». Ocho regresiones fallan antes (/tmp/ppp-combo-drink-reference-baseline2.log) y pasan después en PPP y carta vegetal, con0/2 bebidas preexistentes y agente activo/inactivo. Se conserva un único snapshot de la última bebida añadida, válido solo con firma del carrito intacta. Corrección explícita aplica sabor configurado a un único combo compatible, revierte esa última adición y conserva bebidas anteriores/notas. No pide otro sí. Seis controles de falta de historial/firma obsoleta/dos combos mantienen el pedido y piden aclaración. No deshacer adiciones históricas sin esa evidencia.

62 focalizadas /tmp/ppp-continuity-contract-focused.log. Global en ejecución /tmp/ppp-continuity-contract-full.log,snapshot /tmp/ppp-continuity-contract-source.json;TypeScript final /tmp/ppp-continuity-contract-tsc-final.log. No editar fuente durante global. No desplegado;staging runtime1df0b2ce;Main/producción d9241abe intacta. Cero API nueva,39/40usadas/una restante.

Pendiente: matriz de continuidad con retorno completo de teléfono y datos faltantes, cambios de familia que invalidan foco, percepción de audio/foto y muestra independiente con modelo/canal reales. Estos casos ya se usaron para ajustar código; no son evaluación independiente. Mantener el piloto supervisado y no sustituir aceptación conversacional por conteos de Jest.


La primera global de contrato aprobó66 suites/5197 en786.272s (/tmp/ppp-continuity-contract-full.log), fuente intacta. Se inspeccionó brevemente el proceso de Jest por demora: seguía ejecutando agente/catálogo; debugger local desconectado y proceso terminado. No estaba detenido ni acreditamos una hipótesis de causa de la demora.

El usuario añadió después el bloqueo «Quita la2» mientras el bot esperaba ubicación de Conjunto Residencial Bandera.18 primeras variantes fallaron (/tmp/ppp-row-interruption-baseline.log). El handler de eliminación ahora resuelve referencias explícitas por fila/ordinal; rechaza fuera de rango y pide nombre si otra lista activa hace ambigua la referencia. Conserva awaiting_name/phone/address/payment/final_confirm mientras quedan productos, con recordatorio del dato pendiente; una eliminación no se guarda como dirección ni vuelve indiscriminadamente a building_cart. Limpia el registro de adición reversible al cambiar carrito.36 nuevas regresiones de fila, cinco estados/3formas/agente activo-inactivo y seis controles;98 focalizadas totales aprobadas (/tmp/ppp-continuity-contract-focused3.log).

Nueva fuente congelada para global final /tmp/ppp-continuity-contract-full-final.log; snapshot /tmp/ppp-continuity-contract-source-final.json; TypeScript /tmp/ppp-continuity-contract-tsc-final3.log.62 casos nuevos respecto a5171; no declarar todos aprobados hasta footer final. No desplegado todavía.

Comprobación read-only en servidores: WHATSAPP_AGENT_V1=true y key de entorno configurada tanto en ppp-staging-api-1 como ppp_nest_api; resolver del backend da prioridad a env on, por tanto agente activo en ambos. No se mostraron claves ni se cambió configuración. Los fallos reproducidos ocurren en coordinación/router/estado, no prueban desactivación ni insuficiencia del modelo.

Dirección de consolidación: reducir caminos que compiten mediante una entrada común de intención + referencia + estado pendiente; validar cambios contra catálogo y aplicar un resultado de carrito concreto, luego generar respuesta desde estado guardado. Primero registrar ruta/decisión/estado antes-después por conversación y separar consultas, nuevas compras, correcciones y respuestas a opciones. No sustituir esa consolidación por una lista creciente de excepciones de producto. Esta tanda corrige prioridades y continuidad, no acredita haber refactorizado toda la arquitectura. Mantener oráculos del carrito y retorno al dato pendiente; medir muestra independiente real y errores críticos además de Jest.


Global posterior a filas:64 suites aprobadas/2 fallidas;5231 aprobadas/2 fallidas de5233,771.186s (/tmp/ppp-continuity-contract-full-final.log). Fallos: un test prohibía «Coca Cola» en todo el mensaje, incluido el acuse de línea retirada; ahora exige Carrito y prohíbe Coca Cola dentro del carrito renderizado, conservando oráculos de SKU/qty/atributos/dirección/no orden. El segundo preservaba awaitingField=confirm de un total viejo. Se mantiene el test histórico sin cambios: si existía mpPreferenceId viejo, se invalida y vuelve a building_cart; en checkout sin ese snapshot viejo, se retoma estado pendiente y se limpia awaitingField de confirmación vieja. El tipo y estado de pago efectivo no se pierden por borrar una fila.

101 focalizadas finales aprobadas en dos suites (/tmp/ppp-continuity-contract-focused-final.log). Global final2 en ejecución con misma suite completa y --silent para reducir ruido (/tmp/ppp-continuity-contract-full-final2.log);snapshot /tmp/ppp-continuity-contract-source-final2.json;TypeScript /tmp/ppp-continuity-contract-tsc-final4.log. Fuente congelada;no desplegado. No eliminar controles para obtener verde.


Consolidación siguiente, acotada: representar la pregunta activa con tipo/ID de producto o fila/contexto y versión de carrito; resolver consultas y correcciones antes de captura de datos, conservando esa pregunta. No reemplazar varios pendientes por una unión plana sin soportar pedidos múltiples/interrupciones. Una respuesta numérica pertenece a una lista identificada, no al primer parser que la acepte. Adaptadores de WhatsApp/modelo aportan entradas; catálogo/config por negocio valida opciones/precios; un aplicador común cambia carrito y devuelve resultado para redactar respuesta. Primero extraer comandos de corrección/consulta compartidos, con comparación de recorridos antes-después, sin reescribir todo el orquestador de una vez. Kamppo requerirá además claves de sesión y catálogo por tenant; menús ficticios no acreditan aislamiento multitenant.


Cierre local final de contrato:66 suites/5233 pruebas aprobadas en784.833s (/tmp/ppp-continuity-contract-full-final2.log), fuente íntegra (snapshot final2).62 regresiones nuevas respecto a5171;101 focalizadas en dos suites y TypeScript final4 aprobados. Se conservó sin cambios el test histórico de invalidar snapshot de pago viejo. Pendiente publicación/deploy staging. Main/producción d9241abe intacta. Agente activado en ambos por env true. Cero API nueva,39/40 utilizadas/una restante.


Staging publicado y verificado14/10/2026 a las18:02 Bogotá:runtime f7be1f7d,running/healthy,imagen activa=candidata sha256:a9e076dc312db43cf38cfc2e87ccc350b6a663e5f4e940ca727c95ec01e65682. HTTP3301/api/health ok,DB connected,circuit CLOSED. Evidencia /tmp/ppp-continuity-contract-deploy.log y /tmp/ppp-continuity-contract-verified.log. Main local/producción d9241abe intacta. No cambió modelo ni se desactivó agente. Código final:66 suites/5233,101 focalizadas,TypeScript y fuente íntegra aprobados. Cero API nueva;39/40 utilizadas/una restante. Archivo de presupuesto no modificado.

La reversión automática solo aplica a una última adición registrada por esta versión y firma intacta. Conversaciones históricas sin ese registro necesitan aclaración; eliminación explícita por fila sigue disponible. Pendientes de consolidación: referencia temporal/cantidad en correcciones de varios combos, oráculos de retorno completo al teléfono, cambios de foco e intención común con catálogo/config por tenant. Falta muestra independiente de modelo/canal; estos casos se usaron para ajustar código. No promover automáticamente a Main ni eliminar staging.


## Referencias de consulta y retorno al teléfono — 14/10/2026

Tanda en validación global. Nuevo módulo whatsapp-dialogue-context.ts reúne referencias de producto para consultas de composición y rendimiento: opción pendiente, candidatos, oferta, foco y carrito. Conserva todos los candidatos y no elige el primero cuando hay ambigüedad. Extracción acotada a estas consultas; otros handlers todavía tienen resolución propia, no afirmar consolidación completa.

32 casos nuevos:6 unitarios y26 recorridos de router con cartas ficticias (pizza/bowl/jugo), agente activo/inactivo. Consulta del precio, composición o favor externo mientras falta teléfono conserva pedido/dato pendiente; teléfono → transferencia → confirmación sin crear orden. Consulta ambigua mantiene IDs de la lista aunque el catálogo cambie de orden; nombre/ordinal aclara sin comprar. Otra consulta, teléfono o eliminación explícita sustituye la aclaración y retoma checkout. La opción de compra pendiente prevalece sobre foco viejo.

Encontrado: la heurística amplia de lugar interpretaba Bowl De Quinoa como dirección durante una aclaración; se prioriza coincidencia del catálogo y se usa la detección estricta de dirección en ese camino. Los favores externos detectados usan rechazo canónico y recordatorio, sin aceptar una respuesta ajena del stub del agente. No afirmar fallo observado del modelo real: son pruebas con modelo simulado. La primera fixture del total carecía de cotización de domicilio; se corrigió la fixture, no la política de precios.

114 focalizadas finales aprobadas en2 suites (/tmp/ppp-dialogue-context-focused-final3.log). TypeScript final aprobado (/tmp/ppp-dialogue-context-tsc-final.log). Global en /tmp/ppp-dialogue-context-full.log; snapshot /tmp/ppp-dialogue-context-source.json. Fuente congelada. No desplegado aún; runtime anterior f7be1f7d, Main d9241abe. Cero API nueva;39/40 usadas,1 restante.

Pendientes: referencia numérica entre lista de consulta y filas del carrito, cambios de familia que invalidan foco, notas/opciones contradictorias, varios combos y percepciones de audio/foto. No certificar producto vendible por conteos; falta muestra independiente con modelo/canal reales. Mantener piloto supervisado.


Cierre local de referencias:67 suites/5265 pruebas aprobadas en774.521s (/tmp/ppp-dialogue-context-full.log), fuente íntegra contra /tmp/ppp-dialogue-context-source.json.32 nuevas regresiones,114 focalizadas y TypeScript final aprobados. Pendiente deploy staging;Main d9241abe intacta. Cero API nueva;39/40 usadas,1 restante.


Staging verificado14/10/2026 a las19:06 Bogotá:runtime2ab5d14d,running/healthy,imagen activa=candidata sha256:ea2acc973fa20f442ff0ccb4632f1f1cd75af5ce5d39fac1d02cb40f5be26d33. HTTP3301/api/health ok,DBconnected,circuitCLOSED. Evidencia /tmp/ppp-dialogue-context-deploy.log y /tmp/ppp-dialogue-context-verified-final.log. Main local/producción d9241abe intacta.67 suites/5265 pruebas,114 focalizadas,TypeScript y snapshot fuente aprobados. Cero API nueva;39/40 usadas,1 restante. No promover automáticamente a Main. Siguiente:ambigüedad entre listas y filas,correcciones en varios combos,foco obsoleto y muestra independiente de modelo/canal.


## Evaluación independiente con inferencia real — 14/10/2026

Usuario autorizó ampliar llamadas («continua, si quieres autoriza ams llaamadas»). Agente fija extensión conservadora de10 solicitudes:50 autorizadas acumuladas. Runner contabiliza cada intento antes de red y limita esta ejecución a10,una repetición,stop-on-failure. Se usaron2:41 usadas/9 restantes; docs/whatsapp-model-budget.json y espejo privado actualizados. AGENTS solo cambia dato de presupuesto, no procedimientos.

Base56db5fb5,modelo configurado en staging gpt-4.1-2025-04-14,systemPrompt de settings de staging. Router/catálogo/guard reales locales; modelo OpenAI real; almacenamiento,Meta,cotización y creación de órdenes simulados. No mandar WhatsApp ni afirmar validación del canal/percepción. Configuración privada leída por SSH y mantenida en memoria del proceso; no persistir/loguear key.

Muestra nueva scripts/fixtures/whatsapp-independent-1410-cases.json:3 recorridos originales con carta vegetal existente. Solo se ejecutó el primero:pedido narrativo para oficina, luego precio de cada bowl.2 solicitudes exitosas,17952 promptTokens/8704 cached/119 completion,sin erroresHTTP/transporte. No precio estimado registrado para4.1, no afirmar cifra de factura. Reporte /tmp/ppp-independent-1410-model-report.json;log /tmp/ppp-independent-1410-model.log.0/1 recorridos aceptados,2 pendientes sin ejecutar.

Modelo acertó2 BowlAndino,1 TrioDeWraps(paquete),3 limonadas;backend agregó avisos de inexistencia para «somos varios en» y «oficina:». Consulta «cuánto cuesta cada bowl» pidió producto aunque solo había1SKU de bowl junto a otros platos. Primer oráculo revisaba carrito pero no prohibía avisos;inspección manual encontró también ese fallo,se reforzó respuesta. La primera conversación ya es caso de desarrollo y no holdout independiente;las otras2 permanecen sin ejecutar. No reutilizar primera como prueba de generalización después del ajuste.

14 regresiones nuevas reprodujeron fallos. Prefacio de grupo/lugar delimitado por dos puntos se excluye de conciliación solo si no nombra un producto;etiquetas de destinatarios con nombre propio y cantidad posterior se separan manteniendo cláusulas de compra. Producto desconocido posterior continúa avisado,no se suprime todo lo no reconocido. Precio abreviado de familia usa palabras completas/plurales sobre productos del carrito;si hay varios coincidentes cotiza todos,no elige primero. Precio/datos/carrito/estado no mutan.

Parcial /tmp/ppp-office-fixed.log:3pasaron/11fallaron;8fallos eran expectativa de redacción estrecha («cómo pagas» frente a «con qué método de pago pagas»),se corrigió oráculo manteniendo comprobaciones de sesión/estado/precio.3contextos produjeron «para Oscar» como SKU;conciliación corrigió etiquetas,no se debilitó el test.39 focalizadas finales aprobadas /tmp/ppp-office-focused-final.log. Global /tmp/ppp-office-full.log;snapshot /tmp/ppp-office-source.json;TypeScript /tmp/ppp-office-tsc.log. Fuente congelada,no desplegado. Main d9241abe intacta.

Límites:prefacios con otra sintaxis/nombres de destinatarios en minúscula no acreditados;precio abreviado coincide palabras, no sinónimos universales. Pedido narrativo termina «eso es todo» pero aún building_cart/¿algo más?:observación no corregida en esta tanda. Falta retest con modelo real de corrección y los2 holdouts pendientes;priorizar sin gastar reintentos hasta global verde. No certificar piloto autónomo.


Cierre local oficina:67 suites/5279 pruebas aprobadas en776.889s (/tmp/ppp-office-full.log),fuente íntegra contra /tmp/ppp-office-source.json.14 regresiones nuevas,39 focalizadas y TypeScript aprobados. Antes de desplegar se inicia reensayo con modelo real:primero caso de desarrollo corregido,luego2 holdouts no ejecutados;máximo8 solicitudes/una repetición/stop-on-failure,saldo9. No darlo por aprobado antes de informe. Main d9241abe intacta.


Reensayo real posterior a oficina:/tmp/ppp-independent-1410-retest-report.json,6solicitudes adicionales (53793 promptTokens/38784cached/242completion),47/50 usadas,3restantes. Caso oficina de desarrollo aprobado,holdout wrap aprobado,holdout disculpa+nueva compra falló por replay de pendiente sin llamar modelo en segundo turno. Ningún errorHTTP/transporte. No contar2/3 como aceptación independiente:1/2holdouts aprobado. Los casos ejecutados ya no son holdouts futuros. Pedido con dirección emitió ¿algo más? antes del checkout en harness sin retención de salida;no acredita UI real.

Se añaden12regresiones de destinatario equivocado y nueva compra:sopa/pasta,agente activo/inactivo,2formas,2positivos y2negativos de clasificador. Baseline10fallaron/2pasaron /tmp/ppp-wrong-recipient-baseline.log. Clasificador reconoce disculpa+«era (para) otro negocio/tienda…»;la entrada original se conserva para reconocimiento porque glosario quita «disculpa».4variantes con disculpa fallaron tras primer fix hasta preservar fuente;76 focalizadas finales aprobadas /tmp/ppp-office-recovery-focused-final.log.26casos nuevos totales esta tanda. Global final /tmp/ppp-office-recovery-full.log;snapshot /tmp/ppp-office-recovery-source.json;TypeScript final /tmp/ppp-office-recovery-tsc-final.log. Fuente congelada;Main sin cambios;no desplegado.


Reensayo real recuperación aprobado:1recorrido/3 solicitudes (/tmp/ppp-independent-1410-recovery-live-report.json),26453promptTokens/25856cached/77completion,sin erroresHTTP/transporte. No órdenes externas. Presupuesto agotado:50/50 usadas/0restantes;esta tanda usó11 solicitudes (10 de extensión+1 pendiente previa). No nuevas inferencias hasta nueva autorización. Oficina y recuperación corregidas fueron reensayadas con modelo real;wrap pasó como muestra independiente. No prueba de comprensión universal ni WhatsApp/media reales. Fuente de global final permanece congelada.


Cierre local final oficina/recuperación:67 suites/5291 pruebas aprobadas en929.017s (/tmp/ppp-office-recovery-full.log),snapshot fuente íntegro.26regresiones nuevas respecto a5265,76focalizadas y TypeScript final aprobados. Oficina y recuperación reensayadas con modelo real después de corregir;wrap aprobado en primera evaluación.11solicitudes en esta tanda (10nuevas+1saldo previo);50/50 usadas,0restantes. Pendiente deploy staging;Main d9241abe intacta.


Staging verificado14/10/2026 a las19:59 Bogotá:runtime350c4d2b,running/healthy,imagen activa=candidata sha256:e8f462ea9bd145db22c6bbc3622a1018a04dbad12f659381194a2ee3e6c5255f. HTTP3301/api/health ok,DBconnected,circuitCLOSED. Evidencia /tmp/ppp-office-recovery-deploy.log y /tmp/ppp-office-recovery-verified-final.log. Main local/producción d9241abe intacta.67 suites/5291 pruebas,26regresiones nuevas,76focalizadas y TypeScript/snapshot aprobados.11solicitudes pagadas esta tanda (10extensión+1saldo anterior),50/50 utilizadas,0restantes. Reensayos corregidos oficina y recuperación aprobados;wrap pasó como1muestra independiente. No nuevas llamadas sin autorización. Siguiente:cierre «eso es todo» en pedido narrativo,referencias entre listas/carrito,varias líneas/combos,medios originales y más muestra independiente. No certificar listo para venta por esta tanda;no promover Main automáticamente.


## Cierre de cambios locales: cocina, cierre y referencias — 14/10/2026

Se retoma checkout f3a51671 con8 archivos fuente/tests ya modificados localmente;se revisaron y preservaron. Incluían cierre «eso es todo», protección de filas durante pendingCompositionAsk y separación/conciliación de notas de cocina. No atribuir estos cambios preexistentes como nuevos escritos en esta continuación. Usuario reportó «quiero dos pollos bien fritos, con las arepas fritas y arto aji por favor» rechazado en WhatsApp;4tests exactos ya estaban en local y pasan,pero no desplegados. Comprobación servidores al empezar:staging checkout2739cb38,producción d9241abe.

Revisión focal inicial:74aprobadas /tmp/ppp-local-kitchen-review.log. Se añaden8casos:3variantes×agente activo/inactivo («muy bien fritos»,«mucho ají»,«sin ensalada y bastante ají») y2consultas hipotéticas de precio. Baseline4fallaron/4pasaron /tmp/ppp-kitchen-variants-baseline.log. La nueva regla local de hipótesis devolvía texto genérico sin contestar precio;se permite continuar consulta de precio/descripción/disponibilidad por sus manejadores habituales sin autorizar compra. «Sin ensalada y bastante ají» fallaba donde «harto ají» pasaba:splitKitchenPreference solo aceptaba parte de los calificadores. Se amplían intensidades de la nota sin cambiar SKU/cantidad/opciones.

Intento intermedio de limpiar búsqueda en resolveSpokenDish no corrigió el bloqueo y se revirtió;no está en diff final. Focal intermedia80aprobadas/2fallidas /tmp/ppp-kitchen-local-final.log. Focal final88aprobadas en2suites /tmp/ppp-kitchen-local-final2.log;TypeScript /tmp/ppp-kitchen-local-tsc-final.log aprobado. Global en ejecución /tmp/ppp-kitchen-local-full.log;snapshot /tmp/ppp-kitchen-local-source.json. Fuente congelada;no desplegar ni declarar conteo global hasta footer. Cero llamadas pagadas,50/50 usadas/0restantes. Main d9241abe intacta.

Límites:router con modelo/Meta/persistencia simulados;no nueva inferencia real ni prueba de audio. CondimentIntensityNote sigue centrado en ají y no interpreta todo condimento universalmente. Cierre con opción obligatoria pendiente no acredita recordar el cierre después de varios turnos;probar ese recorrido. Preguntas hipotéticas distintas de precio/descripción/disponibilidad aún pueden recibir respuesta genérica;no considerar finalizada toda esa familia.


## Cambio de prioridad pedido por el usuario: generalización — 14/10/2026

El usuario cuestiona explícitamente seguir parchando chat tras chat y exige comprensión que escale. La respuesta reconoce que los conteos no prueban generalización y que reglas generales por catálogo todavía pueden ser parches sintácticos. Tras cerrar la validación actual, NO convertir la siguiente tanda en más enumeración de frases. Prioridad:consolidación gradual de contratos y aplicación de acciones. No declarar que esta consolidación ya está hecha.

Siguiente trabajo concreto:
1. Trazar en replays gratuitos la ruta,estado inicial,pregunta pendiente,acciones propuestas/aceptadas/rechazadas y estado final. Preservar datos privados;no loguear mensajes/credenciales completos en producción por defecto. Esto debe explicar qué handler desvió la intención, no sumar otro detector.
2. Representar el turno con intención(es),referencias de producto/línea, cantidades,opciones/notas y consultas. El agente ya propone acciones estructuradas en parte;primero identificar por qué el backend vuelve a interpretar el texto después de una propuesta válida. Reutilizar catálogo y action guard,evitar duplicar interpretadores. Separar extracción de validación y no usar estado pendiente como autorización para consumir cualquier respuesta.
3. Extraer un aplicador común de cambios a sesión/carrito,con resultado verificable y sin mutaciones parciales. Si un dato es ambiguo,pedir aclaración;no escoger primera coincidencia ni inventar SKU/precio. La respuesta debe generarse desde resultado aplicado y estado persistido, no prometer acciones que no ocurrieron.
4. Migrar primero una familia acotada (compra con atributos/notas + consulta intercalada) comparando ruta vieja/nueva en replays y pruebas de contrato. No reescribir todo el orquestador ni activar interpretación pagada para todos los turnos sin medir costo/latencia. Preguntas pendientes son contexto para retomar,no cerrojo.
5. Medir un conjunto nuevo separado,con catálogos y formas de escribir distintos;los casos usados para ajustar pasan a regresiones. Criterios:sin mutación por pregunta,sin pérdida/duplicado de unidades,opciones/notas conservadas,correcciones aplicadas y consulta respondida antes de retomar checkout. No porcentaje comercial a partir de fixtures conocidos. Inferencia nueva requiere autorización:50/50 usadas.

Cambios locales actuales de cocina/cierre/listas quedan como correcciones de compatibilidad,validadas por suite en ejecución;no son evidencia de haber construido el nuevo contrato común ni de estar listo para Kamppo. Kamppo requiere además claves de sesión,catálogo y configuración por tenant y pruebas de aislamiento.


Cierre local cocina/cierre/listas:67 suites/5353 pruebas aprobadas en869.815s (/tmp/ppp-kitchen-local-full.log),fuente íntegra contra /tmp/ppp-kitchen-local-source.json.62casos nuevos respecto a5291 (incluye los cambios locales preexistentes),88 focalizadas y TypeScript final aprobados. Cero llamadas pagadas;50/50 usadas/0restantes. Pendiente publicación ydeploy staging. Main d9241abe intacta. Prioridad siguiente pedida por usuario:consolidar contrato y aplicación de turnos, no ampliar frases como actividad principal.


Staging verificado14/10/2026 a las22:34 Bogotá:runtime d1c7d8fc,running/healthy,imagen activa=candidata sha256:667de89f18c7ce63f0573a6284ac2b0fad2b11433051cd8b11c9373702f150e0. HTTP3301/api/health ok,DBconnected,circuitCLOSED. Evidencia /tmp/ppp-kitchen-local-deploy.log y /tmp/ppp-kitchen-local-verified-final.log. Main/producción d9241abe intacta.67 suites/5353 pruebas,62casos nuevos incluidas modificaciones locales preexistentes,88focalizadas y TypeScript/snapshot aprobados. Cero API nueva,50/50 usadas/0restantes. Prioridad explícita del usuario:consolidar interpretación/validación/aplicación y medir conversaciones nuevas;no continuar solo agregando frases. La consolidación NO está implementada por esta tanda. Consultar WHATSAPP-LOCAL-NEXT-AGENT.md actualizado.


## Primera frontera común de compras y contrato de decisión — local, sin deploy

Usuario cambió procedimiento:acumular entregas coherentes,trabajar local y no desplegar constantemente. Esta tanda NO despliega,no accede al servidor y no usa API pagada. Staging vivo sigue d1c7d8fc (última verificación14/10/2026 22:34Bogotá),Main d9241abe sin tocar. No confundir push a rama con despliegue.

Base f974cde5,checkout limpio antes de iniciar. No se añaden nuevos patrones de matching de lenguaje. Se extrae de applyActions la preparación de addItems a whatsapp-purchase-plan.ts:entradas estructuradas ya validadas por catálogo,conservación de cantidad/opciones/notas,agrupación de duplicados y resolución de evidencias mediante adaptadores existentes. La misma preparación la usan las acciones del agente y la ruta IA antigua. El módulo no guarda sesión,manda mensajes,consulta modelos ni muta acciones de entrada. Es extracción de comportamiento existente,no un nuevo clasificador semántico.

Los overrides heredados quedan visibles mediante diagnósticos tipados:duplicate_proposals_merged,purchase_filtered_as_side,legacy_side_fallback,quantity_recomputed. Se conserva deliberadamente la política vieja,incluido filtro de acompañamientos y fallback a primer candidato si todos se filtran:es deuda a investigar con evidencia,no una regla nueva certificada como correcta. Las funciones que resuelven cantidad/segmentos todavía pueden reinterpretar texto;ahora tienen una frontera observable. No afirmar que ya se eliminaron esas reinterpretaciones.

whatsapp-turn-decision.ts aporta contrato diagnóstico version1:estado/cart/referencias/preguntas pendientes antes-después,etapas proposed/catalog_validated/reconciled/prepared,consultas de precio/composición registradas por handlers efectivos ydelta de unidades. La comparación de unidades distingue matches/pending_choice/different/not_comparable;NO certifica notas/opciones ni corrección semántica. Cambios de opción/nota se pueden comparar por fingerprints. Las rutas deterministas que no pasan por esas consultas aún no tienen intención clasificada;no inventar una a partir de stages vacío.

whatsapp-turn-telemetry.service.ts conserva100decisiones en memoria,32etapas máximo por turno;copias al guardar/leer. No añade logs ni requests,endpoint ni persistencia. Traza nueva sin texto de cliente,dirección,nombre,teléfono,notas/opciones en claro. El logging viejo de previews no cambia:no afirmar saneamiento completo de telemetría. Error de diagnóstico no debe romper respuesta ni sustituir excepción original. failed mide procesamiento del wrapper,no entrega confirmada por WhatsApp.

Runner real aislado ahora incluye decisions en su informe para una futura ronda autorizada;NO se ejecutó ni cambió modelo,prompt,tools o presupuesto.50/50usadas/0restantes.

19pruebas nuevas de contrato:6planner,9decisión/privacidad/buffer/comparación,4router con replays capturados de oficina y reparto,nueva consulta intercalada y fallos de diagnóstico. Son pruebas de equivalencia/contrato,no evaluación independiente de comprensión. Los replays conservan2/1/3unidades y notas;consulta de precio no añade ni vuelve a llamar al agente simulado. Fuente actual:88focalizadas aprobadas /tmp/ppp-turn-contract-approved.log,TypeScript /tmp/ppp-turn-contract-tsc-approved.log. Global en /tmp/ppp-turn-contract-full.log,snapshot src+scripts /tmp/ppp-turn-contract-source.json. No editar fuente durante global;no declarar verde hasta footer.

Siguiente entrega tras validar:usar resultados aplicados para redactar acuses y migrar la compra/consulta intercalada al contrato común. Observación de código a reproducir:el acuse del agente aún deriva addedNames de guarded.actions,pero el planner puede recomputar cantidades. No se cambió esa respuesta en esta primera extracción;verificar divergencias de acuse y carrito antes de modificar. Seguir con decisiones de referencias y consulta pendiente,manteniendo los tests actuales. No regresar a enumerar frases como actividad principal.


Cierre local contrato1:69 suites/5372 pruebas aprobadas en808.092s (/tmp/ppp-turn-contract-full.log),snapshot src+scripts íntegro.19tests nuevos de contrato/equivalencia,88focalizadas,TypeScript aprobado. Sin deploy y sin llamadas pagadas hasta este cierre. Usuario posteriormente autoriza más inferencias:se fija extensión10 (60autorizadas/50usadas/10restantes);evaluación nueva acotada con stop-on-failure. No confundir contador nuevo con permiso para desplegar.


## Evaluación posterior al contrato: referencias y fallo narrativo — sin deploy

Base local6daf557b. Nueva autorización10 confirmada:60autorizadas; esta evaluación consumió2, saldo52usadas/8restantes. Se leyó configuración privada de staging sin imprimir secretos; modelo gpt-4.1-2025-04-14. No se reconstruye staging ni se toca Main.

Fixture whatsapp-contract-holdout-1410.json:primera ejecución falló en «La bebida, cuánto cuesta?» con wrap+limonada en carrito;0requests. Referencia semántica bebida no coincidía con nombre Limonada. Ajuste acotado reutiliza isLikelyDrinkProduct en matching de familia de precio (bebida/refresco),sin escoger arbitrariamente el foco. Diez controles router agentesimulado activo/inactivo:una bebida,dos bebidas,combo incluido excluido y pregunta ambigua.14focalizadas incluyendo contrato previas aprobadas;TypeScript aprobado. Retest fixture:2recorridos/6turnos aprobados,0requests. Salida runner1 deliberada porque exige al menos una respuesta de modelo:estas ejecuciones NO acreditan inferencia real.

Fixture nuevo whatsapp-contract-independent-office-1410.json NO aprobado al primer intento:2responses API,17947tokensentrada/159salida,8832cached. Pide2bowls+wrapTahini+wrapYogur;termina1bowl+1wrapTahini con notas mezcladas y narración como ausentes. Se detuvo antes de consulta total. /tmp/ppp-independent-office-contract-live-report.json conserva acciones vacías y3llamadas add_item en resultado agente. NO se capturaron argumentos originales de cada llamada: no atribuir cantidades correctas al modelo sin esa evidencia.

Diagnóstico gratuito exacto /tmp/ppp-office-tool-probe.log:executeTool(add_item) con cantidades/opciones correctas rechaza bowl por uncoveredWords=[cada],ambos wraps por[pero]. El guard uncoveredWordsAnchoredByProduct confunde gramática con evidencia de plato ausente. Después fallback determinista pierde cantidades y opciones. Este problema sigue ABIERTO;no declarar caso corregido ni comprensión general aprobada. Muestra ahora inspeccionada es regresión de desarrollo,no holdout independiente. Sin más solicitudes hasta resolver gratis.

Siguiente bloque estructural:contrato de evidencia por línea en herramienta add_item,para separar producto/opción/cantidad y texto relacional;no confiar en cualquier token sobrante como prueba de ingrediente ausente. Mantener negativos de plato compuesto real/ingrediente no disponible/consulta no compra. Verificar que rechazo del agente NO produzca adición parcial engañosa por fallback. Capturar en harness argumentos y resultados de tools (sin secretos/PII de clientes) para distinguir interpretación de validación. No desactivar validación completa ni añadir nombres/IDs/ejemplos PPP al código. El acuse basado en guarded.actions frente al resultado aplicado sigue otra deuda reproducible pendiente.

Cierre validado de referencias de precio:69suites/5382tests aprobados en806.44s (/tmp/ppp-price-class-full.log);snapshot src+scripts intacto (/tmp/ppp-price-class-source.json).14focalizadas y TypeScript aprobados. Diez regresiones nuevas,2fixtures sintéticos. Publicación solo a rama staging,sin deploy. El fallo narrativo continúa abierto;8requests restantes,no confundir global verde con esa evaluación fallida.


## Contención de rechazo de herramientas y evidencia del simulador — entrega local

Base66be665a,staging limpio y sincronizado al inicio. Se conserva el diagnóstico de gramática sin declarar corregida la interpretación del pedido narrativo. Esta entrega separa resultado de herramienta de su nombre:AgentV1TurnResult.purchaseAttempts transporta productId,accepted y reason técnico. Sin texto/opciones/nombres de clientes,local por turno,máximo100intentos. Se conserva en retornos normales,errores de proveedor/respuesta vacía,max_iterations y excepción. Las sondas de validación no cuentan como compras ejecutadas.

Router:cuando hubo intentos add_item,todos rechazados y ninguna acción addItems aceptada,contesta una aclaración con nombres del catálogo y conserva pedido. No pasa ese caso por reconstrucción determinista,que antes creaba1bowl+1wrap y mezclaba salsas. Aplica también cuando después del rechazo el agente termina en exception/max_iterations. Si un intento posterior tuvo éxito,no bloquea las adiciones exitosas. Alcance limitado:rechazos mezclados con aceptaciones y rechazos posteriores del actionGuard requieren análisis separado;no afirmar que se hicieron atómicas todas las acciones ni que ya se entiende el relato de distribución.

El simulador real registra por turno toolTrace(origin,name,args,result) únicamente para fixtures sintéticos:origen model_call,validation_probe o internal. Esto permite distinguir argumentos originales del modelo de sondas del backend. No se añade un logger en producción ni headers,keys,prompts completos a la traza. El runner ya contenía mensajes/carro sintéticos;no usar como recolector de chats privados sin revisar privacidad. No se ejecutó inferencia pagada esta entrega:saldo52usadas/8restantes. No se leyó servidor ni se desplegó;Main intacta.

12regresiones nuevas:4agente con respuestas proveedor simuladas y catálogo real (3rechazos,bodyposterior vacío,éxito+duplicado,aislamiento entre turnos);6router conservan carrito vacío/preexistente al terminar normal/error/maxiterations;1control acepta compraexitosa tras intento previo rechazado;1router+agent+catálogo reales con proveedor simulado verifica contención del caso oficina. Oráculo del control positivo se corrigió de exigir palabraListo a total96.800+estadoawaiting_payment,porque el mensaje de fixture termina «eso es todo» y legítimamente avanza checkout;cantidades2/1/3sin cambiar. Focalizadas12aprobadas /tmp/ppp-rejected-tools-focused-final.log,TypeScript /tmp/ppp-rejected-tools-tsc-final.log (ajustes posteriores de tests solo cambian oracle de respuesta). Global /tmp/ppp-rejected-tools-full.log,snapshot src+scripts /tmp/ppp-rejected-tools-source.json:esperar footer antes de publicar.

Próximo paso de interpretación pendiente:proponer evidencia estructurada por producto,cantidad,opción y nota,referida a fragmentos originales verificables. Un solo sourceText corto podría ocultar «con camarones»,perder una negación o sugerir cantidad1 cuando hay dos destinatarios;no aceptar substrings aislados como bypass de toda validación. Actualmente add_item infiere segmento propio varias veces y el planner vuelve a recomputar cantidades/opciones:hay que migrar esas responsabilidades juntas con negativos,no solamente añadir«cada»/«pero»a una lista. Probar ambas variantes de wrap por separado y reparto«uno para cada persona»;conservar fuera del carrito las bebidas negadas. La evaluación pagada de oficina sigue roja como compra completa:aunque ahora pida aclaración,su oráculo sigue exigiendo2bowls+2wraps,no debilitarlo para presentar contención como comprensión.

Revisión antes de cerrar:se detectó que contención también podía ocultar requestHuman o lookupDeliveryTime. Se interrumpió la primera global en ejecución para corregir prioridad (no se cuenta como verde). La condición excluye handoff,lookups de pedido/tiempo y modo colocado/readOnlyAside.3regresiones adicionales verifican despacho a los handlers existentes sin aclaración de compra. La global definitiva tendrá nuevo snapshot/log;no usar resultado parcial anterior.

Prioridad de atención:la prueba humana detectó otro fallback viejo (agent_dropped_resolved_dish) que precedía al handler de requestHuman. Se mueve el handler humano validado después de businessClosed y antes de reconciliar/aplicar compras;preserva sesión y orienta al contacto existente (no activa por sí solo takeover nuevo). Se mueve el formateador de disclaimer antes de ese handler sin cambiar su contenido. Consultas de pedido/ETA conservan sus handlers previos;modos readOnly/placedOnly quedan fuera de la contención de compra.15focalizadas aprobadas en23.021s /tmp/ppp-rejected-tools-approved.log;TypeScript /tmp/ppp-rejected-tools-tsc-approved.log. Global definitiva /tmp/ppp-rejected-tools-approved-full.log,snapshot /tmp/ppp-rejected-tools-approved-source.json;esperar footer. No se usó API real esta entrega.

Cierre definitivo de contención:70suites/5397tests aprobados en795.382s (/tmp/ppp-rejected-tools-approved-full.log),snapshot src+scripts intacto (/tmp/ppp-rejected-tools-approved-source.json).15nuevas regresiones,15focalizadas y TypeScript aprobados. Se publica en staging sin deploy;Main no se modifica. Cero inferencias reales nuevas,saldo60autorizadas/52usadas/8restantes confirmado contra espejo. El fixture narrativo de oficina sigue pendiente como compra completa;esta entrega verifica contención y prioridad,no comprensión total. Próximo bloque:evidencia por línea y evitar reinterpretar cantidades/opciones entre tools,guard,reconciliación y planner. Antes de gastar API,resolver gratis distribución y variantes con controles negativos de ingredientes/productos ausentes y negaciones.


## Lote aceptado por herramientas: preservar decisiones, reparto y variantes (15/10 local)

Base8dc95443. Se migra una frontera acotada,no todo el bot:hasCompleteToolPurchaseEvidence exige un lote no vacío,100%accepted,una correspondencia por adición,IDs por multiplicidad,cantidades enteras1..10 y combinaciones distintas SKU+atributos. Varias líneas del mismoSKU con solo notas diferentes o propuestas duplicadas/mix rechazos quedan en ruta heredada. Esta comprobación demuestra cobertura del lote de herramientas,no de toda la intención del cliente. No atribuir semántica perfecta ni atomicidad de todas las acciones.

Solo para ese lote aceptado y sin ediciones de carrito existente,se evita reconcileAgentAddsWithUtterance y el planner devuelve cantidades/opciones/notas ya validadas,sin sourceText que vuelva a parsearlas al añadir. Permanecen guard de catálogo/disponibilidad/opciones/defaults,límites y chequeo previo agentDroppedResolvedDish. La ruta IA antigua y agentes sin evidencia conservan comportamiento heredado. Diagnóstico prepared:validated_tool_purchase_preserved. El contrato no es una nueva API pública ni un clasificador completo.

La herramienta resuelve una sola vez su segmento de producto usando las opciones seleccionadas;reutiliza ese contexto para validar producto,opciones,notas y cantidades. orderSegmentForProduct reconoce cláusulas de destinatario «y para [persona] otro/un…»,independiente de nombres/IDs. Tokens funcionales de distribución/contraste (cada,pero,aunque,mientras,entonces,todavia,ni) dejan de ser ingredientes ausentes. Esto es saneamiento léxico compartido,NO por sí solo la solución estructural. Cantidades literales/packs se contrastan antes de aceptar add_item;en reparto cada/porpersona/c-u conserva propuesta semántica acotada del modelo. No se prueba el número real de destinatarios con un parser nuevo:requiere más evaluaciones.

Controles nuevos:productos negados por nombre completo rechazados (no pretende cubrir toda anáfora/negación abreviada);varios atributos explícitos con mención repetida del mismoSKU exigen ámbito por variante. Se conservan rechazos de camarones cuando no constan en receta. Primer guard de variantes fue demasiado amplio (bebidas de dos combos distintos) y las regresiones PPP lo detectaron;se acotó a nombre de SKU repetido,sin cambiar los controles existentes. Una respuesta por nombre repetía la primera nota para dos variantes aunque el carrito estaba bien:en lotes aceptados con mismoSKU/atributos distintos,se muestran filas reales del carrito con opciones/notas.

Caso original oficina ahora pasa gratis con router+agent+catálogo reales y proveedor simulado;segunda carta ficticia Ensalada Campestre/Pasta De Vegetales con IDs98001/98002 y salsaPesto/Tomate también;tercera variante verifica notas sincebolla/sinensalada separadas y una sola aparición en respuesta. No se codifican esos nombres/IDs/precios en producción.

API real:gpt-4.1-2025-04-14,configuración privada leída sin imprimir secretos,sin deploy. Primer retest2requests pasó la compra2bowls+2wraps y falló en consulta «Antes de seguir,cuánto vale todo eso?» por handler determinista,0requests adicionales en consulta. Se corrigió isCartChargeQuestion mediante referencia agregada y preámbulos limitados;controles negativos impiden comerse compras,hipótesis o consultas de un producto. Segundo retest2requests pasó conversación completa incluido total67.200 sin mutar carrito.4requests nuevas,60autorizadas/56usadas/4restantes,espejo sincronizado. Informes /tmp/ppp-accepted-plan-live-report.json y /tmp/ppp-accepted-plan-retest-live-report.json. Captura versionada scripts/fixtures/whatsapp-recorded-distributed-output.json contiene argumentos reales/resultado/reply de caso sintético. Caso ya conocido:desarrollo/regresión,no evaluación independiente nueva. No acredita WhatsApp real,voz,foto ni separación de tenants.

TypeScript aprobado /tmp/ppp-accepted-plan-tsc-final.log.93contratos aprobados (antes del ajuste final de total y respuesta) /tmp/ppp-accepted-plan-approved-contracts.log;router27 /tmp/ppp-accepted-plan-approved-router.log;3repartos/notas /tmp/ppp-accepted-plan-reply.log;total+negativos /tmp/ppp-accepted-plan-total.log. Global actual /tmp/ppp-accepted-plan-full.log con snapshot src+scripts /tmp/ppp-accepted-plan-source.json:esperar footer,fuente congelada. No desplegar ni tocar Main.

Siguiente evaluación independiente debe cubrir líneas con notas distintas pero mismos atributos,repartos con pronombres sin repetir SKU,grupos numéricos y negaciones corregidas,mix de aceptados/rechazados/productos ausentes,análisis de completitud de todo el mensaje. Lote aceptado no prueba que el modelo no omitió un producto ajeno al catálogo;intentMisses ya no se toma del parser viejo en ese lote,así que ausencia real debe respaldarse con resultados de búsqueda/contrato semántico. Mantener límites y controles negativos;no volver a confiar en tokens sobrantes como prueba de plato ausente ni considerar toda compra incompleta como reconstruible por fallback.


## Integración tras cambios concurrentes (15/10)

La primera global /tmp/ppp-accepted-plan-full.log terminó3suites/10testsfallidos,5419aprobados/5429totales,en2015.705s. NO valida el estado actual:8archivosTS cambiaron durante esa ejecución (address-change-checkout,agent,distributed-variants+spec,general-accuracy,orchestrator,purchase-plan+spec). El usuario confirmó «Ya no está editando;puedes integrar y validar». Se preservan todos esos cambios y se evalúa el conjunto;no reset/stash ni sobrescritura de trabajo ajeno. No se vuelve a gastar API por esta integración.

Cambios concurrentes integrados:pares del mismoSKU con notas distintas se expanden a cláusulas independientes;las líneas pendientes conservan su propio segmento/cantidad/nota sin absorber el mensaje entero;el acuse empareja cada etiqueta repetida con otra fila del carrito;la evidencia del lote permite notas no vacías distintas con mismos atributos,pero rechaza duplicados o un gemelo sin nota;corregir dirección conserva awaiting_name/phone/payment/finalconfirm cuando falta ese dato,actualiza destino y vuelve al paso. La expectativa antigua de checkout se ajustó para no saltar nombre/teléfono por cambiar dirección:es cambio de comportamiento deseado,no eliminación de protección.

Fallas observadas y cierre focalizado:consultas agregadas habían quedado sin recordatorio de teléfono y sin limpiar pendingCompositionAsk;los cambios nuevos ya recuperaban ambos. Las pruebas de herramientas viejas usaban un catálogo parcial sin extractQuantityNearProduct:se añade explícitamente stub null en whatsapp-agent.spec.ts,no se oculta el error en producción. Reemplazo heredaba2unidades,pero el nuevo validador literal lo convertía en1 sin cantidad nueva:el contexto interno preserveReplacementQuantity protege herencia si replace_item no recibióquantity (no es un argumento público manipulable del modelo). Opciones exactas enviadas en note («Asada»/«Frita») deben seleccionar su cláusula antes del guard de variantes;se obtiene scopedChoices sin mutar argumentos originales. Ambos casos antiguos se mantienen con sus oráculos.

Revisión de notas del cambio concurrente:solo puede reducir a la cantidad propuesta si la nota realmente aparece en el segmento y la propuesta no supera cantidad calculada;dos controles evitan que nota hablada/inventada lleve de2a8unidades. No se afirma validación semántica completa de notas heredadas/contextuales.

Focalizadas actuales:146tests en5suites /tmp/ppp-integrated-focused.log;77recorridosrouter /tmp/ppp-integrated-router.log;82contratos finales /tmp/ppp-integrated-final-contracts.log. TypeScript aprobado /tmp/ppp-integrated-final-tsc.log. Global definitiva del conjunto /tmp/ppp-integrated-final-full.log,snapshot src+scripts /tmp/ppp-integrated-final-source.json. Fuente congelada;esperar footer y comparar. Fuente de la última evaluación real era anterior a esta integración:el caso compra+total pasó entonces con gpt4.1,las nuevas familias de notas/dirección se acreditan por pruebas gratuitas,no por nueva inferencia ni WhatsApp real. Presupuesto continúa56usadas/4restantes;no deploy ni Main.

Se prepara scripts/fixtures/whatsapp-next-mixed-orders-1510.json con3recorridos nuevos,NO ejecutados:producto ausente+nota dirigida,reparto con una nota y un gemelo normal,paquete trío+cantidad absoluta de bebidas. No cuentan como pruebas pasadas ni evaluación independiente ejecutada;usar selección acotada y saldo4si se decide medir tras cerrar la validación actual.


Cierre validado del conjunto15/10:70suites/5456tests aprobados en476.716s (/tmp/ppp-integrated-approved-full.log);snapshot src+scripts intacto (/tmp/ppp-integrated-approved-source.json).59tests adicionales frente a8dc95443,contando cambios concurrentes integrados.149contratos reparados /tmp/ppp-integrated-repair-final-contracts.log,32router /tmp/ppp-integrated-repair-final-router.log,TypeScript /tmp/ppp-integrated-repair-final-tsc.log. La global previa70/5455 falló4tests:3oráculos pedían frase exacta«cómo pagas»aunque retomaba correctamente«método de pago»;se aceptan ambas expresiones y se añade estadoawaiting_payment.1fallo real perdía«más yuca»por cortar cada conjunción. Ahora preferenceSource delimita otro producto antes de extraer notas:conserva sinensalada+masyuca en una línea y sincilantro en otra,con regresión adicional. No cuenta como verde ningún run previo fallido o con cambios de fuente.

Evaluación nueva first-mixed0requestsfalló antes del modelo:unavailableAskReply devolvió rechazo de«brownie deja solo lo demas»y carrito vacío,agentTurns0. Clasificador isAvailabilityInquiry sobre el mismo mensaje devuelvefalse (compra),pero el constructor de reply vuelve a parsear availabilitySubject sin respetar ese resultado. Evidencia gratuita /tmp/ppp-mixed-intent-boundary.log:consulta genuina«Tienen brownie?»truecon rechazo correcto;mensaje mixtofalsepero builder rechazaba igual. Este caso ya fue inspeccionado:es regresión de desarrollo a partir de ahora;los otros2del fixture siguen sin ejecutar. Se cierra commit de integración validada y se aborda la frontera de disponibilidad después. Presupuesto56usadas/4restantes,no se pagó por ese fallo. Sin deploy/Main.


## Frontera de disponibilidad y presupuesto agotado (15/10)

Base81b4fd13 integrada y publicada enstaging,sin deploy/Main. La corrección nueva exige isAvailabilityInquiry antes de construir unavailableAskReply;no convierte una condición de disponibilidad dentro de una compra en consulta completa.6contratos de intención y1recorrido con router/agente/catálogo reales y proveedor simulado aprobados;84contratos existentes de catálogo/lenguaje aprobados. Primer mock de segundo turno no tenía respuestas de proveedor suficientes:se completó la fixture,no se trató su excepción como fallo semántico real.

Reensayo con gpt-4.1-2025-04-14:4requests,36775prompt/24832cached/218completion,sin estimar USD. Primer turno aprobado:2bowls+1wrapYogur,deniega brownie. Segundo turno propone y aplica update_item soloalwrap,sincebolla;bowls intactos. El límite explícito4impide obtener la respuesta final de ese turno,registra agent_error/budgetExhausted. Resultado global aceptado0/1:NO presentar como conversación completa verde ni como incapacidad del modelo para interpretar la nota. Informe /tmp/ppp-mixed-conditional-live-report.json.60autorizadas/60usadas/0restantes,espejo privado sincronizado. No llamadas adicionales sin autorización.

Global de esta corrección /tmp/ppp-mixed-conditional-full.log;snapshot /tmp/ppp-mixed-conditional-source.json;TypeScript /tmp/ppp-mixed-conditional-tsc.log. Esperar resultado y comprobar fuente. Prioridades pendientes:1reparto con una variante normal/otra connota;2paquetes y cantidades absolutas;3completitud y aceptados+rechazados;4respuesta coherente al fallar proveedor tras herramientas aceptadas. Los otros2recorridos del fixture next-mixed-orders-1510 siguen sin ejecutar con modelo. Voz original no medida por falta de archivos;no equivaler transcripción a detección de audio.

Cierre de disponibilidad:70suites/5463tests aprobados en469.355s,TypeScript sin errores,snapshot src+scripts intacto. /tmp/ppp-mixed-conditional-full.log y /tmp/ppp-mixed-conditional-source.json.7regresiones nuevas;se publica corrección validada enstaging,sin deploy ni cambios aMain. Modelo:primer turno real verde,segundo sin respuesta final por tope de presupuesto;no elevar a conversación completa aprobada.


## Tanda de destinatarios y paquetes (15/10, base647a3739)

Usuario autoriza seguir gastando moderadamente para funcionalidad;se asignan12requests operativas y3de margen para evitar cortar un diálogo a mitad de tools (15elegidas por agente,no cifra prometida por usuario). Primero7requests:mixto completo aprobado5;caso nuevo destinatarios falla2,modelo llamó add_item505×1normal,505×1sincecilantro,501×1 correctamente;backend rechazó501different_dish_not_requested y guardó«cada uno. A la de…Además…»como dirección. Se detiene,se reproduce gratis. Dirección inválida recortó el texto antes de validar la herramienta. Además evidencia de lote rechazaba siempre un gemelo normal juntoaotroconnota,volvía al parser viejo y declaraba nombres de destinatarios como platos ausentes.

Corrección:extractDeliveryTail excluye cadauno/cadaquien/porpersona/porcomensal y evita capturar «a la de…»/«en la de…» como destino;doslíneas mismoSKU+attrs con notas distintas (incluida vacía para normal) conservan loteaceptado,pero signatures idénticas rechazadas. Prueba libre con2catálogos:normal+sincecilantro+tercerplato,nombre intacto,sindirección,sin falsosnohay. Reensayo modelo2requests aprobado incluido total37100. /tmp/ppp-recipient-retest-live-report.json.

Luego paquete recibióHTTP429 credit_balance_exhausted1requestcontabilizada,0respuestas. Usuario recargó créditos;no reintento ciego antes del aviso. Gratis:PPP+vegetal+japonesa verifican paquete1,bebidas2→3absolutas,sinazúcarretiene nota. Falló literal«dos te de jazmin»→1tras limpiar texto;se obtiene cantidad unida al nombre completo antes de splitter de búsqueda,después de reglasdistribución. «duo de tacos»antesabría4opciones pese a tamaño;shorthandduo/trio aplica conteo delSKU y exigeaclaración si2SKUsdelmismotamaño.4controles de ambigüedad y5casosnamedpack nuevos. Dos oráculos PPP exigían orden de filas pero ruta determinista añadía bebidasprimero;se comparaidentidad/cantidadsinorden y mockupdate usa índiceactual,noíndicefijo1. Otros4tests se llamaron al resolvemulti con solo1producto y retornaban legítimamente null;se corrigiófixture añadiendoagua para probar esecontrato,no se cambióproducción por elfixtureinválido.

Modelo trasrecarga:paquete completo aprobado4requests,/tmp/ppp-pack-after-refill-live.json.35858prompt/32512cached/158completion. Registroacumulado75operativas/74usadas/1restante;14nuevasestaentrega,incluye1HTTP429. Lo pagado permite corroborar casos conocidos;ninguno es ya holdoutindependiente. Captura versionada whatsapp-recorded-recipient-pack-output.json conserva args/resultados+carrito/respuesta sintéticos,no secretos. Trescasos delnextfixture actualizados development_retest_passed. No modelo distinto,se conserva gpt4.1snapshot. SinWhatsAppreal/voz/foto ni órdenesexternas.

Global /tmp/ppp-recipient-pack-full.log,snapshot /tmp/ppp-recipient-pack-source.json,TypeScript /tmp/ppp-recipient-pack-final-tsc.log. Esperar resultadoycomparar antespublicar. Próximo:recuperación coherente tras proveedortécnicofalla luegoactions,completitudmensajeyaceptados+rechazados,pronombrescorreccionesentrelíneassimilares. No deploy/Main.

Cierre definitivo destinatarios+paquetes:70suites/5491tests aprobados en490.707s,28regresiones nuevas frente647a3739. /tmp/ppp-recipient-pack-full.log;src+scripts idénticos a snapshot /tmp/ppp-recipient-pack-source.json;TypeScript limpio /tmp/ppp-recipient-pack-final-tsc.log. Se publica el bloque en staging sin deploy ni cambios aMain.14requests en esta tanda,13respuestas exitosas+1HTTP429;saldo operativo1de75acumuladas. No extrapolar3reensayos aprobados a comprensión completa de todos los pedidos. Próximo bloque recuperación técnica+completitud/lotesmixtos,documentado arriba.


## Recuperación técnica y frontera condicional (15/10, base931c6a4e)

Primera reproducción gratuita:el agente aceptaba update_item y luego fallaba proveedor;carrito tenía nota correcta pero respuesta decía «No pude procesar».8recorridos de dos cartas prueban timeout sostenido (1request con tools+3intentos fallidos),HTTP500,choicesvacío,contentvacío. El primer mock solo fallaba una vez y un retry devolvía undefined/TypeError;se corrigió a fallo sostenido,no se atribuyó ese TypeError a producción. Tras aplicar guard y comprobar cambio real de carrito,se preserva sesión,se muestra carrito efectivo y se pide revisión antes de continuar;no confirmación externa. empty_reply con acciones ya no se devuelve a fallback antes de guard. API401 conserva rama antigua;pendiente explícito,no afirmar todos los códigos cubiertos.

Mixtos:4contratos frontera agente+guard+planner con proveedor simulado en2cartas,normal/timeout;rechaza wrap/rollcon camarones,conserva2bowls+2bebidas sinazúcar. El handler agentDroppedResolvedDish interpretaba rechazo como olvido y devolvía todo a parser;ahora coteja adiciones aceptadas por multiplicidad y conserva lote,excluye de esperados los SKUs rechazados sin éxito posterior,explica fragmento no añadido. No es completitud semántica global. IDs no distinguen una variante rechazada y otra aceptada del mismoSKU:necesita identidad de línea/evidencia por propuesta. No ocultar esa deuda.

Dos pruebas de entrada completa encontraron que fastpath de productos embebidos añadía base con ingrediente ausente,sin llamar modelo. Nuevo helper rejectUnsupportedResolvedModifiers para segmentos con«con»,misma comprobación que add_item,los mueve a unresolved;se aplica en rutas de multi usual y embebida. No se filtran sustituciones ya anotadas con su contrato. Dos positivos receta:hummus/aguacateconfirmados;4contratos de tools receta sí/no. uncoveredWordsAnchoredByProduct usa descripción además de nombre/atributos para el producto ya anclado (el ancla sigue por nombre). No extender ausencia a ingredientes sin«con» ni afirmar parsing universal.

Evaluación nueva de 3turnos recibió0requests y falló antes de IA:«Me mandas un wrap… y un bowl. Si no tienen brownie, omítelo,noquierootropostre» perdía bowl y trataba instrucciones como platos ausentes. Causa:atajo multi anterior al agente. Ahora requiresConditionalOrderInterpretation delega compra+condición de inventario al agente antes de ese parser,solo buildingcart+featureactivo+sinpendientes;10contratos positivos/negativos (consultas,confirmación,no-order) y1router preservan mensajeentero. Si handler no resuelve,no pasar a atajo parcial. Esto no migra todo el router ni legacy apagado.

Usuario autorizó seguir gastando moderadamente;se amplió tope operativo+5para contar con6disponibles,no cifra dictada por usuario. Reensayo 3requestsreal gpt-4.1-2025-04-14 pasó los3turnos:2platos,ausencia brownie,cambio SalsaTahini+sincebolla soloalwrap,total33600.27704prompt/25856cached/174completion,sinestimaciónUSD. /tmp/ppp-fresh-mixed-correction-retest-live.json;captura sintética scripts/fixtures/whatsapp-recorded-conditional-correction-output.json. Es desarrollo tras fallo,no holdout. Acumulado80/77/3,espejo privado sincronizado. No se gastó en errores artificiales.

103contratos en4suites antes del gatingcondicional;32focalizadas en2suites tras gating+receta+recuperación. TypeScript limpio antes de global;global /tmp/ppp-technical-mixed-full.log,snapshot /tmp/ppp-technical-mixed-source.json,TypeScript /tmp/ppp-technical-mixed-approved-tsc.log. Esperar footer y hashes. No deploy/Main. Siguientes:rechazos porlínea+variantes,pendiente persistente deproducto no añadido,API401 tras tools,nuevas conversaciones no inspeccionadas,replay clientes.

Primera global técnica/mixtos terminada:2suites/4testsfallidos,5518aprobados/5522totales,en854.863s. Source no se editó durante el run;NO valida entrega. Fallos existentes:PDFchat1perdíaplatano53;trucha+papasaladaen2chats;BandejaPronto«pollo con piernapernil». Diagnóstico temporal de fixtures mostró uncovered[ maduro ],[papa,salada],[pollo] en fichas sin descripción. Se retiró logging temporal. Nuevo guard solo infiere ingredientes ausentes de fichas con descripción de receta;las incompletas conservan comportamiento previo. No se cambian4oráculos ni se elimina controlcamaronesenrecetasdescritas. Esta frontera NO resuelve metadatos de receta ausentes en todos los restaurantes:deuda explícita de onboarding/clarificación.35focalizadas en3suites aprobadas /tmp/ppp-technical-mixed-repair-focused.log.

Global definitiva /tmp/ppp-technical-mixed-approved-full.log,snapshot /tmp/ppp-technical-mixed-approved-source.json,TypeScript /tmp/ppp-technical-mixed-approved-final-tsc.log. Fuente nuevamentecongelada. Evaluaciónmodelo3requestsanterioralúltimoajustedefichasincompletas;sucartateníadescripciones,sehacepruebagratuitadelconjuntofinal,no nuevo gasto. Enla traza:3requestssoloenprimerturno,segundo(opción+nota)ytercero(total)resueltosporrouter,cumulativeagentTurns1. No afirmar que modelo ejecutó todaslascorrecciones.

Cierre definitivo técnica/mixtos/condicionales:70suites/5522tests aprobados en486.72s,31regresiones nuevas frente931c6a4e. Fuente src/scripts TS idéntica a /tmp/ppp-technical-mixed-approved-source.json. TypeScript /tmp/ppp-technical-mixed-approved-final-tsc.log vacío. Evidencia global /tmp/ppp-technical-mixed-approved-full.log. Se publica solo rama staging;no deploy ni Main. Presupuesto80/77/3,esta entrega3requestsreales,fallos técnicos siempre simulados. No elevar la primera global roja a verde;se conserva el historial y los4oráculos originales. Pendientes descritos arriba siguen abiertos.
