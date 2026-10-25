# Revisión completa de chat.txt — 25/10/2026

Base staging `49cf15d4`. Archivo leído completo: 2.875 líneas, 445 mensajes (226 cliente/219 bot), 26 comprobantes y 28 recorridos delimitados manualmente. Fuente local y SHA256 en `whatsapp-chat-2510-audit.json`; no se copia el export con teléfonos, direcciones privadas ni miniatura base64 a Git. Las horas son las del archivo. No hay evidencia suficiente para calcular mejora porcentual respecto de otra versión ni tasa de pedidos correctos.

## Conclusión

Hay avance visible en pedidos sencillos, notas por plato, corrección de teléfono durante pago, conservación de algunos interiores, selección de bebida y confirmación natural. Pero cerrar un pedido no demuestra que sea correcto: varios cierres exigieron que el usuario arreglara cantidades, bebidas o productos. Priorizar integridad del pedido y destino antes de mensajes más cortos.

Los fallos se concentran en transiciones: consulta que abre una compra, corrección que añade, números de dirección que compran, complemento que reemplaza el destino, pendiente resuelto que sigue activo. El mismo texto debe producir operaciones consistentes desde compra, aclaración, pago y confirmación. Los mocks no acreditan comprensión del modelo real ni concurrencia de WhatsApp.

## Recorridos revisados

### CHAT2510-01 · 12:41–12:42 · Pollo frito y dirección en dos mensajes · recibo #21

- Acertó: Aclaró preparación, actualizó teléfono y cerró.
- Revisar: Cotizó el conjunto antes de incorporar la calle enviada tres segundos después; referencia inicial distinta. Revisar ráfagas y precisión, no afirmar distancia real desde el chat.

### CHAT2510-02 · 12:43–12:44 · Churrasco, mojarra, bebida y destino · recibo #23

- Acertó: Tres productos correctos y nota bien asociada al churrasco.
- Revisar: La bebida quedó dentro de la dirección y llegó al comprobante; notas no visibles en recibo.

### CHAT2510-03 · 12:54–12:56 · Pedido por ráfaga con dirección primero · recibo #33

- Acertó: Cuatro productos, bebida, nota de sobrebarriga e interiores conservados.
- Revisar: Resúmenes intermedios y pregunta de pago mientras llegan productos; comprobar coalescencia sin perder añadidos. Recibo omite notas.

### CHAT2510-04 · 13:00–13:02 · Pollo brostter y datos intercalados · recibo #38

- Acertó: Finalmente conservó calle, apartamento, torre y teléfono.
- Revisar: Aclaración innecesaria del producto, perdió prioridad del pendiente y pidió teléfono con carrito vacío; obligó a repetir compra.

### CHAT2510-05 · 13:03–13:08 · Dos ejecutivos con opciones repartidas · recibo #39

- Acertó: Añadió limonada extra y recuperó dos ejecutivos tras corrección; confirmó con typo.
- Revisar: Aplicó pechuga a ambos, perdió limonadas incluidas, añadió tercer ejecutivo al corregir. No asumir equivalencia de colombina sin catálogo.

### CHAT2510-06 · 13:08–13:10 · Pollo frito sencillo · recibo #41

- Acertó: Compra, dirección multilínea, teléfono, pago y cierre coherentes.
- Revisar: Control positivo; reducir repetición del carrito sin ocultar correcciones.

### CHAT2510-07 · 13:10–13:11 · Medio pollo y nuevo destino · recibo #42

- Acertó: Reconoce fracción, destino nuevo y teléfono después de seleccionar pago.
- Revisar: Control positivo; mantener estos caminos al cambiar el router.

### CHAT2510-08 · 13:12–13:16 · Combo Pepsi, contenido y sustitución · recibo #45

- Acertó: Ráfaga pollo/en combo, cambio inicial a Pepsi, notas posteriores y teléfono funcionan.
- Revisar: Pregunta de contenido abre reemplazo; pierde Pepsi y primera sustitución. Recibo no muestra notas. Solo contenido corregido en staging182, resto pendiente.

### CHAT2510-09 · 13:16–13:19 · Medio broaster y plátano · recibo #49

- Acertó: Lista de productos, cambio de dirección e interiores y cierre coherentes.
- Revisar: Plátano maduro se convierte en producto con queso/bocadillo: mostrar composición, aclarar si hay varias variantes en catálogo.

### CHAT2510-10 · 13:20–13:21 · Compra completa más pregunta Nequi

- Acertó: Cancelación del borrador explícita funciona.
- Revisar: Cotiza seis productos en vez de sopa más ejecutivo; ingredientes y sustituciones se cobran aparte. Repro183 abierto.

