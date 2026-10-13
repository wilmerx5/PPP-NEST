# PPP: estado y plan para piloto y venta

Actualizado el 13 de octubre de 2026, America/Bogota. Plan de trabajo, no certificación de calidad ni promesa de fecha. Las cifras de aceptación son propuestas para PPP.

## Decisión actual

Estamos en validación previa a un piloto supervisado. Las correcciones del chat Banderas y de continuidad de menús pasan pruebas aisladas en staging; queda acreditar esos recorridos con modelo y canal reales antes de iniciar piloto con clientes. Podemos hacer ensayos controlados de texto con participantes conocidos; todavía no acreditar un lanzamiento autónomo. No necesitamos esperar a cubrir todo el lenguaje para iniciar un piloto acotado, pero sí cerrar los defectos críticos conocidos del alcance, comprobar el canal real y disponer de intervención humana.

Primer alcance propuesto: PPP, pedidos inmediatos por texto, catálogo y domicilios configurados, efectivo y transferencia. Audio, fotos, reservas, abonos, redenciones y sustituciones con recargo quedan asistidos o fuera del alcance hasta acreditar su recorrido. Excluir una función requiere explicar esa limitación al cliente y ofrecer atención humana comprobada; no basta escribirlo en este documento.

## Dónde estamos: evidencia y límites

- Backend: 66 suites / 3.027 pruebas aprobadas, TypeScript aprobado. Verificación completa en una ejecución: /tmp/ppp-pending-combo-full.log,300.657s. Incluye la tanda de básicos/extras y continuidad con pausas. Incluye cantidades, notas, opciones, correcciones, consultas, ráfagas, referencias, direcciones y pedidos completos. No todas las pruebas son conversaciones; gran parte simula modelo, Meta y persistencia.
- Tanda posterior de pruebas, sin cambios de runtime:68 casos nuevos; suite general afectada1484/1484 aprobada y TypeScript aprobado. Cubre consultas durante captura de nombre/teléfono/dirección, negocio cerrado y respuestas cortas con/sin elección pendiente en catálogos ficticios. Log /tmp/ppp-fields-closed-short-suite.log. No equivale a una nueva ejecución global ni acredita el modelo real.
- Interrupciones:96 nuevos recorridos de precio,total,recap y corrección de cantidad durante captura de datos/pago, con continuación del dato pendiente. Dos catálogos ficticios y agente simulado activo/inactivo. No acredita todas las intenciones posibles ni canal/modelo reales.
- Generalización: menús ficticios vegetarianos, marinos y orientales; hamburguesas, pizzas y bowls sin conceptos de ejecutivo/menú. Las últimas dos tandas añadieron39 casos y encontraron errores reales en correcciones y alcance. Esto acredita esos patrones en esos catálogos; no cualquier restaurante ni aislamiento multitenant.
- Versión validada y desplegada de código: 591c134e en staging, running/healthy, imagen activa igual a candidata y health ok/DB connected. Verificada el 13/10 a las 13:35 Bogotá; una actualización documental posterior no requiere reconstruir API.
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

1. Consultas ambiguas:carrito múltiple, “qué precio tiene”,respuesta por nombre o número. La aclaración explícita “el precio de X” pasa16recorridos nuevos; suite general afectada1710/1710 aprobada y TypeScript aprobado (/tmp/ppp-ambiguous-explicit-suite.log). Solo pruebas/documentación;no deploy requerido. Sigue sin acreditar respuesta con solo “X” o “el segundo”; podría confundirse con compra. Consultar dos veces y desistir debe conservar pedido.
2. Cambio de intención:pregunta de sabor seguida de otro producto,corrección de cantidad,quitar solo una línea y “olvida eso”. Distinguir cancelar elección pendiente de vaciar el pedido completo. No aplicar una nota a todos los platos por defecto.
3. Consultas y acciones juntas:“cuánto vale y quita una”,“sin ensalada y para otra dirección”. Comprobar que atiende ambas y recalcula el total sin duplicar unidades. Si falta identificar línea,aclarar antes de mutar.
4. Referencias y tiempo:respuestas a mensajes antiguos,ráfagas con consulta intercalada,dos carritos mencionados y regreso tras pausa. No atribuir a la última línea una referencia que apunta a otra ni reconstruir pedidos expirados sin intención.
5. Datos versus lenguaje común:preguntas sin signos,typos,nombres de locales frente a nombres de personas y negativas cortas. No convertir consulta en nombre/dirección ni “sí” ambiguo en pago/compra.
6. Catálogo y domicilio:no inventar disponibilidad,recargo o cobertura por tarifa fija; preguntar ubicación cuando la evidencia no alcanza. Precio vigente de carta y precio de línea guardada deben explicar discrepancias.
7. Canal/modelo reservado:solo después de cerrar los defectos críticos reproducidos,elegir pocas conversaciones nuevas para las5llamadas restantes. Audio original e imagen real siguen necesitando evaluación representativa; mocks no acreditan percepción.

Oportunidades de experiencia:una pregunta pendiente por respuesta,resumen solo cuando ayuda,confirmar cambios mostrando qué se modificó,y conservar contexto al derivar a persona. Acreditar estas mejoras con recorridos completos y casos reservados,nunca solo con una respuesta bonita.
