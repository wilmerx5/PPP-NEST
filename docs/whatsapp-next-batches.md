## Continuación autónoma y siguiente matriz — 18/10/2026

Automatización horaria activa en este hilo: continuar-pruebas-de-ppp-en-staging. Una tanda gratuita por despertar;no inferencia pagada/Meta/órdenes externas;no editar si hay una validación o trabajo en curso. Mantener staging/Main según AGENTS. Notificar cierre verificado,fallo importante o dependencia humana;silencio si no hay cambio accionable. Autorizada por usuario ocupado y permiso explícito para continuar siguientes tandas. No requiere un nuevo «continúa» por cada tanda.

Tanda actual en validación:57regresiones nuevas de opciones+nota para el mismo subconjunto,proyección y compras distribuidas por variantes. Un turno reservado de Bowl Andino con Sol6.1 real pasó(3requests);su traza quedó capturada y reproducida gratis. Ver estado en WHATSAPP-LOCAL-NEXT-AGENT.md y whatsapp-joint-subset-validation-1810.json;no asumir despliegue hasta su cierre.

Siguientes tandas, en este orden:
0. Primero reproducir propuestas parciales del modelo en un reparto:pedir4en2+2pero el modelo solo llamaadd_itempara2,omiteungrupo,falla la API después del primer grupo o propone3+2. La propiedad a demostrar es suma y alcance iguales al reparto completo,o carrito intacto con aclaración. Es un hueco propuesto por revisión del contrato,no un fallo reproducido todavía. Usar metadatos purchaseAttempts reales,errores de agente y varios menús. No confundir mocks que ya entregan la respuesta correcta con precisión lingüística. Cantidades0,11,99,fraccionarias no deben ajustarse silenciosamente. Si se demuestra pérdida parcial,priorizar su arreglo antes de más variaciones de lenguaje.
1. Corrección/borrado de notas:«sin sal→normal»,«quita la nota de dos»,«la cebolla sí,la sal no»,confirmaciones ambiguas. Definir contrato explícito de añadir/reemplazar/borrar antes de ampliar;no concatenar instrucciones opuestas. Menús de pizzas,desayunos,platos,panes y bebidas. Comprobar resto y DTO.
2. Compra por variantes durante nombre/teléfono/dirección/pago/confirmación. El cambio parcial existente ya tiene recorridos;la compra nueva distribuida aún requiere matriz de aceptación en esos pasos. Evitar que «placedOrderOnly» convierta una compra clara en repetición de pago o parsers independientes.
3. Cantidades distribuidas inconsistentes:total4con grupos2+3,grupoomitido,«uno igual»,cantidad0,negación de una variante. Contrastar suma y alcance,clarificar sin partes si no concuerda. Separar evidencia de interpretación real del modelo y controles con propuesta simulada.
4. Referencias a filas después de separar:ordinales,nota única,«los otros»,rectificación de rectificación,repetición en otro turno,opciónyaelegida. No seleccionar restante automáticamente.
5. Conversaciones reservadas completas con menús nuevos y lenguaje libre;medir errores,costo y latencia. La automatización usa pruebas gratuitas;inferenciapagadacontrolada corresponde a una ejecución activa bajo presupuesto registrado. No declarar piloto/venta por conteos.

## Próxima matriz después del origen de variantes — 18/10/2026

Tanda local actual: no-op conserva intención; repetición tras partición no altera el resto por defecto; una fuente ambigua invalida todos los grupos. Ver whatsapp-unit-option-followup-validation-1810.json y estado vigente en WHATSAPP-LOCAL-NEXT-AGENT.md. No asumir desplegado hasta cierre allí.

1. Opciones + nota sobre el mismo subconjunto: cuatro hamburguesas, dos sin cebolla y con otra bebida; tres bentos, uno sin salsa y con arroz distinto; dos menús, uno con nota de alergia. Verificar unión del grupo, resto intacto, precio, respuesta y DTO final. Aclarar si el alcance no está definido; no ampliar automáticamente la nota a todos.
2. Compra nueva distribuida: “cuatro, dos A y dos B”, con atributos compartidos y luego específicos. Variar catálogos de jugos, menús, sushi y panes. Cantidad de paquete dentro del nombre no equivale a multiplicador del carrito.
3. Referencias después de separar: “de las dos originales cambia una”, ordinales de fila, dos referencias simultáneas, negaciones, “las otras”, repetición literal, corrección de la corrección. Los casos que hoy piden aclaración deben permanecer sin mutación hasta una fuente verificable.
4. Reanudar pasos pendientes: nombre/teléfono/dirección/pago, con consulta de precio, carrito, horario o ingredientes antes de responder el dato. Jamás registrar una pregunta como nombre ni duplicar productos.
5. Reservar conversaciones nuevas sin usarlas para ajustar reglas; comparar respuesta, carrito y estado, no solo clasificación. Inferencia moderada con presupuesto registrado antes de red. No WhatsApp externo ni órdenes reales sin verificar aislamiento.

Entrada al piloto supervisado: global reproducible sobre fuente congelada, prueba reservada de modelo real, revisión de costo por conversación y latencia, correcciones sin pérdida de carrito, configuración efectiva auditada y acompañamiento humano disponible. Los conteos de regresión por sí solos no acreditan preparación comercial. Continuar efectivo/transferencia, Main solo con instrucción explícita.

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

190focalizadas definitivas y TypeScript verdes /tmp/ppp-unavailable-active-cart-distribution-accepted-targets-1710.log y /tmp/ppp-unavailable-active-cart-distribution-tsc-1710.log. Ahora congeladas358fuentes en /tmp/ppp-unavailable-active-cart-final-source-1710.json. Global definitiva EN CURSO /tmp/ppp-unavailable-active-cart-final-global-1710.log. Esperar footer,comparar mapa exacto,registrar y solo entonces publicar/deploy agrupado con ubicación5014f250. Informe whatsapp-unavailable-active-cart-validation-1710.json conserva primera global fallida.

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

## Próxima tanda reservada: etiqueta de ubicación — pendiente

No implementada ni acreditada por la suite actual. Primero separar destino de presentación: usar nombre/dirección del pin si existe; si solo hay lat/lng, mostrar «Ubicación compartida», conservar pin y enlace para logística. El usuario pide legibilidad, no es necesario añadir un LLM ni bloquear el pedido por geocodificación inversa. Si se añade lookup postal, cachear y medir latencia/costo; fallo o dirección ambigua conserva el pin, no confirma número de casa inventado. Revisar la transición actual que guarda el pin con state=building_cart: una corrección de ubicación durante pago/confirmación debe conservar productos y pago y retomar checkout.

Casos previstos: pin con nombre; pin con dirección; pin solo coordenadas; URL q lat/lng codificada (%2C); dos pines sucesivos; sustitución de dirección textual por pin; pin durante pago; pin durante confirmación; etiqueta inversa cercana sin puerta; calle lejana/incoherente; timeout; falta de clave; fuera de cobertura; invalid lat/lng. Comprobar salida legible, coordenadas/ruta preservadas, ningún cambio de productos ni compra/confirmación implícita. Esta lista es planificación, no tests ejecutados.

