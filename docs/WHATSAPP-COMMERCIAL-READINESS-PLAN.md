# PPP: estado y plan para piloto y venta

Actualizado el 13 de octubre de 2026, America/Bogota. Plan de trabajo, no certificación de calidad ni promesa de fecha. Las cifras de aceptación son propuestas para PPP.

## Decisión actual

Estamos en validación previa a un piloto supervisado. Las correcciones del chat Banderas y de continuidad de menús pasan pruebas aisladas en staging; queda acreditar esos recorridos con modelo y canal reales antes de iniciar piloto con clientes. Podemos hacer ensayos controlados de texto con participantes conocidos; todavía no acreditar un lanzamiento autónomo. No necesitamos esperar a cubrir todo el lenguaje para iniciar un piloto acotado, pero sí cerrar los defectos críticos conocidos del alcance, comprobar el canal real y disponer de intervención humana.

Primer alcance propuesto: PPP, pedidos inmediatos por texto, catálogo y domicilios configurados, efectivo y transferencia. Audio, fotos, reservas, abonos, redenciones y sustituciones con recargo quedan asistidos o fuera del alcance hasta acreditar su recorrido. Excluir una función requiere explicar esa limitación al cliente y ofrecer atención humana comprobada; no basta escribirlo en este documento.

## Dónde estamos: evidencia y límites

- Backend: 66 suites / 3.227 pruebas aprobadas, TypeScript aprobado. Verificación completa en una ejecución: /tmp/ppp-cancel-courtesy-edit-full-final.log,307.352s. Incluye la tanda de básicos/extras y continuidad con pausas. Incluye cantidades, notas, opciones, correcciones, consultas, ráfagas, referencias, direcciones y pedidos completos. No todas las pruebas son conversaciones; gran parte simula modelo, Meta y persistencia.
- Tanda posterior de pruebas, sin cambios de runtime:68 casos nuevos; suite general afectada1484/1484 aprobada y TypeScript aprobado. Cubre consultas durante captura de nombre/teléfono/dirección, negocio cerrado y respuestas cortas con/sin elección pendiente en catálogos ficticios. Log /tmp/ppp-fields-closed-short-suite.log. No equivale a una nueva ejecución global ni acredita el modelo real.
- Interrupciones:96 nuevos recorridos de precio,total,recap y corrección de cantidad durante captura de datos/pago, con continuación del dato pendiente. Dos catálogos ficticios y agente simulado activo/inactivo. No acredita todas las intenciones posibles ni canal/modelo reales.
- Generalización: menús ficticios vegetarianos, marinos y orientales; hamburguesas, pizzas y bowls sin conceptos de ejecutivo/menú. Las últimas dos tandas añadieron39 casos y encontraron errores reales en correcciones y alcance. Esto acredita esos patrones en esos catálogos; no cualquier restaurante ni aislamiento multitenant.
- Versión validada y desplegada de código: 0508049d en staging, running/healthy, imagen activa igual a candidata y health ok/DB connected. Verificada el 13/10 a las 14:32 Bogotá; una actualización documental posterior no requiere reconstruir API.
- Producción: esta última tanda no se promovió. No asumir paridad entre producción y staging por usar el mismo modelo. La versión efectiva de producción debe comprobarse al preparar promoción.
- Modelo configurado según última lectura: gpt-4.1-2025-04-14 para texto/imágenes en ambos entornos, whisper-1 para audio. No se volvió a verificar configuración efectiva durante la tanda gratuita final.
- API real: última tanda documentada, cuatro conversaciones aceptadas; dos usaron inferencia y dos fueron deterministas, diez solicitudes incluyendo la ejecución limitada y su continuación. Se evaluaron antes del último ajuste de presentación de propuestas vacías; no acredita todavía la nueva tanda local de desistimiento y compra. Presupuesto vigente40 autorizadas/35usadas/5restantes en docs/whatsapp-model-budget.json; contabilizar cada intento, incluidos fallos/reintentos.
- Canal: el preflight documentado verificó acceso/destinatario/aislamiento, con webhookPosts=0. No es una prueba de mensajes originados y recibidos por un teléfono.
- PDF:26 patrones ejercitados en backend, no todos los chats/variantes ni percepción real de los archivos. Audio e imágenes originales siguen pendientes de una evaluación representativa.

## Qué falta, en orden

### 1. Cerrar la siguiente tanda gratuita

Responsable: agente. Usar router real con dependencias externas simuladas, carrito/estado/respuesta como oráculos y catálogos PPP y ficticios.

1. Cobertura: una tarifa calculada no demuestra que el domicilio esté en zona. Revisar preguntas con calle numérica y tarifa fija; pedir ubicación o aclaración cuando no haya evidencia geográfica suficiente.
2. Opción que no existe: no declarar un cambio ni inventar variante/precio.
2. Pregunta condicional o de precio: no comprar ni modificar por preguntar «¿se puede con…?» o «¿cuánto cuesta cambiar…?» sin intención de cambio inequívoca.
3. Cambio durante cierre: modificar dirección, cantidades, notas y opciones conservando los otros datos; recalcular resumen y volver a pedir confirmación cuando corresponda.
4. Precio y permisos: el contrato del catálogo debe distinguir opción sin recargo, adicional vendible y sustitución que requiere autorización. Cuando falten datos, aclarar o derivar; no inventar equivalencias.
5. Casos nuevos reservados: otro vocabulario, interrupciones y mezclas no usados para corregir. Un caso usado en desarrollo deja de ser reservado.

Salida: regresiones necesarias verdes, full/TypeScript si se modifica regla compartida, ningún defecto crítico conocido sin resolver dentro del alcance. Un defecto crítico cambia unidades/productos sin autorización, pierde una corrección, inventa un importe o mezcla clientes. No prolongar indefinidamente la fase por añadir variaciones de casos que ya pasan.

