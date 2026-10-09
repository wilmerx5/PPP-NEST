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

Para cerrar el circuito desplegado todavía se necesita: verificar el canal efectivo y su destinatario de prueba, cocina/avisos aislados y sandbox de los pagos que se habiliten. Comprobar el SHA ejecutado, modelo efectivo, carrito por unidad, pedido único, payload/evento de cocina, cambios/notas, stock, domicilio, takeover y recuperación. El health no acredita esos circuitos. Ver [aceptación](whatsapp-beta-acceptance.md) y [criterios del piloto](ppp-pilot-readiness.md).
