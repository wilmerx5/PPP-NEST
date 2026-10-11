# Próximas tandas de comprensión de WhatsApp

Fecha: 2026-10-11. Rama permanente: staging. Usar AGENTS.md y el relevo. Este plan describe pruebas, no acredita que el producto sea vendible.

## Tanda de pedido grande, fecha y abono — 11 de octubre

Once casos originales adicionales, dos catálogos, dependencias externas simuladas. Consultar rendimiento no compra ni inventa cuántas personas comen; solamente usa datos numéricos escritos en descripción. Abono/anticipo se coordina con el local y no modifica pago/cart. Compra explícita referida de diez cajas conserva un único producto previo; si hay carrito u otro pendiente pide aclaración. Fechas y comensales no son direcciones. Recorrido con arroz, miércoles, abono, mediodía nativo y reparto 5/5 aprobado en la revisión focalizada. Copia de respuesta más horario solo se separa con fuente Bot reciente verificable; fuente no encontrada pide aclaración sin comprar su contenido.

Verificación: 62 suites y 1.519 pruebas aprobadas en dos grupos (43 WhatsApp/1.421 + 19 restantes/98), TypeScript sin errores. Código `46a4f1bf` desplegado y verificado healthy el 2026-10-11; evidencia en el relevo. Sigue pendiente fechas/horas adicionales, negación/intervalos de rendimiento, opciones desconocidas/múltiples atributos en reparto y otras intenciones nativas. No se incorpora reserva o abono automático ni se cambia política del piloto. Cero llamadas pagadas.

## Histórico: respuestas nativas y reparto — 11 de octubre

Nueva cobertura: referencias a mensajes salientes por ID de Meta, límites por conversación/línea, referencias no recuperables o ambiguas y ausencia de compra por cantidades en la cita. Textos bot nuevos guardan ID; mensajes históricos sin ID y medios/humanos no quedan acreditados. Cambios por opción citada solamente cuando el carrito ya existe y no hay selección pendiente.

Reparto de diez unidades por atributo: 5/5 del mismo producto, tanto preparación pendiente PPP como base de bowl en otro catálogo; conservar notas, cantidades, otro plato y estado. Suma incorrecta o varios referentes requieren aclaración. Preguntar rendimiento para veinte personas no implica comprar veinte unidades.

La tanda no acredita todavía el recorrido completo con rendimiento, abono, fecha y texto copiado. Los próximos casos deben medir todo el recorrido y respuesta, no solo el carrito final. Verificación local: 62/62 suites, 1.508/1.508 pruebas y TypeScript sin errores. Cero llamadas pagadas. Publicado y desplegado `91cd9a67` en staging, API healthy y DB connected.

## Fuentes públicas revisadas