### 2. Comprobar el modelo y el canal reales

Responsable: agente; Wilmer ayuda a verificar recepción.

- Elegir6–8 recorridos cortos: pedido fácil, ejecutivo con componentes, pedido completo largo, aclaración, corrección al cerrar y consulta seguida de compra. Definir resultado esperado antes de ejecutarlos.
- Usar llamadas restantes en lotes pequeños, un intento por caso y parada ante fallo; nunca asumir que un caso cuesta una llamada. Reservar parte del saldo para diagnóstico. Revisar gratis el fallo antes de repetir.
- Acreditar qué turnos realmente usaron inferencia. Un runner con agente habilitado que hace0solicitudes solo acredita ruta determinista.
- Antes de ejecutar el ensayo de11pasos del canal, añadir un límite efectivo de solicitudes: el runner documentado no limita hoy el modelo por sí solo.
- Probar mensajes auténticos desde el teléfono autorizado y observar recepción/respuesta, ráfaga, reintento y carrito final. No confirmar órdenes externas de prueba sin comprobar aislamiento.
- Verificar intervención humana: pedir persona, conservar contexto/carrito y comprobar que una persona puede atender. No aprobarlo por el texto de un mensaje automático.

Salida: informe por conversación con resultado comercial, versión, inferencia utilizada y errores. Esta puerta es necesaria antes de admitir clientes del piloto; el resultado gratuito no la sustituye.

### 3. Preparar una versión de piloto

Responsable: agente prepara; Wilmer decide publicación y operación.

- Identificar commit de código/configuración/catálogo/modelos y promover a Main únicamente cuando Wilmer lo solicite. Mantener staging. Después del deploy verificar versión activa y health.
- Preparar y comprobar reversión a la versión anterior y una forma de pausar el bot/atender manualmente.
- Validar catálogo, precios, domicilios, valores por defecto y política de cambios del local.
- Definir horario, persona responsable y cómo recibe las conversaciones que necesitan ayuda.
- Registrar pedidos intentados, resultado del carrito, tiempo, intervención, costo e incidentes. Sanitizar corpus; no publicar conversaciones privadas.
- Comprobar una orden controlada extremo a extremo con el local antes de recibir pedidos del piloto. Es una verificación mínima operativa, no una nueva fase de implementación de cocina/pagos.

Salida: versión identificada, canal real acreditado, responsable disponible, resumen confirmable y pausa/reversión comprobadas.

## Cuándo podemos probar el piloto

Ensayo controlado: ya podemos organizarlo en staging con mensajes de texto y participantes conocidos, respetando presupuesto/aislamiento; no equivale a atender clientes sin supervisión.

Piloto real reducido: al terminar las tres puertas anteriores. Propuesta inicial10–20 conversaciones que intenten pedir, durante un horario atendido, revisando todos los pedidos antes de procesarlos. No prometer una fecha hasta verificar modelo/canal y responsable humano. No exige terminar Kamppo ni perfeccionar audio/fotos si esas funciones se derivan de forma comprobada.

Ampliación: si esa primera muestra no presenta incidentes críticos abiertos, ampliar progresivamente hacia100 conversaciones en varios días/horarios. No completar la muestra seleccionando solo éxitos; registrar abandonos, consultas y fallos por separado. Cualquier incidente crítico pausa la ampliación, se corrige, recibe una regresión y se vuelve a comprobar el patrón.

## Cómo decidimos si ya se puede vender

Propuesta para venta asistida, posterior al piloto:

- Cero incidentes críticos abiertos y revisión de todos los de la muestra. No garantiza ausencia de fallos futuros.
- Al menos95% de intentos de pedido con resultado correcto contando ayuda humana; informar aparte el porcentaje sin ayuda. Una conversación derivada no es éxito automático.
- Intervención humana funcional en todas las solicitudes explícitas observadas, con contexto conservado.
- Medir latencia mediana/p95, repreguntas, abandono, costo por pedido y tiempo humano. Objetivo de texto p95≤15s provisional, pendiente de línea base; no está medido por tests locales.
- Que el local observe beneficio: menos trabajo o pedidos recuperados. Si aumenta el soporte, revisar alcance antes de vender.
- Onboarding, mantenimiento de catálogo, soporte, límites de consumo y reversión documentados. Fijar precio usando API, Meta, infraestructura y soporte medidos, sin estimar margen a partir de tests.

No dar un porcentaje de «terminado»: las pruebas locales no equivalen a una tasa de éxito real. El próximo hito relevante es completar pedidos supervisados con clientes, no alcanzar un número mayor de pruebas.

## Audio, imágenes y Kamppo: ampliaciones posteriores

Audio: obtener3–5 originales iniciales y transcripción esperada; medir producto/cantidad/opciones/nota/dirección, costo y latencia. Comparar el modelo actual con candidato antes de cambiar. Esta muestra es inicial, no calidad general.

Imágenes: originales con uno/varios productos y capturas de menú frente a carrito. Comprobar cantidades y opciones, no solo nombres. Mezclar texto/foto/audio en secuencia sin perder pedido.

Kamppo: reutilizar reglas y suites con adaptadores de catálogo/configuración. Probar aislamiento de sesiones, precios, credenciales, órdenes, puntos y eventos por tenant antes de varios negocios. Los catálogos ficticios acreditan portabilidad de lenguaje, no multitenancy operativa.

## Lo que necesita aportar Wilmer

No bloquea la próxima tanda gratuita. Para iniciar el piloto sí necesitamos:

1. Una persona disponible y un horario de supervisión.
2. Validación comercial de catálogo, domicilios y cambios permitidos; aclarar cualquier política que no esté representada.
3. Ayuda para observar mensajes/pedidos auténticos y autorización de promoción de la versión preparada.

Audios/imágenes originales son necesarios para ampliar esos canales, no para iniciar un piloto limitado a texto con derivación funcional. No volver a pedir accesos ya autorizados ni credenciales por chat.

