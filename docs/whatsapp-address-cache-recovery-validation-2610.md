# Tanda 230 — reutilizar una geocodificación recuperada

Base `3ce34dca`, staging. Problema reproducido: después de encontrar una dirección en la tercera variante, la siguiente cotización repetía dos consultas fallidas antes de usar el acierto guardado.

## Corrección

Antes de consultar al proveedor se revisan aciertos vigentes entre las variantes del mismo destino. No se almacenan fallos ni se reusa tarifa/ruta. La clave ahora incluye coordenadas exactas del origen, región y límite de aceptación en línea recta; antes redondeaba el origen a tres decimales y omitía el límite. La caducidad de12horas se conserva y una entrada consultada vencida se elimina.

18 regresiones: tres tipos de vía×repetición/origen cercano distinto/límite distinto/puerta distinta/caducidad/fallo seguido de recuperación. Baseline inicial3 fallos; al fortalecer el conteo de consultas para origen/límite, baseline estricto9 rojas/9 verdes. Tras corregir18/18. Foco80/80 en5 suites, incluyendo recorridos de tres menús con respuesta/carrito/estado/DTO. Node92 y guardia Falafel1 aprobados. TypeScript general/build aprobados. Global completa19.808 pruebas/298 suites,605 hashes,751,14s; inventario exacto y fuente sin cambios. Evidencia `/tmp/ppp-230-final-global-summary.json` y `/tmp/ppp-230-*`.

## Costos y alcance

En los tres casos simulados de repetición se evitan dos consultas de geocodificación por recotización (de2 a0); la primera resolución usa3. La consulta de ruta sigue ejecutándose, por lo que no significa cero costo total ni un porcentaje de ahorro real. No se hizo ninguna llamada externa pagada, Meta ni orden externa. No acredita la calidad del mapa real ni resuelve automáticamente79A frente a79B/Bis.

Sin cambios de modelos/Main ni despliegue. Perfil de WhatsApp pendiente. Siguiente: captura de nombre de perfil como sugerencia editable, con identidad del remitente comprobada, precedencia de destinatario explícito, alias inválidos y correcciones durante checkout. No usar el nombre visible como autenticación ni reescribir usuarios vinculados.

## Diseño del siguiente bloque (no implementado aquí)

- Obtener profile.name solo del contacto cuyo wa_id coincide con el remitente del mensaje; webhook con varios contactos no mezcla nombres.
- Prioridad: destinatario explícito > nombre guardado/cuenta vinculada válido > sugerencia de perfil válida. No sobreescribir datos de cuenta web.
- Rechazar perfil ausente, vacío, emojis solos y alias no utilizables sin decir que el cliente tiene un nombre «falso».
- Conservar el campo al procesar ráfagas y medios; no reaplicar el perfil sobre una corrección posterior del cliente.
- Recorrer pedido+dirección→pago→resumen→confirmación con tres menús, y destinatario distinto enviado antes/después de pago. Verificar respuesta y DTO, no solamente texto de agradecimiento.
- Mantener una sola confirmación final y nunca tratar el nombre de perfil como prueba de identidad.
