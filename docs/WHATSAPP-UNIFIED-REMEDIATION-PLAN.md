# Plan unificado de corrección de pedidos

## VIGENTE — tanda363: cambios de catálogo en cotizaciones múltiples

Baseline52/56 fallan:32 precio cambiado,16 disponibilidad parcial y4 oferta sin snapshot;4 sin cambios ya pasaban. Cotización guarda ID/nombre/precio de todos los productos. Al aceptar, precio cambiado o snapshot antiguo exige recotizar; disponibilidad parcial/total bloquea agregar, identifica faltantes y retira oferta para nueva selección.68 regresiones en dos catálogos × agente off/mock;16 cierres DTO simulados. Incluye cambios repetidos y recuperación explícita. Foco228/4 y final68/1 aprobados. Código `9508da43`.

Global34410/431 aprobada;649 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. Despliegue363 pendiente; runtime staging362. Producción349 y Kamppo321 sin cambios. Cero inferencia pagada/Meta/órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real. Límites: precios base, no nuevas reglas de tamaño/cantidades diferentes por línea. Próximo: repetición/reformulación y cantidades distintas en una cotización múltiple, revisando cobertura existente.


## VIGENTE — tanda362: precio actualizado al aceptar cotización individual

Baseline32/56 fallan: oferta simple agregaba usando precio distinto sin avisar.24 controles ya pasaban. Ahora cambio de precio del mismo producto conserva carrito/cantidad, actualiza oferta y exige nueva aceptación.72 regresiones:32 subida/bajada y aceptar/rechazar,16 agotado/retirado,8 precio idéntico,8 cambio/agotamiento posterior,8 respuestas de cantidad. Dos catálogos × agente off/mock;16 cierres DTO simulados. Foco224/4 y final72/1 aprobados. Código `53b782dc`.

Global34342/430 aprobada;648 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. Staging362 desplegado/verificado: `73619687`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41563702440; evidencia362-staging-deployment. Controles compilados existentes aprobados; cobertura362 local. Producción349 y Kamppo321 sin cambios. Cero inferencia pagada/Meta/órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real. Alcance: oferta individual mismo ID; tamaños distintos siguen ruta previa. Próximo prioritario: cotizaciones múltiples ante cambios de precio/agotamiento parcial; luego repetir/reformular preguntas con oferta pendiente.


## VIGENTE — tanda361: menú y tiempo durante cotización pendiente

Baseline64/64 fallan en continuidad. Menú ahora recuerda oferta aun con carrito vacío; ETA general aislada responde y retoma decisión sin tratar cotización como orden registrada. Reconoce «cuánto tarda la entrega».72 controles nuevos:64 recorridos en dos catálogos × agente off/mock × oferta individual/múltiple × cuatro consultas × aceptar/rechazar,32 cierres DTO simulados;8 guardas de mensajes mixtos/orden concreta. Foco92/2 y final72/1 aprobados. Código `f3972949`.

Global34270/429 aprobada;647 fuentes congeladas, inventario exacto; TypeScript general/build y scripts aprobados. Staging361 desplegado/verificado: `bb0b9cc4`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41560854089; evidencia361-staging-deployment. Controles compilados existentes aprobados; cobertura361 local. Producción349 y Kamppo321 sin cambios. Cero inferencia pagada/Meta/órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real ni tiempos reales de llegada. Próximo: repetición/reformulación con oferta pendiente, cantidades cotizadas y cambios de disponibilidad/precio entre consulta y aceptación.


## VIGENTE — tanda360: retomar cotizaciones tras consultas de pago

Oferta conservada pero recordatorio genérico tras preguntar datáfono/tarjeta/efectivo. Ahora recuerda producto/cantidad, o todos los productos de la cotización, y pide sí/no para agregar/rechazar. Baseline exploratoria:24 fallos reales de claridad y24 preparaciones inválidas retiradas; ver patterns360.28 regresiones nuevas en dos catálogos × agente off/mock, aceptación/rechazo y12 cierres simulados. Foco151/3 y final28/1 aprobados. Código `1f81890e`.