## Fuentes internas y siguiente acción

Estado: docs/AGENT-HANDOFF-WHATSAPP.md. Tandas: docs/whatsapp-next-batches.md. Presupuesto: docs/whatsapp-model-budget.json. Índice PDF sanitizado: scripts/fixtures/whatsapp-pdf-1110-patterns.json.

Siguiente acción: medir recorridos con inferencia y canal real acotados; añadir primero un límite efectivo para el ensayo real. La tanda gratuita de opciones inexistentes/consultas/cambios durante cierre está cerrada en su alcance documentado. No promueve automáticamente a producción ni acredita el piloto.

## Cierre de la tanda gratuita previa al piloto — 12/10

30regresiones nuevas;76focalizadas + full65suites/1.958pruebas y TS aprobados. Corregidas preguntas que cambiaban opciones, fuente de cantidad contaminada por dirección y respuesta de opción inexistente que se confundía con plato. Preguntas de recargo sin datos no alteran carrito ni inventan precio; cambios explícitos durante cierre conservan dirección/pago/nota y renuevan resumen. El contrato no contiene tarifas/permisos de sustitución: se deriva su confirmación, no se acredita recargo automático. Cero llamadas pagadas, saldo5. Desplegada50556d2d y verificada12/10 12:09 Bogotá, healthy/DB connected. Evidencia en relevo y /tmp/ppp-pilot-gate-deploy-verified.log.

## Prioridad nueva: chat Banderas

Diagnóstico gratis12/10, cinco escenarios fallidos en staging actual. Ver docs/WHATSAPP-BANDERAS-DIAGNOSIS.md. Prioridad antes de inferencia/canal y del piloto: corregir consultas de precio interpretadas como compra, reclamo que duplica producto, corrección que se guarda como nombre y actualización de referencia de dirección. Añadir recorrido completo y versiones con otros catálogos. La tanda anterior fue aprobada en su alcance; no acredita estos casos nuevos. No se gastó API ni se cambió producción.

## Plan actualizado: integrar cambios y mejorar voz

1. Aprobar snapshot actual con full/TS, confirmar cambios locales en staging y verificar la nueva imagen; Main conserva su versión hasta promoción solicitada.
2. Voz: el reconocimiento y la interpretación se miden separados. La transcripción tiene contexto de ortografía desde el catálogo, sin inventar menú/porciones. Whisper permanece predeterminado; candidato configurable solo para comparación controlada. Recorridos de audio simulado acreditan router, no calidad acústica.
3. Obtener3–5 audios originales nuevos con consentimiento para prueba y resultado esperado (combo alitas+bebida+dirección, pedido largo, corrección, ruido). Hoy el usuario no conserva originales; no enviar grabaciones ajenas encontradas en Downloads. Comparar los mismos archivos, medir producto/cantidad/opciones/dirección, costo/latencia; una llamada por intento, sin reintentos automáticos, dentro de15restantes y ledger.
4. Próximas tandas gratis: varios platos similares con diferentes atributos/notas, cambios que afecten una sola línea de un pedido grande, desistimiento de una aclaración y audio fallido seguido de texto. Reservar casos nuevos fuera de desarrollo.
5. Tras aprobar inferencia/canal y supervisión humana, piloto limitado. No presentar todo el producto como vendible por el número de tests. Recargos y sustituciones no descritos en carta requieren confirmación comercial.


## Próxima puerta de comprensión — básicos y extras
Las tandas se priorizan por cambios accidentales de producto/cantidad, pérdida de atributos y bucles de aclaración, seguidos de claridad de respuestas. La tanda actual agregó16casos y corrigió normalización de plural/cortesía;34focalizadas pasan; full66suites/2144aprobado. Consultar docs/whatsapp-next-batches.md para los8bloques con oráculos. A continuación seleccionar pocos recorridos representativos para inferencia real dentro del saldo5:pedido dividido con interrupción,consulta de precio en cierre,pedido grande con reparto,extra frente a incluido. Un fallo vuelve a diagnóstico gratuito antes de gastar más. Audio exige grabaciones originales para medir reconocimiento; los mocks no acreditan esa calidad.


## Verificación actual13/10
Conjunto local2335pruebas y TypeScript aprobado. Nuevos bloques:continuidad con consultas,desistimiento,cortesía,reparto de bebidas,corrección de una línea,recogida y cambios de pago,seguimiento posterior y propuestas sin productos disponibles.4recorridos representativos con modelo configurado aceptados (2usaron inferencia real), Meta/DB/órdenes aisladas;10solicitudes nuevas incluyendo ronda limitada y completada. Saldo5, no15. No acredita entrada genuina desde un teléfono ni atención humana operativa. Próximo paso crítico:ensayo supervisado de texto en el canal y medición de carrito/opciones/respuesta, con intervención humana comprobada. Audio/fotos todavía requieren originales para medir percepción. El listado de variantes no se considera una garantía para cualquier restaurante.


Tanda13/10:64casos nuevos en ocho menús distintos; exclusión por unidades con producto/total explícitos y controles de incoherencia. Full2535/66yTypeScript aprobado. No acredita percepción real ni cambios de atributo por subconjunto o durante pago. La incidencia de compra+opción+empaque queda pendiente de reproducción aislada.


Tanda13/10:98regresiones adicionales de plato/opción/empaque y consulta de cobertura sin autorización de dirección; catálogo variado y pasos de pago/confirmación. Full2633/66yTypeScript aprobado. Caso “Me traen un pedido hasta El Tintal?” pide dirección precisa y conserva el pedido; no acredita cobertura real de esa zona. Cambio explícito de dirección tiene prioridad sobre consulta.


## Auditoría de básicos antes de ampliar casos extremos

