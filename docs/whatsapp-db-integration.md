# Integración WhatsApp con MariaDB real

La suite `yarn test:whatsapp:db` usa repositorios TypeORM, el bootstrap SQL real y el controlador HTTP de WhatsApp. GitHub Actions crea bases desechables en MariaDB 10.11, 11.4 y 11.8; las credenciales del workflow sirven exclusivamente para esos contenedores temporales. No necesita secretos de producción.

## Cobertura y límites

30 casos verifican lectura de settings con `RUN_MIGRATIONS=false`, bootstrap repetible, creación simultánea de una conversación por 16 workers, 64 intentos concurrentes del mismo Meta ID en dos conexiones, 32 IDs distintos con texto idéntico, índice UNIQUE correcto, errores de claves foráneas, IDs nulos, estados terminales, persistencia de variantes/cantidades/notas, cancelación y snapshots viejos de atención humana.

El tramo HTTP verifica suscripción Meta, rechazo HMAC inválido antes de escribir, mensaje firmado a través del agrupador real, deduplicación, respuesta y auditoría de fallo del transporte. Incluye fallos del flush temporizado y del lote inmediato de ocho mensajes, además de un siguiente mensaje exitoso tras el fallo. Usa la respuesta del bot deshabilitado para ejercitar el ciclo de persistencia. El envío a Meta y la consulta de perfiles de usuario están aislados; la suite prohíbe llamadas mediante `fetch` externo.

Con el bot activado, los webhooks de confirmación verifican datos faltantes, espera del resumen final, DTO con cantidad/notas, confirmaciones repetidas, cancelación, takeover, rechazo de creación, límites mínimos/máximos, estado de pago y fallo de envío posterior a aceptación del pedido. La conversación y los mensajes se persisten en MariaDB; `OrdersService.create`, `PaymentsService.createPreference`, catálogo y horario se aíslan con respuestas sintéticas. No se llama a la IA en estos casos de protocolo cerrado.

La suite adicional `orders.db.integration-spec.ts` ejecuta 27 casos con `OrdersService`, `ProductsService`, tablas comerciales, transacciones e inventario reales. Usa dos conexiones e instancias independientes para probar reintentos, numeración diaria, competencia por la última unidad y cancelación concurrente. Verifica precios persistidos, notas/opciones por unidad, variantes, stock compartido fraccionario, rollback tras un fallo tardío, horario, tarifa de domicilio, cancelación repetida/forzada y preparación en cocina. La prueba concurrente sincroniza ambas lecturas reales antes de cancelar para reproducir la carrera de manera controlada. Además comprueba que no se pueda reabrir una orden cancelada y que una finalización concurrente obligue a confirmar la cancelación forzada.

La tercera suite, `whatsapp-order-checkout.db.integration-spec.ts`, añade 14 casos desde el webhook HTTP firmado hasta `OrdersService.create`, transacciones, inventario, finalización y mapper real del evento de cocina. Verifica unidades, variantes y notas, reintentos de confirmación, fallo de Meta tras commit, agotamiento, desactivación, precio cambiado con nueva confirmación, rollback tardío y clientes concurrentes. Cinco casos pasan por el enrutamiento de AgentV1 con acciones sintéticas para verificar edición, eliminación selectiva, borrado de notas, consultas y takeover. El mapper se ejecuta realmente; se aísla la salida WebSocket. El catálogo y los precios se leen desde ProductsService y tablas reales.

Las tres suites suman **71 pruebas por versión de MariaDB**. Las pruebas generales incluyen reparación de una instalación parcial y del índice único de identidad WhatsApp, además de los 16 workers concurrentes. El caso del índice Meta compuesto conserva un índice de soporte FK antes de retirarlo, para que InnoDB no contamine los casos posteriores.

En la suite de checkout completo se prohíbe `fetch` externo y se usan pagos en efectivo, perfiles y puntos sintéticos. No se llama al modelo de IA ni a Meta real; no hay cocina/impresora real. Las simulaciones con OpenAI se ejecutan en otro workflow. Tampoco se certifican rutas reales, pagos, autenticación administrativa ni aislamiento multi-restaurante. Las pruebas destructivas corren solo en contenedores locales desechables, nunca en staging.

El 9 de octubre de 2026, [37884838374](https://github.com/wilmerx5/PPP-NEST/actions/runs/37884838374) pasó los 64 casos previos en las tres versiones. Al ampliar el recorrido de edición HTTP se reprodujeron adiciones indebidas durante la conciliación del carrito y una falta de reparación del índice de conversación en esquemas creados por TypeORM. Los casos nuevos deben permanecer exigentes hasta que la ejecución completa del SHA final pase.

## Ejecución segura

Preparar una base vacía y desechable en MariaDB local. Definir `WHATSAPP_DB_TEST=1`, `TEST_DB_HOST=127.0.0.1`, `TEST_DB_PORT=3306`, `TEST_DB_DATABASE=ppp_test_whatsapp`, `TEST_DB_USERNAME` y `TEST_DB_PASSWORD`; luego ejecutar `yarn test:whatsapp:db`.

Las suites sincronizan tablas comerciales, borran datos sintéticos entre casos y modifican índices WhatsApp. Se niegan a arrancar sin la selección explícita, un host de loopback y un nombre de base que comience con `ppp_test_whatsapp` según el patrón permitido. No cargar `.env` de producción para estas pruebas.

## Staging posterior

Las credenciales reales nunca se agregan a Git. Configurar un entorno de GitHub Actions de staging con `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, usuario de privilegios limitados y datos sintéticos. La base debe ser independiente de producción y accesible desde el runner autorizado.

Estos nombres pertenecen a la aplicación; no reemplazan los `TEST_DB_*` de la suite destructiva. Un rehearsal de checkout necesita un workflow separado que no borre datos y proveedores sandbox de WhatsApp/pagos. Registrar pedido, pago y resultado esperado para cada prueba, y comprobar recuperación tras reintentos y reinicio.