### CHAT2510-11 · 13:32–13:34 · Sopita para portería · recibo #55

- Acertó: Diminutivo reconocido, nota de entrega y cierre.
- Revisar: Tres turnos para validar destino incluido desde el inicio; mapa no validable con este archivo. Recibo no muestra nota de portería.

### CHAT2510-12 · 13:40–13:41 · Arroz con costillas y transferencia · recibo #61

- Acertó: Producto compuesto correcto, interiores, teléfono, instrucciones de pago y sí final.
- Revisar: Nota con costillas redundante; no confundir confirmar pedido con verificar transferencia.

### CHAT2510-13 · 13:44–13:49 · Audios y Altavista con interiores · recibo #63

- Acertó: Recupera dirección con calle y conserva apartamento al final.
- Revisar: Torre/apartamento aislados se geocodifican como destino y dan fuera de cobertura. Audios omitidos: no evaluar transcripción ni contenido no visible.

### CHAT2510-14 · 13:52–13:54 · Arroz si es tan amable · recibo #65

- Acertó: Destino mientras hay pendiente, teléfono y cierre funcionan después de elegir.
- Revisar: Cortesía obliga a confirmar único producto; confirmación innecesaria.

### CHAT2510-15 · 13:55–13:56 · Combo Ginger · recibo #67

- Acertó: Pedido con bebida, conjunto/casa, teléfono y cierre coherentes.
- Revisar: Control positivo; limpieza del prefijo A en dirección es secundaria.

### CHAT2510-16 · 13:58–14:01 · Dos arroces y dirección numérica · recibo #71

- Acertó: Corrección son dos funciona; eliminación explícita final recupera carrito.
- Revisar: Pierde cantidad al elegir1; repetir destino agrega cuatro bandejas; no quieor conserva producto rechazado. Fallos críticos de intención, no cosméticos.

### CHAT2510-17 · 14:06–14:11 · Sustitución de ensalada · recibo #80

- Acertó: Tras aclaración aplica nota al arroz, conserva ajiaco y cierra.
- Revisar: Algo no hace parte es respuesta literal incorrecta; pierde referente y mantiene pendiente viejo: no se interpreta como rechazo de sustitución tras resolver nota.

### CHAT2510-18 · 14:17–14:18 · Ajiaco y porción adicional de arroz

- Acertó: Añade ajiaco correcto y reinicio limpia.
- Revisar: Ofrece arroces/combos en vez de porción; ignora arroz blanco y código10 válido fuera de lista. Bloquea hasta reiniciar.

### CHAT2510-19 · 14:22–14:29 · Combo con Manzana y referencia de destino · recibo #94

- Acertó: Preparación y bebida correctas; separa calle y referencia frente a local, cierra.
- Revisar: Control positivo de referencias; no acreditar distancia real con texto exportado.

### CHAT2510-20 · 14:31–14:36 · Tres platos y cambiar ejecutivo · recibo #98

- Acertó: Conserva Ginger del combo y elimina línea elegida sin quitar otras.
- Revisar: Cambio de preparación añade ejecutivo adicional; costillas ambiguas ofrecen compuesto. Usuario debe reparar antes de cerrar.

### CHAT2510-21 · 14:39–14:42 · Arroz chino con costillas · recibo #101

- Acertó: Finalmente queda compuesto más sopa; total y cierre correctos.
- Revisar: Lo quiero con costillas se compra aparte; primera corrección no resuelve, requiere segunda reformulación.

### CHAT2510-22 · 14:45–14:48 · Rosaleda 8 303 · recibo #105

- Acertó: Producto y contacto correctos.
- Revisar: Toma referencia de calle genérica como destino preciso. Necesita desambiguar números interiores y exigir evidencia geográfica suficiente; no inferir tarifa correcta.

### CHAT2510-23 · 14:54–14:55 · Medio pollo y ubicación compartida · recibo #108

- Acertó: Pin aceptado y cierre sin exponer coordenadas en texto.
- Revisar: Exportación incluye miniatura base64: no tratarla como instrucción ni prueba de OCR; verificar que orden conserva coordenadas en pruebas DTO.

### CHAT2510-24 · 15:07–15:09 · Ejecutivo detallado y dirección en un mensaje · recibo #112

- Acertó: Menudencias/pierna/bebida y sin ensalada se mantienen; pasa a pago sin algo más.
- Revisar: Papa francesa explícita no aparece en nota: contrastar descripción antes de calificar omisión. Recibo no muestra sin ensalada.

### CHAT2510-25 · 15:10–15:21 · Combo mixto Pepsi y repetir conjunto · recibo #121

