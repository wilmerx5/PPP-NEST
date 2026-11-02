# Tanda345 — cancelar y reparar el carrito dividido

Origen: chat01/11 20:49–20:56. Baseline12/20 falla: cancelar con punto/exclamación y recuperar «En combo.» tras arroz+costillas;8 frases completas de cancelación ya aprobaban.

Cancelación: normalizar únicamente signos de exclamación inicial y punto/exclamación/elipsis finales, conservando preguntas y negaciones. Sin orden registrada, vacía carrito y confirma cancelación. Con una orden previa y carrito nuevo, descarta solo el borrador y explica que la orden previa sigue activa.

Recuperación: con exactamente dos líneas unitarias, sin atributos y con única clase de nota «sin gaseosa/bebida/refresco», «En combo.» busca un plato cuyo nombre sea la composición completa de ambas líneas. Si es único y disponible, pregunta por ese plato y muestra precio, sin mutar todavía. Aceptar valida firma, vigencia, disponibilidad y precio, reúne en una línea y conserva nota/pago. No infiere un descuento por retirar bebida. Rechazo conserva ambas líneas.

Se detectó durante desarrollo que la aceptación temprana del checkout podía consumir «sí» antes de la propuesta. Ahora la propuesta se atiende antes de esa confirmación. «Confirmar» mientras falta aclararla no crea orden; tras aceptar el cambio, nueva confirmación revisa el resumen resultante.

38 controles nuevos:16 cancelaciones en dos catálogos × agente off/mock,4 recuperaciones con cierre DTO/recibo,14 guardas de propuesta,3 negación/pregunta/condición y1 orden previa. Foco158/3 aprobado. Global33373/413, TypeScript general/build y scripts aprobados; despliegue pendiente.

No acredita canal, DB ni modelo reales. No fusiona cantidades mayores, carritos con más productos, atributos o notas ajenas; no cierra todas las recuperaciones a combo. Precio del fixture no afirma precio vigente en producción. Cero inferencia pagada y cero órdenes externas.