## En validación: opciones de algunas unidades y porciones normales — 17/10/2026

Base b062d801.76 casos nuevos:48 edición parcial+límites,4 conservación de otros atributos/productos,9 compra con preferencia de tamaño,8 aceptación de porciones normales,7 fronteras de catálogo. Baseline:48/48 edición parcial fallaban;9/9 preferencia y8/8 continuación normales fallaban. Primera corrección36/48 verdes;12 expectativas de carrito asumían que una dirección ya confirmada no avanzaba automáticamente, corregidas para conducta vigente. Focalizadas48 edición y65 familias iniciales verdes; validación ampliada en /tmp/ppp-options-portions-final-targets-1710.log. Todavía no desplegado. Main intacta. Sin llamadas pagadas ni Meta/órdenes externas;181/183.

Se divide una línea por cantidad explícita, se conservan resto/opciones/notas/precio y se muestra cada grupo. Repetir tras división pregunta sin mutar las unidades restantes. Porciones con «bien grandes» y sin otro tamaño configurable se añaden con aclaración de tamaño habitual. «Sí, dame las 3 ensaladas normales» no vuelve a pedir cantidad. Gramática acotada: no afirmar comprensión universal, transcripción validada ni aislamiento multitenant.

Nueva petición de ubicación: el cálculo actual con coordenadas omite geocodificación inversa, por eso no devuelve etiqueta postal. Próxima tanda: presentación «Ubicación compartida»/nombre recibido y, si procede, geocodificación inversa con caché y fallback, conservando pin exacto y sin presentar dirección aproximada como exacta. Aún no implementada. Siguiente también: aprobación+edición/compra en un turno.

## Cierre aprobación compuesta — 17/10/2026

Global aprobada:78 suites/8144 pruebas,632.76s.356 hashes idénticos;937 focalizadas,TypeScript y72 contratos Node verdes. Validado, todavía no desplegado. Main intacta. Próximo: cambios de atributos de solo algunas unidades; luego tamaños no configurados expresados como preferencia, sin doble respuesta contradictoria.

## En validación17/10: contrato compartido de aprobación

98 nuevos (72recorridos completos con orden simulada+26contratos puros),937focalizadas, TypeScript y72contratos Node verdes. Global EN CURSO /tmp/ppp-compound-approval-global-1710.log;356fuentes congeladas en /tmp/ppp-compound-approval-source-1710.json. Ver whatsapp-compound-approval-validation-1710.json. No editar fuente hasta cierre y hashes.

No despliegue por esta tanda; agrupar con siguiente. Runtime último verificado a9693ea1. Main intacta. Cero API/Meta/órdenes externas;181/183 intacto. No repetir global tras cambios solo documentales.

Siguiente bloque prioritario: aprobación+edición/compra en el mismo mensaje. Una cláusula «lo confirmo» no acredita que se hayan aplicado las otras acciones; no enviar el carrito viejo. Probar cambios antes/después de aprobación, consulta intercalada, mismo SKU nuevo frente al existente y varias variantes. Después reemplazo de notas contradictorias. Mantener casos nuevos reservados del modelo/medios separados del desarrollo; no declarar piloto por conteo.

## Saludos, carta y confirmación — validado y desplegado17/10

78casos nuevos.839focalizadas, TypeScript,72contratos Node y global77suites/8046tests aprobados en616.486s;354hashes intactos. Informe whatsapp-basic-greeting-confirmation-validation-1710.json. Primera global interrumpida antes de ampliar ETA, no acreditada. «Me puedes pasar la carta»/«menú completo» son consulta; «Confirmo?» no aprueba; «si confirmo…cuánto tarda» no crea orden; «lo confirmo, cuánto tarda» sí aprueba y responde ETA. Main local no tiene manejador de carta, se conserva sin promoción.

Plan vigente al principio de WHATSAPP-COMMERCIAL-READINESS-PLAN.md. Deploy agrupado a9693ea1 verificado healthy17/10 20:07 Bogotá, incluye parcial eec87f78; imagen y guards/modelos compilados verificados. Rollback before-a9693ea1. No reconstruir por cierres documentales ni repetir global sin cambio. Después: preguntas compuestas/citas de autorización (nueva familia pendiente), edición+compra nueva y notas contradictorias, muestra nueva del modelo/medios, piloto supervisado por puertas. Cero API/Meta/órdenes externas;181/183 intacto.

## Tanda17/10: subconjuntos de unidades durante checkout

56 nuevos casos;191 focalizadas, TypeScript y72 contratos Node verdes. Global77 suites/7968tests aprobado en1115.764s,354 hashes intactos; /tmp/ppp-partial-checkout-global-1710.log, ver docs/whatsapp-partial-checkout-validation-1710.json. Esta tanda NO está desplegada; agrupar con siguientes reglas. Main intacta.

Próximo bloque concreto, después de validar/publicar:
- Carrito contiene1plato: «el que tengo sin salsa y agrega otro normal» →2unidades, solo la anterior con nota. Probar en2catálogos con opciones, durante carrito y pago.
- Mismo mensaje menciona un plato existente y otro fuera de carrito: conservar ambos significados; si no se puede separar con seguridad, pedir aclaración sin ejecutar compra parcial.
- Dos variantes del mismo SKU: no elegir la primera. Pedir sabor/variante o referencia de línea, luego modificar solo las unidades indicadas.
- Retirar/reemplazar preparación previa: «mejor con arroz» después de «sin arroz» no debe dejar instrucciones contradictorias en la misma línea.
- Conversación completa nueva: compra, consulta interrumpida, cambio, dirección, pago y confirmación; aserciones sobre respuesta y payload final, no solo cantidad de tests.

Mantener fixtures de menús sintéticos y modelos simulados separados de contraste real. Con2requests operativas disponibles no lanzar runner que necesite más herramientas de las que permite el saldo. No borrar contadores ni atribuir resultados de mocks a precisión de audio/visión/modelo real. Priorizar un contraste acotado al cerrar varias reglas.

## Tanda validada17/10: enumeraciones y preparación compartida

100 casos nuevos aprobados de forma focalizada; global77 suites/7912 tests aprobado,354 hashes intactos; ver docs/whatsapp-enumeration-notes-validation-1710.json. Validación cerrada y hashes idénticos; código1e2d09d7 desplegado en staging, healthy. No repetir global ni rebuild por el cierre documental. El cambio de preparación de dos platos ya presentes no debe crear nuevas unidades ni cobrar porción de acompañamiento. Lo que no identifica destinatarios debe aclararse antes de confirmar. Se conserva el tercer plato y su nota.

Siguientes tandas:
1. Varias unidades en una línea: «dos de los tres sin arroz» requiere partición de unidades sin cambiar total; probar también dos variantes/notas del mismo SKU para impedir selección silenciosa.
2. Mezcla de edición y nueva compra: «el que tengo sin salsa y otro normal» debe conservar lo anterior y añadir exactamente uno. Cubrir un producto mencionado fuera del carrito; no editar parcialmente ni perder el nuevo.
3. Retiro/corrección de preparación: cambiar una nota anterior sin conservar instrucciones contradictorias; distinguir quitar una nota, retirar una selección y cancelar todo el pedido.
4. Mensajes separados y ráfagas: platos, nota y dirección en entradas distintas; persistencia y respuesta de cada turno sin mutaciones duplicadas. Mock del transporte primero; no órdenes reales.
5. Contraste acotado del modelo real con el saldo registrado (2requests operativas disponibles): seleccionar un caso nuevo y registrar intento antes de red. Detener al fallar, reproducir gratis y no gastar en fallos artificiales.