Global34198/428 aprobada;646 fuentes congeladas, inventario exacto; TypeScript general/build y scripts aprobados. Staging360 desplegado/verificado: `d54591ce`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41558191922; evidencia360-staging-deployment. Controles compilados existentes aprobados; cobertura360 local. Producción349 y Kamppo321 sin cambios. Cero inferencia pagada/Meta/órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real. Próximo: consultas informativas de menú/tiempo con carrito vacío y oferta pendiente; coherencia entre recordatorio y decisión posterior.


## VIGENTE — tanda359: opciones nuevas durante reemplazo con nota pendiente

Baseline44/44 fallan. Reemplazo por nombre completo con origen único y opciones anteriores compatibles inicia selección explícita de las opciones nuevas. Descarta la nota pendiente sin aplicar y lo comunica; conserva el original hasta completar. No autocompleta opciones nuevas, confirmar recuerda la selección, cancelar conserva original y recupera checkout.44 controles nuevos:32 cierres DTO/recibo simulados,8 cancelaciones,4 guardas de original cambiado; dos catálogos × agente off/mock. Foco106/2 aprobado. Código `0613645b`.

Global34170/427 aprobada;645 fuentes congeladas, inventario exacto; TypeScript general/build y scripts aprobados. Staging359 desplegado/verificado: `b2131279`, healthy, cero reinicios, API local/pública ok, modelos/configuración preservados. Workflow41555190121; evidencia359-staging-deployment. Controles compilados existentes aprobados; cobertura359 local. Producción349 y Kamppo321 sin cambios. Cero inferencia pagada/Meta/órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real. Opciones previas incompatibles, destino ambiguo o instrucciones adicionales conservan guardas de358. Próximo: claridad al retomar ofertas tras consultas intermedias.


## VIGENTE — tanda358: reemplazos durante aclaración de nota

Baseline28/46 fallan: cambios inequívocos bloqueados y caducidad/carrito cambiado interceptados antes de resolver la nota. Reutiliza reemplazo atómico y cambios de preparación sobre origen único/destino disponible con opciones completas; conserva cantidades, variantes, notas y checkout. Al cambiar carrito descarta nota pendiente y avisa; número antiguo no la aplica al nuevo plato. Títulos completos de catálogo no se convierten en nota.62 controles nuevos:32 cierres DTO/recibo en dos catálogos × agente off/mock × carrito/confirmación ×4 cambios;30 guardas. Foco564/4 aprobado. Código `14919485`.

Global34126/426 aprobada;644 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. Staging358 desplegado/verificado: `3c4a3c2c`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41551895056; evidencia358-staging-deployment. Controles compilados existentes aprobados; cobertura358 local. Producción349 sin cambios. Kamppo321 sin cambios. Cero inferencia pagada/Meta/órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real. Destinos con opciones nuevas o indicaciones extra requieren terminar/retirar primero la nota pendiente; no se inicia otra selección superpuesta. Próximo: recuperación guiada cuando el reemplazo requiere opciones adicionales, conservando el original hasta completarlas; luego claridad al retomar ofertas tras consultas.


## VIGENTE — tanda357: datáfono y preguntas de capacidad de pago

Baseline60/64 fallan: «manejan datáfono» podía buscar productos; consultas de tarjeta podían contestarse por efectivo seleccionado. Ahora las preguntas aisladas se resuelven antes de consumir campos de checkout; no seleccionan pago ni descartan ofertas. Reconoce maneja/manejan, recibe/reciben y consulta corta; distingue enlace de datáfono, muestra condiciones de métodos presenciales explícitos y reconoce disponibilidad no confirmada.73 controles nuevos,6 estados,2 catálogos, agente off/mock,MP configurado/ausente y4 cierres simulados. Foco164/3; final73/1. Primera global detectó4 fallos de claridad en consulta sobre efectivo: se restauró «no lo dejo elegido» y pasaron4/4; ejecución incompleta descartada. Código final `131b2c33` sobre `4c58f6d1`.

