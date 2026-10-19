## Actualización: decimosexta tanda cerrada (19/10)

274 tests nuevos acumulados y ocho existentes fortalecidos. Bloque nuevo: 32 conversaciones y 24 contratos de destino/contexto. Corrige retorno explícito al destino guardado y dirección+nota alimentaria; verifica seis recorridos completos y controles de ausencia de histórico/cantidad incompatible. 56 focalizados, TypeScript/build, 92 Node y global 101/9.644 aprobados, 395 hashes intactos. La nueva cantidad de suites procede de partición: 7.611 tests históricos idénticos en 12 archivos, no cobertura nueva. Global pasa de 21m37s a 6m31s con partición y cuatro workers. No todos los chats PDF están acreditados, ni mapas/modelos reales. Evidencias whatsapp-accuracy-partition-1910.json y whatsapp-destination-block-validation-1910.json.

## Actualización: decimoquinta tanda cerrada (19/10)

218 tests nuevos acumulados y ocho existentes fortalecidos. Ocho recorridos de nueva dirección, consulta/edición del carrito, cierre sin reofrecer destino descartado, afirmación sin calle, unidad antes de calle y DTO con nueva tarifa. 64 focalizados, TypeScript, 92 Node, global 88/9.588 y 379 hashes intactos. Cero API pagada. No todos los chats cubiertos. Nueva cadencia: bloques amplios y partición del archivo gigante antes de continuar con tandas pequeñas.

## Actualización: decimocuarta tanda cerrada (19/10)

210 tests nuevos acumulados y ocho existentes fortalecidos. Ocho recorridos nuevos de cobertura durante pago/confirmación, dos menús: consultas de dirección alternativa dentro/fuera de cobertura, invariancia de destino/tarifa/carrito/estado, total y posterior cambio explícito hasta DTO. Mejora de respuesta para indicar destino conservado y retomar cierre tras consulta negativa. 125 focalizados y TypeScript aprobados; no nueva global por plantilla sin cambios de decisiones/persistencia. Global lógica vigente 88/9.572; no incluir las ocho nuevas en ese conteo. Evidencia whatsapp-coverage-checkout-validation-1910.json. Quedan «a una nueva» y fragmentos separados; no todos los chats del PDF reproducidos.

## Actualización: decimotercera tanda cerrada (19/10)

202 tests nuevos acumulados y ocho existentes fortalecidos. 24 conversaciones nuevas de interiores antes del destino, dos menús, agente simulado on/off, antes/durante checkout y tres formas de completar dirección. Se conserva pendiente sin cotizarlo, se consume con calle/pin y se descarta ante unidad explícita nueva. Final 68 focalizados, TypeScript, 92 Node y global 88/9.572, 379 hashes intactos. Evidencia whatsapp-unit-before-street-validation-1910.json. Mapas/modelos simulados. D sigue abierto para cobertura, rechazo de dirección anterior y unidades en burbujas separadas; no todos los chats del PDF están reproducidos. Conteos inferiores históricos.

## Actualización: duodécima tanda cerrada (19/10)

178 tests nuevos acumulados y ocho existentes fortalecidos. Esta tanda añade 16 recorridos de reemplazo de apartamento/interior durante pago/confirmación, dos menús, agente simulado on/off y DTO final. Reproduce duplicación de unidades y pérdida de calle; corrige reemplazo por componente sin confirmar orden. Primera global detectó dos regresiones de formato, reparadas. Final: 46 focalizados, TypeScript, 92 Node y global repetida 88/9.548, 379 hashes intactos. Evidencia whatsapp-unit-replacement-validation-1910.json. Despliegue agrupado pendiente. D sigue abierto para complementos sin base, consultas y otros caminos; no todos los chats del PDF reproducidos. Conteos inferiores históricos.

## Actualización: undécima tanda cerrada (19/10)

162 tests nuevos acumulados desde esta auditoría, además de ocho existentes fortalecidos. Esta tanda añade ocho conversaciones de referencias de acceso en pago/confirmación con dos menús: conserva destino y carrito, no duplica referencia y no aprueba prematuramente. Baseline ocho fallos; 28 focalizados, TypeScript, 92 Node y global 88/9.532 aprobados, 379 hashes intactos. Evidencia whatsapp-access-reference-validation-1910.json. Todo simulado; D sigue pendiente para reemplazo de apartamento, complemento sin base y cobertura. No todos los chats del PDF reproducidos; los conteos inferiores son históricos.

## Estado de cobertura revisado — 19/10

