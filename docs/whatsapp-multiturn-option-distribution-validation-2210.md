# Tanda 120 — reparto de opciones entre mensajes

## VIGENTE — tanda 120: reparto de opciones en varios turnos (22/10)

Base 054f45f9, staging. 66 regresiones nuevas, tres menús sintéticos (arroz, hamburguesa, salchipapa), agente simulado on/off. Cuatro unidades: «dos con Uva», luego «los otros con Pepsi», cantidad explícita o sabor solo/con cortesía. Incluye consulta intermedia, opción desconocida, exceso de unidades, índice ambiguo, reinicio, reparto completo corregido y original modificado. 54 recorridos hasta DTO; seis reinicios y seis protecciones de original modificado. Conserva notas/opciones compatibles, carrito original mientras falta reparto y ninguna orden antes de confirmar.

Se reproducían 36/36 fallos iniciales: una elección parcial se aplicaba antes de terminar el reparto. Se guardan grupos en pendingAttribute.distributionParts y se usa el planificador atómico existente al completar la cantidad. El sabor solo completa las restantes; el índice aislado pide nombre para evitar aplicarlo a todas. Una distribución completa nueva sustituye la propuesta parcial. Extensión «Pepsi, por favor»: 6/6 fallos antes de normalizar cortesía. La primera global completa iniciada detectó una regresión del PDF («uno con… y el otro con…» completo); se detuvo y corrigió la prioridad, sin publicar esa versión. El reparto completo conserva su ruta previa.

Validación: foco inicial 696/696 en cinco suites; tras cortesía, 444/444 de combos; reparación histórica + combos 1.170/1.170. TypeScript general/build OK; Node 92/92. Global final 16.387/16.387, 192 suites, inventario exacto y 490 hashes intactos, 587,22 s. No sumar runs de desarrollo como pruebas independientes. Cero API pagada, WhatsApp u órdenes externas.

Publicación en rama staging; pendiente de despliegue agrupado. Servidor conserva e4fdb03a (118/119), imagen ddefc8e4…; acceso público de staging debe seguir activo, eventos de cocina bloqueados. Main/producción preservados. Evidencia: [tanda 120](whatsapp-multiturn-option-distribution-validation-2210.md).

Límites: opciones de un producto ya seleccionado, dependencias/modelo simulados. No acredita inferencia real, reparto libre entre varios productos, notas diferentes por grupo ni contacto mezclado con cada fracción. Siguiente: notas y opciones sobre cada grupo en varios mensajes, corrección de solo uno, tres grupos y distintos atributos (temperatura, término, salsa), con varios menús y DTO. Mantener la validación histórica de repartos completos. No desplegar a Main sin solicitud explícita.

## Evidencia reproducible

- Base: `054f45f9`; implementación general en `src/whatsapp/whatsapp-orchestrator.service.ts` y campo efímero en `src/whatsapp/types/whatsapp-session.types.ts`.
- Regresiones en `src/whatsapp/whatsapp-related-combo-offer.spec.ts`: 11 comportamientos × tres catálogos × agente simulado on/off. Productos/IDs/precios solo en fixtures; ninguna excepción PPP añadida.
- Compra y selección inicial pasan por el router, sin sembrar carrito en los recorridos válidos. Se comprueban respuestas, carrito sin mutación parcial, selección pendiente, cantidades/opciones/notas y DTO de orden simulada. El caso stale cambia deliberadamente la nota del original entre turnos.
- `/tmp/ppp-120-baseline.json`: 36 fallos iniciales.
- `/tmp/ppp-120-courtesy-baseline.json`: seis fallos de cortesía.
- `/tmp/ppp-120-targets-final.json`: 696 aprobadas antes de añadir cortesía.
- `/tmp/ppp-120-related-final.json`: 444 aprobadas, incluida cortesía.
- `/tmp/ppp-120-global-regression.log`: regresión histórica detectada y run detenido. Hubo otro arranque global detenido temprano para añadir el contraste de cortesía; ninguno se acredita como validación final.
- `/tmp/ppp-120-repair.json`: 1.170 aprobadas, combos y suite histórica part-05.
- `/tmp/ppp-120-tsc-final.log`, `/tmp/ppp-120-build-final.log`, `/tmp/ppp-120-node.log`: controles aprobados.
- `/tmp/ppp-120-global-summary.json`: 16.387 aprobadas, 192 suites, 490 hashes, 587,22 segundos, inventario exacto y fuente inmutable.

## Ejecución sin cuellos de botella

Focalizar primero la suite modificada y suites de unidades; ejecutar TypeScript en paralelo antes de congelar. Para global: primero `whatsapp-general-accuracy.spec.ts --runInBand`, después resto con `--maxWorkers=4 --testPathIgnorePatterns=/whatsapp-general-accuracy.spec.ts$`; no ejecutar otras suites ni editar fuente simultáneamente. Comparar inventario `--listTests` con resultados y hashes de fuente. Helper usado: `/tmp/ppp-120-global.py` (temporal, no garantía de persistencia). Los comandos Jest usan mocks y no deben sustituirse por runners de inferencia real.

## Estado de entrega

Cambios validados para publicar en staging; no desplegados en esta tanda. Se agrupará el deploy con la siguiente mejora validada. Preservar `WHATSAPP_STAGING_PUBLIC_CHAT=true`, canal exacto y `STAGING_ORDER_EVENTS_ALLOW` desactivado. No tocar Main, bases, volúmenes ni archivos privados. No declarar listo para venta por el conteo de suites.