Repetición global34064/425 aprobada;643 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. Staging357 desplegado/verificado: `09721b38`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41547862031; evidencia357-staging-deployment. Controles compilados existentes aprobados; cobertura357 local. Producción349 sin cambios. Kamppo321 sin cambios. Cero inferencia pagada/Meta/órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real ni disponibilidad física de datáfono. Mensajes mixtos: probado límite de intercepción, no resolución de todas las intenciones. Próximo: sustitución de producto/preparación durante aclaración de nota, preservando identidad y evitando aplicar selección antigua sobre carrito cambiado.


## VIGENTE — tanda356: datos de transferencia antes de confirmar

Chat02/11: elección anticipada de transferencia omitía datos de cuenta al completar nombre/dirección; también al cambiar desde efectivo en revisión final. Baseline20/20 fallan. Ahora revisión final muestra datos configurados o aviso explícito de cuenta ausente, sin duplicar el prefacio del mismo turno.28 controles nuevos en dos catálogos × agente off/mock;16 cierres DTO simulados. Foco28/1 y124 controles relacionados aprobados. Código `8a02d021`. Incluye despedida de domicilio `f692d43e`: «Te lo enviaremos lo más pronto posible».

Global33991/424 aprobada;642 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. Staging356 desplegado/verificado: `b648c6e1`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41522483566; evidencia356-staging-deployment. Controles compilados existentes aprobados; cobertura356 local. Producción349 sin cambios. Kamppo321 sin cambios. Cero inferencia pagada/Meta/órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real ni pago realizado. Próximo: «manejan datáfono», distinguir equipo físico de enlace usando configuración; luego sustituciones durante aclaración de notas.


## VIGENTE — tanda355: retirada/cantidad durante aclaración de nota

Baseline16/36 fallan: la aclaración348 bloqueaba retiradas/correcciones nominales inequívocas. Ahora usa los manejadores existentes con referencia única; un cambio real descarta la nota pendiente y lo explica. Respuestas numéricas antiguas no la aplican. Ambigüedad, ordinales, pago, caducidad, condiciones y cantidades inválidas conservan las guardas.44 controles nuevos:24 cierres DTO/recibo en dos catálogos × agente off/mock × carrito/confirmación × retirada completa/parcial/cantidad;20 guardas. Foco232/4 y44/1 aprobado. Código `87122f5b`.

Global aislada33963/423 aprobada,641 fuentes congeladas e inventario exacto;4 workers, TypeScript general/build y scripts aprobados. Staging355 desplegado/verificado: `f6f5159e`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41515895462; evidencia355-staging-deployment. Controles compilados existentes aprobados; cobertura355 local. Producción349 `932f60b7` y Kamppo321 sin cambios; Bold/auth locales preservados. Cero inferencia pagada/Meta/órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real ni cierra U3/U4. Próximo: sustitución de producto/preparación durante aclaración, conservando identidad y evitando aplicar notas sobre carrito cambiado.


## VIGENTE — tanda354: teléfono y etiqueta fuera de dirección

Chat02/11: etiqueta «celular» posterior al número quedaba en dirección/recibo. Reconocimiento acotado extrae móvil validado y etiqueta juntos, incluyendo +57/espacios, sin borrar referencias con esas palabras. Conserva conjunto, torre, apto y contacto al recibir la calle después. Baseline28/40 fallan;44 controles nuevos,32 cierres DTO/recibo simulado en dos catálogos × agente off/mock × calle presente/pendiente ×4 formatos. Foco258/5 y44/1 aprobados. Código `3d0aca67`.

Global aislada33919/422 aprobada,640 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. Primer intento interrumpido por SIGTERM/143 tras11 suites sin fallos registrados; descartado, repetición completa con4 workers aprobada. Staging354 desplegado/verificado: `101cb2a5`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41511183882; evidencia354-staging-deployment. Controles compilados existentes aprobados; cobertura354 local. Producción349 `932f60b7` y Kamppo321 sin cambios; Bold/auth locales preservados. Cero inferencia pagada/Meta/órdenes externas; presupuesto267/256/11 intacto. No sanea órdenes históricas ni acredita modelo/canal real. Próximo: cambios/retiradas de productos durante aclaración de nota, evitando selección sobre carrito desactualizado. U3/U4 siguen abiertos.


