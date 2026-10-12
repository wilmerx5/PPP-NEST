# PPP: plan para piloto y producto comercial

Estado al 11 de octubre de 2026. Documento de trabajo; no es certificación ni promesa de fecha. Las metas numéricas siguientes son propuestas para PPP, no estándares atribuidos a marcas grandes.

## Resultado que buscamos

Un restaurante puede recibir pedidos por WhatsApp, comprobar un resumen fiable y corregirlo, con cantidades, variantes, notas y dirección conservadas. El sistema pregunta cuando falta información y permite atención humana. No promete autonomía total ni acepta políticas comerciales que el negocio no haya configurado.

Primera oferta: piloto supervisado en PPP, efectivo y transferencia. Segunda oferta: servicio comercial repetible para restaurantes. Kamppo multitenant es una etapa posterior con aislamiento y configuración por negocio acreditados.

## Estado verificado y límites

- Último full gratuito: 65 suites y 1.819 pruebas aprobadas; incluye regresiones de cantidades, notas, referencias, ráfagas, pausas y dos catálogos. Gran parte usa modelo, Meta y persistencia simulados.
- Última tanda: cinco conversaciones aceptadas, dos con inferencia real y tres deterministas; siete llamadas API. No equivale a cinco chats completos con modelo ni a mensajes reales de Meta.
- Presupuesto acumulado: 40 intentos autorizados, 25 usados, 15 disponibles. Fuente autoritativa: docs/whatsapp-model-budget.json. Cambia con cada intento; comprobar antes de ejecutar.
- Texto e imágenes: gpt-4.1-2025-04-14 en ambos entornos según última lectura; audio: whisper-1. Mismo modelo no elimina diferencias de código/configuración/catálogo.
- Staging integra el trabajo y las pruebas: HEAD base3cc51a05. Último código desplegado3a0914cc, saludable. Main publicada5525e502; las tandas posteriores no están promovidas. No acreditar versión de producción solo por Git.
- PDF privado: índice con24 patrones ejercitados y2 pendientes; las pruebas posteriores cubren partes de esos pendientes. No hemos reproducido todo el PDF con inferencia real.
- Preflight del canal real aprobó acceso, destinatario e aislamiento; webhookPosts=0. No acreditó una conversación real ni percepción de audio/imágenes.

## Qué hacen plataformas grandes y qué aplicaremos

