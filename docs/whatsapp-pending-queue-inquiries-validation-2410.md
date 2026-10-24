# Tanda 168 — consultas y cantidades con compras en cola (24/10)

Base a353bdf4, rama staging. Objetivo: responder consultas sin perder la selección activa y ejecutar una corrección explícita de cantidad aunque comparta turno con una pregunta de precio.

## Evidencia y cambios

Baseline: 30 recorridos, 18 pasaron y 12 fallaron. En los seis casos de contenido respondió la descripción pero omitió recordar la opción pendiente. En los seis casos de cantidad + precio informó el precio sin cambiar las dos unidades pendientes. No fue fallo de transcripción ni una medición del proveedor real.

La respuesta de composición durante una selección ahora conserva el recordatorio. El manejador de interrupciones reconoce dos cláusulas (corrección declarativa de cantidad + consulta de precio) en cualquiera de los órdenes. Reutiliza el parser de correcciones; exige nombre completo del producto activo. Actualiza pendingAttribute.quantity y responde precio por unidad junto con la selección pendiente. Si el mismo SKU está también en carrito u otra fila encolada, aclara el alcance sin alterar cantidades. Rechaza cantidades fuera de 1–30, respondiendo igualmente la pregunta de precio. No contiene excepciones por ID, restaurante o producto.

## Contrato de pruebas

54 casos nuevos: tres menús sintéticos × agente simulado activado/desactivado × nueve escenarios. Precio, contenido, tiempo, comentario con pregunta de precio, reducción con pregunta, pregunta seguida de reducción, aumento con pregunta, ambigüedad con línea existente y cantidad cero.

42 recorridos completan elección, pago y confirmación simulada: comprueban respuesta, carrito, cola, estado y DTO expandido por unidad; notas sin hielo/sin azúcar y opciones de sucesoras se conservan. Los 12 controles negativos verifican no mutación de carrito/cola/selección y cero creación de orden; terminan en aclaración, no acreditan resolución posterior de esa aclaración.

Inicio de checkout sembrado y dependencias externas simuladas. Agente activado usa respuesta fija sin acciones; no evalúa inteligencia del modelo real. «Eso está caro» aquí incluye una pregunta de precio: no acredita comentarios libres sin consulta explícita. La búsqueda de nombre es exacta normalizada; referencias abreviadas y mensajes sin separador entre intenciones quedan fuera de esta tanda.

## Validación

Primer intento de corrección tuvo un conflicto de nombre local clauses; se corrigió a quantityClauses antes de ejecutar los casos. Ampliación intermedia 42/42 pasó. Foco final 234/234 en cuatro suites, 113,303 s. TypeScript general y build OK; scripts Node 92/92. Evidencia /tmp/ppp-168-baseline.log, fixed.log (error de compilación), fixed2.log, focus.log, tsc-final.log, node.log.

Global: 17.707/17.707 pruebas, 237 suites, 535 archivos con hash, 1.099,85 s. Inventario exacto y fuente congelada confirmados. Evidencia /tmp/ppp-168-global-summary.json y reportes burst/rest. Cero llamadas pagadas, Meta u órdenes externas. Publicación solo staging; no despliegue en esta tanda. Runtime166 y168 pendientes de deploy agrupado. Último servidor acreditado b8a6567a (161–165); Main intacta.

## Próxima tanda

1. Comentarios sin interrogación: desacuerdo con precio, falta de respuesta, preferencia descartada; responder al comentario y conservar el paso real, sin prometer una corrección que no se guardó.
2. Consulta + cambio de una fila distinta de la activa; referencias ambiguas al mismo SKU. Acreditar aclaración y resolución posterior hasta DTO.
3. Opción de una compra posterior que se retira antes de avanzar; selección por número después de reordenar opciones.

No sumar focos a la global ni declarar vendible por conteos. Contraste real controlado de modelo/audio/imágenes sigue siendo una capa independiente.