## VIGENTE — tandas352–353: total+demora y cierre que no es nombre

352:84 controles nuevos; consulta combinada de total/ETA durante aclaración, selección y «no, el otro» conservan notas, opciones y cantidades. Baseline66/80 fallan; foco334/5 y84/1; global propia33805/420 aprobada. Código `6a5c9d7f`.

353 priorizada por chat real02/11 13:18–13:23: «No así no más» se guardaba como nombre. Detector acotado compartido reconoce cierre y rechaza identidad; si estaba guardado obliga a pedir nombre real antes de confirmar. Baseline46/66 fallan;70 controles nuevos, foco431/5 y70/1 aprobados. Incluye56 cierres DTO simulados, dos catálogos y agente off/mock. Código `f64e0114`. No modifica órdenes históricas.

Global conjunta33875/421 aprobada,639 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. Staging352–353 desplegado/verificado: `5850d12f`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41504255082; evidencia353-staging-deployment. Controles compilados existentes aprobados; cobertura352–353 local. Producción349 `932f60b7` y Kamppo321 sin cambios; Bold/auth locales preservados. Cero inferencia pagada/Meta/órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real ni cierra U3/U4. Próximo: limpiar etiqueta «celular» de referencia de dirección preservando conjunto/torre/apartamento y teléfono; después cambios/retiradas durante aclaración de nota.


## VIGENTE — tanda351: demora durante aclaración de nota

Baseline66/80 fallan: consultar ETA repetía candidatos sin tiempo. Detector acotado responde ETA configurada con unidades, o indica que el equipo debe confirmarla si falta configuración; conserva carrito, selección, estado y caducidad.88 controles nuevos:64 recorridos DTO/recibo en dos catálogos × agente off/mock × carrito/confirmación × ETA presente/ausente ×4 preguntas;16 guardas y8 variantes/cortesías con cancelación posterior. Foco inicial246/4 y final88/1 aprobados.

Global aislada33721/419 aprobada,637 fuentes congeladas, inventario exacto; TypeScript general/build y scripts aprobados. Código `19326414`. Staging351 desplegado/verificado: `56846fb8`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41498203435; evidencia351-staging-deployment. Controles compilados existentes aprobados; cobertura351 local. Producción349 `932f60b7` y Kamppo321 sin cambios. Bold/auth locales preservados. Cero inferencia pagada/Meta/órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real ni cierra U3/U4. Próximo: consulta combinada total+demora durante aclaración y selección/corrección posterior.


## VIGENTE — tanda350: total durante aclaración de nota

Baseline50/64 fallan: al preguntar el total durante selección348, el bot repetía candidatos sin precio. Ahora responde con resumen y retoma la misma aclaración sin cambiar carrito, estado ni caducidad.68 controles nuevos:48 recorridos con DTO/recibo en dos catálogos × agente off/mock × carrito/confirmación ×6 frases;16 guardas y4 controles de domicilio. Foco inicial265/4 y final68/1 aprobados.

Global aislada33633/418 aprobada,636 fuentes congeladas, inventario exacto; TypeScript general/build y scripts aprobados. Runtime `ae23d1e6`. Staging350 desplegado/verificado: `d12dd080`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41493753247; evidencia350-staging-deployment. Controles compilados existentes aprobados; cobertura350 local. Producción349 `932f60b7` y Kamppo321 sin cambios. Documentación del merge de producción sincronizada; Bold/auth locales preservados. Cero inferencia pagada/Meta/órdenes externas; presupuesto267/256/11 intacto. No acredita modelo/canal real ni cierra U3/U4. Próximo: tiempo de entrega durante aclaración y retomarla.


## VIGENTE — producción349: merge de staging a Main (02/11/2026)