- Acertó: Recupera cambio Pepsi y calle más interiores tras reformular.
- Revisar: Tres errores técnicos; repetir conjunto después de calle válida borra calle/tarifa y reabre geocodificación. Necesita logs para causa técnica; no culpar modelo desde chat.

### CHAT2510-26 · 15:21–15:25 · Bandeja de arroz con pollo · recibo #123

- Acertó: Reformulación final compra arroz con nota y dirección.
- Revisar: Envase bandeja lleva a otra familia de producto; error técnico al corregir. No perder referente por nombre de recipiente.

### CHAT2510-27 · 15:29–15:32 · Pechuga y conjunto más calle · recibo #128

- Acertó: Nota papa salada y calle posterior conservan conjunto/interiores.
- Revisar: Pide calle para conjunto ambiguo razonablemente; falta validar alias de geocodificador. Recibo omite nota.

### CHAT2510-28 · 15:34–15:37 · Pollo y medio en combo · recibo #131

- Acertó: Elección de bebida por línea y eliminación final dejan combo más medio.
- Revisar: Inventó combo de arroz, corrección añadió en vez de reemplazar y eliminación múltiple solo quitó uno. Total inicial100mil, luego178mil, final80mil tras reparaciones.

## Plan de corrección y orden de ejecución

1. **P0: proteger carrito ante destinos y correcciones.** Reproducir CHAT16 y20 en tres menús: números de casa/código nunca compran; «el ejecutivo con broaster» modifica la unidad existente, conserva notas/opciones compatibles y no añade. Negación elimina o aclara sin interpretar «no» como conservar. Verificar diferencia de carrito después de cada mensaje, no solo final.
2. **P0: compra compuesta + consulta.** Continuar diagnóstico183 para CHAT10. Extraer compra, opciones/sustitución, datos y pregunta como intenciones simultáneas. Sopa independiente más sopa de ejecutivo no son duplicados. Preguntar papa o yuca si catálogo no decide; nunca cobrar ambas como extras. Total proviene del carrito validado; instrucciones Nequi solo de configuración.
3. **P0: cantidades y reemplazos.** CHAT05/16/20/21/28. Distribuir dos unidades; selección1 es índice, no cantidad. Un pollo y medio no autoriza arroz. Reemplazo atómico quita origen y añade destino, preservando bebida/notas compatibles. Eliminación múltiple conserva todos los objetivos hasta resolver ambigüedad.
4. **P1: destino estructurado.** Separar calle, conjunto, torre/interior/apto, referencia y coordenadas. CHAT01/02/13/22/25: no poner bebida en dirección; no geocodificar torre sola; complemento del mismo destino no borra calle/pin/tarifa; destino realmente nuevo sí invalida ruta anterior. Mapa ambiguo no equivale a dirección confirmada. Medir con respuestas de mapas grabadas y anonimizadas, no aceptar siempre ok en mocks.
5. **P1: alternativas y cortesía.** CHAT04/14/18/26. Producto exacto pesa más que envase/cortesía; porción adicional es porción, no combo. Nombre/código válido fuera de lista reemplaza candidato pendiente sin reiniciar. Aclarar solo una ambigüedad real y conservar cantidad.
6. **P1: consulta, pendiente y resumen.** CHAT08/17: respuesta de composición no abre reemplazo, no resetea Pepsi; nota resuelta retira pendiente; «no más» avanza. Compra+dirección completa avanza al próximo dato faltante; teléfono corregido se reconoce brevemente. No saltarse resumen final ni confirmación.
7. **P1: fallos técnicos y recibo.** CHAT25/26 requieren correlación con logs 15:11–15:22, sin exportar secretos ni datos personales. Simular timeout/excepción/reintento: sin duplicados ni cambios parciales falsamente confirmados. Notas visibles en carrito no aparecen en recibos: verificar DTO/persistencia antes de afirmar que cocina las perdió; después garantizar representación clara en comprobante.

## Cómo convertir este material en pruebas útiles

- Mantener cada recorrido original (datos personales sintéticos) y variantes equivalentes de otros menús. No convertir automáticamente un fallo en excepción por nombre/SKU de PPP.
- Reproducir primero mensaje completo y secuencia, luego aislar la causa; probar mismo comportamiento con agente simulado on/off y declarar esa limitación.
- Separar pruebas de negocio con turnos secuenciales de transporte con ráfagas y reloj simulado. Este archivo tiene respuestas cruzadas; concatenar texto no reproduce colas.
- Afirmar respuesta, carrito, opciones/notas, datos, estado pendiente y DTO por unidad; impedir creación anticipada y duplicada. Prueba que falla antes del cierre no acredita DTO.
- Conservar controles positivos (CHAT06/07/09/15/19/23/24) durante cambios. Descripciones/defaults deben venir del catálogo del entorno; no comparar precios de fixture beta con producción como fallo.
- Suites focales por familia; TypeScript general/build y Node; global solo ante cambio compartido con fuente congelada. No declarar verde un `.repro.ts` fallido ni sumar controles ya existentes como nuevas mejoras.

