# Tanda 198: combos plurales y llamadas de resumen

Base e3bd166e, staging. Diagnóstico gratuito; no modifica runtime ni configuración. Los fallos intencionales permanecen en archivos `.repro.ts`, fuera de la global verde. No se midió inferencia real ni ahorro facturado.

## Cobertura y evidencia

`whatsapp-composed-combo-expanded.repro.ts`: 24 recorridos (arroz/pollo, bowl/tofu, pasta/champiñones; singular/plural; opción numérica unida/separada; agente mock off/on), con SKUs componentes competidores. 20 pasan hasta DTO, conservando producto, número de unidades y bebida; 4 fallan antes del checkout: dos combos de bowl muestran selección de variante entre plato simple y combo explícito, carrito vacío. No cambia con 3fresh unido/separado ni agente mock. Los DTO contienen una entrada por unidad, no quantity: el primer intento tenía un oráculo incorrecto en ese punto; fue corregido y no se contabiliza como fallo del bot. No atribuir al modelo real resultados del mock.

`whatsapp-agent-cost-boundary.repro.ts`: 12 contratos objetivo (dos menús, respuestas de419/420/421caracteres, transporte Chat Completions y Responses gpt-6.1-sol). HTTP siempre simulado por módulo; no red. Ocho pasan; cuatro fallan porque421caracteres ejecuta una segunda inferencia exclusivamente para resumir. Las respuestas simuladas conservan nombre/precio y no generan acciones. No prueba calidad del texto real ni ahorro posible de eliminar el resumen.

Resultado conjunto:28verdes/8rojos,36casos nuevos. `/tmp/ppp-198-final.json`, snapshots `/tmp/ppp-198-combo-*` y `/tmp/ppp-198-cost-*`. TypeScript general aprobado; diff check. Última global19718.648/263 sigue válida para runtime sin cambios; no se repite una global por añadir diagnósticos opt-in.

## Hallazgos de costo verificables en código

- WhatsappAgentService permite6iteraciones por turno; requestWhatsappInference puede repetir solicitudes temporales dentro de su deadline. Turnos y toolCalls no equivalen al número de solicitudes facturables. Respuesta perdida por timeout puede haber sido facturada; uso desconocido no debe registrarse como cero.
- La regla reply.length>420 pide otra respuesta con herramientas desactivadas. Prueba Responses:419/420→1solicitud;421→2. No es todavía una optimización aplicada.
- El adaptador WhatsappResponsesBridge fija max_output_tokens3000; el cuerpo Chat anterior usa900. El límite no es consumo y no se debe reducir sin comprobar truncamiento/razonamiento/herramientas.
- El índice completo de productos/opciones se incluye cada turno y el historial se recorta a10mensajes. No eliminar catálogo ni historial a ciegas: una alternativa ausente del contexto puede romper una corrección.
- Producción no registra actualmente tokens/costo por pedido. El promedio previo1,18USD/19órdenes es provisional, no una base suficiente para fijar suscripción.

## Plan ejecutable siguiente

1. **Medir antes de ajustar.** Instrumentar cada intento HTTP en la frontera común: requestId interno, conversación/turno, modelo efectivo, motivo (primera respuesta/herramientas/resumen/recuperación/reintento), estado/latencia, input/output/cache si el proveedor los devuelve. Registrar uso desconocido ante timeout, no0. Sin mensajes, nombres, teléfonos ni credenciales. Cubrir Chat y Responses, múltiples rondas, respuesta incompleta,429ytimeout. Asociar al pedido cuando se crea sin perder consultas abandonadas. Conciliar por proyecto/período contra proveedor, separado de pruebas.
2. **Optimización candidata de resumen.** Reemplazar la segunda llamada cosmética solo donde exista respuesta determinista completa (p.ej. confirmación de acciones verificadas); conservar respuesta informativa completa cuando recortar quitaría precios, condiciones o una pregunta. Antes de aplicar: contratos con2–6platos, notas por unidad, preguntas múltiples, respuestas cortas/largas, acciones previas y errores. Mantener reintentos que reparan compras incompletas. Medir solicitudes evitadas, no prometer ahorro porcentual.
3. **Combos y corrección.** Resolver plural contra nombre completo del catálogo antes de ofrecer familia; reproducir los4bowls y los8pendientes197. Añadir controles de combos ambiguos, agotados, opciones incompatibles y corrección posterior sin duplicar. No resolver seleccionando siempre el primer combo.
4. **Contexto/cache.** Separar instrucciones/catálogo estable de sesión mutable y medir cache leída/escrita antes/después. Validar versión/inventario por restaurante. No activar parámetros de cache de otro modelo ni asumir que todo cache ahorra. Fuente oficial consultada: https://developers.openai.com/api/docs/guides/prompt-caching (25/10).
5. **Validación para piloto supervisado.** Cerrar fallos de cantidades, nombres, dirección y bloqueo de preguntas con replay completo y DTO; luego muestra pequeña de inferencia real con límite explícito y observación. Reportar tasa de cierre sin intervención, errores críticos, costo por conversación y por pedido completado, latencia y consultas abandonadas. El conteo de pruebas no acredita venta.
6. **Rentabilidad.** Con costos medidos, calcular por restaurante: conversaciones mensuales × costo promedio (incluidas las que no compran), más WhatsApp, mapas, infraestructura y soporte. Comparar contra precio y margen deseado; establecer cuota incluida y excedentes antes de ofrecer uso ilimitado. Presupuesto y percentiles deben incluir los turnos largos/reintentos. Aún no se fija precio ni se declara margen confirmado.

Orden de ejecución: medición de consumo → optimización de resumen con controles → combos plurales/recuperación → validación real limitada. Los pendientes191/192/183/184/186 siguen abiertos. Publicar solo staging; sin deploy, Main intacta, cero API/Meta/órdenes externas.
