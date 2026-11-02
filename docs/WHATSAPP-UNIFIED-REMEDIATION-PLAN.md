# Plan unificado de corrección de pedidos

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
