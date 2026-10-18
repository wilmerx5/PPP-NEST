## VALIDADO — límite de conversión parcial a combo, 18/10/2026

Global verde: 87 suites / 9.172 pruebas en 573.47 s, 378 hashes intactos. Pasan 56 focalizados, TypeScript y 92 contratos Node. Ocho fallos iniciales de conversión de toda la línea protegidos. 16 conversaciones en dos menús verifican respuesta, carrito, estado, consulta y DTO simulado; 12 controles del parser separan alcance de unidades y cantidades de bebidas.

La conversión automática parcial NO está implementada: se conserva el pedido y se explica que el cambio parcial no pudo aplicarse. El cliente puede mantenerlo o solicitar explícitamente el cambio de toda la línea. Siguiente objetivo: conversión parcial real preservando el resto de platos, bebidas y notas; ampliar controles de cero/exceso y líneas ambiguas.

Publicación/despliegue agrupado con aviso de bebidas aparte en curso, solo staging. Cero llamadas pagadas, Meta, mapas reales y órdenes externas. Main preservada. No declarar mejora de precisión del modelo por estos mocks.

## GLOBAL ACTIVA — protección de conversión parcial a combo, 18/10/2026

Base 9465dbc0. Ocho fallos de baseline reproducidos: una petición limitada podía cambiar toda la línea. Se protege el carrito con aclaración explícita; NO implementa conversión parcial automática. 16 conversaciones completas con dos menús, agente simulado encendido/apagado y estado carrito/pago; 12 controles del parser. Pasan 56 focalizados, TypeScript y 92 contratos Node. Fuente congelada en /tmp/ppp-partial-combo-source-1810.json; no editar ni desplegar durante global /tmp/ppp-partial-combo-global-1810.{log,json}.

Sin API pagada, Meta, mapas reales ni órdenes externas. Main preservada. Aviso anterior de bebidas aparte sigue pendiente de despliegue agrupado. Siguiente: implementar conversión parcial con conservación exacta de unidades/bebidas; esta protección solo evita corrupción.

## VALIDADO — aviso de bebidas aparte; desplegar con la siguiente tanda, 18/10/2026

Código `6c5de4248cad4a4b963c83394902d13a58c8f5f1` publicado en origin/staging. Despliegue pendiente para agrupar con la siguiente tanda; no reconstruir solo por este cierre documental.

Global final de 86 suites / 9.144 pruebas en 570.533 segundos, con 376 hashes intactos. Pasan 58 controles focalizados, TypeScript y 92 contratos Node. No hay suites activas. Se corrigieron 16 fallos de respuesta sin alterar reglas de cálculo ni de conservación del carrito: la conversión a combo enumera las bebidas que siguen aparte con cantidad y sabor. La retirada explícita posterior elimina la bebida suelta y conserva la incluida en el combo.

22 pruebas nuevas: 16 conversaciones completas con dos menús y seis controles del aviso; las conversaciones anteriores de sabores también exigen ausencia del aviso cuando no queda botella aparte. Se verifican respuesta, estado, carrito, consulta de total, corrección, checkout y DTO simulado. Evidencia: `whatsapp-retained-drink-notice-validation-1810.json`. Los servicios/modelos son mocks; no son pruebas reales del modelo.

Despliegue diferido para agrupar esta mejora de respuesta con la siguiente tanda. El último runtime verificado sigue siendo `5693c57b`, imagen `d8d72cc1…`, comprobado a las 20:05:51 UTC; no afirmar que este aviso ya está activo. Queda preparado el probe `/tmp/ppp-retained-drink-notice-compiled-1810.cjs` para ejecutar al desplegar. Main, configuración privada, modelos, bases y volúmenes no se tocaron. Cero llamadas pagadas, Meta y órdenes externas; presupuesto 188/187/1 intacto.

Siguiente: cuatro unidades del plato más cuatro botellas; convertir exactamente dos a combo, conservar dos platos solos y dos botellas. Comprobar cantidades/variantes/DTO, no solo total: el precio podría coincidir incluso con un reparto incorrecto. Si no soporta conversión parcial, aclarar sin convertir las cuatro unidades. La división de atributos del mismo SKU no acredita por sí sola un cambio parcial a otro SKU combo. Después retomar unidades internas con letras y formularios etiquetados. Un solo lote cerrado en este despertar. Entradas inferiores históricas.

## GLOBAL ACTIVA — bebidas que quedan aparte al convertir a combo, 18/10/2026

Base `c617c825`, staging limpio y origin sincronizado al comenzar; no había otra validación/despliegue activo. Se midieron 16 fallos de respuesta: el carrito conservaba correctamente botellas, pero la conversión no las mostraba. La respuesta ahora enumera las bebidas que siguen aparte con cantidad y sabor, sin retirarlas ni abrir una selección que bloquee el checkout. La retirada explícita posterior conserva la bebida incluida en el combo.

22 regresiones nuevas: 16 conversaciones completas en dos menús y seis controles sin mutación. Pasan 58 focalizados, TypeScript y 92 contratos Node. Fuente congelada con 376 hashes en `/tmp/ppp-retained-drink-notice-source-1810.json`. Global `/tmp/ppp-retained-drink-notice-global-1810.{log,json}`. NO editar fuente ni iniciar otra suite/despliegue mientras esté activa. Evidencia `whatsapp-retained-drink-notice-validation-1810.json`. Un primer intento de baseline falló por tipado del test; solo baseline-final mide los 16 fallos reales.

Runtime de staging sigue `5693c57b`; Main `14d9dd84` intacta. Cero llamadas pagadas, Meta u órdenes externas. Después de global verde y hashes iguales: publicar solo staging, agrupar deploy con siguiente tanda si no requiere actualización inmediata. Siguiente: conversión de dos de cuatro unidades y sus bebidas; unidades internas con letras y formularios etiquetados. Entradas inferiores históricas.

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

## VALIDADO — sabor de botella al convertir a combo, 18/10/2026

Global final: 86 suites / 9.122 pruebas en 580.25 segundos, 376 hashes intactos. Pasan 36 focalizados, TypeScript, 92 contratos Node y probe local de 12 combinaciones. Ocho fallos iniciales quedaron corregidos. No hay suites activas. Falta publicar/desplegar solo staging y comprobar compilado/health. Runtime aún `3a5a204b`; Main `14d9dd84` intacta. Evidencia `whatsapp-combo-flavour-validation-1810.json`. Cero llamadas pagadas, Meta u órdenes externas; presupuesto 188/187/1 intacto.

Después: explicitar en la respuesta una botella retenida por sabor incompatible y aclarar intención si hace falta; conversión de un subconjunto de unidades; unidades internas con letras, formularios etiquetados y notas por subconjunto. No atribuir nueva precisión al modelo por los mocks. Entradas inferiores históricas.

## GLOBAL ACTIVA — sabor de botella al convertir a combo, 18/10/2026

Base `9e505494`, staging limpio al comenzar y sincronizado con origin. Ocho fallos reprodujeron que el tamaño entre marca y sabor impedía reconocer Zero/Sin Azúcar: se conservaba una botella que debía incluirse o se retiraba otra distinta. Se retira el tamaño solo de la frase usada para comparar sabor, después de validar volumen como antes. No cambia cantidades ni notas.

20 regresiones nuevas: ocho conversaciones completas en dos menús y doce guards de formato de volumen/sabor. Pasan 36 focalizados, TypeScript y 92 contratos Node. Fuente congelada con 376 hashes en `/tmp/ppp-combo-flavour-source-1810.json`. Global `/tmp/ppp-combo-flavour-global-1810.{log,json}`. NO editar fuente ni iniciar otra suite/despliegue mientras esté activa. Evidencia `whatsapp-combo-flavour-validation-1810.json`.

Runtime de staging sigue `3a5a204b`; este cambio aún no está desplegado. Main `14d9dd84` preservada. Cero llamadas pagadas, Meta y órdenes externas; presupuesto 188/187/1 intacto. Tras global verde y hashes iguales: publicar solo staging; agrupar despliegue si la verificación lo permite, con rollback, compilado y health. Después: unidades con letras y cambios de unidad, formularios etiquetados y notas sobre subconjuntos. Entradas inferiores históricas.

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

## VALIDADO — listo para publicar y desplegar SOLO staging, 18/10/2026

Global final86suites/9102tests en566.854s,376hashes intactos;50controles de abreviaturas/rutas yTypeScript,92Node previos y probes locales actuales aprobados. Incluye checkpoint29da6788 con cierre/datos/bebidas/unidades. No hay suites activas. Falta publicar/desplegar y verificar compilado/health. Staging vivo aúnbd23e68d;Main14d9dd84 preservada. Ver whatsapp-fresh-street-validation-1810.json y whatsapp-sales-closure-validation-1810.json. SSH tuvo timeout transitorio y se recuperó;health público responde. No afirmar ya desplegado hasta cierre. CeroAPIpagada/Meta/órdenes externas. Entradas inferiores históricas.

## GLOBAL ACTIVA — direcciones abreviadas en ráfagas, 18/10/2026

Checkpoint anterior29da6788 validado global86suites/9074tests,NO desplegado aún. Nuevo chatTv:forma sin punto ya pasaba;8fallos conTv./Kr frente a8verdes iniciales. Normalización acotada a dirección numerada completa,28tests nuevos,50focalizados yTypeScript verdes. Fuente congelada 376hashes /tmp/ppp-fresh-street-source-1810.json. Global /tmp/ppp-fresh-street-global-1810.{log,json}. NO editar fuente ni lanzar otra suite/deploy hasta cierre. Ver whatsapp-fresh-street-validation-1810.json. Tras verde+hashes publicar ambos commits/desplegar SOLO staging y verificar compilado/health/rollback. Runtime siguebd23e68d,Main14d9dd84 preservada. CeroAPIpagada/Meta/órdenes externas. Entradas inferiores históricas.

## LOTE VALIDADO LOCAL — cierre, bebidas y unidades, 18/10/2026

Global final86suites/9074tests en575.345s aprobada,376hashes intactos;516focalizados,21controles finales,TypeScript,92Node y probe local verdes. Dos globales fallidas previas documentadas;solo repaired-global es aceptación. No desplegado aún;staging vivo bd23e68d,Main14d9dd84 preservada. Evidencia whatsapp-sales-closure-validation-1810.json. Se guarda checkpoint antes de reproducir nuevo chat humano de ráfaga conTv78C#6D-48. No hay global activa al escribir esta entrada. Agrupar deploy SOLO staging al cerrar esa reproducción. Auditoría productiva de contacto:respuesta121caracteres conidMeta a2s;no acredita renderizado en dispositivo. CeroAPIpagada/Meta/órdenes externas. Entradas inferiores históricas.

## GLOBAL ACTIVA FINAL — fuente reparada, 18/10/2026

21controles finales (incluyen los dos pedidos largos que fallaron) yTypeScript verdes,además de516focalizados/92Node previos. Fuente congelada 376hashes /tmp/ppp-sales-location-repaired-source-1810.json. Global /tmp/ppp-sales-location-repaired-global-1810.{log,json}. NO editar fuente ni lanzar otra suite/deploy hasta terminar. Dos globales de cierre fallidas documentadas,NO son aceptación. Staging activo bd23e68d,Main14d9dd84 intacta. Tras global verde/hashes iguales:probe local,publicar/desplegar SOLO staging,probe compilado/health/rollback y cierre documental. Ver whatsapp-sales-closure-validation-1810.json. CeroAPIpagada/Meta/órdenes externas. Entradas inferiores históricas.

## GLOBAL TERMINADA CON 2 FALLOS — alcance del pedido largo, 18/10/2026

Segunda global86suites/9074tests:9072verdes y2fallos en pedido largo con arroz con pollo;no publicar/desplegar. El separador de bebida aceptaba bebida enterrada después de otro plato/nota. Se exige prefijo de bebida resuelta y cláusula derecha sin punto y coma/salto de línea. Se conservan tests existentes;validar focalizados y repetir global con nueva fuente congelada. No hay global activa al escribir esta entrada. Main/staging vivo intactos. Evidencia whatsapp-sales-closure-validation-1810.json. Entradas inferiores históricas.

## GLOBAL ACTIVA — cierre, bebidas y unidades de dirección, 18/10/2026

516focalizados/7suites,TypeScript y92Node aprobados. Fuente congelada 376hashes /tmp/ppp-sales-location-frozen-source-1810.json. Global /tmp/ppp-sales-location-accepted-global-1810.{log,json}. NO editar fuente ni lanzar otra suite/deploy hasta terminar. Primera global de cierre falló87tests (contacto absorbía direcciones/códigos); corregido,484regresiones previas pasan. Esta nueva global debe aprobar completa. Staging vivo bd23e68d,Main14d9dd84 preservada;no publicado/desplegado. Ver whatsapp-sales-closure-validation-1810.json. Incluye bebida explícita+extras,conversión combo sin duplicar botella compatible,contacto reconocido y lugar separado de entrada/apto para mapa/DTO. Silencio productivo del último chat no tiene causa confirmada sin trazas. CeroAPIpagada/Meta/órdenes externas. Tras verde+hashes:publicar/desplegar SOLO staging con rollback,probe compilado y health. Entradas inferiores históricas.

## GLOBAL FALLIDA — corrección de contacto en revisión, 18/10/2026

Global terminada:84suites,83verdes/1fallida;8950verdes/87fallos. NO publicar/desplegar. Se detectó detección temprana de contacto demasiado amplia: absorbía direcciones con múltiples números y texto de imagen con códigos. Se acota a mensaje text y forma completa numérica/con etiqueta de contacto. Fuente descongelada para corregir; repetir afectados y global antes de aceptación. Registro whatsapp-sales-closure-validation-1810.json. Staging vivo bd23e68d,Main intacta. Nuevo chat humano: revisar bebida explícita junto a pollo/extras y teléfono durante pago;no atribuir el silencio observado a una causa sin trazas.

## GLOBAL ACTIVA — cierre de venta agrupado, 18/10/2026

125 focalizados, TypeScript y92Node aprobados. Fuente congelada con373hashes en /tmp/ppp-sales-closure-source-1810.json. Global /tmp/ppp-sales-closure-global-1810.{log,json}. NO editar fuente ni lanzar otra suite/despliegue hasta terminar; verificar proceso y resultado real. Dos globales previas interrumpidas NO son aprobación. Evidencia whatsapp-sales-closure-validation-1810.json. No publicado/desplegado aún; staging vivo bd23e68d, Main14d9dd84 intacta. Cero API pagada/Meta/órdenes externas. Después de verde y hashes iguales: publicar/desplegar SOLO staging con rollback y probe compilado/health.

## EN CURSO — cierre de venta y datos compuestos, 18/10/2026

Fuente local no publicada sobre c894687e. Se agrupan opción canónica y cierre de venta: contacto, nombre+pago, formulario multilinea de productos/destinatario/dirección/teléfono, nota de empaque y dirección numerada con referencia. Las dos globales de opción canónica se interrumpieron con exit130 ANTES de editar; no son aceptación. No hay global activa al escribir esta entrada. Antes de publicar ejecutar controles finales, TypeScript, Node y UNA global con hashes congelados. No desplegar esta fuente hasta aprobarla.

El teléfono del último chat sí persistía: la corrección del usuario aclara que faltó responder una consulta. La consulta exacta NO está en el fragmento y NO se declara reproducida; se comprueba una consulta de total durante pago con carrito/estado conservados y DTO simulado. No hay llamadas pagadas, Meta ni órdenes externas. Producción/Main preservadas; staging activo sigue bd23e68d. Auditoría de configuración: MP productivo habilitado y staging deshabilitado; no se modificó configuración. Efectivo/transferencia siguen alcance del piloto. Ver próximo registro whatsapp-sales-closure-validation-1810.json. Entradas inferiores históricas.

## Global vigente — opción canónica y prefijos, 18/10/2026

La primera global se detuvo (exit130, sin editar durante ejecución) para reproducir un fallo adicional: opción corta ganaba a una más larga del mismo prefijo. Ahora 11 tests nuevos y 127 focalizados verdes; prioridad a opción completa más larga sin mutar catálogo. TypeScript verde. Global vigente /tmp/ppp-canonical-degree-final-global-1810.{log,json}, manifest final-source con370hashes congelados. No editar fuente ni lanzar otra suite/deploy. Runtime continúa bd23e68d; Main intacta. Cierre previsto: publicar validado solo staging, agrupar deploy con siguiente tanda. No atribuir éxito a la global interrumpida. Evidencia whatsapp-canonical-degree-validation-1810.json.

