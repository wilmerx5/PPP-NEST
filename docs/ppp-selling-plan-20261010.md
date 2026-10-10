# PPP: plan para llegar a un piloto vendible

Actualizado: 10 de octubre de 2026, Bogotá.

## Decisión actual

Todavía no declararía el chat vendible. La ampliación corrigió dos fallos nuevos y validó el router con más productos; falta cerrar la aceptación operativa desplegada y el piloto. Continuar con el recorrido desplegado y un piloto supervisado.

Alcance del primer producto: pedidos por WhatsApp, domicilio/recojo, efectivo y transferencia, entrega a la pantalla de cocina, intervención humana y seguimiento. Mercado Pago y la impresión automática quedan fuera de este piloto. La cocina recibe órdenes en pantalla; no se exige una impresora inexistente.

## Evidencia y límites

- Modelo efectivo evaluado: GPT-4.1, snapshot `gpt-4.1-2025-04-14`; no comparación de modelos en esta ronda.
- Router completo: 24/24 conversaciones con inferencia real y transportes/persistencia sintéticos. Incluye direcciones, pagos, preparación, paquetes, reinicio y cantidades después de aclaraciones.
- Corpus amplio del agente: 152/153 casos, en dos bloques de 147 y 6. Sin errores HTTP ni del agente. Es un nivel diferente: agente, guard y aplicación del carrito; no el recorrido completo desplegado.
- Hallazgo histórico del agente aislado: «Un arroz chino con medio pollo». El modelo pide frito/broaster, aunque la política existente exige la primera opción válida cuando no hay elección explícita. El carrito queda vacío en ese turno. La nueva matriz reprodujo el caso en el router completo y aprobó el carrito correcto; el router recupera esa omisión. No se cambió la política ni se relajó la expectativa de productos.
- Antes de ampliar catálogo: 1.004 unitarias, TypeScript y 79 integraciones MariaDB pasan. CI Nest y MariaDB 11.8 pasan en `6f75cd8c`; estos resultados no acreditan modificaciones posteriores.
- La ampliación comprueba los 65 SKUs de la fixture con una presentación por nombre y dos unidades por código: 130 verificaciones. Descubrió que «Gaseosa 2.5L» se convertía en dos bebidas. La corrección elimina medidas de volumen/peso del texto usado para contar unidades. Ocho regresiones adicionales y las dos suites afectadas pasan: 176 pruebas. La suite completa posterior pasa **1.142/1.142 en 56 suites**, y TypeScript también pasa. Esta última corrección aún requiere inferencia real y revalidación DB del candidato final.
- El corpus de 153 conversaciones comprueba explícitamente 34/65 productos como resultado esperado o carrito inicial. Esto no implica que los otros 31 nunca aparezcan en consultas. Las 130 verificaciones de catálogo no prueban que la IA entienda por sí sola los 65 productos.
- Al iniciar esta ronda se verificó staging saludable en `2e7036f`, con efectivo/transferencia, firmas válidas e inválidas y callback Meta dirigido a staging. Se integraron las correcciones posteriores hasta `997b5a13`; la activación del nuevo candidato se acredita por separado. Main/producción no se modifica en esta ronda.

## Resultado de la ampliación

- **33/33 conversaciones del router completo** con GPT-4.1; **6/6 ejecuciones focalizadas** de tamaño y notas (tres repeticiones cada una).
- **1.174/1.174 unitarias**, TypeScript y **81/81 integraciones MariaDB locales**.
- Corregidas la interpretación de 2.5 L como dos unidades, la adición de una bebida de 400 ml al pedir 250 ml y la pérdida de una nota al conservar otra variante.
- Persistencia de cantidades, atributos, notas e inventario comprobada. Falta evidencia operativa en el despliegue final, recepción visual en cocina y piloto supervisado.

## Paso 1 — Cerrar los fallos conocidos