[AWS Lex Test Workbench](https://docs.aws.amazon.com/lexv2/latest/dg/test-workbench.html) permite crear conjuntos de referencia a partir de transcripciones, medir intención y datos capturados, y comparar bots antes o después de desplegar. Aplicación PPP: medir el pedido por turno, no solo frases agradables; mantener conjuntos de desarrollo y casos reservados.

[Google Dialogflow: test cases](https://docs.cloud.google.com/dialogflow/cx/docs/concept/test-case) guarda expectativas de una conversación y vuelve a comprobarlas tras cambios, incluyendo herramientas y estado. Aplicación PPP: carrito, variantes, dirección, pago, respuesta y llamadas deben tener oráculos explícitos. La redacción puede variar sin cambiar el resultado comercial.

[Intercom: fuentes de conocimiento](https://www.intercom.com/help/en/articles/9440354-knowledge-sources-to-power-ai-agents-and-self-serve-support) organiza información para las respuestas del agente. Aplicación PPP: disponibilidad, precios, tamaños, rendimiento, cambios de acompañamientos y políticas salen del negocio; no de una suposición del modelo.

[Intercom: colaboración AI-humano](https://www.intercom.com/learning-center/ai-human-collaboration-procedures-handoffs) describe condiciones de transferencia y evaluación de esa colaboración. Aplicación PPP: al pedir una persona o atascarse, conservar contexto y pedido; evitar que el bot siga modificándolo. Estas son prácticas documentadas de proveedores, no conocimiento de la operación interna de todas las marcas.

## Paso1: cerrar comprensión con evidencia

Responsable principal: agente de desarrollo. Prioridad inmediata; no requiere rehacer integraciones de cocina.

1. Completar reparto atómico de presa/sopa/acompañamiento en dos ejecutivos y ráfaga pedido/dirección/barrio.
2. Probar invalidación de aclaraciones cuando cambia el carrito, referencias antiguas y cambio de intención.
3. Mezclar imagen/audio/texto en secuencia; distinguir pedido de foto de menú, consulta y comprobante.
4. Preparar casos reservados nuevos por patrón y otro catálogo; no incluirlos en prompts ni considerarlos reservados después de corregir con ellos.
5. Usar las15 llamadas restantes en tandas pequeñas con inferencia real, tope de intentos y parada ante fallo; contabilizar también fallos. No agotar presupuesto para repetir caminos deterministas.

Salida exigida: regresiones gratuitas necesarias verdes, cero defectos críticos conocidos en el alcance del piloto y un informe que distinga simulación, API real y Meta real. Un defecto crítico agrega/quita/cambia unidades o productos sin autorización, pierde una corrección, inventa un precio o mezcla clientes.

## Paso2: validar voz, fotos y el canal

Responsables: agente ejecuta; Wilmer aporta archivos y ayuda a observar recepción.

- Recoger3–5 audios originales iniciales y su transcripción esperada, con ruido, pausas, cortesías y correcciones. Añadir más muestras si aparecen fallos; esa pequeña muestra no acredita calidad general.
- Comparar whisper-1 y candidato gpt-4o-mini-transcribe con los mismos archivos. Puntuar producto, cantidad, opciones, notas y dirección por separado; medir latencia y coste. No cambiar ambos entornos sin comprobar la mejora.
- Usar imágenes originales seleccionadas y verificar todos los productos, cantidades y opciones; no aceptar carritos truncados.
- Ejecutar inbound firmado y outbound real únicamente al destinatario autorizado, sin confirmar pedidos. Este método prueba backend y envío Meta; no demuestra que un teléfono origine correctamente el evento. Añadir después mensajes auténticos desde el teléfono.
- Implementar primero un límite efectivo de inferencia del ensayo en el backend. El runner real de11pasos no limita hoy las llamadas del modelo; no activarlo suponiendo que todo será gratuito.
- Probar ráfagas, pausa, reintento del mismo ID, recepción concurrente y una sola respuesta útil cuando corresponda.

Salida: informe con archivos/eventos utilizados, resultados por turno, cero duplicados y cart final verificable. No afirmar entrega porque Meta aceptó la petición; comprobar recepción/estado cuando sea posible.

## Paso3: preparar un piloto supervisado

Responsables: agente prepara versión y observabilidad; Wilmer define cobertura humana y condiciones comerciales.

- Promover una versión concreta y validada de staging a Main cuando se solicite; conservar staging. Verificar código/configuración/modelo/catálogo desplegados y disponer de reversión.
- Definir quién toma conversaciones, horario de atención humana y qué ocurre cuando el bot no está seguro. No inventar teléfono ni prometer tiempos/rendimientos desconocidos.
- Registrar versión, duración, intentos de modelo, modificaciones de carrito, aclaraciones y motivo de intervención, sin guardar claves ni divulgar datos privados.
- Antes de cobrar por operación autónoma, hacer una comprobación mínima del pedido extremo a extremo con el local. Cocina dada por observada en la sesión no equivale a una garantía operativa; no reabrir su implementación ahora.

Salida: versión identificada, responsable disponible, parada/reversión comprobadas y resumen comercial confirmable.

## Paso4: piloto y decisión de venta

Propuesta inicial: observar100conversaciones que realmente intenten pedir, distribuidas en varios días y horarios. Revisar todas durante el piloto. Incluir casos fáciles y difíciles; registrar consultas y abandonos por separado. No seleccionar solamente éxitos.

Criterios propuestos para avanzar a venta asistida:

- Cero errores críticos sin detectar en la muestra; cualquier incidente pausa expansión, recibe regresión y exige nueva observación focalizada.
- Al menos95% de pedidos con resultado comercial correcto, incluyendo intervención humana exitosa. Reportar aparte la tasa sin ayuda; no inflar autonomía contando atención humana como bot.
- Todas las solicitudes explícitas de persona permiten intervención y conservan el contexto. Medir si el humano pudo realmente atender, no solo si apareció un mensaje.
- Registrar latencia mediana/p95, repreguntas evitables y coste por conversación terminada. Objetivo provisional p95de15segundos para turnos de texto, sujeto a línea base y red; es una meta, no un resultado observado.
- Medir retorno: tiempo ahorrado al local, pedidos recuperados, abandono y trabajo de soporte. Si solo pasa tests pero aumenta trabajo humano, no ampliar venta.

La muestra no demuestra ausencia de fallos futuros. No calcular un porcentaje de «producto terminado» a partir del número de tests. Revisión del piloto decide qué funciones quedan asistidas, cuáles se ofrecen y cuáles se excluyen.

## Paso5: servicio vendible y Kamppo

- Onboarding reproducible: canal, catálogo, variantes, valores por defecto, disponibilidad, domicilios y políticas. Definir quién mantiene esos datos.
- Condiciones claras: alcance, horario de soporte, consumo incluido/límite, responsabilidad operativa, acceso a conversaciones y procedimiento de baja. No prometer «entiende todo».
- Propuesta de cobro: instalación/onboarding y mensualidad con consumo acotado. Fijar precio después de medir API, Meta, infraestructura y soporte; no publicar cifras de margen inventadas.
- Separar reglas generales y contratos de fixtures. Kamppo reutiliza invariantes y suites con adaptadores de catálogo/configuración; no copia nombres/IDs/precios PPP al motor.
- Antes de varios negocios: pruebas de aislamiento de sesiones, catálogo, precios, credenciales, pedidos, puntos y eventos; ninguna lectura/modificación entre tenants. Dos menús sintéticos solo acreditan portabilidad del lenguaje, no multitenancy operativa.
- Cada release lleva referencia de código, configuración/modelo, validación, cambios y reversión. Cada incidente pasa al corpus sanitizado; reservar escenarios nuevos para evitar sobreajuste.

## Lo que necesitamos de Wilmer

No bloquea continuar simulaciones: audios/imágenes originales; validar políticas de cambios, rendimientos, pedido futuro y abonos; designar atención humana para piloto; observar recepción desde su WhatsApp; autorizar promoción/deploy cuando la versión esté preparada; decidir oferta y precio usando costes medidos.

## Registro y regla de avance

Relevo técnico: docs/AGENT-HANDOFF-WHATSAPP.md. Próximas tandas: docs/whatsapp-next-batches.md. Fuente PDF sanitizada: scripts/fixtures/whatsapp-pdf-1110-patterns.json. Presupuesto: docs/whatsapp-model-budget.json.

Próxima acción concreta: cerrar los dos patrones PDF pendientes gratis, luego un conjunto reservado focalizado con API real y por último canal real con límite de gasto. Actualizar este plan con resultados y denominadores, nunca sustituir «pendiente» por una promesa.
