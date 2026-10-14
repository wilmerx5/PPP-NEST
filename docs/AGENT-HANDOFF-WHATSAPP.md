# Relevo del agente: PPP WhatsApp

Actualizado el 11 de octubre de 2026, hora de Bogotá. Leer este documento y `AGENTS.md` antes de ejecutar pruebas, editar o desplegar. Es un estado de trabajo, no evidencia de que el producto ya sea vendible.

## Detección de medios y diferencia Main/staging

Base `1e1e0268`, rama staging. Auditoría de los dos módulos compilados de WhatsApp de producción: recompilar Main a6890c4a en `/tmp/ppp-main-media-verify` con TypeScript/dependencias vigentes produjo exactamente los hashes activos en ppp_nest_api. AI `eceac7c6eb5f3455714fc5ca4cb2acd78d48a95a76f557e7f343208015b8a34c`; orquestador `90228fd9b79e5506a04ad3f68d7ed9cb801fd79dc9b5434be04c77816d48b9bc`. Es evidencia para esos dos módulos, no comparación binaria de todo el backend. Producción ejecuta Main del piloto; las tandas posteriores siguen solo en staging. En producción no está normalizeSpokenOrderCourtesy ni humanPhoneHint. No se cambió Main ni configuración productiva.

32 regresiones nuevas gratuitas: nueve de extracción de imagen, ocho de transcripción, tres de descarga, cuatro de carta/pie de foto y ocho de código/cantidad en PPP y catálogo ficticio. HTTP, modelos y Meta simulados. No acreditar mejor precisión del reconocimiento real a partir de estos mocks. Audio conserva texto español y modelo whisper-1; FLAC ahora tiene extensión FLAC. Archivos vacíos no se envían a OpenAI. Descarga de Meta comparte deadline de 30 segundos entre metadatos/binario; cada llamada de visión/transcripción tiene 45 segundos. No es un SLA total: hay cola y puede haber un segundo OCR.

Imágenes: se conserva textForBot completo, antes truncado a 500 caracteres. finish_reason=length no ejecuta un pedido parcial aunque el JSON sea válido. GPT-5 original/mini/nano y sus snapshots usan reasoning_effort=minimal para extracción; el límite sigue en 700, sin aumento ni cambio de modelo. No enviar minimal a 5.1/otras familias automáticamente. Fuentes oficiales consultadas: [parámetros GPT-5](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_new_params_and_tools) y [transcripción/formato de archivo](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create). La documentación respalda compatibilidad, no acredita causa de la foto concreta.

Carta ambigua sin selección no compra el primer producto por OCR; un pie explícito de producto o código se procesa como texto conservando cantidades aunque visión sea incierta. Un código no equivale a su número de unidades; conservar prefijo explícito o x3. Se encontró que calcular cantidad a partir de original + copia procesada convertía el código de una copia en cantidad de la otra; se usa el original una vez y se excluyen identificadores en el extractor general. No se añaden excepciones por IDs/nombres/precios.

Baselines: contrato HTTP de visión/audio 10 fallidos / 11 verdes (`/tmp/ppp-media-detection-baseline.log`); carta sin selección y cantidad del pie 2 fallidos (`/tmp/ppp-media-menu-selection-baseline.log`); selección por código 1 fallido (`/tmp/ppp-media-caption-code-baseline.log`); cantidad/código y pie explícito 7 fallidos / 2 verdes (`/tmp/ppp-media-code-quantity-baseline.log`); descarga 2 fallidos / 1 verde (`/tmp/ppp-media-download-baseline.log`). Son runs de desarrollo con solapamientos; no sumarlos como casos independientes. Intento directo con ts-node sin tsconfig-paths falló al resolver imports; repetir con tsconfig-paths confirmó el problema de copias duplicadas. No es defecto de producción.

Verificación focalizada final: 73 controles aprobados (32 nuevos y 41 existentes), cinco suites; TypeScript final sin errores. `/tmp/ppp-media-detection-targets-final.log`, `/tmp/ppp-media-detection-tsc-final.log`. Cero API pagada: presupuesto compartido sigue 11/20 usado, nueve restantes. No se modifica esquema/persistencia; no repetir matriz MariaDB.

Suite completa final: 65 suites / 1.733 pruebas aprobadas en un único run, 196,254 segundos (`/tmp/ppp-media-detection-full.log`). No se interrumpió este run ni se editó código/tests durante él.

Código `f03cc522` publicado y desplegado en staging, verificado 2026-10-11 15:40 Bogotá: running/healthy, imagen activa y candidate iguales (`sha256:2bef785e68d1e119c13bb2ca310c208e961a60f6f61d4a1f494f519e77e714af`), health OK, DB connected y circuito CLOSED. Evidencia `/tmp/ppp-media-detection-deploy.log` y `/tmp/ppp-media-detection-deploy-verified.log`. Commit posterior de documentación no requiere reconstrucción. Main y ppp_nest_api no se alteraron.

Siguiente: foto/audio originales con reproducción aislada y presupuesto; carta mal clasificada como order sin textForBot; entradas MIME desconocidas; aislamiento multitenant y ráfagas concurrentes. No atribuir a GPT-5 una mala calidad general por el fallo concreto ni afirmar que minimal lo resolvió sin inferencia real.

## Seguimiento de imagen no reconocida — aclaración específica

Base `b4ca1edd`, rama staging. El usuario indicó la respuesta de producción «Vi tu foto, escribe el plato o código; no entendí bien tu mensaje…». Corresponde al fallback de lectura de imagen con pie vago: la plantilla añadía humanHelpHint, que devuelve el aviso genérico completo. No atribuir esto al contexto de comprobante. Consulta privada de producción encontró un candidato en las últimas 24 h: una entrada image y una única salida image_clarification en la ventana de 20 s. No se exportaron cuerpos, teléfonos ni raw_payload; evidencia privada `/tmp/ppp-image-fallback-trace.log`. La estructura no acredita dos mensajes duplicados de Meta.

Se añade un texto de contacto telefónico sin el aviso genérico para errores de foto/audio y recepción de comprobantes. El resto de los fallbacks genéricos conserva su contrato. Seis nuevas regresiones con el router y dependencias externas simuladas: dos pies vagos, descarga de foto fallida, audio ilegible, comprobante explícito y comprobante que no abre. Todas comprueban una salida, conservación/no compra, instrucción específica y ausencia de la segunda aclaración. Baseline: 6/6 fallaron antes de corregir. Focalizadas: 29 controles aprobados (6 nuevos y 23 existentes); TypeScript aprobado. Logs `/tmp/ppp-media-clarification-baseline-final.log`, `/tmp/ppp-media-clarification-targets.log`, `/tmp/ppp-media-clarification-tsc.log`.

Suite completa aprobada: 63 suites / 1.701 pruebas, un único run de 192,054 segundos (`/tmp/ppp-media-clarification-full.log`). Después solo se ajustó puntuación/salto de línea del aviso de comprobante que no abre («aquí. Si prefieres…»); no cambió lógica. Esa redacción final se verifica con seis casos nuevos más dos controles de comprobante y TypeScript, sin repetir toda la suite por puntuación. Evidencia final `/tmp/ppp-media-clarification-copy-final.log` y `/tmp/ppp-media-clarification-tsc-final.log`.

Código `c48ec171` publicado y desplegado en staging; verificado 2026-10-11 15:19 Bogotá. Running/healthy, imagen activa y candidate iguales (`sha256:7367d7ccbd72d7cbd112895ec7a48649357bc4d3712588159e5677945727ff20`), health OK, DB connected y circuito CLOSED. Logs `/tmp/ppp-media-clarification-deploy.log`, `/tmp/ppp-media-clarification-deploy-verified.log`. Commit posterior de documentación no requiere reconstrucción.

El fallo de reconocimiento concreto sigue sin atribución confirmada: producción tiene un modelo diferente; no hay imagen original disponible para comparación controlada y no se registraba finish_reason de respuestas vacías en ese despliegue. No afirmar que cambiar el modelo lo corrige. Cero llamadas pagadas; presupuesto sigue 11/20 usado, nueve restantes. No cambiar Main ni configuración de producción por esta aclaración. No modifica esquema ni persistencia; no repetir MariaDB.

## Cuarta tanda PDF y fotos — contexto y contrato de pruebas

Base `6490ab41`, rama staging. Veintiuna regresiones nuevas: diecisiete de orquestador y cuatro del contrato HTTP de visión. Patrón PDF sanitizado «el mismo pasa en 10 mn por el pedido» probado con PPP y menú ficticio; negación y recogida del mensajero conservan domicilio. Estados completed/closed y contexto Nequi no convierten un resultado explícito de comida en comprobante. Menú sin selección pide elegir; foto ilegible conserva carrito; reintento OCR conserva cantidad; comprobante explícito requiere verificación manual aunque contenga un nombre de plato.

Baseline de quince casos: nueve verdes, seis fallidos. Dos controles posteriores reprodujeron falsos positivos con tercero negado y domiciliario; la regla nueva excluye ambos. La búsqueda de órdenes se simula vacía en esos controles para acreditar conservación, no estado real. La recogida declarada era absorbida por consulta de estado antes de actualizar logística; no confundir este fallo con el servicio de órdenes que faltaba en el mock tras añadir el primer detector. Se prioriza recogida declarativa con carrito, se admite tercero + tiempo «mn» y se conserva ese tiempo como nota, sin garantizar preparación. Contexto de pago/cierre deja de sobreescribir reconocimiento positivo de comida. Si el pie pide comida, una clasificación incierta no se da por comprobante. La clasificación explícita payment_proof sigue siendo comprobante y nunca acredita pago automáticamente.

Diagnóstico de la imagen reportada: lectura del servidor a las 14:50 Bogotá aproximadamente. Módulo compilado de visión idéntico en producción y staging (`eceac7c6eb5f3455714fc5ca4cb2acd78d48a95a76f557e7f343208015b8a34c`); orquestadores distintos. Configuración almacenada: producción gpt-5-mini, staging gpt-4.1-2025-04-14. No se encontraron errores Vision/Image resolve en las tres horas previas. Eso NO identifica la causa de la imagen concreta: faltan hora, respuesta exacta y reproducción con la misma imagen/contexto. No se cambió modelo ni configuración productiva. Lectura de ajustes limitada a modelo/enabled, sin credenciales; evidencia privada `/tmp/ppp-vision-config-check.log`.

El límite de visión permanece en 700 tokens: no aumentarlo ni atribuir el fallo a ese límite sin evidencia. Una respuesta vacía ahora registra modelo y finish_reason, sin OCR, imagen ni credenciales; el test reproduce una respuesta vacía con finish=length, NO acredita que haya ocurrido en producción. Nuevo `docs/whatsapp-test-contract.md` estandariza fuente, semilla, oráculo, conservación, respuesta, efectos prohibidos y separación entre regresión, reservado e inferencia real.

Cero llamadas pagadas; presupuesto compartido permanece 11/20 usado, nueve restantes. Meta/modelo/persistencia externos simulados. Pruebas de fotos recorren el límite resolveImageMessage, no acreditan visión real ni todo el checkout posterior al cierre. No se modifican esquema/transacciones; no repetir MariaDB. Main permanece sin cambios.

El primer run completo se interrumpió al añadir estos dos controles: `/tmp/ppp-pdf-fourth-full-interrupted.log` no acredita aprobación.

Verificación final: 36 controles focalizados (21 nuevos, 15 existentes), TypeScript sin errores, 63 suites / 1.695 pruebas aprobadas en un único run, 190,794 segundos. Logs `/tmp/ppp-pdf-fourth-targets-final.log`, `/tmp/ppp-pdf-fourth-tsc.log` y `/tmp/ppp-pdf-fourth-full.log`. Baselines `/tmp/ppp-pdf-fourth-baseline-final.log` y `/tmp/ppp-pdf-fourth-negation-baseline.log`.

Publicado y desplegado código `61320dd7`, verificado 2026-10-11 15:03 Bogotá: running/healthy, imagen activa y candidate iguales (`sha256:f46fb1a8caa38569ccd02d86c5062914da4fe7bc4d5071aba7f156af9edb5df9`), health OK, DB connected y circuito CLOSED. Primer SSH falló por timeout sin ejecutar deploy; el reintento terminó. Evidencia `/tmp/ppp-pdf-fourth-deploy-retry.log` y `/tmp/ppp-pdf-fourth-deploy-verified-final.log`. La primera comprobación del nuevo contenedor indicó starting, no se acredita como healthy; la final sí. Commit posterior solo de documentación no requiere reconstrucción. Main local continúa `a6890c4a`; archivos dist ajenos preservados.

Siguiente: comparación de foto original solo cuando se tenga fuente/contexto; reparto entre dos productos padre, líneas repetidas con notas y ráfagas concurrentes. No dar por cubiertos estos últimos por los tests de turnos seriales.

## Tercera tanda PDF — citas, recogida y repartos

Base `31e84085`, rama `staging`. Diecisiete casos nuevos gratuitos: citas nativas ausentes, ajenas o referidas a platos retirados; cantidad histórica que no restaura diez unidades; recogida por tercero frente al repartidor; pedido/dirección/apartamento/barrio en turnos consecutivos; reparto de un producto entre combinaciones de dos atributos, conservando notas. Controles de cantidades incompatibles, opción desconocida y conjuntos de atributos inconsistentes conservan el carrito.

Correcciones generales: la recogida explícita evita que la palabra persona active asesor; domiciliario/repartidor/mensajero y la negación explícita no activan esa nueva regla. El reparto separa por cantidad + con, conservando la conjunción entre atributos; exige el mismo conjunto de atributos en cada combinación y aplica todos sin guardar cambios parciales. No se añaden excepciones por nombre, ID ni precio de PPP.

Límites: transporte, modelo y servicios externos simulados; estas citas prueban el contexto nativo reproducido, no Meta real. Las ráfagas son turnos seriales, no concurrencia ni deduplicación. El reparto probado es de un mismo producto padre en un menú sintético: dos ejecutivos diferentes con varias opciones siguen pendientes. Recogida con nombre propio y tercera persona sin verbo recoge necesita otra tanda. Los casos ya usados son regresiones de desarrollo, no evaluación independiente. Cero llamadas pagadas; presupuesto permanece 11/20 usado, nueve restantes. Producción Main no se modifica.

Verificación: 20 controles focalizados aprobados (17 nuevos y tres de reparto existentes), TypeScript sin errores y 62 suites / 1.674 pruebas aprobadas en un único run, 190,955 segundos. Evidencia: `/tmp/ppp-pdf-third-targets.log`, `/tmp/ppp-pdf-third-tsc.log`, `/tmp/ppp-pdf-third-full.log`. Baseline inicial: diez casos, seis aprobados y cuatro fallidos antes de corregir. No se modifica esquema ni persistencia de órdenes; no repetir matriz MariaDB.

Desplegado y verificado el 2026-10-11 a las 14:41 Bogotá: código `4f009555`, contenedor running/healthy, imagen activa y candidate iguales (`sha256:632714d4b8fddf4c890241f81b2c6dc4e3eb086860b706335e38f05e39d9e0d1`), health OK, DB connected, circuito CLOSED. Evidencia `/tmp/ppp-pdf-third-deploy.log` y `/tmp/ppp-pdf-third-deploy-verified.log`. Commit posterior solo de documentación no requiere reconstruir.

Siguiente tanda: reparto entre dos productos padre, referencias a líneas repetidas con distintas notas, recogida por tercero con nombre y hora, cita antigua durante una selección nueva y concurrencia controlada de mensajes. Añadir un conjunto reservado antes de corregir, revisar respuesta y estado, y mantener oráculos derivados del catálogo.

## Objetivo y alcance acordado

Crear un agente de pedidos fiable y vendible para PPP, reutilizable después en Kamppo multitenant. El usuario quiere tandas sistemáticas de casos variados, no depender de que él descubra cada fallo por WhatsApp. Prioridad actual: comprensión de mensajes, consultas frente a compra, ambigüedad, cantidades, variantes, notas, cambios, interrupciones y checkout breve. Cocina, WebSocket, impresoras y pagos externos quedan fuera del foco actual. El piloto considera efectivo y transferencia; Mercado Pago está fuera de esta fase.

Seguir trabajando dentro del alcance autorizado sin pedir permiso otra vez para pruebas gratuitas, correcciones reversibles y despliegues rutinarios de staging. No enviar mensajes a clientes, Meta ni crear pedidos externos por accidente. El usuario autorizó usar su número y reiniciar sus pedidos de prueba, no datos de clientes reales. No inferir que staging está aislado de todas las integraciones: conservar los bloqueos existentes.

## Segunda tanda PDF — dinero, referencias y catálogo alternativo

Base 83e6e89b, staging. Treinta y dos casos nuevos derivados de patrones del PDF y controles sintéticos: precio histórico frente a precio vigente, cancelación frente a “cancelo con 100mil”, consultas de disponibilidad, referencias de cantidad sin producto, demora durante compra y después del pedido, preferencia de bebida condicional, dirección y plato juntos en tres menús sintéticos. Comprueba respuesta además de conservación del carrito. Presupuesto sin cambios: cero llamadas pagadas, 11 usadas / 9 restantes.

Correcciones generales: el destino explícito después de para + calle/carrera se separa antes de aceptar el mensaje completo como dirección; los productos de catálogos alternativos no quedan dentro de la dirección. “Cancelo con” + monto se interpreta como pago/cambio, sin ampliar cancelación. Preferencia condicional compara primero opción principal y después alternativa con opciones de catálogo; no inventa bebida y pregunta el plato si hay más de uno compatible y conserva el cambio elegido por candidato para retomarlo al responder, sin duplicar el plato. Una comida con solo atributo Bebida también admite elección aunque no se llame combo. Opciones de dos letras requieren contexto explícito del atributo y límites de palabra. Consulta temporal de precio usa catálogo vigente, conserva precio del carrito y aclara cuando no hay producto identificado. Referencia de cantidad con varios platos no se atribuye automáticamente al último.

Montaje y límites: el primer run tuvo errores de montaje (servicio de órdenes no simulado, monto esperado como número aunque el contrato es texto, demora genérica sin contexto configurado); no son fallos de producción. Los oráculos se corrigieron y luego se confirmaron defectos de cambio en “cancelo con”, dirección compuesta portable, preferencia principal de dos letras y precio histórico. El control inicial de sabor usaba la opción deseada por defecto: se invirtió el orden de opciones para exigir una modificación efectiva. El ETA genérico se prueba con contexto configurado y el reclamo posterior con búsqueda de órdenes simulada vacía. No acredita consulta de estado real ni cancela órdenes externas.

Pendientes del PDF: reparto simultáneo por varios atributos, citas antiguas, recogida por tercero y ráfagas concurrentes. Los casos ejercitados pasan a desarrollo, no son un holdout. Preferencia condicional cubre la estructura “si tienes con …, si no con …”; no acreditar todos los giros condicionales. Sustituciones comerciales, reconocimiento real de audio y aislamiento multitenant operativo siguen sin acreditarse.

Verificación final: 32/32 focalizadas aprobadas (/tmp/ppp-pdf-second-final-targets.log), TypeScript aprobado (/tmp/ppp-pdf-second-tsc.log). Un único run completo aprobó 62 suites y 1.657 pruebas en 188,72 s (/tmp/ppp-pdf-second-full.log). El run anterior se interrumpió para completar el recorrido de aclaración y no cuenta como aprobación. No se modifican esquema/transacciones de órdenes; se añade un campo opcional al contexto de edición de sesión, compatible con candidatos antiguos. No se repite DB. Código 842d6876 publicado y desplegado en staging. Verificación 2026-10-11 14:24 Bogotá: HEAD 842d687600d9035ea5844c8833e6fe4014299a50, running/healthy, imagen activa y candidate coinciden (sha256:598bb61ea79e689e336d7715ff1c27791d053acbcf33542470f8ce2e2dc48ac8), health OK, DB connected, circuito CLOSED. Evidencia /tmp/ppp-pdf-second-deploy.log y /tmp/ppp-pdf-second-deploy-verified.log. Commit posterior solo de documentación sin reconstrucción necesaria. Main permanece a6890c4a.

## PDF 11/10 y lenguaje hablado — tanda actual

Fuente privada de 30 páginas leída y primeras páginas inspeccionadas visualmente. No se versiona el PDF ni su extracción con datos personales. El índice sanitizado `scripts/fixtures/whatsapp-pdf-1110-patterns.json` separa patrones ejercitados de nueve pendientes: distribución por varios atributos, sabores condicionales, citas antiguas, precios históricos, recogida por tercero, estado posterior, cancelación/pago, referencias ambiguas y ráfagas.

Los tres primeros chats se reproducen con router y catálogo reales, servicios externos/modelo simulados. Oráculos: receta de sopa explícita limita candidatos; almuerzo conserva sopa/presa, nota sin ensalada y domicilio sin comprar gaseosa adicional; elegir estilo del ejecutivo no compra un pollo entero y cambiar la bebida conserva ese almuerzo. Se añaden menús sintéticos, cantidades independientes, dirección por partes, cortesías, total, cubiertos, billete para cambio, bebida ambigua entre dos platos y audio con transcripción simulada. Las respuestas históricas del local no son oráculo comercial ni acreditan disponibilidad actual.

El audio reportado se prueba con su transcripción exacta y reconstrucciones con pausas. No se dispone del archivo original: no se acredita calidad de reconocimiento de voz, solo interpretación del texto y entrada de audio simulada. Sustituciones se guardan como solicitudes en nota; no acreditar autorización comercial, precio ni cumplimiento del cambio. Cero llamadas pagadas; presupuesto permanece 11/20 usadas, nueve restantes. Main permanece a6890c4a. Trabajar únicamente en staging.

Validación final: 36 regresiones nuevas. Focalizadas 36/36; TypeScript aprobado. Suite completa de WhatsApp: 43 suites, 1.527 pruebas aprobadas en 186,908 s (`/tmp/ppp-pdf-full.log`). Complemento: 19 suites, 98 pruebas aprobadas en 12,502 s (`/tmp/ppp-pdf-other-suites.log`). Total 62 suites y 1.625 pruebas, ejecutadas en dos comandos secuenciales; no afirmar un único run de las 62. Logs focalizados `/tmp/ppp-pdf-targets-final.log` y TypeScript `/tmp/ppp-pdf-tsc.log`. Un run anterior completo fue interrumpido para añadir el control de horario del negocio; no cuenta como aprobación. Código e40f0e36 publicado y desplegado en staging. Verificado 2026-10-11 14:04 Bogotá: HEAD e40f0e362ad08c144ee32e9b15209da81e6a0fc1, running/healthy, imagen activa y candidate iguales (`sha256:055fccb70dfecc6efb2def2a51dde1c80a2d59b35b16401d10f395ec55b87a3d`), health OK, DB connected, circuito CLOSED. Logs `/tmp/ppp-pdf-deploy.log` y `/tmp/ppp-pdf-deploy-verified.log`. El commit posterior solo de documentación no requiere reconstrucción. La tanda anterior dbef6ed4 también se verificó sana antes de esta actualización; conservar su evidencia histórica en `/tmp/ppp-next-batch-deploy-verified.log`.

## Tanda de recuperación compuesta — 11 de octubre de 2026

Base c39cdf39, rama staging. Main se promovió al piloto en a6890c4a y el usuario informa que ya la publicó; esta tanda no modifica Main. Se ejecutaron ocho patrones anteriormente reservados con router real, catálogo/guard reales y modelo/Meta/persistencia externa simulados: primer run 4/8 aprobados, cuatro defectos. Añadidos siete controles de portabilidad y límites: 15 regresiones nuevas en total. Los ocho patrones se marcan como desarrollo, no holdout.

Correcciones generales: comparación por hechos del catálogo seguida de compra explícita separada por interrogación; conserva consulta y compra independiente. Pedidos con nota/dirección/pago separan una coma residual después de retirar el pago, evitando usar los números de la dirección como cantidad; la nota de cocina se extrae del texto del producto. Verbos agrega/agrégame/añade permiten cantidades por vocabulario del catálogo alternativo. Perdón/disculpa + cantidad + producto corrige la línea existente, conserva dirección y retoma checkout. Compra referida usa el parser común para fecha y hora; fechas/horas inválidas requieren aclaración sin comprar, no afirma reserva.

Pruebas nuevas: comparación con bebida en PPP y menú alternativo; retiro seguido de nota sobre restantes; compra con nota, domicilio y transferencia en dos menús; precio mínimo seguido de elección de tres broaster; corrección durante pago; compra referida con fecha/hora en menú alternativo; retiro por preparación; foto válida seguida de ilegible; corrección con otra bebida presente; dos horarios/fechas inválidos; consultas negativas sin compra. La compra referida se prueba con Bowl Mediterraneo sin atributos: no se atribuye aprobación al recorrido completo de arroz/medio pollo con variantes. Fotos: interpretación simulada, no visión real. La transferencia usa el ID interno transfer (el primer oráculo esperaba incorrectamente transferencia; se corrigió el montaje).

Verificación final: TypeScript aprobado (/tmp/ppp-next-batch-tsc.log); 62 suites y 1589 pruebas aprobadas en un único run completo, 314.49 s (/tmp/ppp-next-batch-full.log). Evidencias intermedias conservadas: /tmp/ppp-next-batch-baseline.log, /tmp/ppp-next-batch-fixed.log, /tmp/ppp-next-batch-portable.log y /tmp/ppp-next-batch-final-targets.log. Cero llamadas pagadas; presupuesto compartido 11 usadas / 9 restantes. Sin cambios de persistencia/esquema: no se repitió DB.

Límites pendientes: comparación y compra independiente mientras otra selección está abierta; consultas/pedidos en varias líneas; variantes + nota + domicilio + pago; correcciones con varias preparaciones coincidentes; referencia con horario, nota y domicilio en un mismo turno; foto tardía con edición intermedia. Se escriben seis patrones originales sin ejecutar en scripts/fixtures/whatsapp-reserved-followup-patterns.json; requieren semillas y expectativas por turno antes de ejecutarse. No incorporarlos a prompts ni acreditarlos como verdes. Mantener diversidad de catálogo y revisar respuesta además del carrito.

## Tanda actual: evaluación reservada, modelo real y checkout breve

Base `53e4d1c1`, rama `staging`. Se añaden 28 regresiones gratuitas: ocho patrones reservados promovidos a regresiones tras su primera ejecución, seis recuperaciones de comparación/retiro parcial, tres comparaciones por hechos de catálogo, siete recorridos de producto+dirección y cuatro controles de álbum. El paquete de tres arepas es un SKU sintético añadido al fixture; no se presume que exista en PPP real.

Primera evaluación reservada: 6/8 aprobadas; preguntar cuál sopa era la más pequeña compraba una unidad y pedir dos paquetes producía uno. Después también se reprodujo que quitar un paquete no reducía la cantidad. Se conserva la selección pendiente al comparar y se distingue el contenido de un paquete de sus unidades. Quitar una unidad conserva notas y otras líneas; varias líneas o quitar/conservar la misma requieren aclaración. Los ocho casos pasan después de corregir; ya no son un holdout independiente. Nuevo conjunto de ocho patrones en `scripts/fixtures/whatsapp-reserved-next-patterns.json`: NO ejecutado ni conectado automáticamente todavía.

Inferencia real aislada con configuración de staging, modelo `gpt-4.1-2025-04-14`: dos conversaciones, tres intentos/respuestas exitosas, 30.520 tokens de entrada (19.968 cacheados) y 93 de salida. Los oráculos automáticos aprobaron ambas, pero revisión manual rechazó la afirmación «trucha más suave», ausente del catálogo. Solo una se acredita completa en revisión manual: tres churrascos, uno sin ensalada y dos normales. Se añade comparación determinista basada en nombre, precio, descripción y opciones; la corrección posterior se verifica gratis, NO se acredita una repetición pagada. Sin estimación de dólares: el contador de precios existente no cubre este modelo. El archivo privado temporal se eliminó. Informe aislado en `tmp/whatsapp-live-router-report.json`; copia entregable anotada en outputs del chat.

Presupuesto compartido: 11/20 intentos usados, nueve restantes. `whatsapp-live-router-rehearsal.ts` persiste cada intento ANTES de fetch, valida saldo y detecta cambios de ronda/contador. Control gratuito con límite 999 rechaza antes de red y conserva presupuesto (`/tmp/ppp-live-budget-guard.log`). No lanzar inferencia por defecto, gastar artificialmente para obtener un exit code verde ni reiniciar este contador.

Caso nuevo del usuario: productos y dirección en el mismo mensaje pasan al siguiente paso necesario del checkout al terminar el turno, solo si hay carrito modificado, dirección activa confirmada y ninguna selección pendiente. Se reemplaza la respuesta de compra retenida por el prompt de pago/confirmación; consultas no compran y una sopa ambigua conserva sus unidades hasta elegir. La confirmación final sigue explícita: no se crea una orden por mandar dirección/pago. El pie de pago no publica instrucciones que mencionan métodos deshabilitados.

Álbum: se registra el lote recibido antes de su procesamiento serial. Un sobre `other` seguido de una foto real dentro de la ventana de ráfaga omite el aviso genérico «No entendí». Foto ilegible, comprobante y mensaje no soportado aislado siguen visibles. La reproducción simula interpretación de fotos y usa router/retención de respuestas: NO acredita visión real ni confirma el payload concreto de la captura del usuario. Fotos que lleguen después de esa ventana necesitan otra comprobación; no extender el silencio indefinidamente.