## EN CURSO — 18/10/2026: opción canónica en frase completa

Base c894687e. Seis fallos reprodujeron que «Quiero dos… con Estilo No Tan Picante/Dulce/Salado» elegía Natural en vez de la opción literal. La prioridad literal ahora admite la frase explícita con+atributo+opción y conserva rechazo/preferencia suelta. Diez pruebas nuevas: seis conversaciones router→precio→DTO en tres menús y cuatro controles de catálogo. 126 focalizados, TypeScript y 92 Node aprobados. Global EN CURSO /tmp/ppp-canonical-degree-global-1810.{log,json}, 370 hashes congelados: NO editar fuente ni iniciar otra suite/deploy hasta cierre. Evidencia whatsapp-canonical-degree-validation-1810.json. Main/producción/modelos/presupuesto intactos; cero API pagada/Meta/órdenes externas.

Después: «menos dulce»/«sin tanto azúcar», cambios sobre subconjuntos y retirada de una cláusula de nota. No afirmar cubiertos por estas compras iniciales; no garantizar preparación ni comprensión universal. Publicar solo staging tras global verde; agrupar despliegue si no hay otro cambio urgente. Entradas inferiores históricas.

## VIGENTE — 18/10/2026, 13:04 Bogotá: opciones e intensidad desplegadas en staging

Código `bd23e68d5641820bb3d5624b16c3e563c1c1241d` publicado y desplegado solo en staging. Imagen activa = candidate `sha256:506ac358710a356e6312f065e6c52cbd2c86b7e0d1646fc86c7138cd1561368e`; contenedor running/healthy y health OK, DB connected, circuito CLOSED a las 18:03:52 UTC. La primera inspección dio starting; únicamente la comprobación posterior acredita healthy. Rollback `ppp-nest-staging:rollback-before-bd23e68d`. Probe compilado aprobado: seis propuestas deliberadamente contradictorias del modelo se corrigen desde la fuente y conservan nota, además de los controles previos. Evidencia `whatsapp-intensity-options-validation-1810.json`.

29 regresiones nuevas: 12 conversaciones router → consulta de precio → DTO simulado en tres menús, 11 controles catálogo/helper y seis herramientas reales sin nota propuesta por modelo. 111 focalizados, TypeScript, 92 Node y global final de 82 suites / 8.963 pruebas en 1585.882 s; 370 hashes intactos. La global válida es `accepted-global`; la anterior fue interrumpida con exit 130 antes de editar y no cuenta como aprobación. No es inferencia real ni acredita precisión ASR o cumplimiento en cocina. Cero API pagada, Meta y órdenes externas; presupuesto 188/187/1 sin cambios.

Main y producción sí recibieron la mejora ANTERIOR de intensidad por petición del usuario: HEAD `14d9dd84`, imagen productiva `c5e97ab1…`, running; comprobados de nuevo al cerrar. Esta tanda nueva no se promovió. Modelos, configuración privada, bases, volúmenes, bin/ y orphan preservados. No reconstruir por documentación.

SIGUIENTE: reproducir frases completas con opción canónica «No Tan Picante» (el control actual solo prueba la respuesta literal sola); luego «menos dulce»/«sin tanto azúcar», preferencias sobre subconjuntos existentes y retirada de una cláusula conservando otras. Reanudar con menús variados, respuesta/carrito/estado/DTO y controles de consultas durante checkout. Las compras iniciales actuales no acreditan esos recorridos. Mantener staging permanente y no promover nuevas tandas a Main sin solicitud. Reservadas reales, costo/latencia y supervisión siguen pendientes para decidir piloto. Entradas inferiores históricas.

## Tanda validada — 18/10/2026: opciones y preferencias, solo staging

29regresiones nuevas,111focalizados,TypeScript,92Node y global82suites/8963tests en1585.882s aprobados.370hashes intactos. Global válida es accepted-global;la anterior interrumpida exit130 NO es aceptación. Probe de herramientas reales/catálogo/adaptador contra TS local también pasó,con6propuestas deliberadamente contradictorias y nota omitida por modelo. Falta deploy/compiled/health de esta fuente;no asumir activo hasta cierre. Evidencia whatsapp-intensity-options-validation-1810.json.

Publicar/desplegar una vez SOLO staging. Main quedó14d9dd84 y producción ejecuta la mejora anterior e8cdfc2b,c5e97ab1…por autorización del usuario. CeroAPIpagada/Meta/órdenes externas,presupuesto188/187/1 intacto. Después:frases completas con opción canónica «No Tan Picante» (control actual solo respuesta literal sola),menos dulce/sin tanto azúcar,subconjuntos ya existentes y retiro de una cláusula conservando otras. No atribuir a estos mocks nueva precisión del modelo ni cumplimiento de cocina. Entradas inferiores históricas.

## Global reiniciada — 18/10/2026: nota de intensidad en herramienta real

La primera global se detuvo conSIGINT/exit130 antes de editar:lectura del tool mostró recuperación de nota incompleta tras opción explícita.6pruebas directas nuevas reprodujeron2fallos;arreglado con recuperación acotada de la cláusula de intensidad,sin rehacer otras notas. Ahora29regresiones nuevas y111focalizados aprobados,TypeScript verde. Global vigente /tmp/ppp-intensity-options-accepted-global-1810.{log,json},manifest accepted-source,370hashes congelados. NO editar fuente/otra suite/deploy hasta terminar. La global anterior interrumpida NO acredita aprobación. Main/producción preservados;solo esta fuente nueva continúa en staging. Presupuesto188/187/1 intacto.

## EN CURSO — 18/10/2026: preferencia frente a opción configurable

Base14d9dd84. La mejora anterior de intensidad YA está en Main/producción por solicitud del usuario;ver entrada siguiente. Nueva tanda SOLO staging:10fallos/2verdes iniciales reprodujeron elección accidental de Picante/Dulce o pérdida de nota después de una elección explícita. Separador acotado retira solo la preferencia de intensidad del texto usado para elegir opciones y conserva la nota original. Opción explícita anterior permanece;nombre literal completo de opción sigue válido.

23regresiones nuevas:12router→consulta→DTO en3menús y11helper/catálogo.105focalizados,TypeScript y92Node pasan;una coma residual se corrigió antes del run final. Global EN CURSO /tmp/ppp-intensity-options-global-1810.{log,json},370hashes congelados. NO editar fuente ni iniciar otra suite/deploy. Evidencia whatsapp-intensity-options-validation-1810.json. No promover esta tanda a Main automáticamente. CeroAPIpagada/Meta/órdenes externas;188/187/1 intacto.

Después:menos dulce/sin tanto azúcar,preferencias de unidades ya existentes,retirada de una cláusula conservando otras y referencias/consultas en checkout. Las12conversaciones actuales son compras iniciales,no acreditan esos casos. No garantizar cumplimiento en cocina ni comprensión universal. Entradas inferiores históricas.

## VIGENTE — 18/10/2026,12:22 Bogotá: intensidad promovida a producción

Por solicitud explícita del usuario,Main actualizado a e8cdfc2b y backend productivo desplegado. Código validado07a2416a;imagen productiva c5e97ab1f09502b3a64a73fb332665395f9e6054349b7195bc3d58081bf4559e,running,health OK/DB connected/circuit CLOSED a17:21:51UTC. Probe compilado de intensidad/herramientas/catálogo/adapter aprobado;sin inferencia ni pedidos externos. Rollback ppp-nest-api:rollback-before-e8cdfc2b. Configuración privada/compose/artefactos locales preservados,sin cambio de modelos. Evidencia whatsapp-intensity-validation-1810.json. Staging mantiene runtime07a2416a,healthy139d8378…;no reconstruir por docs.

CONTINUAR SOLO EN STAGING:preferencia negativa frente a opciones configurables,menos dulce/sin tanto azúcar,subconjuntos y retiro de una cláusula. Global previa82suites/8934tests con370hashes intactos. No acreditar comprensión real por mocks ni promover nuevas tandas a Main sin nueva solicitud. Presupuesto188/187/1 sin cambios. Entradas inferiores históricas.

## VIGENTE — 18/10/2026,12:14 Bogotá: intensidad desplegada SOLO en staging

Código07a2416a99db0e16d25b57c6ef4b3bc3556fe305 publicado y desplegado en staging. Contenedor running/healthy,imagen activa=candidate sha256:139d8378e76d26da0348361001a2ae6881635222ed464c4248e90da8bcee725f. Health OK/DB connected/circuit CLOSED a17:13:51UTC. Rollback ppp-nest-staging:rollback-before-07a2416a. Compilado acredita extracción y herramientas reales en6menús,además del adaptador/guards previos;router completo probado en TS con dependencias simuladas. Evidencia whatsapp-intensity-validation-1810.json. No reconstruir por este cierre documental.

12fallos iniciales→45regresiones nuevas:12conversaciones de intensidad con precio intermedio/DTO final,10SKU con adjetivos en nombre,23helper.82focalizados,TypeScript,92Node y global82suites/8934tests en943.587s aprobados,370hashes intactos. Gramática acotada dulce/picante/salado/ácido/grasoso con nota literal;sin excepciones por restaurante. No es nueva precisión de modelo/ASR ni garantía de preparación. CeroAPIpagada/Meta/órdenes externas;188/187/1 intacto. Main queda76a412b2,código productivoe46996fa;modelos/configuración privada/bases/volúmenes/bin/orphan preservados.

PRÓXIMA TANDA:preferencias negativas frente a atributos seleccionables (ej.Salsa Picante/Suave),«menos dulce»/«sin tanto azúcar»,retirada de una cláusula y conservación de las restantes. Después subconjuntos con variantes/nota y consultas durante checkout,menús variados. No asumir cubiertos por los6menús actuales sin atributos. Inferencia real reservada,costo/latencia y conversaciones completas siguen pendientes antes de acreditar piloto. Automatización gratuita y solo staging;no promover Main sin nueva solicitud. Entradas inferiores históricas.

## Tanda validada — 18/10/2026: intensidad pendiente de deploy solo staging

45regresiones nuevas;82focalizados,TypeScript,92Node y global82suites/8934tests en943.587s aprobados.370hashes idénticos antes/después. Probe de herramientas/catálogo/adaptador pasó contra TS local; falta ejecutarlo compilado tras deploy. Evidencia whatsapp-intensity-validation-1810.json. Base76a412b2;Main/producción intactos. Publicar/desplegar una vez únicamente staging con rollback/health/compiled, cerrar con SHA e imagen. CeroAPIpagada/Meta/órdenes externas;188/187/1 intacto.

Siguiente tanda:preferencias de intensidad negativas frente a atributos seleccionables (evitar convertir «no tan picante» en elección de Picante), «menos dulce»/«sin tanto azúcar», y retirada de una cláusula de nota conservando las otras. Añadir variantes/correcciones por subconjunto y consultas durante checkout,con menús variados. La mejora actual conserva notas literales en seis menús sin atributos;no prometer cobertura universal ni cumplimiento en cocina. Entradas inferiores históricas.

## EN CURSO — 18/10/2026: intensidad entre restaurantes, solo staging

Base76a412b2.12fallos reproducidos con flan/café/ramen/curry/limonada/tostada: «no tan dulce», «que no esté tan salado», etc., tratados como nombre de plato o rechazados por tool. Gramática acotada ahora reconoce intensidad dulce/picante/salado/ácido/grasoso conservando nota literal.45regresiones nuevas:12router→consulta precio→DTO,10SKU completos,23helper.82focalizados,TypeScript y92Node verdes. Global EN CURSO,370hashes congelados,/tmp/ppp-intensity-global-1810.{log,json}. NO editar fuente ni iniciar otra suite/deploy hasta cierre. Evidencia whatsapp-intensity-validation-1810.json.

Main/producción intactos en código e46996fa;no volver a promover esta tanda automáticamente. Agrupar staging cuando esté validado. CeroAPIpagada/Meta/órdenes externas;188/187/1 intacto. Tests con menú sin atributos no acreditan interacción entre preferencia negativa y opción seleccionable (ej. Salsa Picante/Suave), ni menos dulce/sin tanto azúcar;son próximas prioridades. No prometer cumplimiento de notas ni seguridad alimentaria. Entradas inferiores históricas.

## VIGENTE — 18/10/2026, 11:52 Bogotá: Main y staging desplegados

El usuario autorizó promoción y deploy productivo. Código e46996fae72639d8a924298b8b448a16f05d0f29 publicado en Main/staging y desplegado en ambos. Producción ppp_nest_api running, health OK/DB connected/circuit CLOSED (16:51:01UTC); imagen6e71bc54… Staging running/healthy, imagen activa=candidate cc1c4ce3… y health OK (16:51:56UTC). Evidencia exacta en whatsapp-main-promotion-1810.json. Los cuatro módulos compilados comprobados coinciden; no se comparó binariamente todo el backend.

Se alinearon los cuatro modelos en .env privado productivo con staging: agente gpt-6.1-sol, visión/assist gpt-6-luna, audio gpt-transcribe. Backup privado .env.before-model-parity-e46996fa; compose productivo intacto. Rollbacks ppp-nest-api:rollback-before-e46996fa y ppp-nest-staging:rollback-before-e46996fa. Preservados454artefactos modificados y18no versionados de Main local, archivos privados/bases/volúmenes/orphan. No frontend para subir a Hostinger.

Global final82suites/8889tests en947.954s,370hashes intactos;TypeScript,72Node,controles focalizados y probes compilados aprobados. Primer global falló en3notas ají+sin arepa: reparado antes de promoción. No son llamadas reales del modelo ni evidencia universal de venta. CeroAPIpagada/Meta/órdenes externas;presupuesto188/187/1 intacto.

CONTINUAR SOLO EN STAGING, rama permanente conservada. No reconstruir por esta documentación. Próxima tanda: matriz de dulzor/picante/sal/grasa/temperatura/textura entre restaurantes, preferencias por subconjunto y retiro de una cláusula de nota; conversaciones completas reservadas/costo/latencia antes de acreditar piloto. Ver whatsapp-next-batches.md. La lista es plan de pruebas, no soporte ya acreditado. Entradas inferiores históricas.

## Global cerrada — 18/10/2026: preparada promoción Main autorizada

82 suites / 8.889 pruebas aprobadas en 947.954s; 370 hashes de fuente intactos. TypeScript, 72 contratos Node y controles focalizados acreditados en whatsapp-kitchen-description-validation-1810.json. La primera global detectó 3 pérdidas de ají: corregidas y verificadas antes de esta aceptación. Cero API pagada/Meta/órdenes externas. Ahora publicar staging, avanzar Main sin alterar artefactos locales, desplegar ambos backends con rollback/modelos iguales y verificar. Estado EN CURSO: no asumir desplegado hasta cierre con SHA e imagen. Después continuar matriz de preferencias variadas. Entradas inferiores históricas.

## EN CURSO — 18/10/2026: global final y promoción Main autorizada

No editar fuente ni iniciar otra suite/deploy mientras exista la global /tmp/ppp-kitchen-description-final-global-1810.log. Fuente congelada 370 archivos, dos workers, manifest /tmp/ppp-kitchen-description-final-source-1810.json. La primera global detectó 3 pérdidas de ají al combinar sin arepa; arreglo focalizado 37 verdes y TypeScript verde. Aún NO desplegar hasta global verde.

El usuario solicitó explícitamente integrar todo en Main, desplegar producción y continuar en staging. Main local contiene artefactos generados ajenos preservados en manifiestos /tmp/ppp-main-preserved-{artifacts,untracked}-1810.json. Producción /var/www/ppp-nest, Main, contenedor ppp_nest_api, compose modificado localmente: conservarlo. .env es env_file efectivo; hay que alinear los cuatro modelos con staging mediante esas claves solamente y guardar copia privada antes de reiniciar. Script preparado /tmp/ppp-main-deploy-1810.sh. Staging conserva su procedimiento aislado. Ningún cambio productivo ejecutado aún.

Tras cierre documentar SHA/runtimes, rollback, modelos y salud, y retomar matriz de preferencias entre restaurantes de whatsapp-next-batches.md. Cero llamadas pagadas/Meta/órdenes externas;188/187/1 sin cambio. No declarar vendible por global simulada. Entradas inferiores históricas hasta el nuevo cierre.

## Compra distribuida + precio validada, NO desplegada — 18/10/2026

Basec649368d.45regresiones nuevas:18router→DTO,24rechazos de herramientas,3bucles de agente con HTTP totalmente simulado.198focalizados,TypeScript,72Node y global81suites/8833tests en1044.429s,368hashes intactos. Evidencia whatsapp-mixed-price-validation-1810.json;/tmp/ppp-mixed-price-global-1810.{log,json} y source-manifest. Runtime sigue190c6c86;no confundir con publicación/despliegue. Compilar/desplegar agrupado al cerrar la siguiente tanda de notas. Main/modelos/presupuesto188/187/1 intactos,ceroAPIpagada/Meta/órdenes externas.