Solicitud explícita del usuario: merge con Main y despliegue. Runtime producción `932f60b7d31957378d054295a9bd154742171621`: incorpora tandas334–349 y preserva íntegros los cambios Bold/auth de Main `b4647a9e`. Merge sin conflictos, validado en worktree aislado; cambios locales ajenos de staging preservados.

Validación del árbol fusionado:33578 pruebas aprobadas en421 suites;11 pruebas opt-in de integración DB de Bold omitidas en2 suites. Inventario423 suites exacto,652 fuentes congeladas, TypeScript general/build y scripts aprobados. Cero inferencia pagada, Meta u órdenes externas; presupuesto267/256/11 intacto. No equivale a validación real del modelo/canal ni cierra U3/U4.

Workflow41484003586 completado: contenedor activo,0 reinicios, API local/pública ok y DB conectada; configuración privada/modelos preservados. Producción no define healthcheck Docker (`health:null`); salud verificada por endpoints. Controles compilados existentes aprobados, cobertura349 local. Evidencia: `whatsapp-batch-349-production-{deployment,validation,global-sources}.json`.

Staging runtime349 `c0e8bc47` y motor Kamppo321 sin cambios en esta operación. El workflow alojado en Kamppo solo desplegó PPP. Próximo trabajo en staging: consultar total durante aclaración y retomarla. Los bloques anteriores que indican producción333 son históricos, sustituidos por este estado.


Vigente desde01/11/2026. Une los pendientes de `whatsapp-chats-3110-remediation-plan.md`, `whatsapp-chats-0111-remediation-plan.md` y las tandas anteriores del relevo. Un mismo comportamiento tiene una sola prioridad aunque aparezca en varios chats. Los planes fechados conservan evidencia histórica; consultar el relevo para los SHAs desplegados.

## Orden de ejecución

1. **U1 — Totales, reparto e identidad del plato (P0).**31/10 grupoC/D y01/11 mensajes438–447. Las tandas329/331/332 cubrieron fragmentos y reparto de dos, no el encabezado4 con reparto3+1 y sopas3+1. Tanda340 validada y desplegada en staging: conservar total, no comprar pollo/sopas sueltos, aclarar la asignación pendiente y completar sin duplicar. Después ampliar reparaciones de carritos ya incorrectos, correcciones del reparto y distribuciones mayores.
2. **U2 — Una compra por intención, también en ráfagas (P0).**31/10 grupoB y01/11 mensajes217–242.327 corrigió pérdida de teléfono/apartamento; las compras inesperadas originales siguen abiertas. Probar el receptor real con temporizadores simulados, orden y duplicación de messageId, propuestas del modelo con historia obsoleta, contacto y cortesías como «por fis». Una prueba secuencial no acredita coalescencia. Tanda341: foco20/20, omisión por «por fis» y compra reconocida con «y» confundida con dirección corregidas;8 cierres en dos catálogos con mensajes separados/coalescidos. Global33238/408, TypeScript general/build y scripts aprobados. Staging341 desplegado y verificado: código `eb33603b`, healthy, cero reinicios, API local/pública ok y modelos/configuración privada preservados. Workflow41370184449; evidencia `whatsapp-batch-341-staging-deployment.json`. Controles compilados previos aprobados; cobertura específica341 local. Duplicación histórica, reentregas y ráfagas parciales continúan abiertas.
3. **U3 — Editar, eliminar y reemplazar sin compras extra (P0/P1).**31/10 grupoD/H;01/11 mensajes312–333 y400–437; caso anterior de dos churrascos modificados dentro de tres.333/334 cubren sustitución concreta y consulta, no todos los cambios compuestos. Invariantes: editar no suma; eliminar por sabor retira esa línea; reemplazo valida antes de borrar; extras legítimos se conservan; ambigüedad pregunta sin mutar.
4. **U4 — Opciones y notas hasta el recibo (P0).**31/10 grupoC/H;01/11 mensajes177–216,368–385,448–459.328 cubrió bebida+sopa adicional; aún falta Pepsi a través de variante, notas perdidas, alcance de varios platos, opción incluida frente a adicional y exclusiones. Una única instrucción coherente por atributo y cocina.
5. **U5 — Selecciones pendientes y catálogo vigente (P1).**31/10 grupoF/A;01/11 bloqueo156–181 y gaseosa79–112.339 cubre «ambos» de la lista ofrecida, firma/stock y cierre posterior. Pendientes: oferta múltiple, aceptación repetida, opción resuelta que reaparece, tamaño/sabor, catálogo con `**`, cambios de disponibilidad. No confundir aprobar una selección con aceptar domicilio.
6. **U6 — Contacto y direcciones sin perder contexto (P1).**31/10 grupoG/B;01/11 mensajes1–19,283–292,488–500.327 y tandas anteriores tienen cobertura parcial. Añadir nombre en leyenda de imagen, teléfono numérico durante una opción, calle+conjunto, Bis/Sur/ceros, datos entre mensajes y recuperación de discrepancia de mapa. No aceptar coordenadas ajenas para evitar una pregunta.
7. **U7 — Consultas y lenguaje cotidiano (P2).**31/10 grupoE;01/11 consultas44–55,386–399 y460–474.335–338 cubren personas frente a unidades, total+demora, nuevo domicilio y opciones con cortesía. Ampliar disponibilidad que compra, petición cortés que se ignora, `confirm,ar`, `contraentrea`, ordinales mal escritos. Mantener controles negativos de negación, condición y solo consulta.
8. **U8 — Aceptación real y promoción (después de P0).**Ensayo aislado con catálogo vigente, modelo real y trazas; después canal controlado sin cocina. El presupuesto compartido sigue267 asignadas/256 usadas/11 restantes: no gastar por defecto ni reiniciar contador. Producción/Main y migración Kamppo son promociones separadas; esta solicitud continúa trabajo en staging. Mezcla de idiomas y variantes cosméticas tienen prioridad final, por preferencia del usuario.

