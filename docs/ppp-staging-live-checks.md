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

Esta corrección requiere actualizar y reconstruir el backend del VPS; las comprobaciones anteriores describen el despliegue previo. Después de actualizar, repetir las dos pruebas de firma: sin secreto debe responder 503; con el secreto del canal de pruebas debe responder 401. Probar además un webhook auténtico correctamente firmado. No registrar secretos en este informe.

El workflow de imagen/configuración del commit `aee33df2f36eecce73d1eb443bedabba5590ca8a` pasó [Nginx, build, unitarias, Compose y recuperación aislada](https://github.com/wilmerx5/PPP-NEST/actions/runs/37960368355). Esa recuperación usó MariaDB desechable, no la DB remota del VPS.

Tras confirmar la nueva recarga, se reactivaron únicamente los jobs pendientes GPT-4.1 de [140 ejecuciones críticas](https://github.com/wilmerx5/PPP-NEST/actions/runs/37947853986) y [303 conversaciones de aceptación](https://github.com/wilmerx5/PPP-NEST/actions/runs/37947853977). Se serializan por modelo; el segundo espera al primero. Esos ensayos usan transportes sintéticos y el motor conversacional, no Meta ni cocina real. Su código de agente/catálogo/fixtures es idéntico al de la corrección de firma; no hay motivo para repetirlos por este cambio de autenticación del webhook. No contar una ejecución en curso como aprobada ni interpretar el resultado fallido antiguo de Mini como un intento nuevo.

Para cerrar el circuito desplegado todavía se necesita: cuenta administradora de prueba, canal Meta y destinatarios exclusivamente de prueba, cocina/avisos aislados y sandbox de los pagos que se habiliten. Comprobar el SHA ejecutado, modelo efectivo, carrito por unidad, pedido único, payload/evento de cocina, cambios/notas, stock, domicilio, takeover y recuperación. El health no acredita esos circuitos. Ver [aceptación](whatsapp-beta-acceptance.md) y [criterios del piloto](ppp-pilot-readiness.md).
