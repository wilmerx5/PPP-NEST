# PPP: decisión de piloto y evidencia para Kamppo

## Objetivo inmediato

Validar primero la operación de Pronto Pollo Portal. Este documento define una propuesta de piloto supervisado; no autoriza despliegues ni envíos a clientes. Una suite verde acredita los casos ejecutados, no garantiza todos los pedidos futuros.

## Evidencia actual — 10 de octubre de 2026, hora de Bogotá

La [PR #7](https://github.com/wilmerx5/PPP-NEST/pull/7) está abierta. La cabeza vendible es `997b5a13` (`2026-10-10.cart-v8`). El health de staging sigue ok; el ensayo de catálogo por webhook exige ese `cart-v8` en el contenedor. El router real ya corre el código de la rama sin redeploy.

- **Checkout de calle y paquetes — PASS:** domicilio, preparación durante pago, billete de 50 mil, paquete «tres hamburguesas clásicas» como una unidad, «Para la Calle 48 sur 87 86» cotizada sin leerse como cantidad, y «no lo quites» conserva el churrasco. Chat limpio al final, cero órdenes. Evidencia: [flujo tras el redeploy](https://github.com/wilmerx5/PPP-NEST/actions/runs/38076817324) y [misma batería previa](https://github.com/wilmerx5/PPP-NEST/actions/runs/38076296628).
- **Modelo real — PASS (19/19):** `gpt-4.1-2025-04-14` sobre checkout/dirección/paquetes y el catálogo diverso (cuarto de pollo tras «quiero un pollo», pechuga → gratinada → porción de yuca #7, jugo en leche, ejecutivo, taco). Evidencia: [router 38081394915](https://github.com/wilmerx5/PPP-NEST/actions/runs/38081394915).
- **Catálogo por webhook — PENDIENTE DE REDEPLOY `cart-v8`:** el último execute en el contenedor viejo cortó en `QUARTER_FRIED_NOT_SAVED` ([38080406994](https://github.com/wilmerx5/PPP-NEST/actions/runs/38080406994)). No reensayar hasta que `/staging/test-target` devuelva `2026-10-10.cart-v8`.
- **Orden comercial aislada en este SHA — PASS:** domicilio, recojo, efectivo, webhook duplicado, takeover/release y una orden WhatsApp de ajiaco para recoger en efectivo; `printed=false`, sin FE ni preferencia de Mercado Pago; cancelación y chat limpios. Evidencia: [ciclo de orden](https://github.com/wilmerx5/PPP-NEST/actions/runs/38077049426).
- **Horario y runtime — PASS:** negocio abierto `00:00–23:59` los siete días, health público con DB conectada y circuito cerrado.
- **Protecciones — PASS:** eventos WebSocket hacia cocina/mesas bloqueados (`STAGING_ORDER_EVENTS_ALLOW` ausente). La cocina local sigue apuntando a producción, no a staging.
- **Inventario — NO APLICA AL CATÁLOGO ACTUAL:** los 65 productos activos de staging tienen `trackInventory=false` y stock 0. No se activó inventario en un SKU comercial para no mutar la carta. El decremento/restauración de stock sigue acreditado solo en MariaDB desechable.
- **Meta inbound auténtico — PENDIENTE:** los webhooks de ensayo van firmados y sintéticos; falta un mensaje originado desde el celular autorizado.
- **Cocina e impresión — PENDIENTES:** no habilitar `STAGING_ORDER_EVENTS_ALLOW` hasta tener un front de cocina/mesas aislado en staging. Encenderlo ahora no imprimiría en la cocina de producción, pero tampoco acreditaría el ticket.
- **Mercado Pago — OMITIDO (se asume ya validado fuera de este ciclo):** no se ensaya ni se redeploya por MP. El circuito que se acredita aquí es efectivo/transferencia.
- **Piloto supervisado — NO EJECUTADO:** comienza únicamente después de cerrar las puertas humanas anteriores.

**Aún no listo para declararlo vendible.** El circuito comercial básico (carrito, domicilio, efectivo, creación y cancelación de una orden) ya está acreditado en el staging redeployado. Faltan el inbound auténtico de Meta, una cocina de staging con impresión física y, si el alcance comercial incluye Mercado Pago, el sandbox.

Las comparaciones históricas con OpenAI y las pruebas adicionales ya ejecutadas se conservan como evidencia previa. No repetir suites de pago aprobadas por rutina: priorizar el fallo observado y los casos afectados; una modificación de modelo, prompt o catálogo requiere reevaluar su alcance. Comprobar el carrito guardado además del texto del bot. Un porcentaje estimado de avance no sustituye el cierre de cada puerta.

## Puertas de salida

El smoke de runtime usa únicamente una DB desechable de CI y una red sin acceso al exterior, con credenciales ficticias. La preparación del fixture crea tablas desde las entidades; la aplicación mantiene `synchronize:false`. Esto verifica arranque, configuración, protecciones HTTP y recuperación de conexión, no pedidos reales en cocina, login Google real ni compatibilidad completa del catálogo/esquema de la DB remota.

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

El backend está aislado en `dev.prontopolloportal.com`; acceso administrativo, configuración efectiva del destinatario/canal, firma del webhook, modelo aprobado y persistencia se han comprobado antes de los mensajes automatizados. Los envíos permanecen limitados al único destinatario propio autorizado. Una continuación solo procede si acredita la versión del parche y el estado exacto del borrador; cambios humanos o diferencias de catálogo detienen la prueba sin sobrescribirlos.

Confirmar cocina/avisos aislados y el sandbox de cualquier pago antes de crear los primeros pedidos de aceptación. Ver [requisitos de staging](ppp-staging-test-requirements.md).