Las 60 páginas están leídas y sus patrones inventariados. No se han reproducido todas las conversaciones completas ni cerrado todos los fallos. Diez tandas posteriores a la auditoría están cerradas, con 154 tests nuevos. Las seis primeras sumaron 104: ETA 16; datos del comercio 45; acompañamientos reducidos 21; combo/fracción adicional 6; edición de adicionales 8; recuperación de faltantes 8. La tanda de acompañamientos viene de un chat nuevo del usuario y amplía la familia E; no es replay literal del PDF.

Séptima tanda validada: fortalece los ocho tests de faltantes para retomar confirmación sin «Algo más». No añade ocho tests nuevos. Global repetida aprobada: 88 suites / 9.474 tests, 379 hashes intactos. La corrida previa se interrumpió y no se acredita. No confundir publicación con despliegue.

Octava tanda: 16 conversaciones nuevas de sustitución de adicional (pago/confirmación, dos menús, dos formulaciones, agente simulado on/off), rechazo de reemplazo inexistente y cierre hasta DTO. 72 focalizados y TypeScript aprobados; sin cambios de runtime ni nueva global.

Novena tanda D: 13 tests nuevos de datos completos/secuenciales y destinatario explícito, dos menús sintéticos, corrección tardía de calle y DTO. Primera global detectó 20 regresiones; reparación aprobada en 125 focalizados, TypeScript, 92 Node y global 88/9.503 con 379 hashes intactos. No mide mapas reales ni todas las formas de envío fragmentado.

Décima tanda D2: 21 tests nuevos (ocho conversaciones completas, trece contratos de unidades alfanuméricas). Reproduce pérdida de calle al enviar Torre B/apto 304B y orden prematura al añadir unidad durante confirmación; ambos corregidos. Incluye cambio de calle que descarta interiores anteriores, repetición de complemento y DTO. 41 focalizados, TypeScript, 92 Node y global 88/9.524, 379 hashes intactos. Mapas simulados; no acredita precisión real ni cambio de solo apartamento.

A y el subconjunto probado de B tienen evidencia cerrada. C cubre sustitución, cantidades, faltantes y rechazo de reemplazo inexistente; no acredita todas las ambigüedades, opciones ni formulaciones posibles. D/E tienen cobertura histórica y correcciones recientes, pero aún no una matriz completa trazable contra todas las conversaciones del PDF. F sigue pendiente como tanda de este set. Tampoco se han evaluado los medios originales omitidos ni un conjunto reservado con modelo real en estas tandas gratuitas.

Hay 73 archivos históricos de evidencia de validación en docs al revisar; no equivalen a 73 tandas independientes ni todas proceden del PDF. El total global actual acreditado es 88 suites / 9.524 tests, incluyendo las tandas anteriores de solo pruebas. No sumar ejecuciones repetidas como tests nuevos.

La automatización continuar-pruebas-de-ppp-en-staging fue eliminada por petición del usuario. Continuar manualmente: completar destinos/cierre; ampliar variantes ambiguas; cubrir postorden; evaluación reservada y piloto supervisado. No declarar vendible por conteos.

# Auditoría del PDF chats 18_10 — 18/10/2026

## Alcance y evidencia

Fuente local privada: `/home/levi/Downloads/chats 18_10.pdf`, 60 páginas. Se leyó todo el texto extraído y se revisaron visualmente las páginas 1, 38 y 39 para corroborar los fallos del bot. Extracción temporal: `/tmp/ppp-chats-1810-new.txt`. No se incorporan teléfonos, nombres de clientes, datos de transferencia ni conversaciones íntegras a Git. Los fixtures usan datos sintéticos.

El documento mezcla atención humana, conversaciones del bot, fechas distintas y duplicados. No son 60 conversaciones independientes ni toda respuesta del local es un comportamiento correcto. Imágenes, audios y pagos referidos no incluyen sus originales: no permiten evaluar OCR, transcripción ni verificación de pagos. Los resultados descritos son observaciones del documento; solo la tanda ETA indicada abajo está reproducida contra la fuente actual en esta auditoría.

## Lo que funciona en las conversaciones

- Varios pedidos completos terminan con productos, dirección, contacto y pago correctos; el vocabulario natural puede conducir a una venta sin códigos.
- La corrección explícita de un faltante permite recuperar pedidos. El objetivo debe ser reconocerlo inicialmente y que la recuperación no duplique lo ya agregado.
- El cliente suele dar datos en ráfagas y responde opciones con una palabra. Las opciones compartidas y referencias al último plato son parte normal del lenguaje, no casos excepcionales.
- La atención humana resuelve abreviaturas, explicaciones y sustituciones con contexto; también se equivoca al interpretar cantidades, conjuntos homónimos y fracciones. No copiar esas equivocaciones como oráculo.

