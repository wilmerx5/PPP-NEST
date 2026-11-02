# Revisión de chats del 01/11/2026

Fuente: `11-1-2026.zip`, SHA256 `0683557ad25b99775174593d41b2507199c7ea61ae94073a8c2c4dc89050ea5f`. Revisados los500 mensajes de chat.txt:256 del cliente y244 del bot,12:50:08–18:23:06. chat.md es otra representación del mismo hilo. Los números de mensaje siguientes son ordinales desde1 en chat.txt.

Es un hilo continuo con múltiples intentos y datos de contacto cambiantes, no500 clientes. Se observan30 respuestas que afirman registrar pedidos; no verifican persistencia, cobro ni entrega. Cuatro reinicios explícitos (91,175,181,420) y una cancelación (446) muestran que el usuario tuvo que recuperar varios recorridos. No se calcula conversión ni abandono. No hay versión del servidor, trazas del modelo, catálogo histórico completo ni audio original: no atribuir los fallos a Luna o a migraciones solo por esta exportación. Se omiten datos personales.

## Diagnóstico

Sí hay fallos graves del bot, no solo faltas de ortografía o clientes que dejan de responder. La prioridad es conservar la intención y la integridad del pedido: cantidades, identidad del producto, opciones, notas y cambios pendientes. Algunos recibos correctos llegan después de que el cliente repite, elimina o reinicia; no cuentan como recorridos fluidos.

## Críticos: pueden cambiar lo que se cobra o prepara

1. **Reparto de ejecutivos —438–447,17:07–17:18.** «4 ejecutivos /3 con frito /1 broster», todos pierna pernil,3 ajiacos y1 menudencia, produce cantidades superiores a4 y un pollo completo. El resumen y la lista posterior son inconsistentes: no se puede afirmar un total exacto de unidades a partir de ellos. «Solo quería4» tampoco recupera el reparto; acaba cancelando. Invariante:4 ejecutivos totales,3 fritos y1 broaster. Si no se sabe a cuál corresponde cada sopa, preguntar solo esa distribución. El encabezado no es otra compra y «uno broster» hereda el tipo ejecutivo.
2. **Duplicación y omisiones en mensajes consecutivos —217–242,14:45–14:47.** Bagre, sobrebarriga «por Fis», menudencia, ajiaco y gaseosa terminan inicialmente como2 bagres, sin sobrebarriga ni menudencia. «Fis» aparece como producto desconocido. La corrección conjunta no funciona; quitar y añadir por separado sí. Debe reproducirse tanto el orden de mensajes como su agrupación real: todavía no se prueba si el origen fue historia obsoleta, modelo o procesamiento de ráfagas.
3. **Modificar añade; eliminar modifica —400–437,16:41–16:50.** La bebida del combo abre una gaseosa adicional. Después «el combo paisa lo quiero con gaseosa ginger» añade otro combo:87.000→134.000. «Quita el combo…con colombiana» acaba cambiando bebida y conservando dos combos. Reinicia y reconstruye. El verbo eliminar debe dominar; el sabor identifica la línea que se quiere quitar, no autoriza cambiarlo.
4. **Bebida explícita perdida hasta el recibo —448–459,17:42–17:44.** Pide combo y medio broaster «con pepsi»; al aclarar la variante, el combo queda con Colombiana y así llega al recibo. Hay discrepancia efectiva, no solo una respuesta confusa. Conservar opciones mencionadas mientras se resuelve el producto; preguntar si el alcance es ambiguo, sin sustituir silenciosamente por un valor predeterminado.
5. **Notas de cocina perdidas —202–216 y368–385.** «Bien asada», «solo papa francesa y ensalada sin vinagreta» no se conservan completas inicialmente. Algunas se recuperan al repetir; otras no aparecen en el recibo. Probar persistencia de notas tras elegir producto/variante y ediciones dirigidas a una de varias líneas. No se observaron alergias explícitas; no atribuir consecuencias médicas al chat.

## Altos: bloquean o borran trabajo válido