verifiedDistributedProductId es capacidad interna del router tras validar fuente, no argumento del modelo. add_item además exige compra afirmativa literal + anfitrión de catálogo antes de pregunta de precio;el adaptador sigue exigiendo todos los grupos y rechaza mezcla/error. Seis controles previos se renombraron Untrusted mixed... y omiten la capacidad deliberadamente;ya no son fallo del camino autorizado. Orden inverso de cláusulas/otros verbos y compras mixtas no distribuidas pendientes. Prompt cambió,pero no hay nueva inferencia real/costo/latencia;solo contratos y bucles simulados.

CASOS NUEVOS del usuario, prioridad inmediata:«Quiero una sobrebarriga dorada,bien bonita que no esté tan gorda» (también escribió dorda/torda) y «dos pollos pero bien cocinados,que no me vayan a salir crudos». Bot trató la nota como producto ausente;en el segundo luego perdió la nota al elegir frito con1. Hay audio original del segundo en /home/levi/Downloads/WhatsApp Ptt 2026-10-18 at 8.46.37 AM.ogg,NO transcrito/escuchado por esta tanda. Reproducir notas de grosor/presentación/cocción y su conservación durante aclaración con varios menús;no ocultar adicionales reales ni prometer cumplimiento. Próxima global acreditará la fuente posterior de notas. Mantener fuente congelada durante validación;no otra suite/edición concurrente. No declarar vendible por conteos.

## VIGENTE — 18/10/2026, 08:19 Bogotá: consultas contadas y checkout desplegados

Staging `190c6c86f61125a93e34e490bbe8f8002d13d6c1` desplegado y verificado. Contenedor running/healthy; imagen activa=candidate `sha256:826391cb4767fead4a227c6d06cbbc4bfb2725992a4edaf61fa98dbea032e73f`. Health ok, DB connected, circuito CLOSED a las 2026-10-18T13:19:49.118Z. Rollback `ppp-nest-staging:rollback-before-190c6c86`. Main, modelos, bin/ privado, mariadb_local y volúmenes preservados.

Despliegue agrupado: compra por variantes durante checkout (b1529b5f, 69 regresiones previas) y consultas con variantes contadas (84 nuevas). Consultar precio/contenido/disponibilidad conserva carrito, paso y selecciones; no invoca agente ni crea oferta para añadir. Muestra precio de catálogo y estimado por cantidad sin domicilio. Reconoce entradas no disponibles para informar sin cambiar su disponibilidad. Baseline 54 fallos; otros tres casos de no disponibilidad fallaron antes del arreglo de búsqueda.

Aceptación final: 153 controles focalizados (incluyen los 69 anteriores), TypeScript, 72 Node y global 81 suites / 8.788 pruebas en 592.772s. Los 368 hashes de fuente son idénticos antes/después. Evidencia `whatsapp-group-inquiries-validation-1810.json`; logs y JSON en `/tmp/ppp-group-inquiries-*-1810.*`. Prueba compilada acredita herramientas reales, adaptador de checkout, catálogo y presencia de rama informativa; NO acredita el router completo compilado, cubierto por suite TS con dependencias externas simuladas. Cero API pagada, Meta y órdenes externas. Presupuesto 188/187/1 sin cambios. No es evidencia nueva de precisión del modelo, costo/latencia o preparación universal para venta.

SIGUIENTE FALLO REPRODUCIDO: compra explícita seguida de consulta de precio («Quiero cuatro…, dos A y dos B; y dime cuánto cuestan») sigue rechazada por `question_not_order` en add_item. Seis controles exigen aclaración y carrito intacto; NO son compras exitosas. Resolver ownership compra/consulta mixta con catálogo y cantidades verificables, conservando preguntas puras sin mutación y rechazo atómico. Reproducir con varios menús, estados y orden de cláusulas antes de relajar herramientas. Después: notas que retiran solo una cláusula, productos sin atributos, detalles no documentados (rendimiento/alérgenos) en consultas contadas y conversaciones reservadas completas con modelo real/costo/latencia. El despertar automático sigue exclusivamente gratuito. No repetir global ni reconstruir por esta documentación. Entradas inferiores históricas.

## Consultas contadas validadas, pendientes de despliegue agrupado — 18/10/2026

Baseb1529b5f. Baseline54fallos de consultas precio/contenido/disponibilidad que activaban compra. Ruta informativa desde catálogo conserva carrito y checkout/selecciones, no invoca modelo, no crea oferta pendiente;cotiza cantidad estimada sin domicilio. Productos no disponibles se reconocen para informar, sin modificar disponibilidad.84regresiones nuevas,153focalizados,TypeScript,72Node y global81suites/8788tests en592.772s;368hashes intactos. Evidencia whatsapp-group-inquiries-validation-1810.json y /tmp/ppp-group-inquiries-global-1810.{log,json};manifiesto source. No sumar focalizados solapados. No es inferencia real ni evidencia universal de comprensión.

NO DESPLEGADO aún:runtime d043cc54,preflight staging limpio en archivos versionados/bin/ privado presente/runninghealthy. Publicar/desplegar agrupado con b1529b5f usando procedimiento AGENTS;probe /tmp/ppp-group-inquiries-compiled-1810.cjs pasó contra TS local. Probe acredita herramientas/adaptador checkout y presencia de rama de consulta, NO router completo compilado;ese se prueba con suite TS simulada. Preservar bin/,mariadb_local,volúmenes y Main.

SIGUIENTE HUECO REPRODUCIDO:compra explícita + consulta precio en misma frase sigue bloqueada por question_not_order del add_item.6controles esperan rechazo seguro y carrito intacto;NO acreditan compras exitosas. Resolver ownership antes de relajar guard;conservar preguntas puras sin mutación. Luego notas que retiran una cláusula,productos sin atributos y conversaciones reservadas completas con modelo real/costo/latencia. CeroAPIpagada/Meta/órdenes externas,presupuesto188/187/1 intacto. No declarar piloto/venta por conteos.

## VIGENTE — 18/10/2026: compra distribuida durante checkout validada, pendiente de despliegue agrupado

Base f52d2ca3. Se corrigió un bloqueo reproducido en seis recorridos: el agente preparaba variantes válidas, pero placedOrderOnly descartaba la compra durante checkout. Ahora un reparto completo, validado contra la fuente y respaldado por herramientas aceptadas, añade todas sus variantes y retoma el mismo paso pendiente. El carrito previo permanece. No confirma órdenes ni permite mezclar esa compra con cambios de metadatos; ante mezcla/incompletitud/error/falta de evidencia conserva el carrito.

69 regresiones nuevas:45 recorridos con tres menús ficticios, cinco estados (nombre/teléfono/dirección/pago/confirmación), repartos1+3/2+2/3+1, carrito previo, consultas intermedias de carrito/precio y DTO final simulado;24 rechazos adversariales.99focalizados,TypeScript,72Node y global81suites/8704tests en597.816s aprobados.368hashes idénticos antes/después. Evidencia whatsapp-checkout-variants-validation-1810.json y /tmp/ppp-checkout-variants-{baseline,final-targets,global}-1810.log;resultado global JSON y manifiesto source. No sumar ejecuciones focalizadas solapadas. Un error intermedio TS18048 se corrigió antes de aceptación.

NO DESPLEGADO: runtime continúa d043cc549b337d471de633d234ab6a41b0deedad (imagen80e9c285..., última verificación en la entrada inferior). No hubo nueva auditoría remota de salud en esta tanda. Agrupar despliegue con siguiente familia, siguiendo AGENTS. Main intacta. CeroAPIpagada/Meta/órdenes externas, presupuesto188/187/1 sin cambios. Modelos sin cambios. La evidencia usa propuestas de modelo simuladas y herramientas reales: no acredita interpretación lingüística real, costos/latencias ni preparación comercial universal.

SIGUIENTE: reproducir consultas puras con grupos contados (precio/composición/disponibilidad) frente a compras, preservando estado y carrito; el detector temprano podría exigir compra, es hipótesis pendiente. Después notas que retiran una cláusula, productos sin atributos y conversaciones reservadas completas. Una tanda coherente por despertar; no editar/lanzar suite si hay trabajo activo. No repetir global por documentos ni modificar Main. Entradas inferiores históricas.

## VIGENTE — 18/10/2026,06:54 Bogotá: notas por unidades desplegadas

Stagingd043cc549b337d471de633d234ab6a41b0deedad desplegado/verificado. Imagen activa=candidate sha256:80e9c28530452557ebe6fa0787b5b9f0abd15861a5da3b3c9f5879284989924d,running/healthy. HealthOK/DB connected/circuit CLOSED. Compilado comprobó reemplazo,borrado,proyección y conservación del resto. Rollback ppp-nest-staging:rollback-before-d043cc54. Main intacta,bin/ y mariadb_local preservados.

Baseline18recorridos confirmó que la corrección concatenaba notas contradictorias y el borrado parcial no se aplicaba.47regresiones nuevas:18router hasta DTO en3menús/3estados,26preparación,3tool.235controles de herramientas/preparación/origen,TypeScript y72Node;global81suites/8635tests en594.556s,368hashes intactos. Logs /tmp/ppp-note-modes-global-1810.{log,json};manifiesto /tmp/ppp-note-modes-source-1810.json. Informe whatsapp-note-modes-validation-1810.json. No sumar la ejecución solapada229. Un error intermedio del tipo del helper de prueba fue corregido;solo usar resultados finales.

Contrato updateUnitOptions/set_unit_attributes:noteMode opcional append(default),replace(nota FINAL COMPLETA del subconjunto),clear(borra TODA su nota y omite note). Conserva unidades restantes,precio y opciones. Clearcontexto/replace sin nota/modo inválido rechaza toda la tanda. Para quitar solo una cláusula,replace debe conservar instrucciones no revocadas;el prompt lo explica y pide aclarar ambigüedad. NO acredita cirugía semántica automática ni interpretación real del modelo:todo simulado esta tanda. El tool sigue requiriendo atributos de catálogo;productos sin atributos y varias particiones de la misma fila no se ampliaron.

CeroAPIpagada/Meta/órdenes externas;presupuesto188/187/1 intacto. Despertar fue interrumpido y retomado por usuario «continua»;procesos terminados/fuente revisados antes de seguir. SIGUIENTE:compra por variantes durante checkout y consultas puras con repartos;notas que retiran solo una cláusula,referencias ambiguas y productos sin atributos;reserved real-model para noteMode solo en ejecución activa autorizada,no en continuación gratuita. No declarar vendible por mocks/conteos. Automatización horaria existente sigue activa,no duplicar ni editar concurrentemente. No repetir global ni reconstruir por documentación. Entradas inferiores históricas.

## Tanda de notas validada,pendiente de despliegue — 18/10/2026

Baseb8f3e33c,NO desplegada:runtime71114d9d. Baseline18recorridos falló al reemplazar/borrar nota de2de4en3menús y estados carrito/pago/confirmación. Contrato nuevo noteMode opcional append(default)/replace(nota final completa)/clear(sin note),solo en las unidades del grupo;resto conserva nota,precio,opciones,cantidad. El modo inválido/clearcontexto/replace sin nota rechaza toda la tanda. Prompt exige consultar carrito y conservar instrucciones no revocadas. No es edición semántica automática de cláusulas.

47regresiones nuevas:18router hasta DTO,26preparación,3tool.235controles de herramientas/preparación/origen pasan;router y controles previos229pasaron en ejecución solapada,no sumar;TypeScript y72Node pasaron. Global aprobada:81suites/8635tests en594.556s,368hashes intactos,log /tmp/ppp-note-modes-global-1810.log,JSON /tmp/ppp-note-modes-global-1810.json,368hashes /tmp/ppp-note-modes-source-1810.json. Fuente congelada verificada. Informe whatsapp-note-modes-validation-1810.json. Prueba compilada preparada /tmp/ppp-note-modes-compiled-1810.cjs(pasó contra TS local).

Interrupción del despertar por usuario «continua»:se verificaron procesos y cambios antes de retomar;no había suite concurrente. Un error intermedio de tipo del helper de prueba(nota opcional)se corrigió,ver logfinal. CeroAPIpagada/Meta/órdenes externas;presupuesto188/187/1 intacto;Main intacta. Pendiente publicar/desplegar una vez,verificar compiled/imagen/health,cierre documental. Luego compra distribuida durante checkout y consultas puras con repartos;real-model de noteMode en una ejecución activa autorizada,NO en despertar gratuito. No declarar inteligencia/cobertura universal por mocks.

## VIGENTE — 18/10/2026,01:53 Bogotá: reparto completo antes de mutar

Staging71114d9d860a03b38ce358b541e6af359a76a40f desplegado/verificado. Imagen activa=candidate sha256:203f475cdcd135dd1d55369b562400ff028d10538136567d9cfcb8f6fc61e904,running/healthy. HealthOK/DB connected/circuit CLOSED;compilado rechaza grupo omitido,error tras preparar primero,cantidad/opción equivocada y vaciado mezclado,sin mutar carrito. Rollback ppp-nest-staging:rollback-before-71114d9d. Main intacta,bin/ y mariadb_local preservados.

Tanda automática gratuita:baseline12fallos acreditó el hueco de compras parciales.21regresiones nuevas(3menús adversariales+cantidades fuente inválidas),55focalizados,TypeScript,72Node;global81suites/8588tests en590.562s,368hashes intactos. Evidencia whatsapp-distribution-atomic-validation-1810.json;log/JSON /tmp/ppp-distribution-atomic-global-1810.{log,json};manifest /tmp/ppp-distribution-atomic-source-1810.json. Las2aserciones intermedias de texto se ajustaron con respuesta general y no son fallos de conservación del arreglo final.

Contrato para compra por variantes en familia explícita reconocida:antes de ejecutar compara total y grupos por cantidad/atributos de catálogo uno-a-uno;rechaza grupo omitido/sobrante,mala cantidad/opción,error del agente o mutaciones incompatibles. Fuente con0,11porgrupo o suma inconsistente pide aclaración antes de inferencia;máximo10porgrupo refleja el límite actual del tool,no afirma soporte universal de pedidos grandes. Válidos1+3/2+2/3+1 y checkout simulado previo siguen pasando. Sin nuevas llamadas pagadas,Meta ni órdenes externas;presupuesto188/187/1 intacto. No es nueva evidencia de precisión lingüística del modelo.

SIGUIENTE:no repetir esta tanda. Priorizar corrección/borrado/notas contradictorias y compra distribuida durante checkout. Añadir consultas puras con grupos(«cuánto cuestan4,dosAydosB»),permutaciones,grupos parcialmente especificados y aliases para comprobar la frontera consulta/compra. Estas últimas son hipótesis por reproducir,no fallos acreditados aún. Mantener pruebas gratuitas en el despertar programado. Automatización horaria existente continuar-pruebas-de-ppp-en-staging:no duplicar;no editar si hay otra tanda/global/deploy. No repetir global ni reconstruir por documentación. Entradas inferiores históricas.

## Tanda automática validada, pendiente de despliegue — 18/10/2026: reparto incompleto del modelo

Fuente local sobre1bfc7fd0;NO desplegada,runtime6efd6903. Baseline12fallos con3menús demostró compras parciales al omitir un grupo/fallar tras primero o proponer cantidades equivocadas. Añadido contrato de reparto explícito antes de ejecutar acciones:total y grupos por cantidad/opciones del catálogo deben coincidir uno-a-uno;fallo de agente o mezcla con vaciado/ediciones rechaza todo. Cantidades fuente0,11porgrupo y sumas inconsistentes se aclaran antes de inferencia. No cambia semántica de notas.

21regresiones nuevas;55focalizados pasaron,TypeScript y72Node. Global aprobada:81suites/8588tests en590.562s,368hashes intactos,log /tmp/ppp-distribution-atomic-global-1810.log,JSON /tmp/ppp-distribution-atomic-global-1810.json,368hashes en /tmp/ppp-distribution-atomic-source-1810.json. Fuente congelada verificada. Reporte whatsapp-distribution-atomic-validation-1810.json. Prueba de compilado preparada /tmp/ppp-distribution-atomic-compiled-1810.cjs;publicar/desplegar una vez y verificar compilado/health.