- [MultiWOZ 2.2](https://github.com/budzianowski/multiwoz/blob/fe0c8e65cfcd8462bd33c86e35f21addc84ca82b/data/MultiWOZ_2.2/README.md). Revisión fe0c8e65cfcd8462bd33c86e35f21addc84ca82b; licencia MIT. Se inspeccionó dev/dialogues_001.json: 512 diálogos, 220 con servicio de restaurante; IDs de referencia PMUL0698.json y MUL0242.json. Útil para consultas sucesivas, restricciones y cambios de objetivo. Son conversaciones de un benchmark de tareas, no pedidos reales de PPP.
- [Schema-Guided Dialogue](https://github.com/google-research-datasets/dstc8-schema-guided-dialogue/tree/e852981ae34990f4358979625854259302feaa78). Revisión e852981ae34990f4358979625854259302feaa78; licencia CC BY-SA 4.0. Se inspeccionó dev/dialogues_001.json: 128 diálogos, 29 con restaurante; IDs de referencia 1_00000 y 1_00001. Útil para intención, datos de varias entidades y contexto. Su restaurante es de búsqueda/reservas; no habilitar reservas en PPP por copiar el dominio.
- [BaristaDatasets](https://github.com/birfan/BaristaDatasets/tree/02a83940e7a5d8f4435551cf94649a9f1ec3271e). Revisión 02a83940e7a5d8f4435551cf94649a9f1ec3271e. README describe conjuntos generados con plantillas y cambios de preferencias. La licencia del dataset es CC BY-NC-SA 4.0: no se incorporan sus transcripciones ni traducciones al producto comercial.

- [FoodOrdering](https://github.com/amazon-science/food-ordering-semantic-parsing-dataset/tree/82df0797d254637a06153aae13470ac14a88bf77) y [PIZZA](https://github.com/amazon-science/pizza-semantic-parsing-dataset/tree/814d6d0f0e26e9ba5c45be281fd432dc4d069b05), de Amazon Science. README y licencias inspeccionados: CC BY-NC 4.0 en ambos. FoodOrdering distingue peticiones humanas obtenidas para menús de varias categorías y datos sintéticos. Son solicitudes de pedido con anotaciones, no necesariamente conversaciones completas. Útiles para estudiar cantidades, restricciones y atributos por producto; no se incorporan ni traducen sus ejemplos al producto comercial.

Las cantidades anteriores corresponden únicamente a los archivos inspeccionados. No se descargaron datasets completos ni se ejecutó código remoto. Los casos de PPP se escriben desde cero, con datos ficticios y patrones generales; no son chats reales descargados ni traducciones de los ejemplos. No copiar datos de personas ni respuestas históricas como oráculos.

## Secuencia y resultados que debe exigir cada tanda

1. **Consulta frente a acción y canjes**. Capacidad, negación, condición, procedimiento y petición explícita; voucher suelto con carrito vacío; registro de factura explícito; código desconocido/usado/vencido/de otra cuenta. Verificar que preguntar no gaste puntos, que no se registre un voucher como factura y que no se cambien platos.
2. **Cambios de preferencias y productos**. Correcciones antes/después de resolver una variante; cambios de bebida, cocción, acompañamiento y cantidad; conservar otra línea. Menú PPP y al menos otro catálogo. No aprobar solo porque aparece una nota: revisar alcance y contradicciones.
3. **Consultas intercaladas y referencias**. Precio, tamaño, disponibilidad y total entre elecciones; «esa», «el segundo», «el de antes», «igual» con cero/una/varias opciones. Aclarar cuando falte un referente; no agregar al consultar. Incluir atributos que comparten nombre con productos.
4. **Turnos compuestos y recuperaciones**. Compra + nota + dirección + pago; aclaración posterior; no/reinicio/espera; mensajes cortados y typos. Guardar cada intención independiente, conservar cantidades y evitar inventar sustituciones, ingredientes o productos.
5. **Medios, errores y duplicados**. Álbum de varias fotos, una ilegible, reenvío del mismo ID, texto entre fotos, comprobante que no es compra. Confirmar que no se duplique ni silencie un fallo. Interpretación simulada primero; visión real requiere imágenes originales y presupuesto explícito.
6. **Casos reservados y estabilidad**. Ejecutar el archivo de casos reservados después de cerrar una tanda de desarrollo, sin incluirlo en prompts. Repetir en otro catálogo. Inferencia real: una repetición, detener ante fallo y límite dentro de 12 llamadas restantes, compartido con el resto de esta sesión. No gastar llamadas para repetir caminos resueltos gratis.

Cada tanda debe incluir casos positivos, negativos y recuperación después de una aclaración. Variar productos por estructura de catálogo; nombres, IDs y precios específicos solo en fixtures. Los cambios de producción deben ser reglas generales. Si un caso falla, convertirlo en regresión de desarrollo y reponer el conjunto reservado; no seguir llamándolo reservado.

## Forma de ejecutar sin desperdiciar

Router real, catálogo real y guard real; modelo, Meta y sistemas externos simulados. Comparar carrito, atributos, notas, estado y respuesta después de cada turno. Para canjes comparar también saldo y llamadas de mutación. No usar cuentas reales ni crear pedidos externos.

Primero suite focalizada; corregir antes de ampliar. TypeScript y suite unitaria completa al finalizar cambios compartidos. DB solo si se cambió persistencia/transacciones, con base local descartable y guard existente. En este PC ejecutar Jest completo y Jest DB en secuencia: hubo un timeout cuando ambos compitieron, cuya causa exacta no se perfiló. Conservar el fallo en el registro y repetir solo la suite afectada; no aumentar timeouts para ocultarlo.

Registrar commit, casos ejecutados, fallos, recuperaciones, tipo de modelo y gasto. Publicar/deploy staging solo con verificaciones necesarias aprobadas. Ninguna cantidad de mocks acredita por sí sola comprensión del modelo real ni producto listo para venta.

## Tanda ejecutada el 11 de octubre

30 regresiones nuevas: nueve consultas de capacidad/condición/negación, nueve peticiones explícitas de canje, dos registros de factura, un voucher válido suelto y tres vouchers usados/vencidos/de otra cuenta; seis pedidos compuestos en PPP y catálogo sintético. Inicialmente fallaron doce casos de consultas/códigos y dos compuestos. Se corrigieron las causas y las 30 regresiones pasan.

Resultado completo: 62/62 suites, 1.463/1.463 pruebas y TypeScript sin errores. Modelo y servicios externos simulados, cero solicitudes pagadas; quedan doce del límite compartido. Los ocho casos reservados siguen sin ejecutarse. Los resultados de DB anteriores están documentados en el relevo, no se atribuyen a esta tanda.

Código `adb8d582` publicado y desplegado en staging: contenedor healthy, health OK y DB connected. Verificación del 2026-10-11; documentación posterior no cambia la imagen de código.

## Tanda de correcciones y cercanía, 11 de octubre

23 regresiones nuevas: diez de referencias/correcciones/consultas con otro producto presente, cuatro en catálogo alternativo, cuatro pedidos con cercanía en PPP y otro menú, dos controles de consulta/negación y tres respuestas de horario. Se reprodujeron cuatro fallos iniciales de variantes/cocción; el catálogo alternativo añadió defectos de plurales/cantidad/cocción y un problema de compra por nombre de color. Los 23 controles focalizados finales pasan, incluidos pasta/lentejas en otro menú y consultas/negaciones. La consulta fue clasificada como descripción en vez de disponibilidad; la ruta de cercanía ahora separa todas las consultas de compras y no permite que una consulta sin resolver caiga en agregar producto. Primera regresión completa: 62/62 suites, 1.482 pruebas (antes de cuatro controles nuevos). Segunda regresión: 61 suites pasaron y una falló; 1.485 pruebas pasaron y la consulta «Tienen sopa… aquí para la vuelta» agregó un producto. Se corrige su prioridad de disponibilidad y se repiten controles y suite completa antes de publicar.

Pendientes explícitos en `scripts/fixtures/whatsapp-development-pending.json` (registro de desarrollo, no runner automático): compra de «Bowl Verde con arroz» por nombre sigue fallando; los tests de edición lo seleccionan por código. El flujo completo de diez cajas de arroz, reparto 5/5, rendimiento por personas, pedido futuro y abono está reportado por usuario, aún no reproducido completo. Horario aislado ya se comprueba; no declarar ese recorrido aprobado. El enlace nativo de respuesta de WhatsApp (`raw.context.id`) no se resuelve hoy: las pruebas históricas de texto citado no acreditan esa función.

Próxima tanda prioritaria: enlace nativo de respuesta dentro de la misma conversación (incluidos ID ausente/ajeno/viejo), producto con nombre de color, y compra para grupos preservando producto/cantidad/variantes durante consultas y horarios. Rendimiento y políticas de programación/abono deben venir de configuración, no del modelo. Cero llamadas pagadas; saldo compartido doce.

Verificación final de esta tanda: 62/62 suites y 1.486/1.486 pruebas; TypeScript sin errores. Los 23 casos focalizados pasan. Logs `/tmp/ppp-references-approved-full.log`, `/tmp/ppp-references-approved-tsc.log`, `/tmp/ppp-references-targets-approved.log`. Cero API pagada; no se repitió DB porque no se cambió persistencia. No atribuir estos resultados a los tres pendientes de desarrollo.

Publicado y desplegado `3a5e7f42` en staging, API healthy y DB connected. Imagen activa/candidate `sha256:52255c901a457e53520753345e2fd235e2521d5a149f2696915bd6662d736dd7`.