## Inventario completo de patrones por páginas

### 1–10: integridad del pedido y contexto

En 1–2 el bot omite el medio pollo adicional al combo de arroz; lo agrega tras repetición. Es una conjunción de dos productos, no un atributo del combo. Hay actualización de contacto y confirmación que sí llegan al cierre.

En 3–10 aparecen ráfagas de producto, opciones, dirección y cortesía; compra más consulta de precio en una frase; «solo el pollo» excluye el artículo consultado. Nombre y teléfono pueden llegar sin etiquetas junto a una dirección. Dos pollos comparten arepas y cocción. Preguntar por puntos futuros no acredita saldo ni premio disponible. Medio pollo en caja separada es empaque, no otro medio pollo. Portería/habitación son complementos; por sí solos no ubican un destino.

### 11–20: consultas, fracciones y correcciones

Unidades compactas, errores fonéticos, código aislado y sabor en la siguiente burbuja. «Pollo y medio», «medio pollo», «tres cuartos» y «cuatro pollos» no son intercambiables. Urgencia o reclamo de demora no es nueva compra. Preguntas de datáfono no habilitan capacidades inexistentes. Precio y tiempo pueden interrumpir la selección de bebida. «Seco», «gordita» y referencias a una preparación anterior son notas. El documento repite un bloque de sobrebarriga: deduplicarlo, no contar doble cobertura.

### 20–30: destinos y terceros

Un conjunto homónimo puede quedar en otro barrio: calle y ciudad explícitas deben prevalecer sobre el lugar conocido más cercano. «Mi esposo pasa» implica recoger aunque se mencione el conjunto de residencia. Nombre del pagador puede diferir del destinatario. Número de orden web es seguimiento, no código del catálogo. «Pepsi» corregido en mensajes sucesivos modifica una bebida pendiente. Reclamar un precio anterior no agrega productos. Un número preguntado como cuenta/Nequi del comercio no debe convertirse en teléfono del cliente.

### 31–37: cambios y confirmación

Convertir un producto en combo y quitar un extra debe conservar lo demás. Rechazar dirección guardada seguido de un nuevo destino reemplaza, no concatena. «Cancelar por Nequi» puede significar pagar, no anular. «¿A nombre de quién sale el pago?» consulta el titular del comercio; no renombra al destinatario. Pedidos futuros requieren capacidad y horario reales, sin promesas inventadas. Preguntas alrededor de la confirmación no equivalen necesariamente a aprobar la orden.

### 38–44: bot y cierre

En 38–39 el bot conserva interiores pero pregunta de más al recibir dirección; luego clasifica «se demoran» como producto no disponible. El cliente también copia preguntas del bot y añade su respuesta: separar cita de información nueva. Domicilio, atención en local y consulta de ubicación son intenciones distintas. Preguntas sobre personal no autorizan inventar empleados/turnos. Ejecutivos distribuidos uno frito/otro broaster y sopas una/otra deben conservar dos unidades y opciones compartidas. «Dos de estas» requiere imagen o referente disponible.

### 44–50: edición de datos y pedidos grandes

Un número corto después de apartamento puede corregir la unidad, no cantidad/código. Transferencia por un tercero y titular de cuenta no cambian nombre/contacto sin intención explícita. No inferir gratis una sustitución. Dos sopas adicionales durante selección de bebida no deben perderse. Listas de cantidades con dirección y unidades deben sumar exactamente lo pedido. «Dos combos con un pollo completo» puede tener alcance ambiguo: preguntar solo si es total o por combo. Reclamos de demora necesitan estado real, no una nueva estimación fabricada.

### 50–60: recuperación y negación

Cuenta citada con «¿es este?» no actualiza contacto. Corrección de apartamento después de orden creada necesita actualización real o coordinación, no afirmar persistencia ficticia. Repetir una frase en el mismo mensaje no necesariamente duplica compra. Reclamos por alimento/entrega son soporte. «Yuca tampoco» conserva la primera exclusión. «Cuatro de pollo» podría ser transcripción de cuarto: usar contexto, aclarar si permanece ambiguo. Coca/Zero/Tiene/Esa en ráfaga resuelve opción pendiente. Efectivo con billete de 60 mil es dato de pago, no cantidad. Hay bloques repetidos con y sin timestamps: deduplicar.

## Contratos generales que debe cumplir el bot