Cero API pagada/Meta/órdenes externas;presupuesto188/187/1 intacto;Main intacta. Próximo:publicar/desplegar staging una vez,verificar rechazo compilado+imagen+health,documentar. Luego notas contradictorias/borrado y compras distribuidas durante checkout. Continuación horaria activa:no duplicar ni editar en paralelo. Entradas inferiores históricas.

## VIGENTE — 18/10/2026: staging6efd6903 desplegado y verificado

Runtime6efd6903da80b669be734df0e743549e1db4d501,imagen activa=candidate sha256:f37bcf1cd279fb65f10e08798e590c040f5db91a43850de37c1cba0fcd1bfe87,running/healthy. Verificado00:59 Bogotá(05:59UTC),health OK/DB connected/circuit CLOSED. Comprobado en compilado:nota+opciones del mismo subconjunto,nota en proyección,cantidades/opciones/notas de variantes nuevas. Sol6.1/Luna/Transcribe sin cambios. Rollback ppp-nest-staging:rollback-before-6efd6903. Main intacta,bin/ remoto y mariadb_local preservados.

57regresiones nuevas. Aceptación final:81suites/8567tests en604.475s,368hashes intactos,TypeScript y72Node;154focalizados de reparto tras corregir la regresión. Primera global NO aprobó(1fallo del reparto10cajas):confundía un SKU dentro de una opción con el producto anfitrión. Se corrigió exigiendo anfitrión nombrado ANTES del primer grupo contado. No presentar esa primera ejecución como aceptación. Logs /tmp/ppp-subset-options-final-global-1810.{log,json};hashes /tmp/ppp-subset-options-final-global-source-1810.json. Informe whatsapp-joint-subset-validation-1810.json.

Un turno reservado de Bowl Andino con Sol6.1 real pasó:3requests,US$0.0226031 estimados;2de4 cambian base/proteína y nota conservando las otras2. La inferencia fue ANTES del fix de prefijo anfitrión y su traza se reprodujo gratis sobre la fuente final;no hubo segunda inferencia tras ese fix. No es una conversación completa ni WhatsApp real. Evidencia whatsapp-joint-subset-real-probe-1810.json y fixture capturado. Primer arranque del runner falló por alias antes de HTTP;no gastó solicitudes. Presupuesto188/usadas187/restante1;ampliación numérica elegida por agente bajo autorización continua del usuario.

Contrato:note opcional AÑADE al mismo grupo de opciones;conserva nota anterior/resto/precio. Valida texto no vacío<=500;nota sola puede dividir con opciones iguales. No implica reemplazar/borrar instrucciones contradictorias. add_item respeta cantidad y opciones de cada variante en repartos contados y no copia la nota de otro grupo. Casos donde agente no resuelve o hay selección pendiente se aclaran sin compras parciales.

SIGUIENTE PRIORIDAD:reproducir propuesta de modelo que omite un grupo de reparto o falla después del primeradd_item;demostrar conservación de suma/alcance o carrito intacto. Es riesgo identificado por revisión,no fallo reproducido todavía. Luego notas contradictorias/borrado,compras con variantes DURANTE checkout,referencias tras división y conversaciones reservadas completas. Ver inicio de whatsapp-next-batches.md. No declarar piloto/venta por conteos.

Continuación horaria activa en ESTE hilo:continuar-pruebas-de-ppp-en-staging. Usuario autorizó seguir siguientes tandas sin confirmación rutinaria. Automatización:solo pruebas gratuitas,sin API pagada/Meta/órdenes externas,una tanda por despertar,no ediciones si hay trabajo/global/deploy en curso,avisos solo por cierre/fallo/dependencia. No duplicarla. No repetir global ni reconstruir por este cierre documental. Entradas inferiores históricas.

## Tanda validada, pendiente de despliegue — 18/10/2026: opciones+nota del mismo subconjunto y compras distribuidas

NO desplegada: runtime sigue243c2e3b. Contrato updateUnitOptions/set_unit_attributes añade note opcional, no borra notas previas ni toca el resto. Valida texto no vacío hasta500caracteres; note-only puede dividir con atributos iguales. La proyección incluye la nota. El reparto contado de opciones sobre producto nombrado entra antes de parsers de compra/checkout; si hay selección pendiente o el agente no resuelve, aclara sin fragmentos. add_item conserva cantidad y atributos propuestos por variante y no arrastra la nota de otra variante.

Aceptación focalizada34recorridos router,206controles de herramientas/preparación/origen,TypeScript y72Node. Primera global rechazó1regresión de reparto de10cajas;80suites/8566tests pasaron. El fix limita el producto anfitrión al prefijo anterior a los modificadores contados.154focalizados de reparto y TypeScript pasan. Global FINAL aprobada:81suites/8567tests,604.475s,368hashes intactos,log /tmp/ppp-subset-options-final-global-1810.log,resultado /tmp/ppp-subset-options-final-global-1810.json,368hashes en /tmp/ppp-subset-options-final-global-source-1810.json. Fuente congelada verificada;no repetir la global por documentación.57tests nuevos totales. Reproducciones y límites en whatsapp-joint-subset-validation-1810.json.

Un turno reservado de Bowl Andino con modelo real Sol6.1 pasó:3requests,US$0.0226031 estimados,get_cart/set_unit_attributes;2de4 cambian base/proteína y nota,resto intacto. Traza capturada y replay gratuito final;no WhatsApp ni orden externa. Primer arranque falló por alias de módulos antes de HTTP;no gastó solicitudes. Evidencia whatsapp-joint-subset-real-probe-1810.json. Tope operativo188/usadas187/restante1;extensión numérica elegida por agente bajo autorización continua,no dictada por usuario.

Pendiente: publicar y desplegar una vez con rollback/compilado/health. Después ampliar notas contradictorias/borrado y corrección tras variantes separadas,compras por variantes durante checkout y escenarios reservados completos. note actual solo añade;no prometer reemplazo semántico de instrucciones opuestas. Main intacta. Usuario autoriza seguir próximas tandas sin pedir confirmación rutinaria. Entradas inferiores históricas.

La inferencia real fue previa al fix de prefijo anfitrión;la traza se reprodujo gratis tras el fix,no se hizo otra inferencia. Continuación horaria gratuita activa en este hilo:continuar-pruebas-de-ppp-en-staging. Evitar cualquier edición simultánea con otras tandas.

## VIGENTE — 18/10/2026: staging desplegado 243c2e3b

Código 243c2e3b468fd44695d16268e4644cdced186177 desplegado y verificado a las00:19 Bogotá. Imagen activa=candidate sha256:98f9d9525d06b5c81a92dc2ef90314f23a4c3697450933bca4e4d7fbf9177030;running/healthy;health OK/DB connected/circuit CLOSED. Compilado comprueba no-op con intención retenida, fuente ambigua, rechazo de tanda sin revival y referencias explícitas. Modelos Sol6.1/Luna/Transcribe sin cambios. Rollback ppp-nest-staging:rollback-before-243c2e3b. Main intacta;bin/ remoto y mariadb_local preservados.

Global final81suites/8510tests en600.544s,365hashes intactos;TypeScript y72contratos Node pasaron.15recorridos nuevos hasta DTO simulado y controles de origen de variantes. La primera ejecución de232controles focalizados se solapa: no sumarla. Evidencia docs/whatsapp-unit-option-followup-validation-1810.json;logs/manifiesto /tmp/ppp-unit-source-global-1810.{log,json} y /tmp/ppp-unit-source-global-source-1810.json. Sin inferencia pagada, Meta ni órdenes externas esta tanda. Presupuesto operativo185/usadas184/restante1 intacto.

Comportamiento: si las unidades ya tienen las opciones, responde sin volver al parser de compra. Si ya hay variantes del mismo SKU y una nueva edición no identifica fuente, conserva carrito y aclara de cuál línea/opción actual salen. La ambigüedad invalida toda la tanda, no solo el último grupo. Referencias complejas con negación/preservación se aclaran conservadoramente; esto no acredita comprensión universal. Fuente numérica explícita o valor actual único admitidos; ordinales y referencias implícitas quedan por ampliar.

SIGUIENTE: matriz vigente al inicio de whatsapp-next-batches.md, sobre todo atributos+nota para el mismo subconjunto y compras nuevas distribuidas. Añadir escenarios reservados y medir inferencia/costo antes de piloto. No declarar vendible por conteos. No repetir global ni reconstruir por el cierre documental. Entradas inferiores son históricas.

## Tanda validada, pendiente de despliegue — 18/10/2026: repetición y origen de variantes

Cambios validados aún NO desplegados. Base baadd569; runtime sigue cf6ded72. Se reprodujeron 9 recorridos no-op (la herramienta dejaba actions vacío y perdía la intención) y 6 recorridos de repetición (tras dividir 4 en 2+2, repetir podía transformar el resto). El no-op conserva ahora updateUnitOptions; una edición con varias variantes del mismo SKU requiere referencia humana a la línea o a una opción actual única, distinta del destino. Si no la hay se invalida toda la tanda, incluso grupos previamente preparados. No se revive en otra llamada del mismo turno. Mensajes negados/de preservación complejos se aclaran conservadoramente.

15 recorridos nuevos completos, 3 menús para no-op/2 para repetición, estados carrito/pago/confirmación, hasta DTO de orden simulado. Pruebas focalizadas y TypeScript/72contratos Node aprobados. Global aprobada:81suites/8510tests,600.544s,365hashes intactos; log /tmp/ppp-unit-source-global-1810.log, JSON /tmp/ppp-unit-source-global-1810.json, hashes /tmp/ppp-unit-source-global-source-1810.json. Resultado y hashes comprobados; falta verificar runtime tras desplegar. El primer conjunto focalizado de 232 controles se solapa con los demás; no sumar sus totales.

Sin llamadas pagadas, Meta ni órdenes externas; presupuesto185/184/1 intacto. Main intacta. Próximo: publicar staging y desplegar UNA vez con rollback/health/compilado. Documentar límites: el guard no sustituye comprensión de toda frase; ordinales y alusiones implícitas pueden requerir aclaración. Después ampliar cambios con nota para el mismo subconjunto y compras nuevas distribuidas por variantes, con catálogos variados. No afirmar listo para venta por conteos.

## VIGENTE: cf6ded72 desplegado y verificado — 17/10/2026, 23:25 Bogotá

Runtime de staging cf6ded721eb26a2f59e64d9fa10fa0969a4fa69d, running/healthy. Imagen activa=candidate sha256:b318ba027fff3a61f37337619a3bd471251cff0b6797f65c177a99a349de590e. Verificación18/10 04:25:13UTC;health OK/DB connected/circuit CLOSED. Guard/herramienta/proyección/plan y colisión de precios comprobados en compilado, además de los guards previos. Rollback ppp-nest-staging:rollback-before-cf6ded72. bin/ remoto y mariadb_local preservados. Main intacta.

Nuevo contrato de opciones sobre parte de las unidades: set_unit_attributes/updateUnitOptions agrupa atributos del mismo subconjunto, conserva resto/notas/precios, rechaza planes incompatibles y muestra las variantes del carrito. Una partición no autoriza a reutilizar IDs proyectados para otra mutación. Las compras/retiros/confirmación mezclados se aclaran y las adiciones pendientes deben crearse por variante. Consolidación conserva precios distintos hasta la revisión explícita de precio del checkout.

Aceptación final210focalizados,TypeScript,72contratos Node y global80suites/8473tests en1473.182s;363hashes intactos en /tmp/ppp-unit-option-final-source-1710.json.83controles nuevos de integración, además de85 de preparación previa. Primera global interrumpida para corregir el subtotal;dos reproducciones fallaron antes del arreglo. Esa primera global NO es aceptación. Informe whatsapp-unit-option-integration-validation-1710.json y log /tmp/ppp-unit-option-final-global-1710.log.

Un turno reservado con menú Shawarma y modelo Sol6.1 real aprobado:3solicitudes,US$0.0221102 estimados;get_cart y set_unit_attributes. Se midió antes del ajuste de consolidación por precio;su traza se reprodujo gratis sobre el candidato final. No afirmar reinferencia del candidato final ni una conversación completa por este turno. Evidencia whatsapp-unit-option-real-probe-1710.json y scripts/fixtures/whatsapp-unit-option-captured-trace-1710.json. No hubo mensajes Meta ni órdenes externas. Presupuesto operativo185/usadas184/restante1;la extensión numérica la eligió el agente bajo autorización continua del usuario.

Configuración efectiva de staging auditada sin mutaciones:bot y agente V1 habilitados;Sol6.1,visión/assist Luna yGPT Transcribe. No implica una nueva auditoría de Main. No repetir global ni reconstruir por este cierre documental.

SIGUIENTE: matriz «Siguiente matriz después de integrar opciones por unidades» en whatsapp-next-batches.md:compra nueva por variantes,origen ambiguo entre variantes existentes,repetición en otro turno,no-op del modelo sin vuelta a compra,atributos+nota del mismo subconjunto e interrupciones en nombre/teléfono/dirección. El contrato actual NO ejecuta una transacción compuesta de compra+edición+aprobación. Añadir familias y casos reservados antes de ampliar esa semántica. Mantener staging permanente;no promover Main ni declarar vendible por conteos. Las entradas inferiores son historial.

## Integración validada para publicar — 17/10/2026, opciones por unidades

Contrato conectado: `set_unit_attributes` → `AiOrderAction.updateUnitOptions` → guard con instantánea → preparación atómica → carrito y respuesta derivada. Agrupa varias opciones para las mismas unidades; conserva resto/notas/precio. `get_cart` proyecta la división con IDs estables; bloquea mutaciones posteriores que reutilicen la proyección. Una segunda partición incompatible rechaza toda la tanda; una llamada idéntica no duplica la primera. Compras/retiros/confirmación mezclados y adiciones pendientes se aclaran, no se ejecutan como operación compuesta.

Se reprodujo además una pérdida de subtotal en consolidación: dos controles fallaron antes del arreglo. Ahora solo se fusionan líneas de igual precio, producto, opciones y nota. Incluye precios de origen tanto menores como mayores, y tres recorridos hasta revisar el precio actualizado y aprobar expresamente la orden.

Aceptación final:210focalizados,TypeScript,72contratos Node y global80suites/8473tests en1473.182s;363hashes sin cambios. Log `/tmp/ppp-unit-option-final-global-1710.log`, manifiesto `/tmp/ppp-unit-option-final-source-1710.json`. Primera global interrumpida por la nueva regresión de precios; no usarla como aceptación. Informe `whatsapp-unit-option-integration-validation-1710.json`.

Un turno reservado con otro menú ficticio y modelo real Sol6.1 pasó:3solicitudes,US$0.0221102 estimados, get_cart→set_unit_attributes. Se midió antes del ajuste de identidad por precio y se reprodujo gratis su traza sobre el candidato final; no afirmar reinferencia del candidato final. Evidencia `whatsapp-unit-option-real-probe-1710.json` y fixture capturado. Presupuesto operativo185,usadas184,restante1; extensión numérica elegida por el agente bajo autorización continua del usuario. Bot/agente V1 efectivos de staging verificados habilitados;modelos intactos.

Todavía NO desplegado en este punto: runtime anterior f61cecff. Publicar staging y desplegar una vez con los scripts /tmp/ppp-unit-option-deploy-1710.sh y /tmp/ppp-unit-option-deploy-verify-1710.py;verificar imagen/health/compilado y cerrar documentación. Main intacta. Después seguir la matriz «Siguiente matriz después de integrar opciones por unidades» en whatsapp-next-batches.md;no declarar vendible por conteos. Las entradas inferiores son historial.

## Preparación local publicada: contrato de opciones por unidades — 17/10/2026

Se añadió `whatsapp-unit-option-plan.ts`, una función de preparación todavía **sin conectar a herramientas, AiOrderAction, guard ni router**. Recibe una línea de la instantánea original, cantidad afectada y una lista agrupada de atributos. Valida todo antes de producir un carrito nuevo; conserva cantidad restante, precio original, notas y otras opciones. Dos atributos de un mismo grupo afectan las mismas unidades. Rechaza cantidades inválidas, atributos ausentes, opción inexistente, dos grupos superpuestos y filas ajenas. No muta entrada y devuelve procedencia de cada partición.

85 controles nuevos con tres menús ficticios;127 controles focalizados (incluye42 existentes de edición),2 suites,11.492s y TypeScript verdes. Informe `whatsapp-unit-option-plan-validation-1710.json`. Cero inferencia, Meta u órdenes externas. No cambió la ejecución del agente, no se reconstruyó staging y no se actualizó Main. La global8305 anterior acredita f61cecff, no esta futura integración. No repetirla por un módulo aún sin consumidores de producción.