Verificaciones parciales: 17 controles de reservados/recuperación/comparaciones aprobados (`/tmp/ppp-reserved-targets-final.log`), un primer run completo de 62 suites/1.563 pruebas aprobado antes de los últimos casos del usuario (`/tmp/ppp-reserved-full.log`), y 17 controles de checkout/fotos aprobados (`/tmp/ppp-checkout-photo-final.log`). TypeScript final aprobado (`/tmp/ppp-checkout-photo-tsc.log`). Primer run completo después del checkout: 61 suites aprobadas y una fallida; 1.573 pruebas verdes y un fallo del montaje de envío simulado que interceptaba la prueba de ID de Meta (`/tmp/ppp-reserved-checkout-full.log`). Esa prueba vuelve a usar el envío real con Meta simulado. Tras registrar también lotes en el webhook, pasan 21 controles focalizados y TypeScript final (`/tmp/ppp-checkout-photo-batch-final.log`, `/tmp/ppp-checkout-photo-tsc-final.log`). Repetición completa final: 62 suites y 1.574 pruebas aprobadas en un único run (`/tmp/ppp-reserved-checkout-full-final.log`), 233 segundos. TypeScript final sin errores. Código `562c283c` publicado y desplegado en staging. Verificado 2026-10-11 11:08 Bogotá: contenedor running/healthy, imagen activa y candidate iguales (`sha256:ce41ac5e9e687c16079affa499f14a20b176fba0a22c5e3634a315d3a93b627d`), health OK, DB connected y circuito CLOSED. Evidencia `/tmp/ppp-reserved-checkout-deploy.log` y `/tmp/ppp-reserved-checkout-deploy-verified.log`. El commit posterior solo de documentación no requiere reconstruir. Modelos, Meta, persistencia de órdenes y pagos simulados salvo las tres inferencias indicadas. No repetir DB: no se modifica esquema/transacciones/persistencia de órdenes.

Siguiente: nuevos reservados con catálogo y expectativas explícitas, compra referida con fecha/hora compuesta, intención informativa mezclada con compra independiente, fotografías parcialmente fallidas y correcciones de cantidades durante pago. Mantener diversidad de catálogo y revisar la respuesta completa, no solo el carrito. No declarar vendible por verde unitario o dos conversaciones pagadas.

## Tanda portable: horarios, repartos y condiciones del catálogo

Base `1e694852`, rama `staging`. Se añaden 27 casos gratuitos con el router real y dependencias externas simuladas, sobre PPP y un catálogo alternativo:
- Fechas relativas, días distintos y DD/MM; horas de 24 horas y am/pm. Cambiar solo fecha conserva hora y viceversa. Conserva carrito, dirección, pago y notas ajenas. Horas ambiguas/ inválidas, fechas imposibles y notas demasiado largas requieren aclaración sin modificar la sesión.
- Reparto por un atributo de un producto con varios atributos: conserva la otra opción y notas en ambas líneas. Opción desconocida no aplica parcialmente el reparto ni cae en una compra distinta. Cambiar varios atributos simultáneamente en cada parte todavía requiere aclaración.
- Rendimiento: comunica la frase completa de la descripción, conservando negaciones y rangos; no extrae «alcanza para tres» de «no alcanza para tres».

Reproducción inicial: 21 de 22 casos fallaban (`/tmp/ppp-portable-baseline.log`). Tras corregir y añadir tres controles de conservación/límite de notas, pasan 46 controles focalizados, incluidos los 25 nuevos (`/tmp/ppp-portable-targets.log`). TypeScript sin errores (`/tmp/ppp-portable-tsc.log`). Primer run completo: 61 suites verdes, una fallida; 1.540 aprobadas y cuatro regresiones de cocción: «3/4» se confundía con fecha (`/tmp/ppp-portable-full.log`). Se distingue la fracción de cocción de una fecha con señal explícita y se añaden dos controles de fecha 3/4. TypeScript final aprobado (`/tmp/ppp-portable-tsc-final.log`). Repetición completa aprobada: 62 suites y 1.546 pruebas en un único run (`/tmp/ppp-portable-full-final.log`). Código `b904663b` publicado y desplegado en staging. Verificado 2026-10-11 09:43 Bogotá: running/healthy, imagen activa y candidate coinciden (`sha256:0ddc6b6b62cb5d2b9429db3b9a6277ff66a8da4052436bedd5d29f8c467fe552`), API OK, DB connected, circuito CLOSED. Evidencia `/tmp/ppp-portable-deploy.log` y `/tmp/ppp-portable-deploy-verified.log`. El siguiente commit solo de documentación no requiere reconstrucción. Cero llamadas pagadas; presupuesto compartido sigue 8/20 usadas, 12 restantes.

Límites pendientes: solicitudes de horario son notas, no reservas. No se resuelven fechas relativas a calendario/zona horaria ni se valida operación futura del local. Compra referida con fecha/hora compuesta, fechas escritas con nombre de mes, citas antiguas y otras intenciones nativas requieren más casos. No acreditar todo el lenguaje ni pedidos programados operativos.

## Reutilización futura en Kamppo

Reutilizar contratos de comportamiento y componentes generales; adaptar catálogo, sesión y transporte a Kamppo. Ejecutar los mismos comportamientos con fixtures por tenant, conservando las regresiones concretas de PPP. No copiar IDs, nombres o precios de PPP como reglas de producción. Añadir una suite específica de aislamiento entre tenants para catálogo, carrito, políticas, mensajes y referencias. Puntos, pagos, horarios y condiciones comerciales deben provenir de configuración del negocio; las reglas históricas de puntos siguen pendientes de parametrización. No se ha migrado ni inspeccionado Kamppo en esta tanda.

## Tanda actual: pedido grande, rendimiento, fecha y abono

Base `5f9a386d` (código previo `91cd9a67`), rama `staging`. Se añaden once regresiones gratuitas en `whatsapp-general-accuracy.spec.ts`:
- Rendimiento por personas: solo comunica la frase numérica presente en la descripción del catálogo; si no existe, pide confirmarlo con el local. No calcula unidades desde comensales. Consulta explícita recuerda un único producto concreto como foco, sin convertir la consulta en compra ni borrar selección pendiente.
- Abonos/anticipos/pagos parciales: requiere coordinación con el local; no fija porcentaje, acepta pago, cambia método ni promete reserva. El piloto sigue efectivo/transferencia; no se añade gestión comercial de abonos.
- Compra referida «quiero pedir esas diez cajas/unidades»: acepta un único producto discutido, carrito vacío y sin conflicto con otras selecciones. Conserva el producto, toma cantidad explícita y registra miércoles como fecha solicitada. No interpreta comensales o fechas como dirección. Carrito ya existente, multi-pedido, preparación pendiente de otro plato o falta de foco requiere aclaración.
- Recorrido completo de veinte comensales → consulta del arroz con medio pollo → diez cajas para miércoles → abono → respuesta nativa de mediodía → 5 Frito/5 Broaster: conserva dos líneas del producto 36 con cinco unidades, sin dirección inventada, pago elegido o reserva confirmada.
- Texto copiado más respuesta de horario: retira la cita únicamente si coincide con un mensaje Bot reciente de la misma conversación. Si parece una cita de bot/pregunta pero no se vincula al historial, pide escribir solo el horario; no reinterpreta el plato citado. No acreditar cualquier cita antigua/foto/humano.

Once controles focalizados pasaron en `/tmp/ppp-large-final-targets.log`. Verificación final del conjunto unitario en dos ejecuciones sin solapamiento: 43 suites WhatsApp/1.421 pruebas en `/tmp/ppp-large-approved-full.log`, más 19 suites restantes/98 pruebas en `/tmp/ppp-large-other-units.log`: 62 suites y 1.519 pruebas aprobadas. No fue un único run completo. TypeScript sin errores en `/tmp/ppp-large-approved-tsc.log`. No se repite DB: no se cambian esquema, transacciones ni persistencia de órdenes. Código publicado y desplegado `46a4f1bf`. Verificación 2026-10-11 09:17 Bogotá: contenedor running/healthy, imagen activa/candidate `sha256:f908954301897c15c0b338d313be74503e8d834092758adad51eef06d3a8f74c`, health OK, DB connected y circuit breaker CLOSED. Logs `/tmp/ppp-large-deploy.log` y `/tmp/ppp-large-deploy-verified.log`. El commit posterior solo de documentación no requiere reconstruir. Baseline de rendimiento/abono: cuatro fallos de respuesta. Primer recorrido largo falló al resolver la compra referida; tras resolverla quedó miércoles como dirección, corregido con exclusión de fechas/comensales puros en extracción de dirección. Modelos, Meta y persistencia externa simulados; cero llamadas pagadas, presupuesto compartido 8/20 usadas y 12 restantes.

Siguiente: rendimiento con intervalos/negación en descripción, fechas/horas distintas de miércoles/mediodía y cambios de fecha, compras referidas después de varias consultas sin foco único, opciones desconocidas y múltiples atributos en reparto, fuentes de cita más antiguas y otras intenciones. Ejecutar después casos reservados y modelo real dentro del saldo autorizado. Confirmación efectiva de pedidos futuros/abonos depende de una política explícita del local/tenant; esta tanda solo registra solicitudes. Las reglas históricas de puntos de Kamppo todavía deben parametrizarse. No declarar vendible por verde unitario.

## Histórico: respuestas nativas y reparto por preparación

Base `060c54e4`, rama `staging`. Esta tanda guarda el ID de Meta de los textos enviados por el bot y lo vincula con `raw.context.id`. El manejo nuevo está limitado a respuestas de opciones reconocidas en el catálogo, con carrito existente y sin selección pendiente: identifica una única línea actual mencionada por una respuesta saliente de la misma conversación. No incorpora cantidades o instrucciones de la cita al pedido. Cita ausente, ajena, entrante, con producto retirado o ambigua pide aclaración. No acreditar soporte completo de «Responder»: otras intenciones, citas de medios/mensajes humanos y el recorrido programado completo siguen pendientes. Los mensajes anteriores que no guardaron ID no se recuperan retroactivamente. Referencia primaria del campo de Meta: https://www.postman.com/meta/whatsapp-business-platform/folder/hysdhqs/context-object.

Se conserva cantidad y texto original en tres rutas de preparación pendiente. El reparto explícito «Los quiero 5 con … y 5 con …» usa atributos del catálogo del producto existente o pendiente, exige que la suma coincida y guarda los cambios únicamente si todas las partes se validan. No transforma arroz con medio pollo en pollos separados; conserva notas y otras opciones. Si varios platos comparten esas opciones pregunta cuál. No elige un combo por su posición cuando el usuario pide una presentación sin combo; precio explícito sigue resolviendo sobre todas las variantes. Se prueba también otro menú de bowls.

Verificación local de la tanda, sin llamadas pagadas: 62/62 suites, 1.508/1.508 pruebas y TypeScript sin errores. Logs `/tmp/ppp-color-name-full2.log` y `/tmp/ppp-color-tsc.log`. «Cuánto cuesta?» durante una preparación pendiente cotiza ese plato y conserva la cantidad. «Un Bowl Verde con arroz» ya no cae en categoría: el color queda en el nombre y la base pedida queda como atributo. El recorrido completo de rendimiento, fecha y abono sigue pendiente. Código publicado y desplegado `91cd9a67`: contenedor running/healthy, health OK y DB connected. Imagen activa/candidate `sha256:d1543094c48e97f2e65c27404715ebcfffc0062c49205369baa836d7aab6e239`. Verificación 2026-10-11. Un commit posterior solo de esta nota no cambia la imagen. La revisión inicial pasó 222 pruebas en dos suites antes de añadir controles. La primera completa se detuvo tras dos fallos de expectativas en controles nuevos (mayúscula de «cuál» y exigir preparación pendiente cuando la ruta de nota ya había agregado diez unidades). Se corrigieron las expectativas manteniendo controles de cantidad/notas/estado/carrito. Después pasaron 17 controles focalizados; se añadió otro para consultar precio antes de elegir preparación. No usar estos resultados para acreditar la revisión final. Cero llamadas pagadas; presupuesto compartido sigue 8/20 usado, 12 restante.

Siguiente: reproducir el recorrido entero de arroz para veinte personas, consulta de rendimiento, diez cajas, miércoles, abono, texto copiado y respuesta nativa de horario, hasta el reparto final. No inventar rendimiento ni aceptar reservas/abonos sin política del catálogo/local. «Un Bowl Verde con arroz» ya quedó cubierto por regresión en esta tanda. Ver `scripts/fixtures/whatsapp-development-pending.json`. Añadir controles de repartos con opciones inexistentes, atributos múltiples y varias líneas del mismo producto; todavía no quedan acreditados. Después ampliar respuestas nativas a otras intenciones con aislamiento de conversación y preservación de estado, ejecutar conversaciones reservadas y verificar modelo real dentro del saldo autorizado. No declarar vendible por pruebas unitarias.

## Histórico: correcciones, cercanía y horario

Base `93369975`, rama `staging`. Se añaden 23 regresiones. Verificación final: 62/62 suites, 1.486/1.486 pruebas y TypeScript sin errores. Logs `/tmp/ppp-references-approved-full.log`, `/tmp/ppp-references-approved-tsc.log` y `/tmp/ppp-references-targets-approved.log`. La primera ejecución completa pasó 1.482 pruebas antes de cuatro controles añadidos; la siguiente encontró una consulta que agregaba un plato (1.485 pasaron, una falló). Se corrigió la separación de consultas y la última ejecución completa pasó. Código publicado y desplegado `3a5e7f42`: contenedor running/healthy, health OK y DB connected. Imagen activa/candidate `sha256:52255c901a457e53520753345e2fd235e2521d5a149f2696915bd6662d736dd7`; verificación 2026-10-11. Documento posterior no requiere reconstrucción. Las correcciones usan catálogo para cantidades/plurales y atributos; conservan notas independientes al corregir cocción. «Los dos» con una sola unidad pregunta. La cercanía se conserva como nota y no inventa dirección; «medio día» se registra como horario solicitado sin prometer reserva.

Leer la sección nueva de `docs/whatsapp-next-batches.md` y `scripts/fixtures/whatsapp-development-pending.json` antes de seguir. Compra por nombre «Bowl Verde con arroz» está reproducida y no resuelta; la edición posterior se prueba seleccionando por código. El usuario añadió flujo de diez cajas de arroz con medio pollo, reparto 5/5 frito/broaster, rendimiento para veinte personas, miércoles/mediodía y abono: solo horario aislado acreditado; recorrido completo pendiente. El webhook conserva raw pero el orquestador no utiliza `context.id` para recuperar mensaje citado. No confundir con los tests existentes de texto copiado.

Ninguna llamada pagada; sigue 8/20 usado, 12 restante. No se cambia persistencia/transacciones; no requiere repetir DB. Siguiente prioridad: los tres casos pendientes y controles de referencia vieja/ajena, nunca tratar cita como nueva compra ni inventar políticas/rendimiento.

## Histórico: consultas, códigos sueltos y pedidos compuestos

Código publicado y desplegado `adb8d582`, base `61fc7f50`, rama permanente `staging`. Verificación: contenedor running/healthy, health OK y DB connected; imagen activa/candidate `sha256:570635addf0c281c9ab851a5cb5796bd9eec8bbd858c39bdc71753b1f609a18c`. El primer health dio 502 durante arranque; la comprobación posterior pasó tras alcanzar healthy. Una actualización posterior solo de documentación no requiere reconstrucción. Plan operativo y procedencia/licencias: `docs/whatsapp-next-batches.md`. Hay ocho casos sintéticos reservados en `scripts/fixtures/whatsapp-reserved-patterns.json`; aún no se ejecutaron y no están conectados automáticamente al runner.

Esta tanda agrega 30 regresiones: 24 de puntos/códigos y seis de pedidos compuestos en dos catálogos. Se reprodujeron 12 fallos iniciales de consultas/códigos y dos de pedidos con variante + «sin ensalada y harto ají». Las correcciones distinguen capacidad frente a petición explícita, validan vouchers sueltos antes de registrarlos como factura y separan la preferencia de cocina de la identidad del producto. No se cambiaron reglas comerciales de puntos ni persistencia. Verificación: 62/62 suites y 1.463/1.463 pruebas pasaron; TypeScript sin errores. Logs `/tmp/ppp-public-full.log`, `/tmp/ppp-public-final-tsc.log`, `/tmp/ppp-public-intents-expanded.log` y `/tmp/ppp-compound-fixed.log`. No se repitió DB porque esta tanda no cambia persistencia/transacciones.

Cero llamadas pagadas en esta tanda: presupuesto compartido sigue en ocho usadas y doce restantes. Las fuentes públicas se usan para seleccionar patrones; no se importaron ni tradujeron conversaciones de licencia no comercial al producto. Las nuevas pruebas son independientes y sintéticas, con dependencias externas simuladas.

Siguiente: cambios de preferencias con otra línea presente, referencias ambiguas después de consultas, turnos compuestos de dirección/pago, medios duplicados y errores parciales. Ejecutar casos reservados después, sin agregarlos al prompt; si fallan pasan a desarrollo y se repone el conjunto reservado. El verde unitario no acredita modelo real, visión real ni operación del local.

## Histórico: consumo del premio y total de la orden

Código publicado y desplegado: `a36a5a68`. Verificado el 2026-10-11: checkout `a36a5a6`, API running/healthy, health HTTP OK y DB connected. Imagen activa y candidate coinciden: `sha256:8fc82333a6038b4455133fc71aafb18dda5feb7bcc73c2a47c43edfdac0b05bf`. Una actualización posterior exclusiva de documentación no requiere reconstruir la API.

Verificación: 62/62 suites unitarias y 1.433/1.433 pruebas; TypeScript sin errores. Las cuatro suites DB cubren 92 pruebas: 90 pasaron en la ejecución conjunta; checkout tuvo un timeout de 30 segundos y un fallo posterior de estado. Se repitió esa suite sola, sin cambios de código ni aumento de timeout: 22/22 pasaron. Las otras tres suites habían pasado. Logs `/tmp/ppp-voucher-full.log`, `/tmp/ppp-voucher-db-full.log`, `/tmp/ppp-voucher-checkout-repeat.log`, `/tmp/ppp-voucher-tsc-final.log`. No confundir esta verificación por suites con un único run DB completo verde. Evitar ejecutar simultáneamente Jest unitario completo y Jest DB en este PC: pueden competir por memoria; la causa exacta del timeout no está acreditada por un perfil.

Base de código: `73bf4fc1` (relevo `5ab77b9d`). Se encontró y corrigió que la creación confirmaba la orden antes de aplicar el voucher y ocultaba el error del canje.

- Orden nueva: valida que tenga un medio elegible, consume el voucher dentro de la transacción de orden/inventario y guarda el código antes de commit. Código inválido/usado/vencido rechaza toda la creación. El post-commit ya no aplica premios ni ignora sus errores.
- Consumo del voucher: bloquea su fila al validar y usar. Dos pedidos distintos no pueden consumirlo a la vez. El método acepta el EntityManager de la orden; una llamada independiente abre su propia transacción.
- Aplicación a orden existente: bloqueo de orden y voucher, recálculo de puntos y guardado dentro de la misma transacción. Aviso WebSocket solo después del commit.
- Chat: carrito completo, carrito corto, contexto del agente y respuesta de éxito descuentan una sola unidad elegible. Los precios y cantidades de las líneas no se modifican. No se cotiza descuento si la caducidad está vencida o mal formada.
- Pruebas reales con MariaDB 10.11 local descartable: voucher con dos medios conserva dos unidades y deja total neto de una; reintento devuelve la orden existente; dos órdenes con el mismo voucher solo crean una; código ausente/usado/vencido o carrito sin medio no crea orden; fallo al guardar el código revierte orden, inventario y consumo. Se verifica también aplicar voucher a una orden existente.
- Estas pruebas sí usan persistencia real, pero transporte, notificaciones, facturación y proveedores siguen aislados. No prueban operación real del local ni modelo/visión real. No se gastaron llamadas API.
- Siguiente foco de canje conversacional: código de premio suelto con carrito vacío, generar para usar después, premio recién generado con carrito existente y caducidad antes de confirmar. Después, álbumes con webhooks duplicados/error en una foto, y conversaciones reservadas con modelo real dentro del saldo de 12 llamadas. Fotos originales del usuario siguen sin adjuntarse; no declarar visión real aprobada con transcripciones simuladas.
- Para Kamppo sigue pendiente parametrizar las reglas históricas de puntos por tenant. Mercado Pago sigue fuera del piloto; su cobro con vouchers no está acreditado por esta tanda.

## Tanda del 11 de octubre: integración y canjes

Checkout activo: `/home/levi/Documents/programming/PPP/PPP-NEST-staging`, rama `staging`, base `a57a2f69`. Se integran los cambios locales de comprensión, ambigüedades y fotos existentes sobre esa base. El estado histórico más abajo corresponde a una tanda anterior y no describe el runtime actual.

- Código publicado y desplegado en staging: `73bf4fc1`. Verificado el 2026-10-11: checkout `73bf4fc`, API running/healthy, health HTTP OK y DB connected; imagen activa y candidate coinciden (`sha256:7eaeeb0b0fb36897b6c5434cbd3dd5bbc4e75d3578883f135c667c65d46e2f3e`). Un commit posterior de este documento no requiere reconstruir la API.
- Verificación final: 61/61 suites y 1.428/1.428 pruebas; TypeScript sin errores. Integración adicional de canjes en MariaDB: 2/2. Logs locales `/tmp/ppp-redemption-full-final.log`, `/tmp/ppp-redemption-tsc.log`, `/tmp/ppp-redemption-db.log`.
- Canje: `PointsService.redeemPointsForVoucher` guarda premio y descuento en una transacción; bloquea la fila de la cuenta para serializar solicitudes concurrentes y elige puntos FIFO con desempate por ID. No se cambiaron las reglas comerciales ni los productos que generan puntos.
- Pruebas gratuitas contra MariaDB 10.11 local descartable: dos solicitudes simultáneas con nueve puntos producen un premio y un rechazo; un trigger que falla al actualizar puntos revierte premio y descuento. 2/2 pasaron. Esquema mínimo aislado: no acredita las migraciones completas ni configuración de staging.
- Router: consulta del procedimiento no genera premio; redimir genera código; aplicar código conserva el medio adicional; repetir con saldo cero rechaza; quitar premio no quita platos ni devuelve puntos ya convertidos en voucher. Se rechazan códigos desconocidos, vencidos, usados y de otra cuenta.
- Se corrige prioridad de «quitar el premio» antes de eliminación de platos; cancelación de «mi pedido» se mantiene como seguimiento. No se afirma una orden activa cuando no existe evidencia o falla la consulta.
- Resumen de fotos: únicamente fotos de pedidos resueltas pueden sustituir su respuesta por carrito. Errores de lectura y comprobantes permanecen visibles, así como preguntas de pago. Las pruebas de fotos simulan interpretación; falta visión real con imágenes originales y álbumes con reenvíos duplicados.
- Revisión de solo lectura en staging: `ppp_users`, `ppp_user_points` y `ppp_point_redemptions` usan InnoDB, necesario para transacciones y bloqueos.
- No se generaron códigos en cuentas reales ni en staging, no se enviaron mensajes externos ni se hicieron llamadas pagadas. Presupuesto sigue 8 usadas / 12 restantes.
- Antes de afirmar vendible: validar modelo real de forma acotada, fotos reales, álbumes con duplicados, identidad de cuenta/canje y descuento/consumo final de premio. Las reglas existentes de puntos usan códigos PPP; su configuración por tenant sigue pendiente para Kamppo.

## Histórico: tanda multilínea del 10 de octubre

- Rama única de integración y deploy: `staging` en `wilmerx5/PPP-NEST`.
- Último commit de código desplegado: `06bf8a97` — `Preserve multiline delivery orders and resolve quoted attribute choices`.
- Staging verificado: checkout del servidor `06bf8a9`, contenedor `ppp-staging-api-1` running/healthy, health HTTP OK y DB connected.
- Imagen activa coincidía con `ppp-nest-staging:candidate`: `sha256:7e5a6368dbfd8ea9e2f60bab705fdebc6d89d7cacf4636173da8a13bb559db39`.
- Suite completa: 58/58 suites, 1.307/1.307 pruebas. TypeScript sin errores. Suite de acertividad: 97 casos; 13 casos focalizados de esta tanda. Logs locales: `/tmp/ppp-multiline-full.log`, `/tmp/ppp-multiline-final-focused.log`, `/tmp/ppp-multiline-tsc.log`.
- Estas pruebas simulan modelo, persistencia y transporte. Comprueban router, catálogo, carrito, estados y respuestas; no prueban precisión del modelo real, visión real, concurrencia ni estabilidad entre días.
- Este documento se publica después de ese commit de código. Un commit posterior exclusivamente documental no implica una nueva versión de la imagen.

## Dónde trabajar

Checkout de trabajo de este chat: `/home/levi/Documents/Codex/2026-10-09/t/work/PPP-current`.

Checkout habitual del usuario: `/home/levi/Documents/programming/PPP/PPP-NEST-staging`, rama permanente `staging` (revisar HEAD antes de continuar). Tiene archivos `dist/` no rastreados: preservarlos. No confundirlo con `/home/levi/Documents/programming/PPP/PPP-NEST`, checkout de Main que no se debe tocar sin una nueva solicitud.

En el checkout de trabajo, `github` apunta al GitHub real y `origin` es un clon local; consultar `git remote -v` antes de usar comandos. En el checkout habitual y servidor, `origin` apunta al GitHub real. No inventar una rama nueva, no borrar las ramas históricas, no fusionar a Main ni hacer reset forzado sobre cambios ajenos.

Inicio en el checkout de trabajo:

```sh
git status --short
git branch --show-current
git remote -v
git fetch github staging
git log --oneline HEAD..github/staging
```

Si la rama remota avanzó, integrar con fast-forward preservando trabajo local. Revisar cambios del usuario antes de editar. Los productos concretos pertenecen a fixtures; las reglas de producción deben usar el catálogo y contexto del tenant.

## Cambios recientes y por qué importan

### `06bf8a97`: multilínea, citas y términos

- `parseCompoundOrderMessage` separa un bloque final de dirección y conserva saltos entre platos. Excluye líneas de saludo y de intención genérica de domicilio.
- Reconoce respuestas como `pierna o pechuga\nPierna porfa` solo cuando las opciones pertenecen a atributos de productos del carrito o selección pendiente y la respuesta identifica una opción única. También reconoce una elección ya aplicada sin abrir una búsqueda nueva.
- Conserva la cocción por plato en pedidos múltiples: dos churrascos `3/4` se guardan con nota `término tres cuartos`; no buscar literalmente `3/4` en el resultado esperado.
- Evita interpretar números de dirección como referencia a un pedido al consultar ETA durante el procesamiento multilínea.
- `Me confirma tiempo y valor por favor?` muestra el carrito y total. Usa `localContext.deliveryTimeNote` si existe; de lo contrario indica que el equipo debe confirmar el tiempo. No confirma la orden.
- Controles: consulta de precio multilínea no compra; catálogo sintético de bowls mantiene dos unidades, nota y atributo elegido.

### `609cd2ef`: pedidos desde foto

Se encontró una pérdida determinista: `resolveImageOrderText` devolvía el primer SKU aunque `textForBot` contuviera varios. Conserva ahora la propuesta completa para el router, con cantidades y notas. El prompt pide todos los productos seleccionados y distingue carrito de carta con múltiples opciones sin selección. Una lectura incierta con pregunta explícita no se convierte por fallback en el primer plato.

`Faltó el churrasco y el arroz con pollo` se interpreta como adición únicamente en un carrito en construcción; las pruebas parten de un pollo ya aceptado y verifican que no se duplique.

IMPORTANTE: las dos fotos originales del usuario no están adjuntas. Solo recibimos el texto del chat. Los tests de visión usaron transcripciones simuladas; no afirmar que la precisión visual esté validada. Pedir esas fotos cuando se vaya a probar visión real. No reemplazarlas por imágenes inventadas y presentarlas como las originales.

### `bf69547b` y tandas anteriores

Preparaciones compuestas (`sin salsas, más miel`), nota de sopa (`sin tanto recado`), producto inexistente (`mazorca da`), cantidades de otro catálogo, dirección por partes, exclusiones tardías, cocción `3/4`, atributos + ají en un mismo turno y cambios de cantidad durante elecciones. Existen regresiones; no deshacerlas al resolver casos nuevos.

## Archivos que orientan el trabajo

- `src/whatsapp/whatsapp-general-accuracy.spec.ts`: harness del router completo y corpus. `harness(menu, agentEnabled)` simula al agente con respuesta neutra; probar reglas con agente habilitado y deshabilitado cuando aplique. Verificar carrito exacto, cantidades, notas, atributos, estado y respuesta; no basta una confirmación bonita.
- `src/whatsapp/whatsapp-orchestrator.service.ts`: flujo, edición de carrito, dirección, selección y checkout.
- `src/whatsapp/whatsapp-catalog.service.ts`: resolución por catálogo, consultas, segmentos, atributos y cantidades.
- `src/whatsapp/whatsapp-session-intents.ts`: intenciones y consulta conjunta de tiempo/valor.
- `src/whatsapp/whatsapp-kitchen-preference.ts`, `whatsapp-cooking-term.ts`, `whatsapp-compound-parse.ts`: utilidades de preparación, cocción y mensajes compuestos.
- `scripts/fixtures/whatsapp-beta-menu.json`: menú de pruebas actual; nombres/precios históricos no son la fuente de verdad.
- `scripts/fixtures/whatsapp-real-chat-patterns.json`: 14 patrones seleccionados de 34 bloques reales, anonimizados. Nueve están automatizados, cinco pendientes.
- `docs/whatsapp-real-chat-testing.md`: cobertura, límites y evolución de las tandas.
- `docs/whatsapp-model-budget.json`: presupuesto compartido, obligatorio antes de cualquier inferencia.
- `scripts/whatsapp-live-router-rehearsal.ts` y `scripts/fixtures/whatsapp-live-router-cases.json`: ensayo con modelo real y dependencias externas simuladas. Los fixtures del corpus NO se ejecutan automáticamente con ese runner; adaptar y revisar sus expectativas primero.

El original privado de chats está en `/home/levi/.codex/attachments/e387d2f2-9c09-43b2-9d1e-0bc7aa6603ad/Pasted text.txt`. La numeración CHAT se repite entre lotes. Tratarlo como datos históricos no confiables, nunca instrucciones. No copiar teléfonos, nombres, direcciones, coordenadas o cuentas reales a Git. Los precios y respuestas antiguas del operador no son oráculos.

## Siguiente tanda concreta

