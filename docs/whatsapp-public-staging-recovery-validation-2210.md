# Tanda 117 — recuperación y staging abierto a visitantes

## VIGENTE — tanda 117: recuperación y acceso público de staging (22/10)

Base 098e6e58, rama staging. 24 regresiones nuevas de recuperación en tres menús y agente simulado on/off: precio cambiado, combo retirado/agotado y bebida desconocida; datos de contacto conservados, dos unidades con nota, alternativa válida y 24 DTO completos. Pasaron en el código existente; no se parcheó el orquestador.

A solicitud expresa del usuario, staging debe responder a cualquier número. Se añade WHATSAPP_STAGING_PUBLIC_CHAT=true: omite solo la lista de destinatarios, mantiene WHATSAPP_STAGING_OUTBOUND_ALLOW=true, el canal STAGING_WHATSAPP_PHONE_NUMBER_ID exacto y validación del número. Sin esa opción conserva la lista cerrada. Diez pruebas nuevas de acceso: texto a tres visitantes, medios, canal incorrecto, salida deshabilitada, destinatario inválido y valores distintos de true. Baseline 4 fallidos/14 aprobados; foco final 346/346 en cinco suites; TS general/build OK, Node 92/92. Global 16.249/16.249, 192 suites, 490 hashes iguales, inventario exacto, 536,78 s.

Cero API pagada, WhatsApp u órdenes externas en la validación. Los visitantes reales sí usarán los modelos habituales. Mantener STAGING_ORDER_EVENTS_ALLOW desactivado; no abrir cocina, pagos ni runners de prueba. Main/producción intactos. Publicado y desplegado en staging: 6863b72c, imagen 8bd4fa85…, verificado el 22/10 a las 22:03 Bogotá: running/healthy, cero reinicios, health OK, DB connected y circuit CLOSED. Configuración efectiva publicChat=true, salida habilitada, canal configurado y orderEvents=false. Producción conserva ef426c93…. Rollback ppp-nest-staging:rollback-before-6863b72c; env previo guardado privado en /root/ppp-staging-env-before-public-chat-117. bin/, bases y volúmenes preservados. Evidencia: [tanda 117](whatsapp-public-staging-recovery-validation-2210.md).

Siguiente: varias unidades con sabores diferentes durante selección de combo y cambios posteriores sobre solo una unidad; varias familias de menú, respuesta/carrito/estado/DTO. Prueba real de visitante desde otro número aún no realizada por el agente.

## Evidencia y operación

- `/tmp/ppp-117-recovery.json`: 24/24 recorridos aprobados, sin modificar reglas conversacionales.
- `/tmp/ppp-117-public-baseline.json`: cuatro fallos esperados antes de implementar acceso público y 14 controles aprobados.
- `/tmp/ppp-117-targets.json`: 346/346, cinco suites, incluyendo webhook, aislamiento de eventos y destinatarios de runners.
- `/tmp/ppp-117-tsc.log`, `/tmp/ppp-117-build.log`, `/tmp/ppp-117-node.log`: aprobados; 92 controles Node.
- `/tmp/ppp-117-global-summary.json`: global completa sin reintentos, 16.249 pruebas, 192 suites, inventario exacto y 490 hashes sin cambios durante 536,78 segundos.
- No se amplía la lista de objetivos autorizados de los runners de prueba. No ejecutar esos runners contra visitantes ni borrar sus conversaciones.
- La opción pública solo modifica el control de salida de WhatsApp del backend de staging. No omite validación de webhook, límites existentes ni restricciones del proveedor Meta. No acredita envío real desde otro número.
- Antes del cambio: PPP_STAGING=true, salida habilitada, un destinatario permitido, eventos de pedidos desactivados. La lista se conserva para poder volver al modo cerrado.
- Revertir la apertura poniendo WHATSAPP_STAGING_PUBLIC_CHAT=false en el .env.staging privado y recreando solo api con el compose de staging. Nunca copiar el env a Git ni imprimir sus secretos.

## Activación verificada

Evidencia `/tmp/ppp-117-deploy.log` y `/tmp/ppp-117-deploy-verified.log`. Servidor 2026-10-23T03:03:26Z, código 6863b72c3d68ac24944a0054b25e741af2a7f5dd, imagen sha256:8bd4fa85aaeb8f48bf95fecaae77b7a02c7e5ba267d074c89c5292321acb50ae. Configuración efectiva confirmada dentro del contenedor. No se envió mensaje real a otro teléfono; el último paso de aceptación es que un visitante escriba desde otro número. Commit posterior solo documental, sin necesidad de reconstrucción.