Siguiente trabajo: exponer una herramienta agrupada y acción dedicada; guard con rechazo completo; vista get_cart coherente tras partición; impedir índices obsoletos en edición/quitar/reemplazar; preparación antes de mutación y respuesta con las dos variantes. Probar conversación completa hasta payload final simulado, unidades pendientes de añadir, repetición y compra+edición+aprobación. Solo después congelar fuente, ejecutar global y activar/desplegar agrupado. No considerar solucionado todavía el alcance por unidades del modelo en todos los caminos.

## VIGENTE: desplegado y verificado f61cecff — 17/10/2026, 22:20 Bogotá

Staging running/healthy; imagen activa=candidate sha256:29a96d2069a5120209f29f344ef274498d843bd4dd168aa39e6a49b02e6a65c0. Verificación18/10 03:20:10UTC, health OK/DB connected/circuit CLOSED. Modelos Sol6.1/Luna/Luna/GPT Transcribe intactos. Compilado de ambas tandas y guards previos comprobados. Rollback ppp-nest-staging:rollback-before-f61cecff. bin/ remoto y mariadb_local preservados. Main sin cambios.

Incluye ubicación5014f250:45casos nuevos,545focalizadas,TypeScript,72contratos y global79suites/8265tests verdes. Etiqueta humana en respuesta/resumen/recibo; conserva pin raw para logística. Sin nombre usa «Ubicación compartida»;no geocodificación inversa. Google Maps q/query exacto se interpreta localmente y se rechazan pines inválidos.

Incluye compra ausente f61cecff:40casos nuevos,18recorridos completos con órdenes simuladas,190focalizadas definitivas,TypeScript y72contratos Node verdes. Global FINAL79suites/8305tests en1241.223s;358hashes iguales a /tmp/ppp-unavailable-active-cart-final-source-1710.json. Primera global falló14pruebas por distribución cada:nunca se publicó;se corrigió frontera y revalidó. Informes whatsapp-readable-location-validation-1710.json y whatsapp-unavailable-active-cart-validation-1710.json. No repetir global ni reconstruir por este cierre documental.

La solicitud contada de plato ausente de familia configurada se responde antes del bloqueo de carrito/pago;ofrece solo catálogo disponible y conserva cantidad al elegir. No agrega sustituto automáticamente. Pendientes anteriores conservan dueño;oferta nueva informativa usa bullets. Sin alternativas lo indica.0/99no se convierten a1/30. Familias reales de staging auditadas por SELECT de configuración:8predeterminadas,carne habilitada. Ninguna mutación en esa auditoría.

Cero llamadas pagadas,Meta u órdenes externas en ambas tandas;181/183,intacto. Son pruebas de router/modelo simulado,no conversaciones independientes de inferencia. No declarar vendible por conteos. Límites:gramática contada/familia conocida,no universal;pedidos ausentes con preparación adicional,mensajes mixtos,dirección o familia no configurada requieren ampliar evidencia.

SIGUIENTE: contrato general del modelo para opciones sobre algunas unidades y validación de compra+edición+aprobación antes de crear orden. Ver propuesta en whatsapp-next-batches.md. Añadir controles de elección numérica en alternativas,cambios de cantidad/rechazo y notas sobre el producto alternativo. La regla temprana de edición parcial no equivale todavía a alcance por unidades en todas las acciones del modelo. Entradas inferiores de «en curso/no publicar» son historia;este encabezado prevalece.

## Validado para deploy agrupado — 17/10/2026

Compra no disponible:40casos nuevos,18recorridos completos con orden simulada;190focalizadas,TypeScript y72contratos Node verdes. Global DEFINITIVA79suites/8305tests en1241.223s,/tmp/ppp-unavailable-active-cart-final-global-1710.log;358hashes iguales a /tmp/ppp-unavailable-active-cart-final-source-1710.json. Primera global fallida14/8305 fue desarrollo,nunca publicada;se conservó historial en JSON. Corregida frontera entre distribución cada y plato ausente.

Publicar solo staging y desplegar agrupado con ubicación5014f250. Runtime previo a3b462a3;Main intacta. Informes whatsapp-unavailable-active-cart-validation-1710.json y whatsapp-readable-location-validation-1710.json. Config real de staging leída sin mutaciones:8familias predeterminadas,carne habilitada. Cero API/Meta/órdenes externas;181/183. No repetir global tras cierre documental.

Próximo:contrato de acciones del modelo para afectar solo algunas unidades y aprobación del plan completo antes de crear orden. La regla actual de ausencia es contada y de familia reconocida/configurada,no universal. No acreditar transcripción real o aislamiento multitenant con mocks.

## REVALIDACIÓN GLOBAL FINAL — 17/10/2026

No publicar todavía. Primera global de compra ausente /tmp/ppp-unavailable-active-cart-global-1710.log falló14tests/8291verdes,78suitesverdes/1fallida,1096.684s;358hashes intactos. Causa:«Quiero3sopas,una de cada una» se capturaba como compra ausente;las notas de subconjunto posteriores tampoco podían arrancar. Se delega gramática distributiva cada antes del fallback. No atribuir esa primera global a aceptación.

190focalizadas definitivas y TypeScript verdes /tmp/ppp-unavailable-active-cart-distribution-accepted-targets-1710.log y /tmp/ppp-unavailable-active-cart-distribution-tsc-1710.log. Ahora congeladas358fuentes en /tmp/ppp-unavailable-active-cart-final-source-1710.json. Global definitiva EN CURSO /tmp/ppp-unavailable-active-cart-final-global-1710.log (exec session18900,PID1648686). Esperar footer,comparar mapa exacto,registrar y solo entonces publicar/deploy agrupado con ubicación5014f250. Informe whatsapp-unavailable-active-cart-validation-1710.json conserva primera global fallida.

40casos nuevos,18recorridos completos con orden simulada. Main sin cambios. Cero API/Meta/órdenes externas;181/183. Último runtime a3b462a3,checkout remoto69a0df72. Verificador /tmp/ppp-unavailable-active-cart-deploy-verify-1710.py comprueba modelo/health/imagen/guards de ambas tandas sin crear orden. No editar fuente durante esta global. Tras deploy,cierre solo documental no reconstruir. Próximo contrato de edición parcial por unidades del modelo.

## Global final en ejecución: compra no disponible — 17/10/2026

Fuente congelada358archivos /tmp/ppp-unavailable-active-cart-source-1710.json. Global /tmp/ppp-unavailable-active-cart-global-1710.log;NO editar fuente hasta footer y hashes.40nuevos:18recorridos completos de orden simulada PPP/sopas×carrito/pago/confirmación×3modos de agente,22controles.150focalizadas finales en2suites22.366s y TypeScript aprobados: /tmp/ppp-unavailable-active-cart-accepted-full-journeys-1710.log y /tmp/ppp-unavailable-active-cart-final-tsc-1710.log. VerJSON. Una corrección temprana declaraba hamburguesa sin cebolla ausente;guard de base/preferencia ya lo evita. Genérico conocido puede pedir presentación;no exigir compra automática cuando hay ambigüedad legítima.

Ubicación5014f250ya publicada/validada79suites8265tests;NO desplegada todavía. Agrupar deploy al cerrar esta global. Runtime a3b462a3,checkout remoto69a0df72,bin/ preservado. Verificador /tmp/ppp-readable-location-deploy-verify-1710.py para imagen/health/modelos/guards previos;añadir guard de compra ausente antes de usarlo. Main intacta. Cero API/Meta/órdenes externas;181/183.

Límites:gramática contada de familia configurada;mensajes mixtos/domicilio/unfamilia sin configurar conservan rutas existentes,no acreditar universalidad. Oferta conserva cantidad;si hay otro pendiente,alternativas informativas con bullets y reminder del dueño. Sin disponibles,respuesta explícita sin inventar productos. Próximo:contrato de edición parcial por unidades y autorización de plan completo,según plan de whatsapp-next-batches.md.

## En validación: compra no disponible con carrito activo — 17/10/2026

Base5014f250.34tests nuevos:12solicitudes PPP/catálogo sopa(cart/pago×reglas/agente vago/agente que devuelve carrito),6controles selección existente/platos conocidos,5cantidades/repetición,7propiedad/disponibilidad/rangos,4sin alternativas/familia configurada. Baseline9fallidos/3verdes. Primera corrección12verdes. Regresión detectada y corregida:«3hamburguesas sin cebolla» se declaraba ausente;no confundir preferencia con plato nuevo ni saltar prioridad de porciones normales. Otros fallos intermedios fueron fixtures/assertions,verJSON. Última selección51verdes(34nuevos+17porciones existentes);ampliación final en /tmp/ppp-unavailable-active-cart-accepted-final-targets-1710.log,TypeScript /tmp/ppp-unavailable-active-cart-tsc-1710.log. Todavía no publicado/desplegado.

Regla general por catálogo y conceptos configurables:pedido contado no resuelto a SKU,pero familia reconocida,se responde antes de carrito/pago. Ofrece solo productos disponibles;guarda cantidad en pendingMatch para elección posterior. No añade alternativa sin elegirla. Un pendiente anterior no se sustituye:oferta informativa con bullets y recordatorio de dueño. Sin alternativas lo indica y conserva sesión. Cantidad0/>30 no se convierte a1/30. Gramática acotada;no afirmar comprensión universal ni inferencia real.

Ubicación ya validada/publicada5014f250,NO desplegada:agrupar ambas familias después de global final. Runtime últimoa3b462a3. Main intacta. Cero API/Meta/órdenes externas;181/183. Siguiente estructural:contrato de opciones por unidades del modelo y compra+edición+aprobación atómica.

## Ubicación validada,pendiente deploy agrupado — 17/10/2026

Base69a0df72.45nuevas;545focalizadas,TypeScript,72contratos Node aprobados. Global79suites/8265pruebas1050.018s;358hashes idénticos a /tmp/ppp-readable-location-source-1710.json. Informe whatsapp-readable-location-validation-1710.json. Ya se puede publicar fuente solo staging. No repetir global por documentación. NO desplegado aún:agrupar con la nueva familia solicitada de pedido inexistente con carrito activo. Runtime actual a3b462a3;Main intacta. Cero API/Meta/órdenes externas;181/183.

Etiqueta legible en respuesta,resumen y recibo conserva rawaddress y pin en payload;URLs Google q/query exactas se interpretan localmente;pin inválido no cotiza ni muta. No geocodificación inversa. Nueva prioridad«quiero3carnes a la plancha»→solo carrito:aún pendiente reproducción/corrección;tests preparados en /tmp/ppp-unavailable-active-cart-tests.txt,integrar solo tras commit de esta fuente validada. Ver contrato general de opciones parciales en whatsapp-next-batches.md como siguiente después de ese fallo.

## Nueva prioridad del usuario: pedido no disponible con carrito activo — 17/10/2026

Chat observado: ejecutivo con pollo frito/sopa mondongo en carrito;«quiero3carnes a la plancha» devuelve solo carrito+¿Algo más?. Debe reconocer la compra solicitada,indicar ausencia y ofrecer alternativas verificadas,conservar ejecutivo y cantidad3como intención pendiente sin agregar sustituto automáticamente. Cubrir vacío/carrito/pago,agente simulado on/off,respuestas del modelo sin acciones y pérdida de petición con fallback,menús ficticios y alimentos inexistentes con alternativas o sin ellas. No hardcodear carne a la plancha como excepción. Nueva familia pendiente de reproducción;no afirmar corregida.

Esperar cierre de global de ubicación antes de editar fuente. Publicar ubicación validada primero;agrupar despliegue con esta nueva familia si se completa,según preferencia de no reconstruir por cada regla. Después retomar contrato de alcance por unidades del modelo. Main intacta.

## Validación final de ubicación en ejecución — 17/10/2026

Fuente congelada358archivos /tmp/ppp-readable-location-source-1710.json. Global /tmp/ppp-readable-location-global-1710.log (sesión80470);no editar src/scripts/workflows hasta footer y comparación exacta.45 nuevos,545focalizadas finales85.902s y TypeScript aprobados;72contratos Node verdes. Logs /tmp/ppp-readable-location-final-accepted-targets-1710.log y /tmp/ppp-readable-location-accepted-tsc-1710.log. Compilación intermedia falló por tipo unknown en fallback JSON de dirección;se estrechó a string antes de aceptación final. No reutilizar resultado545 anterior como si fuera la fuente actual.

Al cerrar: registrar footer real y hashes,publicar staging,desplegar solo si se cierra tanda agrupada y verificar imagen/health/modelos con /tmp/ppp-readable-location-deploy-verify-1710.py. Último runtime a3b462a3;Main intacta. Reporte docs/whatsapp-readable-location-validation-1710.json. Presupuesto181/183,sin API/Meta/órdenes externas. Próxima familia:alcance por unidades del contrato de acciones del modelo y compra+edición+aprobación atómica. La mejora de ubicación solo muestra una etiqueta,no hace geocodificación inversa.

## En curso: presentación de ubicación — 17/10/2026

Base69a0df72.45tests nuevos:24recorridos completos(2cartas×agente simulado on/off×pago/confirmación×pin/pin con nombre/enlaceMaps),4pines inválidos,17contratos puros. Baseline28fallidos/0verdes. Primera corrección28verdes;545focalizadas y TypeScript verdes. Ampliar aserción hasta recibo mostró24fallidos/4verdes: tras reset el recibo usaba snapshot con coordenadas. Se corrige presentación en resumen/carrito/recibo además de reply. Aceptación final en curso /tmp/ppp-readable-location-accepted-targets-1710.log. No confundir primera aceptación con fuente final.

Se conservan dirección raw, enlace y coordenadas para logística/payload. Solo salida al cliente usa nombre/dirección suministrada o «Ubicación compartida». No geocodificación inversa nueva, no LLM/red para nombrar ubicación. URL Google q/query con coordenadas exactas se convierte localmente a pin; otros hosts/URLmezclada/lugares/shortlinks no. Pin nuevo no confirma orden; se conserva mecanismo de reconstruir checkout antes de pedir confirmación. No cambiar a guardar awaiting_final_confirm antes de tryConfirmOrder: esa rutina puede crear una orden desde ese estado.

Cero API/Meta/órdenes externas;181/183. Main intacta. Todavía no publicar/desplegar sin cerrar TypeScript y global congelada. Informe whatsapp-readable-location-validation-1710.json. Runtime último a3b462a3.

## Desplegado y verificado: a3b462a3 — 17/10/2026,21:00 Bogotá

Staging running/healthy;imagen activa=candidate sha256:c410377a0155417cebf160adb2c979b4d201d70f8260e050c69a8d92166b1933;health OK/DB connected/circuit CLOSED. Verificado18/10 02:00:08UTC. Incluye aprobación compuesta b062d801 y opciones parciales/porciones a3b462a3. Compilado conserva guards previos/nuevas rutas;modelos Sol6.1/Luna/Luna/GPT Transcribe iguales. Rollback ppp-nest-staging:rollback-before-a3b462a3. bin/ remoto y mariadb_local preservados. Main intacta. No reconstruir ni repetir global por este cierre documental.

Global definitiva78suites/8220tests,745focalizadas,TypeScript y72contratos Node aprobados;356fuentes congeladas iguales.76pruebas nuevas en esta tanda y98en aprobación anterior. Informes whatsapp-partial-options-portions-validation-1710.json y whatsapp-compound-approval-validation-1710.json. Cero llamadas pagadas/Meta/órdenes externas en estas dos tandas;181/183 intacto. Estos son mocks de dependencias/modelo, no8220 conversaciones independientes ni validación de transcripción de audio real.

SIGUIENTE: ubicación legible sin exponer coordenadas, preservando destino exacto. No se implementó todavía;ver lista reservada y plan comercial. Luego alcance por unidades en contrato de acciones del modelo y composición de compra+edición+aprobación. Repetición de cambio parcial tras dividir y varias líneas del mismo SKU piden aclarar, no trasladan el resto automáticamente. No declarar producto vendible solo por suite verde. Las entradas de «en curso/pendiente» inferiores son historial, este encabezado prevalece.

## Validado: cambios de opciones por unidades y porciones normales — 17/10/2026

Base b062d801.76 casos nuevos;745 focalizadas en2suites,TypeScript y72contratos Node aprobados. Global78suites/8220pruebas,759.648s;356 hashes idénticos a /tmp/ppp-options-portions-source-1710.json. Log /tmp/ppp-options-portions-global-1710.log. Informe whatsapp-partial-options-portions-validation-1710.json. Publicar únicamente staging; despliegue agrupado pendiente con aprobación b062d801. Main intacta. No repetir suite por cierre documental. Cero API/Meta/órdenes externas;181/183.

