# PPP: estado y plan para piloto y venta

Actualizado el 12 de octubre de 2026, America/Bogota. Plan de trabajo, no certificación de calidad ni promesa de fecha. Las cifras de aceptación son propuestas para PPP.

## Decisión actual

Estamos en validación previa a un piloto supervisado. Podemos hacer ensayos controlados de texto con participantes conocidos; todavía no acreditar un lanzamiento autónomo. No necesitamos esperar a cubrir todo el lenguaje para iniciar un piloto acotado, pero sí cerrar los defectos críticos conocidos del alcance, comprobar el canal real y disponer de intervención humana.

Primer alcance propuesto: PPP, pedidos inmediatos por texto, catálogo y domicilios configurados, efectivo y transferencia. Audio, fotos, reservas, abonos, redenciones y sustituciones con recargo quedan asistidos o fuera del alcance hasta acreditar su recorrido. Excluir una función requiere explicar esa limitación al cliente y ofrecer atención humana comprobada; no basta escribirlo en este documento.

## Dónde estamos: evidencia y límites

- Backend: 65 suites / 1.958 pruebas aprobadas, TypeScript aprobado. Log final /tmp/ppp-pilot-gate-full.log. Incluye cantidades, notas, opciones, correcciones, consultas, ráfagas, referencias, direcciones y pedidos completos. No todas las pruebas son conversaciones; gran parte simula modelo, Meta y persistencia.
- Generalización: menús ficticios vegetarianos, marinos y orientales; hamburguesas, pizzas y bowls sin conceptos de ejecutivo/menú. Las últimas dos tandas añadieron39 casos y encontraron errores reales en correcciones y alcance. Esto acredita esos patrones en esos catálogos; no cualquier restaurante ni aislamiento multitenant.
- Versión validada y desplegada de código: a46e3cb8 en staging, running/healthy, imagen activa igual a candidata y health ok/DB connected. Verificada12/10 a las11:54 Bogotá. HEAD posterior2feddb72 solo documenta la evidencia; una actualización documental no requiere reconstruir API.
- Producción: esta última tanda no se promovió. No asumir paridad entre producción y staging por usar el mismo modelo. La versión efectiva de producción debe comprobarse al preparar promoción.
- Modelo configurado según última lectura: gpt-4.1-2025-04-14 para texto/imágenes en ambos entornos, whisper-1 para audio. No se volvió a verificar configuración efectiva durante la tanda gratuita final.
- API real: última tanda documentada, cinco conversaciones aceptadas; dos usaron inferencia y tres fueron deterministas, siete solicitudes. No acredita las últimas correcciones desplegadas con inferencia real. Presupuesto vigente40 autorizadas/25usadas/15restantes en docs/whatsapp-model-budget.json; contabilizar cada intento, incluidos fallos/reintentos.
- Canal: el preflight documentado verificó acceso/destinatario/aislamiento, con webhookPosts=0. No es una prueba de mensajes originados y recibidos por un teléfono.
- PDF:26 patrones ejercitados en backend, no todos los chats/variantes ni percepción real de los archivos. Audio e imágenes originales siguen pendientes de una evaluación representativa.

## Qué falta, en orden

### 1. Cerrar la siguiente tanda gratuita

Responsable: agente. Usar router real con dependencias externas simuladas, carrito/estado/respuesta como oráculos y catálogos PPP y ficticios.

1. Opción que no existe: no declarar un cambio ni inventar variante/precio.
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

30regresiones nuevas;76focalizadas + full65suites/1.958pruebas y TS aprobados. Corregidas preguntas que cambiaban opciones, fuente de cantidad contaminada por dirección y respuesta de opción inexistente que se confundía con plato. Preguntas de recargo sin datos no alteran carrito ni inventan precio; cambios explícitos durante cierre conservan dirección/pago/nota y renuevan resumen. El contrato no contiene tarifas/permisos de sustitución: se deriva su confirmación, no se acredita recargo automático. Cero llamadas pagadas, saldo15. Estado desplegado de esta tanda se registra en el relevo después de verificar servidor. Versión a46e3cb8 en la sección histórica corresponde a la tanda anterior; no confundir con nuevo cierre.