Una misma frase se debe comprobar al armar carrito, elegir opciones, dar nombre/teléfono/dirección, pagar y confirmar. El número de pruebas no demuestra que esos cruces estén cubiertos.

1. Preguntas de servicio: horario, ubicación, domicilio y posibilidad de recoger. La tanda actual verifica84casos en dos catálogos y tres pasos activos; incluyó fallos de respuesta y cambio de entrega por preguntar. Pendiente negocio cerrado y pasos de datos personales.
2. Compra simple: nombre/código/cantidad, opción omitida, producto no disponible y cortesía. Hay suites existentes; revisar referencias cortas y productos con nombres cercanos en cartas nuevas.
3. Consultas antes de comprar:precio,qué trae,disponibilidad. Deben conservar carrito y dejar elegir después; la referencia “eso” depende de contexto real. La tanda actual agrega precio consultado y FAQ seguida de compra explícita.
4. Edición: cantidad,quitar producto,nota y opción. Confirmar que cambia solo lo solicitado y pedir aclaración ante varias líneas posibles. Cubierto en familias previas, no todos los subconjuntos o pasos finales.
5. Domicilio:preguntar cobertura no es dar dirección;dirección nueva debe corregir la anterior;referencia de acceso no debe sustituir calle/número. Cobertura numérica con tarifa fija todavía necesita evaluación; no asumir cobertura por obtener un precio.
6. Respuestas cortas y cierre:sí/no/ok/gracias deben interpretarse según la pregunta pendiente. Añadir controles sin oferta pendiente, rechazo antes de confirmar y reinicio sin restos. Conservar los límites de aislamiento antes de ensayos con canal real.

Cada fallo básico bloquea la familia correspondiente del piloto hasta reproducirlo,corregirlo y revisar el recorrido. La tanda gratuita acredita reglas y flujo con dependencias simuladas; el piloto todavía requiere canal real y atención humana.


Cierre de básicos13/10:84casos nuevos aprobados y full2749/66verde. Se corrigieron servicio durante checkout,ubicación consultada frente a dirección declarada,posibilidad de recogida frente a elección y FAQ seguida de compra. Mantener pendientes negocio cerrado,respuestas cortas y pasos de datos personales:los tres pasos probados no acreditan todos los contextos ni inferencia/canal reales.

Se integraron32pruebas locales adicionales de resumen,total,pagos consultados,servicios del local y cobertura después de calle; incluidas en el full2749. La tanda de este agente aporta84,la integración aporta116 en total frente a2633. No usar el total de mocks para afirmar cobertura real o venta autónoma.

## Criterio de conversación mientras espera un dato

Comportamiento objetivo:responder primero una consulta resuelta y terminar con un recordatorio del siguiente dato u opción pendiente. Una corrección debe actualizar el pedido y recalcular qué falta; no elegir datos ni agregar platos por una pregunta. Si la consulta necesita aclaración, priorizar esa aclaración y conservar el paso anterior sin dos preguntas competidoras. Cancelación explícita e intervención humana deben tener sus propios recorridos.

Nueva familia aprobada en pruebas gratuitas:96recorridos de recordatorio con sabores,selección y carrito múltiple;18secuencias completas basadas en Arroz Paisa y dos cartas ficticias (consulta de precio mientras pide nombre,consulta de combo,nombre real y nueva consulta durante pago). La secuencia detectó un bloqueo con agente activado que no mostraban los turnos aislados. Prueba final66suites/3027aprobada;despliegue591c134e verificado en staging, no acreditar como producción. Próximo:consulta de precio ambigua seguida de nombre/número del producto sin duplicar el carrito,consultas repetidas y cambios durante esa aclaración.

## Próximas tandas por riesgo — 13/10/2026

No medir avance solo por cantidad de pruebas. Para cada familia comprobar respuesta,carrito,datos pendientes y siguiente turno; incluir menú ficticio con opciones y otro sin ellas. No declarar un hueco resuelto hasta reproducirlo.

1. Consultas ambiguas:carrito múltiple, “qué precio tiene”,respuesta por nombre o número. La aclaración explícita “el precio de X” pasa16recorridos nuevos; suite general afectada1710/1710 aprobada y TypeScript aprobado (/tmp/ppp-ambiguous-explicit-suite.log). Solo pruebas/documentación;no deploy requerido. 84regresiones nuevas acreditan nombre exacto,ordinal/número de lista,desistimiento,interrupción y dato válido; contexto informativo separado del carrito. No acredita toda referencia vaga ni nombres con typos. Consultar dos veces y desistir debe conservar pedido.
2. Cambio de intención:pregunta de sabor seguida de otro producto,corrección de cantidad,quitar solo una línea y “olvida eso”. Distinguir cancelar elección pendiente de vaciar el pedido completo. No aplicar una nota a todos los platos por defecto.
3. Consultas y acciones juntas:“cuánto vale y quita una”,“sin ensalada y para otra dirección”. Comprobar que atiende ambas y recalcula el total sin duplicar unidades. Si falta identificar línea,aclarar antes de mutar.
4. Referencias y tiempo:respuestas a mensajes antiguos,ráfagas con consulta intercalada,dos carritos mencionados y regreso tras pausa. No atribuir a la última línea una referencia que apunta a otra ni reconstruir pedidos expirados sin intención.
5. Datos versus lenguaje común:preguntas sin signos,typos,nombres de locales frente a nombres de personas y negativas cortas. No convertir consulta en nombre/dirección ni “sí” ambiguo en pago/compra.
6. Catálogo y domicilio:no inventar disponibilidad,recargo o cobertura por tarifa fija; preguntar ubicación cuando la evidencia no alcanza. Precio vigente de carta y precio de línea guardada deben explicar discrepancias.
7. Canal/modelo reservado:solo después de cerrar los defectos críticos reproducidos,elegir pocas conversaciones nuevas para las5llamadas restantes. Audio original e imagen real siguen necesitando evaluación representativa; mocks no acreditan percepción.