Cambio contado de2entre4 divide línea y conserva otras opciones, notas, precio, unidades y paso de checkout. Carrito muestra2de cada opción; payload final comprueba4unidades. Incluye Coca Cola→Colmbiana del catálogo PPP y salsas/masas ficticias. Varias líneas del mismo SKU, repetición tras división, cantidad inválida, opción desconocida o selección pendiente piden aclaración sin mutación. Porciones explícitas con preferencia grande y una única presentación sin atributos se añaden aclarando tamaño habitual. Aceptación «Sí,dame las3ensaladas normales» ya no repregunta cantidad. No prometer tamaños aumentados.

Límites: texto reconstruido, no audio original; gramática acotada anterior al matcher por línea, todavía no hay alcance por unidades en todas las acciones generadas por modelo. Nueva solicitud de mapa queda como próxima tanda: etiquetas humanas conservando pin, fallback y geocodificación inversa opcional. Ver plan comercial y lista reservada inferior. Después: compra+edición+aprobación atómica y evaluación independiente del modelo. No declarar vendible por conteos.

## En validación: opciones de algunas unidades y porciones normales — 17/10/2026

Base b062d801.76 casos nuevos:48 edición parcial+límites,4 conservación de otros atributos/productos,9 compra con preferencia de tamaño,8 aceptación de porciones normales,7 fronteras de catálogo. Baseline:48/48 edición parcial fallaban;9/9 preferencia y8/8 continuación normales fallaban. Primera corrección36/48 verdes;12 expectativas de carrito asumían que una dirección ya confirmada no avanzaba automáticamente, corregidas para conducta vigente. Focalizadas48 edición y65 familias iniciales verdes; validación ampliada en /tmp/ppp-options-portions-final-targets-1710.log. Todavía no desplegado. Main intacta. Sin llamadas pagadas ni Meta/órdenes externas;181/183.

Se divide una línea por cantidad explícita, se conservan resto/opciones/notas/precio y se muestra cada grupo. Repetir tras división pregunta sin mutar las unidades restantes. Porciones con «bien grandes» y sin otro tamaño configurable se añaden con aclaración de tamaño habitual. «Sí, dame las 3 ensaladas normales» no vuelve a pedir cantidad. Gramática acotada: no afirmar comprensión universal, transcripción validada ni aislamiento multitenant.

Nueva petición de ubicación: el cálculo actual con coordenadas omite geocodificación inversa, por eso no devuelve etiqueta postal. Próxima tanda: presentación «Ubicación compartida»/nombre recibido y, si procede, geocodificación inversa con caché y fallback, conservando pin exacto y sin presentar dirección aproximada como exacta. Aún no implementada. Siguiente también: aprobación+edición/compra en un turno.

## Cierre aprobación compuesta — 17/10/2026

Global aprobada:78 suites/8144 pruebas,632.76s.356 hashes idénticos;937 focalizadas,TypeScript y72 contratos Node verdes. Validado, todavía no desplegado. Main intacta. Próximo: cambios de atributos de solo algunas unidades; luego tamaños no configurados expresados como preferencia, sin doble respuesta contradictoria.

## Nueva prioridad del usuario: cambiar opciones de algunas unidades — 17/10/2026

Caso observado: Hamburguesa Clasica x4 con Coca Cola; audio solicita cambiar dos gaseosas por Colombiana; salida y carrito cambian las cuatro. Esperado: dos unidades Coca Cola y dos Colombiana, total cuatro, sin bebida suelta ni cobro adicional. El defecto está en la edición de atributos por línea completa. Preparar regresiones del router con catálogos PPP y ficticios, cantidades parciales, estado de checkout, notas, repetición/ambigüedad y payload final. No hay audio original: validar texto reconstruido no acredita transcripción. Investigar sin editar fuente mientras termine la global de aprobación. Agrupar deploy tras cerrar ambas familias; Main intacta.

## En curso: aprobación explícita frente a preguntas/citas compuestas — 17/10/2026

Base66ec9438, solo staging.98 nuevos:72 recorridos completos de orden simulada (48 ETA+aprobación,16 referencias sin ETA,8 confirmaciones normales; dos menús ficticios, agente simulado on/off),26 contratos puros. Baseline ETA24fallidos/24verdes; referencia sin ETA4fallidos/12verdes. Parser nuevo separa cláusulas declarativas, preguntas y citas; ignora condiciones/negaciones. Se usa en ETA y protege tanto keywords como el cierre isFinishCheckoutIntent. Nueva función blocksImplicitOrderApproval evita que el matcher amplio convierta una pregunta/cita en aprobación, también con typo o cierre citado.

Una regresión de desarrollo bloqueaba «si confirmo el pedido» standalone y «Sí confirmo…» sin coma (10fallidos/22verdes); se corrigió antes de aceptación. Dos contratos extra de pregunta con typo/cierre citado fallaban (2/26); se amplió guard por contexto, sin agregar producto/ID PPP. Primera selección tras parser152router+20contratos verdes; ampliación935verdes anterior al último guard. No atribuir esos runs al conjunto final. 937 focalizadas definitivas y TypeScript aprobados en /tmp/ppp-compound-approval-final-accepted-targets-1710.log y /tmp/ppp-compound-approval-final-tsc-1710.log;72 contratos Node verdes. Global EN CURSO /tmp/ppp-compound-approval-global-1710.log, fuente congelada356archivos en /tmp/ppp-compound-approval-source-1710.json. Esperar footer y comparar mapa completo antes de publicar. No editar fuente mientras corre. Informe whatsapp-compound-approval-validation-1710.json.

Cero API/Meta/órdenes externas,181/183 intacto. Main no modificada. Último runtime verificado a9693ea1; nueva tanda NO desplegada. Publicar solo staging tras validación; agrupar deploy con siguiente familia según preferencia del usuario, no reconstruir por cada regla/documento. No proclamar vendible por conteo.

Siguiente prioridad: aprobación acompañada de edición/compra nueva; validar y aplicar cambios antes de cualquier confirmación, sin aprobar el carrito viejo. Luego «el que tengo sin salsa y agrega otro normal» y reemplazo de notas contradictorias. La función nueva acredita evidencia de aprobación, no valida por sí sola todo el plan de acciones. Mantener esta limitación explícita. No ampliar fuente durante global; actualizar este relevo con footer y mapa de hashes al cerrar.

## Validado y desplegado: saludos/carta y consulta de confirmación — 17/10/2026

Baseeec87f78.78 regresiones nuevas:48 solicitudes de menú (dos cartas, agente simulado on/off, carrito/nombre/confirmación, cuatro formas),10 preguntas de confirmación con continuación explícita y cortesía postorden,8 saludos simples,12 controles de ETA hipotética frente a aprobación explícita. El caso exacto del usuario ya pasaba. Baseline56 nuevos+86existentes:28fallidos/114verdes;24 solicitudes con modal o «menú completo» fallaban y4 preguntas «Confirmo?»/«Así está bien?» creaban orden. No afirmar que todas las confirmaciones o todos los saludos fallaban.

La solicitud completa de carta admite modal/infinitivo y completo sin convertirse en producto. Consulta de aprobación conserva sesión y pide confirmación explícita; el predicado de afirmación final rechaza interrogaciones.Primera global /tmp/ppp-basic-greeting-confirmation-global-1710.log interrumpida con130 antes de editar para añadir ETA; NO aceptada. Baseline ETA10fallidos/12verdes (12 controles nuevos+10preguntas); el primer guard tapaba ETA y una ruta previa confirmaba condiciones hipotéticas. Se limita guard a frase completa y se excluye si/en caso de confirmar de aprobación ETA. 839 focalizadas finales en /tmp/ppp-basic-greeting-confirmation-accepted-targets-1710.log, TypeScript y72 contratos Node finales aprobados. Global definitiva77 suites/8046tests aprobados en616.486s; /tmp/ppp-basic-greeting-confirmation-accepted-global-1710.log.354 hashes idénticos a /tmp/ppp-basic-greeting-confirmation-accepted-source-1710.json. No repetir global por cierre documental. Informe docs/whatsapp-basic-greeting-confirmation-validation-1710.json. Cero API/Meta/órdenes externas;181/183 intacto.

Main local1a2b2e23 no contiene isPoliteMenuLinkRequest; no se auditó runtime de producción y no se promueve Main. Despliegue agrupado a9693ea1 verificado18/10 01:07:38UTC (17/10 20:07 Bogotá):running/healthy, imagen activa=candidate sha256:ee115b531ac867fc91488d218614804636e8fc9ef7e54b5f745e83a9dd467d6a; health OK/DB connected/circuit CLOSED. Incluye parcial de unidades eec87f78 y nueva tanda. Guards previos/nuevos compilados y modelos Sol6.1/Luna/Luna/GPT Transcribe verificados. Rollback ppp-nest-staging:rollback-before-a9693ea1. bin/ y mariadb_local preservados. No reconstruir ni repetir global por cierre documental. La promoción de Main requiere petición explícita.

Plan comercial actualizado al comienzo de WHATSAPP-COMMERCIAL-READINESS-PLAN.md: puertas medibles, evaluación reservada, piloto10→50→100propuesto, costos por conversación/pedido y aislamiento de Kamppo. Es plan, no evidencia de piloto ejecutado. Siguiente prioridad: composiciones de autorización con varias preguntas/citas (no acreditadas por estas78 pruebas), luego edición+compra nueva y sustitución de notas contradictorias; siguiente evaluación: muestra nueva acotada del modelo/medios. No equiparar mocks con comprensión real ni conteo con vendibilidad.

## Validado, incluido en deploy agrupado a9693ea1: notas sobre algunas unidades durante checkout — 17/10/2026

Baseb20e5ea3, solo staging.56 casos nuevos:24 recorridos completos de orden simulada (sopa/bao, agente simulado on/off, carrito/pago/confirmación, cantidad primero/plato primero) y32 límites (variantes del mismo SKU, total incoherente, atributo pendiente o nota de subconjunto pendiente). Baseline24 recorridos fallaron:en carrito la división inicial ya funcionaba, pero repetir tras auto-checkout sumaba unidades; no atribuir fallo a toda división inicial. Los32 límites dieron24 verdes/8rojos por nota pendiente; un intento previo no compiló por fixture unitPrice/price, no es fallo productivo.

La partición se procesa antes de compra/checkout, conserva atributos/notas y otros ítems, retoma el paso pendiente. «El otro normal» expresa resto1 también en instrucciones con producto y total. Ante varias líneas/pendientes/incoherencia pregunta sin mutar.191 focalizadas en2suites, TypeScript y72 contratos Node aprobados. Global77 suites/7968tests aprobados en1115.764s, /tmp/ppp-partial-checkout-global-1710.log;354 hashes de fuente idénticos a /tmp/ppp-partial-checkout-final-source-1710.json. Informe docs/whatsapp-partial-checkout-validation-1710.json. Validación cerrada; no repetir global sin cambio o fallo nuevo.

Cero API/Meta/órdenes externas;181/183 intacto. Tanda incluida en deploy agrupado a9693ea1, ver entrada vigente superior; Main sin cambios. No reconstruir por documentación. Próximo: mezcla edición+compra nueva, notas contradictorias y repetición con selección explícita por variante. La nueva instrucción en conflicto no queda en cola para replay automático; no prometer eso. Los recorridos de esta tanda simulan modelo y dependencias; no acreditan inferencia/voz real.

## Validado y desplegado: enumeración y notas compartidas — 17/10/2026

Base6709a745, rama staging.100 regresiones nuevas del router: enumeraciones con coma, una de cada opción, selección múltiple 1 y2, preparación compartida de productos ya presentes, subconjunto de dos entre tres, cambio de acompañamiento y retiro de pendientes con dueño. Catálogos de sopas, rolls, flanes y gyozas con nombre numérico. Fuente congelada en /tmp/ppp-enumeration-final-source-1710.json (354 archivos); Global77 suites/7912 tests aprobados en1085.999s, /tmp/ppp-enumeration-final-global-1710.log.354 hashes idénticos antes/después. TypeScript final y72 contratos Node aprobados.100 nuevos focalizados aprobados;24 de notas compartidas repetidos con alias exacto del usuario, aprobados. Informe docs/whatsapp-enumeration-notes-validation-1710.json.

Cero API/Meta/órdenes externas;181/183 intacto. Esta tanda está desplegada en staging, no en Main. Código1e2d09d7, verificado18/10 00:07:26UTC (17/10 19:07 Bogotá), running/healthy, imagen activa=candidate sha256:3a84243b072e85f5680e0e0f06a23748a3767033d2aa3aaca31aa3384ffd6ccb; health OK/DB connected/circuit CLOSED. Guards nuevos y anteriores comprobados en compilado; modelos Sol6.1/Luna/Luna/GPT Transcribe intactos. Rollback ppp-nest-staging:rollback-before-1e2d09d7. bin/ remoto preservado. No promover Main sin solicitud. No ejecutar otra global ni reconstruir por este cierre documental.

Límites: notas no garantizan aceptación de sustituciones por cocina; «dos sin arroz» exige identificar dos destinatarios; «son arroz» no se adivina. Pruebas con modelo/dependencias simulados, no contrastadas aún con inferencia real. Próximo bloque: instrucciones compartidas sobre líneas con cantidad mayor a uno y variantes de una misma referencia; aclarar unidades frente a líneas y conservar cada pendiente por separado. Revisar también nuevas instrucciones mixtas con productos que todavía no estén en carrito para no convertir compra en edición parcial. Mantener evidencia nueva separada de reruns.

Despliegue agrupado verificado17/10/2026 23:23:00UTC (18:23 Bogotá): código95cba2c7 running/healthy, imagen activa=candidate sha256:069c6927c3d783236a1fa51e6ba1393ebe5d31a85579095ec83b505c6960173f; health OK/DB connected/circuit CLOSED. Pruebas puras compiladas de consultas completas y mixtas, propiedad de pendientes, elección de sabor por categoría, cantidad de catálogo en pago y guards anteriores aprobadas. Modelos efectivos Sol6.1/Luna/Luna/GPT Transcribe sin cambios. Rollback ppp-nest-staging:rollback-before-95cba2c7. bin/ remoto no versionado conservado. Cero inferencia/Meta/órdenes externas. No reconstruir ni repetir global por este cierre documental.

Nueva prioridad del usuario: chat17/10 18:20 de «tres sopas, una de cada una, dos sin arroz papa salada»; después «un ajiaco, menudencia y un mondongo» agrupó dos platos como alternativas; «1 y2» no resolvió ambos. Reproducir contra código vigente antes de afirmar que sigue fallando. Distinguir enumeración de platos de alternativas, cuantificador uno-de-cada y asignación de notas a un subconjunto sin destinatario claro. Usar también otras familias y cartas ficticias. No atribuir el chat al runtime95cba2c7: ocurrió antes de este despliegue y el usuario no precisó rama.

## Edición de carrito + compra pendiente — validado y desplegado — 17/10/2026

Sobre84f3a2fc, solo staging.74 casos nuevos:64 recorridos con dos pendientes sembrados (eliminación +opciones o lista de compra, dos cartas ficticias, agente simulado on/off); cuatro recorridos abren ambos pendientes mediante mensajes al router; seis controles de categoría. Los68 recorridos llegan a una única orden simulada y verifican unidades/notas. Una referencia vaga o consulta de cancelación no elige dueño; «cancela el cambio del carrito» retira solo la edición; «cancela la compra pendiente» conserva la eliminación. «No quites nada» mantiene su alcance específico.

Baseline40:32 fallidos/8 verdes; ampliación64:56 fallidos/8 verdes. Después del ajuste, dos recorridos naturales fallaban con infusión: isLikelyDrinkProduct no reconocía categorías Bebidas/Jugos/Refrescos en plural. Ahora usa cabeza de categoría para vocabulario ajeno; no convierte «Combos con bebidas» en bebida. Cuatro controles positivos fallaban antes; dos negativos ya pasaban. No sumar reruns como tests únicos.

246 focalizadas de general accuracy y51 controles adicionales en tres suites, TypeScript,72 contratos Node y global77 suites/7812 Jest aprobados (1046.426s).354 hashes iguales antes/después. Informe docs/whatsapp-pending-owner-validation-1710.json, logs /tmp/ppp-pending-owner-*. Cero API/Meta/órdenes externas,181/183 intacto. Main sin cambios. Se prepara un solo deploy del lote acumulado desde1c4d98a9; no tratar esta entrada como evidencia de deploy hasta cierre posterior. Preflight remoto28ec484e healthy; bin/ sin seguimiento se conserva.

