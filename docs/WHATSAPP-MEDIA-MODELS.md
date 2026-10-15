# Modelos de medios y costos — 15/10/2026

Selección: Sol sigue como agente de pedidos; Luna para visión, clasificación y respaldo JSON; GPT-Transcribe para archivos de voz. Validación local y global aprobadas:76suites/5582tests en826.223s,20regresiones nuevas, fuente intacta y TypeScript sin errores. **Desplegado y verificado en staging**, código a591d1f4, 2026-10-15T18:15:50.795454+00:00: running/healthy, imagen activa coincide con candidate, healthHTTP200/DBconnected y cuatro roles efectivos correctos. Main intacta. Revisar la comprobación final del relevo antes de asumir activación.

## Evidencia y alcance

16 solicitudes reales a OpenAI, con entradas sintéticas:6 imágenes (tarjeta individual, carrito PPP, carrito japonés, carta sin selección, comprobante simulado, nueve líneas con cantidades/notas),5 audios (tres órdenes en español generadas por eSpeak, variante telefónica con ruido y silencio),4 clasificaciones y1 saludo de respaldo. Todas pasaron sus controles. No usar «100% de precisión» ni afirmar mejora contra Whisper: no se midió un corpus real ni un A/B acústico. No hay audios originales de clientes disponibles.

Los archivos exactos y sus SHA256 están en `scripts/fixtures/media-models-1510/manifest.json`; el generador Python recrea la familia base y los casos de estrés se conservan en binario. Son tarjetas dibujadas y voz robótica, no capturas/fotos/ruido/acento de clientes. Las salidas reales están en `whatsapp-media-model-output-1510.json`; el reporte completo es `docs/whatsapp-media-model-validation-1510.json`.

Replay gratuito: los carritos de visión PPP y japonés conservaron productos/cantidades/notas; carta sin selección no compró, comprobante no se convirtió en pedido. Los audios de alitas+Pepsi+dirección y sustitución del combo pasaron el router completo aislado sin añadir bebida suelta. Esos dos turnos se resolvieron SIN consultar a Sol (0requests); no sumarlos como nuevas conversaciones reales del modelo de texto. También hay regresión completa de audio silencioso que conserva el carrito y pide repetir.

## Cambios técnicos

- WHATSAPP_VISION_MODEL y WHATSAPP_ASSIST_MODEL separan cargas del agente; Luna usa max_completion_tokens, reasoning_effort=none y sin temperature custom. Límites existentes700/220/1200 respectivamente; sin ampliación. Texto auxiliar ahora tiene deadline12s; medios conservan45s. No se alteran otras familias de compatibilidad.
- GPT-Transcribe usa languages[]=es y keywords[] sanitizados/acotados; no recibe los campos exclusivos del formato anterior language/response_format. Se conserva texto exacto y el protocolo anterior para rollback. No reintentos automáticos de medios.
- Se elimina el sesgo «restaurante de pollo» del prompt de visión.
- Fallo encontrado tras lectura correcta: «código #1» se confundía con número de orden; se excluyen códigos de catálogo etiquetados al buscar órdenes. Otro bloqueo convertía nombre abreviado+SKU explícito en familia ambigua. Las filas seleccionadas cantidad x nombre (código N) se resuelven por identidad validada contra catálogo, conservando notas. Conflictos nombre/código y cero quedan pendientes; una lista inline o un tercer producto escondido en una nota no se consume parcialmente por esta ruta. Sin IDs/nombres/precios de PPP codificados en producción.
- Se hizo perezosa una búsqueda de host de bebida que antes se ejecutaba incluso cuando el SKU ya estaba validado; mismos predicados, sin cambio de regla.

## Costos y Kamppo

La tanda reportó35segundos de audio: tarifa pública USD0.0045/minuto → USD0.002625. Se usan segundos reportados por el proveedor (8/8/8/8/3), no duraciones locales decimales. Seis imágenes:USD0.0015885; clasificación/respaldo:USD0.0002895. Total estimado USD0.004503. Son costos de los medios/apoyo de ESTA muestra; excluyen agente de pedidos, WhatsApp/Meta, geocodificación, infraestructura, impuestos y precios particulares de cuenta. No son una factura.

GPT-Transcribe equivale a USD4.50 por1000minutos a tarifa actual. No fijar una tarifa constante por imagen: varía con tamaño, contexto, salida y reintentos. En estas seis, el promedio estimado fue USD0.00026475; no extrapolar precisión o consumo de fotos reales a partir de tarjetas limpias.

Sol sigue siendo la partida a medir: los dos recorridos previos costaron aproximadamente USD0.026/0.033 con caché abundante, y USD0.11/0.15 si se recalcula el mismo consumo sin caché. Todavía no hay distribución representativa por pedido. Antes de fijar una suscripción Kamppo, medir y atribuir por tenant tokens sin/cache, salida/razonamiento, segundos de audio, intentos fallidos, costos Meta y órdenes atendidas; definir cuotas/excedentes y margen según precio/volumen reales. El registro local de pruebas no sustituye medición productiva por tenant. No afirmar rentabilidad de una suscripción sin esos datos.

## Activación y prueba manual

Staging usa WHATSAPP_AGENT_MODEL=gpt-6.1-sol, WHATSAPP_VISION_MODEL=gpt-6-luna, WHATSAPP_ASSIST_MODEL=gpt-6-luna y WHATSAPP_AUDIO_MODEL=gpt-transcribe. Guardar entorno previo para rollback; Main no se cambia. El ajuste DB histórico no se modifica: los overrides de las cuatro cargas definen los modelos efectivos. Retirar un override vuelve al ajuste anterior, que puede estar deprecado; no hacerlo sin revisar.

Prueba humana: foto real de carrito con cantidades y notas; audio natural de combo de alitas con bebida/dirección; audio con sustitución y cortesías. Revisar carrito, no solo transcripción. Usar staging, no confirmar pedidos externos. Si falla, conservar el original para distinguir percepción de interpretación.

Fuentes oficiales consultadas: https://developers.openai.com/api/docs/models/gpt-transcribe ; https://developers.openai.com/api/docs/guides/speech-to-text ; https://developers.openai.com/api/docs/models/gpt-6-luna ; https://developers.openai.com/api/docs/deprecations . Los modelos elegidos son vigentes y no tienen retirada anunciada en la documentación consultada; ningún proveedor garantiza que nunca cambien.

Evidencia final: /tmp/ppp-media-model-final-full.log, /tmp/ppp-media-model-final-source.json, /tmp/ppp-media-model-final-tsc.log. No se editó código/tests durante la global.

Deploy verificado: `/tmp/ppp-media-model-deploy.log` y `/tmp/ppp-media-model-deploy-verified.json`. Bindings compilados de visión/assist/audio comprobados además de variables de entorno. Imagen anterior `ppp-nest-staging:pre-media-a591d1f4` y entorno privado `.env.staging.pre-media-a591d1f4` conservados para rollback. Solo documentación posterior al código no requiere reconstrucción.