## Reglas para cerrar una tanda

- Evidencia de origen y reproducción inicial, distinguiendo fallo exacto de otro descubierto durante la reproducción.
- Pruebas por comportamiento en dos catálogos; carrito, cantidades, atributos, notas, estado, respuesta, DTO y recibo. Preferir escenarios distintos a multiplicación cosmética.
- Pruebas focales y TypeScript; global con inventario exacto y fuentes congeladas si cambia motor compartido.
- Guardar qué se corrigió, qué no se reprodujo y qué sigue pendiente. Publicar/deploy staging con SHA y salud verificados.
- No declarar un grupo completo resuelto por aprobar una subfamilia. No convertir recibos emitidos en métricas de clientes o entregas.

## Estado de plataformas al abrir este plan

PPP producción333, staging339, Kamppo321. Delta de producción pendiente334–339; delta de Kamppo322–339. La evidencia vigente del relevo manda sobre esta foto inicial. Las pruebas de estas tandas aíslan modelo, Meta y persistencia; no acreditan por sí solas desempeño real ni preparación comercial.

## Evidencia340

Global33218 pruebas/407 suites, inventario exacto y624 fuentes congeladas. TypeScript general/build y scripts aprobados. Evidencia whatsapp-batch-340-{sources,global-sources,validation,patterns}. Staging340 desplegado y verificado: código `2e827464`, healthy, cero reinicios, API local/pública ok y modelos/configuración privada preservados. Workflow41367782193; evidencia `whatsapp-batch-340-staging-deployment.json`. Controles compilados previos aprobados; cobertura específica340 local. U1 sigue abierto para correcciones de carritos ya erróneos y repartos más complejos. Siguiente ejecución U2.

## Evidencia342

24 regresiones nuevas, foco24/1 y relacionadas63/4 aprobadas, TypeScript aprobado. Receptor real con claim simulado: ráfagas parciales, duplicado intra-lote, reentrega completa y mixta conservan cantidades; compra adicional explícita sí suma.24 cierres con DTO/recibo. Sin cambio del motor ni redeploy; staging runtime341. La cobertura simulada reduce pendientes de U2, sin cerrar causalidad histórica, persistencia real ni concurrencia entre instancias. Siguiente contacto intercalado y reparación explícita compartida con U3.