Límites: nuevas continuaciones completas cubren eliminación +pendingAttribute/pendingMatch de compra; no acreditan otras ediciones, ofertas, sustituciones de acompañamiento, varias compras pendientes ni multicolas. La pregunta de dueño protege estructuras adicionales, pero deben probarse sus continuaciones y los textos ofrecidos antes de prometer cancelación explícita universal. No es undo de ediciones ya aplicadas ni inferencia real nueva.

Siguiente: propiedad de pendingAddOffer/pendingSideSwap/multi y varias compras pendientes; listas informativas frente a compra; contraste real acotado después del deploy, registrando saldo antes de red (dos solicitudes restantes), sin confirmar órdenes externas. No declarar vendible por número de pruebas.

## Consulta de cancelación + compra independiente — validado, SIN desplegar — 17/10/2026

Sobre4fc04402, solo staging. 70 casos nuevos:56 recorridos de consulta/negación/condición +compra independiente (dos cartas ficticias, carrito/pago y agente simulado on/off, siete formas con/sin puntuación);10 controles de alcance o eliminación independiente; cuatro cantidades por vocabulario de catálogo durante pago. Los56 recorridos conservan la fila inicial con nota, añaden exactamente dos unidades y terminan con una única orden simulada de tres unidades.

La ruta separa solo cláusulas reconocidas y reutiliza el router de compra/edición. Una condición necesita marcador explícito aparte/además para separar su acción. Continuación incierta/negativa preserva datos y pide aclaración. Conserva la respuesta a la consulta al avanzar automáticamente a checkout, mediante el contexto ya existente independentInquiryAnswer. La compra durante pago ahora reconoce cantidades usando también el catálogo (té/infusión), sin excepciones PPP.

Baseline inicial40 fallidos. Tras primera implementación,10 casos perdían cantidad del té durante pago; seis controles adicionales de alcance fallaron. Ampliar a orden final reveló20 respuestas sobrescritas por checkout automático. Añadir variantes sin puntuación reprodujo18 fallos nuevos. Son familias/reruns solapados: no sumar como tests únicos. Una primera global fue interrumpida antes de editar para ampliar esos casos y NO se acredita. Final145 focalizadas, TypeScript,72 contratos Node y global77 suites/7738 Jest aprobados (1063.112s).354 hashes de fuente iguales antes/después. Evidencia docs/whatsapp-mixed-cancel-validation-1710.json; logs /tmp/ppp-mixed-cancel-final-*. Cero API/Meta/órdenes externas,181/183 intacto.

SIN desplegar; última verificación de runtime1c4d98a9, no auditoría remota nueva en esta tanda. Main intacta. Agrupar antes de reconstruir, y verificar HEAD/imagen/health después del deploy. No atribuir7738 tests al runtime anterior. No acredita mensajes mixtos arbitrarios ni compras nuevas después de orden completada; esta ruta mixta excluye estados registrados/humanos/pago externo.

Siguiente: una edición de carrito junto con selección de compra/opciones pendiente; «ese cambio» debe pedir dueño, luego instrucción explícita retira solo su alcance. Después ampliar consultas no relacionadas con cancelación junto a cambios y atributos. Contraste real acotado con saldo registrado antes de red (dos solicitudes en el tope vigente); no confirmar órdenes externas. No declarar vendible por número de tests.

## Cancelar el pedido: consulta frente a instrucción — validado, SIN desplegar — 17/10/2026

Sobre28ec484e, solo staging. 68 casos nuevos:64 consultas/negaciones/condiciones en dos cartas ficticias, cuatro estados (carrito/pago/confirmación/completado), agente simulado on/off; cuatro controles de cancelación explícita de borrador. Baseline16 rojos:12 borraban el borrador por consulta o condición, cuatro conservaban datos pero daban respuesta inadecuada a la negación. Ruta general antes de reapertura postorden y cancelación operativa: contesta sin guardar sesión ni llamar cancelación, conserva carrito/estado y recuerda paso pendiente cuando aplica. En estado registrado explica coordinación con local sin afirmar un estado externo no consultado. Frases completas acotadas; no acredita toda composición de lenguaje ni nueva precisión del modelo.

83 focalizadas, TypeScript final,72 contratos Node y global77 suites/7668 pruebas aprobados (997.846s);354 hashes de fuente iguales antes/después. Dos intentos focalizados intermedios no compilaron por autoría (variable duplicada y code ausente en fixture); corregidos antes del run aceptado. Informe docs/whatsapp-whole-cancel-validation-1710.json y logs /tmp/ppp-whole-cancel-*. Cero API/Meta/órdenes externas. Presupuesto181/183 sin cambios.

NO desplegado: servidor conserva código1c4d98a9, imagen/rollback de la entrada anterior. Main intacta. Agrupar con siguientes reglas antes de reconstruir; publicar staging no equivale a desplegar. Próximo: pregunta/condición con compra independiente y dos pendientes de distinto tipo con referencia vaga; luego contraste real acotado. No atribuir los7668 tests al runtime vigente hasta nuevo despliegue verificado.

## Consultas/negaciones de cancelación — validado y desplegado — 17/10/2026

Sobre 7c804911, solo staging. Tanda de 88 casos nuevos: 72 de nueve formas de retención, consulta, cita o condición, y 16 controles afirmativos («Sí, olvida ese cambio» / «Claro, cancela ese cambio»); dos cartas ficticias; pago/confirmación final; agente simulado on/off. Parte de checkout sembrado, abre una eliminación ambigua por el router, responde al metacomentario, elige línea por nota y finaliza una sola orden simulada conservando el resto. Baseline inicial de seis formas/48 casos: 44 respuestas inadecuadas (pago o carrito/«algo más») y cuatro pérdidas de estado final; carrito y edición se conservaban antes de fallar esas aserciones. No afirmar que se cancelaban órdenes ni que72 casos fallaron inicialmente.

El helper general pendingCartEditCancellationAside reconoce mensajes completos y acotados sobre una edición pendiente. Negación mantiene el pendiente; consulta explica cómo retirarlo; cita no se ejecuta; condición desconocida no se evalúa ni se aplica. La ruta responde y recuerda la selección sin guardar sesión ni cambiar estado. La orden explícita «olvida ese cambio» sigue por la ruta operativa existente. No contiene nombres/IDs PPP en producción y no acredita todos los mensajes mixtos ni todas las citas/condiciones.

356 focalizadas aprobadas (88 nuevas +268 controles), TypeScript y72 contratos Node aprobados. Una global se interrumpió para añadir16 controles afirmativos, que fallaron inicialmente. Se conserva sí afirmativo en crudo antes de normalizar y se exige condición real después del si condicional. Global final: 77 suites/7600 pruebas aprobadas,927.564 s;354 hashes de fuente sin cambios. TypeScript y contratos Node aprobados; código 1c4d98a9 publicado y desplegado, verificación debajo. La ejecución interrumpida no se acredita como verde. Informe docs/whatsapp-cancel-language-validation-1710.json; logs /tmp/ppp-cancel-language-final-{targets,global}-1710.log, /tmp/ppp-cancel-language-accepted-tsc-1710.log y /tmp/ppp-cancel-language-contracts-1710.log; snapshot /tmp/ppp-cancel-language-final-source-1710.json. Cero llamadas OpenAI/Meta/órdenes externas; Main intacta1a2b2e23; presupuesto181/183 intacto.

Despliegue verificado 2026-10-17T22:01:51Z: running/healthy; imagen activa=candidate sha256:c31c61825b25e339eee4f70f83e928adb44ca6e56204db1c21e3a4e24b271f0e; health OK/DB connected/circuit CLOSED. Pruebas puras en compilado de los cuatro tipos de aside, orden explícita fuera de aside y prefijo afirmativo; ruta y protecciones previas presentes. Modelos efectivos Sol6.1/Luna/Luna/GPT Transcribe intactos. Rollback ppp-nest-staging:rollback-before-1c4d98a9. No reconstruir ni repetir global por cierre documental.

Siguiente: auditar preguntas sobre cancelar el pedido completo frente a orden real de cancelación, con efectos externos simulados; búsqueda textual inicial no encontró frase exacta pero no acredita ausencia total de cobertura. Después, una edición de carrito junto con compra/sustitución pendiente y referencia vaga; resolver luego instrucción explícita sin perder lo demás. Extender continuaciones naturales para otros tipos de edición; consulta/condición más una acción independiente aún no acreditada. Contraste vivo nuevo después, contador antes de red y límite explícito (dos solicitudes del tope operativo); no ejecutar full histórico a ciegas. Ver docs/whatsapp-next-batches.md.

## Renunciar a una edición sin cancelar el pedido — validado y desplegado — 17/10/2026

Sobre d19781d6, solo staging. Tanda de 84 casos nuevos: 72 recorridos desde checkout ya sembrado (dos cartas, eliminación/cantidad/atributo/reemplazo, pago/confirmación final, agente simulado on/off; renuncia, consulta del total y una única orden simulada con carrito original) y 12 controles de varias ediciones sembradas. Baseline de 72 casos: 56 fallos/16 verdes, sin fallos de autoría. No sumar los retests como casos nuevos. Los 16 verdes originales eran Olvida ese cambio en atributos/reemplazo.

Ahora una renuncia completa retira una única edición de carrito pendiente. «No quites nada» retira solo la eliminación aunque exista otra edición; una referencia vaga con varios cambios pregunta cuál cancelar. Conserva cantidades, notas, opciones, adicional ajeno, nombre, teléfono, dirección, pago y estado. Responde el paso vigente y no registra orden en el turno de renuncia. Las compras/opciones pendientes fuera de las cuatro claves cart-edit y los cambios ya aplicados NO están acreditados por esta tanda.

268 focalizadas aprobadas (84 nuevas +184 controles), TypeScript y 72 contratos Node aprobados. Global final: 77 suites/7512 pruebas, 591.776 s; 354 hashes de fuente sin cambios. Código 22042562 publicado y desplegado; verificación efectiva debajo. Informe docs/whatsapp-withdraw-edit-validation-1710.json; logs /tmp/ppp-withdraw-edit-{baseline,expanded,tsc,global,contracts}-1710.log; snapshot /tmp/ppp-withdraw-edit-source-1710.json. Cero API/Meta/órdenes externas. Main intacta1a2b2e23; presupuesto181/183 sin consumo.

Despliegue verificado 2026-10-17T21:34:25Z: running/healthy; imagen activa=candidate sha256:8670c63da0534c0378ca776aa0af2968a5183e0bd792f4408760e859d6af10ae; health OK/DB connected/circuit CLOSED. Compilado incluye withdrawalScope/multipleEditWithdrawalGuard y protecciones anteriores; modelos efectivos Sol6.1/Luna/Luna/GPT Transcribe sin cambios. Rollback ppp-nest-staging:rollback-before-22042562. No repetir global ni reconstruir por cierre documental.

Siguiente: condiciones/negaciones/frases citadas alrededor de renuncia; referencia vaga con una edición de carrito y otra compra/sustitución pendiente; no afirmar rollback de algo ya aplicado sin versión anterior. Luego contraste vivo nuevo con contador antes de red y presupuesto explícito (restan dos del tope operativo); no lanzar full histórico del canal sin acotar inferencia. Ver docs/whatsapp-next-batches.md.

## Edición pendiente antes de confirmar — validado y desplegado — 17/10/2026

Sobre22a21ce2, solo staging. Tanda64 casos nuevos: 48 recorridos desde checkout sembrado (dos cartas ficticias, agente simulado on/off, pago/confirmación final, selección por número/nota, Si/confirmar/listo sin seleccionar) y16 controles directos de frontera de confirmación (eliminación/cantidad/reemplazo/atributos, firma vigente/vieja, ambos agentes). Los16 iniciales sin afirmación pasaban; al añadir Si, ocho casos de pago repetían prompt de pago y ocho de confirmación final creaban orden simulada antes de aclarar. No sumar retests como casos nuevos.

Se incorpora un recordatorio común de edición y se impide que una afirmación o confirmación completa apruebe una edición todavía sin dueño. tryConfirmOrder también verifica esto antes de continuar con checkout/crear orden. Varias listas o firma vieja piden instrucción completa, sin usar un índice dudoso. Las consultas conservan carrito, estado, nombre y selección; la elección posterior elimina solo la línea adecuada y una orden simulada conserva cantidades/notas y el adicional ajeno. No hay nombres/IDs PPP en producción.

172 focalizadas aprobadas (64 nuevas +108 controles de básicos/ráfagas/reemplazo), TypeScript y72 contratos Node aprobados. Global final77 suites/7428 pruebas,599.005s,354 hashes de fuente sin cambios. Una global anterior falló16 controles de respuesta al cancelar reemplazo: guardaba el pendiente retirado pero formateaba la respuesta desde la sesión vieja; se corrigió para usar next también al responder. Se conserva como fallida/no aceptada y no se desplegó. Informe docs/whatsapp-pending-edits-validation-1710.json; logs /tmp/ppp-pending-edits-final-{targets,tsc,global}-1710.log y /tmp/ppp-pending-edits-contracts-1710.log; snapshot /tmp/ppp-pending-edits-final-source-1710.json. Cero llamadas API/Meta/órdenes externas. Main intacta1a2b2e23. Presupuesto181/183 intacto.

Código7cdbc597 desplegado y verificado2026-10-17T21:19:49Z: running/healthy; imagen activa=candidate sha256:21ab34d7edd0a2fc9152599f6e2513e4ceac6465a137359544d554c6ec966dcb; health OK/DB connected/circuit CLOSED. Recordatorio de edición y guard central presentes en compilado; guard de vaciado anterior intacto. Modelos efectivos Sol6.1/Luna/Luna/GPT Transcribe sin cambios. Rollback ppp-nest-staging:rollback-before-7cdbc597. No repetir global ni reconstruir por cierre documental.

Siguiente: renuncia al cambio sin renunciar al pedido (no quites nada/déjalo como estaba/olvida ese cambio), consultas intercaladas y confirmación posterior; extender recorridos naturales de otros tipos de edición, pues las16 pruebas directas de frontera no acreditan esos chats completos. Ver docs/whatsapp-next-batches.md. Mantener presupuestos antes de red y no declarar vendible por volumen de tests.

## Ráfagas completas y alcance de vaciado — validado y desplegado — 17/10/2026

Sobre 0038e6a6, solo staging. 52 casos nuevos: 12 chats completos por cola pública (dos cartas ficticias, agente simulado on/off, Si/Señor con pausas 0/400/3400ms), 24 consulta de total + eliminación de fila en ambos órdenes y tres puntuaciones, 12 controles de alcance del vaciado y cuatro controles de vaciado explícito fragmentado. Primera reproducción de ocho cruces vaciaba todo: el fallback juntaba «todo» de la consulta y «quita» de otra burbuja. Ahora exige alcance de cláusula para ese fallback, conserva sintaxis explícita y fragmentada de borrado total y reutiliza handlers de edición para responder con total posterior al cambio. No contiene excepciones por nombres/IDs de PPP.

61 focalizadas aprobadas (52 nuevas y nueve existentes). **Global final 77 suites/7364 pruebas Jest**, 597.447s; TypeScript y 72 contratos Node aprobados. 354 hashes src/scripts/workflows sin cambios durante global. La primera global se interrumpió para preservar órdenes de vaciado fragmentadas y no se acredita. Dos fallos iniciales de autoría en el chat completo (quantity inexistente en DTO y expectativa de helper de geocoding en tarifa fija) se corrigieron en tests: no eran defectos productivos. Evidencia docs/whatsapp-complete-burst-validation-1710.json, logs /tmp/ppp-complete-burst-final-{global,tsc}-1710.log; snapshot /tmp/ppp-complete-burst-final-source-1710.json. Cero API/Meta/órdenes externas. Main conserva1a2b2e23.

Código77b2bf9f desplegado y verificado 2026-10-17T20:54:07Z: running/healthy, imagen activa=candidate sha256:39ef240160c273132c5699e6b556428762f70cb2a5cfff9189a1281c227562dd, health OK/DB connected/circuit CLOSED. Compilado reconoce alcance de vaciado, vaciado explícito y preámbulo de pago; modelos efectivos Sol6.1/Luna/Luna/GPT Transcribe sin cambios. Rollback ppp-nest-staging:rollback-before-77b2bf9f. No reconstruir por el cierre documental.

Siguiente: edición ambigua con dos líneas del mismo SKU/notas diferentes, consulta intercalada y selección posterior; luego contraste vivo acotado. Ver docs/whatsapp-next-batches.md. No declarar vendible ni concurrencia Meta real a partir de estos mocks. Presupuesto compartido181/183 intacto, dos restantes en el tope operativo; no ejecutar full histórico de canal sin límite de inferencia.

