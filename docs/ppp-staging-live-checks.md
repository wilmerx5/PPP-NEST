# Comprobación del staging desplegado de PPP

El 9 de octubre de 2026 el responsable confirmó el arranque del backend en `https://dev.prontopolloportal.com`. Las siguientes comprobaciones HTTP se ejecutaron desde el entorno de pruebas, entre las 11:58 y las 12:02 de Bogotá. No se utilizaron credenciales administrativas, no se enviaron mensajes ni se crearon pedidos. Los POST de prueba contenían únicamente `{}`.

| Comprobación | Resultado observado |
| --- | --- |
| HTTPS y `/api/health` | PASS: HTTP 200, `status:ok`, `db:connected` |
| Redirección HTTP a HTTPS | PASS: petición HTTP termina en la misma ruta HTTPS |
| Swagger `/api` | PASS: HTTP 200 |
| Settings administrativos sin sesión | PASS: HTTP 401 |
| Verificación Meta con token incorrecto | PASS: HTTP 403 |
| POST webhook sin firma | FAIL: HTTP 200; se exige rechazo |
| POST webhook con firma inválida | FAIL: HTTP 200; se exige rechazo |

El controlador permitía recibir mensajes sin verificar su firma cuando no existía App Secret efectivo. Se corrige para rechazar esa configuración con HTTP 503 antes de analizar mensajes. Con App Secret configurado conserva HTTP 401 para firmas ausentes/incorrectas y permite solicitudes correctamente firmadas. Se añaden seis regresiones que comprueban esos rechazos, falta de raw body, manipulación del payload y paso de una solicitud válida al procesamiento existente.

Las comprobaciones anteriores describen el despliegue previo. El preflight posterior con los secretos configurados comprobó HTTP 401 ante firmas ausentes/incorrectas y HTTP 200 ante una firma válida. Falta probar un mensaje auténtico de Meta y su procesamiento completo. No registrar secretos en este informe.