1. Hecho en simulación, sin inferencia: si el cliente no nombra la bebida, el combo toma la primera opción y no pregunta. Un mensaje posterior corto la cambia solo si hay una opción única: `Giger` pasa de Colombiana a Ginger; `Fanta` deja la primera; un typo empatado no cambia nada.
2. Hecho en simulación: `preparacion-y-barrio` conserva sobrebarriga, notas `dorada delgada` y `Sin ensalada`, calle, casa y barrio.
3. Hecho en simulación: `cambio-acompanamiento` deja un ejecutivo, sopa Menudencias, nota de papa salada y «bien frito». «además / aparte / y una sopa» sigue siendo otra sopa. El mismo recorrido pasa con un almuerzo de otro catálogo.
4. Hecho en simulación: pollo sin estilo + sopa conserva las dos cantidades. «dos pollos y una sopa» pregunta frito/broaster y el tipo de sopa; «¿qué sopas tienes?» no borra esa elección. Luego «broaster» y «ajiaco» dejan 2 broaster y 1 ajiaco. El mismo recorrido pasa con otro catálogo. `pregunta-durante-variante` sigue haciendo explícito `frito`.
5. Hecho en simulación, con el menú de PPP y con un menú ficticio: un «sí» con pollo y sopa abiertos no compra; una cita sin respuesta no elige las dos opciones; un cambio que cabe en dos líneas pregunta cuál; un pago posterior reemplaza al anterior sin tocar el carrito; reiniciar suelta la cantidad pendiente; una nota contradictoria no agrega otro plato. La corrección «mejor dos» también queda en el menú ficticio.
6. Hecho en simulación, sin marcar los JSON como aprobados: si dicen que un plato es redimido y otro adicional, y no hay código validado, no se descuenta ni se inventa el premio. Lo mismo con un bowl de otro menú. Si la orden de hoy existe, «se demora» usa ese estado y «cancelarlo» no la borra: pide llamar. Si no hay orden, pide el número y no inventa una ETA. `canje-y-adicional` y `postventa-cancelacion` siguen en `automated: false`.
7. Hecho en simulación, con PPP y otra carta: «otro igual» y «para dos» suben la cantidad de un solo plato. «Lo mismo», «no gracias», «hoy no» y «listo» con elecciones abiertas no cierran ni duplican. «Mañana» no se lee como manzana. «Dos de esos» conserva la lista y deja cantidad 2. «Mitad frito mitad broaster» son dos medios. «Para la mesa» no es domicilio.

Los dos pendientes del JSON son `canje-y-adicional` y `postventa-cancelacion`. No confundir selección de casos con ejecución aprobada.

## Método de trabajo y verificaciones

- Primero reproducir el fallo gratis con el router completo; comparar estado antes/después.
- Cubrir variantes de comportamiento y otro catálogo. Evitar tests que solo reflejen el código escrito o excepciones por producto.
- Cambiar una causa concreta, ejecutar suite focalizada y corregir antes de ampliar.
- Una vez pasan los casos afectados, correr TypeScript y suite completa para reglas compartidas. No iniciar una suite completa mientras se siguen añadiendo casos que pueden fallar, ni ejecutar suites duplicadas en paralelo sin necesidad.
- Publicar y desplegar solo al pasar las comprobaciones; verificar el runtime. Actualizar corpus/documentación y el presupuesto si se usó modelo.
- Informar avances concisos en español durante el trabajo. El usuario está frustrado por el gasto; decir claramente qué es simulación, qué es inferencia real y cuánto se consumió.

```sh
npx jest src/whatsapp/whatsapp-general-accuracy.spec.ts --runInBand -t 'patrón del describe o caso'
npx tsc --noEmit --incremental false
npx jest --runInBand
```

## Presupuesto de modelo: no reiniciarlo

Autorización humana de esta ronda: hasta 20 intentos de API. Usados **11**, disponibles **9**. Fallos y reintentos también cuentan. Las últimas tandas de preparación, fotos y multilínea usaron cero llamadas. No sumar casos simulados a `acceptedConversations`: ese campo documenta rondas previas con inferencia real.

Modelo real observado: `gpt-4.1-2025-04-14`. No cambiar modelo ni inventar un coste en dólares. Registro local adicional: `/home/levi/Documents/Codex/2026-10-09/t/work/authorized-model-budget.json`; comparar con el registro versionado antes de gastar. El presupuesto es de esta ronda autorizada, no permiso permanente para futuras sesiones; conservar el saldo si el siguiente agente continúa este mismo trabajo.

Para inferencia real: casos seleccionados, una repetición, `WHATSAPP_BETA_LIVE=1`, `WHATSAPP_BETA_MAX_REQUESTS` positivo y no mayor al saldo, `WHATSAPP_BETA_CASE_IDS` explícitos, `WHATSAPP_BETA_STOP_ON_FAILURE=1`. Leer el runner antes de ejecutarlo; el fetch contabiliza cada intento. Puede salir con error si todos los casos se resuelven determinísticamente y no hubo respuesta de API exitosa: no gastar artificialmente para que el exit code sea cero.

Informe ignorado: `tmp/whatsapp-live-router-report.json`. Revisar `apiUsage`, contar TODOS los intentos y actualizar ambos registros incluso si hubo fallo. Verificar acciones/carrito, no solo las respuestas. Nunca enviar mensajes externos para esta validación.

El script local `/home/levi/Documents/Codex/2026-10-09/t/work/staging-ai-private-config.cjs` permite recuperar configuración efectiva desde el contenedor con guard de staging. Si de verdad hace falta: inspeccionar primero su funcionamiento, redirigir la salida a un archivo privado con permisos restrictivos fuera de Git, jamás imprimirla ni usar `cat` sobre ese archivo. El archivo temporal usado antes fue `work/authorized-private-ai.json` y se eliminó; comprobar que no quedó material privado. Borrar el temporal al terminar. No pegar claves en comandos visibles, comentarios ni informes.

## Deploy de staging autorizado

SSH configurado en este PC: `root@76.13.119.125`. No es `76.16.119.125`. Checkout `/opt/ppp-staging`, rama staging. Hay `bin/` no rastreado: preservar. Contenedor `ppp-staging-api-1`.

Tras commit y push a `github staging` en el checkout de trabajo:

```sh
ssh -o BatchMode=yes -o ConnectTimeout=10 root@76.13.119.125 \
  'cd /opt/ppp-staging && git pull --ff-only origin staging && docker compose --env-file .env.staging -p ppp-staging -f docker-compose.staging.yml up -d --build api'
```

No usar compose general, `--remove-orphans`, borrar volúmenes ni reconstruir la DB por rutina. El warning de `mariadb_local` es conocido; no tocar ese servicio. `.env.staging` contiene secretos: no imprimir ni subir.

Verificar después:

```sh
ssh -o BatchMode=yes -o ConnectTimeout=10 root@76.13.119.125 \
  'cd /opt/ppp-staging && git rev-parse --short HEAD && docker inspect --format "{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}} {{.Image}}" ppp-staging-api-1 && docker image inspect --format "{{.Id}}" ppp-nest-staging:candidate'
curl --fail --silent --show-error https://dev.prontopolloportal.com/api/health
```

Esperar brevemente si está starting/502 al reiniciar; comprobar healthy y endpoint OK antes de afirmar que quedó live. Comparar imagen candidata con la del contenedor. Si el clon no tiene ref remoto de staging, seguir el refspec de `AGENTS.md`; no recrear una rama que ya existe.

Sincronizar también el checkout habitual del usuario con fast-forward después de revisar status; preservar `dist/`. Los frontends de cocina/pedidos/mesas se suben manualmente por Hostinger cuando corresponda; esta tanda solo cambió backend y no requiere subir frontends.

## Qué falta para llamarlo vendible

Cocina: el usuario la dio por verificada. `cocina-ppp` sigue apuntando a producción, así que `STAGING_ORDER_EVENTS_ALLOW` permanece apagado. Pagos en línea: el usuario ya los recorrió; no reabrir Mercado Pago en este ciclo.

Siguen abiertos: desplegar el trabajo local; un canje con puntos reales de staging (la suite ya cubre premio validado y no validado); un inbound auténtico de Meta; un piloto corto vigilado; y las 12 llamadas de modelo que quedan. No es certificación de venta.


## Tanda de OCR incierto y recuperación de audio — 2026-10-11

Base 23ccdb05, rama staging. Ocho regresiones nuevas con PPP y menú ficticio: foto incierta con un único producto visible, sin pie o con «Esto», no selecciona; selección escrita explícita se conserva; audio fallido seguido de pedido por texto recupera cantidad sin repetir error. Cuatro fallos iniciales reproducidos en /tmp/ppp-media-uncertain-baseline.log. Se evita convertir OCR incierto sin pedido propuesto en compra, incluso cuando visión no devuelve reply. Dieciocho controles focalizados aprobados (/tmp/ppp-media-uncertain-targets.log) y TypeScript aprobado (/tmp/ppp-media-uncertain-tsc.log). Suite completa aprobada: 65 suites y 1.741 pruebas, 196,519 s (/tmp/ppp-media-uncertain-full.log). Cero llamadas pagadas, presupuesto permanece 11/20 usadas y nueve restantes. Percepción simulada; no acredita el archivo original. Main no cambia.

Código 781710ad publicado y desplegado; verificado 2026-10-11 16:04 Bogotá: running/healthy, imagen activa y candidate iguales sha256:6bbfe133237a9a71081133dd38b85ad245093c09572fe552fe82a274e5781cc9, health OK, DB connected y circuito CLOSED. Evidencia /tmp/ppp-media-uncertain-deploy-verified.log. Próxima tanda: ráfagas de fotos con edición intermedia y consultas explícitas junto a imagen, simuladas primero; originales pendientes para acreditar percepción real.


## Comparación efectiva de modelos — 2026-10-11

Lectura directa de settings dentro de contenedores: producción ppp_nest_api usa gpt-5-mini; staging ppp-staging-api-1 usa gpt-4.1-2025-04-14. Ambos usan whisper-1 para transcripción (confirmado también en módulo compilado de producción); el texto transcrito pasa al router y modelo conversacional del entorno. Visión comparte openaiModel con conversación, no tiene modelo independiente. Producción mantiene límite de visión 700 sin reasoning_effort; staging incorpora minimal para familia GPT-5 original, aunque hoy corre GPT-4.1 y no envía ese parámetro. El límite max_completion_tokens incluye razonamiento y salida visible según https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create . Esto es hipótesis de fallo, no causalidad probada ni comparación de calidad. No se encontraron líneas Vision empty/incomplete response con patrón esperado en logs de producción de últimas 48 horas; ausencia de ese log no descarta truncamiento en código antiguo.

No se cambiaron modelos ni configuración de producción/staging; cero inferencia pagada, saldo 11/20 usadas. Para comparación válida usar mismo código, catálogo, prompt y archivo original con ambos modelos; medir extracción, cantidad, atributos, finalización, latencia y uso. Comparar solamente dos WhatsApps actuales confunde modelo con versiones distintas. Audio: comparar primero transcripción original, luego interpretación; cambiar modelo conversacional no cambia whisper-1. Documentación oficial consultada: https://developers.openai.com/api/docs/models/gpt-5-mini y https://developers.openai.com/api/docs/models/gpt-4.1 .


## Modelos alineados y formatos de audio — 2026-10-11

Por solicitud del usuario se actualizó SOLO el setting de staging a gpt-5-mini, igual que producción, y se reinició únicamente ppp-staging-api-1. Health OK/healthy y DB connected después. Audio sigue whisper-1 en ambos; versiones de código distintas, por lo que mismo modelo no garantiza igual comportamiento. Lecturas previas gpt-4.1 corresponden a tandas históricas, no al runtime actual. No se modificó Main ni producción.

Siete controles nuevos de audio: WAV/M4A/MPGA y cuatro respuestas inválidas del proveedor. Un fallo inicial: MPGA se nombraba OGG; corregido en audioExtension. Validación: 3 suites y 31 pruebas aprobadas (/tmp/ppp-aligned-model-audio-tests.log), TypeScript aprobado (/tmp/ppp-aligned-model-tsc.log). Baseline /tmp/ppp-aligned-model-audio-baseline.log. Cambio limitado al mapeo de formato de audio; no se repitió suite completa ni se atribuyen 1.748 aprobaciones. Cero llamadas pagadas; 11 usadas, nueve restantes.

Para mejorar reconocimiento comparar originales con whisper-1 y gpt-4o-mini-transcribe, mismos archivos y oráculos de cantidades/productos/notas/dirección. Documentación oficial https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe describe mejoras frente a Whisper, no acredita mejora local. Solicitar 3–5 audios originales con transcripción esperada, incluidos ruido, pausas y correcciones. Hay patrones del PDF pendientes; no requiere nuevos chats para seguir simulaciones. Próxima tanda: ráfagas, edición intermedia y consultas con fotos. No migrar audio en ambos entornos sin medir antes.

## Corrección de alineación por solicitud humana — 2026-10-11

El usuario indicó conservar el modelo observado funcionando en staging: se cambió el setting de producción y staging a gpt-4.1-2025-04-14 y se reiniciaron exclusivamente ppp_nest_api y ppp-staging-api-1. Relectura de ambas DB confirma el mismo modelo. Audio sigue whisper-1. Se reemplaza la alineación temporal anterior a gpt-5-mini; no modificarla en próximas tandas por rutina. No se cambiaron ramas/código ni se fusionó staging a Main. Staging running/healthy, health OK y DB connected. Producción running (sin healthcheck Docker); comprobar endpoint de health. Cero inferencia pagada. Modelos iguales no eliminan diferencias de versión de código.


## Medios secuenciales y corrección de cantidad — 2026-10-11

Diez regresiones nuevas: foto selecciona dos platos, corrección textual o audio transcrito cambia a tres sin sumar; foto ilegible posterior conserva edición; consulta de precio junto a foto incierta no compra. PPP y Bowl Mediterraneo sintético. Dos controles negativos evitan convertir «tres más» o pedido compuesto en cantidad absoluta. Cuatro fallos iniciales en /tmp/ppp-media-sequential-baseline.log; la regla de cortesía aceptaba «Perdón tres» pero no «Perdón quiero tres». Se admite quiero opcional después de disculpa explícita, conservando límites.

Diez focalizadas aprobadas (/tmp/ppp-media-sequential-tests.log); TypeScript aprobado (/tmp/ppp-media-sequential-tsc.log); suite completa 65 suites y 1.758 pruebas, 197,074 s (/tmp/ppp-media-sequential-full.log). Servicios/modelo simulados, cero API pagada, saldo nueve. No acredita concurrencia de ráfagas, reconocimiento de archivos originales ni prueba de modelo real. GPT-4.1-2025-04-14 sigue configurado en ambos entornos; producción no recibe este cambio de código. Próxima tanda: referencias con varias líneas y pedidos distribuidos entre variantes, con consulta intercalada.

Desplegado ad7f019e en staging, verificado 2026-10-11 16:40 Bogotá: running/healthy, candidate y contenedor coinciden sha256:f6cfbc3eeeb03a55bf5283660327c955f7394095904226b52cabbcfc18d300bd, health OK, DB connected, CLOSED. Evidencia /tmp/ppp-media-sequential-deploy-verified.log.

## Promoción autorizada a Main — 2026-10-11

Staging 663808ce fusionada en Main conservando cambio de puntos 0cd81307. Main local/remota publicada en 5525e502. Validación de combinación: 65 suites, 1.758 pruebas, 208,422 s (/tmp/ppp-main-promotion-full.log), TypeScript aprobado (/tmp/ppp-main-promotion-tsc.log). Ambas configuraciones efectivas reconsultadas: gpt-4.1-2025-04-14; audio whisper-1. No se reconstruyó/desplegó producción en esta promoción: publicación Git no equivale a deploy. Staging se conserva para próximas tandas. Cero inferencia pagada.


## Cambios nuevos, foto por código y ejecutivo en mensajes — 2026-10-11

Revisados y preservados cambios locales de catálogo, parser compuesto, menú nombrado, pagos y webhook. Direcciones pegadas, notas dentro de menú, reparto de dos ejecutivos y encolado de lote antes de esperar. Foto reconocida como código único se resuelve a nombre de catálogo para usar defaults; PPP y catálogo alternativo con hasAttributes explícito. El montaje alternativo inicial omitía hasAttributes y no acredita defecto de producto por sí solo.

Primera regresión completa falló: 14 casos, 3 suites (/tmp/ppp-new-changes-full.log). Corregidos límites: repetición de cantidad solo misma cantidad/referencia breve; monto temprano exige afirmación de pago, no pregunta ni opción numérica; continuación de menú solo multilínea; destino comercial seguido de dirección no queda como producto. Recuperación 256 pruebas /3 suites (/tmp/ppp-new-changes-recovery.log). TypeScript aprobado /tmp/ppp-new-changes-tsc-final.log. Run completo posterior 65 suites y 1.787 pruebas aprobado, 205,563 s (/tmp/ppp-new-changes-full-final.log).

Después de ese run se agregaron dos regresiones exactas del usuario: ejecutivo, mondongo/pollo frito/pierna pernil/papa salada, limonada en tres turnos separados y texto agrupado. Ambas pasan (/tmp/ppp-executive-three-turns.log): un ejecutivo id22, qty1, opciones correctas y nota papa salada. No afirmar 1.789 pruebas en único run ni lote auténtico de Meta: esos dos tests son router con agente deshabilitado y servicios simulados. El webhook tiene prueba separada de encolado; falta ejercicio end-to-end con eventos reales. Cero inferencia pagada; nueve solicitudes disponibles. Modelos GPT-4.1-2025-04-14 alineados; audio whisper-1. Main no recibe automáticamente esta tanda.

Tanda 1f1b2dfa desplegada y verificada 2026-10-11 19:31 Bogotá: running/healthy, candidate y activa iguales sha256:71da375cd5a34dfb14c72082041f142e7d8fd848f262598900f68705c6c609ec, health OK/DB connected/CLOSED. Evidencia /tmp/ppp-new-changes-deploy-verified.log. Primera comprobación durante build mostraba imagen antigua y no cuenta como deploy terminado.


## Ráfagas concurrentes y menús con cantidad — 2026-10-11

Ocho regresiones nuevas pasan por handleIncoming concurrente y reloj simulado: tres burbujas completan un ejecutivo PPP o menú vegetariano ficticio; cantidades uno/dos; reintento de una burbuja con mismo ID. Comprueban una sola respuesta, una línea, cantidad/atributos/nota exactos. Dos fallos iniciales: dos menú vegetariano no reconocido; se amplía marcador de cantidad en isNamedMenuDishOrderPhrase. Baseline /tmp/ppp-complex-burst-baseline.log. Focalizadas 27 pruebas/3 suites (/tmp/ppp-complex-burst-tests.log), TypeScript aprobado (/tmp/ppp-complex-burst-tsc.log), full único 65 suites y 1.797 pruebas, 206,344 s (/tmp/ppp-complex-burst-full.log). Incluye los dos casos exactos añadidos después del run previo.

Meta/modelo simulados; no son mensajes reales enviados ni acredita latencia/entrega de Meta. El usuario autoriza ráfagas WhatsApp al número de pruebas cuando se necesiten; conservar guard de destinatario, aislamiento y límite de API compartido. Esta tanda usa cero llamadas pagadas, saldo nueve. No modifica Main ni modelos. Próxima tanda: ráfagas con pausa larga, cambio de intención y mezcla foto/audio/texto; no asumir que todo mensaje siguiente pertenece al mismo plato.

Desplegado c32574dc, verificado 2026-10-11 19:45 Bogotá: running/healthy, imagen activa y candidate iguales sha256:2c488d5c82c8f0d394b8f0bc675f70692c8e7e1a4080a8a653cfb29732262460, health OK, DB connected, CLOSED. Evidencia /tmp/ppp-complex-burst-deploy-verified.log.

## Tanda en desarrollo: extras dentro de ráfaga

Ocho regresiones nuevas en general-accuracy: PPP y menú vegetariano, cantidades 1/2, mensajes separados o ráfaga concurrente, bebida incluida + sopa adicional aparte. Resultado inicial seis fallos y dos verdes (PPP separados), /tmp/ppp-burst-extras-tests.log. Estado NO publicable: pruebas locales rojas conservadas, sin cambio de producción ni deploy. En PPP ráfaga la sopa del adicional sustituye la sopa incluida y se replica nota; en sintético pierde cantidad/opciones incluso separado. Registro sanitizado scripts/fixtures/whatsapp-burst-extras-development.json. Resolver alcance por línea y prioridad de selección pendiente antes de aceptar sopa como SKU independiente. No marcar estos casos aprobados ni saltarlos. Cero API pagada, nueve restantes. Última release saludable c32574dc; documentos publicados posteriores 2d300b3e.


## Cierre de extras dentro de ráfaga — 2026-10-11

Los ocho casos pendientes ahora pasan. Se delimita texto del menú antes de una línea de compra adicional explícita, se conserva texto propio del extra y no se heredan notas globales. Opciones con nota se procesan sin retirar elecciones del catálogo; «de tomar» no bloquea opción de bebida. Lectura de cantidad de catálogo acepta «quiero pedir dos…». No usar originalText con dirección al agregar menú: produjo cantidad 7 por calle 7 y se revirtió ese intento.

Recuperación inicial 6/8 y luego 7/8; full intermedio tuvo 15 regresiones de ediciones, corregidas con protección de nombres/opciones. Suite general intermedia 486/487, último fallo dirección corregido. Evidencias /tmp/ppp-burst-extras-recovery.log, recovery2.log, general-final.log y full.log; no acreditan aprobación final. Validación final 12 focalizadas aprobadas (/tmp/ppp-burst-extras-approved-targets.log), TypeScript aprobado (/tmp/ppp-burst-extras-tsc-final.log), 65 suites y 1.805 pruebas en único run completo, 206,618 s (/tmp/ppp-burst-extras-full-final.log). Registro JSON actualizado a development_regressions_passed. No se cambiaron oráculos para aprobar. Meta/modelo simulados, cero llamadas pagadas, nueve restantes. Main no recibe esta tanda.

Desplegado b37179cc, verificado 2026-10-11 20:05 Bogotá: running/healthy, activa/candidate iguales sha256:3b0181c6d55435a3ea6a5036246effe958faa7de966c2b51fe1ee05852cb46af, health OK/DB connected/CLOSED. Evidencia /tmp/ppp-burst-extras-deploy-verified.log.


## Pausas y correcciones después de extra — 2026-10-11

Seis regresiones nuevas en general-accuracy, sin cambio de código de producción: PPP y Menu Vegetariano ficticio, 5/60 segundos entre mensajes vía handleIncoming con fake timers, dos almuerzos con sus opciones y una sopa extra sin notas ajenas. Consulta de precio intercalada no muta carrito; «Perdón quiero tres [menú]» cambia cantidad del menú sin tocar sopa adicional. Seis pasan de entrada (/tmp/ppp-pauses-tests.log); controles relacionados 33 pruebas/2 suites aprobadas (/tmp/ppp-pauses-related-tests.log), TypeScript aprobado (/tmp/ppp-pauses-tsc.log). No se repite suite completa porque no hay implementación nueva; no atribuir 1.811 a full. Último full sigue 1.805. Cero llamadas pagadas y no se enviaron WhatsApps reales; clock/Meta/modelo simulados. Tanda solo pruebas/documentos: no requiere rebuild. Última imagen saludable b37179cc. Main intacta. Próxima tanda: dos platos compatibles con una opción, referencia «el segundo» y foto/audio entre las burbujas; crear baseline antes de modificar.


## Elección posicional dentro de cambio ambiguo — 2026-10-11

Ocho nuevas regresiones en PPP/otro catálogo: el primero/el segundo/2 eligen una línea para cambiar opción y agregar nota, conservando cantidad y otra línea; el tercero fuera de lista conserva carrito y pendingCartAttributeEdit. Baseline seis fallos y dos verdes /tmp/ppp-ordinal-edit-baseline.log. Se admite referencia posicional solo con pendingCartAttributeEdit y firma de carrito vigente; se muestra lista numerada en orden de carrito. Debug detectó orden inverso de candidatos; ahora ordena índices antes de mostrar/persistir. No alterar referencias de listas antiguas: selección se aplica según candidatos almacenados. Los mocks de debug eliminados antes de validar.

14 focalizadas aprobadas /tmp/ppp-ordinal-edit-targets-final.log; TypeScript /tmp/ppp-ordinal-edit-tsc.log aprobado; full único 65 suites/1.819 pruebas, 213,674 s /tmp/ppp-ordinal-edit-full.log. Incluye seis controles de pausas publicados en tanda previa. Cero API, nueve restantes. Modelo/Meta simulados. Main no recibe la tanda. Próximo: invalidación por cambio de carrito durante aclaración y retorno desde foto/audio al referente; no interpretar ordinal sin elección pendiente.

Desplegado 3a0914cc, verificado 2026-10-11 20:19 Bogotá: running/healthy, candidata/activa iguales sha256:d984e9fb117ab30c7da612562e72727cabb27e791becfa346cf5496806c7cafa, health OK, DB connected, CLOSED. Evidencia /tmp/ppp-ordinal-edit-deploy-verified.log.


## Preparación de ensayo real WhatsApp — 2026-10-11

Usuario solicita WhatsApp real y mejora de audio. Runner human-rehearsal actualizado de rama histórica a staging; solo workflow_dispatch, sin autoenvíos por push. Cinco pruebas node offline aprobadas (/tmp/ppp-live-preflight-offline.log), commit4e7390de publicado; cambio de runner/workflow sin rebuild API. GitHub CLI no autenticada local/servidor, pero credencial Git existente permitió dispatch sin imprimir claves. Preflight real terminado éxito: https://github.com/wilmerx5/PPP-NEST/actions/runs/38191659364 . Informe privado /tmp/ppp-real-preflight-report: ok=true, authorized_context/health_database/staging_admin_login/effective_staging_target/catalog_and_empty_chat/logout verdes; webhookPosts=0 y steps vacíos. NO acreditar mensajes WhatsApp enviados ni modelo real por este preflight.

Próximo: añadir y verificar límite de intentos de inferencia efectiva para ensayo real antes de execute=true; runner actual tiene 11 pasos y no impone tope al modelo del backend. Saldo compartido nueve; no gastar sin límite ni activar workflow de 11 pasos asumiendo que todos serán deterministas. Mantener un único destinatario, no confirmar pedidos y detener con actividad concurrente. Audio permanece whisper-1, gpt-4o-mini-transcribe es candidato documentado, no migrado. Faltan archivos originales y transcripción esperada para comparar calidad; no contar transcripciones simuladas como reconocimiento real. Cero API pagada esta tanda. Main intacta.


## API real y revisión de cobertura PDF — 2026-10-11

Runner full-router ejecutado con key/config privada de staging; modelo gpt-4.1-2025-04-14, Meta/órdenes/persistencia aislados. Primer intento max3 paró por límite antes de respuesta final, consulta y carrito correctos pero agent_error de presupuesto: NO es rechazo de comprensión. Informe /tmp/ppp-api-capped-report.json, log /tmp/ppp-current-model-api.log. Repetición focalizada del mismo recorrido max4: context-question-then-other-purchase aprobada con cuatro respuestas exitosas, consulta mojarra no compra, elección posterior añade una trucha asada. Log /tmp/ppp-current-model-api-completion.log y tmp/whatsapp-live-router-report.json ignorado. Los otros dos casos seleccionados inicialmente NO se ejecutaron por stop-on-failure; no acreditarlos. Siete intentos nuevos, total18/20 y DOS restantes. Local ledger previo8/12 estaba desactualizado; sincronizado desde registro autoritativo. Temporal privado de credenciales eliminado.

Índice PDF:24 patrones de desarrollo ejercitados y2 pending_not_executed. Distribución completa de varios atributos/papa por línea y ráfaga pedido/dirección/barrio aún requieren cierre; los tests recientes cubren partes, no sirven para marcar todo patrón aprobado. Audio sigue whisper-1; faltan originales para comparación de percepción. Esta ronda no envió WhatsApps reales ni confirma órdenes; API real no equivale a Meta real. No fijar coste USD: proveedor reporta tokens, informe no tiene tarifa calculada. Mantener saldo2 como límite compartido, no reutilizar cifras históricas de nueve/doce. Main intacta.


## Autorización adicional y API real — 2026-10-11

El usuario autorizó 20 llamadas adicionales, sumadas a dos restantes: límite acumulado40, saldo inicial22; no se reinicia usado18. Tanda max10 intentos, una repetición y stop-on-failure: cinco conversaciones aprobadas con full-router/modelo/config de staging. Dos usan API (arroz con harto ají + consulta de jugos, ejecutivo con sus opciones + sopa adicional); tres deterministas (sopa/cantidad tras consulta de bebidas, pollo/cantidad tras precio, aclaración de arepas+nota). No acreditar esas tres como inferencia real. Siete respuestas API exitosas, sin errores; total25/40, QUINCE disponibles. Modelo gpt-4.1-2025-04-14. Log /tmp/ppp-api-additional-round.log; reporte ignorado tmp/whatsapp-live-router-report.json; resumen sanitizado outputs/PPP-api-ronda-adicional.json en chat. Ledger primario/local y AGENTS actualizados.

Nuevo escenario versionado pdf-executive-options-extra-after-interruption: dos ejecutivos, mondongo/frito/pierna pernil/papa salada, limonada y sopa adicional independiente. Runner real aprobó cantidades/atributos/notas/respuesta. Los nombres son fixtures y oráculos del catálogo de ensayo, no excepción productiva. Meta/órdenes/persistencia aisladas, no se enviaron mensajes reales. No se hicieron cambios de implementación ni se reconstruyó API; no repetir full gratuito por rutina. Temporal de credenciales eliminado. Main no cambió. Audio sigue pendiente de originales. No atribuir cobertura al PDF completo ni presupuestos históricos como vigentes.

## Plan comercial documentado

Leer docs/WHATSAPP-COMMERCIAL-READINESS-PLAN.md: evidencia actual, puertas de piloto/venta, fuentes primarias AWS/Google/Intercom y tareas por responsable. Metas100conversaciones/95%conresultado/p95texto15s son propuestas, no mediciones ni estándares de marcas. Referencia vigente a modelo/presupuesto/commits debe contrastarse antes de usar. La siguiente acción es cerrar patrones PDF pendientes gratis, conjunto reservado focalizado con API y canal real con tope efectivo. No gastar llamadas para documentar.