No considerar el conteo de tests una medida de porcentaje vendible. Para piloto: cerrar regresiones críticas conocidas, verificar versión desplegada y ejecutar conversaciones completas nuevas con carrito/respuesta coherentes. No ampliar a pagos/cocina mientras la prioridad del usuario sea comprensión.

## Prioridad nueva: enumeración y uno-de-cada — 17/10/2026

Usuario aporta chat18:20: tres sopas una de cada, dos sin arroz papa salada; repite, lista «un ajiaco, menudencia y un mondongo», se agrupan dos como alternativas; «1 y2» no añade ambos. Reproducir en código actual, pues el chat es previo al deploy95cba2c7 verificado18:23. Añadir otras categorías/cartas: enumeraciones con cantidades omitidas, uno-de-cada solo si conjunto inequívoco, selección plural desde lista, notas para dos de tres sin inventar cuáles. Primero no perder productos ni cantidades; pedir aclaración concreta cuando falte dueño de nota.

Lote anterior ya desplegado95cba2c7 y saludable; ver docs/whatsapp-pending-owner-validation-1710.json. No reconstruir por documentación. Presupuesto181/183 intacto.

## Propiedad de selección pendiente — validado; deploy agrupado en preparación — 17/10/2026

Ver docs/whatsapp-pending-owner-validation-1710.json:74 casos nuevos,68 recorridos completos con orden simulada;246 focalizadas +51 controles de catálogo/agente; global77 suites/7812 Jest, TypeScript y72 contratos Node verdes. Sin inferencia181/183. No atribuirlo al runtime hasta verificar el deploy del lote acumulado.

Siguiente por riesgo:
1. Cart-edit junto a pendingAddOffer/pendingSideSwap/multi; varias compras pendientes a la vez. Referencia vaga no elige dueño; no ofrecer una orden de retirada que no tenga ruta para esa estructura. Empezar por contrato y reproducción gratuita.
2. pendingMatch informativo no es una compra; comprobar que consultar y retirar un cambio no elimine información ajena ni compre por accidente.
3. Completar otras ediciones (cantidad/opción/reemplazo) con selecciones independientes. Solo eliminación quedó acreditada por los nuevos chats completos.
4. Después del deploy, contraste real acotado por contador operativo antes de red; quedan dos. No lanzar full histórico ni confirmar/cancelar órdenes externas.

## Mensajes mixtos de cancelación y acción independiente — 17/10/2026

Validado SIN desplegar. docs/whatsapp-mixed-cancel-validation-1710.json:70 casos nuevos (56 recorridos hasta orden simulada,10 de alcance/eliminación, cuatro cantidades por catálogo en pago);145 focalizadas,77 suites/7738 Jest, TypeScript y72 contratos Node verdes. Global inicial interrumpida para ampliar pruebas; solo final acredita aceptación. Cero inferencia;181/183 intacto. Último runtime verificado1c4d98a9; agrupar cambios antes del siguiente deploy.

Próximas prioridades:
1. Edición cart-edit + compra/opciones pendientes: referencia vaga debe aclarar dueño; retirar explícitamente una sola intención y resolver la restante sin perder carrito/checkout.
2. Composición fuera de cancelación: consulta informativa +cambio/opción/compra, incluida condición desconocida. Asegurar respuesta y mutación independiente sin depender de puntuación.
3. Contrato de consulta +nueva compra después de orden registrada. La ruta mixta actual excluye completed/closed; no acreditarlo por los tests de preguntas puras posteriores a registro.
4. Desplegar el lote acumulado con rollback/imagen/health y luego contraste real limitado al saldo operativo, reservado antes de red. Nunca confirmar/cancelar órdenes externas sin aislamiento.

## Cancelación del pedido completo — validado, pendiente de despliegue — 17/10/2026

Ver docs/whatsapp-whole-cancel-validation-1710.json:68 casos nuevos;83 focalizadas,77 suites/7668 Jest, TypeScript y72 contratos Node verdes. Código nuevo en staging; runtime todavía1c4d98a9. No reconstruir por rutina: agrupar siguiente ajuste. Cero inferencia;181/183 intacto.

Siguiente por riesgo:
1. Consulta o condición de cancelación + compra/cambio independiente en el mismo turno. No basta preservar todo si pierde la acción positiva; definir salida y estado antes de implementar.
2. Una edición cart-edit junto a compra/sustitución pendiente: referencia vaga no elige dueño por orden de campos. Resolver explícitamente y retomar flujo.
3. Continuaciones naturales de cantidad/opciones/reemplazo; no confundir matriz sembrada con chat completo.
4. Contraste modelo/canal limitado al saldo operativo restante, contabilizado antes de red. No confirmar ni cancelar órdenes externas.

## Lenguaje de cancelación que no es una orden — 17/10/2026

Tanda validada y desplegada como 1c4d98a9: docs/whatsapp-cancel-language-validation-1710.json. 88 casos nuevos (72 de nueve formas no operativas y16 controles afirmativos, dos cartas, pago/confirmación y agente simulado on/off);356 focalizadas pasan; global final 77 suites/7600 pruebas, TypeScript y72 contratos Node aprobados, despliegue y salud verificados. Baseline48 fallos:44 respuestas que ignoraban la intención y cuatro pérdidas de estado final; el carrito y la edición estaban conservados antes de esas aserciones. No acreditar que el bot hubiera cancelado todo ni que72 casos fueran rojos inicialmente.

Siguiente por riesgo:
0. Revisar cobertura de preguntas sobre cancelar el pedido completo (antes/después de registrar): preguntar «¿puedo cancelar el pedido?» no debe ejecutar cancelación. La búsqueda textual inicial no encontró recorridos con esa frase; auditar las suites antes de afirmar ausencia total. Probar con órdenes y efectos externos simulados, sin cancelar pedidos reales.
1. Una edición de carrito y otra compra/sustitución pendientes: «ese cambio» debe pedir dueño, no cancelar la primera estructura encontrada. Resolver luego una instrucción explícita y retomar checkout sin perder el resto.
2. Retención y consultas de cancelación para cantidad, opciones y reemplazo con sus continuaciones naturales; la matriz nueva se centra en eliminación. Variar los textos con nuevas muestras, no solo cambiar nombres de producto.
3. Pregunta o condición más una acción independiente afirmativa: contestar la consulta sin perder la compra/edición explícita ni ejecutar la condición. El helper actual es deliberadamente estrecho y no acredita esa composición.
4. Contraste nuevo del modelo y canal con límites antes de red. Dos solicitudes restantes en el tope vigente181/183; no ejecutar el histórico completo sin acotar inferencia. No confirmar órdenes externas.

## Tras retirar una edición pendiente — 17/10/2026