1. Verificar la corrección de volumen/peso en toda la suite, no solo en gaseosa 2.5 L.
2. Reproducir en el router completo y resolver, si persiste, la omisión del producto cuando la IA pregunta por un atributo que ya tiene default. Usar una regla general: compra resuelta, opciones del catálogo y ausencia de ambigüedad real. No escribir excepciones para arroz ni IDs de PPP.
3. Mantener las correcciones de paquetes y edición de preparación durante checkout. Conservar notas, cantidades, dirección y pago.
4. Repetir con IA real los escenarios afectados y el router completo en el candidato final. Registrar fallos originales y revalidaciones, sin ocultar la ronda 152/153.

Salida: ningún fallo crítico pendiente en cantidades, productos, atributos o creación del pedido; unitarias, TypeScript y DB aprobadas en el código final.

## Paso 2 — Ampliar conversaciones con diferentes productos

Crear una matriz por comportamiento, además de los productos observados en chats:

- Pollos: entero/medio/cuarto, frito/broaster, arepas y porciones. «Dos medios» debe conservar presentación y copias.
- Sopas: ajiaco, menudencias, mondongo grande/pequeño, selección por número y texto. Mantener cantidad pedida y no traer sopas del historial anterior.
- Carnes y pescados: sobrebarriga, churrasco, costillas, pechuga plancha/gratinada, mojarra, bagre y trucha. Cambiar preparación y notas sin alterar el resto.
- Arroces, ejecutivos y combos: arroz chino solo/con pollo/con costillas, paisa y mixto. Un componente incluido no debe convertirse en un producto adicional.
- Hamburguesas, tacos y alitas: individual, dúo, trío; una presentación frente a dos paquetes. Revisar nombres duplicados de trío de tacos: si las fichas son indistinguibles, hay un problema de catálogo que la IA no debe adivinar.
- Bebidas: 250/400/500/600 ml, 1.5/2.5 L, sabores, jugos en agua/leche. «Dos gaseosas de 2.5 L» significa dos unidades, no cinco ni dos por el tamaño.
- Porciones y extras: papa, yuca, arroz, ensalada, arepas y plátano. Distinguir «con yuca» de «una porción adicional de yuca».

Para cada familia cruzar: pedido directo; typo/plural; consulta sin compra; aclaración pendiente; cambio de cantidad; reemplazo/eliminación; nota dirigida; agregado después de dirección/pago. Variar catálogo con productos sintéticos de otro restaurante para evitar depender del menú PPP.

Salida propuesta: los 65 productos cubiertos por verificaciones deterministas y sus familias por conversaciones con IA; tres repeticiones de los casos de mayor riesgo sin diferencias de carrito. No multiplicar automáticamente todos los casos por varios modelos o DBs.

## Paso 3 — Validar el recorrido desplegado y la rapidez

Desplegar únicamente el candidato aprobado en staging y comprobar que el código/imagen activos coinciden.

1. Producto → dirección → siguiente dato faltante, sin repetir «¿algo más?» cuando ya entregó la dirección.
2. Dirección corregida en cualquier fase → reemplazo real y nueva tarifa. Dirección no localizada debe quedar como pendiente de verificación, sin presentarla como ubicación exacta confirmada.
3. Efectivo → recoger monto para cambio cuando corresponda. Transferencia → instrucciones claras y estado pendiente; escoger transferencia no acredita haber pagado.
4. Permitir cambios antes de confirmar, incluidos nuevos productos, preparación y modalidad de entrega. El resumen debe reflejar todo antes de crear la orden.
5. Confirmar → exactamente un pedido, cantidades/notas/total correctos y evento esperado en cocina. Confirmar repetido no crea otra orden.
6. Medir latencia p50/p95, mensajes necesarios y solicitudes de IA por conversación. Propuesta de objetivo a validar en piloto: p95 menor de 10 segundos en turnos normales; ante demoras, respuesta clara y recuperación.

Salida: evidencia del carrito guardado y pedido creado, además del texto enviado; sin depender de que Wilmer pruebe cada chat manualmente.