## Cierre de patrones PDF en backend — 2026-10-11

Cinco nuevas regresiones: reparto de ejecutivo con presa/sopa y notas papa salada/sin ensalada por unidad; otro catálogo con base/sopa/notas diferentes; rechazo atómico de suma incompatible; pedido/dirección/barrio en handleIncoming concurrente con una respuesta en PPP/otro menú. Un fallo inicial: nota papa salada perdida (/tmp/ppp-pdf-pending-baseline.log). Se extrae nota por cada parte del reparto, filtra texto ya representado por atributos y conserva nota compartida previa. No autoriza sustituciones comerciales: son solicitudes de cocina.

Seis focalizadas (cinco nuevas+control) aprobadas /tmp/ppp-pdf-distribution-targets.log; TS /tmp/ppp-pdf-distribution-tsc.log aprobado; full65suites/1.824pruebas,210,518s /tmp/ppp-pdf-distribution-full.log. Índice PDF ahora26patrones ejercitados y0 sin ejecución de backend, con verification_pending separado para Meta/percepción/inferencia. No acredita todos los chats del PDF ni todas variaciones. Simulado primero, cero API; quedan15 de40 autorizadas. Main intacta.

Desplegado f35636c1, verificado 2026-10-11 20:48 Bogotá: running/healthy, candidata/activa iguales sha256:9108be6d066641d51e9d539a79a894053891996f840b302e9e0ca1ac42fdd5a9, health OK/DB connected/CLOSED. Evidencia /tmp/ppp-pdf-distribution-deploy-verified.log.


## Revisión de cambios locales y pedidos largos — 2026-10-12

Base eb58f33b. Revisados/preservados cambios locales en catálogo, glosario, clasificación, notas, menús nombrados y numerosas regresiones de ejecutivos. Incluye cinco casos reservados preparados previamente pero no publicados y cinco nuevos pedidos completos largos: PPP tres productos/notas/cocción/dirección/pago con ;, saltos o y; menú ficticio tres productos, seis unidades, base y notas independientes. Baseline de largos cinco fallos, /tmp/ppp-long-orders-baseline.log. Correcciones: separadores explícitos conservan cantidad/texto, no cortan por decimal; cantidades por vocabulario de catálogo; cocción y nota coexisten; no absorber extra en atributos ni fusionar dos menús; límites de palabras de pago aceptan puntuación; seleccionar candidato de bebida válido antes de priorizarlo.

Full intermedio detectó12regresiones (5suites) /tmp/ppp-long-orders-full.log. Corregidas con casos originales intactos; intento full-final durante cambios no acredita aprobación. Debug comparó catálogo HEAD/current con transpile-only por conflicto nominal TS, luego se eliminó fuente temporal y typecheck aprobado. Validación final estable: TypeScript /tmp/ppp-long-orders-tsc-approved.log aprobado;65suites/1.888pruebas,126,04s /tmp/ppp-long-orders-full-approved.log. Focalizadas de pago/largos43 y últimas de marca/largos10 aprobadas. No repetir matrices DB: no hubo cambios de persistencia.

Runner con configuración real y agente habilitado para long-complete-order-three-products aceptó carrito/notas/dirección/pago/respuesta,0solicitudes de OpenAI; exit1 porque exige successfulResponses>0. No es fallo comercial ni inferencia real. /tmp/ppp-long-orders-api.log. Saldo25usadas/15restantes de40, no sumar acceptedConversations de API. Credenciales temporales eliminadas. Meta/persistencia simulados, sin WhatsApps enviados. Índice de reservados actualizado: dos consumidos en desarrollo, una comprobación parcial de foto con carrito sembrado, tres patrones aún reservados. No afirmar recorrido original de foto aprobado ni todos los casos PDF/holdout.

Diferencia entre asistente y bot: interpretar texto y ejecutar una mutación exacta son responsabilidades distintas. Esta tanda mostró fallos en la capa de segmentación/alcance/persistencia del pedido aunque algunos productos se reconocían. No atribuirlos automáticamente a modelo inferior ni prometer comprensión perfecta. Main no recibe la tanda.


## Caso exacto ejecutivo Plazuela — 2026-10-12

Regresión con el texto original del usuario (eejcutivo, enslada, ala pechuga, mondongo, papa salada y dirección). Aprobada: una sola línea de ejecutivo frito, cantidad1, Presa Ala, pechuga, Sopa Mondongo, notas sin ensalada/papa salada y dirección conservada. Prueba focalizada1 aprobada /tmp/ppp-exact-executive-plazuela.log, añadida después del full estable1.888; no afirmar full1.889. Backend simulado, cero llamadas pagadas, sin Meta. Implementación ya incluida en8c61b17c.

Despliegue staging verificado 2026-10-12 11:31 Bogotá: checkout3f2862e, API running/healthy, candidata/activa iguales sha256:b19ad6786cf37dac2a8a3b4435aa62c6c149beafd0de58c963568b1b75ddd2f5, endpoint health ok/DB connected/CLOSED. Evidencia /tmp/ppp-long-orders-deploy-verified.log. Main/producción sin cambios.


## Generalización por catálogo — 2026-10-12

Base55836de3. Quince regresiones nuevas con tres menús ficticios (vegetariano, marino, oriental): componentes incluidos/dirección, adicional explícito, precio sin compra, corrección conservando cantidad/notas, dos líneas posibles piden aclaración sin mutación. Un fallo nuevo "Mejor con Ternera": no era reconocido como cambio de atributo; se acepta marcador general "mejor", con opción validada por catálogo y objetivo inequívoco. No se codifican Ternera/IDs/nombres de fixtures. Focalizadas23 aprobadas, TS aprobado; full65suites/1.904pruebas126,524s /tmp/ppp-catalog-generalization-full.log. Cero API/Meta,25 usadas/15 restantes. Leer siguiente tanda en docs/whatsapp-next-batches.md: los menús nombrados no acreditan generalización universal, falta probar compuestos sin esos tokens y contrato de inclusión/precios/permisos. Main no recibe cambios.

Desplegado staging f9ed5de4, verificado2026-10-12 11:39 Bogotá: API running/healthy, imagen candidata=activa sha256:f1b267688b1480e1eececce5a241176c8aa4446a66abc7535de5e877e079023e, health ok/DB connected/CLOSED. Primer chequeo durante arranque retornó starting/curl56; segundo sano. Evidencia /tmp/ppp-catalog-generalization-deploy-verified.log. Producción intacta.


## Compuestos sin menú nombrado — 2026-10-12

Baseb95853ac. Veintiuna regresiones nuevas en hamburguesa artesanal, pizza campestre y bowl tropical, con opciones de queso/masa/base y SKU independiente que colisiona con la opción. Comprueban componentes incluidos, extra explícito, pedidos completos con tres separadores/dirección/transferencia, corrección seguida de precio sin mutación y aclaración seguida de elección del segundo. Dieciocho casos iniciales aprobados; tres aclaraciones fallaron. Identidades anidadas (producto y producto Premium) seguían ambiguas después de elegir. Se prioriza identidad explícita más larga solo si las otras identidades coincidentes están contenidas en ella; nombres diferentes o iguales siguen ambiguos. Se elimina nota exacta "con <opción>" si el atributo ya la representa, conservando notas mixtas/cantidad/otros platos. Nada de IDs/nombres/precios ficticios en reglas.

Focalizadas44 aprobadas /tmp/ppp-compound-catalog-approved.log; TypeScript aprobado /tmp/ppp-compound-catalog-tsc.log; full65suites/1.925pruebas126,661s /tmp/ppp-compound-catalog-full.log aprobado. Cero OpenAI/Meta/órdenes externas; saldo25usadas/15restantes. No afirmar universalidad, permisos de sustitución ni extras tarifados que el contrato no modele. Siguiente tanda: opciones fuera del catálogo, preguntas condicionales sin compra, precio de cambios, cambios durante checkout y alcance cuando se nombran varios platos explícitamente.

Control adicional antes del cierre: tres casos con ambos nombres explícitos (producto y producto Premium) detectaron compra adicional incorrecta, /tmp/ppp-compound-multiple-identity.log. Prioridad al nombre más específico solo si, después de quitarlo del mensaje, no queda otra identidad explícita. Los24 casos nuevos +23controles pasan (47focalizadas) /tmp/ppp-compound-catalog-final-approved.log. Se repite full/TS por cambio nuevo; el full anterior1.925 no acredita el estado final. El primer deploy2af2dd8b terminó antes del control; preparar nueva versión tras aprobación final.

Full final intermedio detectó2regresiones (64suites/1.926pruebasaprobadas): identidades con prefijo numérico "1 Pollo Frito" no se eliminaban al leer "pollo frito". Corregido quitando prefijos de cantidad de identidad, de forma general.49focalizadas aprobadas /tmp/ppp-compound-catalog-recovery.log; volver a acreditar con full estable y TS. No usar /tmp/ppp-compound-catalog-full-final.log como aprobación.

Aprobación final estable:65suites/1.928pruebas126,195s /tmp/ppp-compound-catalog-full-stable.log; TypeScript aprobado /tmp/ppp-compound-catalog-tsc-stable.log.24 nuevas en esta tanda. Cero llamadas pagadas, presupuesto intacto.

Despliegue final staging a46e3cb8 verificado2026-10-12 11:54 Bogotá: running/healthy, activa=candidata sha256:5ddcff93a43832a4c7e0b44ded8c3ab6c0130cf1edaeacb4858155dcbd904b2e; health ok/DB connected/CLOSED. /tmp/ppp-compound-catalog-deploy-verified.log. Main/producción intactas; sin cambios de modelo/presupuesto.


## Puerta previa al piloto — consultas opciones y cierre (2026-10-12)

Base251c1182.30casos nuevos en hamburguesa/pizza/bowl: preguntas de posibilidad, precio de cambio, opción inexistente con opciones válidas en respuesta, cantidades1–3 con dirección numérica, consulta condicional en confirmación, cambio de opción/dirección/cantidad durante cierre. Baseline18casos tuvo9fallos: consultas modificaban atributos; quantity source incorporaba dirección y terminabaqty10. Corrección: preguntas de posibilidad y recargo se responden antes de mutaciones; cantidades de add se calculan sobre productText sin dirección/pago. Ampliación exigió opciones útiles ante inexistente y detectó3respuestas genéricas incorrectas: se muestran opciones del atributo nombrado, sin mutar pedido. No se añaden excepciones por nombre/ID.

Focalizadas76 aprobadas /tmp/ppp-pilot-gate-approved.log. Full65suites/1.958pruebas125,785s aprobado /tmp/ppp-pilot-gate-full.log; TypeScript aprobado /tmp/ppp-pilot-gate-tsc.log. Meta/modelo/persistencia aislados; cero solicitudes pagadas;25usadas/15restantes. Contrato actual de atributos no representa recargos ni permisos de sustitución: esta tanda cubre abstención/derivación, no cobro de extras ni confirma gratuidad. Pregunta pura "se puede con X" deja pedido igual; solicitud explícita de cambio sigue actualizando. No crear una oferta de confirmación "sí" si el flujo no guarda esa oferta; se pide indicar plato/opción para aplicar.

Despliegue staging50556d2d verificado2026-10-12 12:09 Bogotá: running/healthy, activa=candidata sha256:9c81496578d13de04a2dd9ecd606aeef145101f7ad95c684b7a46db273f71857; health ok/DB connected/CLOSED. Evidencia /tmp/ppp-pilot-gate-deploy-verified.log. Main intacta. Próximo paso: inferencia real/canal con límite efectivo; no reiniciar saldo15.


## Nueva evidencia crítica — chat Banderas12/10

Leer docs/WHATSAPP-BANDERAS-DIAGNOSIS.md. Cinco escenarios de diagnóstico fallaron en staging actual: cortesía separada como producto, consulta de medio pollo crea compra pendiente, reclamo de precio duplica cuarto, corrección capturada como nombre, referencia de dirección no se actualiza. Segundo diagnóstico comprueba carrito inicialid6qty1 y usa fixture15.000 (no confirma precio productivo). /tmp/ppp-banderas-diagnosis-correct-seed.log. Suite temporal eliminada; no se cambió código ni se ejecutó full, Meta o API. Saldo15 intacto. Reabrir puerta previa al piloto: estas fallas no están resueltas por las1.958pruebas anteriores. Siguiente tanda: regresiones con recorrido completo y catálogos sintéticos, luego fixes generales/full/TS.


## Chat de Main y caminos encadenados — 12/10

El usuario confirmó origen Main del transcript Banderas. Se prueban sus patrones en staging, no se afirma paridad entre entornos.31regresiones (PPP/bowl/pizza y conversación completa). Ver docs/WHATSAPP-BANDERAS-DIAGNOSIS.md. Baseline22fallos/28; focalizadas finales31 aprobadas. La secuencia completa detectó oferta vieja aceptada como compra tras comparar barato, fragmento de preparación que agregaba pollo entero y referencia que no cambiaba tras salir de la aclaración. Correcciones por catálogo/intención/estado. No fijar precios13/16ni ubicación privada. Full/TS pendientes al escribir; log /tmp/ppp-banderas-full.log. Cero llamadas pagadas, saldo15. Staging únicamente; mantener Main intacta.

Control del full intermedio:3 regresiones en consulta condicional de recargo (65suites,1.986aprobadas/3fallidas); se separó precio de modificación de precio/disputa del producto.61focalizadas finales pasan /tmp/ppp-banderas-targets-final.log. No cambiar expectativas para ocultar errores; /tmp/ppp-banderas-full.log no es aprobación final. Full estable en ejecución /tmp/ppp-banderas-full-approved.log.


## Integración local, voz y pedidos grandes — 12/10

Baseac27ae4e, staging publicado anterior50556d2d. Se preservó una tanda local amplia de catálogo, jugos, tamaños, reparto por unidad, notas/negaciones y corpus PDF, que aún no estaba confirmada en Git. El full histórico1.989 no acreditaba esos cambios posteriores. Se auditaron y corrigieron riesgos: aviso de cobertura ahora por waId con consumo/limpieza; confirmación de acompañamiento valida firma del carrito, precio/disponibilidad actuales, conserva notas y utiliza tryAddProductToCart/límites/atributos (si faltan no muta). Evita ignorar una porción existente y agrega una nueva unidad confirmada.

Nueva evidencia del usuario: chat Main solo guardó gaseosa1.5L/Pepsi y dirección al pedir combo alitas. No hay audio original; no atribuir el fallo a transcriptor vs parser sin datos. Se añadieron seis recorridos texto/audio simulado de alitas, dos de aislamiento, cuatro de acompañamiento, seis de pedido grande con cinco platos/quince unidades/tres separadores/cambio posterior, un recorrido descarga-transcripción-pedido y dos de presentación por catálogo. API de audio añade cinco pruebas de vocabulario/modelo/tamaño. Baselines detectaron pérdida de notas, confirmaciones viejas, extra inválido/ignorado, bebida incluida cobrada aparte y ají perdido en pedido grande. Focalizadas28aprobadas /tmp/ppp-audio-round-targets.log y recorridovoz aprobado; caso doble presentación muestra lista (no compra), se valida esa lista y ambos nombres en vez de exigir redacción específica.

Se eliminó nueva equivalencia global arroz chino con pollo→medio: selección solo si la carta deja un compuesto único; con varias presentaciones requiere elección. Audio conserva whisper-1 por defecto. WHATSAPP_AUDIO_MODEL permite candidato explícito, sin fallback/reintento silencioso. Prompt de ortografía desde nombres/opciones del catálogo, prioridad plato en foco, máximo200bytesUTF8; no precios, teléfono, historial ni cantidades predeterminadas. RespuestaJSON y límite25MB. Modelos/API reales no ejecutados, saldo25usadas/15restantes. Fuente oficial: https://developers.openai.com/api/docs/guides/speech-to-text (prompts limitados224tokens de Whisper y evaluación contra originales). No afirmar calidad acústica aprobada. Full/TS en ejecución /tmp/ppp-staging-audio-bulk-full.log y /tmp/ppp-staging-audio-bulk-tsc.log. Snapshot de fuentes /tmp/ppp-audio-validation-source.json; comprobar que no cambiaron durante el full antes de acreditar.

Recuperación del full inicial (7suites/57fallos;2.057aprobadas): mayoría de fallos eran harness Object.create sin inicializar nuevo Map de cobertura; se inicializó en cuatro fixtures, sin cambiar expectativas ni código productivo para ocultar fallos. Fallos comerciales: preparación elegida automáticamente; adición de1unidad ignorada por sourceText vacío considerado restatement; entero eliminado por comparación con medio; alternativas de bebida demasiado filtradas. Se exigen elecciones de preparación, sourceText no vacío para restatement, porciones distintas no se absorben y alternativas ordenadas conservan otros tamaños.173focalizadas aprobadas /tmp/ppp-audio-round-regression-recovery.log. Full estable final/TS en ejecución /tmp/ppp-staging-audio-bulk-full-final.log y /tmp/ppp-staging-audio-bulk-tsc-final.log; snapshot renovado, no modificar fuente durante validación.


### Seguimiento de validación — resumen de audio alitas (12/10)
El usuario confirmó que el resumen de Main conservó únicamente Gaseosa 1.5L/Pepsi y dirección Pío 12. No aportó audio ni transcripción de proveedor: no atribuir todavía el fallo a Whisper o al router. Casos reconstruidos prueban principal + bebida incluida, bebida de distinto tamaño, dirección y mensaje largo; los mocks no acreditan reconocimiento acústico.
Segundo full de esta tanda: 61/65 suites y 2106/2120 pruebas aprobadas; 14 fallos. Evidencia /tmp/ppp-staging-audio-bulk-full-final.log. No desplegar ni declarar aprobación. Se retiró la regla demasiado amplia de atributos obligatorios (preparación/selección/etc.), se conserva la elección de Pollo pendiente cuando el resolvedor no la completa y se pasa texto de aclaración al alta desde lista para evitar duplicados. TypeScript de esta revisión aprobado (/tmp/ppp-round-tsc4.log); suite focalizada en ejecución /tmp/ppp-round-recovery4.log. Los archivos locales siguen sin commit. Main y despliegue intactos; cero llamadas pagadas en esta ronda.


### San Esteban: evidencia específica del usuario (12/10 18:29)
El usuario reporta solo aviso fuera de cobertura para sopa de menudencias + Plazuelas de San Esteban. Se reejecutó la regresión exacta existente con routing simulado: 3/3 aprobadas (agente activado/desactivado y otro catálogo), /tmp/ppp-san-esteban-coverage-check.log. En código local la sopa queda qty1, dirección conservada, una respuesta confirma el plato y comunica cobertura, no abre pago. Esto NO verifica los 6.7km reales ni está acreditado desplegado. Geocodificador acepta primer resultado cercano sin contrastar nombre del conjunto contra consulta; investigar ubicación elegida antes de afirmar que está fuera de cobertura. No cambiar tarifas/radio por este ejemplo ni hardcodear San Esteban.
Revisión posterior de preparaciones: 20 focalizadas aprobadas /tmp/ppp-round-recovery5.log; TypeScript aprobado /tmp/ppp-round-tsc5.log. Full final en ejecución /tmp/ppp-round-full5.log (sesión58649). No atribuir aprobación completa hasta terminar; no editar código durante el run. Sin commit/deploy todavía.


### Corrección de alcance: San Esteban sí tiene cobertura
El usuario confirmó que la dirección sí está cubierta. El fallo es geocodificación, no radio comercial. Se añadió validación general de nombres de destinos (conjunto/hotel/etc.) contra el resultado y se distinguen coincidencias ambiguas de fuera de cobertura. Ante ambigüedad se bloquea cotización/checkout, conserva carrito y pide ubicación/calle-número; no se aplica tarifa fija como si estuviera ubicado. Sin IDs ni coordenadas de San Esteban codificados. 49 controles aprobados /tmp/ppp-landmark-combined.log, incluidos 5 de routing y conservación de sopa, y controles de aclaraciones. TypeScript final aprobado /tmp/ppp-landmark-tsc-final.log. Full completo en ejecución /tmp/ppp-landmark-full-final.log sesión56984. No desplegado ni publicado. Dirección exacta solicitada para verificar punto real. Cero llamadas externas/API en esta tanda.

Verificación real de Maps, lectura sin cambios de entorno: usuario aporta «cr 78 b 6 b 20». Origen efectivo de staging leído de ppp_whatsapp_settings:4.6323019,-74.1471957, máx5.50km. Geocode actual del nombre devuelve Plazuelas de San Esteban 4.6334187,-74.1444932 con partial_match=true; ruta driving1.952km. Geocode de Carrera78B#6B-20 devuelve Cra.78B#6 4.6256079,-74.1474138; ruta1.874km (fin Cra.78B#6-16). Ambos dentro de cobertura; no confirmar exactitud de numeración pues Maps normalizó distinto. No se reconstruyó el destino usado a las18:29 ni se consultó origen efectivo de Main: no afirmar causa específica del6.7km más allá de evidencia de mala ubicación/config posible. Se hicieron4 consultas Maps (2geocode/2routes), cero llamadas de modelo; presupuesto modelos25/40 intacto. No se guardaron claves ni cambiaron configuraciones.

Validación estable final12/10:66suites/2120pruebas aprobadas en378.783s /tmp/ppp-landmark-full-final.log; TypeScript aprobado /tmp/ppp-landmark-tsc-final.log. Incluye las mejoras locales previas preservadas, tandas de pedidos largos/audio, Banderas y geocodificación incierta. Cero solicitudes de modelo;4consultas Maps de diagnóstico. No atribuir mejora acústica medida sin audios originales.

Desplegado y verificado staging59064dc3 el12/10/2026 21:16 Bogotá:running/healthy, imagen activa=candidata sha256:bd2640ddfc5baa85eca5b81953d5c97ee26ceef31cc0dc026770bb122437366a; healthok,DBconnected,circuitCLOSED. /tmp/ppp-landmark-deploy-verified.log. Main/producción no modificadas. Próximo: repro real de conversación con ubicación dudosa, corrección a calle/número o pin y mantenimiento del carrito; evaluar audio original antes de medir calidad acústica.


## Continuidad de platos en varios mensajes — verificación 12/10
Base29421277; runtime desplegado59064dc3. Chat exacto ejecutivo→mondongo/frito/pierna-pernil/papa-salada→limonada aprobado con mensajes separados y agrupados. Resultado: una línea Ejecutivo Con Pollo Frito qty1, Sopa Mondongo, Presa Pierna Pernil, Bebida Limonada, nota papa salada. No pollo entero ni bebida independiente. Otros controles cubren dos menús, adicionales explícitos, consultas/correcciones y pausas5/60segundos.
Ocho pruebas nuevas: PPP y menú vegetariano ficticio × pausas0/900/4000/60000ms antes de opciones, luego reenvío tardío de ID ya procesado. Verifican carrito, atributos, notas y ausencia de nueva salida ante replay. Primer intento falló8/8 solo en replay porque el harness genérico siempre reclamaba IDs; la fixture local ahora reproduce el contrato UNIQUE de persistencia (no se alteró runtime ni se relajaron expectativas). Esto no acredita entrega real de Meta ni persistencia de varias instancias.
Focalizadas35/35 aprobadas (8nuevas,27existentes), /tmp/ppp-executive-bursts-approved.log; cero llamadas externas ni pagadas. Full anterior66suites/2120 sigue siendo evidencia del runtime, no contar los8nuevos como full ejecutado. Solo tests/docs modificados: no se requiere reconstrucción del servidor.

Siguientes tandas, con criterios de aceptación:
- Corrección antes de completar: «dos ejecutivos»→«fritos con mondongo»→«mejor uno broaster»→bebidas. Dos unidades totales; atributos asociados por línea; preguntar si el reparto no es inequívoco.
- Incluido frente a adicional: «la limonada del menú» frente a «otra limonada aparte» y «dos limonadas para los dos menús». Cantidad correcta sin convertir atributos en compras adicionales.
- Cancelación y cambio de intención: «olvida ese ejecutivo»→otro plato; «solo quería saber qué trae». Cancelar únicamente la compra pendiente; una consulta nunca añade productos.
- Contexto con interrupciones: precio/horario entre presa y bebida, cambio de dirección durante elección. Responder la consulta sin perder cantidad/opciones pendientes ni capturar respuestas como nombre/dirección.
- Referencias ambiguas con varias líneas: «el otro sin ensalada», «los dos con esa sopa», «ese no». Resolver cuando el antecedente es único; de otro modo aclarar sin modificar carrito.
- Ráfagas mixtas: audio→texto corrigiendo transcripción→dirección, o foto→«son dos»→nota. Preservar plato principal y modificaciones; separar calidad acústica/visual de interpretación del texto.
- Repetición de texto con distinto ID: distinguir recordatorio de «otro igual»; deduplicación de webhook no equivale a suprimir nuevas compras legítimas.
Cada tanda se ejecutará con catálogos PPP y sintéticos, comparando carrito/estado/respuesta tras cada mensaje. Inferencia real solo focalizada sobre fallos sin explicar, con saldo15 y registro de cada intento.


## Tanda de básicos y extras — 12/10, basef1a4498e
16pruebas nuevas: ocho recorridos de menú completado (PPP y vegetariano ficticio: precio sin mutación, bebida adicional independiente, cantidad del menú sin alterar extra, reinicio de carrito/pendientes) y ocho plurales con variantes gramaticales y agente simulado activo/inactivo. Baseline4fallos detectó «dos almuerzos ejecutivos» convertido en broaster/ajiaco por falta de normalización plural. Ampliación detectó2fallos adicionales con «Porfa dos…», que compraba preparación por defecto. Corrección general de frase plural y cortesía inicial en glosario; no IDs ni precios codificados. Los16casos nuevos y16controles existentes pasan:32/32 /tmp/ppp-meal-basics-extra-final.log. Full yTypeScript en ejecución /tmp/ppp-basic-extras-full.log y/tmp/ppp-basic-extras-tsc.log. Cero llamadas pagadas/Meta/Maps; saldo modelos15 intacto. No publicar hasta full aprobado.

Plan por riesgo para las próximas rondas (las familias existentes no equivalen a todas las variantes):
1. Repartos:3menús,2con una sopa y1con otra;2presas diferentes; bebida común; corregir solo uno. Verificar suma de cantidades y atributos por unidad, no únicamente número de líneas.
2. Extras/reemplazos:incluido,adicional,sin bebida,cambiar por producto de otro precio,extra agotado y rechazo del recargo. Sin precio/permisos confirmados se deriva o aclara; no inventar sustitución gratuita.
3. Negación/desistimiento:«ese no»,«solo preguntaba»,cancelar antes/después de aclaración,reiniciar y después «lo mismo». No recuperar una compra cancelada del historial ni crear pedido confirmado.
4. Interrupciones básicas:precio,qué incluye,horarios,disponibilidad; luego retomar atributo pendiente. Consulta no muta carrito y no se captura como nombre/dirección/pago.
5. Correcciones en cierre:cantidad/producto/nota/dirección durante selección de pago; pregunta de precio no añade;«no» no obliga a un bucle de pago. Preservar correcciones y volver a presentar total válido.
6. Entrada mixta:nota antes del producto,mensaje largo,ráfaga con pausas,typos,emoji,códigos con direcciones numéricas,voz→corrección por texto,foto→cantidad. Calidad de reconocimiento exige originales; transcripciones simuladas prueban interpretación.
7. Robustez semántica:producto inexistente,opción inexistente,varias referencias posibles,promesas de rendimiento/abono sin información,catálogo vacío/cambio de disponibilidad. Aclaración útil y sin productos/precios inventados.
8. Generalización:repetir casos principales con menús sin pollo/ejecutivo,catálogos cambiados e IDs diferentes. Portar fixtures/contratos para Kamppo; aislamiento multitenant requiere verificación propia.
Puerta de piloto:ningún defecto crítico conocido del alcance, prueba focalizada con modelo/canal real, atención humana comprobada y catálogo vigente. No perseguir infinitas variantes gratuitas como sustituto de medir conversaciones reales. Mantener límite de15solicitudes restantes, seleccionar recorridos representativos y detener ante fallo para diagnosticar gratis.

Full inicial de básicos/extras:65/66suites y2143/2144pruebas; una regresión en menú ficticio «Por favor me condes…» /tmp/ppp-basic-extras-full.log. Se acotó retirada de cortesía a frases que empiezan directamente por cantidad; no quitarla indiscriminadamente antes de verbos.34focalizadas aprobadas (16nuevas,18controles) /tmp/ppp-basic-extras-controls-final.log. Full final/TypeScript en ejecución /tmp/ppp-basic-extras-full-final.log /tmp/ppp-basic-extras-tsc-final.log. Mantener código sin editar durante run.

Aprobación estable final:66suites/2144pruebas en172.88s /tmp/ppp-basic-extras-full-final.log; TypeScript aprobado /tmp/ppp-basic-extras-tsc-final.log.16casos nuevos de básicos/plurales; también acredita8nuevos de ráfagas de la tanda anterior. Cero API/Meta/Maps, presupuesto modelos25/40 intacto. Publicar únicamente staging.

Despliegue de esta tanda verificado12/10/2026 21:39 Bogotá:staging1433958e running/healthy; imagen activa=candidata sha256:8a6a10ebb57ec00d87e85999c9af6e93cf2ebe926db7f794fc8ac0166ecbc7e1; healthok,DBconnected,circuitCLOSED. /tmp/ppp-basic-extras-deploy-verified.log. Main intacta. Siguiente bloque prioritario:reparto de opciones por unidad y cancelación/consulta durante aclaraciones; luego inferencia real focalizada sin reiniciar saldo15.


