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