1. Separar intención de comprar, consultar, corregir, pagar y reclamar antes de interpretar cantidades.
2. Representar producto, cantidad, variante, nota de preparación, empaque, destino y contacto por separado.
3. Conservar todos los componentes inequívocos de un pedido; preguntar únicamente por lo ambiguo. No convertir acompañante en producto independiente sin evidencia.
4. Resolver interrupciones y retomar el paso pendiente. Nunca guardar una pregunta como nombre, dirección u opción.
5. Dirección estructurada: calle/número para localizar, conjunto como referencia, torre/interior/apartamento como entrega. Una calle explícita nueva reemplaza la anterior.
6. Con producto y datos de entrega completos avanzar a pago o confirmación, sin volver a «algo más». Solicitar únicamente datos realmente faltantes.
7. Diferenciar datos del comercio, del pagador y del destinatario; los números no son universalmente contacto ni código.
8. Respuestas y orden persistida deben coincidir. No decir «agregué/cambié/confirmé» sin operación efectiva.
9. Confirmar una sola vez y permitir consultas/correcciones antes del cierre; tras creación no simular cambios que no llegaron a la orden.

## Tandas y prioridad

### A — ETA coloquial (validada en esta revisión)

16 recorridos completos: dos menús ficticios, pago/confirmación, cuatro expresiones; 12 fallos iniciales y cuatro controles verdes. Corrección general de plural/futuro de «demorar», sin productos o IDs específicos. Verificar respuesta de tiempo, sesión/nombre/carrito intactos, pago posterior, confirmación única y DTO de dos unidades con notas. Modelos, Meta y órdenes simulados. No mide latencia real de entrega.

### B — datos de transferencia frente a contacto (siguiente)

Probar «este es el Nequi?», cuenta citada con número, «a nombre de quién sale», pagador tercero, «mi teléfono es», nombre+teléfono+pago juntos y corrección posterior. Matriz de estados pago/confirmación/orden cerrada, con y sin pedido. Afirmar ausencia de mutación para preguntas y actualización solo con intención explícita.

### C — integridad de combo más adicionales

Replay sanitizado de páginas 1–2: combo con sabor y medio producto extra. Variar pizzas, sushi, bowls y parrilla; productos con bebida incluida frente a bebida separada; empaque de media unidad frente a media unidad adicional. Añadir consultas de precio intercaladas, negación de extra y corrección de faltante. Verificar cantidades y DTO, no solo texto positivo.

### D — destino y cierre completo

Conjunto homónimo más calle explícita, interiores antes/después de calle, rechazo de dirección antigua, burbujas de cortesía entre datos, cita del bot, actualización de unidad corta y recogida por tercero. Probar producto+todos los datos en un solo mensaje y en ráfagas. Reproducir calle posterior a unidad y asegurar que no se pierde al cotizar.

### E — fracciones, opciones y notas

Pollo y medio, tres cuartos, dos unidades con opciones distintas, atributos compartidos y modificaciones parciales; sabores por referencia. Variar menús sin depender de palabras de PPP. Notas de preparación/empaque no se vuelven productos; cambios no eliminan notas previas pertinentes.

### F — después del cierre y alcance comercial

Demora de pedido existente, corrección posterior, reclamo de calidad, cuenta de pago, puntos futuros y pedidos programados. Usar servicios simulados con capacidades explícitas; no prometer funciones inexistentes. Acreditar idempotencia y que una consulta no crea otra orden.

## Criterio para piloto

Cada familia debe tener recorrido completo con estado, respuesta, carrito y DTO, negativos ambiguos y varios menús. Mantener casos reservados no usados al modificar reglas. Luego una evaluación acotada con modelo y medios reales, autorizada y contabilizada por separado, y piloto supervisado con recuperación humana. La lectura de todo el PDF no significa que todos los fallos estén corregidos; tampoco los conteos de pruebas acreditan que sea vendible.

Validación final de A: 38 focalizados, TypeScript, 92 Node y global 88 suites / 9.386 pruebas aprobadas; 379 hashes intactos. Corrección local para publicar en staging; deploy diferido para agrupar con siguiente tanda. Cero llamadas pagadas y órdenes externas.

## Avance de tanda B: datos del comercio (siguiente revisión)

45 pruebas nuevas reproducen preguntas de cuenta/titular en pago y confirmación, dos menús y agente simulado on/off; 16 fallos iniciales. Se responde desde configuración, sin mutar identidad, carrito, estado ni método. No se valida titularidad bancaria. Mensajes con compra/cambio/contacto explícitos se dejan al router normal, y cinco contratos de helper protegen esa frontera; no equivalen a recorridos completos de todas las mezclas. 67 focalizados, TypeScript y 92 Node aprobados; global 88 suites / 9.431 pruebas, 379 hashes intactos.