## Ampliación de cortesía y abandono + interrupciones — 12/10, basefaebdb9e
44casos nuevos:36de cortesía/chat equivocado (16recorridos de abandono PPP+otra carta,12saludos con compra inexistente en ambas cartas,8negativos de corrección/consulta/dirección);8de precio/composición/horario y cancelación antes de compra nueva PPP+menú oriental ficticio. Primer baseline20/43fallaron:6formas de abandono por carta,2saludos por carta y4falsos positivos de «pensé que era…»/destino Otro Chat. Corrección: señales explícitas de destinatario equivocado; «pensé/creí» solo no implica chat equivocado;normalización de cortesía con verbo y typo de saludo.43focalizadas aprobaron.
Segunda tanda baseline6fallos:2reales pérdida de pendingMatch tras composición/horario,4por fixture vegetariano que ya completaba atributos por defecto (no era selección pendiente). Se reemplazó la fixture por menú oriental con elección real Pollo/Horno/Plancha, manteniendo el oráculo. Se responde composición antes de abandonar selección y se reconoce consulta «a qué hora cierran/abren/atienden».51/51focalizadas aprobadas /tmp/ppp-courtesy-interruptions-recovery.log. Full/TS en ejecución /tmp/ppp-courtesy-interruptions-full.log /tmp/ppp-courtesy-interruptions-tsc.log; no mutar código durante run.
Se agregan3recorridos versionados para runner aislado con modelo real:compra tras chat equivocado,ejecutivo con consulta de composición y reclamo de precio tipo«pensaba que era más barato». No ejecutados todavía; evitar atribuirles aprobación por definición. Presupuesto antes de esta ronda25usadas/15restantes.


## Revisión de nuevos cambios locales — 13/10
Basefaebdb9e. Además de la familia de cortesía/interrupciones, aparecieron cambios locales no publicados en catálogo, orquestador, variantes distribuidas y pruebas:recogida de tercero,cierre/precio/combos,referencias y fotos,recargo histórico,reparto de bebidas,paraNpersonas,textura del plato,corrección de precio/horario/pago,corrección de una línea,preguntas de servicio,citas del bot,básicos de cartas diferentes y seguimiento después de registrar. Se preservaron y revisaron sin atribuirlos todos a esta tanda.
Full conjunto inicial:65/66suites,2327/2328pruebas; único fallo recogida dejaba building_cart donde el flujo previo avanzaba a pago. /tmp/ppp-new-local-combined-full.log. Corrección de integración:opción de recogida reanuda checkout sin crear orden, conserva selecciones auténticamente pendientes y distingue una lista retenida después de alta exitosa (pendingMatch.selectionAdded, JSON sin migraciónSQL). Link activo no cambia entrega ni reemite pago; MP elegido sin link exige confirmación.3regresiones nuevas de límites transaccionales.121focalizadas aprobadas /tmp/ppp-pickup-integration-approved.log.
Ampliación previa de cortesía:corrección genérica respeta saltos de línea; agregó2negativos de corrección de teléfono. Interrupciones pasan con agente simulado activo/inactivo; opciones del catálogo que progresan una selección única se procesan antes de delegar una oración al modelo. No generalizar a mensajes multidish o direcciones.
Full/TS final en ejecución /tmp/ppp-new-local-combined-full-final.log /tmp/ppp-new-local-combined-tsc-final.log. Hashes /tmp/ppp-new-local-combined-snapshot-final.json; verificar que no cambiaron antes de acreditar. Rehearsal real limitado a6solicitudes, stop-on-failure, configuración privada de staging en memoria; Meta/persistencia/órdenes aisladas. Registroautoridad docs/whatsapp-model-budget.json; no usar saldo15histórico después de ejecutar. No desplegar antes de resultados finales.


Aprobación completa estable13/10:66suites/2331pruebas en433.264s /tmp/ppp-new-local-combined-full-final.log; fuentes sin cambios frente a snapshot final. Tras corregir únicamente propuesta vacía,64focalizadas aprobadas /tmp/ppp-unknown-proposal-targets-final.log y nuevo full66suites/2335pruebas en419.217s /tmp/ppp-current-stage-all-final.log; TypeScript aprobado /tmp/ppp-current-stage-tsc-final.log. Comparado con última versión publicada2144,191pruebas adicionales integradas; incluye cambios locales ajenos preservados y las tandas de esta sesión.
Verificación modelo real gpt-4.1-2025-04-14:4recorridos únicos aceptados (2con inferencia,2deterministas),10solicitudes API exitosas en total. Primera ronda max6 dejó una conversación incompleta por presupuesto aunque carrito/respuesta eran correctos; repetición focalizada max4 la completó, sin repetir recorrido ya aceptado. /tmp/ppp-courtesy-real-capped-report.json y/tmp/ppp-courtesy-model-completion-report.json. Meta/persistencia/órdenes aisladas. Prueba de modelo precede al ajuste de texto de propuesta vacía; no repetir llamadas por cambio de presentación.35usadas/5restantes, registro docs/whatsapp-model-budget.json yAGENTS actualizados; credenciales solo en memoria, scripts privados temporales eliminados.
Propuesta sin coincidencias ya no afirma varios platos ni pide confirmar «el resto» vacío; conserva confirmación útil cuando sí hay parte reconocida y conserva carrito preexistente.


## Continuación 13/10: desistimiento seguido de nueva intención

Base publicada y desplegada: 4eb1d109. Verificación 13/10 06:59 Bogotá: running/healthy, imagen activa=candidata sha256:8215f7ec73ca70d862f226fa4749ed1ea3d4065dd18b5e89b2c46575b74dda9d, health OK/DB connected/circuit CLOSED. Logs /tmp/ppp-conversation-integration-deploy.log y /tmp/ppp-conversation-integration-deploy-verified.log.

Nueva tanda local: 80 casos en PPP y carta ficticia. Mensaje único, ráfaga de dos y tres mensajes, con/sin carrito previo, cortesía y desistimiento seguidos de compra o consulta. Baseline inicial 24/24 fallaron: la disculpa descartaba también la compra nueva. Separación general por intención explícita y limpieza de pendientes abandonados conservando carrito válido. La ampliación detectó cuatro consultas de composición mal interpretadas y 36 precondiciones incorrectas del test: el modo agente simulado no genera la propuesta pendiente de productos ajenos; no atribuir esas 36 a inferencia real. Se mantiene el control de propuesta pendiente donde el router determinista realmente lo genera.

No se usaron llamadas pagadas; saldo compartido permanece 35/40 usadas, 5 restantes. Main intacta. Cambios de esta nueva tanda todavía requieren aprobación completa y despliegue; no confundir con la base 4eb1d109 desplegada.

Focalizadas: 76/80 aprobadas después de corregir la precondición; las cuatro restantes eran composición con “qué” acentuado (límite de palabra incorrecto). Corrección final: 8/8 consultas aprobadas, /tmp/ppp-apology-questions-final.log. Suite completa en curso: /tmp/ppp-apology-all-final.log. No editar fuentes mientras corre. La compra en modo agente se prueba con inferencia simulada; no acredita percepción real.

Aprobación final en dos ejecuciones: WhatsApp 47 suites / 2.317 pruebas (/tmp/ppp-apology-all-final.log) y las restantes 19 suites / 98 pruebas (/tmp/ppp-apology-remaining-final.log). Total 66 suites / 2.415 pruebas, todas aprobadas. TypeScript aprobado /tmp/ppp-apology-tsc-final.log. Fuentes verificadas sin cambios durante la suite contra /tmp/ppp-apology-source-snapshot.json. 80 regresiones nuevas frente a 4eb1d109. No se acreditan nuevas llamadas reales ni recepción desde teléfono.

Publicado y desplegado el código 6d19d88f, verificado 13/10/2026 08:49 Bogotá: running/healthy, imagen activa=candidata sha256:cc3d2a261f44bf7fb69a32a58d234ecc4a3bc7b498193d689cdfaa4678eb34e4, health OK/DB connected/circuit CLOSED. Logs /tmp/ppp-apology-deploy.log y /tmp/ppp-apology-deploy-verified.log. Main intacta. Próxima tanda: cambios de intención sin disculpa (“olvida lo anterior”, “mejor solo…”), consulta seguida de compra y corrección de pedido grande; reservar casos distintos para evaluación. No gastar saldo por rutina.


## Tanda 13/10: rechazo de propuesta seguido de compra y pedidos grandes

Base 3fc14067 (documental; código activo 6d19d88f). 24 casos nuevos reproducen que “Olvida lo anterior, mejor quiero…”, “Eso no, dame…” y “Déjalo, ahora quiero…” descartaban también la compra nueva. PPP y carta ficticia, mensaje único/ráfaga, carrito vacío o válido previo acreditado por aserción. Baseline 24/24 fallaron (/tmp/ppp-intent-switch-baseline.log); corrección 24/24 aprobados (/tmp/ppp-intent-switch-recovery.log).

La transición se limita a propuestas aún no aplicadas (pendingMultiOrder o pendingMatch sin selectionAdded). Conserva carrito y deja correcciones de productos ya añadidos en sus handlers existentes. No significa “vaciar todo el carrito” ni cambia el caso de atributos pendientes. No excepciones por SKU/nombre/precio de PPP.

Otros 12 casos: 8 platos principales y 6 sopas, coma/conjunción/salto de línea, agente simulado activo/inactivo, PPP y tacos/sopa ficticios. Productos+dirección saltan a cierre, cambio de dirección conserva 14 unidades y notas. Todos aprobados antes de modificar su ruta: /tmp/ppp-large-switch-baseline.log. Estas pruebas son modelos/Meta/persistencia simulados, no WhatsApp real. TypeScript aprobado /tmp/ppp-intent-switch-tsc.log. Cero nuevas llamadas pagadas; saldo 35/40 usado, 5 restantes.

Suite completa en curso: /tmp/ppp-intent-switch-all-final.log. Snapshot /tmp/ppp-intent-switch-source-snapshot.json; verificar al finalizar. No promover Main ni acreditar despliegue hasta terminar validación.

Resultado final: 66 suites / 2.451 pruebas aprobadas en una única ejecución completa, /tmp/ppp-intent-switch-all-final.log. TypeScript aprobado. Fuentes sin cambios durante validación contra snapshot. 36 regresiones nuevas. Saldo sin cambios. Main intacta.

Código 18887d8b publicado y desplegado, verificado 13/10/2026 09:08 Bogotá. Running/healthy; imagen activa=candidata sha256:93a31c11d859b7c6fb73d0b98989649b3d35eb21d3714bee78d87ce0c3b4ab92; health OK, DB connected, circuit CLOSED. Evidencia /tmp/ppp-intent-switch-deploy.log y /tmp/ppp-intent-switch-deploy-verified.log. Próxima tanda: selección ambigua rechazada seguida de otro plato, cantidad/nota por subconjunto en pedido grande y controles de consulta frente a compra. Pendientes de piloto reales permanecen; no acreditados por estos mocks.


## Tanda 13/10: ediciones focales de un pedido grande

Base 0e42a7e5, código activo 18887d8b. 20 pruebas nuevas con PPP y carta ficticia, pedido inicial de tres líneas/18 unidades verificado, agente simulado activo e inactivo al editar. Cantidad absoluta de un producto, exclusión directa nombrando plato, cambio de atributo nombrando plato en plural y subconjuntos sin producto que deben pedir aclaración. Se acredita conservación exacta de otras líneas y ausencia de líneas añadidas; no solo cantidades del primer match.

Baseline 6/20 fallaron (/tmp/ppp-bulk-scoped-baseline.log): cuatro no guardaban nota declarativa; dos agregaban un wrap con opción nueva en vez de editar los seis existentes. Corrección general: notas directas “los platos sin…” con artículo y exclusión, límites existentes de preguntas/compuestos intactos; reconocimiento contiguo del nombre con plurales s/es y consumo de esa identidad al resolver cambios de atributo. Sin excepciones por SKU/PPP. 20/20 aprobadas (/tmp/ppp-bulk-scoped-final-new.log). Diagnóstico intermedio de controles: 285 aprobadas, dos errores todavía abiertos antes de la corrección final (/tmp/ppp-bulk-scoped-final-targets.log); no acreditarlo como aprobación final.

Suite completa final en curso /tmp/ppp-bulk-scoped-all-final.log. Snapshot /tmp/ppp-bulk-scoped-source-snapshot.json. TypeScript final /tmp/ppp-bulk-scoped-tsc-final.log. No editar fuentes hasta terminar. Ninguna llamada real nueva: 35/40 usadas, 5 restantes. Main intacta. No equivale a transcripción real ni canal WhatsApp real.

Aprobación final: 66 suites / 2.471 pruebas aprobadas en una ejecución completa (/tmp/ppp-bulk-scoped-all-final.log); TypeScript aprobado (/tmp/ppp-bulk-scoped-tsc-final.log). Snapshot sin cambios durante el run. 20 nuevas regresiones, cero llamadas pagadas. Próxima tanda: exclusión por unidades nombrando producto (“dos de los ocho… y los demás normales”), repetición del cambio y conservación de notas previas. No acreditar división explícita de unidades con esta tanda: aquí el subconjunto sin plato pide aclaración y la edición focal afecta toda la línea nombrada.

Código 90c57dec publicado/desplegado en staging, verificado 13/10/2026 09:30 Bogotá: running/healthy, imagen activa=candidata sha256:83d7accad5798d56b8524d5d846edfa0118a131182526b6d66b13ae53ad6ec4c; health OK, DB connected, circuit CLOSED. Evidencia /tmp/ppp-bulk-scoped-deploy.log y /tmp/ppp-bulk-scoped-deploy-verified.log. La actualización documental posterior no requiere reconstrucción. Main intacta y presupuesto sin cambios.


## Tanda 13/10: subconjuntos en ocho menús distintos

Base a68a0caa, código activo90c57dec. 64 regresiones nuevas:40positivas/repetición en cocina japonesa (nigiri), italiana(pizza), árabe(shawarma), india(curry) y marina(ceviche), atributos Salsa/Masa/Pan/Picante/Acompañamiento y nombres cercanos del mismo menú. Dos formas: “dos de los ocho [plato] sin X y los demás normales” / “de los ocho [plato], dos sin X y los otros seis normales”. Agente simulado activo/inactivo; con/sin nota ya almacenada. Verificar total8, distribución2+6, atributos y demás platos; repetir no vuelve a dividir ni añade unidades, actualmente aclara si hay varias líneas del mismo producto.24negativas adicionales en cocina francesa(crepe), tailandesa(padthai) y peruana(lomo saltado):cantidad superior,total distinto,resto inconsistente,producto inexistente; debe conservar carrito y aclarar.

Baseline original40fallos /tmp/ppp-cuisines-subset-baseline.log:20fallaron en la división y20en la preparación inicial que mezclaba opción con “bien empacado”. No atribuir los40 al algoritmo de subconjunto. Preparación final usa pedido válido verificable; la nota previa se fija como estado almacenado independiente del mensaje de división. Incidencia de compra+opción+empaque queda pendiente para siguiente reproducción; no acreditarla resuelta.

Corrección:parsePartialNote acepta producto/cantidad total explícitos; selecciona una única línea por catálogo/corrección genérica, exige que el total y resto concuerden, conserva otras líneas y añade nota sin borrar la previa. Límite de200caracteres del editor de notas. Sigue limitado a building_cart y sin selección pendiente; no acreditar subconjuntos durante pago final con esta tanda. No nombres/IDs de platos en runtime.72focalizadas aprobadas(64nuevas+8controles), /tmp/ppp-cuisines-subset-final-targets.log.

Full en curso /tmp/ppp-cuisines-subset-all-final.log; snapshot /tmp/ppp-cuisines-subset-source-snapshot.json; TypeScript /tmp/ppp-cuisines-subset-tsc-final.log. No editar fuentes mientras corre. Cero solicitudes nuevas;35/40usadas,5restantes. Main intacta. No acredita transcripción ni WhatsApp real.

Resultado final:66suites/2535pruebas aprobadas en552.405s (/tmp/ppp-cuisines-subset-all-final.log), TypeScript aprobado (/tmp/ppp-cuisines-subset-tsc-final.log), snapshot sin cambios durante validación.64regresiones nuevas,72focalizadas. Próximos casos:reproducir pedido+opción+“bien empacado” en estos menús; atributos por subconjunto y exclusiones durante cierre. No afirmar que pedidos con empaque ya funcionan porque se preserva una nota almacenada.

Código f7432714 publicado/desplegado en staging, verificado13/10/2026 09:46Bogotá:running/healthy, imagenactiva=candidata sha256:967b62c29db8560dc84c8bbd7b06e41fd2945ac08269ba6480f65123b93eb043, healthOK/DBconnected/circuitCLOSED. Logs /tmp/ppp-cuisines-subset-deploy.log y /tmp/ppp-cuisines-subset-deploy-verified.log. Main y modelos sin cambios; presupuesto35/40,5restantes.


## Tanda 13/10: empaque y consulta de cobertura del chat real

Base de488dd2; código desplegado f7432714.96regresiones nuevas.48de empaque/opción (36con notas y12controles) en Moussaka, Schnitzel de cerdo, Bibimbap, Quesadilla de hongos, Pho de ternera y Empanada de carne:8unidades, opción explícita, “bien empacado”, “bien empacados”, “en cajas separadas”, cortesía. Baseline34fallaron/14pasaron (/tmp/ppp-packaging-cuisines-baseline.log); incluía el pho sin empaque. splitKitchenPreference separa instrucciones de empaque acotadas, conserva límites de preguntas/compras extra. Búsqueda y guard de nota standalone reconocen nombre de catálogo+opción positiva como pedido:Pho con fideos de huevo no es nota de acompañamiento. Sin excepciones por nombre/ID; la elección viene del catálogo.48/48aprobadas (/tmp/ppp-packaging-cuisines-approved2.log).

Caso real añadido por Wilmer: “n Donde estan ubicados” seguido de “Me traen Un pedido hasta El tintal?”. Fallo:consulta de cobertura consumida como dirección; no es autorización de entrega/cierre.48casos:doscatálogos ficticios(tamales/risotto), agente simulado activo/inactivo, carrito vacío/pago/confirmación, cuatro formas de consulta (“me traen”, “hacen entregas”, “quiero saber si llegan”, “nos llevan”). Baseline48/48fallaron (/tmp/ppp-coverage-question-baseline.log). Consulta se atiende antes de guardar dirección en estados activos y no modifica sesión/estado; barrio/lugar sin número pide calle y número antes de afirmar cobertura/costo. No se afirma que El Tintal tenga o no cobertura:estos casos no consultan Maps ni acreditan distancia.

108focalizadas aprobadas(96nuevas+12controles), /tmp/ppp-packaging-coverage-targets.log. TypeScript aprobado /tmp/ppp-packaging-coverage-tsc.log. Full en curso /tmp/ppp-packaging-coverage-all-final.log; snapshot /tmp/ppp-packaging-coverage-source-snapshot.json. No editar fuentes mientras corre. Cero llamadas pagadas;35/40usadas,5restantes. Main intacta. Pendientes:opción/empaque en pedido de varias líneas y cobertura con dirección numérica/config de tarifa fija, sin asumir que calcular tarifa acredita cobertura; cobertura tras selección pendiente y después de orden completada requieren casos propios.

Primer full:65/66suites,2630/2631pruebas aprobadas; fallo “Actualiza domicilio a Carrera7…” quedó interceptado como cobertura (/tmp/ppp-packaging-coverage-all-final.log). Corrección:consulta de cobertura descarta cambios explícitos de dirección antes de su matcher. Dos controles puros nuevos distinguen actualización/domicilio declarado de consulta; total98regresiones nuevas.117focalizadas aprobadas,3suites (/tmp/ppp-packaging-coverage-boundaries-final.log). TypeScript final aprobado /tmp/ppp-packaging-coverage-tsc-final.log. Nueva aprobación completa en curso /tmp/ppp-packaging-coverage-all-approved.log, maxWorkers2, fuentes congeladas contra /tmp/ppp-packaging-coverage-source-final.json. No acreditar el primer full como verde ni desplegar antes del resultado final.

Aprobación completa final:66suites/2633pruebas aprobadas (/tmp/ppp-packaging-coverage-all-approved.log), maxWorkers2, snapshot sin cambios; TypeScript aprobado.98nuevas regresiones en total. La primera ejecución con un fallo no se usa como acreditación final. Cero llamadas nuevas, Main intacta.

Código352c2997publicado/desplegado en staging, verificado13/10/2026 10:27Bogotá:running/healthy, imagenactiva=candidata sha256:b80adc6decc07137f4aad623dca424c5c10e60eb81d4d1dce9faae26d40241d6; healthOK/DBconnected/circuitCLOSED. Evidencia /tmp/ppp-packaging-coverage-deploy.log y /tmp/ppp-packaging-coverage-deploy-verified.log. Main intacta y presupuesto sin cambios. La actualización documental posterior no requiere reconstruir API.


## Tanda 13/10: auditoría de básicos cotidianos por paso

Base e157eb5b; código activo352c2997. La petición actual prioriza básicos antes de extremos.84regresiones nuevas en Estofado Irlandes y Baguette de jamón, precios y dirección sintéticos/configurables.60casos de FAQ:atendiendo, cierre, ubicación, posibilidad de recoger y servicio a domicilio; agente simulado activo/inactivo, building_cart/awaiting_payment/awaiting_final_confirm. Se verifica respuesta útil y conservación de carrito,dirección,tipo,pago y paso.

Baseline34/60fallaron,26pasaron (/tmp/ppp-everyday-basics-baseline.log). Tres familias: “Están atendiendo” no reconocida; ubicación ignorada al pedir pago; “Puedo recoger en el local?” cambiaba entrega/dirección sin autorización. Corrección:FAQ de servicio/ubicación antes del checkout, reconocimiento de atendiendo, consulta de posibilidad de recogida responde sin seleccionar método. La frase explícita “paso a recoger” conserva su flujo.

Otros16casos:precio por nombre/referencia(“eso cuánto vale”,“me dices el precio”) sin añadir platos; pregunta de recogida seguida de elección explícita. Todos pasaron (/tmp/ppp-everyday-basics-expanded.log). Cuatro recorridos adicionales reprodujeron consulta+compra juntas perdiendo el pedido (/tmp/ppp-everyday-basics-mixed-baseline.log); se ampliaron a8con agente simulado activo/inactivo. Mensaje con pregunta terminada en ? seguida de verbo de compra explícito se procesa en ambas partes; no acreditar formatos sin separador con esta tanda.

84focalizadas aprobadas (/tmp/ppp-everyday-basics-final-targets.log), TypeScript aprobado (/tmp/ppp-everyday-basics-tsc.log). Full en curso /tmp/ppp-everyday-basics-all-final.log, maxWorkers2; snapshot /tmp/ppp-everyday-basics-source-snapshot.json. No editar fuentes mientras corre. Cero llamadas pagadas,35/40usadas,5restantes. Main intacta. Siguiente auditoría:FAQ cuando negocio cerrado, sí/no/ok sin oferta frente a elección pendiente, disponibilidad/precio antes de comprar, consulta y compra sin signo ? y pasos awaiting_name/phone/address. No afirmar que todo lo básico queda cubierto por estos84.

Primera ejecución completa detenida intencionalmente al reproducir dos regresiones conocidas de ubicación frente a cambio de dirección (/tmp/ppp-everyday-basics-all-final.log; proceso Jest detenido conSIGINT tras verificar PID). No se editó código mientras corría ni se acredita ese run como aprobado. Corrección:FAQ de ubicación no intercepta cambios explícitos ni dirección suelta del cliente.93focalizadas aprobadas(84nuevas+9límites existentes) /tmp/ppp-everyday-basics-boundaries-final.log; TypeScript final /tmp/ppp-everyday-basics-tsc-final.log aprobado. Full final en curso /tmp/ppp-everyday-basics-all-approved.log, snapshot /tmp/ppp-everyday-basics-source-final.json.

Segundo full terminó con65/66suites y2714/2717pruebas aprobadas (/tmp/ppp-everyday-basics-all-approved.log):tres referencias “La dirección en [almacén/boutique]” se consumían como ubicación del local. Corrección:FAQ de ubicación temprana exige pregunta/petición explícita o palabra suelta de ubicación; no basta contener “dirección”.96focalizadas aprobadas(84nuevas+12controles) /tmp/ppp-everyday-basics-boundaries-approved.log; TypeScript final /tmp/ppp-everyday-basics-tsc-approved.log aprobado. Full aceptable en curso /tmp/ppp-everyday-basics-all-accepted.log, snapshot /tmp/ppp-everyday-basics-source-approved.json. No acreditar los runs anteriores fallidos ni editar fuentes hasta cerrar.

Aprobación final:66suites/2749pruebas, todas aprobadas,451.091s (/tmp/ppp-everyday-basics-all-accepted.log), maxWorkers2; TypeScript aprobado (/tmp/ppp-everyday-basics-tsc-approved.log). Fuentes sin cambios contra snapshot final.84regresiones nuevas de básicos y96focalizadas incluyendo referencias y checkout. Las ejecuciones fallidas/detenidas se conservan como diagnóstico, no como aprobación. Presupuesto35/40usadas,5restantes; Main intacta.

Integración adicional detectada al cerrar:32pruebas locales y handlers de resumen/total,pregunta de medios de pago,servicios de local y calle tras consulta de cobertura. Se preservaron y revisaron; estaban incluidos en snapshot final y full2749. No atribuirlos a las84regresiones de esta tanda. Aprobación integrada:116pruebas adicionales frente a2633. Incluir dependencia isReachSavedAddressQuestion de whatsapp-session-intents.ts antes de desplegar; el commit intermedio a836d232 no es fuente completa para deploy por sí solo. Cobertura con tarifa fija no acredita que una ubicación esté dentro de zona:mantener esta limitación del plan y comprobar rutas/configuración en siguiente ronda.

Versión completa06eaf915publicada y desplegada en staging, verificada13/10/2026 12:45Bogotá:running/healthy; imagenactiva=candidata sha256:87d7e0b064fbaf5a29828117c38eca59748c81128cf629b7f4896b601c9626fc; healthOK/DBconnected/circuitCLOSED. /tmp/ppp-everyday-basics-deploy.log y /tmp/ppp-everyday-basics-deploy-verified.log. TypeScript integrado aprobado /tmp/ppp-everyday-integrated-tsc.log; fuentes exactas del full2749. Main no se cambió. Siguiente:negocio cerrado,respuestas cortas,FAQ durante nombre/teléfono/dirección y comprobar cobertura efectiva sin deducirla de tarifa fija.


## Tanda siguiente: datos pendientes, negocio cerrado y respuestas cortas

Base07b3fa01; runtime desplegado06eaf915.68regresiones nuevas, todas pasaron sin cambios de código productivo:36de consultas mientras pide nombre/teléfono/dirección (Jollof de verduras y Pastel de choclo),8de negocio cerrado(Arepa de reina pepiada y Samosa de verduras),16de sí/no/ok/gracias sin oferta pendiente(Gyros y Croissant),8de sí/ok ante lista ambigua(Bao y Crepe). Agente simulado activo/inactivo en datos,cierre y selección ambigua; respuestas sueltas sin oferta se probaron en modo determinista.

Datos:horario/ubicación/efectivo no consumen el campo ni cambian carrito o pago; la entrada válida siguiente actualiza el dato y avanza sin registrar orden. Negocio cerrado:FAQ usa estado efectivo y horario09–18, conserva pedido aun con ignoreBusinessHours del harness. Respuestas sueltas no añaden unidades ni confirman órdenes; lista ambigua mantiene candidatos/cantidad y pide elegir. No acreditar todos los usos de sí/no ni percepción/modelo/canal reales.

Focalizadas68/68aprobadas /tmp/ppp-fields-closed-short-expanded.log. Suite completa afectada en curso /tmp/ppp-fields-closed-short-suite.log; TypeScript /tmp/ppp-fields-closed-short-tsc.log; snapshot /tmp/ppp-fields-closed-short-source-snapshot.json. Solo cambió el spec; no repetir toda la batería ni reconstruir API por rutina si no aparecen fallos o cambios runtime. Preservar archivos dist/tsbuildinfo ajenos. Cero llamadas pagadas;35/40usadas,5restantes. Main intacta. Próximo frente crítico: cobertura numérica/tarifa fija no puede afirmar cobertura por obtener precio; preguntas cortas con teléfono/nombre ambiguos y contexto perdido.

Cierre de la tanda:68 nuevas regresiones aprobadas; suite completa afectada whatsapp-general-accuracy:1484/1484 aprobadas,444.98s (/tmp/ppp-fields-closed-short-suite.log). TypeScript aprobado (/tmp/ppp-fields-closed-short-tsc.log). Fuentes verificadas sin cambios durante la ejecución. Solo pruebas y documentación; no hay cambio de runtime ni reconstrucción/deploy necesarios. Última ejecución global sigue siendo66suites/2749pruebas; no atribuir1484 ni el inventario ampliado a una nueva ejecución global. Cero llamadas pagadas;35/40usadas,5restantes. Main intacta. Próxima prioridad: cobertura geográfica no acreditada por una tarifa fija, seguida de respuestas ambiguas durante captura de datos.

## Interrupciones mientras espera datos o pago — 13/10/2026

Base d8bea3ad. Solicitud del usuario: atender otras intenciones mientras espera una respuesta, sin bucles de la misma pregunta.96casos nuevos del router real con dependencias simuladas, Curry de garbanzos/Empanada de espinaca, agente simulado activo/inactivo.80 consultas (precio,total,tres variantes de recap) en awaiting_name/phone/address/payment conservan carrito/datos/estado y permiten continuar;16correcciones absolutas “Mejor quiero tres…” conservan datos pendientes y permiten completarlos luego. Nunca crean órdenes externas.

Baseline64:32pasaron/32fallaron (/tmp/ppp-checkout-interrupt-baseline.log). Recap no reconocía “Qué tengo en el carrito”; cambio absoluto “Mejor quiero tres” no se resolvía consistentemente. Ampliación de reglas generales del recap y parser de cantidades; corrección conserva captura pendiente de nombre/teléfono/dirección/pago y responde con cantidad corregida más pregunta pendiente. No depende de nombres/IDs del catálogo. Final96focalizadas aprobadas (/tmp/ppp-checkout-interrupt-expanded.log);124casos de primera variante+suite de cantidades aprobados (/tmp/ppp-checkout-interrupt-targets.log). Primera corrección parcial tuvo4fallos de teléfono; se conserva diagnóstico /tmp/ppp-checkout-interrupt-fixed.log.