Tanda validada y desplegada como 22042562: docs/whatsapp-withdraw-edit-validation-1710.json, 84 nuevos casos: 72 continuaciones naturales desde checkout ya sembrado y 12 controles con varias ediciones sembradas. Baseline56 fallos/16 verdes;268 focalizadas pasan después del ajuste. Global final: 77 suites/7512 pruebas aprobadas; despliegue y salud verificados. Solo se cancela la intención pendiente, conservando el carrito; no hay historial de deshacer cambios ya aplicados.

Siguiente:
1. Condiciones y negaciones alrededor de la renuncia: no cancelar por una pregunta, frase citada o «no canceles ese cambio». Comprobar datos y respuesta, no solo estado.
2. Una edición de carrito junto con otra selección de compra/sustitución pendiente: referencia vaga debe pedir dueño; una instrucción explícita debe retirar solo su alcance. No asumir cubierto por dos claves cart-edit.
3. Distinguir «déjalo como estaba» antes de aplicar frente a después de aplicar. Sin evidencia de versión anterior, no inventar rollback ni decir que se revirtió. Diseñar contrato antes de implementar undo.
4. Contraste de conversación nueva con modelo real y límite de solicitudes antes de red; canal firmado acotado después, sin confirmar órdenes externas. Presupuesto vigente181/183: no lanzar un runner amplio con dos restantes.

## Continuación tras aclaraciones de edición — 17/10/2026

Tanda validada y desplegada como7cdbc597: `whatsapp-pending-edits-validation-1710.json`: 48 continuaciones desde checkout sembrado con dos líneas del mismo SKU, notas distintas y un adicional ajeno; total, carta, afirmación sin seleccionar, elección por número/nota y una sola orden simulada. Otros16 casos prueban directamente la frontera central de confirmación para cuatro tipos de edición, firma válida/vieja y agente simulado on/off. No equivalen a16 chats completos.

Se detectó en baseline: ocho recorridos durante pago daban otro prompt de pago en lugar de pedir la línea; ocho durante confirmación final creaban la orden al responder Si sin elegir línea. La protección ahora debe impedir confirmar cualquier edición pendiente y mostrar su selección. Global final77 suites/7428 pruebas aprobadas; despliegue y salud verificados. La global anterior de16 fallos de respuesta al cancelar reemplazo está conservada como fallida y corregida; no confundir con la final verde.

Siguiente por prioridad:
- Contrato para renuncia explícita con una edición pendiente: guardar el mismo carrito, retirar solo esa edición, conservar pago/dirección/nombre y volver a mostrar el paso de checkout sin crear orden. Tras consultar el total, una confirmación nueva debe poder finalizar una vez. Si hay varias ediciones, pedir cuál cancelar; no borrar todas por una referencia vaga. Distinguir renunciar a la eliminación de cancelar el pedido entero.
- Renunciar al cambio: «no quites nada», «déjalo como estaba», «olvida ese cambio» debe cancelar la edición pendiente sin cancelar el pedido ni impedir confirmarlo después. Probar con consulta de precio entre la renuncia y la confirmación.
- Ediciones de cantidad/atributo/reemplazo con la misma secuencia natural completa que eliminación; las pruebas de frontera central actuales solo acreditan no crear orden con metadatos pendientes.
- Varias listas abiertas o firma antigua: no ejecutar índice sobre otra lista; instrucción explícita nueva debe permitir salir del pendiente y continuar.
- Contraste nuevo con modelo real tras cerrar lo determinista, con contador antes de red y límite explícito; después canal real acotado sin confirmar órdenes externas.

## Siguiente puerta tras ráfagas completas — 17/10/2026

Tanda validada y desplegada como77b2bf9f: 12 recorridos completos por la cola pública (dos cartas ficticias, agente simulado on/off, confirmación con pausas 0/400/3400ms); 24 cruces de consulta de total + eliminación de fila en ambos órdenes; 16 controles de alcance de vaciado. Evidencia vigente `whatsapp-complete-burst-validation-1710.json`. La primera reproducción de ocho cruces vació todo el carrito: no era problema del modelo sino alcance de reglas. Global77 suites/7364 pruebas aprobadas; despliegue y salud verificados en el informe.

Próximas tandas por riesgo, sin multiplicar combinaciones que no cambien comportamiento:
1. Consulta + edición ambigua en ráfaga: dos líneas del mismo SKU con notas distintas, eliminar por nombre; debe pedir dueño y conservar ambas hasta aclarar. Probar selección posterior y consulta de precio entre medias.
2. Operaciones de alcance distinto: eliminar una unidad frente a una línea completa; cantidad repartida por atributo; conservar productos ajenos. Preservar el total correcto durante pago/confirmación.
3. Cambios de decisión: no eliminar, no cancelar, cambiar de dirección y luego corregirla; no ejecutar verbos citados en una pregunta. Separar instrucciones afirmativas de hipótesis/condiciones.
4. Contraste vivo nuevo con catálogo ficticio y proveedor, contador de solicitudes antes de red, parada al primer fallo. Techo operativo restante2 no basta automáticamente para una conversación con bucles de herramientas: presupuestar explícitamente sin reiniciar contadores. No llamar al proveedor para fallos que ya son deterministas.
5. Canal: ráfaga firmada de varios IDs, persistencia exactamente una vez y respuesta Meta entregada, conservando protección de actividad humana. La prueba menu-only entregada no acredita una conversación de pedido ni ráfagas. No ejecutar full histórico sin acotar inferencia; no confirmar órdenes externas.

Criterio de avance: carrito, estado, respuesta y DTO de orden coherentes en cada turno; no basta verificar el carrito final. Mantener prueba básica recurrente y modelos efectivos iguales entre entornos cuando se promocione explícitamente. Main no se modifica por estas tandas.

## Control recurrente de conversaciones básicas — 17/10/2026

Petición vigente del usuario: repasar chats completos sencillos durante el desarrollo, además de las familias complejas. Repetir este control cuando cambie la lógica de intenciones, direcciones o checkout. No ejecutar una global por cambios exclusivamente documentales.

```bash
npx jest --runInBand --silent --testPathPattern=whatsapp-general-accuracy --testNamePattern='basic complete ordering journeys revisited|concrete delivery setup after a basic order|Cobertura con carrito|Después de cobertura|post-order courtesy preserves terminal state'
```

El bloque básico contiene ocho conversaciones completas en dos cartas ficticias, recogida/domicilio y ambos modos de agente simulado. Cada una pasa por saludo, compra con nota, precio, cambio de opción incluida con adicional, eliminación de una línea, destino, consulta mientras espera pago, pago, confirmación y cortesía. Comprobar también el DTO de la orden, estado terminal y creación única. Otras ocho pruebas varían el prefijo de domicilio.

Antes de un candidato de piloto: añadir una conversación completa nueva y recuperar un chat real antiguo que falló; alternar carta y redacción. Conservar los controles negativos: preguntar cobertura no elige dirección, preguntar precio no compra, una cortesía no abre otro carrito y una compra explícita nueva sí puede abrirlo. Si un repaso encuentra un fallo, clasificar la capa y reproducirlo gratis antes de pagar inferencia. Los mocks no acreditan calidad del modelo ni del canal real.