Oportunidades de experiencia:una pregunta pendiente por respuesta,resumen solo cuando ayuda,confirmar cambios mostrando qué se modificó,y conservar contexto al derivar a persona. Acreditar estas mejoras con recorridos completos y casos reservados,nunca solo con una respuesta bonita.

Resumen compacto:12regresiones verifican dirección una sola vez en el resumen de pedido,dirección conservada en carrito aislado,productos/opciones/notas e importes intactos. Full integrado66/3139 aprobado;deploy850d7ccc verificado en staging. Main intacta.

Cancelación de selección,pruebas aprobadas:36regresiones nuevas con carrito previo y notas,pedidos de bebida por sabor/producto y rechazo de bebida en plato compuesto. Distinguen abandono de selección frente a vaciar todo,verifican que opción vieja no reviva producto y conservan carrito. Verificación global66/3175 y TypeScript aprobados;deploy553a2087 verificado en staging. Siguiente ampliar cortesía/typos,alias de atributos y rechazo al editar opciones de una línea existente;no extrapolar estas36a toda forma de cancelación ni a órdenes registradas.

Tanda cortesía/edición,pruebas aprobadas:52nuevas regresiones cubren6frases con cortesía/typos,cancelación de edición de sabor,atributos Preparacion/Coccion,negación de cancelación,consulta intercalada y selección por número. Colisión nombre/opción(Mango en nombre pero solicitaLimon) usa fuente original del cambio para evitar reinterpretación.88focalizadasaprobadas,TypeScriptaprobado y full66/3227aprobado;deploy0508049d verificado en staging. No acredita rollback de una sustitución de SKU ya aplicada. Próximo:reproducir sustitución→opciones pendientes→cancelación y restaurar línea original si contrato lo requiere;propuestas múltiples y consulta+acción en mensaje/ráfaga.


### Puerta de piloto: correcciones e intención por encima del paso pendiente (13/10/2026)

La tanda actual valida los chats de dirección vieja durante pago, pregunta copiada con calle nueva, “otra dirección” sin destino, compra parcial inmediata y cantidad de paquetes. Aún no acreditada globalmente: ver relevo y /tmp/ppp-user-chat-full.log. Verificar también regresiones de dúo→consulta de sabores→elección y corrección de botella por plato ya integradas por otro trabajo en ac634386.

Antes de declarar listo el piloto:
1. Completar regresión global y revisión de carrito/respuestas; expectativas antiguas de sí no deben ocultar duplicados o selecciones perdidas.
2. Probar atributos realmente pendientes en pedidos mixtos, dos ambigüedades consecutivas, consultas entre elecciones y aceptar solo un acompañamiento sin aceptar la bebida pendiente. Preservar cantidades/notas y no crear productos desde prosa del bot.
3. Comprobar recotización de domicilio con mock que cambie tarifa/distancia; salud del servidor no acredita comprensión ni cálculo correcto.
4. Revisar catálogo con nombres duplicados, contenidos de combos, errores como Colmbiana y datos sintéticos de clientes antes de exposición real. Es un control de datos/configuración, no un parche por producto.
5. Reservar las 5 llamadas autorizadas restantes para conversaciones que ejerciten modelo real después de aprobar gratis. Ninguna llamada usada en esta tanda.

Main permanece sin tocar. Staging es la única rama de integración; no basta que la rama esté publicada: documentar imagen activa/health al finalizar deploy.


Cierre de la tanda de dirección/pedidos mixtos:66suites y3369pruebas aprobadas;TypeScript aprobado;fuente verificada por snapshot.34regresiones propias nuevas cubren dirección durantepago/pregunta copiada/rechazo sin destino,recotización,compra parcial,paquetes1/2/5,dosambigüedades yaceptación parcial conBebidapendiente en diferentescatálogos. Aprobación localconmodelo yserviciossimulados;no equivale avalidación deaudioSTT ni deWhatsApp/modeloreal. CeroAPI. Pendiente registrar despliegue.


Staging publicado/desplegado yverificado13/10/2026 18:50Bogotá,códigofb70c472,healthy,imagenactiva=candidata,healthok. Main no modificada. Piloto aún requiere validar modelo/canal real ydatos de negocio;el pase3369es con dependencias externas simuladas. Próximo foco:opciones obligatorias de varios productos sin default yconsultas intercaladas,ráfagas,STT con audios originales cuando disponibles. No cobrar ni confirmar pedidos reales desde las suites.


### Tanda: opciones obligatorias y continuidad de pedidos mixtos

52regresiones nuevas cubren consultas intercaladas,2bebidas con cantidades independientes,cambio de cantidad ycancelación de una bebida cuando es la única selección pendiente. Baseline detectó4fallos de respuesta de opciones y8de cambio/cancelación;60focalizadas finales aprobadas con controles previos. Full yTypeScript pendientes de cierre:ver relevo. Sin consumoAPI,sinpromociónMain.

Próximo hueco:cancelación de un solo producto entre varias selecciones sin perder las demás;preguntas por sabores de otro producto y notas de cada bebida. Usar catálogos diversos yverificar respuestas además del carrito.


Cierre validado de opciones obligatorias:66suites/3421pruebas yTypeScript aprobados,snapshot íntegro.52casos nuevos yregresiones anteriores acreditadas con servicios externos simulados. Se conservan elecciones/cantidades yse responde catálogo sin inferencia para consultas genéricas de opciones. Pendiente deploy;piloto aún requiere validación focal del modelo/canal real, no inferir preparación comercial solo del conteo de tests.


Staging55c5fd52 desplegado/verificado13/10/2026 19:13Bogotá,healthy eimagenactiva=candidata. Mainintacta,modelo sin cambios,noAPIpagada. Próxima tanda:cancelación selectiva con varias opciones abiertas,notas por bebida yconsulta de otro producto durante elección.