Verificación global en curso /tmp/ppp-checkout-interrupt-full.log; TypeScript /tmp/ppp-checkout-interrupt-tsc.log; snapshot /tmp/ppp-checkout-interrupt-snapshot.json. No editar fuentes durante full. Cero API pagadas;35/40usadas,5restantes. Main intacta. No afirmar desplegado antes de verificar servicio efectivo. No acredita todos los cambios de atributos/consultas ambiguas ni modelo/canal reales.

Aprobación final de interrupciones:96nuevas; TypeScript aprobado. Batería completa dividida por rutas sin solapamiento:47suites WhatsApp/2815pruebas aprobadas (289.565s, /tmp/ppp-checkout-interrupt-full.log) y19suites restantes/98pruebas aprobadas (7.572s, /tmp/ppp-checkout-interrupt-other-suites.log), total66suites/2913pruebas. No fue una sola ejecución global. Snapshot sin diferencias durante verificación. Main intacta, cero API pagadas. Pendiente verificar despliegue.

Código d39c27a5 publicado y desplegado en staging, verificado13/10/2026 13:15Bogotá:running/healthy, imagen activa=candidata sha256:36b33aca7c8c9ff40f5dce631b04f4069c0ae95ea4d9d7f432410cd9be683cf3; healthOK/DBconnected/circuitCLOSED. Logs /tmp/ppp-checkout-interrupt-deploy.log y /tmp/ppp-checkout-interrupt-deploy-verified.log. Primera comprobación starting con healthOK; segunda healthy. Main intacta. Próximo ampliar interrupciones con opciones pendientes, múltiples líneas, retiro/adición y cambios condicionales; cobertura geográfica sigue pendiente. No reiniciar saldo5.

## Recordatorio tras consulta con opciones y carrito múltiple — 13/10/2026

Base4d2f52ee (runtime d39c27a5).96nuevas regresiones gratuitas:dos catálogos ficticios Kebab/Te y Gofre/Batido, agente simulado activo/inactivo.16consultas mientras elige sabor,16mientras elige producto numerado,64con carrito de dos líneas mientras solicita nombre/teléfono/dirección/pago. Cuatro consultas:total,recap,efectivo y precio de producto nombrado. Verifican respuesta,recordatorio,carrito/opciones conservados y selección/dato posterior correctos. Base72falló por ausencia de recordatorio (/tmp/ppp-pending-reminders-baseline.log),no por72mutaciones del carrito. Primera corrección204focalizadas aprobadas (72+96anteriores+36datos) /tmp/ppp-pending-reminders-targets.log; ampliación96aprobada /tmp/ppp-pending-reminders-expanded.log.

Regla productiva genérica:consultas básicas de total,recap,medios de pago/servicios y precio resuelto muestran respuesta más paso pendiente. Opciones/selección pendientes tienen prioridad sobre checkout. Precio que necesita aclarar qué producto NO agrega pregunta competidora sobre pago/datos. El recordatorio no muta sesión ni selecciona pago. Si no hay platos confirmados,una opción pendiente permanece pendiente; no inventar total. No acredita todas lasFAQ ni consultas ambiguas encadenadas. Próxima prueba importante:consulta de precio ambigua en carrito múltiple y respuesta posterior con nombre/número no debe convertirse en nueva compra. Añadir también rechazo/cambio durante aclaración.

Full en curso /tmp/ppp-pending-reminders-full.log (todas suites,maxWorkers2). TypeScript /tmp/ppp-pending-reminders-tsc.log aprobado. Snapshot /tmp/ppp-pending-reminders-source.json;no editar fuentes durante ejecución. Main intacta,ceroAPI35/40usadas,5restantes.

Verificación previa al chat recibido:66suites/3009pruebas aprobadas,310.99s (/tmp/ppp-pending-reminders-full.log), TypeScript aprobado,snapshotigual. No publicar esa cifra como evidencia del ajuste posterior de combo.

Chat real recibido durante la verificación:cliente pide Arroz Paisa, envía calle, pregunta “Que precio tiene” durante nombre y “Pero ese viene en combo o solo?”. Mensaje pegado dos veces; tratado como una conversación, no dos incidencias.18recorridos completos:PPP,Poke de tofu y Falafel con variantecombo en catálogos ficticios,agente simulado activo/inactivo,tres consultas de precio. Baseline9aprobadas/9fallaron (/tmp/ppp-arroz-price-name-baseline.log):precio ya no se capturaba como nombre,pero combo durante awaiting_name con agente habilitado terminaba pidiendo nombre sin contestar. La secuencia verifica luego nombre real y precio durante pago sin cambios de carrito.

Corrección:consulta de disponibilidadcombo se resuelve antes de agente/captura de datos; información de versiones no sustituye selección pendiente ni inicia otro pedido si ya hay carrito. Respuesta recuerda paso pendiente.120focalizadas aprobadas (18secuencias nuevas+96recordatorios+6controlesexistentes) /tmp/ppp-pending-combo-fixed.log. Total nuevas114. Full final en curso /tmp/ppp-pending-combo-full.log, snapshot /tmp/ppp-pending-combo-source.json; TypeScript final /tmp/ppp-pending-combo-tsc.log. No editar fuentes. Cero API, Mainintacta. Expiración por inactividad no reproducida/acreditada como parte de estos18; no inferir que la configuración de Main coincide con staging.

Aprobación final integrada:66suites/3027pruebas aprobadas,300.657s (/tmp/ppp-pending-combo-full.log);TypeScript aprobado (/tmp/ppp-pending-combo-tsc.log). Snapshot fuente sin cambios.114regresiones nuevas (96recordatorios+18secuencias). Mainintacta,35/40APIusadas,5restantes. Pendiente verificar deploy.

Código591c134e publicado/desplegado staging,verificado13/10/2026 13:35Bogotá:running/healthy,imagenactiva=candidata sha256:aaf13ec72af80b15fe0db8b66d5826d30e07d4da4de50c0ffd9ae11569391a8d; healthOK/DBconnected/circuitCLOSED. Logs /tmp/ppp-pending-combo-deploy.log y /tmp/ppp-pending-combo-deploy-verified.log. Primera comprobación starting/healthOK;segundahealthy. Mainintacta. Conservados archivos dist/tsbuildinfo locales y bin/ remoto. No cambios de modelos ni gastoAPI. Siguiente:precio ambiguo en carrito múltiple,aclaración de consulta sin comprar,cambio/rechazo mientras hay opción pendiente,cobertura efectiva.

## Plan de huecos y aclaración explícita — 13/10/2026

Basefa968bba,runtime591c134e.16pruebas nuevas con carrito de dos productos Sushi/Gyozas y Pasta/Crema,agente simulado activo/inactivo y awaiting_name/phone/address/payment. “Que precio tiene” aclara producto sin dos preguntas competidoras; “Quiero saber el precio de X” responde sin modificar sesión y permite continuar dato pendiente.16/16focalizadas aprobadas /tmp/ppp-ambiguous-explicit-price.log. Solo cambia spec/documentación;sin runtimepatch ni deploy requerido. Suite general afectada en curso /tmp/ppp-ambiguous-explicit-suite.log;TypeScript /tmp/ppp-ambiguous-explicit-tsc.log. No acreditar la respuesta abreviada X/el segundo todavía:próxima prioridad para evitar compra al aclarar consulta.

Plan ampliado en WHATSAPP-COMMERCIAL-READINESS-PLAN:consulta ambigua,cancelación de selección frente a pedido,cambios y consultas juntas,referencias/ráfagas/pausas,clasificación de datos,precio/cobertura y evaluación real reservada. No convertir cada frase en parche por SKU. Mainintacta,ceroAPI35/40usadas5restantes.

Cierre:16nuevas aprobadas y suite general completa1710/1710aprobada,287.318s (/tmp/ppp-ambiguous-explicit-suite.log),TypeScript aprobado. Sin modificaciones runtime;última verificación global sigue66/3027, no acreditar3043como ejecución global nueva. No reconstruir API. Prioridad siguiente:respuesta abreviada a consulta de precio ambigua (nombre/número),conservando captura y carrito;después cancelación de elección frente a carrito. Mainintacta,ceroAPI35/40usadas5restantes.

## Contexto de consulta de precio — 13/10/2026

Base15a4b3b0,runtime591c134e.84regresiones nuevas:64respuesta abreviada/desistimiento en nombre/teléfono/dirección/pago con2menús ficticios y agente simulado activo/inactivo;12controles durante pago(número fuera de lista,ordinal inválido,consulta intercalada,repetición,desistimiento y acción explícita);8nuevos datos válidos abandonan la consulta pendiente. Baseline64/64fallaron /tmp/ppp-price-context-baseline.log:aclaración no mantenía intención informativa. Dato válido baseline2fallaron/6pasaron /tmp/ppp-price-context-data-baseline.log,teléfono numérico se confundía con índice.

Corrección general:pendingPriceInquiry separado de pendingMatch/atributos,candidatos numerados por productos actuales del carrito,snapshotcart+estado;precio por nombre exacto/número/ordinal responde sin compra. Desistir limpia solo consulta;acción/dato nuevo la abandona;otra consulta mantiene contexto. Número de lista máximo2dígitos,para no bloquear teléfono. Cambio de carrito/estado invalida contexto. Campo JSON opcional,no migraciónBD. No afirmar resolución de toda referencia vaga/typo.

103focalizadas aprobadas(84nuevas+19controlesprevios) /tmp/ppp-price-context-final-targets.log. Primer full /tmp/ppp-price-context-full.log detenido conSIGINT sobre PIDpropio662193 antes de editar fuentes para reproducir límite del teléfono;no acreditar como aprobado. Full final en curso /tmp/ppp-price-context-full-final.log;TypeScript /tmp/ppp-price-context-tsc-final.log;snapshot /tmp/ppp-price-context-source-final.json. No editar fuentes durantefull. Mainintacta,ceroAPI35/40usadas5restantes.

Solicitud adicional durantefull:resumir confirmación que repetía3vecesdirección. Segundo full /tmp/ppp-price-context-full-final.log detenido intencionalmente(SIGINT PIDpropio663295) antes de editar fuentes;no acreditar como aprobado. Integración presentación:formatCartOnly permite omitir dirección solo al componer resumen completo;campo de dirección apareceuna vez en datos de entrega. Carrito aislado conserva dirección. tryConfirmOrder evita repetirla enprefacio/anotación común cuando el cuerpo ya la muestra,preserva avisos tarifarios/ubicación.

12regresiones nuevas(2catálogos,domicilio/recogida,pago pendiente/elegido,carrito aislado y turnorealdirección→pago). Baseline6fallaron/6pasaron /tmp/ppp-compact-summary-baseline.log. Corrección parcial tuvo2fallos por aviso “Anoté” que también repetía dirección /tmp/ppp-price-summary-targets.log. Final115focalizadas aprobadas(96nuevas+19previas) /tmp/ppp-price-summary-approved.log. Full integrado en curso /tmp/ppp-price-summary-full.log;snapshot /tmp/ppp-price-summary-source.json;TypeScript /tmp/ppp-price-summary-tsc.log. Noeditar fuentes. Mainintacta,ceroAPI.

Cierre integrado:66suites/3139pruebas aprobadas (/tmp/ppp-price-summary-full.log);TypeScript aprobado /tmp/ppp-price-summary-tsc.log;snapshot sin cambios.96nuevas (84contextoprecio+12resumen),más16de tanda anterior ahora incluidas en full. Ejecuciones detenidas no son aprobación. Pendiente deploy. Mainintacta,ceroAPI35/40usadas5restantes.

Código850d7ccc desplegado/verificado13/10/2026 13:59Bogotá:running/healthy,imagenactiva=candidata sha256:459895adfc0ffd376994e675d459e5fc5eaee72c74c7cf68e364bf09ff7a280f;healthOK/DBconnected/circuitCLOSED. /tmp/ppp-price-summary-deploy.log y /tmp/ppp-price-summary-deploy-verified.log. Primera comprobación starting conhealthOK;segundahealthy. Mainintacta,modelos ypresupuesto sin cambios. Siguiente:cancelar elección pendiente frente a vaciar pedido,consulta+acción y referencias vagas/códigos durante consulta de precio. No acreditar bare“no”,typos o todos los ordinales con estos84.

## Cancelación de selección frente a pedido completo — 13/10/2026

Baseacd19ae3,runtime850d7ccc.36regresiones nuevas:32con carrito previo de2platos+nota,pendiente de sabor/producto en2cartas ficticias(Arepa/Infusión y Tarta/Smoothie),agente simulado activo/inactivo. Olvidaeso/noquieroesabebida/cancelaesaselección abandonan selección sin borrar carrito;vacía todo pedido sí limpia. Turno viejo de sabor no revive el producto abandonado.4controles de rechazo a bebida dentro de plato compuesto aclaran cambiar bebida frente a cancelarplato;preservan sopa elegida y cantidad3hasta decisión.

Baseline24fallaron/8pasaron /tmp/ppp-selection-cancel-baseline.log;variosfallos eran de claridad de respuesta,otrosdejaban selecciónactiva. Regla general temprana para cancelación de una selección(no propuestas múltiples ni enlacesMP)antes del agente/cancelación del pedido. Platos compuestos con atributoBebida necesitan aclaración del alcance. No acreditar todos los “olvida” ni cancelación de órdenes registradas.56focalizadas aprobadas(36nuevas+20controles) /tmp/ppp-selection-cancel-expanded.log.

Full en curso /tmp/ppp-selection-cancel-full.log;TypeScript /tmp/ppp-selection-cancel-tsc.log;snapshot /tmp/ppp-selection-cancel-source.json.Noeditarfuentes. Mainintacta,ceroAPI35/40usadas5restantes.

Aprobación final:66suites/3175pruebas aprobadas (/tmp/ppp-selection-cancel-full.log),TypeScript aprobado /tmp/ppp-selection-cancel-tsc.log;snapshot sin diferencias.36regresiones nuevas.NoAPI,Mainintacta. Pendiente deploy.

Código553a2087 desplegado/verificado13/10/2026 14:11Bogotá:running/healthy,imagenactiva=candidata sha256:bb3a3fac469fdc35dc6d0c4d85ca189799c5458fff8fc2519d768094ca8135be;healthOK/DBconnected/circuitCLOSED. /tmp/ppp-selection-cancel-deploy.log y /tmp/ppp-selection-cancel-deploy-verified.log. Primera comprobación starting/healthOK;segundahealthy. Mainintacta,modelos/presupuesto sin cambios. Próximo:cortesía/typos,alias de atributos,cancelación de edición de línea existente frente a eliminarla,propuestas múltiples.

## Cortesía, cancelación de edición y continuidad por número — 13/10/2026

Based8e43b98,runtime553a2087.48regresiones nuevas:24cortesía/typos al abandonar selección (Bebida de cítricos/Granizado),12cancelación real de edición de sabor en carrito con2productos y cantidades2/3(Refresco/Batido,Yogur/Helado),12con Preparacion/Coccion:cancelar,consultar total y negar cancelación,luego aplicar cambio al segundo plato. Pruebas conrouterreal,catalogoficticio,agentesimuladoactivo/inactivo. Baseline36/36fallaron /tmp/ppp-cancel-courtesy-edit-baseline.log.

Regla general:normalizar cortesía en el intent de cancelación y2typosdeacción/selección acotados;cancelar pendingCartAttributeEdit limpia solo ese cambio,conserva opciones/cantidades originales. “No cambies el/la [atributo]” usa nombres del catálogo,noSabor fijo. Negación“No canceles ese cambio” no abandona selección. Consultas muestranrecordatorio de plato pendiente. La ampliación tuvo8fallos por respuesta numérica que noaplicaba cambios /tmp/ppp-cancel-courtesy-edit-expanded.log y /tmp/ppp-cancel-courtesy-edit-approved.log. Corrección:respuestas de selección de edición antes del parser/modelo genérico,actualizaciones de atributo por catálogo acotadas al índice elegido. Debug /tmp/ppp-edit-resume-debug.log no es aprobación;consoletemporal quitado.

84focalizadas aprobadas(48nuevas+36controles) /tmp/ppp-cancel-courtesy-edit-final-targets.log. Full en curso /tmp/ppp-cancel-courtesy-edit-full.log;TypeScript /tmp/ppp-cancel-courtesy-edit-tsc.log;snapshot /tmp/ppp-cancel-courtesy-edit-source.json.Noeditarfuentes. Mainintacta,ceroAPI35/40usadas5restantes. No acreditar toda referencia/cortesía ni rollback de SKU que ya fue reemplazado antes de elegir opciones;propuestas múltiples siguen pendientes.

Extensión antes del cierre:4pruebas por colisión entre nombre de plato y opción (“deMango” en nombre,cliente solicitaLimon),2paresdecartasagentesimuladoactivo/inactivo.4/4baselinefallaron /tmp/ppp-edit-name-option-baseline.log. Corrección:selectedUpdates usa fuente original del cambio, no texto reconstruido con nombre de candidato.88focalizadas aprobadas(52nuevas+36controles) /tmp/ppp-cancel-courtesy-edit-all-targets.log. Full previo /tmp/ppp-cancel-courtesy-edit-full.log detenido(SIGINT PIDpropio682202) antes de editar,no aprobado. Full final /tmp/ppp-cancel-courtesy-edit-full-final.log;TypeScriptfinal /tmp/ppp-cancel-courtesy-edit-tsc-final.log;snapshotfinal /tmp/ppp-cancel-courtesy-edit-source-final.json.Noeditarfuentes.

Aprobación final:66suites/3227pruebas,307.352s (/tmp/ppp-cancel-courtesy-edit-full-final.log),TypeScript aprobado /tmp/ppp-cancel-courtesy-edit-tsc-final.log,snapshot sin diferencias.52nuevasregresiones,88focalizadas. Full detenido no aprobado. Mainintacta,ceroAPI35/40usadas5restantes. Pendiente deploy.

Código0508049d desplegado/verificado13/10/2026 14:32Bogotá:running/healthy,imagenactiva=candidata sha256:562082b34bf0942e56e18acbf26d506f092d8405fcad6bc03c16af2e0a4e041d;healthOK/DBconnected/circuitCLOSED. /tmp/ppp-cancel-courtesy-edit-deploy.log y /tmp/ppp-cancel-courtesy-edit-deploy-verified.log. Primera comprobación starting/healthOK;segundahealthy. Mainintacta,ceroAPI:modelos/presupuesto sin cambios. Próximo:sustitución deSKU→opciones pendientes→cancelación/restauración;propuestas múltiples;consulta+acción.


## Correcciones de dirección y pedidos mixtos — 13/10/2026, en validación

Se encontró HEAD ac634386 (publicado por otro trabajo concurrente), que ya integraba los 8 casos de sustitución de SKU de esta tarea y nuevos casos de direcciones/ofertas. Se preservó ese trabajo y se revisaron los cambios locales de aceptación de acompañamiento; no reiniciar ni atribuir todos esos cambios a esta tanda.

Fallos observados en chats del usuario:
- Dirección con texto conversacional guardado (“No, a esta…”); alias Direction durante pago ignorado; pago aplicado a dirección vieja; pregunta copiada antes de calle conservaba la anterior, pese a responder “Dirección lista”. Nueva calle debe reemplazar y volver a cotizar, manteniendo carrito/pago.
- “A una Nueva”/rechazo de anterior bloqueaba la captura; “es esta” sin destino se guardaba literalmente. Pedir destino concreto, no geocodificar demostrativos.
- Pedido mixto requería sí para productos ya claros. Añadir lo inequívoco; mantener por separado selección/opciones; excluir desconocidos y evitar duplicarlos con un sí posterior.
- “Un combo de tres tacos” se interpretó como tres unidades del SKU. Separar cantidad de paquetes y contenido del paquete; conservar ambigüedad entre SKUs con nombres similares.
- Oferta de dúo→consulta de bebida→sabor perdió SKU y compró botella; corrección en pago ignorada. Ac634386 ya trae pruebas de ese camino y otro menú; comprobarlas en regresión integrada.
- Aceptación de yuca se trató como plato; no debe aceptar además una sustitución de bebida ni reconstruir cantidades desde la prosa del bot. Se revisaron 6 pruebas locales: sin carrito estructurado se pide platos/cantidades, no se inventan compras.
- Colmbiana y Cliente Sintético son problemas visibles de presentación/datos; estos chats no prueban su origen. Pendiente auditar datos del catálogo/perfil antes de piloto; no corregir por SKU.

24 regresiones nuevas propias (10 dirección/copiar pregunta/rechazos, 2 pedido mixto, 12 paquetes en tacos/gyozas, cantidades1/2/5, agente simulado activo/inactivo). Baseline inicial10fallaron/2pasaron /tmp/ppp-address-mixed-baseline.log. Dirección10/10 /tmp/ppp-address-sequence-fixed.log; pedido+oferta6/6 /tmp/ppp-mixed-offer-fixed.log. Ampliación detectó6fallos más al reconocer alias de paquete con cantidad numérica;12/12 finales /tmp/ppp-pack-final-target.log. Debug de catálogo eliminado; logs debug no acreditan aprobación.

Full en curso /tmp/ppp-user-chat-full.log, TypeScript /tmp/ppp-user-chat-tsc-final.log, snapshot /tmp/ppp-user-chat-source.json. No editar fuentes hasta terminar. No acreditar pase completo ni desplegar hasta revisar regresiones; la nueva conducta de compra inmediata puede requerir actualizar expectativas antiguas de confirmación, sin ocultar fallos de carrito. Main intacta, cero llamadas API, 35/40 usadas,5restantes.


Extensión y regresión integrada:primer full /tmp/ppp-user-chat-full.log terminó con65suites aprobadas y1fallida,3343aprobadas/16fallidas,385.311s. Las16 expectativas iniciales suponían productos claros aún fuera de carrito. Actualizadas a compra inmediata, sin reducir comprobaciones de cantidades ni duplicados. La ejecución focal posterior detectó6fallos reales de respuesta:desconocido omitido en mensaje con domicilio y afirmación del desconocido respondida solo con carrito. Corregidos:avisar exclusión al añadir y guardar recentUnavailableOrder como contexto de consulta por15min, nunca borrador de compra; petición explícita del desconocido conserva carrito y responde sin inventar producto. CampoJSONopcional,no migraciónBD.

10pruebas adicionales propias:2recotización que sustituye tarifa2000/distancia1.4/coordenadas viejas por6000/4.6/coordenadas nuevas conservando cash/cantidad2/nota;4con dos ambigüedades en Pizza/Ramen que materializan primera elección sin esperarsegunda;4aceptación de yuca/edamame con Bebida aún pendiente y cantidad3. Baseline4/4fallaron para dos dudas (/tmp/ppp-mixed-two-ambiguities-baseline.log) y4/4 para aceptación parcial (/tmp/ppp-side-pending-drink-baseline2.log). Primeros intentos de fixture sin atributos y cfg sin campos fallaron compilación;no son prueba de comportamiento. Eliminado helper no usado que reconstruía compras desde prosa del bot. Aceptación exige contexto del último mensaje;con pendingAttribute y sin opción explícita preserva estado y pide opciones reales del producto.

34regresiones propias nuevas en total,6pruebas locales de aceptación revisadas y16expectativasprevias actualizadas.65focalizadas aprobadas /tmp/ppp-user-chat-targets-corrected3.log;45focalizadas trasúltima extensión aprobadas /tmp/ppp-side-mixed-final.log. Esos resultados no acreditan full nuevo.

Full final en curso /tmp/ppp-user-chat-full-final.log;TypeScript /tmp/ppp-user-chat-tsc-approved.log;snapshot /tmp/ppp-user-chat-source-final.json.No editar fuentes hasta terminar. SSHpreflight servidor estaba enac63438,running/healthy;no modificarbin/privado. Mainintacta por esta tarea, ceroAPI35/40usadas5restantes. Pendiente commit/deploy tras fullverde y snapshotválido.


Aprobación final de esta tanda:66suites/3369pruebas aprobadas,390.54s (/tmp/ppp-user-chat-full-final.log),TypeScript aprobado /tmp/ppp-user-chat-tsc-approved.log,snapshot final íntegro sin diferencias.34regresiones nuevas propias,6aceptacioneslocales revisadas y16expectativasprevias adaptadas a compra inmediata. El full inicial con16fallos no es aprobación. No llamadas API ni órdenes externas. Pendiente publicar/desplegar exacto código aprobado.


Código fb70c472 publicado y desplegado en staging13/10/2026 18:50Bogotá. Verificación /tmp/ppp-user-chat-deploy-verified.log:HEADfb70c47,running/healthy,imagenactiva=candidata sha256:f119b95ff8268ec334117f756d476dab99353bd3e45a541bc377b26de6308056;healthok,DBconnected,circuitCLOSED. Deploy /tmp/ppp-user-chat-deploy.log. No tocar orphanmariadb_local ni bin/privado;se preservaron. Main sin cambios por esta tarea. Presupuesto35/40usadas5restantes, ceroAPI esta tanda.

Siguiente tanda:atributos realmente obligatorios sin default al resolver primer/segundo plato de pedido mixto;consultas y correcciones intercaladas entre esas opciones;ráfagas de continuación;aceptaciones parciales sin draft recuperable;errores/tamaño/calidad deaudioSTT separados de interpretación. Los34casos acreditan caminos específicos, no todo lenguaje humano. Las4pruebas de dos dudas y4de acompañamiento con bebida cierran esos casos focales del plan. Revisar datos sintéticos y nombres/opciones del catálogo antes del piloto. No promover Main automáticamente.


## Opciones obligatorias en pedidos mixtos — 13/10/2026

Base31a0037c;último runtime desplegadofb70c472.52regresiones nuevas propias con2cartas ficticias y agente simulado activo/inactivo:28consultas de precio/total/sabores/opciones mientras hay bebida pendiente;16secuencias con dos bebidas, cantidades3/2 y2/4, incluida corrección solo de la primera;4cambios explícitos tres→cinco con sabor aún pendiente;4cancelaciones locales que conservan plato y no reviven bebida al enviar después su sabor. Router/catalog/guard reales;persistencia,Meta,modelo yórdenes simuladas,ceroAPI.

Baseline inicial /tmp/ppp-required-options-baseline.log:4fallaron/8pasaron. Consulta genérica de sabores caía al modelo (apagado:mock generateTurn inexistente;encendido:respuesta genérica “¿Cuál prefieres?”). Regla temprana responde con opciones del producto pendiente por nombres de atributos del catálogo;no selecciona valor ni consume pedido. Solo preguntas genéricas exactas:nombrar otro producto no se fuerza al actual.

Ampliación /tmp/ppp-required-options-final-targets.log:8fallaron/36pasaron en cantidad/cancelación. Corrección con nombre de bebida no ajustaba cantidad;cancelación local no cubría “olvida esa bebida” y cola multi mantenía duplicado del mismo producto pendiente. Cambio de cantidad actualiza solo pendingAttribute al nombrarlo (o referencia abreviada de cantidad);mantiene cola de otros productos. Cancelación admite cola vacía o que solo contiene el producto actual;con otras dudas pendientes aún no se acredita cancelación selectiva. No cancelar carrito ni perder atributos de plato compuesto. Debug de cola /tmp/ppp-required-cancel-debug.log eliminado del código;no acredita pase.

60focalizadas aprobadas (52nuevas+8controles de sustitución) /tmp/ppp-required-options-approved-targets.log. Full en curso /tmp/ppp-required-options-full.log,TypeScript /tmp/ppp-required-options-tsc.log,snapshot /tmp/ppp-required-options-source.json.Noeditarfuentesdurantefull. Mainintacta,35/40solicitudesusadas5restantes,noAPIesta tanda. Pendientecommit/deploytrasaprobación.

Siguiente:cancelar solo primera bebida cuando quedan otras selecciones;preguntas de otro producto mientras se elige sabor;correcciones de cantidad por referencia abreviada con varios candidatos;notas independientes de cada bebida;ráfagas/retomas con cantidad corregida. No declarar cobertura completa por52casos.


Aprobación final:66suites/3421pruebas aprobadas,676.044s (/tmp/ppp-required-options-full.log);TypeScript aprobado (/tmp/ppp-required-options-tsc.log);snapshot íntegro sin diferencias.52regresiones propias nuevas,60focalizadas concontroles. Duración de suite no es medición de latencia del bot. Mainintacta,cero llamadas pagadas,35/40usadas5restantes. Pendiente publicar/desplegar código aprobado.


Runtime55c5fd52 publicado/desplegado/verificado13/10/2026 19:13Bogotá:running/healthy,imagenactiva=candidata sha256:37ae6339eb3cd6ed5f619effebcce06281f5e5b4a1646954f426f228f41316cc;healthok,DBconnected,circuitCLOSED. Logs /tmp/ppp-required-options-deploy.log y /tmp/ppp-required-options-deploy-verified.log. Preservados bin/,privados yorphanmariadb_local. Mainintacta,modelos sin cambios,cero llamadas pagadas. Artefactos dist/ ytsbuildinfo locales previos no se incluyeron en commit.


## Promoción autorizada a producción — 13/10/2026 19:29 Bogotá

Usuario pidió desplegar a Main y luego continuar staging. Main49194fec integra stagingb8b497d6 sin conflictos yconserva cambios propios enauth/admin.controller.ts yorders.service.ts.66suites/3421pruebas aprobadas,694.269s (/tmp/ppp-main-required-options-full.log),TypeScript aprobado /tmp/ppp-main-required-options-tsc.log;fuente inmutable /tmp/ppp-main-required-options-source.json. Compilación independiente /tmp/ppp-main-promotion-dist y /tmp/ppp-main-promotion-build.log.

