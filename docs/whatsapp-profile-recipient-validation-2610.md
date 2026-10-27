# Tanda 231 — destinatario sugerido por perfil de WhatsApp

Base `b571a600`, staging. Objetivo: evitar pedir nombre si el webhook ya aporta uno utilizable, sin sobrescribir el destinatario que eligió el cliente.

## Comportamiento

El parser toma profile.name únicamente de contactos con wa_id idéntico al remitente; contactos duplicados con nombres distintos no generan sugerencia. La sugerencia se normaliza y valida conservadoramente:2–6 palabras de letras/apóstrofes/guiones, máximo80 caracteres y validación existente de nombres; emojis solos, cifras, mensajes, placeholders y términos comerciales comunes no se usan automáticamente. Esto es una heurística, no identidad verificada ni identificación infalible de negocios. Un nombre de una sola palabra todavía se pide explícitamente.

Después de reclamar el mensaje y recargar conversación, y fuera de atención humana, completa únicamente customerName vacío. No modifica cuentas web ni reemplaza nombres guardados. Los manejadores existentes permiten cambiar el destinatario en el mismo pedido; el resumen muestra el nombre y se mantiene confirmación final. Los mensajes duplicados no cambian el nombre. En ráfagas se conserva una sugerencia consistente aunque llegue en la segunda burbuja; contradicciones se omiten.

## Pruebas

45 nuevas: transporte texto/audio/imagen y contactos ajenos/conflictivos, perfiles no utilizables,24 conversaciones de tres menús×agente simulado off/on×vacío/guardado/corrección/otro destinatario en el mensaje inicial, tres controles duplicado/humano/perfil inválido y cuatro de agrupación.

Baseline inicial15 rojas/17 verdes. Baseline ráfagas2 rojas/2 verdes. Foco final64/64 en5 suites: respuesta, carrito, conservación de destinatario, estado completed y DTO de una única orden simulada únicamente tras confirmar. TS general/build, Node92 y Falafel1 verdes; global19.853/300 suites,608 hashes,748,56s, inventario exacto/fuente congelada. Evidencias `/tmp/ppp-231-*`.

## Límites y siguiente bloque

No hubo llamadas externas pagadas, Meta ni órdenes externas; la recepción real del perfil aún requiere smoke controlado tras desplegar. No promete eliminar siempre la pregunta: perfiles sin nombre utilizable o con alias siguen requiriendo destinatario. No se usa perfil como autenticación, ni altera la vinculación de cuentas/puntos.

Siguiente: recorrer rechazo/cambio de destinatario junto a dirección, pago o consultas en un mismo mensaje, perfil sobre conversaciones viejas y ráfagas parciales con contactos ausentes. Medir reducción de turnos con canal real después de despliegue agrupado, sin atribuir ahorro monetario a mocks.

Main/modelos intactos. Publicación staging; despliegue agrupado preparado tras validación. Actualizar esta sección con evidencia del servidor antes de acreditar despliegue. No declarar vendible por conteos.