## Evidencia343

Contacto intercalado y reparación explícita:30 controles nuevos y470 relacionadas aprobados. Corrige bloqueo de retirada directa por nombre completo y compra omitida durante pago tras teléfono.16 cierres DTO/recibo y14 guardas. Global33304/411 y TypeScript/scripts aprobados; Staging343 desplegado y verificado: código `6e890644`, healthy, cero reinicios, API local/pública ok y modelos/configuración privada preservados. Workflow41375523907; evidencia `whatsapp-batch-343-staging-deployment.json`. Controles compilados previos aprobados; cobertura343 local. U2 conserva causalidad histórica y aceptación real pendientes; continuar U3/U4 (variantes, notas y bebidas durante modificaciones).

## Caso nuevo01/11 20:49 — prioridad siguiente

Carrito arroz+costillas → «En combo» resuelto solo sobre costillas → «Cancelar.» no vacía. Priorizar reproducción de cancelación con puntuación y preservación de negaciones/preguntas; después aclaración contextual de plato combinado frente a dos productos y combo sin gaseosa. No declarar cubierto por la corrección de cotización343. Detalle anonimizado en whatsapp-batch-343-patterns.md.

Caso de cotización20:32 incorporado343:12 pruebas adicionales, total42 nuevas. Foco final114/4; un plato compuesto único por catálogo no se cotiza como componentes y aceptación agrega solo ese ID.

## Evidencia344

Aclaración del usuario: «arroz chino, costillas ... sin gaseosa» debe identificar un plato compuesto.31 controles nuevos y60 relacionadas aprobados; normalización acotada por catálogo y pago independiente conservado en ráfaga.16 cierres DTO/recibo. Global33335/412, TypeScript general/build y scripts aprobados; Staging344 desplegado y verificado: código `d7ed88aa`, healthy, cero reinicios, API local/pública ok y modelos/configuración privada preservados. Workflow41377899052; evidencia `whatsapp-batch-344-staging-deployment.json`. Controles compilados previos aprobados; cobertura344 local. La compra inicial pasa; recuperación contextual a combo y cancelación con puntuación siguen pendientes, no cubiertas por344.

## Evidencia345

Cancelación con puntuación y propuesta de recuperación contextual de dos líneas unitarias sin bebida.38 controles nuevos/158 relacionadas aprobadas,4 cierres DTO/recibo. Mantener separados aceptar cambio y confirmar orden. Global33373/413, TypeScript general/build y scripts aprobados; Staging345 desplegado y verificado: código `b3eb716f`, healthy, cero reinicios, API local/pública ok y modelos/configuración privada preservados. Workflow41381081970; evidencia `whatsapp-batch-345-staging-deployment.json`. Controles compilados previos aprobados; cobertura345 local. U3 mantiene ampliaciones de cantidades, atributos y notas; U4 sigue con conservación de bebida/notas en cambios más complejos.

## VIGENTE — tanda346: notas parciales y conservación de opciones

Prioridad U3/U4: reparto explícito de notas sobre unidades existentes y conservación al cambiar preparación.40 controles nuevos; foco433/4 aprobado. Baseline8/16 fallan por nota parcial;8 cambios de preparación ya pasan. «De los tres churrascos, dos sin arroz más ensalada» conserva3 unidades y modifica solo2; catálogos pollo/res y tofu/vegetal. Cantidades inválidas, preguntas, condiciones y versiones ambiguas no mutan carrito.16 cierres verifican DTO/recibo simulado.