# Próximas tandas de comprensión de WhatsApp

Fecha: 2026-10-11. Rama permanente: staging. Usar AGENTS.md y el relevo. Este plan describe pruebas, no acredita que el producto sea vendible.

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

## Tanda de pedido grande, fecha y abono — 11 de octubre

Once casos originales adicionales, dos catálogos, dependencias externas simuladas. Consultar rendimiento no compra ni inventa cuántas personas comen; solamente usa datos numéricos escritos en descripción. Abono/anticipo se coordina con el local y no modifica pago/cart. Compra explícita referida de diez cajas conserva un único producto previo; si hay carrito u otro pendiente pide aclaración. Fechas y comensales no son direcciones. Recorrido con arroz, miércoles, abono, mediodía nativo y reparto 5/5 aprobado en la revisión focalizada. Copia de respuesta más horario solo se separa con fuente Bot reciente verificable; fuente no encontrada pide aclaración sin comprar su contenido.

Verificación: 62 suites y 1.519 pruebas aprobadas en dos grupos (43 WhatsApp/1.421 + 19 restantes/98), TypeScript sin errores. Código `46a4f1bf` desplegado y verificado healthy el 2026-10-11; evidencia en el relevo. Sigue pendiente fechas/horas adicionales, negación/intervalos de rendimiento, opciones desconocidas/múltiples atributos en reparto y otras intenciones nativas. No se incorpora reserva o abono automático ni se cambia política del piloto. Cero llamadas pagadas.

## Histórico: respuestas nativas y reparto — 11 de octubre

Nueva cobertura: referencias a mensajes salientes por ID de Meta, límites por conversación/línea, referencias no recuperables o ambiguas y ausencia de compra por cantidades en la cita. Textos bot nuevos guardan ID; mensajes históricos sin ID y medios/humanos no quedan acreditados. Cambios por opción citada solamente cuando el carrito ya existe y no hay selección pendiente.

Reparto de diez unidades por atributo: 5/5 del mismo producto, tanto preparación pendiente PPP como base de bowl en otro catálogo; conservar notas, cantidades, otro plato y estado. Suma incorrecta o varios referentes requieren aclaración. Preguntar rendimiento para veinte personas no implica comprar veinte unidades.

La tanda no acredita todavía el recorrido completo con rendimiento, abono, fecha y texto copiado. Los próximos casos deben medir todo el recorrido y respuesta, no solo el carrito final. Verificación local: 62/62 suites, 1.508/1.508 pruebas y TypeScript sin errores. Cero llamadas pagadas. Publicado y desplegado `91cd9a67` en staging, API healthy y DB connected.

## Fuentes públicas revisadas

