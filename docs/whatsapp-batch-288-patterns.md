# Tanda 288 — cantidades en retiradas referenciadas

Origen: siguiente punto del plan del29/10, a partir de pedidos de varias unidades y opciones de los chats compartidos. Son variantes sintéticas de esos patrones; no se revisaron nuevos chats/PDF/audios en esta tanda.

## Cambio

Amplía la regla de286 para «quita dos de los de pechuga» / «retira 3 de los de filete». Conserva la cantidad al aclarar por número o característica, contesta el total sin consumir la selección y permite cancelar. Si la línea seleccionada no tiene suficientes unidades, no reduce ni borra nada y permite seleccionar otra línea. Si se retira exactamente la cantidad existente, desaparece solo esa línea; las demás mantienen notas, opciones y precios.

El campo opcional `pendingCartRemoval.quantity` pasa de literal1 a número. Se valida como entero de1a99; los números escritos reconocidos van de uno/una a diez. Los signos y separadores se conservan antes de validar para no convertir una cantidad negativa o decimal en una retirada positiva. Las unidades de una línea nunca se toman de otra automáticamente. Se conserva el contrato de firma del carrito y el bloqueo por pagos/otras selecciones.

## Evidencia

360 pruebas nuevas:144 retiradas (directas o aclaradas),144 guardas y72 recuperaciones/interrupciones. Tres catálogos, agente simulado activo/inactivo, compra/revisión, cantidades solicitadas de2/3 en palabras/dígitos, retirada parcial/completa, selección por índice/nota, exceso, cero, negativo, decimal,100, preguntas, petición mixta, pago y selección pendientes, firma antigua y cancelación. La recuperación comprueba elegir otra línea después de que la primera sea insuficiente.

Baseline26aprobadas/334fallidas. Foco882aprobadas:360nuevas,420de retirada de una unidad y102de ajustes cercanos. El estado previo del carrito es fixture; las peticiones recorren el router. Se comprueban carrito, respuesta, estado y ninguna orden externa. No son360conversaciones reales independientes.

## Límites

Gramática acotada a cantidad + «de los/las de» + referencia. No acredita todas las formas de «quita dos ejecutivos», el reparto de una retirada entre distintas líneas, cambios compuestos ni todos los enteros/palabras admitidos por el parser. Cantidades principales de2/3 y límites inválidos son la cobertura nueva; una unidad mantiene su suite anterior. No cambia SQL, modelos ni canales. Cero inferencia pagada/Meta/órdenes externas. Producción y Kamppo no reciben esta tanda automáticamente.