Global aislada33413/414 aprobada;632 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados. Primera ejecución invalidada por cambios ajenos simultáneos, sin fallos de pruebas. Staging346 desplegado y verificado: código `48ee9b0e`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41390403109; evidencia whatsapp-batch-346-staging-deployment.json. Controles compilados previos aprobados; cobertura346 local. producción333 y Kamppo321 sin cambios. Evidencias whatsapp-batch-346-sources.json y patterns.md. Cero llamadas pagadas/Meta/órdenes externas; presupuesto267/256/11 intacto. Próximo: variaciones de reparto con notas previas y cambios de grupo durante checkout; no declarar cerrado U3/U4.

## VIGENTE — tanda347: nota tras cambio parcial de preparación

Baseline16/16 fallan: después de cambiar una unidad a broaster, «El broaster sin arroz» consultaba catálogo y no guardaba nota. Ruta temprana resuelve una preparación explícita contra una sola línea del carrito, conserva cantidades, opciones, notas y checkout; ambigüedad/conflicto/selección o pago pendiente piden aclaración.40 controles nuevos,16 cierres DTO/recibo, dos catálogos y agente off/mock. Foco569/5 aprobado; global aislada33453/415 aprobada,633 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados. Staging347 desplegado/verificado: `af2a80d5`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41451155444; evidencia whatsapp-batch-347-staging-deployment.json. Controles compilados previos aprobados; cobertura347 local. Producción333 y Kamppo321 sin cambios. Cero llamadas pagadas/Meta/órdenes externas; presupuesto267/256/11 intacto. Evidencias whatsapp-batch-347-{sources,patterns}. Próximo: continuar una aclaración de nota entre varias variantes; U3/U4 siguen abiertos.

## VIGENTE — tanda348: retomar nota tras aclarar el plato

Baseline24/24 fallan: la nota por preparación ambigua no muestra opciones ni conserva selección. Ahora guarda la solicitud con firma del carrito y caducidad de10 minutos; presenta cantidad/opciones/notas y admite número, opción, nota anterior o nombre inequívoco. Aplica a la línea completa y conserva checkout. Preguntas, sí/confirmar, grupos, conflictos y pago pendiente no seleccionan. Firma cambiada/vencida descarta; retirar nota/cancelar/reiniciar verificados.

56 casos nuevos;24 cierres DTO/recibo; foco258/4 aprobado. Global aislada33509/416 aprobada,634 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. Staging348 desplegado/verificado: `68062b8c`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41454914207; evidencia whatsapp-batch-348-staging-deployment.json. Controles compilados previos aprobados; cobertura348 local. Producción333 y Kamppo321 sin cambios. Cero llamadas pagadas/Meta/órdenes externas, presupuesto267/256/11 intacto. Evidencias whatsapp-batch-348-{sources,patterns}. Próximo: corregir selección recién aplicada («no, el otro») sin duplicar notas; U3/U4 siguen abiertos.

## VIGENTE — tanda349: redirigir la nota tras elegir una línea

Baseline24/24 fallan: «no, el otro» tras aclaración348 no restaura origen/aplica destino. Ahora conserva estado previo y candidatos; permite redirigir líneas completas con cantidades distintas, preservando notas originales, opciones, unidades y checkout. Ordinales pertenecen a la lista de candidatos; productos ajenos no se incluyen. Tres candidatos piden aclaración y admiten número/opción/nota. Firma/caducidad/interrupción/pago/selección pendiente y repeticiones no vuelven a modificar.

56 controles nuevos,24 cierres DTO/recibo; foco56/1 y relacionadas536/4 aprobados. Global aislada33565/417 aprobada,635 fuentes congeladas e inventario exacto; TypeScript general/build y scripts aprobados. Staging349 desplegado/verificado: `c0e8bc47`, healthy, cero reinicios, API local/pública ok y modelos/configuración preservados. Workflow41460228361; evidencia whatsapp-batch-349-staging-deployment.json. Controles compilados previos aprobados; cobertura349 local. Producción333 y Kamppo321 sin cambios. Cero llamadas pagadas/Meta/órdenes externas; presupuesto267/256/11 intacto. Evidencias whatsapp-batch-349-{sources,patterns}. Próximo: consultar total durante aclaración y retomarla; U3/U4 siguen abiertos.
