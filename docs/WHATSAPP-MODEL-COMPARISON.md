# Reemplazo de modelo: selección y validación, 15/10/2026

## Decisión

Modelo elegido para la etapa de calidad del agente de pedidos: **gpt-6.1-sol**, esfuerzo low, Responses API, salida máxima 3000 tokens por propuesta (incluye razonamiento), deadline original del turno 25 segundos. No se amplió el plazo para disimular lentitud. Selección reversible por `WHATSAPP_AGENT_MODEL`; si no existe, se usa el ajuste compartido anterior. No hay un ganador estadístico: la muestra es pequeña y de desarrollo. Luna sigue siendo candidato de costo para una comparación más amplia.

El despliegue y activación siguen pendientes de la global final al escribir este apartado. Revisar el estado vigente del relevo antes de asumir que ya están activos. No se cambia Main/producción en esta tanda.

## Evidencia de modelos reales y costos

`docs/whatsapp-model-comparison-1510.json` conserva resultados/uso/latencias y distinciones entre runs; las conversaciones y catálogos son fixtures sintéticos versionados. Solo inferencia fue real: router, catálogo, guardas y carrito locales; persistencia, Meta, mapas, pagos y órdenes externos aislados. No es una validación de WhatsApp, visión ni voz real.

Sol pasó dos conversaciones completas de tres turnos con dos cartas:
- Carta vegetal: compra condicional con producto ausente, cambio de salsa y nota solo al wrap, consulta del total. 6 requests, USD0.025812 reportados. Primera respuesta14.866ms; otros dos turnos deterministas.
- PPP: dúo con Coca Cola Zero y dos sopas sin arroz, ausencia de flan sin reemplazo, consulta de precio por sopa, cambio a Pepsi sin bebida suelta. 7 requests, USD0.0325505 reportados. Turnos17.687/29/6.450ms. Reensayo de desarrollo tras corregir guardia de host y prefacio de precio; no holdout independiente aprobado.

GPT-4.1 pasó el primer recorrido en3requests y USD0.030006, primera respuesta4.735ms. Distintos cachés: no inferir que Sol siempre será más barato. Con las mismas cantidades de tokens de esos dos recorridos Sol pero sin entrada cacheada, la estimación sería USD0.112794 y USD0.154844. Son escenarios sobre estos recorridos, no pronóstico de tráfico ni límite de gasto por pedido.

Luna recibió/propuso productos y opciones correctos. Sus salidas «El flan no lo manejamos» y una omisión de brownie fueron descartadas por el renderizador, que solo admitía otras formulaciones. Otro run falló una referencia de precio ANTES del modelo. No atribuir estos fallos a menor comprensión de Luna ni declarar que Sol es superior por ellos. En la fuente corregida pendiente de render final, Luna pasó el primer carrito PPP; se detuvo por ausencia de la explicación visible, sin ejecutar los otros turnos. No hay conversación completa Luna aprobada todavía.

Ocho runs consumieron38intentos del registro, uno de ellos falló al preparar el puente antes de red. Suma de estimaciones sobre tokens reportados: USD0.125462 (no factura). Estimaciones de texto Standard; excluyen Meta, mapas, audios/imágenes, otros cargos, impuestos y precios específicos de cuenta. Uso faltante nunca se toma como cero.

Precios de texto consultados el15/10, por millón de tokens entrada/cache/salida: GPT-4.1=2/0.5/8; Sol=2/0.1/10; Luna=0.1/0.01/0.5. Las tarifas futuras pueden cambiar. Ver fuentes oficiales al final.

## Implementación y errores encontrados

