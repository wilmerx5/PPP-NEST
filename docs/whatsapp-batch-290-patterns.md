# Tanda290 — aclaración de retiradas compuestas

Origen: continuación de las referencias de opciones de los chats compartidos y de las tandas286–289. Casos sintéticos por comportamiento; no es revisión nueva de chats/PDF/audio ni muestra independiente con modelo real.

## Contrato

Una petición como «quita dos de los de pechuga y uno de los de cubos» puede señalar varias líneas. Se conserva la lista de operaciones y sus cantidades en `pendingCartRemoval.batchGroups` / `batchQuantities`, con firma del carrito. Se pregunta una referencia ambigua cada vez, por número o característica. El carrito no cambia hasta resolver todas.

El texto de aclaración y los recordatorios indican la cantidad que se retirará. La operación final valida otra vez todas las líneas, descuenta cantidades y limpia la selección. Se conservan notas, atributos, precios, unidades restantes y el paso de checkout. El comportamiento anterior de retirar líneas completas sigue usando el mismo flujo sin `batchQuantities`.

Una selección insuficiente o repetida en otra operación deja la aclaración abierta para elegir otra. Cancelar incluso tras resolver la primera parte no aplica nada. Un carrito modificado invalida la selección. Consultar el total no consume opciones. Preguntas, números fuera de lista, pagos y otras selecciones pendientes no modifican el carrito. Una cláusula posterior desconocida o con cantidad inválida impide crear la aclaración inicial.

## Cobertura

276 casos nuevos:96 selecciones simples/dobles,120 guardas,48 recuperaciones/interrupciones y12 referencias superpuestas con recuperación. Tres catálogos sintéticos, agente simulado on/off y compra/revisión. Se verifica carrito completo, estado, respuesta, campos pendientes y ausencia de órdenes externas. Fixtures arrancan con carrito preparado; no son conversaciones completas desde saludo.

Baseline inicial de264 casos:36 aprobados/228 fallidos. Después se añadieron12 casos de superposición. Foco final1.260/7 suites, incluyendo retiradas completas previas. Global y despliegue registrados aparte después de verificarlos.

Límites: gramática contada de289; se prueban dos cláusulas. No amplía el lenguaje a mezcla de añadir/cambiar/retirar ni reparto de una retirada entre varias líneas. Para sustituir una solicitud contada pendiente, cancelar y enviarla completa de nuevo. Sin SQL ni cambio de modelos. Cero inferencia pagada, Meta u órdenes externas. PPP producción y Kamppo no migrados en esta tanda.