Producción /var/www/ppp-nest,Main49194fec,compose efectivo docker-compose.yml,proyecto ppp-nest,contenedor ppp_nest_api. Compose local adaptado y backups conservados;no sobrescribirlos ni usarcompose staging enproducción. Se construyó con Dockerfile multietapa, sin volumen de fuente encompose efectivo. Running,imagenactiva=ppp-nest-api sha256:38beb7e91d1ab3919b85a662991bf791b74fb27b35295d832f419a978b038cdd;HTTP3000/api/healthOK,DBconnected,circuitCLOSED. Contenedor sinhealthcheckDocker:verHTTP. Dos módulos compilados coinciden byteporbyte concompilación local:orchestrator a6fc0a056221ca02f30207b03f88bbd0ef04e63e0f1daa57be4a26eb9d2e8dc6;AI20677034b5f343566d5fa3bb56bf7e697f47882656a6b37134cbb346f400ce32. Evidencia /tmp/ppp-main-required-options-deploy.log y /tmp/ppp-main-required-options-verified.log. Imagen anterior preservada como ppp-nest-api:before-promotion-49194fec. Sin cambios de modelos/credenciales ni llamadas pagadas.

Staging se conserva yse actualizó porfastforwarda49194fec paraincluir también cambios propiosMain. Trabajar nuevas tandas soloenstaging,no Main. Las próximas correcciones no sepromueven automáticamente. Presupuesto35/40,5restantes. Staging API todavía55c5fd52 hasta siguiente deployaprobado.


## Continuación en staging: colas de opciones y puntos — en validación

Tras producción49194fec,staging local avanzó a ese commit. El primer fastforward rechazó artefactos generados locales;se preservaron enstash local edd763f8adb87bd445dc8235e37e17258133e54b (solo12rutasdist/ ytsconfig.build.tsbuildinfo). No aplicar ese stash sobre código actual ni borrarlo por rutina. Main conserva dist/ históricos rastreados,que entraron en staging por integración;Docker compila src/ fresco,no usar esos dist/ como evidencia de runtime. Main quedó intacta después deldeploy.

20regresiones nuevas sobre colas:8cancelar bebida actual cuando quedaotra,8notas independientes entreplato/jugo/gaseosa(con ysin cancelación),4mismoSKUyaen carrito y2solicitudespendientes. Baseline8/8fallaron /tmp/ppp-selective-queue-baseline.log. Corrección cancela primera fila activa, nunca todas las filas delSKU;resuelve siguiente producto porcatálogo,mantiene cantidad/atributos/notas yresto delcarrito.20aprobadas /tmp/ppp-selective-queue-notes.log. Cancelación conserva restricciones deambigüedad/colasdeotros tipos;no acreditar todo “no”.

Usuario añadió compra “medio pollo más pero para pagar con puntos” ypidió buscarhuecos generales.58regresiones nuevasdepuntos:24compra+premio,30consultas específicas/sin cuenta/códigomalformado,4productos conPremioen su nombre. Baseline24/24fallaron /tmp/ppp-points-order-baseline.log;consultas22fallaron/8pasaron /tmp/ppp-points-topic-baseline.log;nombres4/4fallaron /tmp/ppp-points-name-collision-baseline.log. Pago conpuntos se separa depedido explícito yse explica acción concreta(códigoexistente oredimir con9puntos);no canje ni descuentoautomáticos. Se conserva contexto deproducto/conversación;las preguntas de saldo/pago/premio usan textooriginal antesdeETA/captura. Código inválido oausente pidecódigo específico;cuentas no vinculadas reciben siguiente paso,no guía completa. Compra de producto quecontiene Premiono se convierte enayuda deprograma;no quitar palabras queformanpartedelnombre literal delcatálogo.

Parcialesdetectaron6fallos porproductoBowlDelPremio,9porTengoPremio/TodoGratis (esteúltimo seconfundía con progreso depedido),2porBrownieConPremio(stripsecomíanpartedelnombre). Corregidos,103focalizadas aprobadas /tmp/ppp-loyalty-queue-targets-final.log (78nuevas+25controlesdecanje/códigos). NormativaPPPdepuntos(9yproductos elegibles)eslegada enPointsService/PointsHelp;no introducir nuevos IDs/nombres excepcionales en clasificador. FicciónBowl usa código2 delprograma existente;esto no acredita programas de puntos distintos por tenant. ParaKamppo parametrizarpolítica, no copiarPPPcódigoscomoreglaglobal.

Fullen curso /tmp/ppp-loyalty-queue-full.log;TypeScript /tmp/ppp-loyalty-queue-tsc.log;snapshot /tmp/ppp-loyalty-queue-source.json.Noeditarfuenteshasta terminar.78regresiones nuevas. Mainproducción49194fec NOtieneestasúltimascorrecciones,sonsolo staging.35/40llamadasusadas5restantes;ceroAPIpagada,Meta/BD/modelos/órdenes simulados.

Próximos huecos:pedido+códigodepremioenmismomensaje;pedido+redimir explícito;tras generar premio,aplicarlo alpedido solo cuando intención persistida loautorice;cancelación conambigüedadesadicionales;otrosproductos/nombresde12letrasquecolisionancon códigos;programas de puntos de otros tenants;saldo parcial mientrasfaltanopcionesycorrecciones despuésdepremio. Yaexistíancontroles decódigousado/vencido/otrocliente yregistrodefactura:reutilizados, no duplicar ni acreditar pruebas reales decanje.


### Revisión global de la tanda de puntos — no desplegar todavía

Primer full:62suites aprobadas/4fallidas;3436pruebas aprobadas/63fallidas,3499total,666.448s (/tmp/ppp-loyalty-queue-full.log).46fallos en notas/eliminaciones/cantidades eran harnesses Object.create sin pointsHandler;se añadió servicio real con dependencia externa simulada a esos tres fixtures.17fallos en ráfagas/pedidos agrupados mostraban interferencia de la ruta nueva de premio en mensajes ordinarios;entrada pointsPurchaseOrderText ahora exige palabra puntos/premio antes de invocarse. No atribuir los63fallos a infraestructura.

Verificación corregida:160casos focalizados aprobados en suite general /tmp/ppp-loyalty-global-fixes.log (los46fallos de fixtures en ese run corresponden a la captura anterior a actualización de esos archivos);después111pruebas aprobadas en las tres suites completas /tmp/ppp-loyalty-fixture-fixes.log. TypeScript aprobado /tmp/ppp-loyalty-fixed-tsc.log. Nueva global pendiente /tmp/ppp-loyalty-fixed-full.log; snapshot /tmp/ppp-loyalty-fixed-source.json. No editar fuentes durante ejecución. Mainproducción49194fec permanece intacta. Correcciones nuevas siguen locales, sin publicar/desplegar hasta full aprobado. CeroAPIpagada.


Revisión posterior de árbol pendiente:hay cambios acumulados adicionales conservados en types/session-intents/partial-note,unas1571líneas de fixtures y rutas de autocorrección,imagen parcial,códigos+pedido,alergias,cancelación y cuenta. Todos figuran en snapshot /tmp/ppp-loyalty-fixed-source.json,sin diferencias al comprobarlo;no atribuir toda esa ampliación a las78regresiones iniciales. Presupuesto efectivo docs/whatsapp-model-budget.json:36/40usadas,4restantes;registro de una llamada de consulta de celebración13/10Bogotá,que encontró captura falsa de dirección y fue corregida por trabajo acumulado. No sobrescribir ese registro con el saldo35 anterior. No nuevas llamadas en revisión actual.

Próxima revisión de claridad:tryRemoveMostExpensiveLine ytryApplyAllergyOrder dicen «pedido sigue igual» después de mutación;distinguir «los demás platos se conservan». Añadir caso precio unitario vsimporte de línea,empate del mismoSKUcon notas diferentes,nota parcial junto a autocorrección (hoy queda texto «una sin...» en una línea agrupada),referencias foto caducadas/reinicio,alergia al corregir carrito existente. Estos son huecos de revisión pendientes,no fallos globales acreditados.


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


## Plan de piloto y siguiente corrección de foto

El plan concreto está al final de WHATSAPP-COMMERCIAL-READINESS-PLAN.md: seis pasos con criterios de aprobación, desde correcciones/contexto hasta evaluación reservada, medios, piloto asistido y parametrización Kamppo. No acreditar todo el programa por pruebas de catálogo sintético.

Seis regresiones nuevas: cuatro preservan nota y Salsa:Picante al reducir cantidad de Pizza Vegetal/Bowl De Quinoa desde una foto, con agente simulado activo/inactivo y estados awaiting_address/awaiting_payment; conservan dirección/pago. Dos prueban opción retirada del catálogo. Baseline inicial4/4fallaron /tmp/ppp-photo-attributes-baseline.log;la frase de foto se guardaba como dirección. Cambio: despachar referencia explícita a foto antes de captura checkout;reutilizar nota/atributos de una sola línea;validar contra carta actual antes de reconstruir. Parcial detectó2fallos porque helper elegía valor por defecto para opción retirada;ahora se pide aclaración sin mutar. Error TypeScript de atributo opcional corregido,solo último pase acredita aprobación.

34focalizadas aprobadas /tmp/ppp-photo-attributes-approved.log;TypeScript aprobado /tmp/ppp-photo-attributes-approved-tsc.log. Full en curso /tmp/ppp-photo-attributes-full.log;snapshot /tmp/ppp-photo-attributes-source.json. No editar fuentes durante ejecución. Nuevos cambios locales,no desplegados todavía. Main intacta,staging runtimebfab2af6. Cero llamadas pagadas esta tanda,36/40usadas4restantes. Pendiente procedencia del mismo SKU antes/después de foto,mezclas de variantes y notas por unidad.


Corrección del criterio antes de publicar: «solo el primero» selecciona el producto, no expresa cantidad1. Se conserva cantidad existente de la primera selección ordinal;«dos del tercero»sí cambia cantidad. Las cuatro pruebas nuevas ahora acreditan qty3conservada,nota/atributo,direcciónypago,no una reducción solicitada inexistente. Global anterior /tmp/ppp-photo-attributes-full.log fue interrumpida conexit130 antes de editar fuentes;no acredita pase. Último focal34aprobadas9.712s yTypeScriptaprobado. Nueva global /tmp/ppp-photo-attributes-final-full.log,snapshot /tmp/ppp-photo-attributes-final-source.json. No editar fuentes durante ejecución.


Cierre de la primera tanda del plan: 66 suites y 3.752 pruebas aprobadas en 408,98 segundos (`/tmp/ppp-photo-attributes-final-full.log`); TypeScript aprobado (`/tmp/ppp-photo-attributes-approved-tsc.log`); todas las fuentes coinciden con snapshot final. Seis regresiones nuevas y 34 comprobaciones focalizadas. La selección ordinal de foto conserva cantidad, nota, atributos, dirección y pago; cantidades explícitas se aplican; opciones retiradas piden aclaración sin mutar. Publicación y deploy aún pendientes de verificación. Main sigue intacta. Cero llamadas pagadas en esta tanda; 36 usadas de 40, 4 restantes. Próximo bloqueo: procedencia de cantidades fusionadas del mismo SKU antes/después de una foto.


## Staging verificado — 14 de octubre de 2026, 00:03 Bogotá

Runtime `c125cd1e` desplegado y verificado. API running/healthy; imagen activa=candidata `sha256:040c74517c886aad16bfe1d95dfcb9b499c1798d8a58bfbe1fbc6a69ce34aae8`; healthok/DBconnected/circuitCLOSED. Evidencia `/tmp/ppp-photo-attributes-deploy.log` y `/tmp/ppp-photo-attributes-verified.log`. Primera consulta starting,segunda healthy. Producción verificada sigue Main49194fec. Rama staging conservada,modelos sin cambios,ninguna llamada pagada esta tanda.

Estado del plan: primer paso parcialmente completado (foto conserva nota/opción/cantidad y no captura dirección); falta procedencia para unidades del mismoSKU fusionadas antes/después deimagen. Siguiente tanda empieza por ese caso, con producto ajeno y nota diferente, antes de mejorar textos de mutación. No abrir piloto por conteo: deben pasar evaluación reservada y muestra real de medios; después piloto acotado y supervisado. Regresión final66suites/3752pruebas+TypeScript aprobados.


## Procedencia de foto y revisión Kamppo — 14/10/2026

Kamppo inspeccionado solo por lectura en /home/levi/Documents/programming/Kamppo. Ya hay módulo WhatsApp,tenantId en conversaciones e índice tenantId/waPhone,servicios separados y fixtures multi-restaurante. No ejecutar migración ni atribuir aislamiento acreditado: no se ejecutaron suites Kamppo. Notas de adaptación en docs/kamppo-engine-readiness.md;portar comportamientos/casos a tipos/IDs/opciones de Kamppo, no copiar orquestador PPP completo ni su política de puntos.

28regresiones nuevas de foto con cartas pizza/bowl y agente simulado activo/inactivo.12casos de contexto antes/después/ajeno:baseline8fallaron4pasaron /tmp/ppp-photo-provenance-baseline.log.16recorridos imagen→carrito→corrección guardan snapshot previo/firma posterior y limpian referencia con foto sin productos oilegible. Resolución de imagen y proveedores simulados;no inferencia pagada. Dos metadatos opcionales JSON,no migración DB. Primera imagen invalida contexto previo;fin de turno exitoso guarda firma solo de líneas de productos de esa foto. Corrección pide aclaración si producto ya estaba antes o líneas cambiaron después,conservando todo;productos ajenos no bloquean. No atribuir reparto exacto de unidades fusionadas:el guard pide cantidad final explícita.

Parcial de integración4fallaron porque «Agrega un [producto]» fue capturado como dirección;control de procedencia usa luego «Quiero otro [producto]» ycomprueba qty2antes deltest. Ese primer fallo NOse corrigió en esta tanda:queda como siguiente bloqueo de clasificación checkout/compra,con nombres de pizza/bowl. No esconderlo ni declarar piloto listo.102focalizadas aprobadas /tmp/ppp-photo-provenance-final-targets.log yTypeScript aprobado /tmp/ppp-photo-provenance-final-tsc.log. Global /tmp/ppp-photo-provenance-full.log;snapshot /tmp/ppp-photo-provenance-source.json. Noeditarfuentesdurantefull. Staging runtimec125cd1e hasta siguiente deploy;Main49194fec intacta. CeroAPI enesta tanda,36/40usadas4restantes.


Cierre de procedencia de fotos: 66 suites y 3.780 pruebas aprobadas en 403,636 segundos (`/tmp/ppp-photo-provenance-full.log`); TypeScript aprobado (`/tmp/ppp-photo-provenance-final-tsc.log`); snapshot íntegro.28regresiones nuevas,102focalizadas. Se guardan carrito previo y firma de líneas de la foto; la corrección pide aclaración ante unidades previas o cambios posteriores del mismo producto; productos ajenos se conservan; foto nueva ilegible limpia referencia antigua. Esto no acredita división automática de cantidades fusionadas: la protección pide aclaración.

Próxima tanda crítica: compras con «Agrega un [producto]» capturadas como dirección en el recorrido posterior a imagen; reproducir también «añade»,«ponme»,estados building_cart/awaiting_address/awaiting_payment y diversas cartas. No declarar piloto aprobado mientras ese caso siga pendiente. Kamppo revisado solo por lectura; adaptación documentada en docs/kamppo-engine-readiness.md, sin modificación ni despliegue allí. Cero llamadas pagadas esta tanda,36/40usadas4restantes. Publicar/desplegar staging tras este pase; Main49194fec intacta.


Staging verificado14/10/2026 00:25Bogotá:runtime430e1ea0,running/healthy,imagenactiva=candidata sha256:affc186d30b907cc8425b2ccf14dd5581f0ccd340e57c0eca40f0ab462f26e61;healthok,DBconnected,circuitCLOSED. Evidencia /tmp/ppp-photo-provenance-deploy.log y /tmp/ppp-photo-provenance-verified.log. Main49194fec comprobada sin cambios.28regresiones nuevas;full66suites/3780pruebas yTypeScript aprobados;noAPIpagada. Pendiente siguiente tanda «Agrega un producto» capturado como dirección;no migración Kamppo todavía.


## Comandos de adición y dirección pendiente — 14/10/2026

84regresiones nuevas:72compras con agrega/añade/ponme,otro,cantidad2,en building_cart/awaiting_address/awaiting_payment;4bebidas con sabor pendiente y regreso a dirección;8consultas de precio de una posible adición,sin mutación. Cartas ficticias pizza/bowl/bebidas,agente simulado activo/inactivo;carrito previo conqty2ynota,dirección yórdenes externos preservados. Baseline48casos:28fallaron20pasaron /tmp/ppp-add-command-baseline.log. Normalización de comando respaldado por producto del catálogo a intención «Quiero» antes de captura checkout,sin nombres/IDs PPP. Primer parcial16fallos eran compras bloqueadas porawaiting_address /tmp/ppp-add-command-fixed.log;se guarda pendingCheckoutResume para completar compra/opciones yretomar dirección. Adición durante dirección debe pasar router normal ycontroles de catálogo,no tratarse como campo de dirección.

84focalizadas aprobadas /tmp/ppp-add-command-final-targets.log,TypeScriptaprobado /tmp/ppp-add-command-tsc.log. Global /tmp/ppp-add-command-full.log;snapshot /tmp/ppp-add-command-source.json.No editar fuentesdurantefull. Nuevos cambios todavía locales;runtime staging430e1ea0,Main49194fec intacta. CeroAPIpagada,36/40usadas4restantes. Limitación:la nueva normalización exige producto reconocido,verbo/contador alinicio ysininterrogación;no acredita comandos conproducto desconocido,correcciones deatributos,compra+consulta o dirección+compra enmismomensaje. Próxima tanda:esas fronteras ycomandos deagrupación/consulta sin pérdidas decontexto.


Adiciones aprobadas:66suites/3864pruebas,694.984s (/tmp/ppp-add-command-full.log),TypeScriptaprobado /tmp/ppp-add-command-tsc.log,fuente inmutable /tmp/ppp-add-command-source.json.84casos nuevos cubren compras reconocidas y consultas de precio,con notas/cantidad/dirección conservadas y retorno a dirección después de elegir sabor. Duración de suite no mide latencia del bot. CeroAPIpagada,36/40usadas4restantes. Pendiente publicación/deploydeexactocódigoaprobado;Main49194fec intacta. Siguiente:productos no reconocidos,comandos con códigos,compra+consulta ydireccion+compra,correcciones de atributos frente a compra. No declarar cobertura universal.


Staging verificado14/10/2026 00:46Bogotá:runtimef0c7c03c,running/healthy,imagenactiva=candidata sha256:ab254aedd882bfbb592f87ff4886ca5ee9847cc0fbd94b75f396f1aac6e1379e;HTTP3301/api/healthok,DBconnected,circuitCLOSED. Logs /tmp/ppp-add-command-deploy.log y /tmp/ppp-add-command-verified.log. Main49194fec comprobada sin cambios.84regresiones nuevas,66suites/3864pruebas+TypeScript aprobados. Ninguna llamada pagada. Mantener staging ycontinuar fronteras pendientes descritas arriba,con otros catálogos.


## Fronteras de adiciones: desconocidos, códigos y dirección — 14/10/2026

96regresiones nuevas en pizza/bowl y agente simulado activo/inactivo:72pedidos por código/con o sin cantidad yproductos desconocidos en3estados;12códigos inexistentes;8apartamentos/torres con número coincidente concódigo de menú;4productos+dirección sin reiterar la pregunta. Baseline48casos44fallaron4pasaron /tmp/ppp-add-boundary-baseline.log;formas cortas sincantidad22fallaron2pasaron /tmp/ppp-add-bare-code-baseline.log. Normalizar intención explícita para resolver catálogo antes de capturar campos;validar código y convertirlo al nombre del producto conservando cantidad;producto desconocido no muta carrito/dirección/estado. No consultar órdenes existentes por un # usado en una compra.

Parciales:28fallos /tmp/ppp-add-boundary-fixed.log por # tratado como orden,desconocidosqty2 ignorados ybloqueo decompra enpago.4fallos deapartamento/torre eran referencia interpretada como consulta deorden (Meta/órdenes simuladas);se conserva referencia de dirección,se comprueba texto ycarrito.4fallos producto+dirección perdían el producto:se reconoce compra por catálogo antes del earlyaddress-only yno se guarda resumeAddress cuando la dirección ya vino enmismo mensaje.237focalizadas aprobadas /tmp/ppp-add-boundary-final-approved.log;20controles de códigos/referencias reforzados aprobados /tmp/ppp-add-address-reference-approved.log. TypeScriptaprobado /tmp/ppp-add-boundary-final-tsc.log.

Full /tmp/ppp-add-boundary-full.log;snapshot /tmp/ppp-add-boundary-source.json. No editar fuentes durantefull. Cambios aún locales;stagingruntimef0c7c03c,Main49194fec intacta,ceroAPIpagada.36/40usadas4restantes. Limitaciones pendientes:varios códigos en unmensaje,pedido+consulta explícitos mezclados,adiciones con atributos/negaciones,nombres de productos quecoinciden con palabras de domicilio,referencias de dirección múltiples yvarios destinos. No atribuir cobertura completa por96casos.


Fronteras de adición aprobadas:66suites/3960pruebas,689.98s (/tmp/ppp-add-boundary-full.log);TypeScriptaprobado /tmp/ppp-add-boundary-final-tsc.log;fuente íntegra /tmp/ppp-add-boundary-source.json.96casos nuevos,237focalizadas y20controles reforzados. No llamadas pagadas esta tanda. Pendiente publicación ydeploy de código validado. Main49194fec intacta;presupuesto36/40usadas4restantes. Siguiente:varios códigos,compra+consulta,negación/cambio deatributo frente a compra,productos conpalabras dedomicilio yvarios destinos.


Staging verificado14/10/2026 01:16Bogotá:runtimea57ce9f1,running/healthy,imagenactiva=candidata sha256:e15b2bf712c652c09cab91a2618c90e7a994c63cef13b3f1d2cde3227bff7e69;HTTP3301/api/healthok,DBconnected,circuitCLOSED. Evidencia /tmp/ppp-add-boundary-deploy.log y /tmp/ppp-add-boundary-verified.log. Main49194fec comprobada sin cambios.96regresiones nuevas,66suites/3960pruebas yTypeScript aprobados. CeroAPIpagada. Siguiente tanda:varios códigos,pedido+consulta simultáneos,negaciones/atributos ypalabras dedomicilio ennombres deproducto;conservar número/referencias correctas sin más destinos implícitos.


## Pedidos con varios códigos, consulta y negación — 14/10/2026

48regresiones nuevas:24compras con2códigos,cantidades2/3odefault1,en building_cart/awaiting_address/awaiting_payment;4con dirección yplaca#18-27;8compra explícita+consulta delpreciounitario;8negación deSalsaPicante→Suave oconsulta hipotética sinmutar;4dosplatos compartiendoSalsa preguntan cuál yselección1cambia soloesa línea,sinconfundirla conpago. Pizza/bowl,agente simuladoactivo/inactivo;proveedores externos simulados. Baseline40casos36fallaron4pasaron /tmp/ppp-mixed-intents-baseline.log.

Se reemplazan todosloscódigos validados por nombres delcatálogo dentro delpedido,conservando cantidades ydejando intacta dirección. Enawaiting_payment,compra explícita múltiple pasa por manejador multi antesdeadición individual. Compra explícita anterior a «;¿cuánto vale cadauno?»seprocesa ysecontesta concarrito/precios reales;pregunta solanoautoriza compra. Negación conalternativa «no con X,mejor conY»usaopciónaceptada,nota/cantidadconservadas;si hayvariaslíneas seaclara. Foco positivo preciso:preguntas hipotéticas usanguardas deconsulta;no acreditar cualquierforma de negación ointerrogación.

Primer scriptdeedición rechazó parcheantesdeescribir,no aprobación;parcial de ejecución tras correcciones tenía8fallos porqueawaiting_paymentagregabasoloprimerproducto /tmp/ppp-mixed-intents-fixed.log,resuelto conruta multi existente.285focalizadas aprobadas /tmp/ppp-mixed-intents-final-targets.log;TypeScriptaprobado /tmp/ppp-mixed-intents-final-tsc.log. Global /tmp/ppp-mixed-intents-full.log;snapshot /tmp/ppp-mixed-intents-source.json.Noeditarfuentesdurantefull. Cambios locales,stagingruntimea57ce9f1,Main49194fec intacta,ceroAPIpagada,36/40usadas4restantes.

Siguiente:mezcla decódigo válido+desconocido (guard actualrechazatodoadición);consulta adicional conproductos aúnpendientes;negación sin alternativa positiva ocon«sin»;correcciones despuésdepremio;productos connombres dedomicilio;retomas/variantes de cortesía/typos. No declarar piloto por conteo: faltan evaluación reservada,inferencia ymedios representativos.

Hipótesis de revisión siguiente (sin prueba ejecutada todavía): códigos distintos con nombres idénticos y precios/presentaciones diferentes. La normalización actual sustituye código por nombre; verificar que no pierda identidad SKU al resolver varias líneas. Probar primero fixture con mismo título y dos códigos/precios. No afirmar fallo confirmado ni cobertura hasta ejecutar ese recorrido. Prioridad junto a código válido+desconocido y negación sin alternativa.


Tanda mixta aprobada:66suites/4008pruebas,700.365s (/tmp/ppp-mixed-intents-full.log);TypeScriptaprobado /tmp/ppp-mixed-intents-final-tsc.log;fuente íntegra /tmp/ppp-mixed-intents-source.json.48regresiones nuevas y285focalizadas aprobadas. Pendiente publicación/deploy delcódigo validado. Main49194fec intacta. CeroAPIpagada,36/40usadas4restantes. Siguiente:SKUcon títulos repetidos (hipótesis pendiente),válido+desconocido,negación sin alternativa,consultas conopciones pendientes yvariantes lingüísticas.


Staging verificado14/10/2026 06:10Bogotá:runtime8d28d37e,running/healthy,imagenactiva=candidata sha256:304d787babc31a609cab5b3a278d25ef492c0196829c5a8a8b23b3ed15ca77e5;HTTP3301/api/healthok,DBconnected,circuitCLOSED. Evidencia /tmp/ppp-mixed-intents-deploy.log y /tmp/ppp-mixed-intents-verified.log. Main49194fec comprobada sin cambios.48regresiones nuevas,66suites/4008pruebas+TypeScript aprobados. CeroAPIpagada. Próxima tanda prioriza títulos repetidos con códigos/precios distintos,mezcla válido+desconocido ynegación sin alternativa clara. Mantener source snapshots ystagingpermanente,no promoverMain automáticamente.


## Identidad de códigos repetidos y aceptación parcial — 14/10/2026

24 regresiones nuevas con dos cartas ficticias (Trio De Tacos/Bowl Especial), dos SKU homónimos con códigos y precios distintos, agente simulado activo/inactivo, building_cart/awaiting_address/awaiting_payment. Comprueban IDs, cantidades 2/3 o una copia por omisión, precios 39.000/34.000, dirección conservada, ninguna orden externa y consultas sin compra. Código válido + #9999 añade inmediatamente el válido y explica el desconocido.

Baseline: 16/16 fallaron (/tmp/ppp-code-identity-baseline.log). Primera corrección: 12 pasaron y 4 fallaron porque la ruta de estado de un pedido interceptaba códigos de catálogo en building_cart/awaiting_address (/tmp/ppp-code-identity-target.log); no se añadió un mock para ocultar esa ruta equivocada. Ahora las cláusulas independientes de códigos se resuelven por identidad de catálogo y se procesan por el manejador multi existente antes de checkout/consulta de órdenes, respetando las guardas de negocio y pendientes. La ruta se limita a listas de código y cantidad; dirección, notas y consultas siguen el parser normal. No se sustituyen por nombres estas listas: dos títulos iguales siguen siendo dos productos distintos.

80 focalizadas aprobadas (/tmp/ppp-code-identity-target2.log); TypeScript aprobado (/tmp/ppp-code-identity-tsc.log). Global en ejecución: /tmp/ppp-code-identity-full.log; snapshot de src/**/*.ts: /tmp/ppp-code-identity-source.json. No editar fuentes durante el global. Cambios todavía locales; runtime staging anterior 8d28d37e, Main 49194fec intacta. Cero llamadas pagadas; saldo 36/40 usadas, 4 restantes.

Límites y siguiente tanda: esta corrección acredita listas independientes de códigos explícitos; no acredita un solo código de un título duplicado, listas de códigos combinadas con notas/dirección ni mezcla de código desconocido con productos por nombre. Añadir esas fronteras, atributos obligatorios y producto no disponible, negaciones sin alternativa positiva y «sin» frente a opciones válidas. No declarar piloto aprobado por el conteo de pruebas; siguen pendientes evaluación reservada, inferencia y medios originales representativos.


Cierre local de identidad: 66 suites / 4.032 pruebas aprobadas en 534.911 segundos (/tmp/ppp-code-identity-full.log), 80 focalizadas y TypeScript aprobados; snapshot íntegro. 24 regresiones nuevas. Pendiente publicación y despliegue del código validado. Main 49194fec intacta. Cero API pagada; 36/40 usadas, 4 restantes. Negación sin alternativa queda pendiente para siguiente tanda; no se ejecutó ni corrigió en este cierre.


Staging verificado 14/10/2026 07:42 Bogotá: runtime c3589adb, running/healthy, imagen activa = candidata sha256:2db338458820e8d796b352f508c80d6bb09dd33dd4782090f3d6d75d96a31fd2; HTTP3301/api/health ok, DB connected, circuit CLOSED. Evidencia /tmp/ppp-code-identity-deploy.log y /tmp/ppp-code-identity-verified.log. Main local y servidor 49194fec comprobadas sin cambios. 24 regresiones nuevas, full 66 suites/4032 pruebas y TypeScript aprobados, fuente íntegra. Cero API pagada. Siguiente: código aislado homónimo, listas con notas/dirección, atributos pendientes, negación sin alternativa; no promover Main automáticamente.


## Fronteras de código, notas, dirección y negación — 14/10/2026