El workflow de imagen/configuración del commit `aee33df2f36eecce73d1eb443bedabba5590ca8a` pasó [Nginx, build, unitarias, Compose y recuperación aislada](https://github.com/wilmerx5/PPP-NEST/actions/runs/37960368355). Esa recuperación usó MariaDB desechable, no la DB remota del VPS.

Tras confirmar la nueva recarga, GPT-4.1 aprobó [140/140 ejecuciones críticas](https://github.com/wilmerx5/PPP-NEST/actions/runs/37947853986/job/113930570660) y [303/303 conversaciones de aceptación](https://github.com/wilmerx5/PPP-NEST/actions/runs/37947853977/job/113931153548). Se ejecutaron consecutivamente, sin repetir suites ya aprobadas del mismo motor. Esos ensayos usan transportes sintéticos y el motor conversacional, no Meta ni cocina real. El motor/catálogo/fixtures no cambió por la corrección del webhook ni por el nuevo preflight HTTP. La aceptación recuperó un timeout clasificado: el consumo de esa respuesta perdida es desconocido, aunque el caso pasó. No interpretar el resultado fallido antiguo de Mini como un intento nuevo.

## Preflight con secretos privados de staging

El responsable configuró la cuenta de staff y los secretos Meta de pruebas en GitHub y recibió `hello_world` en su destinatario de prueba. Ese mensaje comprueba envío desde Meta, no la creación de pedidos en PPP.

El [preflight HTTPS](https://github.com/wilmerx5/PPP-NEST/actions/runs/37978584001/job/113983027233), a las 14:12 de Bogotá, comprobó presencia de los seis secretos, health/DB, protección del administrador, rechazo del webhook sin firma y con firma inválida, aceptación de firma válida y coincidencia del Verify Token/challenge. Los POST llevaban un `entry:[]`; no crearon chats, mensajes ni pedidos. El primer chequeo de login esperaba únicamente HTTP 200; esta ruta Nest con `@Post` y `@Res` devuelve 201 por defecto. Se corrigió el probe para aceptar 200/201, manteniendo comprobaciones de identidad, rol y cookies.

La [comprobación selectiva del staff](https://github.com/wilmerx5/PPP-NEST/actions/runs/37979082690/job/113984701734), a las 14:16, confirmó HTTP 201, cuenta administradora válida y cookies Secure/HttpOnly. Se detuvo por `ACCESS_COOKIE_DOMAIN_NOT_ISOLATED`: el Domain no corresponde al host de staging. No repitió las comprobaciones Meta aprobadas. No llegó a leer settings con sesión ni comprobar logout; tampoco verificó aún el modelo y canal efectivos.

Tras dejar `COOKIE_DOMAIN=` vacío y recrear solamente la API, el [segundo intento de staff](https://github.com/wilmerx5/PPP-NEST/actions/runs/37979082690/job/113989536225), a las 14:29, confirmó cuenta administradora, cookie aislada y lectura autenticada de settings. El modelo almacenado todavía no era el aprobado y el Phone Number ID de la DB estaba vacío: no acredita el canal efectivo que puede venir del entorno. El probe de logout esperaba 200, aunque esta ruta POST también puede devolver 201; se corrige para aceptar ambos y exigir que se borren ambas cookies.

Se prepara una ejecución selectiva que puede actualizar exclusivamente `openaiModel` a `gpt-4.1-2025-04-14` y comprobar la persistencia con otra lectura, manteniendo las comprobaciones de autenticación y aislamiento. Solo escribe si el modelo difiere y si no hay un canal almacenado que contradiga el canal de prueba. No habilita el bot ni modifica tokens, destinatarios o el canal. Los scripts se ejecutan desde un commit fijado; no reciben secretos en PR ni los imprimen en logs/artefactos. No usan DB secrets, Access Token de Meta ni API OpenAI.

El [preflight selectivo final](https://github.com/wilmerx5/PPP-NEST/actions/runs/37981204650/job/113991883641), a las 14:35 de Bogotá, pasó 5/5 comprobaciones y 14/14 pruebas offline. Login y logout devolvieron 201; las dos cookies se borraron correctamente. El modelo se actualizó exclusivamente a `gpt-4.1-2025-04-14` y se confirmó en una nueva lectura. El bot figura deshabilitado en DB, el agente habilitado, y las claves Meta/OpenAI y Phone Number ID de la DB están vacíos. Pueden provenir del entorno; este resultado no prueba que existan allí ni que los tres interruptores permitan conversaciones reales. No se repitieron las comprobaciones Meta ni las suites OpenAI aprobadas. Ningún pedido o mensaje se creó.

Antes de activar mensajes se requiere una comprobación del entorno del contenedor que emita solo indicadores: `PPP_STAGING`, presencia de claves, coincidencia de canal Meta de prueba, cantidad de destinatarios y estado de los interruptores. El entorno del VPS no es legible desde la API administrativa. Los secretos de GitHub no se copian automáticamente al contenedor. Mantener cocina/avisos de prueba aislados antes del primer pedido.

Para cerrar el circuito desplegado todavía se necesita: verificar el canal efectivo y su destinatario de prueba, cocina/avisos aislados y sandbox de los pagos que se habiliten. Comprobar el SHA ejecutado, modelo efectivo, carrito por unidad, pedido único, payload/evento de cocina, cambios/notas, stock, domicilio, takeover y recuperación. El health no acredita esos circuitos. Ver [aceptación](whatsapp-beta-acceptance.md) y [criterios del piloto](ppp-pilot-readiness.md).

## Diagnóstico de recepción Meta después de renovar el token

El operador comprobó en el contenedor que OpenAI y Meta están presentes, el canal del entorno coincide con el declarado de staging, hay un destinatario y los tres interruptores están habilitados. La primera consulta de solo lectura del número devolvió HTTP 401 / Meta 190 / subcódigo 463. Tras renovar el token y recrear la API, la misma consulta devolvió HTTP 200 y coincidencia del ID, sin imprimir credenciales o identificadores. Esto acredita acceso al número, no permiso efectivo de envío ni entrega del webhook.

El operador envió nuevamente una consulta de menú y no recibió respuesta; los logs que observó mostraban solo arranque. El controlador no registra cada payload válido: ausencia de logs no prueba ausencia de solicitudes.

Se añadió observación administrativa de solo lectura, restringida a un único destinatario declarado en GitHub. Lee las 80 conversaciones recientes y únicamente el detalle de la que coincida exactamente, si existe; registra cantidades, fechas y takeover, sin teléfonos, nombres, textos o IDs privados. Rechaza contextos no autorizados, múltiples destinatarios, cambios de configuración simultáneos, ambigüedad, IDs de ruta inválidos y detalles de otra persona. Veinte pruebas offline pasaron.

La [lectura desplegada](https://github.com/wilmerx5/PPP-NEST/actions/runs/37985163350/job/114005800070), a las 15:11 de Bogotá, pasó 6/6. No encontró al destinatario de GitHub entre las 80 conversaciones recientes; no afirma que nunca haya existido un chat ni que coincida con el destinatario del entorno, pues este último todavía no se compara por valor. No repitió suites OpenAI, no envió mensajes ni creó pedidos. Login/DB/configuración/logout funcionaron y el modelo aprobado sigue seleccionado.

En el primer intento de esa lectura, las lecturas pasaron y logout devolvió HTTP 502. Se comprobó health y se repitió una sola vez la sesión diagnóstica: logout devolvió 201 y borró las cookies. No se conoce la causa del 502; conservarlo como incidencia observada, sin declarar estabilidad completa.

Siguiente evidencia necesaria: configuración real del callback de la app Meta publicada, campo `messages` suscrito y asociación de la app con la cuenta WhatsApp de pruebas. Si no aparece la conversación objetivo, revisar también coincidencia del destinatario del contenedor con el secreto de GitHub. Publicar la app y acceder al número por API no acreditan esas suscripciones.

## Checkout y orden aislada del 9 de octubre

El staging se dejó abierto `00:00–23:59` los siete días. El checkout desplegado aprobó domicilio, recojo, efectivo, webhook duplicado, reset y takeover sin confirmar pedidos. Esa ejecución detectó además que `Paso a recoger` podía ser consumido por el agente antes de aplicar el tipo de entrega; el backend ahora resuelve esa intención de forma determinista antes del modelo.

Antes de probar una orden se bloqueó por defecto en `PPP_STAGING` la emisión WebSocket hacia las salas `kitchen`, `orders` y `tables`; solo se habilita con `STAGING_ORDER_EVENTS_ALLOW=true`. El contenedor se fijó en `FACTUS_ENV=sandbox`, sin conexiones persistentes al puerto de staging. La [prueba de ciclo real aislado](https://github.com/wilmerx5/PPP-NEST/actions/runs/38023585964) pasó: creó exactamente una orden WhatsApp de efectivo para recoger con un ajiaco, confirmó `printed=false`, FE ausente y ninguna preferencia de Mercado Pago; luego canceló la orden, dejó el chat limpio y comprobó que no quedaran órdenes activas del destinatario.

La auditoría posterior de DB confirmó la fila en estado `canceled`, origen `whatsapp`, tipo `pickup`, cero ítems asociados, sin impresión y `electronic_invoice_status=none`. El producto usado no controla inventario (`track_inventory=false`), por lo que esta prueba no acredita decremento/restauración de stock para productos que sí lo controlen. Queda pendiente un circuito separado con un SKU de inventario habilitado y, cuando exista una cocina de staging deliberadamente conectada, habilitar temporalmente sus eventos para validar el payload visual y la impresión física.

La revisión posterior clasificó la credencial de Mercado Pago cargada en staging como `APP_USR`, no `TEST`. No se utilizó: el ciclo aprobado fue en efectivo y comprobó que no existiera preferencia. Como protección, se vaciaron token y secreto de webhook en el contenedor de staging y se deshabilitó `mercadopago` en los métodos publicados por el bot. No ejecutar pagos hasta instalar y acreditar credenciales sandbox.