6. **Cambio aplicado deja selección obsoleta —156–181,14:22–14:31.** Pollo y medio más sopa; pide arepas fritas, aclara «a los dos» y el bot afirma aplicarlo. Dirección y pago chocan después con «El carrito cambió…». «No quiero más cambio» abre otra pregunta y termina reiniciando. En el siguiente intento las arepas se aplican solo al medio; vuelve a reiniciar. Resolver el conjunto de candidatos una sola vez, limpiar esa selección y conservar el paso de checkout. Este es el primer caso elegido para reproducción ejecutable de esta revisión.
7. **Borrar y reemplazar ejecuta solo el borrado —312–333.** «Sí, elimina todo y agrega elcombo mixto» deja el carrito vacío. El cliente vuelve a pedirlo. Validar primero el reemplazo y ejecutar la operación completa; ante producto inexistente o incompleto no destruir silenciosamente el pedido. La nota «bien fría» tampoco sobrevive en el combo reconstruido.
8. **Tamaño de gaseosa y teléfono mal clasificados —79–112.** Rechazar400ml y pedir1.5L activa preguntas sobre qué plato cambiar. Se reinicia. Más adelante un teléfono se interpreta como edición de unidades. Dar prioridad al tamaño explícito, distinguir rechazo de oferta de modificación del carrito y tratar el contacto como contacto. No anunciar «añadido» si falta una elección obligatoria. Aparecen opciones `**`: revisar también calidad del catálogo/formato.
9. **Direcciones y referencias —1–19,269–292,326–329,488–500.** Una referencia de conjunto/casa reemplaza la calle ya dada. Una abreviación con ceros se rechaza frente a una numeración aparentemente equivalente del mapa; una dirección enviada entre mensajes necesita repetirse. Separar calle y complementos, normalizar sin cambiar números y conservar datos recibidos durante otra pregunta. El export no acredita la coordenada real: un rechazo del mapa no es automáticamente un fallo.

## Medios: fricción y claridad

- 44–55: consulta de bandeja recomienda otra presentación; pide aceptación antes de comprar, lo cual evita una mutación indebida, pero obliga a reformular.
- 386–399: descripción del arroz que viene con medio pollo devuelve arroz sencillo; nombrar el combo explícitamente recupera el pedido.
- 460–474: petición cortés de menudencia se ignora inicialmente; `confirm,ar` no cierra y vuelve a «¿algo más?». Finalmente informa que falta confirmar y `sí` registra. No fue pérdida definitiva, sí pasos innecesarios.
- 14–16: `contraentrea` necesita selección numérica. 372–375: `pimer` no identifica el primer churrasco; reformular sí.
- 199,210,313: fragmentos redundantes del nombre del plato terminan como notas de cocina. Deben excluirse sin borrar preferencias reales.
- Mondongo vendido y después no disponible puede ser cambio de stock. Domicilio a7.2km puede depender de la cobertura efectiva. Auditar configuración antes de declararlos errores.
- Mensaje475 contiene una previsualización codificada y478 indica audio omitido. Sin originales no se evalúa fidelidad de audio/visión ni se atribuye al bot una transcripción inventada.

## Qué salió bien

- 56–66: sobrebarriga, pollo y jugo en agua llegan al recibo con selección correcta.
- 145–155: pedido de cinco productos en varias líneas conserva productos y presentaciones.
- 183–195: dos combos conservan Coca Cola y la papa francesa adicional se registra aparte.
- 255–264: «pollo frito en combo con coca cola zero» funciona con arroz y plátano adicionales.
- 297–300: pedido compuesto con combo, domicilio y Nequi llega a confirmación sin perder los datos.
- 301–311: cuatro ajiacos conservan cantidad tras corregir dirección.
- 488–500: arroz→«en combo con ginger» sí sustituye correctamente el producto, aunque necesita repetir dirección.
- Efectivo/transferencia, varios cambios de teléfono y aceptaciones como `yes` funcionan en múltiples recorridos. Hay capacidad útil; falla especialmente la composición de acciones y la continuidad entre turnos.

## Orden de corrección y regresiones

1. Selecciones pendientes: «ambos», stock cambiado, carrito cambiado, interrupciones y cierre posterior.
2. Cantidades y ráfagas: encabezados/repartos, compras aplicadas una sola vez, corrección de exceso y cortesías sin productos fantasma.
3. Modificar/eliminar/reemplazar: conservar líneas, cantidades y notas; cambios compuestos completos o aclaración segura.
4. Opciones y notas: bebida incluida frente a adicional, variantes pendientes, alcance compartido y preferencias por unidad.
5. Dirección/contacto y errores de escritura: conservar contexto y volver al paso pendiente.

El corpus `whatsapp-chats-0111-regressions.json` registra escenarios, evidencia e invariantes. Los escenarios planificados no se cuentan como pruebas aprobadas. La suite339 reproduce el primer grupo con router completo y servicios externos simulados; consultar la evidencia339 para resultados y límites. Las demás incidencias no se declaran corregidas por aprobar ese grupo. No subir chats crudos ni datos de contacto a Git.

## Validación del primer grupo

Tanda339:51 controles nuevos aprobados; baseline16/16 fallaba. Global33150 pruebas/406 suites, inventario exacto y623 fuentes congeladas. TypeScript general/build y scripts aprobados. Evidencia whatsapp-batch-339-{sources,global-sources,validation,patterns}. La secuencia histórica completa no se reprodujo literalmente; se corrigió la falta de resolución de «ambos» y se comprobó la eliminación de esa selección y un cierre único. Pendiente desplegar staging339; runtime anterior338. Los otros fallos siguen abiertos.
