# Relevo del agente: PPP WhatsApp

Actualizado el 11 de octubre de 2026, hora de Bogotá. Leer este documento y `AGENTS.md` antes de ejecutar pruebas, editar o desplegar. Es un estado de trabajo, no evidencia de que el producto ya sea vendible.

## Objetivo y alcance acordado

Crear un agente de pedidos fiable y vendible para PPP, reutilizable después en Kamppo multitenant. El usuario quiere tandas sistemáticas de casos variados, no depender de que él descubra cada fallo por WhatsApp. Prioridad actual: comprensión de mensajes, consultas frente a compra, ambigüedad, cantidades, variantes, notas, cambios, interrupciones y checkout breve. Cocina, WebSocket, impresoras y pagos externos quedan fuera del foco actual. El piloto considera efectivo y transferencia; Mercado Pago está fuera de esta fase.

Seguir trabajando dentro del alcance autorizado sin pedir permiso otra vez para pruebas gratuitas, correcciones reversibles y despliegues rutinarios de staging. No enviar mensajes a clientes, Meta ni crear pedidos externos por accidente. El usuario autorizó usar su número y reiniciar sus pedidos de prueba, no datos de clientes reales. No inferir que staging está aislado de todas las integraciones: conservar los bloqueos existentes.

## Tanda actual: respuestas nativas y reparto por preparación

Base `060c54e4`, rama `staging`. Esta tanda guarda el ID de Meta de los textos enviados por el bot y lo vincula con `raw.context.id`. El manejo nuevo está limitado a respuestas de opciones reconocidas en el catálogo, con carrito existente y sin selección pendiente: identifica una única línea actual mencionada por una respuesta saliente de la misma conversación. No incorpora cantidades o instrucciones de la cita al pedido. Cita ausente, ajena, entrante, con producto retirado o ambigua pide aclaración. No acreditar soporte completo de «Responder»: otras intenciones, citas de medios/mensajes humanos y el recorrido programado completo siguen pendientes. Los mensajes anteriores que no guardaron ID no se recuperan retroactivamente. Referencia primaria del campo de Meta: https://www.postman.com/meta/whatsapp-business-platform/folder/hysdhqs/context-object.

Se conserva cantidad y texto original en tres rutas de preparación pendiente. El reparto explícito «Los quiero 5 con … y 5 con …» usa atributos del catálogo del producto existente o pendiente, exige que la suma coincida y guarda los cambios únicamente si todas las partes se validan. No transforma arroz con medio pollo en pollos separados; conserva notas y otras opciones. Si varios platos comparten esas opciones pregunta cuál. No elige un combo por su posición cuando el usuario pide una presentación sin combo; precio explícito sigue resolviendo sobre todas las variantes. Se prueba también otro menú de bowls.

Verificación local de la tanda, sin llamadas pagadas: 62/62 suites, 1.508/1.508 pruebas y TypeScript sin errores. Logs `/tmp/ppp-color-name-full2.log` y `/tmp/ppp-color-tsc.log`. «Cuánto cuesta?» durante una preparación pendiente cotiza ese plato y conserva la cantidad. «Un Bowl Verde con arroz» ya no cae en categoría: el color queda en el nombre y la base pedida queda como atributo. El recorrido completo de rendimiento, fecha y abono sigue pendiente. Publicación y despliegue de este código todavía no se registran en esta nota. La revisión inicial pasó 222 pruebas en dos suites antes de añadir controles. La primera completa se detuvo tras dos fallos de expectativas en controles nuevos (mayúscula de «cuál» y exigir preparación pendiente cuando la ruta de nota ya había agregado diez unidades). Se corrigieron las expectativas manteniendo controles de cantidad/notas/estado/carrito. Después pasaron 17 controles focalizados; se añadió otro para consultar precio antes de elegir preparación. No usar estos resultados para acreditar la revisión final. Cero llamadas pagadas; presupuesto compartido sigue 8/20 usado, 12 restante.

Siguiente: reproducir el recorrido entero de arroz para veinte personas, consulta de rendimiento, diez cajas, miércoles, abono, texto copiado y respuesta nativa de horario, hasta el reparto final. No inventar rendimiento ni aceptar reservas/abonos sin política del catálogo/local. Sigue abierto «Un Bowl Verde con arroz». Ver `scripts/fixtures/whatsapp-development-pending.json`. Añadir controles de repartos con opciones inexistentes, atributos múltiples y varias líneas del mismo producto; todavía no quedan acreditados. Después ampliar respuestas nativas a otras intenciones con aislamiento de conversación y preservación de estado, ejecutar conversaciones reservadas y verificar modelo real dentro del saldo autorizado. No declarar vendible por pruebas unitarias.

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

Autorización humana de esta ronda: hasta 20 intentos de API. Usados **8**, disponibles **12**. Fallos y reintentos también cuentan. Las últimas tandas de preparación, fotos y multilínea usaron cero llamadas. No sumar casos simulados a `acceptedConversations`: ese campo documenta rondas previas con inferencia real.

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
