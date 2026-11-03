# Tanda359 — opciones nuevas durante reemplazo con nota pendiente

Casos derivados de los chats compartidos sobre correcciones de productos y del límite registrado en tanda358. No se incorporaron nuevos chats reales.

Baseline:44/44 fallaban. Una nota ambigua bloqueaba el reemplazo con opciones adicionales. Ahora un destino nombrado completo, único y disponible con las opciones anteriores compatibles puede iniciar su selección. Se descarta explícitamente la nota sin aplicar; el original permanece hasta completar las opciones. No se eligen automáticamente opciones nuevas. Confirmar durante esta selección recuerda el paso pendiente; cancelar conserva el original y recupera el estado anterior.

44 controles nuevos:32 recorridos con creación simulada y recibo (dos catálogos, agente off/mock, carrito/confirmación, una/dos opciones y respuesta textual/numérica);8 cancelaciones tras una elección parcial;4 controles de cambio externo del original. Verifican cantidades, precio actual, notas, opciones anteriores y conservación de la otra línea. Los62 controles de358 conservan las guardas; los dos de opciones adicionales ahora esperan selección segura. Foco106/2 aprobado. Código0613645b.

Global34170/427 aprobada;645 fuentes congeladas e inventario exacto. TypeScript general/build y scripts aprobados. Despliegue359 pendiente; runtime staging358. Sin llamadas pagadas, Meta ni órdenes externas; no acredita modelo o canal real. Presupuesto267/256/11 intacto. Producción349 y Kamppo321 sin cambios.

Límites: mantiene bloqueo ante opciones previas incompatibles, destino ambiguo, indicaciones adicionales, pago iniciado y notas caducadas/carrito cambiado. No amplía reemplazos arbitrarios de varias líneas.

Próximo: claridad de la pregunta que se retoma tras consultas intercaladas con ofertas pendientes.