### Producción promovida y siguiente familia de puntos

Main49194fecdesplegada13/10/2026 19:29Bogotá:66suites/3421pruebas,TypeScript ycompilación aprobados;HTTPhealthOK ydosmódulosWhatsAppcoincidentesbyteporbyte. PreservadoscambiospropiosMain ycomposeadaptado. Stagingpermanentecontinúa,incluyeMainporfastforward. Las nuevascorreccionesno sepromueven automáticamente.

Tanda actual78casosnuevos:20colas/notas/cancelación selectiva,58compra+premio/consultas/códigos ycolisionesdenombres.103focalizadas aprobadas. Full/TypeScriptpendientesde cierre,verrelevo. Rutasdepuntosdebenpriorizarintenciónconcretaypreservarpedido;consultasnogastan,pedirpremiono autorizaredimirautomáticamente,beneficioesunaunidadelegiblenoelpedidoentero. Mantener ayudaextensasoloalpedirguía.

Próxima familia crítica:producto+códigoyproducto+generarpremioenmismomensaje,contexto trasgenerarcode,pago/dirección/cantidad trasaplicarbeneficio,políticasparametrizadasportenant. No declararlovendibleporcantidaddepruebas conmodelos simulados.


## Huecos adicionales para la siguiente tanda (no acreditados todavía)

Priorizar cambios de intención, no solo frases distintas de un mismo pedido. Cada caso debe comprobar respuesta, carrito, estado pendiente y ausencia de mutaciones externas. Ejecutar con dos catálogos ficticios y agente simulado activo/inactivo.

1. Respuesta tardía: preguntar sabor, cambiar a consulta de precio y luego responder «2»; no usar una numeración vieja ni añadir otro producto. Si hay dos listas posibles, aclarar a cuál se refiere.
2. Autocorrección en el mismo mensaje: «dos hamburguesas, no, mejor tres; una sin queso»; cantidad final tres, nota solo sobre una unidad.
3. Corrección negativa: «no dije dos combos, dije dos tacos»; sustituir el objeto señalado sin sumar otro combo ni borrar productos ajenos.
4. Números con funciones distintas: «combo de tres tacos, dos unidades, casa 3, pago con 50 mil»; cantidad dos combos, dirección y efectivo separados.
5. Referencia ambigua: dos hamburguesas diferentes y «esa sin cebolla»; preguntar cuál, no escoger por azar.
6. Consulta frente a compra: «si cambio la bebida cuánto vale»; no efectuar el cambio hasta que exista intención explícita.
7. Pedido más código o canje: «agrega medio pollo y aplica este premio…»; conservar compra, validar código una vez, no canjear por una consulta.
8. Retransmisión del mismo evento y dos mensajes iguales con IDs diferentes: primer caso no duplica; segundo no debe eliminar un pedido legítimo por coincidencia de texto.
9. Carrito corregido desde una imagen y luego por texto: «de la foto solo el segundo y dos del tercero»; no volver a añadir todos los productos reconocidos.
10. Nota con negación: «sin picante; el ají aparte»; conservar ambos requisitos sin convertir ají en plato.
11. Cambio de destino: «mejor recojo» mientras se pide dirección; quitar domicilio pendiente y conservar comida y pago elegido.
12. Catálogo cambiante: producto u opción retirados entre pregunta y respuesta; avisar con claridad, no aceptar opción inexistente ni perder el resto del pedido.

Estos son objetivos de pruebas pendientes, no afirmaciones de fallos ni de cobertura. Revisar las suites existentes antes de duplicar casos. Audio requiere además evaluación separada de transcripción e interpretación; sin originales no se acredita calidad acústica con fixtures de texto.


### Cierre global y protección de selección de foto

Regresión corregida acumulada:66suites/3738pruebas aprobadas,415.197s (/tmp/ppp-loyalty-fixed-full.log),snapshot íntegro /tmp/ppp-loyalty-fixed-source.json. Incluye tandas acumuladas de otros cambios conservados, no solo las78pruebas de puntos/colas. Antes deldeploy se detectó porlectura que tryApplyPhotoSubset vaciaba carrito yborraba productos ajenos a lafoto.8regresiones nuevas con cartas ficticias depizza yramen,agente simulado activo/inactivo:preservar producto externo conqty2ynota;doslíneasdel mismoSKUconnotasdistintas pidenaclaraciónsinmutar. Baseline8fallaron /tmp/ppp-photo-isolation-baseline.log. Corrección conserva líneasconIDsfuera dela lista dela foto;pide aclaración paraSKUconvariaslíneas. No acredita identificación deunidadesdel mismoSKUfusionadasantes/después deimagen ni preservación de notas/opciones deuna solalínea reconstruida:próxima tanda,requiere procedencia deimagen.

92focalizadas aprobadas /tmp/ppp-photo-isolation-targets.log,TypeScript aprobado /tmp/ppp-photo-isolation-tsc.log. Global final /tmp/ppp-photo-isolation-full.log,snapshot /tmp/ppp-photo-isolation-source.json;noeditarfuentesdurantefull.8regresionespropiasadicionales,ceroAPIen esta revisión,presupuestoefectivo36/40y4restantes. Main49194fec intacta;no nueva promoción aproducción.


## Estado aprobado para publicar en staging

La regresión final aprobó las 66 suites y 3.746 pruebas en 418,812 segundos (`/tmp/ppp-photo-isolation-full.log`). TypeScript aprobado (`/tmp/ppp-photo-isolation-tsc.log`). La comparación de todas las fuentes contra `/tmp/ppp-photo-isolation-source.json` no encontró diferencias. El conjunto acumula 325 pruebas adicionales respecto de Main49194fec; incluye trabajo previo conservado, no todas son de esta revisión.

