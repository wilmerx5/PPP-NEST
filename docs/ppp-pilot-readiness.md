# PPP: decisión de piloto y evidencia para Kamppo

## Objetivo inmediato

Validar primero la operación de Pronto Pollo Portal. Este documento define una propuesta de piloto supervisado; no autoriza despliegues ni envíos a clientes. Una suite verde acredita los casos ejecutados, no garantiza todos los pedidos futuros.

## Evidencia actual — 9 de octubre de 2026

Última ronda completa evaluada: `204cc7aaf41ba7002e0ca157dc8839e900527e15`; PR #6 permanece en borrador. Las correcciones posteriores requieren una nueva ronda en su SHA.

| Comprobación | Resultado | Evidencia |
| --- | --- | --- |
| Compilación y unitarias | PASS, 659/659 | [Nest CI](https://github.com/wilmerx5/PPP-NEST/actions/runs/37890717619) |
| MariaDB y checkout interno | PASS, 71/71 en 10.11, 11.4 y 11.8 | [213 ejecuciones](https://github.com/wilmerx5/PPP-NEST/actions/runs/37890717699) |
| Conversaciones con OpenAI tras las últimas correcciones | 302/303 aceptados; 1 sustitución incompleta | [Revalidación de correcciones](https://github.com/wilmerx5/PPP-NEST/actions/runs/37890713475) |
| Acceso y esquema de staging, solo lectura | PASS previo: TLS, columnas, Meta ID único y 65 productos activos | [Auditoría](https://github.com/wilmerx5/PPP-NEST/actions/runs/37881659946/job/113666046435) |
| Circuito desplegado Meta, cocina y pagos habilitados | PENDIENTE | Completar en staging aislado sobre el código candidato |
| Piloto supervisado de 100 pedidos | NO EJECUTADO | Requiere cerrar las puertas previas |

**Todavía no listo para producción.** El saldo ya permite probar. La última ronda aprobó los cambios de atributos del combo, las sopas y «más yuca». Revalidar la nueva protección de sustituciones frente a ediciones posteriores y la suma de cantidades de platos idénticos; después completar aceptación externa en staging antes de iniciar el piloto. La ronda anterior registró 760 solicitudes, 4.618.782 tokens de entrada (4.023.808 en caché) y 32.280 de salida: estimación US$0,4103997 a tarifa estándar de texto; no es factura ni costo por pedido en producción.

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