- `whatsapp-responses-evaluation.ts` conserva items crudos, razonamiento cifrado y enlaces call_id; prepara store:false y strict:false explícito para conservar campos opcionales. No ejecuta herramientas ni HTTP. Rechaza propuestas incompletas/refusals/llamadas malformadas antes de exponer herramientas.
- `whatsapp-responses-bridge.ts` mantiene las rondas del turno y convierte la salida al contrato del agente existente. Un fallo inicial seleccionaba una continuación anterior en tercera ronda; corregido y reproducido gratis. Requests repetidos por reintento reutilizan la misma preparación.
- `whatsapp-agent.service.ts` selecciona Responses para gpt-6 y conserva Chat Completions para los modelos anteriores. Herramientas y guardas siguen ejecutándose en Nest. El HTTP acotado permite ambos endpoints de forma explícita.
- La búsqueda resolvía un dúo como host de bebida, pero add_item lo rechazaba en favor de la gaseosa suelta por faltar un sufijo del nombre del catálogo. La validación ahora acepta la misma evidencia de host que search_menu, conservando los demás guardas. Reproducción roja y verde con PPP y una carta de arepas ficticia.
- Preámbulos de una consulta de precio se colaban en el identificador buscado. Se limpian antes de resolver referencias al carrito: ocho contratos de cuatro preámbulos por dos cartas. Baseline6rojos/2verdes, final8verdes.
- Renderizador amplía las formulaciones de indisponibilidad conservadas junto al acuse validado: cinco contratos, baseline4rojos/1verde, final5verdes. No crea productos ni altera cantidades.
- Se preservaron y se integran para validar cuatro archivos que ya tenían cambios locales (detalle de rechazo de una variante del mismo SKU y sus pruebas). No se atribuyen a la migración.

## Activación y rollback

Solo después de aprobar global y TypeScript, publicar staging, desplegar su compose y configurar `WHATSAPP_AGENT_MODEL=gpt-6.1-sol` en `.env.staging` privado. Verificar HEAD, imagen activa, health y variable efectiva. No cambiar `.env` de producción. Para rollback del agente, retirar la variable y recrear únicamente api con el compose/proyecto staging; volverá al ajuste compartido previo. El código de modelos anteriores permanece disponible.

El ajuste compartido de texto/visión no se cambia a ciegas: visión continúa con gpt-4.1-2025-04-14 hasta su comparación multimodal; audio verificado en runtime whisper-1. Cambiar solo el agente NO completa la retirada de GPT-4.1 en todos los servicios. Hay que migrar también clasificación/visión antes de la retirada anunciada14/01/2027. No activar un modelo distinto en visión con sus límites de220/700 tokens sin verificar JSON, imágenes y razonamiento. No hay audios originales para medir precisión acústica.

## Pendientes para piloto

1. Más conversaciones completas, independientes, mismo código/caché comparable por candidato. Medir exactitud de carrito/opciones/notas, respuesta visible, continuidad y costo total, no solo prosa. Separar turnos deterministas de inferencia.
2. Reducir rondas y latencia17–19segundos en compras compuestas sin quitar verificaciones. El costo de tokens cabe en esta muestra; todavía no hay distribución p50/p95 ni costo representativo por pedido de cliente.
3. Completar Luna con render corregido; evaluar imágenes/clasificación aparte y voz con originales. Comparar transcriptor separado, no atribuir pérdida de producto a reconocimiento sin transcripción completa.
4. Cerrar el caso adicional detectado gratis: compra de un solo paquete con preámbulo y condición «si no hay/venden…» puede quedar clasificada question_not_order (la misma familia con dos cantidades pasa). No se declara resuelto por el contrato del host, que aísla dos cantidades. Mantener el caso en la siguiente tanda; no ocultarlo como fallo del modelo.
5. Regresiones de interrupción/corrección en todos los estados, identidad de variantes rechazadas y aclaración persistente; replay de chats reales. Solo después, piloto supervisado. No declarar vendible por el número de tests.

Fuentes: https://developers.openai.com/api/docs/guides/migrate-to-responses ; https://developers.openai.com/api/docs/models/gpt-6.1-sol ; https://developers.openai.com/api/docs/models/gpt-6-luna ; https://developers.openai.com/api/docs/models/gpt-4.1 ; https://developers.openai.com/api/docs/deprecations .

La conservación de frases de indisponibilidad es una corrección intermedia del render, no una solución semántica completa. Próxima evolución: representar pendientes/ausencias con evidencia de catálogo en un contrato estructurado y renderizarlos junto con los efectos aplicados; no depender indefinidamente del orden de palabras de la respuesta del modelo. Evitar nuevas excepciones por nombres de platos o restaurantes.

Para repetir la comparación, ejecutar el runner aislado con clave privada, `WHATSAPP_BETA_LIVE=1`, modelo y tope explícitos, fixtures versionados y STOP_ON_FAILURE=1. Debe estar ausente WHATSAPP_AGENT_MODEL en el entorno del runner para no sobreescribir el candidato. No introducir claves en comandos, repositorio ni reportes. El presupuesto y su espejo se registran antes de cada intento y se sincronizan al cerrar la ejecución.
