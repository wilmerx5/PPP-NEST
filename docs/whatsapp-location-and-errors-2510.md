# Tanda187 — ubicación legible y errores técnicos del chat25/10

Base a0d19040, staging. Alcance: mejorar la dirección del pin para cliente y domiciliario, investigar logs sin modificar producción.

## Errores técnicos: causa encontrada

Consulta de solo lectura a logs del contenedor de producción `ppp_nest_api`, ventana25/10/2026 20:09–20:24UTC (15:09–15:24Bogotá). El proveedor de inferencia respondió **HTTP429, credit_balance_exhausted** a las15:11:10,15:11:39,15:12:06,15:16:22y15:22:26. Los cuatro últimos coinciden con los cuatro mensajes «Tuve un problema técnico» del chat exportado. No confundirlo con un fallo de comprensión ni asumir que429siempre significa demasiadas solicitudes.

`WhatsappAgentService` devuelve esa frase genérica cuando la petición de inferencia falla. La telemetría registró algunos de esos turnos como `order_progress` pese al error: pendiente distinguir fallo del proveedor de progreso real. A las15:19el chat consiguió cambiar Pepsi, pero eso no demuestra un saldo actual suficiente ni permite atribuir una recarga. No se consultó facturación ni se hizo una llamada pagada para probar saldo.

Evidencia privada local: `/tmp/ppp-187-prod-errors.log`. No subir el log crudo: contiene conversaciones e identificadores. Esta investigación no modifica mensajes de error ni resuelve la causa financiera.

## Ubicaciones

- Se aprovecha `end_address` de la consulta Directions existente: no se añade una segunda llamada de geocodificación.
- Para un pin sin nombre, la calle devuelta se presenta como **Referencia de mapa**, no como dirección exacta garantizada. El punto puede estar en un acceso vial cercano.
- Los nombres/direcciones que aporta el pin tienen prioridad; se conservan torre/apartamento/entrada pendientes.
- Se elimina el bloque de latitud/longitud suelto. La orden conserva un enlace con las coordenadas originales para navegar, incluso si la calle de la ruta difiere.
- La respuesta al cliente oculta el enlace técnico y las coordenadas. La dirección enviada en el DTO incluye texto legible + acceso + enlace.
- Sin etiqueta disponible se conserva «Ubicación compartida» y el enlace exacto. No inventar una calle. Modo fijo/sin respuesta del mapa no obtiene una nueva dirección por esta mejora.

## Validación

Ocho recorridos nuevos: pin nativo/enlace, nombre presente/ausente, respuesta de mapa con/sin dirección. Usan el servicio de rutas real con HTTP simulado y el router completo; comprueban una única petición, respuesta, coordenadas, acceso y DTO final con notas/producto preservados. Los casos de enlace no transportan nombre aunque la matriz incluya esa variante. Primer ensayo tenía una configuración de tarifas incompleta: no contarlo como baseline del defecto. Tras completar tarifas, tres casos reprodujeron pérdida de etiqueta antes de la corrección final.

Pruebas gratuitas: ningún mensaje Meta, consulta Google real ni orden externa. Foco inicial82/82 y TypeScript general/build/Node92 aprobados. La primera global detectó44fallos:8expectativas de orden antiguo del texto y36regresiones reales al reconocer un pin por el prefijo visual 📍. Se actualizó la expectativa al formato legible y la identificación del pin al enlace exacto coincidente con las coordenadas guardadas. Revalidación focal104/104 (753pruebas excluidas por filtro, no contarlas como ejecutadas); TypeScript general/build finalesOK. Global final18.409/18.409 pruebas,255suites,555hashes,739,29s: inventario exacto/fuente congelada; ver artefactos `/tmp/ppp-187-focus-final.json`, `/tmp/ppp-187-final-global-summary.json`, TypeScript general/build y Node.

## Siguiente

Mantener pendiente el mensaje largo de sopa + ejecutivo de186. No mezclar la confirmación escrita de dirección con una validación real del mapa. Considerar una tanda aparte para degradación de servicio ante falta de saldo y métricas de error, con preservación del carrito y sin pedir al cliente repetir una modificación ya aplicada.
