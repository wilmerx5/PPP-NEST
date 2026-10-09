# Integración WhatsApp con MariaDB real

La suite `yarn test:whatsapp:db` usa repositorios TypeORM, el bootstrap SQL real y el controlador HTTP de WhatsApp. GitHub Actions crea bases desechables en MariaDB 10.11 y 11.4; las credenciales del workflow sirven exclusivamente para esos contenedores temporales. No necesita secretos de producción.

## Cobertura y límites

28 casos verifican lectura de settings con `RUN_MIGRATIONS=false`, bootstrap repetible, creación simultánea de una conversación por 16 workers, 64 intentos concurrentes del mismo Meta ID en dos conexiones, 32 IDs distintos con texto idéntico, índice UNIQUE correcto, errores de claves foráneas, IDs nulos, estados terminales, persistencia de variantes/cantidades/notas, cancelación y snapshots viejos de atención humana.

El tramo HTTP verifica suscripción Meta, rechazo HMAC inválido antes de escribir, mensaje firmado a través del agrupador real, deduplicación, respuesta y auditoría de fallo del transporte. Incluye fallos del flush temporizado y del lote inmediato de ocho mensajes, además de un siguiente mensaje exitoso tras el fallo. Usa la respuesta del bot deshabilitado para ejercitar el ciclo de persistencia. El envío a Meta y la consulta de perfiles de usuario están aislados; la suite prohíbe llamadas mediante `fetch` externo.

Con el bot activado, los webhooks de confirmación verifican datos faltantes, espera del resumen final, DTO con cantidad/notas, confirmaciones repetidas, cancelación, takeover, rechazo de creación, límites mínimos/máximos, estado de pago y fallo de envío posterior a aceptación del pedido. La conversación y los mensajes se persisten en MariaDB; `OrdersService.create`, `PaymentsService.createPreference`, catálogo y horario se aíslan con respuestas sintéticas. No se llama a la IA en estos casos de protocolo cerrado.

La suite adicional `orders.db.integration-spec.ts` ejecuta 27 casos con `OrdersService`, `ProductsService`, tablas comerciales, transacciones e inventario reales. Usa dos conexiones e instancias independientes para probar reintentos, numeración diaria, competencia por la última unidad y cancelación concurrente. Verifica precios persistidos, notas/opciones por unidad, variantes, stock compartido fraccionario, rollback tras un fallo tardío, horario, tarifa de domicilio, cancelación repetida/forzada y preparación en cocina. La prueba concurrente sincroniza ambas lecturas reales antes de cancelar para reproducir la carrera de manera controlada. Además comprueba que no se pueda reabrir una orden cancelada y que una finalización concurrente obligue a confirmar la cancelación forzada.

Las dos suites suman 55 pruebas por versión de MariaDB. Los límites de horario, puntos y notificaciones se aíslan en la suite comercial; no se ejecuta la finalización externa del pedido. No se comprueban pagos reales, reparto, autenticación administrativa ni múltiples restaurantes. El webhook probado usa un creador de órdenes aislado; la suite comercial llama al servicio real por separado. Falta unirlos en una aceptación completa de staging. Las pruebas del agente con OpenAI se ejecutan en otro workflow. El objetivo inmediato es completar la aceptación de PPP; la adaptación a Kamppo se evalúa después.

## Ejecución segura

Preparar una base vacía y desechable en MariaDB local. Definir `WHATSAPP_DB_TEST=1`, `TEST_DB_HOST=127.0.0.1`, `TEST_DB_PORT=3306`, `TEST_DB_DATABASE=ppp_test_whatsapp`, `TEST_DB_USERNAME` y `TEST_DB_PASSWORD`; luego ejecutar `yarn test:whatsapp:db`.

Las suites sincronizan tablas comerciales, borran datos sintéticos entre casos y modifican índices WhatsApp. Se niegan a arrancar sin la selección explícita, un host de loopback y un nombre de base que comience con `ppp_test_whatsapp` según el patrón permitido. No cargar `.env` de producción para estas pruebas.

## Staging posterior

Las credenciales reales nunca se agregan a Git. Configurar un entorno de GitHub Actions de staging con `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, usuario de privilegios limitados y datos sintéticos. La base debe ser independiente de producción y accesible desde el runner autorizado.

Estos nombres pertenecen a la aplicación; no reemplazan los `TEST_DB_*` de la suite destructiva. Un rehearsal de checkout necesita un workflow separado que no borre datos y proveedores sandbox de WhatsApp/pagos. Registrar pedido, pago y resultado esperado para cada prueba, y comprobar recuperación tras reintentos y reinicio.
