# Tanda282 — traslado de una nota ya aplicada

Origen: patrones de corrección referencial presentes en los chats compartidos (cambiar solo uno de varios platos, conservar atributos y notas), corpus documentado en `whatsapp-batch-280-patterns.md` y límite explícito de281. Esta tanda genera variantes sintéticas; no afirma reproducción literal de nuevos PDFs, audios o conversaciones completas.

## Problema reproducido

192 recorridos completos fallaban antes del ajuste. Después de comprar3/4platos y asignar «uno sin cebolla» o «uno sin cebolla y sin tomate», corregir destino por ordinal, nombre o número no trasladaba la nota. Nombrar el destino podía agregar otro producto. Baseline:0 aprobadas/192 fallidas.

## Matriz nueva

-192 traslados:2catálogos ×2modos de agente simulado ×2tamaños de carrito ×2orígenes ×2estados (compra/revisión) ×2notas ×3referencias. Comprueba carrito completo, cantidades/precios/notas, respuesta, estado y repetición sin compras.
-128 guardas:carrito modificado, selección caducada/futura, interrupción, medio no textual, pregunta, mismo origen, otro flujo pendiente, varias unidades, falta de contexto, destino desconocido, petición mezclada, pedido cerrado, enlace de pago, límite de longitud y nombres duplicados.
-40 recuperaciones:ambigüedad, conflicto, cancelación del traslado, interrupción y caducidad mientras espera destino.

Total360 nuevas. Los títulos duplicados son una variación artificial de la sesión para probar ambigüedad; el resto de recorridos positivos compra por el router y aplica la nota sin inyectar el marcador. Dependencias/modelos simulados, sin inferencia pagada ni órdenes externas.

## Contrato

Solo la nota recientemente seleccionada entre líneas de cantidad1 puede trasladarse. Se conserva la instantánea anterior y la huella del carrito. No se renueva el plazo de10min al preguntar. La pregunta muestra nombres, atributos y notas; una referencia ambigua nunca elige al azar. Un conflicto de ingrediente mantiene la nota original y permite otro destino. «No muevas la nota» cancela únicamente el traslado.

La reparación explícita acepta «no, al/el/la/a la…», «perdón, al/el/la/a la…» y «mejor al/el/la/a la…». Durante la aclaración acepta número, ordinal o nombre completo exacto. Sin contexto reciente, una reparación hacia una referencia reconocible del carrito pide aclarar para evitar otra compra. Referencias ajenas y otros flujos pendientes no son interceptados por esa guarda.

No resuelve referencias semánticas arbitrarias, traslados entre varias unidades, cambios simultáneos de plato y nota ni todas las formas regionales. No hay cambios de modelo, SQL, producción o Kamppo. Añadir pruebas no entrena automáticamente al modelo.
