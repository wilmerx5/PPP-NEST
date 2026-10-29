# Patrones de pedidos por chat: investigación y tanda277

Fecha: 28/10/2026. Alcance: PPP staging; preparación de casos transferibles a Kamppo.

## Evidencia y límites

Se distinguen tres fuentes: los chats reales compartidos por el usuario, investigación pública sobre lengua/conversación digital y ejemplos sintéticos construidos para pruebas. Los ejemplos regionales de este documento no son transcripciones de clientes ni estadísticas de uso. No se encontró en esta búsqueda un archivo público representativo de pedidos de restaurantes de distintas regiones. No se descargaron conversaciones privadas ni audios de terceros.

Fuentes consultadas:

- [RAE, cancelar](https://dle.rae.es/cancelar): incluye tanto anular como saldar una deuda. Justifica distinguir «quiero cancelar el pedido» de «quiero cancelar con efectivo». La entrada no acredita frecuencia de uso por país.
- [El Colegio de México, ahorita](https://dem.colmex.mx/ver/ahorita): puede expresar inmediatez o un momento posterior. «Ahorita te digo» no aporta dirección ni un horario exacto de entrega.
- [ASALE, tinto](https://www.asale.org/damer/tinto): documenta café sin leche en Colombia, Venezuela y Ecuador, además de otros sentidos. Resolver con catálogo y contexto; no convertir globalmente cualquier «tinto» en café o vino.
- [ASALE, sencillo](https://www.asale.org/damer/sencillo): recoge sentidos monetarios y otros, incluido un tipo de sándwich. «¿Tienes sencillo?» y «una hamburguesa sencilla» requieren rutas distintas.
- [Cantamutto y Vela Delfa, 2023](https://doi.org/10.7764/cdi.54.53165): revisión de métodos de recolección de interacciones en WhatsApp; respalda conservar contexto, secuencia y modalidad al construir corpus. No constituye un dataset de pedidos ni una evaluación de PPP.
- [Dorantes et al., UNAM, 2018](https://aclanthology.org/W18-3501/): describe un corpus de WhatsApp recogido entre universitarios en Ciudad de México, con análisis de oralidad, expresiones parentéticas y alternancia de idiomas. Se consultó el artículo, no se incorporó el corpus. Sirve para diseñar variaciones conversacionales; no representa pedidos de restaurantes ni todos los hablantes de México.
- [Glissando, UNED](https://glissando.labfon.uned.es/en/glissandocorpus/taskorienteddialoguesubcorpus): conversaciones orientadas a tareas grabadas en estudio, sobre transporte, universidad y turismo. No se usó como si fueran chats comerciales reales.
- [Universidad de Málaga, COLEMA](https://www.uma.es/grupo-de-investigacion-vernaculo-urbano-malagueno-hum-392/cms/menu/vum/proyectos-y-resultados/pulso-andaluz/corpus-oral-telematico-colema/): referencia de corpus oral telemático. No se escucharon muestras ni se evaluó reconocimiento de acentos en esta tanda.
- [Tu Menú Digital, flujo WhatsApp–POS](https://tumenudigital.mx/ayuda/como-pasar-un-pedido-de-whatsapp-al-pos-y-ver-su-chat-desde-la-caja): ejemplo público de separación entre borrador, datos obligatorios, pedido y atención humana. Es documentación de un proveedor, no prueba comparativa de calidad.

## Corpus local ya disponible

`scripts/fixtures/whatsapp-real-chat-patterns.json` registra 34 bloques de origen y selecciona mensajes anonimizados: consultas con cantidad, referencia sin adjunto, preparación y barrio, dirección por partes, sustituciones, notas de salsas, preguntas durante variantes, pedido multilínea, respuestas con cita y errores de escritura. El campo `automated` diferencia selección pendiente de caso automatizado; esos conteos históricos no equivalen a conversaciones nuevas ni a cobertura regional. La tanda277 no modifica ese corpus.

Conviene ampliar primero estas familias observadas en PPP y luego contrastar expresiones de otros lugares con cada catálogo. No inferir país, dialecto o intención únicamente por un teléfono o una palabra.

## Hallazgos reproducidos y correcciones

En el router de PPP, «quiero cancelar con efectivo» y «quiero cancelar por transferencia» vaciaban el carrito. Ahora estas expresiones completas se interpretan como elección de pago cuando el medio coincide con una etiqueta/palabra configurada. Las preguntas conservan su carácter de consulta. Una expresión con «cancelar con/por/en…» cuyo complemento no coincide pide aclarar pagar o anular, sin modificar el pedido. No se afirma que el pago haya sido recibido.

«Ahorita te digo» podía capturarse como dirección. «Dame un ratito» podía seguir la búsqueda de productos o recibir una petición de nombre. Las solicitudes completas de espera ahora conservan los datos y el estado durante nombre, dirección, teléfono, pago y revisión final. La regla no absorbe mensajes que contienen datos adicionales, ni interpreta «ahorita paso a recoger» como espera.

La primera ejecución global detectó que la aclaración nueva interceptaba «Cancelo con 100mil», un caso de cambio ya soportado. Se preservó esa ruta para declaraciones completas de billete y se añadieron seis controles (agente simulado off/on); la suite global se repitió sobre las fuentes finales.

El baseline ejecutó 32 casos nuevos: 32 fallaron sus contratos esperados. No fueron 32 corrupciones de datos: algunos fallaron solo por la respuesta. Después se añadieron 27 controles, total 59 casos nuevos: dos cartas sintéticas, agente simulado activado/desactivado, cancelación real, consulta de pago, espera ante confirmación, mensajes compuestos y palabras de pago configurables. Los dobles de prueba no acreditan el comportamiento del modelo real ni del transporte de WhatsApp. Resultados finales en `whatsapp-batch-277-validation.json`; despliegue en archivo separado.

## Siguientes tandas, por consecuencia

1. **Mensajes por partes y reparaciones.** Secuencias «dos almuerzos» → «uno sin arroz» → «no, el otro»; «Natalia» → «voy»; cierre y barrio en mensajes separados. Verificar el resultado completo y el siguiente paso, además de duplicados y orden de llegada. Priorizar datos y unidades correctos sobre una respuesta amable.
2. **Catálogo local y palabras ambiguas.** «Tinto», «refresco», «soda», «gaseosa», «jugo/zumo», «para llevar/recoger/retirar». Los términos son candidatos sintéticos a contrastar; no todos son equivalentes en todos los negocios. Probar cartas con cero, una y varias coincidencias. Los alias deben pertenecer al restaurante y no inventar disponibilidad.
3. **Cantidades y distribución.** «Un par», «unos», «dos de esos», «uno para cada uno», «el de pechuga», combo con bebida incluida frente a bebida adicional. Pedir lo mínimo cuando falte cantidad o referencia, conservar las notas por unidad y no duplicar productos.
4. **Precio y cierre informal.** «No maa», «eso sería», «cuánto llevo», «cuánto queda todo», «con domicilio cuánto». Comprobar subtotal, recargo y siguiente dato pendiente; nunca convertir una consulta en dirección o confirmación.
5. **Pago y cambio.** «Cancelo con…», «¿reciben…?», «ya pagué», «tiene sencillo», «pago con uno de cincuenta». Separar pregunta, elección, billete y comprobante; no validar transferencias por una afirmación del cliente. Los casos nuevos de sencillo quedan pendientes; se conserva el comportamiento ya existente de billetes con controles explícitos.
6. **Tiempo, dirección y destinatario.** «Ahorita», «más tardecito», barrio/conjunto, nomenclaturas abreviadas, ubicación más apartamento. No inventar una hora ni geocodificar texto conversacional; conservar el pin al aclarar un lugar.
7. **Después de confirmar.** Salsas, corrección de dirección, cancelación y seguimiento del pedido reciente. No responder siempre con el estado ni asegurar cambios que cocina no recibió.
8. **Medios y canal.** Audio transcrito, negaciones, importes, acentos y ruido; reacciones; reintentos y eventos fuera de orden. Requieren una tanda de integración aparte: las pruebas de texto no acreditan voz ni Meta.

## Criterio de calidad

Cada caso debe fijar carrito, cantidad, variantes/notas, total, estado y respuesta. Invariantes: ninguna compra involuntaria, ningún borrado ambiguo, ninguna confirmación por pregunta y ninguna dirección tomada de una conversación sin datos de ubicación.

Mantener una muestra reservada de conversaciones completas, diferente de los casos usados para ajustar reglas. Rotular origen y anonimizar antes de guardar nuevos chats. Comparar fallos por familia y gravedad, no solo el número total de tests. El abandono no demuestra por sí solo un fallo del bot ni una mejora posterior de conversión.

El bot no aprende automáticamente de clientes en producción: se revisan ejemplos, se reproducen fallos y se incorporan correcciones verificadas. Migrar a Kamppo junto con fixtures y contratos de comportamiento; pasar tests en PPP no acredita automáticamente el adaptador de Kamppo.