## Paso 4 — Fallos y operación real

- Webhooks duplicados, mensajes rápidos y confirmaciones repetidas: una sola aplicación de efectos.
- Reinicio del servidor entre turnos y después de guardar la orden: recuperar estado sin repetir órdenes ni descontar stock otra vez.
- Fallas temporales de OpenAI, Meta y DB: respuesta/control de atención humana, registro de error y conciliación. No reejecutar ciegamente mensajes fallidos.
- Precio o disponibilidad que cambian antes de confirmar: actualizar/rechazar y mostrar el nuevo resumen.
- Local cerrado, domicilio fuera de cobertura, dirección insuficiente o proveedor de mapas caído: salidas claras y revisión humana cuando corresponda.
- Stock positivo, insuficiente y agotado en staging si se ofrece inventario como función. Las integraciones locales no acreditan inventario real configurado.
- Pantalla de cocina aislada: recibir una sola orden con sus variantes y notas; probar desconexión/reconexión. Mantener un solo orquestador hasta tener serialización distribuida por cliente.
- Takeover humano, consulta del pedido y cancelación según estado. Alertas, registro sin secretos y desactivación/rollback practicables.

Salida: cero duplicados y cero pérdidas de cambios en los ensayos críticos, con evidencias del entorno desplegado.

## Paso 5 — Piloto supervisado y oferta comercial

Propuesta: revisar los primeros 100 pedidos reales con el responsable del local, comparando conversación, pedido y cocina. Registrar errores por tipo, tiempo de respuesta, intervenciones humanas y consumo por pedido. Detener la automatización ante pedidos duplicados, cantidades/direcciones incorrectas enviadas a cocina o efectos no autorizados.

Antes de vender: onboarding documentado, requisitos del canal Meta, edición del catálogo, responsable de soporte, política de datos, recuperación de fallos, límites funcionales y costo de operar por restaurante. La transferencia tiene una política de verificación explícita. No prometer autonomía total basándose únicamente en pruebas verdes.

Salida propuesta: primeros 100 pedidos revisados sin errores críticos, incidentes relevantes resueltos con regresiones y aceptación del responsable del local.

## Paso 6 — Kamppo multitenant

Después de validar PPP, repetir con dos catálogos y canales completamente distintos. Aislar conversaciones, clientes, pedidos, tarifas, horarios, credenciales, pagos y eventos de cocina por tenant. Probar IDs repetidos entre tenants, cambio simultáneo de configuración y permisos de administradores. Medir que límites, colas y errores de un restaurante no afecten al otro.

Que las reglas nuevas sean generales es una buena base; no demuestra por sí solo aislamiento multitenant.

## Dependencias de Wilmer, al final

- Subir las builds de frontends cuando corresponda y verificar qué pantalla recibe las órdenes del ensayo aislado.
- Confirmar reglas comerciales de cobertura/tarifa, cambio de efectivo, validación de transferencias y opciones predeterminadas.
- Participar en la comprobación visual de cocina y acordar horario/responsable del piloto.

El desarrollo, generación de casos, pruebas automáticas y preparación de despliegue deben completarse primero. Mercado Pago e impresión automática no bloquean el piloto acordado.

## Aceptación desplegada del candidato

Staging corre el código `97efc842`, imagen verificada, health/DB conectadas y configuración efectivo/transferencia. [Checkout](https://github.com/wilmerx5/PPP-NEST/actions/runs/38084785817) aprobó 14 pasos sin órdenes. [Ciclo de pedido](https://github.com/wilmerx5/PPP-NEST/actions/runs/38084980813) aprobó 20 pasos/webhooks, creó una orden aislada, la canceló y dejó la conversación limpia. CI Nest y MariaDB 11.8 aprobaron 1.174 y 81 pruebas. La recepción visual de cocina, recuperación desplegada y pilotaje siguen abiertos; consultar el registro actualizado en `ppp-pilot-readiness.md`.