## Canal mínimo aprobado — 17/10/2026

Runner/workflow **efa2816e**, runtime b20b94db intacto. Nuevo STAGING_CHAT_PLAN=menu-only envía exactamente una petición cortés de carta, exige URL correcta y sesión/estado sin cambios. Incompatible con resumir borradores. Workflow manual ofrece menu-only como plan por defecto; execute sigue false. Los planes históricos completos permanecen explícitos. 72 contratos Node y 100 regresiones básicas aprobados; no sumarlos a la global anterior como pruebas únicas nuevas. No se cambió código de aplicación ni se reconstruyó imagen.

Ejecución real https://github.com/wilmerx5/PPP-NEST/actions/runs/39067442905 aprobada: un webhook firmado sintético, un inbound y un outbound persistidos, cero carrito; Meta reportó sent/delivered/read en la ventana aislada. No acredita entrada genuina de un cliente, ráfagas ni conversación completa. Ruta determinista de carta sin inferencia prevista; sin telemetría de agente en ventana. Presupuesto181/183 intacto, no se invocó inferencia deliberada. Evidencia docs/whatsapp-menu-channel-validation-1710.json; logs privados referenciados allí.

Siguiente: conversación nueva completa con techo real de llamadas antes de enviar; extender ráfagas con interrupciones sin confirmar órdenes externas. Dos llamadas restantes en el tope operativo: no lanzar plan full de 27 pasos sin estimar/limitar inferencia. Mantener básicos completos como control recurrente. Usuario preguntó por un agente que lo mantenga trabajando: se explicó recomendación de continuación programada acotada frente a bucle ilimitado; NO se creó automatización ni subagente. Main intacta.

## Repaso básico y preparación del canal — desplegado y preflight aprobado — 17/10/2026

Tanda sobre e9841dab. Ocho recorridos completos (dos cartas ficticias, recogida/domicilio, agente simulado on/off) y ocho variantes de setup concreto de domicilio. El repaso encontró que «Para domicilio Calle…» después de armar/corregir el pedido no avanzaba al pago. Se normaliza únicamente un setup afirmativo con dirección concreta, sin consulta/negación/condición ni plato explícito de catálogo, y se reutiliza el flujo existente de direcciones. Una primera candidata introdujo 40 regresiones de cobertura; no se desplegó. Se corrigió la frontera entre «Tiene domicilios a…» (consulta sin mutación) y «Para domicilio…» (destino). 76 controles focalizados aprobados incluyen los casos antiguos de cobertura y sus continuaciones. No sumar los retests como casos únicos.

Se comparte resolveWhatsappAgentModel entre agente y diagnóstico: override WHATSAPP_AGENT_MODEL recortado, luego configuración, luego fallback histórico sin cambiar comportamiento. El diagnóstico staging usa el modelo efectivo y aprueba Sol 6.1; protocolo 2026-10-17.pilot-v1. Consumidores conocidos del protocolo actualizados. Workflow principal de chat: solo dispatch manual en staging, checkout del SHA solicitado, execute=false por defecto. El runner exige bloqueo de eventos al personal además de destinatario/modelo/agente/credenciales. No activar los otros workflows heredados por estas actualizaciones de protocolo.

Global final **58 suites/7214 pruebas WhatsApp +19/98 complementarias =77 suites/7312 pruebas Jest**, TypeScript aprobado y 354 hashes src/scripts/workflows idénticos durante validación. Otras **69 pruebas Node de contrato**, seis archivos, aprobadas. La global anterior de 40 fallos se conserva como fallida, no como aceptación. Logs `/tmp/ppp-basic-channel-final-{full,complement,tsc}-1710.log`; snapshot `/tmp/ppp-basic-channel-final-source-1710.json`; informe durable `docs/whatsapp-basic-channel-validation-1710.json`.

Petición persistente del usuario: repasar chats completos sencillos durante el desarrollo. Ver el control recurrente y comando en `docs/whatsapp-next-batches.md`. Repetir básicos al cambiar intenciones/checkout; antes del piloto añadir conversación nueva y recuperar fallo real antiguo. Los mocks no acreditan modelo/canal. Cero OpenAI/Meta/órdenes externas hasta esta validación; presupuesto 183/181/2 intacto. Main intacta. Código b20b94db desplegado y verificado 2026-10-17T20:32:02Z: running/healthy, imagen activa=candidate sha256:736b95cd319a74acd026f85c34f926d64d66c2d59594a202a5cd98c983ba7ce8; health OK, DB connected, circuito CLOSED. Protocolo, resolvedor de modelo y guard de domicilio compilados comprobados. Modelos efectivos intactos. Rollback ppp-nest-staging:rollback-before-b20b94db.

Preflight real GitHub Actions aprobado: https://github.com/wilmerx5/PPP-NEST/actions/runs/39067125562, SHA b20b94db, execute=false/resume=fresh. Ocho controles aprobados (contexto autorizado, salud/DB, login, destino efectivo aislado, firma sin mensajes, conversación de prueba vacía, catálogo, logout). Cero posts con mensajes y cero pasos de conversación; los 27 expectedSteps del informe son el plan NO ejecutado. No acredita recepción Meta ni entrega al cliente.

Siguiente: preparar una prueba mínima explícita del canal antes del recorrido completo, con comprobación de estado persistido y respuesta entregada. El runner execute=true actual contiene 27 pasos: no ejecutarlo a ciegas con solo dos llamadas restantes. Añadir un modo acotado con contratos propios o medir primero su presupuesto; no fingir procedencia GitHub local. Después revisar ráfagas y una conversación nueva completa con modelo real. Mantener los bloqueos de destinatario, actividad concurrente y avisos al personal. No confirmar órdenes externas. Main intacta. No reconstruir ni repetir global por este cierre documental.

## Cierre terminal: validado y desplegado — 17/10/2026

Código **dab94dc0**, solo staging, sobre 23160b40. Una conversación ficticia completa reveló que «Señor» después de confirmar intentaba reabrir carrito. La prueba anterior era un falso positivo: el mock resetOrderSession ignoraba el estado solicitado y siempre dejaba building_cart. Se corrigió el mock; 10 controles previamente ocultos fallaron. El router ahora conserva completed/closed ante cortesía, afirmación repetida o intención existente de «nada más». Una compra nueva explícita sigue reabriendo. La extensión «No señor así está bien» también falló gratis y se corrigió con el resolvedor existente, sin nombres/IDs de PPP en producción.

100 focalizadas aprobadas; 36 controles nuevos de estado terminal, además de reforzar estado completed en el recorrido Si→Señor. Global final: **58 suites/7197 pruebas WhatsApp +19/98 complementarias =77 suites/7295 pruebas disjuntas**, TypeScript aprobado. 337 hashes src/scripts idénticos antes/después. Hubo una global anterior interrumpida tras detectar la extensión de cierre; no se acredita como verde. Logs `/tmp/ppp-post-confirm-final-{full,complement,tsc}-1710.log`; snapshot `/tmp/ppp-post-confirm-final-source-1710.json`.

Conversación de desarrollo de diez turnos con carta ficticia y modelo Sol real aceptada, **2 llamadas**, uso reportado completo, costo estimado USD0.038524 (no factura). Ocho turnos deterministas, dos con agente. La orden simulada conserva sin cebolla y Bebida Jazmin, se crea una vez y Señor mantiene completed. Extensión de once turnos con No señor así está bien revalidada gratis, no con nueva inferencia. El runner offline devuelve exit1 por no tener respuestas API exitosas, aunque el escenario consta accepted=true; no confundir con el resultado pagado exit0. Presupuesto compartido y espejo: **183/181/2**. Cero Meta y órdenes externas. Menú ficticio no acredita aislamiento de URLs/marcas de tenant: runner conserva defaults PPP en ese campo.

Evidencia durable `docs/whatsapp-post-confirm-validation-1710.json`; fixtures `scripts/fixtures/whatsapp-fresh-wrap-{menu,cases}-1710.json`; reporte privado `/tmp/ppp-fresh-wrap-live-1710-report.json`. No repetir el pago para arreglar reglas deterministas. Despliegue verificado 2026-10-17T20:00:10.586308+00:00: running/healthy, activa=candidate **sha256:8b80c859750fe5e36d3e804a1949607a2f01b128a8b6caa6243cf47bb1d80278**, guard terminal compilado, health OK/DB connected/circuit CLOSED. Modelos efectivos Sol 6.1/Luna/Luna/GPT Transcribe intactos. Rollback etiquetado ppp-nest-staging:rollback-before-dab94dc0. Main conserva 1a2b2e23. No reconstruir por este cierre documental.

Siguiente puerta: actualizar preflight de canal antiguo (rama fix/whatsapp-regression-baseline y approvedModel de GPT4.1) a staging/configuración efectiva sin saltarse destinatario ni bloqueo de eventos; verificar persistencia y ráfagas con el canal aislado. Evaluar también evitar inferencia innecesaria en respuestas inequívocas de teléfono/pago. Main intacta; no declarar piloto sin verificar el canal y aislamiento de órdenes.

## Cierre de validación integral — 17/10/2026

Estado vigente: código `0f98eb1e`, ya observado en el checkout del servidor y con funciones compiladas `isPoliteMenuLinkRequest` / `isFinalConfirmAffirmation` presentes. Modelos efectivos por env del contenedor: gpt-6.1-sol / gpt-6-luna / gpt-6-luna / gpt-transcribe. No se reconstruyó por el cierre documental ni se tocó Main.

La ampliación de los tests encontró **10 fallos/4 verdes**: peticiones de carta con signos/cortesías y durante pago. Se corrigió la normalización y se responde a una petición completa y estricta del menú antes de consumir datos de checkout, sin mutar sesión, retomando el paso pendiente. Se conservan controles de «menú ejecutivo» como producto. Nuevos controles: tres peticiones en seis estados, agente simulado on/off; «Si» seguido de «Señor» crea exactamente una orden simulada y luego responde cortesía, sin carrito ni «algo más». No acredita aún concurrencia real de esos dos mensajes.

**Global final: 58 suites WhatsApp / 7161 pruebas + 19 suites complementarias / 98 pruebas = 77 suites / 7259 pruebas disjuntas; TypeScript aprobado.** 335 hashes de src/scripts idénticos antes/después. El HEAD avanzó durante la suite porque otro editor publicó el mismo cambio como 0f98eb1e, pero la fuente congelada no cambió. El único cambio local de fuente restante amplía estados del test y está incluido en la global. Logs `/tmp/ppp-pilot-frozen-{full,complement,tsc}-1710.log`; snapshot `/tmp/ppp-pilot-freeze-1710.json`; evidencia durable `docs/whatsapp-pilot-audit-1710.json`. Global WhatsApp 607.672 s, complementarias 12.347 s. Cero inferencia pagada, Meta u órdenes externas.

Siguiente: verificar conversaciones nuevas completas con modelo real/canal aislado, empezando por menú durante checkout y confirmación fragmentada; revisar estado persistido si un resumen final vuelve a building_cart. Después piloto supervisado con operador, métricas y reversión. La global verde acredita regresiones simuladas, no ausencia de errores del modelo/canal real ni autorización de órdenes externas. No repetir global por este cierre documental. Las entradas inferiores conservan historia y pueden declarar pendientes ya resueltos.

## Auditoría vigente — 17/10/2026

Esta entrada sustituye el estado pendiente del 16/10 que se conserva debajo como historial. HEAD local/origin observado `5449973f`: 14 commits posteriores a ef9b2821. En servidor `/opt/ppp-staging` HEAD `5449973f`; contenedor running/healthy, imagen `sha256:8bfadde3cc95a7e92d483c0b51ea0d1d41959ef06a149b96617250dfda4e3ef7`. Inspección de checkout/contenedor, no comparación completa de módulos compilados ni auditoría fresca de producción/modelos.

Pruebas ejecutadas en esta auditoría: **423 focalizadas aprobadas**, 5294 omitidas por filtro, 5717 totales en general-accuracy; TypeScript sin errores. Incluyen audio principal/cortes/adicionales y recuperación por sabor, antes pendientes, además de cortesías, eliminación de línea, bebida aparte, direcciones y cierre. Estas dos familias ya no deben anunciarse como rojas basándose en el relevo viejo. No se ejecutó global de la fuente actual. Los 6764 tests históricos no validan automáticamente estos 14 commits nuevos.

Quedan cambios locales ajenos preservados en general-accuracy y orchestrator para pedir carta con cortesía («Hola buenas tardes tienes la carta por favor»); sus pruebas pasan en este run, pero el cambio no está publicado/desplegado. La corrección de confirmaciones «Si / Señor / No señor así está bien» tiene pruebas por estado y continuaciones; antes de cerrar el caso real revisar también ráfaga, estado persistido y recepción/envío, no solo sesión inicial simulada.

Siguiente puerta al piloto: integrar/revisar corrección local de carta; congelar candidato y global; conversaciones nuevas completas con modelo real y canal aislado (confirmación fragmentada, cambios, medios y consultas intermedias); observación de piloto supervisado y reversión. Cero llamadas pagadas, Meta u órdenes externas en esta auditoría. No se modificó Main. Evidencia durable: `docs/whatsapp-pilot-audit-1710.json`; logs `/tmp/ppp-pilot-audit-1710-{targets,tsc}.log`.

> Plan de continuación detallado vigente: [PPP hasta piloto, 16/10](WHATSAPP-PILOT-HANDOFF-2026-10-16.md). Leer antes de retomar; distingue fuente desplegada de trabajo local pendiente.

## Tanda local en curso: opción incluida y adicional — 16/10

**Trabajo local sin publicar ni desplegar**, sobre ef9b2821. No confundir con el despliegue d410291e descrito debajo. Main intacto.

Reproducción: tras hamburguesa ya añadida con nota sin cebolla, «Con gaseosa coca cola y una adicionales De papa a la francesa» compraba una bebida independiente. Ahora se valida el dueño único por atributos del catálogo y una porción adicional identificada sin ambigüedad; se cambia la opción y se añade la porción. Se conserva la nota. Alcance inicial building_cart sin selecciones pendientes; no afirmar cubiertos todavía varios dueños, adicional con opciones pendientes o todos los sinónimos de adicionales. Catálogos ficticios hamburguesa/bowl y prueba con carta PPP. La prueba del chat empieza desde la hamburguesa previamente aceptada: no acredita el saludo/compra inicial con el agente simulado.

Además: confirmaciones de dirección «a la misma», con direction/direcion; destino conocido por repartidores pide referencia del cliente sin convertir a recogida; consulta de tiempo en carrito abierto precede a aclaraciones de precio y retoma el paso pendiente. Confirmación + tiempo sin pago no crea orden.

Validación focalizada final: `/tmp/ppp-mixed-option-target.log`, **38 aprobadas**, 5274 omitidas por filtro. 105 controles de intención existentes aprobados en dos suites (`/tmp/ppp-mixed-option-related.log`). TypeScript `/tmp/ppp-current-checkout-tsc.log` aprobado. No validación global de esta fuente ni despliegue. Las nuevas regresiones de audio con instrucciones de corte y búsqueda de sabores por atributos siguen ROJAS (12 casos): no desplegar hasta resolver y ejecutar global. Baselines `/tmp/ppp-spoken-destination-baseline.log`, `/tmp/ppp-arrival-attribute-baseline.log`. No sumar runs solapados como casos distintos.

Audio original: una reproducción pagada con gpt-transcribe devolvió correctamente pollo bien dorado, pechugas partidas en cuatro, arepa frita y tres porciones de cada acompañamiento. Coincide con la transcripción almacenada del original: el fallo acreditado fue interpretación, no STT. Reportes privados `/tmp/ppp-original-audio-result.json` y `/tmp/ppp-original-audio-stored.json`. Una llamada HTTP200, 21 s facturables reportados; costo estimado $0.001575, no factura. Presupuesto compartido **183/179/4**, espejo privado sincronizado. Credencial temporal eliminada. Audios de tiempo almacenados también eran claros. No se enviaron mensajes Meta ni órdenes externas.

Siguiente: cerrar audio principal + acompañamientos sin usar número de cortes como cantidad; recuperación de producto por sabor configurado en catálogo (jugo/helado/infusión); extender edición incluida + adicional a otras formulaciones y varios candidatos sin compras accidentales. Después congelar fuente, ejecutar 57 suites WhatsApp y 19 complementarias, registrar evidencia, publicar/desplegar únicamente staging.

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