60 regresiones nuevas con cartas ficticias de pizza/tacos y bowls/bebidas, modelo simulado activo/inactivo. 24 códigos aislados de títulos repetidos (elige cada SKU, cantidad2, precio real, estados building_cart/awaiting_address/awaiting_payment); 4 listas con notas propias por línea; 4 listas con dirección/placa #18-27; 4 rechazos «No con salsa picante»; 8 alternativa «mejor sin picante» disponible/no configurada; 8 SKU homónimos con Salsa y disponible/no disponible; 4 aclaración posterior Salsa Suave preserva cantidad/nota y no se convierte en pago; 4 código con nota y producto por nombre conserva la segunda compra.

Baseline inicial36:32 fallaron4 pasaron (/tmp/ppp-code-boundaries-baseline.log). Primera corrección88 focalizadas aprobadas (/tmp/ppp-code-boundaries-target.log). Negación «sin» adicional8:4 fallaron4 pasaron (/tmp/ppp-negative-sin-baseline.log): nota «sin picante» podía coexistir con Salsa:Picante o volver a pago. Se pide opción válida sin mutar ante rechazo sin alternativa configurada; si la carta tiene Sin Picante se elige esa opción. SKU con atributos/disponibilidad y seguimiento12 aprobados (/tmp/ppp-code-attributes-target.log).

resolveExplicitCodeOrder resuelve códigos a productos sin sustituir identidad por título; admite código único, notas con/sin y separa dirección final antes de resolver. Una cola con «y un/una/dos…» de otro producto vuelve al parser multi normal para no absorber la segunda compra como nota. El orquestador pasa compras explícitas por esta ruta antes de checkout/estado de pedido, con guardas de horario y opciones pendientes; respeta no disponibilidad y usa el guard/carrito existente.

156 focalizadas aprobadas (/tmp/ppp-code-boundaries-final2-target.log); TypeScript aprobado (/tmp/ppp-code-boundaries-final-tsc.log). Global en ejecución /tmp/ppp-code-boundaries-full.log; snapshot src/**/*.ts /tmp/ppp-code-boundaries-source.json. No editar fuentes durante global. Staging desplegado aún c3589adb; cambios locales. Main 49194fec intacta, cero API pagada, 36/40 usadas4restantes.

Límites: no acredita listas arbitrarias mixtas de SKU homónimos por código y productos por nombre, conectores sin cantidad, toda forma de «no/sin», cambio de varios atributos parcialmente negados ni idempotencia de correcciones posteriores. Próxima tanda debe centrarse en opciones pendientes interrumpidas por precio/cambio/negación y regreso al paso, usando recorridos completos reservados de varias cartas. Inferencia y medios reales pendientes; no declarar piloto por conteo ni promover Main automáticamente.


Cierre local de fronteras: 66 suites / 4092 pruebas aprobadas en 412.781 segundos (/tmp/ppp-code-boundaries-full.log), 156 focalizadas y TypeScript final aprobados; snapshot íntegro. 60 regresiones nuevas. Pendiente publicar y desplegar código validado. Main 49194fec intacta, cero API pagada; 36/40 usadas4restantes. Siguiente prioridad: interrupciones con opciones pendientes y retorno al mismo producto, variando cartas y preservando cantidades/notas.


Publicación/despliegue pendientes por conectividad: código validado guardado en commit local a18070ad. Primer push falló DNS github.com; segundo falló conexión443. SSH76.13.119.125 falló No route to host y reintento Connection timed out. Primer intento de despliegue no accedió al servidor (/tmp/ppp-code-boundaries-deploy.log); no acreditar nueva imagen ni salud. Último staging verificado runtime c3589adb,checkout7802e6a6. Main local comprobada49194fec, sin cambios realizados. Reintentar git push origin staging y SOLO después de éxito deploy de staging api y verificar SHA/imagen/health; conservar dist, bin y volúmenes. Las pruebas completas sí terminaron:66/4092,156focalizadas,TypeScript,snapshot íntegro,ceroAPIpagada.


## Recuperación de conectividad y cantidad contextual pendiente — 14/10/2026

La publicación pendiente se completó: origin/staging 1b87be04, runtime de código a18070ad desplegado y verificado el 14/10/2026 a las 09:03 Bogotá. Contenedor running/healthy; imagen activa = candidata sha256:b6ff1404d9bbaac4684699de4a008200faec67da445130679311ce5fd63bf61c. HTTP 3301/api/health ok, DB connected, circuit CLOSED. Evidencia: /tmp/ppp-code-boundaries-retry-deploy.log y /tmp/ppp-code-boundaries-retry-verified.log. Main del servidor 49194fec comprobada intacta. Esto cierra el bloqueo de red anterior; las nuevas correcciones de cantidad todavía no están desplegadas.

32 regresiones nuevas:
- 24 recorridos con Jugo Natural / Gaseosa Artesanal, agente simulado activo/inactivo, compra por nombre/código y nota «sin hielo», consulta de precio antes de «Mejor solo dos» / «Que sean dos por favor» / «En vez de tres quiero dos», consulta de sabores y selección final. Verifican carrito previo conservado, cantidad 2, opción y nota correctas, una sola línea añadida y ninguna orden externa.
- 4 controles: «si mejor solo pido dos cuánto cuestan» cotiza $16.000 para dos unidades sin cambiar las tres pendientes; responder «2» elige el segundo sabor y mantiene cantidad 3.
- 4 cancelaciones después de corregir cantidad: enviar un sabor después no reactiva la compra.

Baseline: 24/24 fallaron por cantidad contextual no actualizada (/tmp/ppp-pending-context-baseline.log). Primera corrección: 84 focalizadas aprobadas (/tmp/ppp-pending-context-target.log). Controles adicionales: 2 fallos / 90 aprobadas (/tmp/ppp-pending-context-final-target.log). La consulta hipotética sin repetir el producto iba al modelo legacy con agente apagado; con agente activo consultaba al modelo sin cotización determinista. Se amplía la guarda de precio pendiente para ese patrón breve y se contesta con precio/cantidad de catálogo sin mutar la compra. No se añadió un mock para ocultar esa falta de ruta.

92 focalizadas finales aprobadas (/tmp/ppp-pending-context-final2-target.log); TypeScript aprobado (/tmp/ppp-pending-context-final-tsc.log). Global en ejecución: /tmp/ppp-pending-context-full.log; snapshot de src/**/*.ts: /tmp/ppp-pending-context-source.json. No editar fuentes durante el global. Cambios locales; staging runtime a18070ad, Main 49194fec intacta. Cero API pagada; 36/40 usadas, 4 restantes.

Límites: estos patrones no cubren todas las paráfrasis, precios de opciones extra, corrección simultánea de cantidad+sabor, cambio a un nuevo SKU durante selección, referencias a varias compras pendientes ni evaluación con audio original. Siguiente: comparar cambio de cantidad frente a «otra/una más», resolver varios atributos y cotizaciones hipotéticas con otro producto nombrado. Crear recorridos reservados de varias cartas; luego inferencia/medios representativos dentro del saldo. No declarar piloto por conteo ni promover Main automáticamente.


Cierre local contextual: 66 suites / 4124 pruebas aprobadas en 414.823 segundos (/tmp/ppp-pending-context-full.log), 92 focalizadas y TypeScript final aprobados; snapshot íntegro. 32 regresiones nuevas. Pendiente publicación/despliegue de este código. Main 49194fec intacta; cero llamadas pagadas, 36/40 usadas, 4 restantes.


Staging verificado el 14/10/2026 a las 09:15 Bogotá: runtime 7ae76bf3, running/healthy, imagen activa = candidata sha256:f1994453cb9241b51b37367465266803dc894a238241bcab74c7a74948d82548. HTTP3301/api/health ok, DB connected, circuit CLOSED. Evidencia: /tmp/ppp-pending-context-deploy.log y /tmp/ppp-pending-context-verified.log. Main local y servidor 49194fec comprobadas sin cambios. 32 regresiones nuevas; 66 suites / 4124 pruebas, 92 focalizadas y TypeScript aprobados; fuente íntegra; cero API pagada. La conectividad pendiente anterior queda resuelta. Próxima tanda: sustituir frente a incrementar cantidad, varios atributos, consultas con otro producto y recorridos reservados. Mantener staging; no promover Main automáticamente.


## Reemplazo frente a incremento y atributos en un turno — 14/10/2026

40 regresiones nuevas, con agente simulado activo/inactivo y cartas ficticias:
- 20 recorridos de Jugo Natural / Gaseosa Artesanal: tres unidades pendientes; «que sean dos» deja dos, «añade dos más» deja cinco, «una más por favor» deja cuatro; reemplazo/incremento con sabor en el mismo turno resuelven cantidad y sabor. Conservan nota «sin hielo», carrito previo de dos Bowl Vegetal y una sola línea de bebida; ninguna orden externa.
- 4 consultas «si añado dos más cuánto cuestan»: informa $16.000 por las adicionales y $40.000 por cinco unidades, sin modificar las tres pendientes ni el carrito.
- 8 límites: añadir 28 a las tres pendientes o añadir cero no muta el pedido y aclara el rango 1–30.
- 8 recorridos Jugo De Avena / Bebida De Citricos: cantidad con Sabor y Endulzante en un turno. La selección explícita Stevia reemplaza Azucar previamente aplicado por defecto; se conserva la nota y se añade una sola línea.

Baseline de 24: 18 fallaron, 6 pasaron (/tmp/ppp-pending-increment-baseline.log). Primera corrección: 64 focalizadas aprobadas (/tmp/ppp-pending-increment-target.log). Límites: 72 aprobadas (/tmp/ppp-pending-increment-final-target.log). La primera fixture multia atributo suponía que Relleno/Salsa obligaban a preguntar: en este catálogo esos atributos se completan por defecto, así que no era una compra pendiente. Se ajustó la fixture a bebidas con Sabor que requiere elección, sin cambiar esa política para hacer pasar un test. Esto deja como frontera de Kamppo configurar obligatoriedad/defaults por catálogo, más allá de inferencias por nombre de atributo/producto.

El recorrido de bebidas con varios atributos reprodujo la retención incorrecta de Endulzante:Azucar pese a pedir Stevia (/tmp/ppp-pending-increment-final3-target.log). Primer intento de mezclar todas las opciones en selected antes del resolver eliminaba la progresión pendiente y falló (/tmp/ppp-pending-increment-final4-target.log). Corrección final: reemplazar solo elecciones ya presentes; los atributos nuevos pasan por el resolver habitual. No se añaden directamente productos ni se bypassan guardas.

96 focalizadas finales aprobadas (/tmp/ppp-pending-increment-final5-target.log); TypeScript aprobado (/tmp/ppp-pending-increment-final2-tsc.log). Global en ejecución: /tmp/ppp-pending-increment-full.log; snapshot src/**/*.ts: /tmp/ppp-pending-increment-source.json. No editar fuentes durante el global. Cambios locales; runtime staging 7ae76bf3, Main 49194fec intacta. Cero API pagada; 36/40 usadas, 4 restantes.

Límites y siguiente: esta tanda acredita la selección de atributos pendiente, no incrementos referidos a varias líneas ya compradas o a todas las compras de una cola. Faltan cantidad+opción inválida, nota nueva con cantidad, referencias «las otras», decrementos y preguntas sobre precios con opciones extra. Priorizar recorridos reservados completos en otras cartas e inferencia focalizada dentro del saldo disponible; no declarar piloto por conteo ni promover Main automáticamente.


Cierre local de incremento: 66 suites / 4164 pruebas aprobadas en 764.342 segundos (/tmp/ppp-pending-increment-full.log); 96 focalizadas y TypeScript final aprobados; snapshot íntegro. 40 regresiones nuevas. Pendiente publicar/desplegar esta versión. Main 49194fec intacta; cero API pagada, 36/40 usadas, 4 restantes.


Staging verificado el 14/10/2026 a las 09:40 Bogotá: runtime 03c89636, running/healthy, imagen activa = candidata sha256:41513d66d09e395c088280a63a5762d05c7a133e4927f774ca7511be474d3a1d. HTTP3301/api/health ok, DB connected, circuit CLOSED. Evidencia: /tmp/ppp-pending-increment-deploy.log y /tmp/ppp-pending-increment-verified.log. Main local y servidor 49194fec comprobadas sin cambios. 40 regresiones nuevas; 66 suites / 4164 pruebas, 96 focalizadas y TypeScript aprobados; snapshot íntegro. Cero API pagada. Próxima prioridad: recorridos completos reservados de otras cartas y evaluación focalizada con modelo real dentro de las 4 solicitudes restantes; no convertir el conteo en aprobación de piloto. Mantener staging, no promover Main automáticamente.


## Recorridos completos reservados y diagnóstico con modelo real — 14/10/2026

15 regresiones nuevas:
- 6 recorridos completos en tres cartas ficticias (hamburguesa/jugo, pizza/gaseosa, sandwich/bebida), agente simulado activo/inactivo: precio, compra por código con nota, cotización de incremento mientras espera sabor, incremento+sabor, dirección, cambio de dirección, consulta de total y efectivo hasta awaiting_final_confirm. Verifican cantidades 2+5, notas, precio total $78.500, dirección vigente y ausencia de órdenes externas.
- 6 controles de narración de comensales: sin acciones válidas del modelo, conserva el carrito vacío y pide aclaración; no inventa un ejecutivo ni cantidades. PPP y dos cartas ficticias.
- 3 replays de acciones estructuradas: uno usa la salida real versionada en scripts/fixtures/whatsapp-recorded-narrative-output.json; dos cambian a cartas de curry/pasta/pizza. Verifican cantidades 2/1/3 o 3/1/4 y notas.

Los seis recorridos iniciales fallaron en precio: una pregunta sobre la bebida pendiente respondía el precio del plato del carrito (/tmp/ppp-reserved-flows-baseline.log). Se prioriza el producto pendiente para preguntas sin nombre; un producto nombrado sigue siendo explícito. Después apareció una cola pendingMultiOrder vacía que impedía avanzar al dar dirección (/tmp/ppp-reserved-address-probe2.log): popCompletedNeedsAttribute descarta la cola solo cuando no quedan opciones, productos o desconocidos. El recorrido llegó a pago después de corregirlo.

Evaluación aislada con configuración efectiva de staging y modelo gpt-4.1-2025-04-14: un pedido narrado («somos tres», dos churrascos, un arroz, una limonada para cada uno) primero falló sin API porque la ruta determinista inventaba ejecutivos; tras corregir la inferencia de almuerzo todavía inventaba una bandeja y confundía tres cuartos con cuarto de pollo. Se dirige una nueva compra narrada por comensales al agente antes de segmentación insegura; sin agente/acciones válidas se pide cantidad por producto sin mutar carrito. La introducción «almuerzo: somos…» no es un SKU ejecutivo.

El modelo hizo 3 solicitudes exitosas e interpretó correctamente 2 churrascos / 1 arroz / 3 limonadas, con notas. El backend guardó 1/1/1, por perder el contexto grupal al recortar el texto de cada producto. Informe /tmp/ppp-reserved-model-report.json, log /tmp/ppp-reserved-model-run.log. No se acredita ese ensayo como aprobado: el carrito fue incorrecto. El oráculo también pedía nota literal «3/4», aunque la respuesta decía correctamente «tres cuartos»; los replays verifican el término equivalente y la nota sin ensalada.

Corrección posterior SOLO validada offline: extractQuantityNearProduct reconoce cantidades asociadas a «dos van a comer» y «para cada uno una» con un grupo explícito; resolveAddItemQuantity conserva el texto grupal para esa distribución. Se respetan cantidades respaldadas por el mensaje, sin confiar ciegamente en la IA. No se repitió inferencia después de corregir. La salida real queda como fixture sintética reproducible, sin credenciales ni mensajes externos.

Presupuesto: 39/40 intentos usados, 1 restante. El registro local work/authorized-model-budget.json estaba en 25/40; se sincronizó al versionado más restrictivo antes de gastar y a 39/40 después. docs/whatsapp-model-budget.json y AGENTS.md actualizados. Clave y prompt recuperados del contenedor en memoria, nunca impresos ni guardados; launcher temporal eliminado. No cambiar modelos. No nuevas llamadas sin revisar el saldo; una llamada restante no garantiza completar un turno con tools.

233 focalizadas generales/named-menu aprobadas (/tmp/ppp-reserved-flows-broader-target.log). Tras convertir la captura real a fixture, 15 nuevas aprobadas (/tmp/ppp-reserved-flows-recorded-target.log), TypeScript final aprobado (/tmp/ppp-reserved-flows-recorded-tsc.log). Global en ejecución /tmp/ppp-reserved-flows-full.log, snapshot src/**/*.ts /tmp/ppp-reserved-flows-source.json. No editar fuentes durante global. Staging runtime03c89636; Main49194fec intacta; cambios nuevos aún locales.

Límites: esta tanda acredita los recorridos descritos y aplicación de las acciones capturadas. No acredita segunda ejecución pagada, todos los pedidos narrados, todos los grupos/alias/typos, cantidades incoherentes ni todas las formas de «cada uno». Las narraciones existentes en checkout/carrito previo siguen siendo frontera. Las conversaciones reservadas que fallaron y guiaron una corrección pasan a regresión; dejan de ser evaluación independiente. Crear otra muestra reservada y probar inferencia representativa antes de declarar piloto. Referencia de metodología consultada con OpenAI Docs: https://developers.openai.com/api/docs/guides/evaluation-best-practices.


## Integración de cambios concurrentes, consultas inesperadas y cobertura — 14/10/2026

La ejecución anterior /tmp/ppp-reserved-flows-full.log terminó con 26 fallos y 4153 aprobadas, pero la fuente cambió durante la ejecución; no acredita la versión integrada. Se preservaron los cambios concurrentes de saludo, reparto por persona, reparto incoherente, pedido previo, selección del más barato y consultas ajenas. Las regresiones de precio revelaron una prioridad demasiado amplia del atributo pendiente: se restringe a consultas por unidad o cantidades hipotéticas; el precio general del carrito y las listas de precios conservan su comportamiento.

Familias añadidas en esta integración: 36 interrupciones en nombre/teléfono/dirección/pago/confirmación/sabor, 16 favores externos con cortesía/typos, 12 consultas de cobertura y 24 preguntas no previstas. Agente simulado activo/inactivo, cartas sintéticas, estado y sesión completos sin mutación, opciones pendientes conservadas y ninguna orden externa. El agente no puede aplicar addItems, clearCart, notas ni lookupPlacedOrder cuando responde estas consultas. La guarda se ejecuta antes de las consultas externas y la aplicación de acciones. Se usa un recordatorio del paso pendiente, sin repetir el carrito entero.

Cobertura: con cuatro productos ya en el carrito, la respuesta recuerda esos cuatro y permite continuar; no invita a iniciar un pedido vacío. La cotización se calcula sobre una copia y no cambia la dirección guardada. El caso no autoriza cambiar domicilio ni cantidad. Con carrito vacío mantiene la invitación a pedir; con sabor pendiente conserva esa elección. No se redefine aquí el timeout de sesión ni se interpreta un nuevo pedido ambiguo como reemplazo automático.

Revisión de respuestas encontró falsos platos en «somos cuatro», «cada uno quiere» y «para cada uno de nosotros»: cantidades correctas, pero texto de error incorrecto. Se descartan únicamente las cláusulas estructurales del reparto explícito y se fortalecen los ocho recorridos de cartas diferentes para exigir ausencia de «no tenemos/no manejamos». Los productos desconocidos siguen sujetos a validación.

291 focalizadas aprobadas (/tmp/ppp-context-integration-target7.log); TypeScript aprobado (/tmp/ppp-context-integration-tsc7.log). Global en ejecución: /tmp/ppp-context-integration-full.log; snapshot de src/**/*.ts: /tmp/ppp-context-integration-source.json. No editar fuentes durante el global; comparar snapshot antes de acreditar resultado. Código aún local, runtime staging03c89636. Main49194fec intacta. Sin nuevas llamadas pagadas: 39/40 usadas, 1 restante; no alcanza para asegurar un turno con tools completo.

Pendientes posteriores: otra muestra reservada independiente con reparto/narración y preguntas fuera del flujo; validación real del carrito 2/1/3 corregido offline; audio original representativo cuando esté disponible; cobertura dudosa y confirmación expresa de destino, sesión expirada frente a pedido nuevo. Las pruebas con agente simulado no acreditan comprensión real universal. No promover Main automáticamente ni declarar vendible por cantidad de pruebas.


Global integrado inicial: 65 suites aprobadas/1 fallida; 4431 pruebas aprobadas/14 fallidas, 4445 totales, 442.47s (/tmp/ppp-context-integration-full.log). Fuente estable. La ruta genérica de pregunta inesperada capturaba cambios de acompañamiento («cambien»), alergia e interrogantes sobre sopa; además el mock de modelo devolvía «¿Cuál prefieres?» para instalaciones conocidas. Se restringe el detector para preservar contexto de comida/alergia y formas de cambiar; las instalaciones conocidas vuelven al handler determinista, con recordatorio breve del pedido y sin carrito completo ni llamada al modelo. Se conserva la expectativa previa de responder con referencia al local; la nueva prueba acredita que esa vía no usa el agente. No se reduce la cobertura de los tests de acompañamientos/alergia.

362 focalizadas finales aprobadas (/tmp/ppp-context-integration-target8.log) y TypeScript aprobado (/tmp/ppp-context-integration-tsc8.log). Nueva ejecución global /tmp/ppp-context-integration-final-full.log, snapshot /tmp/ppp-context-integration-final-source.json. No desplegar ni acreditar resultado hasta final verde y fuente estable.


Cierre local integrado:66 suites /4445 pruebas aprobadas en451.396s (/tmp/ppp-context-integration-final-full.log),362 focalizadas y TypeScript aprobados; snapshot src/**/*.ts íntegro. Son281 nuevas pruebas respecto al último global4164. La primera global integrada falló14 y no se acredita; la ejecución final cubre las regresiones corregidas. Pendiente publicación/despliegue staging. Main49194fec intacta. No se repitió evaluación pagada;39/40 usadas,1 restante.


Publicado staging a7930a70 y API reconstruida. Imagen activa igual a candidata sha256:108c01aa6275a6f1fac55fcfe9d97968ae9c3c523645394d94e15009dcd37681. HTTP3301/api/health ok, DB connected, circuit CLOSED; Docker running/healthy comprobado el14/10/2026 a las11:42 Bogotá. Main servidor49194fec intacta. Evidencia /tmp/ppp-context-integration-deploy.log y /tmp/ppp-context-integration-verified.log.


## Cantidades después de cobertura y referencias cortas — 14/10/2026

72 regresiones nuevas, cartas ficticias de sopa/pizza/ramen, agente simulado activo/inactivo y router completo:
-36 recorridos con cuatro unidades y otro producto: consultar cobertura sin cambiar destino, añadir una, dejar solo una, reconsiderar dos en total, quitar una, consultar precio e hipotético de añadir una. Conservan nota, otro producto y no crean órdenes externas.
-18 controles de incremento: cero, total mayor de30 y dos líneas del mismo producto con notas distintas. No mutan; rechazan rango o piden precisar la línea.
-18 referencias cortas: «Mejor solo una» reemplaza cuatro por una, «Una más por favor» incrementa a cinco, dos líneas posibles obligan a aclarar. Se conserva nota y no se invoca orden externa.

Baseline36:18 fallos (/tmp/ppp-after-coverage-baseline.log). «Agrega una más» añadía una segunda línea con nota «más por favor»; «Quita una» borraba toda la línea; un hipotético nombrado perdía el plato. Correcciones: incremento explícito sobre una línea inequívoca usa cantidad absoluta con límites; la eliminación reconoce «una PLATO» como una unidad; la consulta hipotética extrae el nombre sin comprar. Se comprobó que la normalización previa convierte «agrega» a «quiero», por eso el incremento reconoce ambos, solo con «más» explícito.

Baseline de referencias cortas18/18 falló (/tmp/ppp-after-coverage-short-baseline.log). «Solo una» se confundía con variante sin combo; se prioriza exclusivamente la corrección corta de unidades antes de cambio de variante. Si faltan opciones de otra compra, no se asigna esa referencia a un plato del carrito. No inferir el referente entre varias líneas.

78 focalizadas aprobadas (/tmp/ppp-after-coverage-target5.log),24 controles de eliminación aprobados (/tmp/ppp-after-coverage-removal.log),TypeScript aprobado (/tmp/ppp-after-coverage-final2-tsc.log). Global en ejecución /tmp/ppp-after-coverage-full.log, snapshot /tmp/ppp-after-coverage-source.json. No editar src durante la ejecución; comprobar snapshot antes de acreditar. Código local; runtime staging a7930a70, Main49194fec intacta. Cero nuevas solicitudes API;39/40 usadas,1 restante.

Límites: no acredita todas las expresiones de decremento, incrementos compuestos con notas nuevas, selección posterior de la línea ambigua ni nueva inferencia real. Siguiente: «dos menos», incremento/corrección más opción o nota en un turno, conservación de compra pendiente al modificar otra línea y sesión expirada frente a nuevo pedido. No declarar piloto por conteo ni promover Main sin solicitud.


Cierre local de cantidades tras cobertura:66 suites/4517 pruebas aprobadas en447.558s (/tmp/ppp-after-coverage-full.log); snapshot íntegro.72 nuevas pruebas;78 focalizadas,24 controles de eliminación y TypeScript aprobados. Pendiente publicación/deploy. Main49194fec intacta. Cero API nueva;39/40 usadas,1 restante.


Staging verificado el14/10/2026 a las11:59 Bogotá: runtime5654678e, running/healthy, imagen activa=candidata sha256:e75ce770c25c87ce84cca3802dd51e88d220d97a6497cbe7dfc5b81ff19f87c5. HTTP3301/api/health ok, DB connected, circuit CLOSED. Evidencia /tmp/ppp-after-coverage-deploy.log y /tmp/ppp-after-coverage-verified.log; el primer chequeo Docker starting se completó como healthy antes de cerrar. Main local/servidor49194fec comprobadas intactas.72 regresiones nuevas,66 suites/4517 pruebas,78 focalizadas,24 controles de eliminación y TypeScript aprobados. Fuente estable. Cero API nueva,39/40 usadas,1 restante. Próxima tanda: decremento «dos menos», cantidad con opción/nota nueva, edición de otra línea sin perder compra pendiente.


## Decrementos y edición sin perder otra compra — 14/10/2026

64 pruebas nuevas con router real, modelo/Meta/persistencia simulados, cartas ficticias y agente activo/inactivo:
-12 recorridos con cuatro platos y tres bebidas pendientes de Sabor: corregir cantidad absoluta o quitar una unidad del plato conserva pendingAttribute y estado awaiting_attribute; responder Lulo después añade tres bebidas con nota sin hielo.
-12 decrementos explícitos («dos menos de PLATO», «quita dos unidades de PLATO») dejan dos de cuatro, conservando nota.
-8 recorridos de cantidad+sabor+nota en un turno: «Mejor solo dos con Lulo y sin hielo» o «Una más con Lulo y sin hielo»; conservan sin azúcar de la compra inicial y añaden sin hielo, sin duplicar producto.
-24 controles: cero, quitar más unidades de las anotadas, quitar todas las unidades y referente ambiguo. Conservan otras líneas; rechazan rango/referencia cuando corresponde.
-4 controles de nota inicial válida al elegir sabor.
-4 controles de eliminación completa con nombres que incluyen números (1 Pollo Frito, Dos Empanadas). El número del nombre no es la cantidad a retirar.

Baseline válido de32 casos falló32 (/tmp/ppp-decrement-pending-baseline2.log). La primera fixture no compiló por poner note en pendingAttribute, cuyo contrato guarda notas en sourceText; no se acredita ese intento como ejecución de casos. Se ajustó a sourceText. Para la nota inicial se usa «sin azúcar» y controles de selección normal, sin suponer que una nota desconocida está soportada.

Correcciones: los decrementos explícitos se convierten en cantidad absoluta o eliminación completa con las guardas existentes; rechazan negativos/cero/exceso o múltiples líneas posibles. Edición y eliminación de una línea conservan una compra pendiente de atributos de otro SKU, con recordatorio de sabor. Cantidad+sabor ahora incorpora la nota detectada al sourceText de la compra pendiente antes de continuar por el resolver de opciones. No se modificó el modelo ni se aplicaron excepciones PPP.

136 focalizadas aprobadas (/tmp/ppp-decrement-pending-target3.log), TypeScript aprobado (/tmp/ppp-decrement-pending-final2-tsc.log). Global en ejecución /tmp/ppp-decrement-pending-full.log; snapshot src/**/*.ts /tmp/ppp-decrement-pending-source.json. No editar fuentes hasta finalizar y comparar snapshot. Código aún local; runtime staging5654678e. Main49194fec intacta. Cero nuevas llamadas pagadas;39/40 usadas,1 restante.

Límites: conserva otra compra con pendingAttribute de SKU diferente; no acredita edición de una línea frente a otra compra del mismo SKU ni todos los pendingMatch/pendingMulti. Los decrementos cubren las dos formas explícitas, no «menos dos» sin producto ni pedidos colectivos. Pendiente otra muestra independiente y modelo/canal reales; no declarar piloto por conteo.


Cierre local de decrementos y compra pendiente:66 suites/4581 pruebas aprobadas en447.724s (/tmp/ppp-decrement-pending-full.log),snapshot src íntegro.64 regresiones nuevas;136 focalizadas y TypeScript aprobados. Pendiente publicar/desplegar. Main49194fec intacta. Cero API nueva;39/40 usadas,1 restante.


Staging verificado el14/10/2026 a las12:30 Bogotá: runtime73419c8f, running/healthy, imagen activa=candidata sha256:10a9dee121243376dd52f7f755251aa25f722eed475cbb4c66904201bb720306. HTTP3301/api/health ok,DB connected,circuit CLOSED. Evidencia /tmp/ppp-decrement-pending-deploy.log y /tmp/ppp-decrement-pending-verified.log; primer Docker starting confirmado healthy antes de cerrar. Main local/servidor49194fec intactas.64 regresiones nuevas;66 suites/4581 pruebas,136 focalizadas,TypeScript y snapshot aprobados. Cero API nueva;39/40 usadas,1 restante. Próxima tanda: edición frente a otra compra del mismo SKU, pendingMatch/pendingMulti y referencias ambiguas con correcciones; no promover Main automáticamente.
