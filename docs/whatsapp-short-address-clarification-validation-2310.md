# Tanda 152 — aclaración corta de dirección

## VIGENTE — tanda152: aclaración corta de interiores (23/10)

Base c5aa493d, solo staging.20 casos nuevos:12 conversaciones en tres menús con agente simulado on/off y8 contratos de componentes. Baseline12/12 falló: «708» no recuperaba la calle contradictoria pendiente. Se conserva fuente/etiqueta/valores en sesión; una respuesta corta resuelve solo el componente ofrecido, conserva conjunto/torre y permite una consulta de precio intermedia. Número no ofrecido, etiqueta diferente y confirmar no eligen un apartamento ni crean orden. Dirección completa corregida limpia pendiente; tryConfirmOrder protege también entrada directa con skipFinalConfirm. La limpieza usa undefined porque saveSession real fusiona el patch.

Foco44/44, TypeScript general/build OK, Node92/92. Global17.275/17.275,220suites,518hashes,834,79s; inventario exacto/fuente congelada. /tmp/ppp-152-global-summary.json. Cero API pagada/Meta/órdenes externas. Publicación staging; sin deploy para agrupar. Último servidor verificado2f7f9d86 (150–151); Main/producción intactas. Ver whatsapp-short-address-clarification-validation-2310.md.

Límites/próximo: primer mensaje compra+dirección contradictoria, cambio a recogida o ubicación GPS durante el pendiente, coexistencia con elección de producto/opción y caducidad. En particular comprobar que el nuevo pendiente no impida cerrar recogida cuando ya no necesita dirección; no acreditar este escape sin prueba. Solo respuesta corta con valor ofrecido o dirección numerada completa. Mapa/modelos simulados; validación real acotada sigue pendiente según whatsapp-api-validation-next-2310.md. No declarar vendible por conteos.

## Evidencia y procedimiento

- Baseline: /tmp/ppp-152-baseline.log,12 fallos. No acreditar como cobertura verde.
- Foco final: /tmp/ppp-152-final-focus.log,44/44,41,666s. Incluye12 casos de151 y12 de150; no sumarlos como nuevos.
- TypeScript: /tmp/ppp-152-tsc.log (general y build); Node: /tmp/ppp-152-node.log,92/92.
- Global: /tmp/ppp-152-global.py, burst80 + resto17.195, inventario exacto220suites. /tmp/ppp-152-hashes.json conserva518 hashes; fuente congelada. /tmp/ppp-152-global-summary.json.
- Pruebas de conversaciones verifican respuesta, carrito conservado, ausencia de cotización prematura, consulta de precio, rechazo de999/torre708/confirmar, bloqueo de confirmación directa, resolución y DTO final con una unidad/dirección completa. Casos con dirección completa de151 conservados.
- Los8 contratos cubren apartamento, interior, torre, bloque, casa, piso, local y entrada; conservan calle y oficina no afectada.

## Continuación

Antes de desplegar el nuevo pendiente, reproducir cambio a recogida y GPS, reinicio/cancelación, sesión con dirección válida anterior y dos elecciones simultáneas. Mantener estado explícito, no añadir excepciones por conjuntos/productos. Elegir foco pequeño primero; no ejecutar dos Jest a la vez. Si cambia runtime compartido, TS general/build, scripts y global con fuente congelada. No publicar ni desplegar afirmando cobertura de esos escapes hasta verificarla. Este lote acredita únicamente aclaración de interior durante domicilio.