El último fallo reproducido fue la eliminación de productos ajenos al seleccionar parte de una foto: ocho casos fallaron antes de la corrección y ahora pasan. Se conservan productos fuera de la foto y se pide aclaración cuando un SKU tiene varias líneas. No se acredita procedencia de cantidades fusionadas del mismo SKU ni conservación de todas las notas/opciones al reconstruir una única línea de la foto; esos casos quedan para la siguiente tanda.

Publicación y despliegue pendientes de verificar. Trabajar sobre staging, conservar Main49194fec y la rama staging. Presupuesto efectivo: 36 solicitudes usadas de 40; quedan 4. Esta revisión no hizo llamadas pagadas ni creó órdenes externas. Próxima tanda: notas/opciones por unidad en correcciones de foto, respuestas claras después de una mutación y referencias con contexto anterior.


## Despliegue verificado — 13 de octubre de 2026, 23:45 Bogotá

Código `bfab2af6` publicado y desplegado en staging. Contenedor `ppp-staging-api-1`: running/healthy; imagen activa y candidata coinciden: `sha256:96bea3a7e910b4812cc9ab22d38917a6cf45754699c1ed7485a642d9cd3adcfa`. HTTP local3301/api/health: statusok,DBconnected,circuitCLOSED. Evidencia: `/tmp/ppp-photo-isolation-deploy.log` y `/tmp/ppp-photo-isolation-verified.log`. La primera comprobación tenía healthstarting; la segunda healthy. Se conservó bin/ privado y mariadb_local. Producción continúa en Main `49194fec`, comprobada por SSH; no recibió esta tanda.

Validación final:66suites/3746pruebas,TypeScript aprobado yfuente sin cambios durantefull. No nuevas llamadas pagadas en esta revisión. Registro acumulado:36/40usadas,4restantes. Modelos ycredenciales sin cambios. La rama staging se conserva como integración permanente.

Siguiente paso recomendado: reproducir notas/opciones perdidas al ajustar una foto; conservar productos del mismoSKU que se pidieron antes o después de la imagen mediante procedencia explícita; verificar respuestas que hoy dicen «pedido sigue igual» tras una mutación; diferenciar precio unitario frente a importe de línea al pedir «el más caro». No dar por vendible el producto por el número de tests. Antes del piloto aún hace falta validar una muestra con inferencia real y audios originales, separando transcripción de interpretación.

## Plan concreto para habilitar el piloto

1. **Cerrar pérdida de contexto en correcciones.** Primera tanda: selección parcial de foto conserva notas, atributos, cantidades y productos ajenos; mismo SKU antes/después de foto pide aclaración cuando no hay procedencia segura. Aprobación: ningún cambio silencioso de opción ni borrado de comida ajena. Después: autocorrecciones con notas por unidad y referencias a preguntas anteriores.
2. **Revisar claridad y continuidad.** Consultar precio, ingredientes o cobertura durante nombre/dirección/pago/sabor debe responder la consulta y retomar el paso pendiente. El mensaje debe describir la mutación realizada y no afirmar que todo sigue igual. Aprobación: respuesta y estado comprobados, sin capturar consultas como datos personales.
3. **Probar conversaciones completas sin ajustar el código a cada frase.** Preparar un conjunto reservado con pedidos simples, largos, ráfagas, cambios y desistimientos en al menos tres cartas ficticias. No usar esos casos para desarrollar antes de medirlos. Aprobación: cero duplicaciones, pérdidas de productos, precios inventados o confirmaciones falsas; cualquier fallo crítico reabre su familia.
4. **Validar inferencia y medios.** Usar como máximo las cuatro solicitudes pagadas restantes, registrando cada intento y sin reintentos automáticos. Una muestra pequeña no acredita todo el sistema. Audio: obtener originales o preparar grabaciones controladas; medir por separado transcripción y pedido resultante. Imagen: incluir varias unidades, carta completa y fotos ilegibles. Aprobación: incertidumbre explícita, sin inventar productos ni perder cantidades.
5. **Piloto asistido y acotado.** Una sola operación, efectivo/transferencia, supervisión humana y canal de ayuda disponible. Registrar cada error de interpretación con carrito antes/después; corregir familias y repetir el conjunto reservado. Entrar cuando los pasos anteriores estén aprobados y no queden fallos críticos conocidos. La calidad del reconocimiento de voz sigue pendiente de audios originales.
6. **Venta y Kamppo.** Después del piloto: medir pedidos completados, abandonos, intervención humana y coste por conversación. Parametrizar programa de puntos y políticas por tenant; verificar aislamiento de catálogos y sesiones. No ofrecer soporte multitenant acreditado solo por probar menús ficticios.

Cada tanda requiere suites afectadas, TypeScript y regresión completa cuando cambia el router compartido. Publicar staging únicamente tras aprobación y verificar runtime. Main requiere nueva solicitud de promoción. No hay fecha ni porcentaje de preparación defendible hasta cerrar los bloqueos indicados.


Cierre de la primera tanda del plan: 66 suites y 3.752 pruebas aprobadas en 408,98 segundos (`/tmp/ppp-photo-attributes-final-full.log`); TypeScript aprobado (`/tmp/ppp-photo-attributes-approved-tsc.log`); todas las fuentes coinciden con snapshot final. Seis regresiones nuevas y 34 comprobaciones focalizadas. La selección ordinal de foto conserva cantidad, nota, atributos, dirección y pago; cantidades explícitas se aplican; opciones retiradas piden aclaración sin mutar. Publicación y deploy aún pendientes de verificación. Main sigue intacta. Cero llamadas pagadas en esta tanda; 36 usadas de 40, 4 restantes. Próximo bloqueo: procedencia de cantidades fusionadas del mismo SKU antes/después de una foto.


## Staging verificado — 14 de octubre de 2026, 00:03 Bogotá