## Criterios para cerrar esta auditoría

Todos los P0 con reproducción inicial y corrección verificada; recorridos completos sin productos extra ni pérdida de cantidad/bebida/notas/destino; mismo destino no altera tarifa por interiores; ninguna respuesta afirma una mutación que no existe; preguntas se responden y reanudan el paso correcto; errores técnicos dejan recuperación segura. Después validación acotada real y piloto supervisado, con registro de intervención humana y costo por pedido correcto. Este informe no declara listo para venta.

## Ejecución de esta revisión (184)

- 12 diagnósticos nuevos del texto real: 6 familias × agente simulado off/on. Los 12 fallan en staging. Cortesía y envase dejan carrito vacío; porción adicional pierde arroz; dos arroces no se ejecutan correctamente; negación con typo conserva línea; cambio de ejecutivo deja dos. `whatsapp-chat-2510-audit.repro.ts`.
- 6 diagnósticos de destino numérico: bowl/pizza/ramen × off/on. Fallan los 6: sin agente el destino anterior permanece; con agente simulado se añaden cuatro unidades del producto código4. No es un fallo exclusivo del menú PPP. `whatsapp-address-number-preservation.repro.ts`.
- 6 controles nuevos con destino explícito «Para conjunto Los Olivos torre 4 apto404» pasan, incluida repetición, respuesta, conservación de carrito/notas y cierre DTO simulado con dos unidades. `whatsapp-address-number-preservation.spec.ts`.
- Focal con composición y consultas/dirección existentes: **48/48**, tres suites. Son 6 nuevos +42 existentes, no48 nuevas mejoras. Diagnósticos **18 fallidos** se ejecutan aparte y NO integran el inventario verde ni acreditan corrección.
- Primer ensayo de destino sin agente tenía un mock incompleto (`findTodayOrdersByPhone`); se añadió respuesta vacía y se repitió. Resultados finales anteriores ya no dependen de esa excepción del arnés. El fallo con agente reproduce la compra espuria con acciones del modelo vacías: hay un camino determinista que la permite. No atribuirlo automáticamente al modelo.
- Modelos, mapa y persistencia simulados. No se ejecutó audio omitido ni transporte de ráfagas ni órdenes externas. Las pruebas reales se limitan al texto visible; catálogo beta diferente del catálogo de producción, pruebas por identidad/opción/cantidad y no por precio exportado.
- TypeScript general/build aprobados y Node92/92 aprobados. No hay cambios de runtime: 549 hashes de la global182 iguales. No se repite global por documentación/tests; última global realmente ejecutada sigue18.331/251. Producción/Main preservadas; sin despliegue, Meta ni API pagada.

Comandos reproducibles:

```sh
npx jest --testRegex='whatsapp-(chat-2510-audit|address-number-preservation)\.repro\.ts$' --runInBand
npx jest --runTestsByPath src/whatsapp/whatsapp-address-number-preservation.spec.ts src/whatsapp/whatsapp-combo-content-preservation.spec.ts src/whatsapp/whatsapp-address-multiple-inquiry.spec.ts --runInBand
```

Logs locales: `/tmp/ppp-184-diagnostic-final.{log,json}` (12), `/tmp/ppp-184-address-final.{log,json}` (6), `/tmp/ppp-184-focus.{log,json}` (48). Los fallos se conservan como contrato esperado para corregir, no con expectativas relajadas que acepten el bug.

**Siguiente trabajo concreto:** corregir primero destino numérico sin contaminar compras legítimas ni consultas de estado; ejecutar estos6 rojos y controles de nombre/calle/estado. Después resolver la compra+Nequi de183, variantes/cantidades y bloqueo de porción. No gastar otra tanda en inventariar estos mismos fallos sin avanzar en su corrección. La auditoría termina aquí; los defectos permanecen abiertos.

## Seguimiento185

Se corrige la familia de destino numérico de CHAT2510-16: seis diagnósticos promovidos/ampliados a36regresiones de `whatsapp-explicit-destination.spec.ts`. Los12diagnósticos de `whatsapp-chat-2510-audit.repro.ts` permanecen abiertos. Las cifras18fallos anteriores son el baseline histórico, no el resultado después de esta corrección. Los errores de cantidad/negación del mismo CHAT16 aún no están corregidos. Evidencia y límites: `whatsapp-explicit-destination-validation-2510.md`.