- [MultiWOZ 2.2](https://github.com/budzianowski/multiwoz/blob/fe0c8e65cfcd8462bd33c86e35f21addc84ca82b/data/MultiWOZ_2.2/README.md). Revisión fe0c8e65cfcd8462bd33c86e35f21addc84ca82b; licencia MIT. Se inspeccionó dev/dialogues_001.json: 512 diálogos, 220 con servicio de restaurante; IDs de referencia PMUL0698.json y MUL0242.json. Útil para consultas sucesivas, restricciones y cambios de objetivo. Son conversaciones de un benchmark de tareas, no pedidos reales de PPP.
- [Schema-Guided Dialogue](https://github.com/google-research-datasets/dstc8-schema-guided-dialogue/tree/e852981ae34990f4358979625854259302feaa78). Revisión e852981ae34990f4358979625854259302feaa78; licencia CC BY-SA 4.0. Se inspeccionó dev/dialogues_001.json: 128 diálogos, 29 con restaurante; IDs de referencia 1_00000 y 1_00001. Útil para intención, datos de varias entidades y contexto. Su restaurante es de búsqueda/reservas; no habilitar reservas en PPP por copiar el dominio.
- [BaristaDatasets](https://github.com/birfan/BaristaDatasets/tree/02a83940e7a5d8f4435551cf94649a9f1ec3271e). Revisión 02a83940e7a5d8f4435551cf94649a9f1ec3271e. README describe conjuntos generados con plantillas y cambios de preferencias. La licencia del dataset es CC BY-NC-SA 4.0: no se incorporan sus transcripciones ni traducciones al producto comercial.

- [FoodOrdering](https://github.com/amazon-science/food-ordering-semantic-parsing-dataset/tree/82df0797d254637a06153aae13470ac14a88bf77) y [PIZZA](https://github.com/amazon-science/pizza-semantic-parsing-dataset/tree/814d6d0f0e26e9ba5c45be281fd432dc4d069b05), de Amazon Science. README y licencias inspeccionados: CC BY-NC 4.0 en ambos. FoodOrdering distingue peticiones humanas obtenidas para menús de varias categorías y datos sintéticos. Son solicitudes de pedido con anotaciones, no necesariamente conversaciones completas. Útiles para estudiar cantidades, restricciones y atributos por producto; no se incorporan ni traducen sus ejemplos al producto comercial.

Las cantidades anteriores corresponden únicamente a los archivos inspeccionados. No se descargaron datasets completos ni se ejecutó código remoto. Los casos de PPP se escriben desde cero, con datos ficticios y patrones generales; no son chats reales descargados ni traducciones de los ejemplos. No copiar datos de personas ni respuestas históricas como oráculos.

## Secuencia y resultados que debe exigir cada tanda

1. **Consulta frente a acción y canjes**. Capacidad, negación, condición, procedimiento y petición explícita; voucher suelto con carrito vacío; registro de factura explícito; código desconocido/usado/vencido/de otra cuenta. Verificar que preguntar no gaste puntos, que no se registre un voucher como factura y que no se cambien platos.
2. **Cambios de preferencias y productos**. Correcciones antes/después de resolver una variante; cambios de bebida, cocción, acompañamiento y cantidad; conservar otra línea. Menú PPP y al menos otro catálogo. No aprobar solo porque aparece una nota: revisar alcance y contradicciones.
3. **Consultas intercaladas y referencias**. Precio, tamaño, disponibilidad y total entre elecciones; «esa», «el segundo», «el de antes», «igual» con cero/una/varias opciones. Aclarar cuando falte un referente; no agregar al consultar. Incluir atributos que comparten nombre con productos.
4. **Turnos compuestos y recuperaciones**. Compra + nota + dirección + pago; aclaración posterior; no/reinicio/espera; mensajes cortados y typos. Guardar cada intención independiente, conservar cantidades y evitar inventar sustituciones, ingredientes o productos.
5. **Medios, errores y duplicados**. Álbum de varias fotos, una ilegible, reenvío del mismo ID, texto entre fotos, comprobante que no es compra. Confirmar que no se duplique ni silencie un fallo. Interpretación simulada primero; visión real requiere imágenes originales y presupuesto explícito.
6. **Casos reservados y estabilidad**. Ejecutar el archivo de casos reservados después de cerrar una tanda de desarrollo, sin incluirlo en prompts. Repetir en otro catálogo. Inferencia real: una repetición, detener ante fallo y límite dentro de nueve llamadas restantes, compartido con el resto de esta sesión. No gastar llamadas para repetir caminos resueltos gratis.

Cada tanda debe incluir casos positivos, negativos y recuperación después de una aclaración. Variar productos por estructura de catálogo; nombres, IDs y precios específicos solo en fixtures. Los cambios de producción deben ser reglas generales. Si un caso falla, convertirlo en regresión de desarrollo y reponer el conjunto reservado; no seguir llamándolo reservado.

## Forma de ejecutar sin desperdiciar

Router real, catálogo real y guard real; modelo, Meta y sistemas externos simulados. Comparar carrito, atributos, notas, estado y respuesta después de cada turno. Para canjes comparar también saldo y llamadas de mutación. No usar cuentas reales ni crear pedidos externos.

Primero suite focalizada; corregir antes de ampliar. TypeScript y suite unitaria completa al finalizar cambios compartidos. DB solo si se cambió persistencia/transacciones, con base local descartable y guard existente. En este PC ejecutar Jest completo y Jest DB en secuencia: hubo un timeout cuando ambos compitieron, cuya causa exacta no se perfiló. Conservar el fallo en el registro y repetir solo la suite afectada; no aumentar timeouts para ocultarlo.

Registrar commit, casos ejecutados, fallos, recuperaciones, tipo de modelo y gasto. Publicar/deploy staging solo con verificaciones necesarias aprobadas. Ninguna cantidad de mocks acredita por sí sola comprensión del modelo real ni producto listo para venta.

## Tanda ejecutada el 11 de octubre

30 regresiones nuevas: nueve consultas de capacidad/condición/negación, nueve peticiones explícitas de canje, dos registros de factura, un voucher válido suelto y tres vouchers usados/vencidos/de otra cuenta; seis pedidos compuestos en PPP y catálogo sintético. Inicialmente fallaron doce casos de consultas/códigos y dos compuestos. Se corrigieron las causas y las 30 regresiones pasan.

Resultado completo: 62/62 suites, 1.463/1.463 pruebas y TypeScript sin errores. Modelo y servicios externos simulados, cero solicitudes pagadas; quedan doce del límite compartido. Los ocho casos reservados siguen sin ejecutarse. Los resultados de DB anteriores están documentados en el relevo, no se atribuyen a esta tanda.

Código `adb8d582` publicado y desplegado en staging: contenedor healthy, health OK y DB connected. Verificación del 2026-10-11; documentación posterior no cambia la imagen de código.

## Tanda de correcciones y cercanía, 11 de octubre

23 regresiones nuevas: diez de referencias/correcciones/consultas con otro producto presente, cuatro en catálogo alternativo, cuatro pedidos con cercanía en PPP y otro menú, dos controles de consulta/negación y tres respuestas de horario. Se reprodujeron cuatro fallos iniciales de variantes/cocción; el catálogo alternativo añadió defectos de plurales/cantidad/cocción y un problema de compra por nombre de color. Los 23 controles focalizados finales pasan, incluidos pasta/lentejas en otro menú y consultas/negaciones. La consulta fue clasificada como descripción en vez de disponibilidad; la ruta de cercanía ahora separa todas las consultas de compras y no permite que una consulta sin resolver caiga en agregar producto. Primera regresión completa: 62/62 suites, 1.482 pruebas (antes de cuatro controles nuevos). Segunda regresión: 61 suites pasaron y una falló; 1.485 pruebas pasaron y la consulta «Tienen sopa… aquí para la vuelta» agregó un producto. Se corrige su prioridad de disponibilidad y se repiten controles y suite completa antes de publicar.

Pendientes explícitos en `scripts/fixtures/whatsapp-development-pending.json` (registro de desarrollo, no runner automático): compra de «Bowl Verde con arroz» por nombre sigue fallando; los tests de edición lo seleccionan por código. El flujo completo de diez cajas de arroz, reparto 5/5, rendimiento por personas, pedido futuro y abono está reportado por usuario, aún no reproducido completo. Horario aislado ya se comprueba; no declarar ese recorrido aprobado. El enlace nativo de respuesta de WhatsApp (`raw.context.id`) no se resuelve hoy: las pruebas históricas de texto citado no acreditan esa función.

Próxima tanda prioritaria: enlace nativo de respuesta dentro de la misma conversación (incluidos ID ausente/ajeno/viejo), producto con nombre de color, y compra para grupos preservando producto/cantidad/variantes durante consultas y horarios. Rendimiento y políticas de programación/abono deben venir de configuración, no del modelo. Cero llamadas pagadas; saldo compartido doce.

Verificación final de esta tanda: 62/62 suites y 1.486/1.486 pruebas; TypeScript sin errores. Los 23 casos focalizados pasan. Logs `/tmp/ppp-references-approved-full.log`, `/tmp/ppp-references-approved-tsc.log`, `/tmp/ppp-references-targets-approved.log`. Cero API pagada; no se repitió DB porque no se cambió persistencia. No atribuir estos resultados a los tres pendientes de desarrollo.

Publicado y desplegado `3a5e7f42` en staging, API healthy y DB connected. Imagen activa/candidate `sha256:52255c901a457e53520753345e2fd235e2521d5a149f2696915bd6662d736dd7`.

## Tanda de recuperación compuesta — 11 de octubre de 2026

Base c39cdf39, rama staging. Main se promovió al piloto en a6890c4a y el usuario informa que ya la publicó; esta tanda no modifica Main. Se ejecutaron ocho patrones anteriormente reservados con router real, catálogo/guard reales y modelo/Meta/persistencia externa simulados: primer run 4/8 aprobados, cuatro defectos. Añadidos siete controles de portabilidad y límites: 15 regresiones nuevas en total. Los ocho patrones se marcan como desarrollo, no holdout.

Correcciones generales: comparación por hechos del catálogo seguida de compra explícita separada por interrogación; conserva consulta y compra independiente. Pedidos con nota/dirección/pago separan una coma residual después de retirar el pago, evitando usar los números de la dirección como cantidad; la nota de cocina se extrae del texto del producto. Verbos agrega/agrégame/añade permiten cantidades por vocabulario del catálogo alternativo. Perdón/disculpa + cantidad + producto corrige la línea existente, conserva dirección y retoma checkout. Compra referida usa el parser común para fecha y hora; fechas/horas inválidas requieren aclaración sin comprar, no afirma reserva.

Pruebas nuevas: comparación con bebida en PPP y menú alternativo; retiro seguido de nota sobre restantes; compra con nota, domicilio y transferencia en dos menús; precio mínimo seguido de elección de tres broaster; corrección durante pago; compra referida con fecha/hora en menú alternativo; retiro por preparación; foto válida seguida de ilegible; corrección con otra bebida presente; dos horarios/fechas inválidos; consultas negativas sin compra. La compra referida se prueba con Bowl Mediterraneo sin atributos: no se atribuye aprobación al recorrido completo de arroz/medio pollo con variantes. Fotos: interpretación simulada, no visión real. La transferencia usa el ID interno transfer (el primer oráculo esperaba incorrectamente transferencia; se corrigió el montaje).

Verificación final: TypeScript aprobado (/tmp/ppp-next-batch-tsc.log); 62 suites y 1589 pruebas aprobadas en un único run completo, 314.49 s (/tmp/ppp-next-batch-full.log). Evidencias intermedias conservadas: /tmp/ppp-next-batch-baseline.log, /tmp/ppp-next-batch-fixed.log, /tmp/ppp-next-batch-portable.log y /tmp/ppp-next-batch-final-targets.log. Cero llamadas pagadas; presupuesto compartido 11 usadas / 9 restantes. Sin cambios de persistencia/esquema: no se repitió DB.

Límites pendientes: comparación y compra independiente mientras otra selección está abierta; consultas/pedidos en varias líneas; variantes + nota + domicilio + pago; correcciones con varias preparaciones coincidentes; referencia con horario, nota y domicilio en un mismo turno; foto tardía con edición intermedia. Se escriben seis patrones originales sin ejecutar en scripts/fixtures/whatsapp-reserved-followup-patterns.json; requieren semillas y expectativas por turno antes de ejecutarse. No incorporarlos a prompts ni acreditarlos como verdes. Mantener diversidad de catálogo y revisar respuesta además del carrito.

## PDF 11/10 y lenguaje hablado — tanda actual

Fuente privada de 30 páginas leída y primeras páginas inspeccionadas visualmente. No se versiona el PDF ni su extracción con datos personales. El índice sanitizado `scripts/fixtures/whatsapp-pdf-1110-patterns.json` separa patrones ejercitados de nueve pendientes: distribución por varios atributos, sabores condicionales, citas antiguas, precios históricos, recogida por tercero, estado posterior, cancelación/pago, referencias ambiguas y ráfagas.

Los tres primeros chats se reproducen con router y catálogo reales, servicios externos/modelo simulados. Oráculos: receta de sopa explícita limita candidatos; almuerzo conserva sopa/presa, nota sin ensalada y domicilio sin comprar gaseosa adicional; elegir estilo del ejecutivo no compra un pollo entero y cambiar la bebida conserva ese almuerzo. Se añaden menús sintéticos, cantidades independientes, dirección por partes, cortesías, total, cubiertos, billete para cambio, bebida ambigua entre dos platos y audio con transcripción simulada. Las respuestas históricas del local no son oráculo comercial ni acreditan disponibilidad actual.

El audio reportado se prueba con su transcripción exacta y reconstrucciones con pausas. No se dispone del archivo original: no se acredita calidad de reconocimiento de voz, solo interpretación del texto y entrada de audio simulada. Sustituciones se guardan como solicitudes en nota; no acreditar autorización comercial, precio ni cumplimiento del cambio. Cero llamadas pagadas; presupuesto permanece 11/20 usadas, nueve restantes. Main permanece a6890c4a. Trabajar únicamente en staging.

Validación final: 36 regresiones nuevas. Focalizadas 36/36; TypeScript aprobado. Suite completa de WhatsApp: 43 suites, 1.527 pruebas aprobadas en 186,908 s (`/tmp/ppp-pdf-full.log`). Complemento: 19 suites, 98 pruebas aprobadas en 12,502 s (`/tmp/ppp-pdf-other-suites.log`). Total 62 suites y 1.625 pruebas, ejecutadas en dos comandos secuenciales; no afirmar un único run de las 62. Logs focalizados `/tmp/ppp-pdf-targets-final.log` y TypeScript `/tmp/ppp-pdf-tsc.log`. Un run anterior completo fue interrumpido para añadir el control de horario del negocio; no cuenta como aprobación. Código e40f0e36 publicado y desplegado en staging. Verificado 2026-10-11 14:04 Bogotá: HEAD e40f0e362ad08c144ee32e9b15209da81e6a0fc1, running/healthy, imagen activa y candidate iguales (`sha256:055fccb70dfecc6efb2def2a51dde1c80a2d59b35b16401d10f395ec55b87a3d`), health OK, DB connected, circuito CLOSED. Logs `/tmp/ppp-pdf-deploy.log` y `/tmp/ppp-pdf-deploy-verified.log`. El commit posterior solo de documentación no requiere reconstrucción. La tanda anterior dbef6ed4 también se verificó sana antes de esta actualización; conservar su evidencia histórica en `/tmp/ppp-next-batch-deploy-verified.log`.

## Segunda tanda PDF — dinero, referencias y catálogo alternativo

Base 83e6e89b, staging. Treinta y dos casos nuevos derivados de patrones del PDF y controles sintéticos: precio histórico frente a precio vigente, cancelación frente a “cancelo con 100mil”, consultas de disponibilidad, referencias de cantidad sin producto, demora durante compra y después del pedido, preferencia de bebida condicional, dirección y plato juntos en tres menús sintéticos. Comprueba respuesta además de conservación del carrito. Presupuesto sin cambios: cero llamadas pagadas, 11 usadas / 9 restantes.

Correcciones generales: el destino explícito después de para + calle/carrera se separa antes de aceptar el mensaje completo como dirección; los productos de catálogos alternativos no quedan dentro de la dirección. “Cancelo con” + monto se interpreta como pago/cambio, sin ampliar cancelación. Preferencia condicional compara primero opción principal y después alternativa con opciones de catálogo; no inventa bebida y pregunta el plato si hay más de uno compatible y conserva el cambio elegido por candidato para retomarlo al responder, sin duplicar el plato. Una comida con solo atributo Bebida también admite elección aunque no se llame combo. Opciones de dos letras requieren contexto explícito del atributo y límites de palabra. Consulta temporal de precio usa catálogo vigente, conserva precio del carrito y aclara cuando no hay producto identificado. Referencia de cantidad con varios platos no se atribuye automáticamente al último.

Montaje y límites: el primer run tuvo errores de montaje (servicio de órdenes no simulado, monto esperado como número aunque el contrato es texto, demora genérica sin contexto configurado); no son fallos de producción. Los oráculos se corrigieron y luego se confirmaron defectos de cambio en “cancelo con”, dirección compuesta portable, preferencia principal de dos letras y precio histórico. El control inicial de sabor usaba la opción deseada por defecto: se invirtió el orden de opciones para exigir una modificación efectiva. El ETA genérico se prueba con contexto configurado y el reclamo posterior con búsqueda de órdenes simulada vacía. No acredita consulta de estado real ni cancela órdenes externas.

Pendientes del PDF: reparto simultáneo por varios atributos, citas antiguas, recogida por tercero y ráfagas concurrentes. Los casos ejercitados pasan a desarrollo, no son un holdout. Preferencia condicional cubre la estructura “si tienes con …, si no con …”; no acreditar todos los giros condicionales. Sustituciones comerciales, reconocimiento real de audio y aislamiento multitenant operativo siguen sin acreditarse.

Verificación final: 32/32 focalizadas aprobadas (/tmp/ppp-pdf-second-final-targets.log), TypeScript aprobado (/tmp/ppp-pdf-second-tsc.log). Un único run completo aprobó 62 suites y 1.657 pruebas en 188,72 s (/tmp/ppp-pdf-second-full.log). El run anterior se interrumpió para completar el recorrido de aclaración y no cuenta como aprobación. No se modifican esquema/transacciones de órdenes; se añade un campo opcional al contexto de edición de sesión, compatible con candidatos antiguos. No se repite DB. Código 842d6876 publicado y desplegado en staging. Verificación 2026-10-11 14:24 Bogotá: HEAD 842d687600d9035ea5844c8833e6fe4014299a50, running/healthy, imagen activa y candidate coinciden (sha256:598bb61ea79e689e336d7715ff1c27791d053acbcf33542470f8ce2e2dc48ac8), health OK, DB connected, circuito CLOSED. Evidencia /tmp/ppp-pdf-second-deploy.log y /tmp/ppp-pdf-second-deploy-verified.log. Commit posterior solo de documentación sin reconstrucción necesaria. Main permanece a6890c4a.


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


## Generalización entre restaurantes — tanda 2026-10-12

Base55836de3. Se añadieron15 regresiones en tres catálogos aislados (vegetariano, marino, oriental), sin productos PPP: opción y sopa incluidas + dirección; sopa adicional explícita; consulta de precio sin compra; corrección posterior que conserva cantidad/sopa/nota; opción compartida por dos líneas requiere aclaración sin mutación. IDs/nombres/opciones son fixtures, no reglas de producción. Once de doce casos iniciales pasaron; "Mejor con Ternera" falló mientras preparación/base funcionaban. Se acepta "mejor" como marcador general de corrección en resolveCartAttributeOnlyUpdate; únicamente opciones presentes y objetivo inequívoco. No añadir excepción para Ternera ni para Menu Oriental. Focalizadas23 aprobadas (15 nuevas +8 controles existentes) /tmp/ppp-catalog-generalization-final.log; TypeScript aprobado /tmp/ppp-catalog-generalization-tsc.log. Full final estable:65 suites/1.904 pruebas aprobadas en126,524s, /tmp/ppp-catalog-generalization-full.log. Cero API/Meta, presupuesto25/40,15 restantes.

Límite de evidencia: esta tanda acredita menús con atributos del catálogo, no cualquier restaurante. La protección de componentes todavía utiliza la identificación de menú nombrado (menuDishHost, tokens de menú/ejecutivo/bandeja); algunos helpers de estilos y porciones tienen vocabulario gastronómico específico. No confundir ausencia de IDs PPP con generalización universal. Próxima tanda: productos compuestos sin esos tokens (hamburguesas, pizzas, bowls), colisiones entre opción incluida y producto vendible, opciones inexistentes y atributos con precio/cambio no permitido; definir expectativas desde datos del catálogo antes de cambiar reglas. Si el catálogo no representa inclusión/precio/permisos, aclarar o ampliar contrato, no inventar equivalencias comerciales. Las consultas de precio y ambigüedades cubiertas en esta tanda no prueban todas las consultas posibles.

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

## Próximo contrato general: opciones sobre parte de una línea — propuesta, no implementada

Auditoría17/10: AiOrderAction.updateAttributes (types/whatsapp-session.types.ts) solo transporta producto,índice y atributo/valor;set_attribute (whatsapp-agent.service.ts) y el guard (whatsapp-action-guard.service.ts) construyen esa misma forma;applyCartLineEdits edita todos los atributos de la línea. La gramática temprana actual cubre algunas frases contadas, no corrige esa falta de expresividad del contrato del modelo.

Diseño recomendado a validar:una acción agrupada por línea con cantidad afectada y lista de opciones permite preparar una sola partición y evita que dos llamadas de atributo asignen implícitamente los cambios a unidades distintas. Mantener compatibilidad de la edición total existente;requerir cantidad entera1..cantidad actual,SKU/línea únicos y atributos válidos. No reutilizar quantity de update_item:ahí significa cantidad absoluta final, no unidades afectadas. Resolver contra instantánea original y validar antes de mutar;preservar resto/notas/precio. Actualizar vista provisional de get_cart de forma coherente;no aceptar índices recalculados tras partición como si fueran índices originales. Si una segunda selección parcial es ambigua,preguntar sin aplicar al resto.

Pruebas propuestas:2de4,1de3,total4de4,0,5de4,decimal,opción inválida,2atributos en el mismo subconjunto,2subconjuntos distintos,2SKUcon la misma opción,otras líneas,adición pendiente,quitar/reemplazar después de editar,rollback de edición rechazada,petición repetida y pago/confirmación. Comprobar herramienta→guard→plan→carrito→respuesta→payload final. Aprobar con consulta de precio/dirección/nueva compra debe revisar el plan completo antes de crear orden. Un guard de frase confirmatoria no acredita esto.

Después de cerrar controles gratis,contrastar una muestra reservada del modelo real con gasto acotado y contador antes de red. No iniciar una ronda amplia con las2peticiones operativas restantes ni presentar pruebas simuladas como inferencia real.


## Siguiente matriz después de integrar opciones por unidades — 17/10

No ampliar frases por producto. Reservar conversaciones completas con productos y atributos distintos, y validar respuesta, carrito, estado y orden simulada:

1. **Compra nueva frente a edición:** carrito vacío; cuatro cajas, dos con una opción y dos con otra. Crear variantes mediante add_item; no intentar partición de una adición pendiente. Controlar que las unidades sumen cuatro y no aparezcan bebidas/platos extra.
2. **Origen ambiguo después de dividir:** ya existen dos variantes del mismo SKU. «Cambia una por X» sin identificar origen debe aclarar; «de las que tienen Y, cambia una por X» puede editar la línea indicada. El índice elegido por el modelo no acredita por sí mismo que el humano haya identificado el origen.
3. **Repetición:** llamada idéntica de herramienta ya cubierta; falta ampliar repetición del mensaje del cliente en un turno posterior, reentrega del mismo ID y petición explícita de cambiar otra unidad restante. No mover dos veces las mismas unidades ni confundir una repetición con «otra más». Probar también un no-op del modelo (opción ya elegida): debe responder con claridad y conservar el carrito, sin caer al parser de compra por no tener acciones productivas.
4. **Atributos y nota en el mismo grupo:** dos de cuatro con otra bebida y sin cebolla. El contrato actual agrupa atributos; no expresa una nota nueva del mismo subconjunto ni mutaciones mixtas. Antes de extenderlo, decidir y probar la unidad de atomicidad: opciones/notas del mismo grupo deben prepararse juntas; compras independientes ya reconocidas tienen otra política y no deben duplicarse.
5. **Interrupciones:** repetir ediciones agrupadas esperando nombre, teléfono y dirección; resolver consulta de precio/tiempo sin guardar esa consulta como dato. El cierre actual se midió en carrito, pago y confirmación; no extrapolarlo a todos los pendientes.
6. **Precios:** conservar precios de origen mientras se edita; fusionar solo precios iguales. Si el menú cambió, mostrar el nuevo total y solicitar aprobación antes de crear la orden. Añadir premios/descuentos en otra tanda sin suponer que precio0 equivale a cupón válido.

Puerta posterior: ampliar evidencia reservada del modelo real con un límite explícito, una repetición y parada al fallar; hoy un solo turno real aprobado no equivale a un benchmark amplio. No iniciar inferencia por defecto ni agotar el saldo operativo en casos ya resueltos por reglas. Mantener Main intacta y desplegar únicamente después de aceptación de la fuente congelada.