Runtime `c125cd1e` desplegado y verificado. API running/healthy; imagen activa=candidata `sha256:040c74517c886aad16bfe1d95dfcb9b499c1798d8a58bfbe1fbc6a69ce34aae8`; healthok/DBconnected/circuitCLOSED. Evidencia `/tmp/ppp-photo-attributes-deploy.log` y `/tmp/ppp-photo-attributes-verified.log`. Primera consulta starting,segunda healthy. Producción verificada sigue Main49194fec. Rama staging conservada,modelos sin cambios,ninguna llamada pagada esta tanda.

Estado del plan: primer paso parcialmente completado (foto conserva nota/opción/cantidad y no captura dirección); falta procedencia para unidades del mismoSKU fusionadas antes/después deimagen. Siguiente tanda empieza por ese caso, con producto ajeno y nota diferente, antes de mejorar textos de mutación. No abrir piloto por conteo: deben pasar evaluación reservada y muestra real de medios; después piloto acotado y supervisado. Regresión final66suites/3752pruebas+TypeScript aprobados.


Cierre de procedencia de fotos: 66 suites y 3.780 pruebas aprobadas en 403,636 segundos (`/tmp/ppp-photo-provenance-full.log`); TypeScript aprobado (`/tmp/ppp-photo-provenance-final-tsc.log`); snapshot íntegro.28regresiones nuevas,102focalizadas. Se guardan carrito previo y firma de líneas de la foto; la corrección pide aclaración ante unidades previas o cambios posteriores del mismo producto; productos ajenos se conservan; foto nueva ilegible limpia referencia antigua. Esto no acredita división automática de cantidades fusionadas: la protección pide aclaración.

Próxima tanda crítica: compras con «Agrega un [producto]» capturadas como dirección en el recorrido posterior a imagen; reproducir también «añade»,«ponme»,estados building_cart/awaiting_address/awaiting_payment y diversas cartas. No declarar piloto aprobado mientras ese caso siga pendiente. Kamppo revisado solo por lectura; adaptación documentada en docs/kamppo-engine-readiness.md, sin modificación ni despliegue allí. Cero llamadas pagadas esta tanda,36/40usadas4restantes. Publicar/desplegar staging tras este pase; Main49194fec intacta.


Staging verificado14/10/2026 00:25Bogotá:runtime430e1ea0,running/healthy,imagenactiva=candidata sha256:affc186d30b907cc8425b2ccf14dd5581f0ccd340e57c0eca40f0ab462f26e61;healthok,DBconnected,circuitCLOSED. Evidencia /tmp/ppp-photo-provenance-deploy.log y /tmp/ppp-photo-provenance-verified.log. Main49194fec comprobada sin cambios.28regresiones nuevas;full66suites/3780pruebas yTypeScript aprobados;noAPIpagada. Pendiente siguiente tanda «Agrega un producto» capturado como dirección;no migración Kamppo todavía.


## Comandos de adición y dirección pendiente — 14/10/2026

84regresiones nuevas:72compras con agrega/añade/ponme,otro,cantidad2,en building_cart/awaiting_address/awaiting_payment;4bebidas con sabor pendiente y regreso a dirección;8consultas de precio de una posible adición,sin mutación. Cartas ficticias pizza/bowl/bebidas,agente simulado activo/inactivo;carrito previo conqty2ynota,dirección yórdenes externos preservados. Baseline48casos:28fallaron20pasaron /tmp/ppp-add-command-baseline.log. Normalización de comando respaldado por producto del catálogo a intención «Quiero» antes de captura checkout,sin nombres/IDs PPP. Primer parcial16fallos eran compras bloqueadas porawaiting_address /tmp/ppp-add-command-fixed.log;se guarda pendingCheckoutResume para completar compra/opciones yretomar dirección. Adición durante dirección debe pasar router normal ycontroles de catálogo,no tratarse como campo de dirección.

84focalizadas aprobadas /tmp/ppp-add-command-final-targets.log,TypeScriptaprobado /tmp/ppp-add-command-tsc.log. Global /tmp/ppp-add-command-full.log;snapshot /tmp/ppp-add-command-source.json.No editar fuentesdurantefull. Nuevos cambios todavía locales;runtime staging430e1ea0,Main49194fec intacta. CeroAPIpagada,36/40usadas4restantes. Limitación:la nueva normalización exige producto reconocido,verbo/contador alinicio ysininterrogación;no acredita comandos conproducto desconocido,correcciones deatributos,compra+consulta o dirección+compra enmismomensaje. Próxima tanda:esas fronteras ycomandos deagrupación/consulta sin pérdidas decontexto.


Adiciones aprobadas:66suites/3864pruebas,694.984s (/tmp/ppp-add-command-full.log),TypeScriptaprobado /tmp/ppp-add-command-tsc.log,fuente inmutable /tmp/ppp-add-command-source.json.84casos nuevos cubren compras reconocidas y consultas de precio,con notas/cantidad/dirección conservadas y retorno a dirección después de elegir sabor. Duración de suite no mide latencia del bot. CeroAPIpagada,36/40usadas4restantes. Pendiente publicación/deploydeexactocódigoaprobado;Main49194fec intacta. Siguiente:productos no reconocidos,comandos con códigos,compra+consulta ydireccion+compra,correcciones de atributos frente a compra. No declarar cobertura universal.


Staging verificado14/10/2026 00:46Bogotá:runtimef0c7c03c,running/healthy,imagenactiva=candidata sha256:ab254aedd882bfbb592f87ff4886ca5ee9847cc0fbd94b75f396f1aac6e1379e;HTTP3301/api/healthok,DBconnected,circuitCLOSED. Logs /tmp/ppp-add-command-deploy.log y /tmp/ppp-add-command-verified.log. Main49194fec comprobada sin cambios.84regresiones nuevas,66suites/3864pruebas+TypeScript aprobados. Ninguna llamada pagada. Mantener staging ycontinuar fronteras pendientes descritas arriba,con otros catálogos.
