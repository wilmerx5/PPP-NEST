# Tanda 199 — consumo por intento de inferencia

Base b4d2397a. Solo staging; implementación inicial de observabilidad del agente textual. No cambia modelo, límite de tokens, historial, reintentos, herramientas ni comportamiento de compra.

## Qué se registra

En `whatsapp-openai-request`, callback opcional por intento HTTP, después de recibir el cuerpo completo o al fallar transporte: UUID de solicitud, número de intento, API, estadoHTTP, resultado, latencia y contadores del proveedor. Reintentos comparten solicitud; cada ronda del agente tiene solicitud nueva. Un timeout queda usage=null porque pudo facturarse sin devolver respuesta. Rechazos o uso ausente también son desconocidos, no cero.

Lectura compatible con usage de Chat Completions y Responses: entrada/salida, entrada leída de cache, escrita en cache y razonamiento. Ausente/inválido→null; cero explícito se conserva. Razonamiento es desglose de salida, NO se suma otra vez. Los desgloses fuera de su total se marcan desconocidos. No se calculan dólares con tarifas incrustadas ni se atribuye ahorro.

Agente emite `event=whatsapp_inference_attempt` con conversationId interno, inferenceTurnId aleatorio, modelo solicitado efectivo, iteración y motivo:initial,tool_results,summarize,recover_incomplete_order,recover_unapplied_order. Orquestador proporciona conversationId. No se registran cuerpos, mensajes, nombres, teléfonos, claves ni errores arbitrarios. El callback de log no puede interrumpir la compra si lanza un error.

`modality=text` describe esta inferencia textual; no identifica si el usuario envió antes un audio transcrito. Todavía no instrumenta transcripción, visión, ai_legacy ni otros consumidores OpenAI. No es un ledger completo de la cuenta. Asociación a orderId y coste monetario pendiente; conversationId agrupa actividad incluso sin orden, pero una conversación puede contener varios pedidos y requiere delimitación por sesión para atribuir costo a cada uno. Datos son logs estructurados, no tabla persistente nueva.

## Verificación

29 nuevas pruebas: normalización de ambas APIs, ausencias y valores inválidos, ceros explícitos, desgloses imposibles, respuesta legible tras medición,429temporal+reintento,timeout+éxito,errortransporte,sinkroto,JSONmalformado y dos recorridos completos del agente con resúmenes y correlación. HTTP simulado: cero solicitudes pagadas.

Foco90/90 (29nuevas+48agente+13transporte), /tmp/ppp-199-focus.json. TS general/build aprobados; Node92/92. Global18.677/264suites,572hashes,708,56s; inventario exacto y fuente congelada. Evidencia /tmp/ppp-199-global-summary.json. Ambas fases aprobadas.

Fuente de referencia: [conteo de tokens oficial](https://developers.openai.com/api/docs/guides/token-counting), consultada25/10. No se usa un estimador local como sustituto de usage facturado.

## Cómo usar al desplegar esta versión

Buscar el evento `whatsapp_inference_attempt` en logs de staging. Deduplicar por requestId+attempt; agrupar por conversationId e inferenceTurnId. Contar todas las solicitudes, incluidas usage=null, por motivo y resultado. Sumar entrada/salida y sus desgloses por separado; nunca presentar desconocidos como gratuitos ni sumar razonamiento dos veces. No extrapolar el promedio de tokens a dólares sin modelo/tarifa/período y conciliación con proveedor. Un coste de pedido debe incluir correcciones y conversaciones abandonadas en los costos operativos del restaurante.

Siguiente: herramientas, reintentos y resumen cuentan ya como solicitudes distintas; extender cobertura a otras rutas y vincular sesiones/órdenes. Medir muestras reales antes de optimizar. La segunda llamada cosmética sigue existiendo; esta tanda la hace visible, no la elimina.

## Retomar combos plurales

Los4fallos198 de bowl llegan a `whatsapp-orchestrator.service.ts`, rama orderQty>=2: ofrece findProductVariantFamily antes de respetar un match fuerte por nombre completo. Hipótesis localizada por respuesta y lectura del código, aún no fix. Próximo: contrato inequívoco frente a ambigüedad real, agotados, nombres duplicados y opciones incompatibles. Conservar pruebas197de composiciónPPP y diagnóstico198. No tocar esa regla durante la global199.
