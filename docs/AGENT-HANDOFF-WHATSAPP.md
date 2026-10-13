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
