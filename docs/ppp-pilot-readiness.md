# PPP: decisión de piloto y evidencia para Kamppo

## Objetivo inmediato

Validar primero la operación de Pronto Pollo Portal. Este documento define una propuesta de piloto supervisado; no autoriza despliegues ni envíos a clientes. Una suite verde acredita los casos ejecutados, no garantiza todos los pedidos futuros.

## Evidencia actual — 9 de octubre de 2026

Código candidato validado: `6148f81e5f0e28e0273584b1a7913f3c649c446a`; PR #6 permanece en borrador. Compilación, 713 unitarias, MariaDB e imagen Docker pasaron en ese SHA. La comparación conversacional y las repeticiones se intentaron sobre el mismo código, pero OpenAI rechazó las solicitudes por `credit_balance_exhausted`. No hay aceptación con IA de este candidato.

| Comprobación | Resultado | Evidencia |
| --- | --- | --- |
| Compilación y unitarias | PASS, 713/713; subconjunto WhatsApp 637/637 | [Nest CI](https://github.com/wilmerx5/PPP-NEST/actions/runs/37947861964) |
| MariaDB y checkout interno | PASS, 71/71 en 10.11, 11.4 y 11.8 | [213 ejecuciones](https://github.com/wilmerx5/PPP-NEST/actions/runs/37947862309) |
| Imagen Docker y dependencias de runtime | PASS, build, 713/713 unitarias con Node 20/npm y Compose válido | [Imagen del candidato](https://github.com/wilmerx5/PPP-NEST/actions/runs/37947853942) |
| Conversaciones con OpenAI, candidato 6148f81e | BLOQUEADAS: Mini y GPT-4.1 sin respuestas exitosas, error de saldo | [Comparación](https://github.com/wilmerx5/PPP-NEST/actions/runs/37947853977) |
| Repeticiones de casos que han fallado, candidato 6148f81e | BLOQUEADAS: una solicitud rechazada por modelo; detención por saldo, cobertura sin completar | [Endurance](https://github.com/wilmerx5/PPP-NEST/actions/runs/37947853986) |
| Acceso y esquema de staging, solo lectura | PASS previo: TLS, columnas, Meta ID único y 65 productos activos | [Auditoría](https://github.com/wilmerx5/PPP-NEST/actions/runs/37881659946/job/113666046435) |
| Circuito desplegado Meta, cocina y pagos habilitados | PENDIENTE | Completar en staging aislado sobre el código candidato |
| Piloto supervisado de 100 pedidos | NO EJECUTADO | Requiere cerrar las puertas previas |

**Todavía no listo para producción.** La comparación previa en `88d9d3b` ([37939501632](https://github.com/wilmerx5/PPP-NEST/actions/runs/37939501632)) terminó con GPT-4.1 en 303/303, sin errores del proveedor, y Mini en 302/303: omitió mondongo después de intentar agregar otro SKU de sopa. La revalidación siguiente pasó ese pedido, pero registró un timeout por modelo y un rechazo literal de la frase de garantía negada de alérgenos en GPT-4.1. En `6d7511ae`, Mini aprobó 302/303 y GPT-4.1 301/303 en [la comparación](https://github.com/wilmerx5/PPP-NEST/actions/runs/37942176086); Mini pasó 140/140 repeticiones en [la prueba adicional](https://github.com/wilmerx5/PPP-NEST/actions/runs/37942176383). Es evidencia anterior, no aceptación del candidato actual. Las nuevas correcciones recuperan timeouts clasificados de inferencia sin repetir herramientas, marcan como desconocido su consumo y derivan alergias explícitas a verificación humana/cocina. La ronda anterior GPT-4.1 perdió las 140 pruebas adicionales por `credit_balance_exhausted`; en el candidato actual las invocaciones se detienen ante ese bloqueo, sin repetir todos los casos. Se requiere saldo en la organización de `OPENAI_API_KEY` y reejecutar la comparación y las repeticiones completas para aprobar el código final. Los jobs GPT-4.1 se serializan. La configuración desplegada debe coincidir con el modelo/snapshot aprobado y todavía requiere aceptación externa en staging.

## Puertas de salida

| Puerta | Evidencia necesaria | Condición |
| --- | --- | --- |
| Código y regresiones | SHA desplegable, compilación, unitarias, conversaciones con IA y MariaDB | Todas las suites críticas verdes en ese SHA; ningún P0/P1 pendiente. Un cambio de prompt, modelo o catálogo debe volver a evaluarse. |
| Circuito desplegado | Canal de pruebas, webhook, pedido, evento de cocina, disponibilidad, entrega y pago habilitado | Cada escenario crítico pasa en staging aislado. Comparar el mensaje autorizado con cada unidad realmente recibida en cocina. |
| Recuperación | Reenvío, fallo de respuesta, reinicio, revisión de processing/failed, takeover y desactivación | Un solo efecto comercial por pedido; ningún reintento ciego de un mensaje con efectos inciertos. |
| Operación supervisada | Primeros 100 pedidos completados revisados y muestra de conversaciones abandonadas/canceladas | Incluir horas pico. Revisión humana antes de enviar a cocina. Cero errores críticos que lleguen a operación. Registrar las correcciones previas por separado. |
| Expansión | Resultados del piloto y evidencia de aislamiento entre restaurantes | Ampliar tráfico solo después de revisar resultados. No declarar Kamppo multi-tenant validado por pruebas de un solo restaurante. |

Los 100 pedidos son un punto de revisión, no un tamaño de muestra que garantice ausencia de defectos. Como objetivo inicial proponemos al menos 98 % de pedidos correctos antes de intervención; un duplicado, cobro no autorizado, pérdida de pedido o error enviado a cocina detiene el piloto aunque el porcentaje sea alto.

## Qué es un pedido correcto

Comparar por unidad: SKU/presentación, cantidad, todos los atributos, nota de cocina y empaque. Comparar además subtotal, entrega, total, nombre confirmado, contacto, domicilio/recojo y método de pago. La respuesta «listo» del bot no es evidencia: verificar sesión persistida, orden comercial y payload de cocina.

Una pregunta de menú no cambia el carrito. Un cambio de nota no agrega una unidad. Una corrección modifica la línea solicitada y conserva las otras. Un cambio de precio exige revisar el nuevo resumen antes de confirmar. Una preparación que existe como atributo o SKU no se oculta en una nota libre.

## Registro mínimo del piloto

Registrar en almacenamiento privado, fuera de Git, una fila por conversación y por pedido:

- Identificador sintético de caso, fecha y SHA/modelo/configuración de prueba.
- Intención, resultado esperado, carrito previo y posterior sin datos personales.
- Meta IDs y pedido ID con acceso restringido para conciliación; en informes compartidos usar IDs sintéticos.
- Resultado antes de intervención, corrección humana necesaria, resultado final y severidad.
- Tiempo de primera respuesta útil, duración hasta confirmación y número de mensajes.
- Tokens/costo de IA cuando estén disponibles, costo del canal, intervención y tiempo del encargado.

No subir chats originales, nombres, teléfonos, domicilios, comprobantes, secretos ni exportaciones de clientes al repositorio. Los fixtures deben ser sintéticos y conservar únicamente el patrón del fallo.

## Métricas y denominadores

| Métrica | Cálculo |
| --- | --- |
| Precisión antes de intervención | Pedidos completos que coinciden con la intención sin corrección humana / pedidos completados revisados. |
| Intervención necesaria | Conversaciones que requirieron corregir o resolver una duda que el bot no resolvió / conversaciones elegibles. Revisar obligatoriamente una orden no cuenta por sí solo como fallo. |
| Terminación | Pedidos completados / conversaciones con intención de compra. Separar consultas, cancelaciones voluntarias y abandonos por fallos. |
| Latencia | Mediana y percentil 95 de respuesta útil; registrar también tiempo de confirmación. |
| Costo por pedido | Costos observados de IA y canal / pedidos completados; informar aparte costo por conversación e intervención. |
| Ahorro de trabajo | Comparar minutos del encargado por pedido con una muestra del proceso habitual, con cargas y tipos de pedido comparables. |

No publicar promesas de ahorro, costo o velocidad hasta medirlas. Un promedio global puede ocultar fallos en correcciones: separar pedidos simples, multi-producto, variantes, notas y domicilio/pago.

## Tratamiento de fallos

P0: duplicado, cobro inesperado, pedido incorrecto en cocina o pérdida silenciosa. Detener tráfico automatizado, conciliar pedidos y pasar a humano.

P1: SKU, cantidad, opción, nota, total o dirección incorrectos antes de enviar. Corregir y añadir una regresión; mantener supervisión y revisar si afecta otros casos.

P2: respuesta larga/confusa, demasiadas burbujas o latencia. Medir y priorizar sin cambiar expectativas de exactitud para mejorar el porcentaje.

Cada fallo debe cerrar con causa, prueba que lo reproduce, corrección, resultado de regresiones y evidencia en el SHA final. No modificar una expectativa para que acepte un carrito incorrecto.

## Requisitos para vender Kamppo después de PPP

Aislamiento de datos y operaciones entre restaurantes; catálogo y reglas configurables; roles y permisos; instalación sin cambios de código por menú; onboarding, respaldos/restauración, monitoreo, soporte y desactivación; integración de cocina y pagos habilitados en cada negocio; costos y límites comerciales medidos.

Los nombres y opciones PPP pertenecen a fixtures y configuración de negocio. La edición por línea y la validación de atributos deben depender del catálogo, no de IDs o productos fijos. La evidencia PPP es el primer caso operativo, no la certificación de restaurantes con otros catálogos.

Ver también [aceptación beta](whatsapp-beta-acceptance.md), [pruebas MariaDB](whatsapp-db-integration.md) y [requisitos de staging](ppp-staging-test-requirements.md).

## Backend de staging

El responsable confirmó que solo está preparada la DB. Se prepara [un backend aislado](ppp-staging-backend.md), con TLS/destino DB comprobados, puerto privado y envíos Meta limitados explícitamente al canal y destinatarios de pruebas. Sigue faltando el servidor/URL y la aceptación desplegada; la imagen construida no equivale a un backend desplegado.
